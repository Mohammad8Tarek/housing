import { Router } from "express";
import {
  db,
  pool,
  withTenant,
  profilesTable,
  profileDocumentsTable,
  profileVacationsTable,
  assignmentsTable,
  roomsTable,
  buildingsTable,
  floorsTable,
  propertiesTable,
} from "@workspace/db";
import { eq, and, or, ilike, sql, SQL } from "drizzle-orm";
import {
  CreateProfileBody,
  UpdateProfileBody,
  GetProfileParams,
  UpdateProfileParams,
  DeleteProfileParams,
  ListProfilesQueryParams,
  ListProfilesResponse,
  GetProfileResponse,
  UpdateProfileResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import {
  requirePermission,
  hasPermission,
} from "../middlewares/permissions.js";
import {
  ensureProfilePortalAccount,
  moveOrEnsureProfilePortalAccount,
} from "../lib/portal-accounts.js";
import { getTenantId, su } from "../lib/request-utils.js";
import { broadcastToProperty } from "../lib/websocket.js";

const router: Router = Router();
const MAX_PROFILE_LIST_ROWS = Number(
  process.env["API_MAX_PROFILE_LIST_ROWS"] ?? 2000,
);

// Fields considered personally identifiable / sensitive
const SENSITIVE_FIELDS = [
  "nationalId",
  "national_id",
  "phone",
  "address",
  "idImage",
  "id_image",
  "photoUrl",
  "photo_url",
];

function filterSensitive(
  records: Record<string, any> | Record<string, any>[],
  req: any,
): Record<string, any> | Record<string, any>[] {
  const authUser = (req as any).authUser;
  const canView =
    authUser && hasPermission(authUser, "profiles", "view_sensitive");
  if (canView) return records;

  const mask = (obj: Record<string, any>) => {
    const out = { ...obj };
    for (const field of SENSITIVE_FIELDS) {
      if (field in out && out[field]) out[field] = "***";
    }
    return out;
  };

  return Array.isArray(records) ? records.map(mask) : mask(records);
}
const MAX_PHOTO_DATA_LENGTH = Number(
  process.env["PROFILE_PHOTO_MAX_DATA_LENGTH"] ?? 3 * 1024 * 1024,
);
const PHOTO_DATA_RE =
  /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

function normalizePhotoData(value: unknown): string | null {
  if (value == null || value === "") return null;
  const photo = String(value);
  if (photo.length > MAX_PHOTO_DATA_LENGTH) {
    throw new Error("Photo is too large");
  }
  if (!PHOTO_DATA_RE.test(photo)) {
    throw new Error("Photo must be a PNG, JPG, WEBP, or GIF image");
  }
  return photo;
}

// ℹ️  Schema column 'photo_url' is managed via migration (scripts/add-missing-indexes.sql)
//    Do NOT run DDL here — it was removed to prevent startup delays and silent failures.

router.get(
  "/profiles",
  requirePermission("profiles", "view"),
  async (req, res) => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const query = ListProfilesQueryParams.safeParse(req.query);
    const conditions: SQL[] = [];

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      5000,
      Math.max(1, parseInt(req.query.limit as string) || 25),
    );
    const offset = (page - 1) * limit;

    if (query.success) {
      if (query.data.search) {
        conditions.push(
          or(
            ilike(profilesTable.firstName, `%${query.data.search}%`),
            ilike(profilesTable.lastName, `%${query.data.search}%`),
            ilike(profilesTable.thirdName, `%${query.data.search}%`),
            ilike(profilesTable.fourthName, `%${query.data.search}%`),
            ilike(profilesTable.profileId, `%${query.data.search}%`),
          ) as SQL,
        );
      }
      if (query.data.status)
        conditions.push(eq(profilesTable.status, query.data.status));
      if (query.data.department)
        conditions.push(eq(profilesTable.department, query.data.department));
    }

    const { profiles, total } = await withTenant(
      propertyId,
      async (tenantDb) => {
        let countQuery = tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(profilesTable) as any;
        if (conditions.length > 0)
          countQuery = countQuery.where(and(...conditions));
        const countResult = await countQuery;
        const totalCount = Number(countResult[0]?.count ?? 0);

        let baseQuery = tenantDb
          .select()
          .from(profilesTable)
          .limit(limit)
          .offset(offset) as any;
        if (conditions.length > 0)
          baseQuery = baseQuery.where(and(...conditions));

        const rows = await baseQuery;
        return { profiles: rows, total: totalCount };
      },
    );

    res.json({
      data: filterSensitive(
        profiles.map((e: any) => ({ ...e, propertyId })),
        req,
      ) as any[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  },
);

/* Cross-property profile search (خاص بـ SYSTEM_ADMIN) */
router.get(
  "/profiles/search",
  requirePermission("profiles", "view"),
  async (req, res): Promise<void> => {
    const { q = "", propertyId } = req.query as Record<string, string>;
    const conditions: SQL[] = [];

    if (q.trim().length >= 1) {
      const term = `%${q.trim()}%`;
      conditions.push(
        or(
          ilike(profilesTable.firstName, term),
          ilike(profilesTable.lastName, term),
          ilike(profilesTable.profileId, term),
          ilike(profilesTable.nationalId, term),
          ilike(profilesTable.department, term),
        ) as SQL,
      );
    }

    // في حالة الـ Multi-tenant, الـ search في كل الـ properties بيحتاج يجيب كل الـ schemas
    // لتبسيط هذا الكود حالياً: سنبحث فقط في الـ property المحددة أو نرجع فارغ (يجب تطويرها لاحقاً للبحث الشامل)
    const pId = Number(propertyId);
    if (!pId) {
      res.json([]);
      return;
    }

    const rows = await withTenant(pId, async (tenantDb) => {
      if (conditions.length === 0) return [];

      const queryResult = await tenantDb
        .select({
          profile: profilesTable,
          accommodationRoom: roomsTable.roomNumber,
          accommodationRoomType: roomsTable.roomType,
          accommodationBuilding: buildingsTable.name,
          accommodationFloor: floorsTable.floorNumber,
        })
        .from(profilesTable)
        .leftJoin(
          assignmentsTable,
          and(
            eq(assignmentsTable.profileId, profilesTable.id),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        )
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
        .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
        .where(and(...conditions))
        .limit(30);

      return queryResult.map((r) => ({
        ...r.profile,
        accommodationRoom: r.accommodationRoom,
        accommodationRoomType: r.accommodationRoomType,
        accommodationBuilding: r.accommodationBuilding,
        accommodationFloor: r.accommodationFloor,
      }));
    });

    const properties = await db
      .select({ id: propertiesTable.id, name: propertiesTable.name })
      .from(propertiesTable);
    const propMap = Object.fromEntries(properties.map((p) => [p.id, p.name]));

    const result = rows.map((e) => ({
      ...e,
      propertyId: pId,
      propertyName: propMap[pId] ?? null,
    }));
    res.json(filterSensitive(result, req));
  },
);

/* Real-time duplicate check endpoint for profiles */
router.get(
  "/profiles/check-duplicate",
  requirePermission("profiles", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const { profileId, nationalId, phone, excludeId } = req.query as Record<string, string>;
    const excludeIdNum = excludeId ? Number(excludeId) : null;

    const trimmedProfileId = profileId?.trim();
    const trimmedNationalId = nationalId?.trim();
    const trimmedPhone = phone?.trim();

    const duplicates: Record<string, { exists: boolean; name: string; profileId: string; nationalId?: string; phone?: string }> = {};

    if (!trimmedProfileId && !trimmedNationalId && !trimmedPhone) {
      res.json({ duplicates });
      return;
    }

    await withTenant(propertyId, async (tenantDb) => {
      const orConditions: SQL[] = [];
      if (trimmedProfileId) {
        orConditions.push(eq(profilesTable.profileId, trimmedProfileId));
      }
      if (trimmedNationalId) {
        orConditions.push(eq(profilesTable.nationalId, trimmedNationalId));
      }
      if (trimmedPhone) {
        orConditions.push(eq(profilesTable.phone, trimmedPhone));
      }

      if (orConditions.length === 0) return;

      const rows = await tenantDb
        .select({
          id: profilesTable.id,
          profileId: profilesTable.profileId,
          nationalId: profilesTable.nationalId,
          phone: profilesTable.phone,
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          thirdName: profilesTable.thirdName,
          fourthName: profilesTable.fourthName,
        })
        .from(profilesTable)
        .where(or(...orConditions));

      for (const row of rows) {
        if (excludeIdNum && row.id === excludeIdNum) continue;

        const name = [row.firstName, row.lastName, row.thirdName, row.fourthName].filter(Boolean).join(" ");

        if (trimmedProfileId && row.profileId?.trim().toLowerCase() === trimmedProfileId.toLowerCase()) {
          duplicates.profileId = { exists: true, name, profileId: row.profileId };
        }
        if (trimmedNationalId && row.nationalId?.trim() === trimmedNationalId) {
          duplicates.nationalId = { exists: true, name, profileId: row.profileId, nationalId: row.nationalId };
        }
        if (trimmedPhone && row.phone?.trim() === trimmedPhone) {
          duplicates.phone = { exists: true, name, profileId: row.profileId, phone: row.phone };
        }
      }
    });

    res.json({ duplicates });
  }
);

router.post(
  "/profiles",
  requirePermission("profiles", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const parsed = CreateProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // ── Prevent duplicate profile ID, national ID, or phone ─────────────
    const existingEmp = await withTenant(propertyId, async (tenantDb) => {
      const conditions: SQL[] = [];
      if (parsed.data.profileId)
        conditions.push(eq(profilesTable.profileId, parsed.data.profileId));
      if (parsed.data.nationalId)
        conditions.push(eq(profilesTable.nationalId, parsed.data.nationalId));
      if (parsed.data.phone && parsed.data.phone.trim())
        conditions.push(eq(profilesTable.phone, parsed.data.phone.trim()));
      if (conditions.length === 0) return [];
      return await tenantDb
        .select({
          id: profilesTable.id,
          profileId: profilesTable.profileId,
          nationalId: profilesTable.nationalId,
          phone: profilesTable.phone,
        })
        .from(profilesTable)
        .where(or(...conditions));
    });
    if (existingEmp.length > 0) {
      const existing = existingEmp[0];
      let reason = "Profile already exists";
      if (existing.profileId === parsed.data.profileId)
        reason = `كود الملف ${parsed.data.profileId} مسجل مسبقاً (Profile ID already exists)`;
      else if (existing.nationalId === parsed.data.nationalId)
        reason = `رقم الهوية ${parsed.data.nationalId} مسجل مسبقاً (National ID already exists)`;
      else if (parsed.data.phone && existing.phone === parsed.data.phone.trim())
        reason = `رقم الهاتف ${parsed.data.phone} مسجل مسبقاً (Phone number already exists)`;
      res.status(409).json({ error: reason, code: "PROFILE_DUPLICATE" });
      return;
    }

    // ✅ الإضافة في الـ Schema الصحيح (الحالة تبدأ بـ UNASSIGNED وتتحدد بناءً على عمليات التسكين)
    const { idDocuments, status, ...profileData } = parsed.data as any;
    const [profile] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .insert(profilesTable)
        .values({
          ...profileData,
          status: "UNASSIGNED",
        })
        .returning();
    });

    if (idDocuments && idDocuments.length > 0) {
      await withTenant(propertyId, async (tenantDb) => {
        await tenantDb.insert(profileDocumentsTable).values(
          idDocuments.map((doc: any) => ({
            profileId: profile.id,
            fileName: doc.fileName,
            fileType: doc.fileType,
            fileData: doc.fileData,
          }))
        );
      });
    }
    await ensureProfilePortalAccount(propertyId, profile.profileId);

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `إضافة موظف جديد: ${profile.firstName} ${profile.lastName}`,
      actionType: "CREATE",
      module: "profiles",
      entityType: "profile",
      entityId: profile.id,
      details: `ID: ${profile.profileId}, Dept: ${profile.department}`,
    });

    broadcastToProperty(propertyId, { module: "profiles", action: "created", entityId: profile.id });
    const safeCreated = {
      ...profile,
      propertyId,
      profileId: profile.profileId ?? "",
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      nationalId: profile.nationalId ?? "",
      nationality: profile.nationality ?? "",
      address: profile.address ?? "",
      jobTitle: profile.jobTitle ?? "",
      level: profile.level ?? "",
      phone: profile.phone ?? "",
      department: profile.department ?? "",
      status: profile.status ?? "UNASSIGNED",
      hireDate: profile.hireDate ?? "",
      gender: profile.gender ?? "M",
    };
    const createdParse = GetProfileResponse.safeParse(safeCreated);
    res
      .status(201)
      .json(createdParse.success ? createdParse.data : safeCreated);
  },
);

router.post(
  "/profiles/bulk",
  requirePermission("profiles", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const { profiles: rawProfiles } = req.body;
    if (!Array.isArray(rawProfiles) || rawProfiles.length === 0) {
      res.status(400).json({ error: "profiles array is required and must not be empty" });
      return;
    }

    const maxBulkLimit = 5000;
    const toProcess = rawProfiles.slice(0, maxBulkLimit);

    const result = await withTenant(propertyId, async (tenantDb) => {
      // 1. Fetch existing profile IDs, national IDs, and phones to check duplicates
      const existing = await tenantDb
        .select({
          profileId: profilesTable.profileId,
          nationalId: profilesTable.nationalId,
          phone: profilesTable.phone,
        })
        .from(profilesTable);

      const existingProfileIds = new Set(existing.map((e) => e.profileId?.trim().toLowerCase()).filter(Boolean));
      const existingNationalIds = new Set(existing.map((e) => e.nationalId?.trim()).filter(Boolean));
      const existingPhones = new Set(existing.map((e) => e.phone?.trim()).filter(Boolean));

      const validRows: any[] = [];
      let skippedCount = 0;

      for (let i = 0; i < toProcess.length; i++) {
        const p = toProcess[i];
        const pId = String(p.profileId || "").trim();
        const nid = String(p.nationalId || "").trim();
        const ph = String(p.phone || "").trim();

        // Check if duplicate in DB or duplicate within this batch
        if (pId && existingProfileIds.has(pId.toLowerCase())) {
          skippedCount++;
          continue;
        }
        if (nid && existingNationalIds.has(nid)) {
          skippedCount++;
          continue;
        }
        if (ph && existingPhones.has(ph)) {
          skippedCount++;
          continue;
        }

        if (pId) existingProfileIds.add(pId.toLowerCase());
        if (nid) existingNationalIds.add(nid);
        if (ph) existingPhones.add(ph);

        validRows.push({
          profileId: pId || `EMP-${Date.now().toString().slice(-6)}${i + 1}`,
          firstName: String(p.firstName || "—").trim(),
          lastName: String(p.lastName || "—").trim(),
          thirdName: String(p.thirdName || "").trim(),
          fourthName: String(p.fourthName || "").trim(),
          nationalId: nid,
          nationality: String(p.nationality || "").trim(),
          address: String(p.address || "").trim(),
          jobTitle: String(p.jobTitle || "").trim(),
          level: String(p.level || "—").trim(),
          phone: ph,
          department: String(p.department || "").trim(),
          status: "UNASSIGNED",
          hireDate: p.hireDate || new Date().toISOString().split("T")[0],
          gender: p.gender === "F" ? "F" : "M",
          employmentType: p.employmentType || "INTERNAL",
          companyName: p.companyName || "",
          contractEndDate: p.contractEndDate || null,
          dateOfBirth: p.dateOfBirth || "",
        });
      }

      // Insert in chunks of 100 for safety and performance
      const CHUNK_SIZE = 100;
      let insertedCount = 0;
      for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
        const chunk = validRows.slice(i, i + CHUNK_SIZE);
        const inserted = await tenantDb.insert(profilesTable).values(chunk).returning({ id: profilesTable.id, profileId: profilesTable.profileId });
        insertedCount += inserted.length;
        // Ensure portal accounts asynchronously
        for (const ins of inserted) {
          ensureProfilePortalAccount(propertyId, ins.profileId).catch(() => {});
        }
      }

      return { total: toProcess.length, success: insertedCount, skipped: skippedCount };
    });

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `استيراد جماعي للملفات الشخصية: ${result.success} ملف`,
      actionType: "CREATE",
      module: "profiles",
      entityType: "profile",
      details: `Total: ${result.total}, Inserted: ${result.success}, Skipped: ${result.skipped}`,
    });

    broadcastToProperty(propertyId, { module: "profiles", action: "created", count: result.success });

    res.status(200).json(result);
  },
);

router.get(
  "/profiles/:id",
  requirePermission("profiles", "view"),
  async (req, res): Promise<void> => {
    const params = GetProfileParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    let propertyId = getTenantId(req);
    let profile: any = null;

    if (propertyId) {
      try {
        const [found] = await withTenant(propertyId, async (tenantDb) => {
          return await tenantDb
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.id, params.data.id));
        });
        if (found) profile = found;
      } catch {}
    }

    // Fallback: search across all active properties if not found yet or propertyId was 0 / not in session
    if (!profile) {
      try {
        const props = await db.select({ id: propertiesTable.id }).from(propertiesTable);
        for (const p of props) {
          if (p.id === propertyId) continue;
          try {
            const [found] = await withTenant(p.id, async (tenantDb) => {
              return await tenantDb
                .select()
                .from(profilesTable)
                .where(eq(profilesTable.id, params.data.id));
            });
            if (found) {
              profile = found;
              propertyId = p.id;
              break;
            }
          } catch {}
        }
      } catch {}
    }

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const photoRows = await withTenant(propertyId, async (tenantDb) => {
      const [row] = await tenantDb
        .select({ photoUrl: profilesTable.photoUrl })
        .from(profilesTable)
        .where(eq(profilesTable.id, params.data.id))
        .limit(1);
      return row;
    });

    const docRows = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb.select().from(profileDocumentsTable).where(eq(profileDocumentsTable.profileId, params.data.id));
    });

    const safeProfile = {
      ...profile,
      propertyId,
      profileId: profile.profileId ?? "",
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      nationalId: profile.nationalId ?? "",
      nationality: profile.nationality ?? "",
      address: profile.address ?? "",
      jobTitle: profile.jobTitle ?? "",
      level: profile.level ?? "",
      phone: profile.phone ?? "",
      department: profile.department ?? "",
      status: profile.status ?? "UNASSIGNED",
      hireDate: profile.hireDate ?? "",
      gender: profile.gender ?? "M",
      employmentType: profile.employmentType ?? "INTERNAL",
      companyName: profile.companyName ?? null,
      contractEndDate: profile.contractEndDate ?? null,
      vacationStartDate: profile.vacationStartDate ?? null,
      vacationEndDate: profile.vacationEndDate ?? null,
      vacationNotes: profile.vacationNotes ?? null,
    };

    const parsedResult = GetProfileResponse.safeParse(safeProfile);
    const parsed = {
      ...(parsedResult.success ? parsedResult.data : safeProfile),
      photoUrl: photoRows?.photoUrl ?? null,
      idDocuments: docRows.map(d => ({
        id: d.id,
        fileName: d.fileName,
        fileType: d.fileType,
        fileData: d.fileData,
        uploadedAt: d.uploadedAt?.toISOString() ?? null,
      })),
    };
    res.json(filterSensitive(parsed, req));
  },
);

router.patch(
  "/profiles/:id",
  requirePermission("profiles", "edit"),
  async (req, res): Promise<void> => {
    const params = UpdateProfileParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    let propertyId = getTenantId(req);
    let profileExistsInTenant = false;

    if (propertyId) {
      try {
        const [found] = await withTenant(propertyId, async (tenantDb) => {
          return await tenantDb
            .select({ id: profilesTable.id })
            .from(profilesTable)
            .where(eq(profilesTable.id, params.data.id))
            .limit(1);
        });
        if (found) profileExistsInTenant = true;
      } catch {}
    }

    if (!profileExistsInTenant) {
      try {
        const props = await db.select({ id: propertiesTable.id }).from(propertiesTable);
        for (const p of props) {
          if (p.id === propertyId) continue;
          try {
            const [found] = await withTenant(p.id, async (tenantDb) => {
              return await tenantDb
                .select({ id: profilesTable.id })
                .from(profilesTable)
                .where(eq(profilesTable.id, params.data.id))
                .limit(1);
            });
            if (found) {
              propertyId = p.id;
              profileExistsInTenant = true;
              break;
            }
          } catch {}
        }
      } catch {}
    }

    if (!profileExistsInTenant || !propertyId) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const parsed = UpdateProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // ── Prevent duplicate profile ID, national ID, or phone on update ────
    const body = parsed.data as Record<string, any>;
    if (body.profileId || body.nationalId || (body.phone && body.phone.trim())) {
      const existingEmp = await withTenant(propertyId, async (tenantDb) => {
        const conditions: SQL[] = [];
        if (body.profileId)
          conditions.push(eq(profilesTable.profileId, body.profileId));
        if (body.nationalId)
          conditions.push(eq(profilesTable.nationalId, body.nationalId));
        if (body.phone && body.phone.trim())
          conditions.push(eq(profilesTable.phone, body.phone.trim()));
        return await tenantDb
          .select({
            id: profilesTable.id,
            profileId: profilesTable.profileId,
            nationalId: profilesTable.nationalId,
            phone: profilesTable.phone,
          })
          .from(profilesTable)
          .where(or(...conditions));
      });

      const conflict = existingEmp.find((e) => e.id !== params.data.id);
      if (conflict) {
        let reason = "Profile already exists";
        if (conflict.profileId === body.profileId)
          reason = `كود الملف ${body.profileId} مسجل مسبقاً (Profile ID already exists)`;
        else if (conflict.nationalId === body.nationalId)
          reason = `رقم الهوية ${body.nationalId} مسجل مسبقاً (National ID already exists)`;
        else if (body.phone && conflict.phone === body.phone.trim())
          reason = `رقم الهاتف ${body.phone} مسجل مسبقاً (Phone number already exists)`;
        res.status(409).json({ error: reason, code: "PROFILE_DUPLICATE" });
        return;
      }
    }

    const { previous, updated } = await withTenant(
      propertyId,
      async (tenantDb) => {
        const [existing] = await tenantDb
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.id, params.data.id))
          .limit(1);
        if (!existing) return { previous: null, updated: null };

        const { idDocuments, status, ...profileData } = parsed.data as any;
        
        let updatedProfile = existing;
        if (Object.keys(profileData).length > 0) {
          const [updated] = await tenantDb
            .update(profilesTable)
            .set(profileData)
            .where(eq(profilesTable.id, params.data.id))
            .returning();
          updatedProfile = updated;
        }

        if (idDocuments) {
          await tenantDb.delete(profileDocumentsTable).where(eq(profileDocumentsTable.profileId, params.data.id));
          const validDocs = idDocuments
            .filter((doc: any) => doc && (doc.fileData || doc.fileName))
            .map((doc: any) => ({
              profileId: params.data.id,
              fileName: doc.fileName || "document",
              fileType: doc.fileType || "application/octet-stream",
              fileData: doc.fileData || "",
            }));
          if (validDocs.length > 0) {
            await tenantDb.insert(profileDocumentsTable).values(validDocs);
          }
        }

        // ── Hospitality Workflow: Auto-sync Room Status based on Profile Status ──
        if (parsed.data.status) {
          try {
            const newProfileStatus = parsed.data.status.toUpperCase();
            // Find active assignment for this profile
            const [activeAssign] = await tenantDb
              .select({ id: assignmentsTable.id, roomId: assignmentsTable.roomId })
              .from(assignmentsTable)
              .where(
                and(
                  eq(assignmentsTable.profileId, params.data.id),
                  eq(assignmentsTable.status, "ACTIVE")
                )
              );

            if (activeAssign && activeAssign.roomId) {
              const [room] = await tenantDb
                .select()
                .from(roomsTable)
                .where(eq(roomsTable.id, activeAssign.roomId));

              if (room) {
                if (newProfileStatus === "VACATION") {
                  // Check all active assignments in this room
                  const roomAssignments = await tenantDb
                    .select({
                      profileId: assignmentsTable.profileId,
                      status: profilesTable.status,
                    })
                    .from(assignmentsTable)
                    .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
                    .where(
                      and(
                        eq(assignmentsTable.roomId, room.id),
                        eq(assignmentsTable.status, "ACTIVE")
                      )
                    );

                  // If all occupants are in vacation (or this is the only occupant)
                  const allOnVacation = roomAssignments.every((ra) =>
                    ra.profileId === params.data.id ? true : ra.status?.toUpperCase() === "VACATION"
                  );

                  if (allOnVacation) {
                    await tenantDb
                      .update(roomsTable)
                      .set({ status: "occupied_vacation" })
                      .where(eq(roomsTable.id, room.id));
                  }
                } else if (newProfileStatus === "ACTIVE") {
                  // Returned from vacation -> set back to occupied
                  if (room.status === "occupied_vacation") {
                    await tenantDb
                      .update(roomsTable)
                      .set({ status: "occupied" })
                      .where(eq(roomsTable.id, room.id));
                  }
                } else if (newProfileStatus === "LEFT") {
                  // Profile marked as checked out -> checkout assignment & mark room dirty
                  await tenantDb
                    .update(assignmentsTable)
                    .set({
                      status: "CHECKED_OUT",
                      checkOutDate: new Date().toISOString().split("T")[0],
                    })
                    .where(eq(assignmentsTable.id, activeAssign.id));

                  const newOcc = Math.max(0, room.currentOccupancy - 1);
                  await tenantDb
                    .update(roomsTable)
                    .set({
                      currentOccupancy: newOcc,
                      status: newOcc === 0 ? "dirty" : "occupied_dirty",
                    })
                    .where(eq(roomsTable.id, room.id));
                }
              }
            }
          } catch (syncErr) {
            console.error("[HospitalityWorkflow] Error syncing room status:", syncErr);
          }
        }
        return { previous: existing, updated: updatedProfile };
      },
    );

    if (!updated) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    await moveOrEnsureProfilePortalAccount(
      propertyId,
      previous?.profileId,
      updated.profileId,
    );
    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تعديل بيانات الموظف: ${updated.firstName} ${updated.lastName}`,
      actionType: "UPDATE",
      module: "profiles",
      entityType: "profile",
      entityId: updated.id,
    });
    
    const safeUpdated = {
      ...updated,
      propertyId,
    };
    const updateParse = UpdateProfileResponse.safeParse(safeUpdated);
    res.json(updateParse.success ? updateParse.data : safeUpdated);
  },
);

router.delete(
  "/profiles/:id",
  requirePermission("profiles", "delete"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = DeleteProfileParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const existing = await withTenant(propertyId, async (tenantDb) => {
      const [emp] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, params.data.id));
      if (emp)
        await tenantDb
          .delete(profilesTable)
          .where(eq(profilesTable.id, params.data.id));
      return emp;
    });

    if (existing) {
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف الموظف: ${existing.firstName} ${existing.lastName} (${existing.profileId})`,
        actionType: "DELETE",
        module: "profiles",
        entityType: "profile",
        entityId: existing.id,
        severity: "warning",
        details: `Dept: ${existing.department}`,
      });
      broadcastToProperty(propertyId, { module: "profiles", action: "deleted", entityId: existing.id });
    }
    res.sendStatus(204);
  },
);

router.patch(
  "/profiles/:id/photo",
  requirePermission("profiles", "edit"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    let propertyId = getTenantId(req);
    let profileExistsInTenant = false;

    if (propertyId) {
      try {
        const [found] = await withTenant(propertyId, async (tenantDb) => {
          return await tenantDb
            .select({ id: profilesTable.id })
            .from(profilesTable)
            .where(eq(profilesTable.id, id))
            .limit(1);
        });
        if (found) profileExistsInTenant = true;
      } catch {}
    }

    if (!profileExistsInTenant) {
      try {
        const props = await db.select({ id: propertiesTable.id }).from(propertiesTable);
        for (const p of props) {
          if (p.id === propertyId) continue;
          try {
            const [found] = await withTenant(p.id, async (tenantDb) => {
              return await tenantDb
                .select({ id: profilesTable.id })
                .from(profilesTable)
                .where(eq(profilesTable.id, id))
                .limit(1);
            });
            if (found) {
              propertyId = p.id;
              profileExistsInTenant = true;
              break;
            }
          } catch {}
        }
      } catch {}
    }

    if (!profileExistsInTenant || !propertyId) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    let photoUrl: string | null;
    try {
      photoUrl = normalizePhotoData(
        (req.body as { photoUrl?: string })?.photoUrl,
      );
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid photo" });
      return;
    }

    const emp = await withTenant(propertyId, async (tenantDb) => {
      await tenantDb
        .update(profilesTable)
        .set({ photoUrl: photoUrl ?? null })
        .where(eq(profilesTable.id, id));
      const [empData] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, id));
      return empData;
    });

    if (emp) {
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تحديث صورة الموظف: ${emp.firstName} ${emp.lastName}`,
        actionType: "UPDATE",
        module: "profiles",
        entityType: "profile",
        entityId: emp.id,
      });
    }
    res.json({ success: true });
  },
);


router.patch(
  "/profiles/:id/id-image",
  requirePermission("profiles", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    let idImage: string | null;
    try {
      idImage = normalizePhotoData(
        (req.body as { idImage?: string })?.idImage,
      );
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid image" });
      return;
    }

    const emp = await withTenant(propertyId, async (tenantDb) => {
      await tenantDb
        .update(profilesTable)
        .set({ idImage: idImage ?? null })
        .where(eq(profilesTable.id, id));
      const [empData] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, id));
      return empData;
    });

    if (emp) {
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `OO-O_USO OU^OOc O U,U.U^O,U?: ${emp.firstName} ${emp.lastName}`,
        actionType: "UPDATE",
        module: "profiles",
        entityType: "profile",
        entityId: emp.id,
      });
    }
    res.json({ success: true });
  }
);


router.get(
  "/profiles/:id/photo",
  requirePermission("profiles", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const id = Number(req.params.id);
    const row = await withTenant(propertyId, async (tenantDb) => {
      const [r] = await tenantDb
        .select({ photoUrl: profilesTable.photoUrl })
        .from(profilesTable)
        .where(eq(profilesTable.id, id))
        .limit(1);
      return r;
    });

    res.json({ photoUrl: row?.photoUrl ?? null });
  },
);

router.post(
  "/profiles/:id/vacation",
  requirePermission("profiles", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const id = Number(req.params.id);
    const { startDate, endDate, notes } = req.body;
    if (!startDate || !endDate) {
      res.status(400).json({ error: "تاريخ البدء وتاريخ الانتهاء مطلوبان" });
      return;
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [emp] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, id));
      if (!emp) return null;

      // 1. Update profile
      const [updated] = await tenantDb
        .update(profilesTable)
        .set({
          status: "VACATION",
          vacationStartDate: startDate,
          vacationEndDate: endDate,
          vacationNotes: notes || "",
        })
        .where(eq(profilesTable.id, id))
        .returning();

      // 2. Insert vacation log
      await tenantDb.insert(profileVacationsTable).values({
        profileId: id,
        startDate,
        endDate,
        notes: notes || "",
        status: "ACTIVE",
      });

      // 3. Find active room assignment and update room to occupied_vacation
      const [activeAssign] = await tenantDb
        .select({ id: assignmentsTable.id, roomId: assignmentsTable.roomId })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.profileId, id),
            eq(assignmentsTable.status, "ACTIVE")
          )
        );

      if (activeAssign?.roomId) {
        await tenantDb
          .update(roomsTable)
          .set({ status: "occupied_vacation" })
          .where(eq(roomsTable.id, activeAssign.roomId));
      }

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: "الموظف غير موجود" });
      return;
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تسجيل إجازة للموظف: ${result.firstName} ${result.lastName} (من ${startDate} إلى ${endDate})`,
      actionType: "UPDATE",
      module: "profiles",
      entityType: "profile",
      entityId: result.id,
    });

    res.json({ success: true, profile: result });
  }
);

router.post(
  "/profiles/:id/return-vacation",
  requirePermission("profiles", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const id = Number(req.params.id);
    const returnDate = req.body.returnDate || new Date().toISOString().split("T")[0];

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [emp] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, id));
      if (!emp) return null;

      // 1. Update profile back to ACTIVE
      const [updated] = await tenantDb
        .update(profilesTable)
        .set({
          status: "ACTIVE",
          vacationStartDate: null,
          vacationEndDate: null,
          vacationNotes: "",
        })
        .where(eq(profilesTable.id, id))
        .returning();

      // 2. Complete active vacation in history
      await tenantDb
        .update(profileVacationsTable)
        .set({
          actualReturnDate: returnDate,
          status: "COMPLETED",
        })
        .where(
          and(
            eq(profileVacationsTable.profileId, id),
            eq(profileVacationsTable.status, "ACTIVE")
          )
        );

      // 3. Update room back to occupied
      const [activeAssign] = await tenantDb
        .select({ id: assignmentsTable.id, roomId: assignmentsTable.roomId })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.profileId, id),
            eq(assignmentsTable.status, "ACTIVE")
          )
        );

      if (activeAssign?.roomId) {
        await tenantDb
          .update(roomsTable)
          .set({ status: "occupied" })
          .where(eq(roomsTable.id, activeAssign.roomId));
      }

      return updated;
    });

    if (!result) {
      res.status(404).json({ error: "الموظف غير موجود" });
      return;
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تسجيل عودة الموظف من الإجازة: ${result.firstName} ${result.lastName}`,
      actionType: "UPDATE",
      module: "profiles",
      entityType: "profile",
      entityId: result.id,
    });

    res.json({ success: true, profile: result });
  }
);

export default router;
