import { timingSafeEqual } from "crypto";
import { Router } from "express";
import {
  pool,
  withTenant,
  profilesTable,
  assignmentsTable,
  roomsTable,
  buildingsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { logActivity } from "../lib/activity-logger.js";
import {
  requireAnyPermission,
  loadAuthUser,
  hasPermission,
} from "../middlewares/permissions.js";
import { getTenantId, su } from "../lib/request-utils.js";
import {
  getEsignConfig,
  getEsignConfigs,
  getEsignConfigById,
  testEsignConnection,
  fetchEmployeeByCode,
  fetchEmployeeFromAllSources,
  SunriseEsignConfig,
} from "../lib/sunrise-esign-service.js";

export interface HrSourceConfig {
  id: string;
  name: string;
  apiUrl: string;
  apiKey?: string;
  targetPropertyIds?: number[];
  syncProfiles?: boolean;
  allowedLevels?: string[];
  allowedDepartments?: string[];
  housingEligibleOnly?: boolean;
  autoCheckoutOnDeparture?: boolean;
  autoVacationSync?: boolean;
  isActive?: boolean;
  lastSyncAt?: string | null;
}

const HrSourceConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiUrl: z.string(),
  apiKey: z.string().optional().nullable(),
  targetPropertyIds: z.array(z.number()).optional().default([]),
  syncProfiles: z.boolean().optional().default(true),
  allowedLevels: z.array(z.string()).optional().default([]),
  allowedDepartments: z.array(z.string()).optional().default([]),
  housingEligibleOnly: z.boolean().optional().default(false),
  autoCheckoutOnDeparture: z.boolean().optional().default(true),
  autoVacationSync: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
  lastSyncAt: z.string().optional().nullable(),
});

const HrSyncConfigSchema = z.object({
  apiUrl: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  fieldMapping: z.record(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
  autoCheckoutOnDeparture: z.boolean().optional(),
  autoVacationSync: z.boolean().optional(),
  targetPropertyIds: z.array(z.number()).optional().default([]),
  sources: z.array(HrSourceConfigSchema).optional().default([]),
  esignConfig: z.record(z.any()).optional().nullable(),
});

// Constant-time comparison so the API key cannot be guessed by timing.
function safeEqual(a: unknown, b: unknown): boolean {
  const x = Buffer.from(String(Array.isArray(a) ? a[0] : (a ?? "")));
  const y = Buffer.from(String(Array.isArray(b) ? b[0] : (b ?? "")));
  return x.length === y.length && timingSafeEqual(x, y);
}
const router: Router = Router();
import { syncEmployeeAccommodationLifecycle } from "../lib/hr-sync/lifecycle.js";
import { processReceive } from "../lib/hr-sync/process-receive.js";
import { buildMockHrFeed } from "../lib/hr-sync/mock-feed.js";
import { validate } from "../middlewares/validate.js";
import {
  CommonListQuery,
  ProfileCodeParams,
  HrReceiveBody,
  HrSyncRunBody,
  HrTestConnectionBody,
  HrNotifyVacationBody,
  HrNotifyDepartureBody,
  EsignTestBody,
  EsignRangeSyncBody,
  EsignRefreshBody,
} from "../validation/schemas.js";

// ============================================================================
// GET /api/hr-sync/config — Get HR sync config for current property
// ============================================================================
router.get(
  "/config",
  requireAnyPermission(["hr_sync", "view"], ["settings", "view"]),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const configRes = await pool.query(
      `SELECT * FROM public.hr_sync_config WHERE property_id = $1`,
      [propertyId],
    );
    if (!configRes?.rows?.[0]) {
      res.json({
        success: true,
        config: {
          apiUrl: "",
          apiKey: "",
          fieldMapping: {},
          isActive: false,
          autoCheckoutOnDeparture: true,
          autoVacationSync: true,
          targetPropertyIds: [propertyId],
          sources: [],
          esignConfig: null,
          esignConfigs: [],
          lastSyncAt: null,
        },
      });
      return;
    }
    const row = configRes.rows[0];
    const rawSources: HrSourceConfig[] = Array.isArray(row.sources)
      ? row.sources
      : [];
    const safeSources = rawSources.map((s) => ({
      ...s,
      apiKey: s.apiKey ? "••••••" : "",
    }));

    // Multi-source esign: normalize raw to array and mask passwords
    const rawEsignData = row.esign_config;
    let esignArr: SunriseEsignConfig[] = [];
    if (Array.isArray(rawEsignData)) {
      esignArr = rawEsignData;
    } else if (
      rawEsignData &&
      typeof rawEsignData === "object" &&
      (rawEsignData.username || rawEsignData.hotelCode)
    ) {
      esignArr = [{ id: "default", label: "Default", ...rawEsignData }];
    }

    const safeEsignConfigs = esignArr.map((c: any) => ({
      ...c,
      password: c.password ? "••••••••" : "",
    }));

    // Backward compat: esignConfig = first source (masked)
    const safeEsign = safeEsignConfigs.length > 0 ? safeEsignConfigs[0] : null;

    res.json({
      success: true,
      config: {
        id: row.id,
        apiUrl: row.api_url || "",
        apiKey: row.api_key ? "••••••" : "",
        fieldMapping: row.field_mapping || {},
        isActive: row.is_active || false,
        autoCheckoutOnDeparture: row.auto_checkout_on_departure ?? true,
        autoVacationSync: row.auto_vacation_sync ?? true,
        targetPropertyIds:
          Array.isArray(row.target_property_ids) &&
          row.target_property_ids.length > 0
            ? row.target_property_ids
            : [propertyId],
        sources: safeSources,
        esignConfig: safeEsign,
        esignConfigs: safeEsignConfigs,
        lastSyncAt: row.last_sync_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  },
);

// ============================================================================
// PUT /api/hr-sync/config — Upsert HR sync config
// ============================================================================
router.put(
  "/config",
  requireAnyPermission(["hr_sync", "edit"], ["settings", "edit"]),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const parsed = HrSyncConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
      return;
    }

    const {
      apiUrl,
      apiKey,
      fieldMapping,
      isActive,
      autoCheckoutOnDeparture,
      autoVacationSync,
      targetPropertyIds,
      sources,
      esignConfig,
    } = parsed.data;

    const existingRes = await pool.query(
      `SELECT id, api_key, sources, esign_config FROM public.hr_sync_config WHERE property_id = $1`,
      [propertyId],
    );
    const existing = existingRes?.rows?.[0];

    let finalApiKey = apiKey;
    if (apiKey === "••••••" || (apiKey && apiKey.startsWith("•••"))) {
      finalApiKey = existing?.api_key || "";
    }

    const existingSources: HrSourceConfig[] = Array.isArray(existing?.sources)
      ? existing.sources
      : [];
    const existingKeyMap = new Map(
      existingSources.map((s) => [s.id, s.apiKey || ""]),
    );

    const finalSources = (sources || []).map((s: any) => {
      let key = s.apiKey;
      if (key === "••••••" || (key && key.startsWith("•••"))) {
        key = existingKeyMap.get(s.id) || "";
      }
      return {
        ...s,
        apiKey: key || undefined,
      };
    });

    // Multi-source esign: accept esignConfigs (array) or esignConfig (single, backward compat)
    const incomingEsignConfigs: SunriseEsignConfig[] | undefined =
      Array.isArray(req.body.esignConfigs) ? req.body.esignConfigs : undefined;

    // Load existing esign data for password preservation
    let existingEsignArr: SunriseEsignConfig[] = [];
    if (existing?.esign_config) {
      if (Array.isArray(existing.esign_config)) {
        existingEsignArr = existing.esign_config;
      } else if (
        typeof existing.esign_config === "object" &&
        (existing.esign_config.username || existing.esign_config.hotelCode)
      ) {
        existingEsignArr = [
          { id: "default", label: "Default", ...existing.esign_config },
        ];
      }
    }
    const existingPwdMap = new Map(
      existingEsignArr.map((c: any) => [c.id || "default", c.password || ""]),
    );

    let finalEsignConfig: any;

    if (incomingEsignConfigs) {
      // New array format: preserve masked passwords per source
      finalEsignConfig = incomingEsignConfigs.map((c: any) => {
        let pwd = c.password;
        if (
          pwd === "••••••••" ||
          (typeof pwd === "string" && pwd.startsWith("•••"))
        ) {
          pwd = existingPwdMap.get(c.id || "default") || "";
        }
        return { ...c, password: pwd };
      });
    } else if (esignConfig && typeof esignConfig === "object") {
      // Legacy single object format
      const existingEsign = existingEsignArr[0] || {};
      let pwd = esignConfig.password;
      if (
        pwd === "••••••••" ||
        (typeof pwd === "string" && pwd.startsWith("•••"))
      ) {
        pwd = (existingEsign as any).password || "";
      }
      finalEsignConfig = [
        {
          id: "default",
          label: "Default",
          ...existingEsign,
          ...esignConfig,
          password: pwd,
        },
      ];
    }

    if (existing) {
      const updates: any = { updated_at: new Date() };
      if (apiUrl !== undefined) updates.api_url = apiUrl;
      if (finalApiKey !== undefined) updates.api_key = finalApiKey;
      if (fieldMapping !== undefined)
        updates.field_mapping = JSON.stringify(fieldMapping);
      if (isActive !== undefined) updates.is_active = isActive;
      if (autoCheckoutOnDeparture !== undefined)
        updates.auto_checkout_on_departure = autoCheckoutOnDeparture;
      if (autoVacationSync !== undefined)
        updates.auto_vacation_sync = autoVacationSync;
      if (targetPropertyIds !== undefined)
        updates.target_property_ids = JSON.stringify(targetPropertyIds);
      if (sources !== undefined) updates.sources = JSON.stringify(finalSources);
      if (finalEsignConfig !== undefined)
        updates.esign_config = JSON.stringify(finalEsignConfig);

      const setClauses = Object.entries(updates)
        .map(([k, v], i) => `${k} = $${i + 2}`)
        .join(", ");
      const values = [propertyId, ...Object.values(updates)];
      await pool.query(
        `UPDATE public.hr_sync_config SET ${setClauses} WHERE property_id = $1`,
        values,
      );
    } else {
      await pool.query(
        `INSERT INTO public.hr_sync_config (
           property_id, api_url, api_key, field_mapping, is_active, 
           auto_checkout_on_departure, auto_vacation_sync, target_property_ids, sources, esign_config, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
          propertyId,
          apiUrl || "",
          finalApiKey || "",
          JSON.stringify(fieldMapping || {}),
          isActive || false,
          autoCheckoutOnDeparture ?? true,
          autoVacationSync ?? true,
          JSON.stringify(targetPropertyIds || [propertyId]),
          JSON.stringify(finalSources),
          JSON.stringify(finalEsignConfig || {}),
        ],
      );
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تحديث إعدادات ربط HR والمصادر المتعددة`,
      actionType: "UPDATE",
      module: "hr_sync",
      entityType: "hr_sync_config",
      entityId: propertyId,
    });

    res.json({ success: true, message: "HR sync config updated" });
  },
);

// ============================================================================
// POST /api/hr-sync/receive — Receive profile data pushed from HR system
// Body: { propertyId, profiles: [...], mapping?: {...}, ...options }
// ============================================================================
router.post(
  "/receive",
  validate({ query: CommonListQuery }),
  validate({ body: HrReceiveBody }),
  async (req, res): Promise<void> => {
    const expectedKey = (process.env["HR_SYNC_API_KEY"] || "").trim();
    const providedKey = String(req.headers["x-api-key"] || "").trim();
    const isAdmin = Boolean((req as any).session?.userId);
    if (isAdmin) {
      const authUser = await loadAuthUser(req, res);
      if (
        !authUser ||
        (!authUser.isSystemAdmin &&
          !hasPermission(authUser, "hr_sync", "edit") &&
          !hasPermission(authUser, "profiles", "create"))
      ) {
        res.status(403).json({
          success: false,
          error: "Permission denied. Requires hr_sync.edit or profiles.create",
        });
        return;
      }
    } else {
      if (expectedKey) {
        if (!safeEqual(providedKey, expectedKey)) {
          console.warn("[HR_SYNC_AUTH_FAIL] invalid x-api-key");
          res.status(401).json({ success: false, error: "Unauthorized" });
          return;
        }
      } else if (process.env.NODE_ENV === "production") {
        res.status(403).json({
          error:
            "HR_SYNC_API_KEY not configured — webhook access denied in production",
        });
        return;
      }
    }

    const propertyId =
      Number(req.body?.propertyId) || Number(req.query?.propertyId);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const profiles =
      req.body?.profiles || req.body?.employees || req.body?.data || req.body;
    if (!Array.isArray(profiles) || profiles.length === 0) {
      res
        .status(400)
        .json({ error: "profiles array required (e.g. { profiles: [...] })" });
      return;
    }

    const mapping = req.body?.mapping || {};
    const options = {
      syncProfiles: req.body?.syncProfiles !== false,
      allowedLevels: req.body?.allowedLevels || [],
      allowedDepartments: req.body?.allowedDepartments || [],
      housingEligibleOnly: req.body?.housingEligibleOnly || false,
      scope: req.body?.scope || "full",
    };

    const result = await processReceive(
      propertyId,
      profiles,
      req,
      mapping,
      options,
    );

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s?.username || "hr-webhook",
      userId: s?.userId || 0,
      userRole: s?.userRole || "system",
      action: `استقبال بيانات موظفين من HR (Push) — تم إنشاء ${result.stats.created} وتحديث ${result.stats.updated} وترقية ${result.stats.casualUpgrades} مؤقتين وإخلاء ${result.stats.departedAutoCheckouts} وتسجيل ${result.stats.lookupsAdded} مسميات`,
      actionType: "SYNC",
      module: "hr_sync",
      entityType: "profile",
      entityId: propertyId,
    });

    res.json(result);
  },
);

// ============================================================================
// POST /api/hr-sync/sync — Pull profiles from external HR API
// ============================================================================
router.post(
  "/sync",
  requireAnyPermission(["hr_sync", "edit"], ["settings", "edit"]),
  validate({ body: HrSyncRunBody }),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const { sourceId, scope = "full" } = req.body || {};

    const configResult = await pool.query(
      `SELECT * FROM public.hr_sync_config WHERE property_id = $1`,
      [propertyId],
    );
    const config = configResult?.rows?.[0];
    if (!config) {
      res.status(400).json({
        error: "HR sync not configured for this property",
      });
      return;
    }

    const configuredSources: HrSourceConfig[] = Array.isArray(config.sources)
      ? config.sources
      : [];

    let sourcesToRun: HrSourceConfig[] = [];
    if (sourceId) {
      const found = configuredSources.find((s) => s.id === sourceId);
      if (found) {
        sourcesToRun = [found];
      } else {
        res
          .status(404)
          .json({ error: `المصدر المحدد '${sourceId}' غير مسجل في النظام` });
        return;
      }
    } else if (configuredSources.length > 0) {
      sourcesToRun = configuredSources.filter((s) => {
        if (!s.isActive) return false;
        if (!s.targetPropertyIds || s.targetPropertyIds.length === 0)
          return true;
        return s.targetPropertyIds.includes(propertyId);
      });
    } else if (config.api_url && config.is_active) {
      sourcesToRun = [
        {
          id: "default",
          name: "Default HR API",
          apiUrl: config.api_url,
          apiKey: config.api_key,
          syncProfiles: true,
          autoCheckoutOnDeparture: config.auto_checkout_on_departure ?? true,
          autoVacationSync: config.auto_vacation_sync ?? true,
          isActive: true,
        },
      ];
    }

    if (sourcesToRun.length === 0) {
      res.status(400).json({
        error: "لا توجد مصادر HR نشطة مخصصة لهذا السكن حالياً",
      });
      return;
    }

    const logEntry = await pool.query(
      `INSERT INTO public.hr_sync_log (property_id, sync_type, status, started_at)
       VALUES ($1, $2, 'in_progress', NOW()) RETURNING id`,
      [
        propertyId,
        scope === "lookups_only"
          ? "lookups"
          : scope === "movements_only"
            ? "movements"
            : "pull",
      ],
    );
    const logId = logEntry?.rows?.[0]?.id;

    let totalReceived = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalDepartedCheckouts = 0;
    let totalCasualUpgrades = 0;
    let totalLookupsAdded = 0;
    let errors: string[] = [];
    let sourceResults: any[] = [];

    const port = process.env.PORT || 4000;

    for (const source of sourcesToRun) {
      try {
        let fetchUrl = source.apiUrl.trim();
        if (fetchUrl.startsWith("/")) {
          fetchUrl = `http://localhost:${port}${fetchUrl}`;
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (source.apiKey && !source.apiKey.startsWith("•••")) {
          headers["Authorization"] = `Bearer ${source.apiKey}`;
          headers["x-api-key"] = source.apiKey;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);
        const response = await fetch(fetchUrl, {
          headers,
          signal: controller.signal as any,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `[${source.name}] HR API returned ${response.status}: ${response.statusText}`,
          );
        }

        const data = (await response.json()) as any;
        const profiles = Array.isArray(data)
          ? data
          : data.profiles || data.employees || data.data || [];

        const mapping = config.field_mapping || {};
        const sourceRes = await processReceive(
          propertyId,
          profiles,
          req,
          mapping,
          {
            syncProfiles: source.syncProfiles !== false,
            allowedLevels: source.allowedLevels || [],
            allowedDepartments: source.allowedDepartments || [],
            housingEligibleOnly: source.housingEligibleOnly || false,
            scope,
            sourceName: source.name,
          },
        );

        totalReceived += sourceRes.stats?.received || 0;
        totalCreated += sourceRes.stats?.created || 0;
        totalUpdated += sourceRes.stats?.updated || 0;
        totalDepartedCheckouts += sourceRes.stats?.departedAutoCheckouts || 0;
        totalCasualUpgrades += sourceRes.stats?.casualUpgrades || 0;
        totalLookupsAdded += sourceRes.stats?.lookupsAdded || 0;
        if (sourceRes.errors && sourceRes.errors.length > 0) {
          errors.push(...sourceRes.errors);
        }

        sourceResults.push({
          sourceId: source.id,
          sourceName: source.name,
          stats: sourceRes.stats,
        });

        source.lastSyncAt = new Date().toISOString();
      } catch (err: any) {
        errors.push(`[${source.name}] ${err.message}`);
        sourceResults.push({
          sourceId: source.id,
          sourceName: source.name,
          error: err.message,
        });
      }
    }

    if (configuredSources.length > 0) {
      await pool.query(
        `UPDATE public.hr_sync_config SET sources = $1, last_sync_at = NOW(), updated_at = NOW() WHERE property_id = $2`,
        [JSON.stringify(configuredSources), propertyId],
      );
    } else {
      await pool.query(
        `UPDATE public.hr_sync_config SET last_sync_at = NOW(), updated_at = NOW() WHERE property_id = $1`,
        [propertyId],
      );
    }

    await pool.query(
      `UPDATE public.hr_sync_log 
       SET status = $1, records_processed = $2, records_created = $3, records_updated = $4, errors = $5, completed_at = NOW()
       WHERE id = $6`,
      [
        errors.length > 0
          ? totalReceived > 0
            ? "completed_with_errors"
            : "failed"
          : "completed",
        totalReceived,
        totalCreated,
        totalUpdated,
        errors.slice(0, 10).join("; ") || null,
        logId,
      ],
    );

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s?.username || "hr-sync",
      userId: s?.userId || 0,
      userRole: s?.userRole || "system",
      action: `مزامنة HR (${scope}) لـ ${sourcesToRun.length} مصادر — تم إنشاء ${totalCreated}، وتحديث ${totalUpdated}، وترقية ${totalCasualUpgrades} عمالة مؤقتة، وإخلاء ${totalDepartedCheckouts}، وتسجيل ${totalLookupsAdded} مسميات وأقسام`,
      actionType: "SYNC",
      module: "hr_sync",
      entityType: "profile",
      entityId: propertyId,
    });

    res.json({
      success: true,
      stats: {
        sourcesRun: sourcesToRun.length,
        received: totalReceived,
        created: totalCreated,
        updated: totalUpdated,
        departedAutoCheckouts: totalDepartedCheckouts,
        casualUpgrades: totalCasualUpgrades,
        lookupsAdded: totalLookupsAdded,
        errors: errors.length,
      },
      sourceResults,
      errors: errors.length > 0 ? errors : undefined,
    });
  },
);

// ============================================================================
// POST /api/hr-sync/test-connection — Test reachability & sample payload of an HR URL
// ============================================================================
router.post(
  "/test-connection",
  requireAnyPermission(["hr_sync", "view"], ["settings", "view"]),
  validate({ body: HrTestConnectionBody }),
  async (req, res): Promise<void> => {
    const { apiUrl, apiKey } = req.body || {};
    if (!apiUrl) {
      res
        .status(400)
        .json({ success: false, error: "apiUrl مطلوب لاختبار الرابط" });
      return;
    }

    const startTime = Date.now();
    try {
      const port = process.env.PORT || 4000;
      let targetUrl = String(apiUrl).trim();
      if (targetUrl.startsWith("/")) {
        targetUrl = `http://localhost:${port}${targetUrl}`;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey && !apiKey.startsWith("•••")) {
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["x-api-key"] = apiKey;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(targetUrl, {
        headers,
        signal: controller.signal as any,
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        res.status(400).json({
          success: false,
          error: `استجابة غير صالحة من الـ API: HTTP ${response.status} ${response.statusText}`,
          latencyMs,
        });
        return;
      }

      const data = (await response.json()) as any;
      const rawList = Array.isArray(data)
        ? data
        : data.profiles || data.employees || data.data || [];

      res.json({
        success: true,
        latencyMs,
        count: Array.isArray(rawList) ? rawList.length : 0,
        sample: Array.isArray(rawList) ? rawList.slice(0, 3) : [],
        message: `الاتصال ناجح (${latencyMs}ms) — تم العثور على ${Array.isArray(rawList) ? rawList.length : 0} سجل موظف`,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error:
          err.name === "AbortError"
            ? "انتهت مهلة الاتصال (Timeout 15s)"
            : err.message,
        latencyMs: Date.now() - startTime,
      });
    }
  },
);

// ============================================================================
// GET /api/hr-sync/mock-feed — Realistic Mock API feed for testing multi-hotel sync
// ============================================================================
router.get(
  "/mock-feed",
  validate({ query: CommonListQuery }),
  (req, res): void => {
    const hotel = String(req.query.hotel || "all").toLowerCase();
    const testUpgrade = req.query.test_casual_upgrade === "true";

    const allRecords = buildMockHrFeed(testUpgrade);

    let filtered = allRecords;
    if (hotel === "al_taj") {
      filtered = allRecords.filter((r) => r.hotel === "al_taj");
    } else if (hotel === "white_hills") {
      filtered = allRecords.filter((r) => r.hotel === "white_hills");
    } else if (hotel === "al_marafe") {
      filtered = allRecords.filter((r) => r.hotel === "al_marafe");
    }

    res.json(filtered);
  },
);

// ============================================================================
// POST /api/hr-sync/notify-vacation — Direct Vacation Start or Return Webhook
// Body: { propertyId, profileId, type: "START"|"RETURN", startDate?, endDate?, notes? }
// ============================================================================
router.post(
  "/notify-vacation",
  validate({ query: CommonListQuery }),
  validate({ body: HrNotifyVacationBody }),
  async (req, res): Promise<void> => {
    const expectedKey = (process.env["HR_SYNC_API_KEY"] || "").trim();
    const providedKey = String(req.headers["x-api-key"] || "").trim();
    if (expectedKey) {
      if (!safeEqual(providedKey, expectedKey)) {
        console.warn("[HR_SYNC_AUTH_FAIL_VACATION]", {
          expectedKey,
          providedKey,
        });
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }
    } else if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        error:
          "HR_SYNC_API_KEY not configured — webhook access denied in production",
      });
      return;
    }

    const propertyId =
      Number(req.body?.propertyId) || Number(req.query?.propertyId);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const {
      profileId,
      employeeId,
      type = "START",
      startDate,
      endDate,
      notes,
    } = req.body as any;

    const targetId = profileId || employeeId;
    if (!targetId) {
      res.status(400).json({ error: "profileId or employeeId required" });
      return;
    }

    const isReturn =
      String(type).toUpperCase() === "RETURN" ||
      String(type).toUpperCase() === "END";

    let updatedProfile: any = null;

    await withTenant(propertyId, async (tenantDb) => {
      const [profile] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.profileId, String(targetId)));

      if (!profile) {
        res.status(404).json({ success: false, error: "Profile not found" });
        return;
      }

      if (isReturn) {
        // Return from vacation -> status ACTIVE
        const [emp] = await tenantDb
          .update(profilesTable)
          .set({
            status: "ACTIVE",
            vacationStartDate: null,
            vacationEndDate: null,
            vacationNotes: "",
          })
          .where(eq(profilesTable.id, profile.id))
          .returning();
        updatedProfile = emp;

        await syncEmployeeAccommodationLifecycle({
          tenantDb,
          propertyId,
          profile,
          previousStatus: "VACATION",
          newStatus: "ACTIVE",
          autoVacationSync: true,
          req,
        });
      } else {
        // Start vacation -> status VACATION
        const [emp] = await tenantDb
          .update(profilesTable)
          .set({
            status: "VACATION",
            vacationStartDate:
              startDate || new Date().toISOString().split("T")[0],
            vacationEndDate: endDate || null,
            vacationNotes: notes || "إجازة مسجلة من HR",
          })
          .where(eq(profilesTable.id, profile.id))
          .returning();
        updatedProfile = emp;

        await syncEmployeeAccommodationLifecycle({
          tenantDb,
          propertyId,
          profile,
          previousStatus: profile.status,
          newStatus: "VACATION",
          autoVacationSync: true,
          vacationStartDate:
            startDate || new Date().toISOString().split("T")[0],
          vacationEndDate: endDate || null,
          vacationNotes: notes || "إجازة مسجلة من HR",
          req,
        });
      }
    });

    if (res.headersSent) return;

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s?.username || "hr-sync",
      userId: s?.userId || 0,
      userRole: s?.userRole || "system",
      action: isReturn
        ? `عودة موظف #${targetId} من الإجازة عبر HR`
        : `خروج موظف #${targetId} في إجازة عبر HR`,
      actionType: "UPDATE",
      module: "hr_sync",
      entityType: "profile",
      entityId: targetId,
    });

    res.json({
      success: true,
      message: isReturn
        ? "Employee returned from vacation successfully"
        : "Employee vacation recorded successfully",
      profile: updatedProfile,
    });
  },
);

// ============================================================================
// POST /api/hr-sync/notify-departure — HR system notifies termination/departure
// Body: { propertyId, profileId, departureDate?, reason? }
// ============================================================================
router.post(
  "/notify-departure",
  validate({ query: CommonListQuery }),
  validate({ body: HrNotifyDepartureBody }),
  async (req, res): Promise<void> => {
    try {
      const expectedKey = (process.env["HR_SYNC_API_KEY"] || "").trim();
      const providedKey = String(req.headers["x-api-key"] || "").trim();
      if (expectedKey) {
        if (!safeEqual(providedKey, expectedKey)) {
          console.warn("[HR_SYNC_AUTH_FAIL_DEP] invalid x-api-key");
          res.status(401).json({ success: false, error: "Unauthorized" });
          return;
        }
      } else if (process.env.NODE_ENV === "production") {
        res.status(403).json({
          error:
            "HR_SYNC_API_KEY not configured — webhook access denied in production",
        });
        return;
      }

      const propertyId =
        Number(req.body?.propertyId) || Number(req.query?.propertyId);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId required" });
        return;
      }

      const {
        profileId,
        employeeId,
        departureDate,
        reason = "Resigned / Terminated from HR",
      } = req.body as any;

      const targetId = profileId || employeeId;
      if (!targetId) {
        res.status(400).json({ error: "profileId or employeeId required" });
        return;
      }

      let checkoutResult: any = null;
      let updatedProfile: any = null;

      await withTenant(propertyId, async (tenantDb) => {
        const [profile] = await tenantDb
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.profileId, String(targetId)));

        if (!profile) {
          res.status(404).json({ success: false, error: "Profile not found" });
          return;
        }

        // Update profile status to departed
        const [emp] = await tenantDb
          .update(profilesTable)
          .set({ status: "DEPARTED" })
          .where(eq(profilesTable.profileId, String(targetId)))
          .returning();
        updatedProfile = emp;

        // Run accommodation checkout & room status transition
        checkoutResult = await syncEmployeeAccommodationLifecycle({
          tenantDb,
          propertyId,
          profile,
          previousStatus: profile.status,
          newStatus: "DEPARTED",
          autoCheckoutOnDeparture: true,
          departureDate,
          departureReason: reason,
          req,
        });
      });

      if (res.headersSent) return;

      // Log activity
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s?.username || "hr-sync",
        userId: s?.userId || 0,
        userRole: s?.userRole || "system",
        action:
          `تصفية ومغادرة تلقائية للموظف #${targetId} من HR` +
          (checkoutResult
            ? ` — تم إنهاء السكن وإخلاء الغرفة ${checkoutResult.roomNumber}`
            : ""),
        actionType: "UPDATE",
        module: "hr_sync",
        entityType: "profile",
        entityId: typeof targetId === "number" ? targetId : undefined,
      });

      // Sync log
      await pool.query(
        `INSERT INTO public.hr_sync_log (property_id, sync_type, status, records_processed, records_created, records_updated, errors, started_at, completed_at)
       VALUES ($1, 'departure', 'completed', 1, 0, 1, NULL, NOW() - interval '1 second', NOW())`,
        [propertyId],
      );

      res.json({
        success: true,
        message:
          "Profile marked as departed" +
          (checkoutResult
            ? ` and automatically checked out from Room ${checkoutResult.roomNumber}`
            : ""),
        profile: updatedProfile,
        autoCheckout: checkoutResult,
      });
    } catch (err: any) {
      console.error("[NOTIFY_DEPARTURE_ERROR]", err);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ success: false, error: err.message, stack: err.stack });
      }
    }
  },
);

// ============================================================================
// GET /api/hr-sync/logs — Get sync history for current property
// ============================================================================
router.get(
  "/logs",
  requireAnyPermission(["hr_sync", "view"], ["settings", "view"]),
  validate({ query: CommonListQuery }),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const limit = Math.min(Number(req.query?.limit) || 20, 100);
    const result = await pool.query(
      `SELECT * FROM public.hr_sync_log WHERE property_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [propertyId],
    );

    res.json({ success: true, logs: result?.rows || [] });
  },
);

// ============================================================================
// GET /api/hr-sync/profiles/:profileId — Full profile data for HR system
// ============================================================================
router.get(
  "/profiles/:profileId",
  validate({ params: ProfileCodeParams }),
  async (req, res): Promise<void> => {
    const expectedKey = process.env["HR_SYNC_API_KEY"];
    const providedKey = req.headers["x-api-key"];
    const isAdmin = Boolean((req as any).session?.userId);
    if (isAdmin) {
      const authUser = await loadAuthUser(req, res);
      if (
        !authUser ||
        (!authUser.isSystemAdmin &&
          !hasPermission(authUser, "hr_sync", "view") &&
          !hasPermission(authUser, "profiles", "view"))
      ) {
        res.status(403).json({
          success: false,
          error: "Permission denied. Requires hr_sync.view or profiles.view",
        });
        return;
      }
    } else {
      if (expectedKey) {
        if (!safeEqual(providedKey, expectedKey)) {
          res.status(401).json({ success: false, error: "Unauthorized" });
          return;
        }
      } else if (process.env.NODE_ENV === "production") {
        res.status(403).json({
          error: "HR_SYNC_API_KEY not configured — access denied in production",
        });
        return;
      }
    }

    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const { profileId } = req.params;
    if (!profileId) {
      res.status(400).json({ error: "profileId required" });
      return;
    }

    await withTenant(propertyId, async (tenantDb) => {
      const [profile] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.profileId, String(profileId)));

      if (!profile) {
        res.status(404).json({ success: false, error: "Profile not found" });
        return;
      }

      const [assignment] = await tenantDb
        .select({
          id: assignmentsTable.id,
          bedNumber: assignmentsTable.bedNumber,
          checkInDate: assignmentsTable.checkInDate,
          expectedCheckOutDate: assignmentsTable.expectedCheckOutDate,
          checkOutDate: assignmentsTable.checkOutDate,
          notes: assignmentsTable.notes,
          status: assignmentsTable.status,
          roomNumber: roomsTable.roomNumber,
          roomType: roomsTable.roomType,
          capacity: roomsTable.capacity,
          buildingName: buildingsTable.name,
        })
        .from(assignmentsTable)
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
        .where(
          and(
            eq(assignmentsTable.profileId, profile.id),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        );

      res.json({
        success: true,
        profile,
        currentAssignment: assignment || null,
      });
    });
  },
);

// ============================================================================
// Sunrise e-Signature Integration Endpoints (Zero-Hardcode HR Synchronization)
// ============================================================================

// POST /api/hr-sync/esign/test — Test credentials and connectivity
router.post(
  "/esign/test",
  requireAnyPermission(
    ["hr_sync", "view"],
    ["hr_sync", "edit"],
    ["settings", "edit"],
  ),
  validate({ body: EsignTestBody }),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const incoming = req.body || {};
      let config: SunriseEsignConfig | null = null;

      if (
        incoming.username &&
        incoming.password &&
        incoming.password !== "••••••••"
      ) {
        config = {
          baseUrl: incoming.baseUrl,
          username: incoming.username,
          password: incoming.password,
          hotelCode: incoming.hotelCode,
        };
      } else {
        const saved = await getEsignConfig(propertyId);
        config = {
          baseUrl: incoming.baseUrl || saved?.baseUrl,
          username: incoming.username || saved?.username,
          password:
            incoming.password && incoming.password !== "••••••••"
              ? incoming.password
              : saved?.password,
          hotelCode: incoming.hotelCode || saved?.hotelCode,
        };
      }

      if (!config?.username || !config?.password) {
        res.status(400).json({
          success: false,
          error: "بيانات تسجيل الدخول (اسم المستخدم وكلمة المرور) غير متوفرة",
        });
        return;
      }
      if (!config?.hotelCode) {
        res.status(400).json({
          success: false,
          error: "كود الفندق (Hotel Code) مطلوب لاختبار الاتصال",
        });
        return;
      }

      const result = await testEsignConnection(config);
      res.json(result);
    } catch (err: any) {
      console.error("[Esign Test Error]", err);
      res.status(400).json({
        success: false,
        error: err?.message || "فشل الاتصال بسيرفر Sunrise e-Signature",
      });
    }
  },
);

// GET /api/hr-sync/esign/lookup — Fetch single employee by Employee Code / Clock Number
router.get(
  "/esign/lookup",
  requireAnyPermission(
    ["profiles", "create"],
    ["profiles", "edit"],
    ["profiles", "view"],
    ["hr_sync", "view"],
    ["hr_sync", "edit"],
    ["accommodation", "create"],
  ),
  validate({ query: CommonListQuery }),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const clockNo = String(req.query.clockNo || req.query.code || "").trim();
      const hotelCodeOverride = req.query.hotelCode
        ? String(req.query.hotelCode).trim()
        : undefined;

      if (!clockNo) {
        res.status(400).json({
          success: false,
          error: "يرجى إدخال الرقم الوظيفي / كود الموظف (clock number)",
        });
        return;
      }

      const sourceId = req.query.sourceId
        ? String(req.query.sourceId).trim()
        : undefined;

      if (sourceId) {
        // Specific source requested
        const config = await getEsignConfigById(propertyId!, sourceId);
        if (!config || !config.username || !config.password) {
          res.status(400).json({
            success: false,
            error: `مصدر الربط "${sourceId}" غير موجود أو غير مكتمل البيانات`,
          });
          return;
        }
        const employee = await fetchEmployeeByCode(
          config,
          clockNo,
          hotelCodeOverride,
        );
        if (!employee) {
          res.json({
            success: false,
            notFound: true,
            message: `لم يتم العثور على أي موظف يحمل الكود (${clockNo}) في المصدر "${config.label || sourceId}"`,
          });
          return;
        }
        res.json({ success: true, employee, sourceId });
      } else {
        // Search ALL active sources
        const { employee, sourceId: foundSourceId } =
          await fetchEmployeeFromAllSources(propertyId!, clockNo);
        if (!employee) {
          res.json({
            success: false,
            notFound: true,
            message: `لم يتم العثور على أي موظف يحمل الكود (${clockNo}) في أي مصدر من مصادر الربط المتاحة`,
          });
          return;
        }
        res.json({ success: true, employee, sourceId: foundSourceId });
      }
    } catch (err: any) {
      console.error("[Esign Lookup Error]", err);
      res.status(400).json({
        success: false,
        error: err?.message || "فشل جلب بيانات الموظف من HR",
      });
    }
  },
);

// POST /api/hr-sync/esign/range-sync — Bulk range import/update (fromClockNo -> toClockNo)
router.post(
  "/esign/range-sync",
  requireAnyPermission(["hr_sync", "edit"], ["settings", "edit"]),
  validate({ body: EsignRangeSyncBody }),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ success: false, error: "propertyId required" });
        return;
      }

      const fromClockNo = parseInt(
        String(req.body.fromClockNo || req.body.from || ""),
        10,
      );
      const toClockNo = parseInt(
        String(req.body.toClockNo || req.body.to || ""),
        10,
      );
      const hotelCodeOverride = req.body.hotelCode
        ? String(req.body.hotelCode).trim()
        : undefined;

      if (isNaN(fromClockNo) || isNaN(toClockNo)) {
        res.status(400).json({
          success: false,
          error: "يرجى إدخال نطاق أرقام وظيفية صالح (من كود إلى كود)",
        });
        return;
      }

      if (fromClockNo > toClockNo) {
        res.status(400).json({
          success: false,
          error: "بداية النطاق يجب أن تكون أقل من أو تساوي نهاية النطاق",
        });
        return;
      }

      const count = toClockNo - fromClockNo + 1;
      if (count > 2000) {
        res.status(400).json({
          success: false,
          error:
            "الحد الأقصى للنطاق في المرة الواحدة هو 2000 موظف لمنع الضغط الزائد على الخادم",
        });
        return;
      }

      const sourceId = req.body.sourceId
        ? String(req.body.sourceId).trim()
        : undefined;

      let config: SunriseEsignConfig | null = null;
      if (sourceId) {
        config = await getEsignConfigById(propertyId, sourceId);
        if (!config) {
          res.status(400).json({
            success: false,
            error: `مصدر الربط "${sourceId}" غير موجود`,
          });
          return;
        }
      } else {
        config = await getEsignConfig(propertyId);
      }
      if (!config || !config.username || !config.password) {
        res.status(400).json({
          success: false,
          error:
            "إعدادات الربط مع سيرفر الموارد البشرية غير مهيأة. يرجى إدخال بيانات الربط وحفظها أولاً.",
        });
        return;
      }

      const foundEmployees: any[] = [];
      const notFoundCodes: number[] = [];

      for (let code = fromClockNo; code <= toClockNo; code++) {
        try {
          const emp = await fetchEmployeeByCode(
            config,
            code,
            hotelCodeOverride,
          );
          if (emp) {
            foundEmployees.push(emp);
          } else {
            notFoundCodes.push(code);
          }
        } catch (fetchErr: any) {
          console.warn(
            `[Esign Range Sync] Error fetching code ${code}:`,
            fetchErr?.message,
          );
        }
        if (count > 10) {
          await new Promise((r) => setTimeout(r, 30));
        }
      }

      let syncResult: any = {
        stats: {
          totalReceived: 0,
          received: 0,
          created: 0,
          updated: 0,
          departedAutoCheckouts: 0,
          casualUpgrades: 0,
          lookupsAdded: 0,
          errors: 0,
        },
      };

      if (foundEmployees.length > 0) {
        syncResult = await processReceive(
          propertyId,
          foundEmployees,
          req,
          {},
          {
            sourceName: "Sunrise e-Signature Range Sync",
          },
        );
      }

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `استيراد بالنطاق من HR (${fromClockNo} إلى ${toClockNo}) — تم فحص ${count} رقم وظيفي، وُجد ${foundEmployees.length} موظف، تم إنشاء ${syncResult.stats.created}، وتحديث ${syncResult.stats.updated}`,
        actionType: "SYNC",
        module: "hr_sync",
        entityType: "profile",
        entityId: propertyId,
      });

      res.json({
        success: true,
        scannedCount: count,
        foundCount: foundEmployees.length,
        notFoundCount: notFoundCodes.length,
        stats: syncResult.stats,
      });
    } catch (err: any) {
      console.error("[Esign Range Sync Error]", err);
      res.status(500).json({
        success: false,
        error: err?.message || "حدث خطأ أثناء الاستيراد بالنطاق",
      });
    }
  },
);

// POST /api/hr-sync/esign/refresh-existing — Batch refresh & correct current profiles from HR
router.post(
  "/esign/refresh-existing",
  requireAnyPermission(["hr_sync", "edit"], ["settings", "edit"]),
  validate({ body: EsignRefreshBody }),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ success: false, error: "propertyId required" });
        return;
      }

      const sourceId = req.body.sourceId
        ? String(req.body.sourceId).trim()
        : undefined;

      let config: SunriseEsignConfig | null = null;
      if (sourceId && sourceId !== "all") {
        config = await getEsignConfigById(propertyId, sourceId);
        if (!config) {
          res.status(400).json({
            success: false,
            error: `مصدر الربط "${sourceId}" غير موجود`,
          });
          return;
        }
      } else {
        const allConfigs = await getEsignConfigs(propertyId);
        const activeConfigs = allConfigs.filter(
          (c) => c.isActive !== false && c.username && c.password,
        );
        if (activeConfigs.length === 0) {
          res.status(400).json({
            success: false,
            error:
              "إعدادات الربط مع سيرفر الموارد البشرية غير مهيأة. يرجى تهيئتها أولاً.",
          });
          return;
        }
      }

      // Query all profiles in the current property that have a profileId
      let existingProfiles: any[] = [];
      await withTenant(propertyId, async (tenantDb) => {
        existingProfiles = await tenantDb
          .select({
            id: profilesTable.id,
            profileId: profilesTable.profileId,
            firstName: profilesTable.firstName,
            lastName: profilesTable.lastName,
          })
          .from(profilesTable);
      });

      const validProfiles = existingProfiles.filter(
        (p) => p.profileId && String(p.profileId).trim() !== "",
      );
      const foundEmployees: any[] = [];
      let checked = 0;
      let notFoundInHr = 0;

      for (const p of validProfiles) {
        checked++;
        try {
          let emp: any = null;
          if (config) {
            emp = await fetchEmployeeByCode(config, p.profileId);
          } else {
            const multiRes = await fetchEmployeeFromAllSources(
              propertyId,
              p.profileId,
            );
            emp = multiRes.employee;
          }

          if (emp) {
            foundEmployees.push(emp);
          } else {
            notFoundInHr++;
          }
        } catch (fetchErr: any) {
          console.warn(
            `[Esign Batch Refresh] Error checking profile ${p.profileId}:`,
            fetchErr?.message,
          );
        }
        if (validProfiles.length > 20) {
          await new Promise((r) => setTimeout(r, 30));
        }
      }

      let syncResult: any = {
        stats: {
          totalReceived: 0,
          received: 0,
          created: 0,
          updated: 0,
          departedAutoCheckouts: 0,
          casualUpgrades: 0,
          lookupsAdded: 0,
          errors: 0,
        },
      };

      if (foundEmployees.length > 0) {
        syncResult = await processReceive(
          propertyId,
          foundEmployees,
          req,
          {},
          {
            sourceName: "Sunrise e-Signature Batch Refresh",
          },
        );
      }

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تحديث وتصحيح بيانات موظفي السكن الحاليين من HR — تم فحص ${checked} ملف، تحديث ${syncResult.stats.updated}، وإضافة ${syncResult.stats.lookupsAdded} مسميات`,
        actionType: "UPDATE",
        module: "hr_sync",
        entityType: "profile",
        entityId: propertyId,
      });

      res.json({
        success: true,
        totalChecked: checked,
        updatedCount: syncResult.stats.updated,
        notFoundInHr,
        stats: syncResult.stats,
      });
    } catch (err: any) {
      console.error("[Esign Batch Refresh Error]", err);
      res.status(500).json({
        success: false,
        error: err?.message || "حدث خطأ أثناء تحديث بيانات الموظفين",
      });
    }
  },
);

export default router;
