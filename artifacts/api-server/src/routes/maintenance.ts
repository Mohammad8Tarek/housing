import { buildSlaWatch } from "../lib/maintenance-sla-watch.js";
import {
  cachedService,
  invalidateServiceCatalogue,
  listServices,
  loadServiceCatalogue,
  serviceKeyFrom,
} from "../lib/maintenance-services.js";
import {
  buildDailyReport,
  cairoToday,
  renderDailyReportCsv,
  renderDailyReportHtml,
  sendDailyReport,
} from "../lib/maintenance-daily-report.js";
import {
  notifyTicketAssigned,
  notifyTicketResolved,
} from "../lib/maintenance-notify.js";
import {
  ticketNumber,
  ticketSla,
  recordTicketEvents,
} from "../lib/maintenance-tickets.js";
import { Router } from "express";
import {
  db,
  maintenanceTable,
  maintenanceEventsTable,
  maintenanceServicesTable,
  roomsTable,
  buildingsTable,
  floorsTable,
  propertiesTable,
  profilesTable,
  workersTable,
  withTenant,
} from "@workspace/db";
import {
  eq,
  ne,
  and,
  or,
  ilike,
  sql,
  SQL,
  desc,
  inArray,
  aliasedTable,
} from "drizzle-orm";
import {
  CreateMaintenanceBody,
  UpdateMaintenanceParams,
  DeleteMaintenanceParams,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { broadcastToProperty } from "../lib/websocket.js";
import {
  requireAnyPermission,
  hasPermission,
} from "../middlewares/permissions.js";
import { getTenantId } from "../lib/request-utils.js";
import {
  normalizeSearchString,
  sqlNormalizeArabic,
} from "../lib/search-helper.js";
import { validate } from "../middlewares/validate.js";
import {
  CommonListQuery,
  UpdateMaintenanceTicketBody,
  MaintenanceCommentBody,
  MaintenanceDailyReportQuery,
  MaintenanceDailyReportSendBody,
  MaintenanceServiceCreateBody,
  MaintenanceServiceUpdateBody,
  IdParams,
  PropertyIdOnlyBody,
  SubTicketBody,
} from "../validation/schemas.js";

const router: Router = Router();
const assignedProfile = aliasedTable(profilesTable, "assigned_profile");

/**
 * جلب العقارات المصرح للمستخدم الوصول إليها
 */
async function getAccessibleProperties(
  user: any,
): Promise<{ id: number; name: string; displayName?: string | null }[]> {
  try {
    if (
      user?.isSystemAdmin ||
      user?.roles?.includes("super_admin") ||
      user?.roles?.includes("system_admin")
    ) {
      const allProps = await db
        .select({
          id: propertiesTable.id,
          name: propertiesTable.name,
          displayName: propertiesTable.displayName,
        })
        .from(propertiesTable)
        .where(eq(propertiesTable.status, "active"));
      return allProps;
    }

    const pIds: number[] =
      Array.isArray(user?.propertyIds) && user.propertyIds.length > 0
        ? user.propertyIds.map(Number).filter(Boolean)
        : user?.propertyId
          ? [Number(user.propertyId)]
          : [];

    if (pIds.length === 0) return [];

    const props = await db
      .select({
        id: propertiesTable.id,
        name: propertiesTable.name,
        displayName: propertiesTable.displayName,
      })
      .from(propertiesTable)
      .where(
        and(
          eq(propertiesTable.status, "active"),
          inArray(propertiesTable.id, pIds),
        ),
      );
    return props;
  } catch (err) {
    console.error(
      "[Maintenance Route] Failed to get accessible properties:",
      err,
    );
    return [];
  }
}

/**
 * بناء شروط الفلترة لبلاغات الصيانة / النظافة مع دعم الحصر للموظف وعزل الفئات
 */
// Tickets per status under the request's filters except `status` itself, so the
// status tabs show totals for every status (not just the rows on this page).
type StatusCounts = {
  all: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
};
const emptyStatusCounts = (): StatusCounts => ({
  all: 0,
  open: 0,
  in_progress: 0,
  resolved: 0,
  closed: 0,
});

async function countTicketsByStatus(
  tenantDb: any,
  whereClause: SQL | undefined,
  into: StatusCounts,
) {
  const rows = await tenantDb
    .select({ status: maintenanceTable.status, count: sql<number>`count(*)` })
    .from(maintenanceTable)
    .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
    .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
    .leftJoin(workersTable, eq(maintenanceTable.workerId, workersTable.id))
    .where(whereClause)
    .groupBy(maintenanceTable.status);
  for (const r of rows) {
    const n = Number(r.count || 0);
    into.all += n;
    if (r.status && r.status in into) (into as any)[r.status] += n;
  }
}

function buildConditions(
  query: any,
  categoryIsolation: {
    onlyHousekeeping?: boolean;
    excludeHousekeeping?: boolean;
  } | null,
  userProfileId?: number | null,
  isStaffOnly?: boolean,
): SQL[] {
  const conditions: SQL[] = [];

  // 1. تقييد الفئة بناءً على الصلاحيات أو الفلتر
  if (categoryIsolation?.onlyHousekeeping) {
    conditions.push(eq(maintenanceTable.category, "housekeeping"));
  } else if (categoryIsolation?.excludeHousekeeping) {
    // مستخدم الصيانة يرى جميع فئات الصيانة (سباكة، كهرباء، تكييف، نجارة...) ويُستثنى الهاوس كيبنج فقط
    conditions.push(ne(maintenanceTable.category, "housekeeping"));
    if (
      query.category &&
      query.category !== "all" &&
      query.category !== "housekeeping"
    ) {
      conditions.push(eq(maintenanceTable.category, String(query.category)));
    }
  } else if (query.category && query.category !== "all") {
    conditions.push(eq(maintenanceTable.category, String(query.category)));
  }

  // 2. الحالة
  if (query.status && query.status !== "all") {
    // "open,in_progress" filters on several statuses (used by the kanban).
    const statuses = String(query.status)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    conditions.push(
      statuses.length > 1
        ? inArray(maintenanceTable.status, statuses)
        : eq(maintenanceTable.status, statuses[0] ?? ""),
    );
  }

  // 3. الأولوية
  if (query.priority && query.priority !== "all") {
    conditions.push(eq(maintenanceTable.priority, String(query.priority)));
  }

  // 4. تقييد التعيين للموظف (Assigned To / Scoping)
  if (
    isStaffOnly &&
    userProfileId &&
    (!query.assignedTo || query.assignedTo === "me")
  ) {
    // موظف / فني بدون صلاحيات إشرافية: يرى أوردراته فقط حصرًا
    conditions.push(eq(maintenanceTable.assignedTo, userProfileId));
  } else if (query.assignedTo) {
    if (query.assignedTo === "unassigned") {
      conditions.push(sql`${maintenanceTable.assignedTo} IS NULL`);
    } else if (query.assignedTo === "me" && userProfileId) {
      conditions.push(eq(maintenanceTable.assignedTo, userProfileId));
    } else if (query.assignedTo !== "all" && query.assignedTo !== "me") {
      const aId = parseInt(String(query.assignedTo), 10);
      if (!isNaN(aId)) {
        conditions.push(eq(maintenanceTable.assignedTo, aId));
      }
    }
  }

  // 4b. فلترة الفني المعين (Worker)
  if (query.workerId) {
    if (query.workerId === "unassigned") {
      conditions.push(sql`${maintenanceTable.workerId} IS NULL`);
    } else if (query.workerId !== "all") {
      const wId = parseInt(String(query.workerId), 10);
      if (!isNaN(wId)) {
        conditions.push(eq(maintenanceTable.workerId, wId));
      }
    }
  }

  // 5. فلترة التذاكر الفرعية أو التذاكر الرئيسية فقط (Sub-tickets & Parent hierarchy)
  if (query.parentId) {
    const pId = parseInt(String(query.parentId), 10);
    if (!isNaN(pId)) {
      conditions.push(eq(maintenanceTable.parentId, pId));
    }
  } else if (query.onlyParents === "true" || query.onlyParents === true) {
    conditions.push(sql`${maintenanceTable.parentId} IS NULL`);
  }

  // 6. التاريخ من / إلى
  if (query.fromDate) {
    try {
      const fromD = new Date(query.fromDate);
      if (!isNaN(fromD.getTime())) {
        conditions.push(
          sql`${maintenanceTable.reportedAt} >= ${fromD.toISOString()}::timestamptz`,
        );
      }
    } catch {}
  }
  if (query.toDate) {
    try {
      const toD = new Date(query.toDate);
      if (!isNaN(toD.getTime())) {
        toD.setHours(23, 59, 59, 999);
        conditions.push(
          sql`${maintenanceTable.reportedAt} <= ${toD.toISOString()}::timestamptz`,
        );
      }
    } catch {}
  }

  // 7. البحث النصي
  if (query.search && String(query.search).trim()) {
    const norm = normalizeSearchString(query.search);
    const tokens = norm.split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      const descSql = sqlNormalizeArabic(maintenanceTable.description);
      const probSql = sqlNormalizeArabic(maintenanceTable.problemType);
      const workerSql = sqlNormalizeArabic(workersTable.name);
      const bldgSql = sqlNormalizeArabic(buildingsTable.name);

      const tokenConditions: SQL[] = tokens.map((token) => {
        const pattern = `%${token}%`;
        return or(
          sql`cast(${maintenanceTable.id} as text) ILIKE ${pattern}`,
          sql`${descSql} ILIKE ${pattern}`,
          sql`${probSql} ILIKE ${pattern}`,
          ilike(roomsTable.roomNumber, pattern),
          sql`${workerSql} ILIKE ${pattern}`,
          sql`${bldgSql} ILIKE ${pattern}`,
        )!;
      });
      conditions.push(and(...tokenConditions)!);
    }
  }

  // 8. تقييم الخدمة
  if (query.rating && query.rating !== "all") {
    if (query.rating === "unrated") {
      conditions.push(sql`${maintenanceTable.rating} IS NULL`);
    } else if (query.rating === "rated") {
      conditions.push(sql`${maintenanceTable.rating} IS NOT NULL`);
    } else {
      const rNum = parseInt(String(query.rating), 10);
      if (!isNaN(rNum)) {
        conditions.push(eq(maintenanceTable.rating, rNum));
      }
    }
  }

  return conditions;
}

/**
 * استخلاص بيانات الجلسة بأمان للنشاط (Activity Log)
 */
function session(req: any) {
  return {
    username: (req.session as any)?.username ?? "system",
    userId: (req.session as any)?.userId,
    userRole: (req.session as any)?.userRole,
  };
}

/**
 * ✅ Safe Formatter (fmt)
 */
// Photos are stored inline as data URLs (often several MB each). Lists return
// a short link to GET /maintenance/:id/photo instead; the `v` hash changes
// with the photo so browsers can cache it. Real http(s) URLs pass through.
function listPhotoUrl(propertyId: number) {
  return sql<string | null>`CASE
    WHEN ${maintenanceTable.photoUrl} LIKE 'data:%'
      THEN '/api/maintenance/' || ${maintenanceTable.id} || '/photo?propertyId=' || ${propertyId}::text
        || '&v=' || left(md5(${maintenanceTable.photoUrl}), 12)
    ELSE ${maintenanceTable.photoUrl}
  END`;
}

function fmt(r: any) {
  if (!r) return null;

  const safeISO = (val: any) => {
    if (!val) return null;
    if (val instanceof Date) {
      return typeof val.toISOString === "function"
        ? val.toISOString()
        : String(val);
    }
    if (typeof val === "string") {
      return val;
    }
    try {
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : d.toISOString();
    } catch {
      return val;
    }
  };

  return {
    ...r,
    reportedAt: safeISO(r.reportedAt),
    startedAt: safeISO(r.startedAt),
    resolvedAt: safeISO(r.resolvedAt),
    createdAt: safeISO(r.createdAt),
    dueDate: safeISO(r.dueDate),
    ratedAt: safeISO(r.ratedAt),
    rating: r.rating != null ? Number(r.rating) : null,
    ratingComment: r.ratingComment ?? null,
    ratedByProfileId: r.ratedByProfileId ?? null,
    assignedToName: r.assignedToName ?? null,
    assignedToProfileId: r.assignedToProfileId ?? null,
    residentName: r.residentName ?? null,
    source: r.source ?? null,
    assignedAt: safeISO(r.assignedAt),
    // Ticket system: readable number and target (SLA) time
    ticketNo: r.id != null ? ticketNumber(r) : null,
    // The property's service catalogue (warmed by the handler): names and
    // target time for this problem type; code defaults otherwise.
    serviceLabelAr: cachedService(r.propertyId, r.problemType)?.labelAr ?? null,
    serviceLabelEn: cachedService(r.propertyId, r.problemType)?.labelEn ?? null,
    ...ticketSla(r, cachedService(r.propertyId, r.problemType)?.targetMinutes),
  };
}

/**
 * دمج وفحص صلاحيات فئات الصيانة والهاوس كيبنج بدقة استناداً لمصفوفة الصلاحيات
 */
function resolveCategoryPermissions(user: any, isSysAdmin: boolean) {
  const hasExplicitMntOrders = hasPermission(
    user,
    "maintenance",
    "view_maintenance",
  );
  const hasExplicitHskOrders = hasPermission(
    user,
    "maintenance",
    "view_housekeeping",
  );
  const hasExplicitFilter = hasExplicitMntOrders || hasExplicitHskOrders;

  let userHasMaintenance: boolean;
  let userHasHousekeeping: boolean;

  if (isSysAdmin) {
    userHasMaintenance = true;
    userHasHousekeeping = true;
  } else if (hasExplicitFilter) {
    userHasMaintenance = hasExplicitMntOrders;
    userHasHousekeeping =
      hasExplicitHskOrders || hasPermission(user, "housekeeping", "view");
  } else {
    userHasMaintenance = hasPermission(user, "maintenance", "view");
    userHasHousekeeping = hasPermission(user, "housekeeping", "view");
  }

  return { userHasMaintenance, userHasHousekeeping };
}

// 1. جلب قائمة البلاغات مع الفلترة والفرز ودعم العقارات المتعددة
router.get(
  "/maintenance",
  requireAnyPermission(
    ["maintenance", "view"],
    ["maintenance", "view_maintenance"],
    ["maintenance", "view_housekeeping"],
    ["housekeeping", "view"],
  ),
  validate({ query: CommonListQuery }),
  async (req, res, next) => {
    try {
      const user = (req as any).authUser;
      const isSysAdmin =
        user?.isSystemAdmin ||
        user?.roles?.includes("super_admin") ||
        user?.roles?.includes("system_admin");

      const { userHasMaintenance, userHasHousekeeping } =
        resolveCategoryPermissions(user, isSysAdmin);

      // تقييد الفئة حسب الصلاحية:
      // إذا كان المستخدم لديه فقط housekeeping يرى فقط housekeeping
      // إذا كان لديه فقط maintenance يرى كافة فئات الصيانة باستثناء الهاوس كيبنج
      // إذا كان لديه كلاهما يرى حسب query.category
      let categoryIsolation: {
        onlyHousekeeping?: boolean;
        excludeHousekeeping?: boolean;
      } | null = null;
      if (!isSysAdmin) {
        if (userHasHousekeeping && !userHasMaintenance) {
          categoryIsolation = { onlyHousekeeping: true };
        } else if (userHasMaintenance && !userHasHousekeeping) {
          categoryIsolation = { excludeHousekeeping: true };
        }
      }

      const canEditMnt =
        isSysAdmin ||
        hasPermission(user, "maintenance", "edit") ||
        hasPermission(user, "maintenance", "view") ||
        hasPermission(user, "maintenance", "view_maintenance");
      const canEditHsk =
        isSysAdmin ||
        hasPermission(user, "housekeeping", "edit") ||
        hasPermission(user, "housekeeping", "view") ||
        hasPermission(user, "maintenance", "view_housekeeping");
      const canAssignMnt =
        canEditMnt || hasPermission(user, "maintenance", "create");
      const canAssignHsk =
        canEditHsk || hasPermission(user, "housekeeping", "create");
      const hasManagerialScope =
        isSysAdmin || canAssignMnt || canAssignHsk || canEditMnt || canEditHsk;
      const isStrictWorker = Boolean(
        user?.roles?.includes("technician") ||
        user?.roles?.includes("worker") ||
        user?.roles?.includes("cleaner"),
      );
      const isStaffOnly =
        !hasManagerialScope &&
        isStrictWorker &&
        (!req.query.assignedTo || req.query.assignedTo === "me");
      const queryProfileId = req.query.assignedToProfileId
        ? parseInt(String(req.query.assignedToProfileId), 10)
        : null;

      let page = 1;
      let limit = 1000;
      if (req.query.page)
        page = Math.max(1, parseInt(req.query.page as string) || 1);
      if (req.query.limit)
        limit = Math.min(
          5000,
          Math.max(1, parseInt(req.query.limit as string) || 10),
        );

      const queryProp = req.query.propertyId
        ? String(req.query.propertyId).trim()
        : "";
      const isAllProperties =
        queryProp === "all" ||
        (!queryProp &&
          ((req.session as any)?.propertyId === -1 ||
            !(req.session as any)?.propertyId));

      const accessibleProps = await getAccessibleProperties(user);
      if (accessibleProps.length === 0) {
        res.json({ data: [], pagination: { total: 0, page, limit } });
        return;
      }

      const offset = (page - 1) * limit;

      // أ) في حال طلب جميع العقارات "all":
      if (isAllProperties) {
        let totalRecords = 0;
        const statusCounts = emptyStatusCounts();
        const allFetchedRows: any[] = [];

        for (const prop of accessibleProps) {
          try {
            await withTenant(prop.id, async (tenantDb) => {
              let effectiveProfileId = queryProfileId;
              if (!effectiveProfileId && user?.username) {
                const [foundEmp] = await tenantDb
                  .select({ id: profilesTable.id })
                  .from(profilesTable)
                  .where(eq(profilesTable.profileId, String(user.username)))
                  .limit(1);
                if (foundEmp) effectiveProfileId = foundEmp.id;
              }

              const conditions = buildConditions(
                req.query,
                categoryIsolation,
                effectiveProfileId,
                isStaffOnly,
              );
              const whereClause = conditions.length
                ? and(...conditions)
                : undefined;

              const [countRes] = await tenantDb
                .select({ count: sql<number>`count(*)` })
                .from(maintenanceTable)
                .leftJoin(
                  roomsTable,
                  eq(maintenanceTable.roomId, roomsTable.id),
                )
                // The search condition also matches building names.
                .leftJoin(
                  buildingsTable,
                  eq(roomsTable.buildingId, buildingsTable.id),
                )
                .leftJoin(
                  workersTable,
                  eq(maintenanceTable.workerId, workersTable.id),
                )
                .where(whereClause);

              const propTotal = Number(countRes?.count || 0);
              totalRecords += propTotal;

              const facet = buildConditions(
                { ...req.query, status: undefined },
                categoryIsolation,
                effectiveProfileId,
                isStaffOnly,
              );
              await countTicketsByStatus(
                tenantDb,
                facet.length ? and(...facet) : undefined,
                statusCounts,
              );

              if (propTotal > 0) {
                // جلب حتى offset + limit من كل عقار لضمان دقة الفرز المشترك
                const rows = await tenantDb
                  .select({
                    id: maintenanceTable.id,
                    parentId: maintenanceTable.parentId,
                    buildingId: roomsTable.buildingId,
                    buildingName: buildingsTable.name,
                    floorId: roomsTable.floorId,
                    floorNumber: floorsTable.floorNumber,
                    roomId: maintenanceTable.roomId,
                    roomNumber: roomsTable.roomNumber,
                    category: maintenanceTable.category,
                    problemType: maintenanceTable.problemType,
                    description: maintenanceTable.description,
                    status: maintenanceTable.status,
                    priority: maintenanceTable.priority,
                    reportedBy: maintenanceTable.reportedBy,
                    assignedTo: maintenanceTable.assignedTo,
                    assignedToName: sql<
                      string | null
                    >`CASE WHEN ${assignedProfile.firstName} IS NOT NULL THEN TRIM(CONCAT(COALESCE(${assignedProfile.firstName}, ''), ' ', COALESCE(${assignedProfile.lastName}, ''))) ELSE NULL END`,
                    assignedToProfileId: assignedProfile.profileId,
                    residentName: sql<string | null>`(
                      SELECT TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')))
                      FROM assignments a
                      JOIN profiles p ON p.id = a.profile_id
                      WHERE a.room_id = ${maintenanceTable.roomId} AND a.status = 'ACTIVE'
                      ORDER BY a.id DESC
                      LIMIT 1
                    )`,
                    workerId: maintenanceTable.workerId,
                    workerName: workersTable.name,
                    workerPhone: workersTable.phone,
                    workerSpecialty: workersTable.specialty,
                    reportedAt: maintenanceTable.reportedAt,
                    startedAt: maintenanceTable.startedAt,
                    resolvedAt: maintenanceTable.resolvedAt,
                    dueDate: maintenanceTable.dueDate,
                    notes: maintenanceTable.notes,
                    photoUrl: listPhotoUrl(prop.id),
                    createdAt: maintenanceTable.createdAt,
                    rating: maintenanceTable.rating,
                    ratingComment: maintenanceTable.ratingComment,
                    ratedAt: maintenanceTable.ratedAt,
                    ratedByProfileId: maintenanceTable.ratedByProfileId,
                    source: maintenanceTable.source,
                    assignedAt: maintenanceTable.assignedAt,
                  })
                  .from(maintenanceTable)
                  .leftJoin(
                    roomsTable,
                    eq(maintenanceTable.roomId, roomsTable.id),
                  )
                  .leftJoin(
                    buildingsTable,
                    eq(roomsTable.buildingId, buildingsTable.id),
                  )
                  .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
                  .leftJoin(
                    workersTable,
                    eq(maintenanceTable.workerId, workersTable.id),
                  )
                  .leftJoin(
                    assignedProfile,
                    eq(maintenanceTable.assignedTo, assignedProfile.id),
                  )
                  .where(whereClause)
                  .orderBy(
                    desc(maintenanceTable.reportedAt),
                    desc(maintenanceTable.id),
                  )
                  .limit(offset + limit);

                for (const row of rows) {
                  allFetchedRows.push({
                    ...row,
                    propertyId: prop.id,
                    propertyName: prop.displayName || prop.name,
                  });
                }
              }
            });
          } catch (propErr) {
            console.error(
              `[Maintenance Route] Error querying tenant ${prop.id}:`,
              propErr,
            );
          }
        }

        // فرز التذاكر المجمعة زمنياً
        allFetchedRows.sort((a, b) => {
          const dateA = a.reportedAt ? new Date(a.reportedAt).getTime() : 0;
          const dateB = b.reportedAt ? new Date(b.reportedAt).getTime() : 0;
          if (dateB !== dateA) return dateB - dateA;
          return (Number(b.id) || 0) - (Number(a.id) || 0);
        });

        const pagedRows = allFetchedRows.slice(offset, offset + limit);
        await Promise.all(
          [...new Set(pagedRows.map((r: any) => Number(r.propertyId)))]
            .filter(Boolean)
            .map((pid) => loadServiceCatalogue(pid)),
        );

        res.json({
          data: pagedRows.map(fmt),
          pagination: { total: totalRecords, page, limit },
          statusCounts,
        });
        return;
      }

      // ب) في حال تحديد عقار معين:
      const targetPropId = parseInt(queryProp, 10) || getTenantId(req);
      if (!targetPropId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      // التحقق من صلاحية الوصول للعقار
      const propObj = accessibleProps.find((p) => p.id === targetPropId);
      if (!isSysAdmin && !propObj) {
        res.status(403).json({ error: "Access denied to this property" });
        return;
      }

      const result = await withTenant(targetPropId, async (tenantDb) => {
        let effectiveProfileId = queryProfileId;
        if (!effectiveProfileId && user?.username) {
          const [foundEmp] = await tenantDb
            .select({ id: profilesTable.id })
            .from(profilesTable)
            .where(eq(profilesTable.profileId, String(user.username)))
            .limit(1);
          if (foundEmp) effectiveProfileId = foundEmp.id;
        }

        const conditions = buildConditions(
          req.query,
          categoryIsolation,
          effectiveProfileId,
          isStaffOnly,
        );
        const whereClause = conditions.length ? and(...conditions) : undefined;

        const [countResult] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(maintenanceTable)
          .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
          // The search condition also matches building names.
          .leftJoin(
            buildingsTable,
            eq(roomsTable.buildingId, buildingsTable.id),
          )
          .leftJoin(
            workersTable,
            eq(maintenanceTable.workerId, workersTable.id),
          )
          .where(whereClause);

        const statusCounts = emptyStatusCounts();
        const facet = buildConditions(
          { ...req.query, status: undefined },
          categoryIsolation,
          effectiveProfileId,
          isStaffOnly,
        );
        await countTicketsByStatus(
          tenantDb,
          facet.length ? and(...facet) : undefined,
          statusCounts,
        );

        const rows = await tenantDb
          .select({
            id: maintenanceTable.id,
            parentId: maintenanceTable.parentId,
            buildingId: roomsTable.buildingId,
            buildingName: buildingsTable.name,
            floorId: roomsTable.floorId,
            floorNumber: floorsTable.floorNumber,
            roomId: maintenanceTable.roomId,
            roomNumber: roomsTable.roomNumber,
            category: maintenanceTable.category,
            problemType: maintenanceTable.problemType,
            description: maintenanceTable.description,
            status: maintenanceTable.status,
            priority: maintenanceTable.priority,
            reportedBy: maintenanceTable.reportedBy,
            assignedTo: maintenanceTable.assignedTo,
            assignedToName: sql<
              string | null
            >`CASE WHEN ${assignedProfile.firstName} IS NOT NULL THEN TRIM(CONCAT(COALESCE(${assignedProfile.firstName}, ''), ' ', COALESCE(${assignedProfile.lastName}, ''))) ELSE NULL END`,
            assignedToProfileId: assignedProfile.profileId,
            residentName: sql<string | null>`(
              SELECT TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')))
              FROM assignments a
              JOIN profiles p ON p.id = a.profile_id
              WHERE a.room_id = ${maintenanceTable.roomId} AND a.status = 'ACTIVE'
              ORDER BY a.id DESC
              LIMIT 1
            )`,
            workerId: maintenanceTable.workerId,
            workerName: workersTable.name,
            workerPhone: workersTable.phone,
            workerSpecialty: workersTable.specialty,
            reportedAt: maintenanceTable.reportedAt,
            startedAt: maintenanceTable.startedAt,
            resolvedAt: maintenanceTable.resolvedAt,
            dueDate: maintenanceTable.dueDate,
            notes: maintenanceTable.notes,
            photoUrl: listPhotoUrl(targetPropId),
            createdAt: maintenanceTable.createdAt,
            rating: maintenanceTable.rating,
            ratingComment: maintenanceTable.ratingComment,
            ratedAt: maintenanceTable.ratedAt,
            ratedByProfileId: maintenanceTable.ratedByProfileId,
            source: maintenanceTable.source,
            assignedAt: maintenanceTable.assignedAt,
          })
          .from(maintenanceTable)
          .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
          .leftJoin(
            buildingsTable,
            eq(roomsTable.buildingId, buildingsTable.id),
          )
          .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
          .leftJoin(
            workersTable,
            eq(maintenanceTable.workerId, workersTable.id),
          )
          .leftJoin(
            assignedProfile,
            eq(maintenanceTable.assignedTo, assignedProfile.id),
          )
          .where(whereClause)
          .orderBy(desc(maintenanceTable.reportedAt), desc(maintenanceTable.id))
          .limit(limit)
          .offset(offset);

        return {
          total: Number(countResult?.count || 0),
          statusCounts,
          rows: rows.map((r) => ({
            ...r,
            propertyId: targetPropId,
            propertyName: propObj?.displayName || propObj?.name || "",
          })),
        };
      });

      await loadServiceCatalogue(Number(targetPropId));
      res.json({
        data: result.rows.map(fmt),
        pagination: { total: result.total, page, limit },
        statusCounts: result.statusCounts,
      });
    } catch (err) {
      next(err);
    }
  },
);

// 1c. صورة البلاغ — Serves a ticket photo stored inline (data URL) as an image.
// ─── Service catalogue (per property) ───────────────────────────────────────
// GET /maintenance/services — the property's services (seeded with defaults)
router.get(
  "/maintenance/services",
  requireAnyPermission(
    ["maintenance", "view"],
    ["maintenance", "view_maintenance"],
    ["maintenance", "view_housekeeping"],
    ["housekeeping", "view"],
    ["settings", "view"],
  ),
  validate({ query: CommonListQuery }),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res
          .status(400)
          .json({ success: false, message: "propertyId required" });
        return;
      }
      const rows = await withTenant(propertyId, (tenantDb) =>
        listServices(tenantDb),
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },
);

// POST /maintenance/services — add a service
router.post(
  "/maintenance/services",
  requireAnyPermission(["settings", "edit"], ["maintenance", "edit"]),
  validate({ body: MaintenanceServiceCreateBody }),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res
          .status(400)
          .json({ success: false, message: "propertyId required" });
        return;
      }
      const { category, labelAr, labelEn, targetMinutes } = req.body;
      const created = await withTenant(propertyId, async (tenantDb) => {
        const existing = await listServices(tenantDb);
        let key = serviceKeyFrom(labelEn);
        const taken = new Set(
          existing
            .filter((r: any) => r.category === category)
            .map((r: any) => r.key),
        );
        for (let i = 2; taken.has(key); i++)
          key = `${serviceKeyFrom(labelEn)}_${i}`;
        const [row] = await tenantDb
          .insert(maintenanceServicesTable)
          .values({
            category,
            key,
            labelAr,
            labelEn,
            targetMinutes,
            sortOrder: existing.length,
          })
          .returning();
        return row;
      });
      invalidateServiceCatalogue(propertyId);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /maintenance/services/:id — rename, change target time, (de)activate
router.patch(
  "/maintenance/services/:id",
  requireAnyPermission(["settings", "edit"], ["maintenance", "edit"]),
  validate({ params: IdParams, body: MaintenanceServiceUpdateBody }),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res
          .status(400)
          .json({ success: false, message: "propertyId required" });
        return;
      }
      const { propertyId: _p, ...changes } = req.body;
      if (Object.keys(changes).length === 0) {
        res.status(400).json({ success: false, message: "No changes" });
        return;
      }
      const [row] = await withTenant(propertyId, (tenantDb) =>
        tenantDb
          .update(maintenanceServicesTable)
          .set(changes)
          .where(eq(maintenanceServicesTable.id, Number(req.params.id)))
          .returning(),
      );
      if (!row) {
        res.status(404).json({ success: false, message: "Service not found" });
        return;
      }
      invalidateServiceCatalogue(propertyId);
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Daily report (also emailed nightly at 22:00 Cairo) ────────────────────
// GET /maintenance/daily-report?date=YYYY-MM-DD&format=html|json|csv
router.get(
  "/maintenance/daily-report",
  requireAnyPermission(
    ["maintenance", "view"],
    ["maintenance", "view_maintenance"],
    ["housekeeping", "view"],
    ["reports", "view"],
  ),
  validate({ query: MaintenanceDailyReportQuery }),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res
          .status(400)
          .json({ success: false, message: "propertyId required" });
        return;
      }
      const date = (req.query.date as string) || cairoToday();
      const lang = req.query.lang === "ar" ? "ar" : "en";
      const report = await buildDailyReport(propertyId, date);
      const format = (req.query.format as string) || "json";
      if (format === "html") {
        res.type("html").send(renderDailyReportHtml(report, lang));
      } else if (format === "csv") {
        const [y, m, d] = date.split("-");
        res
          .type("text/csv; charset=utf-8")
          .attachment(`Maintenance_Daily_${d}-${m}-${y}.csv`)
          .send(renderDailyReportCsv(report, lang));
      } else {
        res.json({ success: true, ...report });
      }
    } catch (err) {
      next(err);
    }
  },
);

// GET /maintenance/sla-watch — open tickets that are late or about to be
router.get(
  "/maintenance/sla-watch",
  requireAnyPermission(
    ["maintenance", "view"],
    ["maintenance", "view_maintenance"],
    ["housekeeping", "view"],
    ["dashboard", "view"],
  ),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res
          .status(400)
          .json({ success: false, message: "propertyId required" });
        return;
      }
      res.json({ success: true, ...(await buildSlaWatch(propertyId)) });
    } catch (err) {
      next(err);
    }
  },
);

// POST /maintenance/daily-report/send — email the report now
router.post(
  "/maintenance/daily-report/send",
  requireAnyPermission(["maintenance", "edit"], ["settings", "edit"]),
  validate({ body: MaintenanceDailyReportSendBody }),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res
          .status(400)
          .json({ success: false, message: "propertyId required" });
        return;
      }
      const date = req.body.date || cairoToday();
      const result = await sendDailyReport(
        propertyId,
        date,
        req.body.recipients,
        req.body.lang,
      );
      if (!result.sent) {
        res.status(400).json({
          success: false,
          message:
            result.reason === "SMTP not configured"
              ? "إعدادات البريد (SMTP) غير مكتملة / Email (SMTP) is not configured"
              : "لا توجد إيميلات مستلمين / No recipient emails configured",
          ...result,
        });
        return;
      }
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/maintenance/:id/photo",
  requireAnyPermission(
    ["maintenance", "view"],
    ["maintenance", "view_maintenance"],
    ["maintenance", "view_housekeeping"],
    ["maintenance", "edit"],
    ["housekeeping", "view"],
    ["housekeeping", "edit"],
  ),
  validate({ params: IdParams, query: CommonListQuery }),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }
      const id = Number(req.params.id);
      const rows = await withTenant(propertyId, (tenantDb) =>
        tenantDb
          .select({ photoUrl: maintenanceTable.photoUrl })
          .from(maintenanceTable)
          .where(eq(maintenanceTable.id, id))
          .limit(1),
      );
      const photo = rows[0]?.photoUrl;
      if (!photo) {
        res.status(404).json({
          error: "Photo not found",
          errorAr: "لا توجد صورة لهذا البلاغ",
        });
        return;
      }
      if (/^https?:\/\//i.test(photo)) {
        res.redirect(302, photo);
        return;
      }
      const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is.exec(photo);
      if (!m) {
        res.status(404).json({
          error: "Photo not found",
          errorAr: "لا توجد صورة لهذا البلاغ",
        });
        return;
      }
      res.setHeader("Content-Type", m[1].toLowerCase());
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Stored images are user uploads: never let one run script (e.g. SVG).
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      );
      // The list links carry a content hash (?v=…), so the URL changes with the photo.
      res.setHeader(
        "Cache-Control",
        req.query.v
          ? "private, max-age=31536000, immutable"
          : "private, no-cache",
      );
      res.send(Buffer.from(m[2], "base64"));
    } catch (err) {
      next(err);
    }
  },
);

// 1b. الحصول على بلاغ محدد
router.get(
  "/maintenance/:id",
  requireAnyPermission(
    ["maintenance", "view"],
    ["maintenance", "view_maintenance"],
    ["maintenance", "view_housekeeping"],
    ["maintenance", "edit"],
    ["housekeeping", "view"],
    ["housekeeping", "edit"],
  ),
  validate({ params: IdParams, query: CommonListQuery }),
  validate({ body: PropertyIdOnlyBody }),
  async (req, res, next) => {
    try {
      const user = (req as any).authUser;
      const isSysAdmin =
        user?.isSystemAdmin ||
        user?.roles?.includes("super_admin") ||
        user?.roles?.includes("system_admin");

      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid maintenance ID" });
        return;
      }

      const accessibleProps = await getAccessibleProperties(user);
      const queryProp =
        req.query.propertyId || req.body?.propertyId
          ? parseInt(String(req.query.propertyId || req.body?.propertyId), 10)
          : getTenantId(req) || 0;

      let targetPropList: typeof accessibleProps;
      if (queryProp && queryProp > 0) {
        targetPropList = [
          ...accessibleProps.filter((p) => p.id === queryProp),
          ...accessibleProps.filter((p) => p.id !== queryProp),
        ];
      } else {
        const sessionProp = (req.session as any)?.propertyId;
        if (sessionProp && sessionProp > 0) {
          targetPropList = [
            ...accessibleProps.filter((p) => p.id === sessionProp),
            ...accessibleProps.filter((p) => p.id !== sessionProp),
          ];
        } else {
          targetPropList = accessibleProps;
        }
      }

      let foundRecord: any = null;
      let matchedProp: any = null;

      for (const prop of targetPropList) {
        try {
          const rec = await withTenant(prop.id, async (tenantDb) => {
            const [found] = await tenantDb
              .select({
                id: maintenanceTable.id,
                parentId: maintenanceTable.parentId,
                buildingId: roomsTable.buildingId,
                buildingName: buildingsTable.name,
                floorId: roomsTable.floorId,
                floorNumber: floorsTable.floorNumber,
                roomId: maintenanceTable.roomId,
                roomNumber: roomsTable.roomNumber,
                problemType: maintenanceTable.problemType,
                description: maintenanceTable.description,
                priority: maintenanceTable.priority,
                status: maintenanceTable.status,
                assignedTo: maintenanceTable.assignedTo,
                assignedToName: sql<
                  string | null
                >`CASE WHEN ${assignedProfile.firstName} IS NOT NULL THEN TRIM(CONCAT(COALESCE(${assignedProfile.firstName}, ''), ' ', COALESCE(${assignedProfile.lastName}, ''))) ELSE NULL END`,
                assignedToProfileId: assignedProfile.profileId,
                residentName: sql<string | null>`(
                  SELECT TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')))
                  FROM assignments a
                  JOIN profiles p ON p.id = a.profile_id
                  WHERE a.room_id = ${maintenanceTable.roomId} AND a.status = 'ACTIVE'
                  ORDER BY a.id DESC
                  LIMIT 1
                )`,
                workerId: maintenanceTable.workerId,
                workerName: workersTable.name,
                workerPhone: workersTable.phone,
                workerSpecialty: workersTable.specialty,
                reportedBy: maintenanceTable.reportedBy,
                notes: maintenanceTable.notes,
                category: maintenanceTable.category,
                photoUrl: maintenanceTable.photoUrl,
                dueDate: maintenanceTable.dueDate,
                startedAt: maintenanceTable.startedAt,
                reportedAt: maintenanceTable.reportedAt,
                createdAt: maintenanceTable.createdAt,
                resolvedAt: maintenanceTable.resolvedAt,
                rating: maintenanceTable.rating,
                ratingComment: maintenanceTable.ratingComment,
                ratedAt: maintenanceTable.ratedAt,
                ratedByProfileId: maintenanceTable.ratedByProfileId,
                source: maintenanceTable.source,
                assignedAt: maintenanceTable.assignedAt,
              })
              .from(maintenanceTable)
              .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
              .leftJoin(
                buildingsTable,
                eq(roomsTable.buildingId, buildingsTable.id),
              )
              .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
              .leftJoin(
                workersTable,
                eq(maintenanceTable.workerId, workersTable.id),
              )
              .leftJoin(
                assignedProfile,
                eq(maintenanceTable.assignedTo, assignedProfile.id),
              )
              .where(eq(maintenanceTable.id, id))
              .limit(1);
            return found;
          });

          if (rec) {
            foundRecord = rec;
            matchedProp = prop;
            break;
          }
        } catch {}
      }

      if (!foundRecord) {
        res.status(404).json({ error: "Maintenance request not found" });
        return;
      }

      // فحص الصلاحية على الفئة
      const { userHasMaintenance, userHasHousekeeping } =
        resolveCategoryPermissions(user, isSysAdmin);
      if (!isSysAdmin) {
        if (foundRecord.category === "housekeeping") {
          if (!userHasHousekeeping) {
            res
              .status(403)
              .json({ error: "Permission denied to view housekeeping orders" });
            return;
          }
        } else {
          if (!userHasMaintenance) {
            res
              .status(403)
              .json({ error: "Permission denied to view maintenance orders" });
            return;
          }
        }
      }

      if (matchedProp?.id) await loadServiceCatalogue(matchedProp.id);
      res.json(
        fmt({
          ...foundRecord,
          propertyId: matchedProp?.id,
          propertyName: matchedProp?.displayName || matchedProp?.name,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

// 2. إنشاء بلاغ جديد (صيانة أو هاوس كيبنج)
router.post(
  "/maintenance",
  requireAnyPermission(
    ["maintenance", "create"],
    ["maintenance", "edit"],
    ["maintenance", "view"],
    ["maintenance", "view_maintenance"],
    ["housekeeping", "create"],
    ["housekeeping", "edit"],
    ["housekeeping", "view"],
    ["maintenance", "view_housekeeping"],
  ),
  validate({ query: CommonListQuery }),
  async (req, res, next) => {
    try {
      const user = (req as any).authUser;
      const isSysAdmin =
        user?.isSystemAdmin ||
        user?.roles?.includes("super_admin") ||
        user?.roles?.includes("system_admin");

      const userHasMntCreate =
        isSysAdmin ||
        hasPermission(user, "maintenance", "create") ||
        hasPermission(user, "maintenance", "edit") ||
        hasPermission(user, "maintenance", "view") ||
        hasPermission(user, "maintenance", "view_maintenance");
      const userHasHskCreate =
        isSysAdmin ||
        hasPermission(user, "housekeeping", "create") ||
        hasPermission(user, "housekeeping", "edit") ||
        hasPermission(user, "housekeeping", "view") ||
        hasPermission(user, "maintenance", "view_housekeeping");

      const parsed = CreateMaintenanceBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.message });
        return;
      }

      const category = (
        req.body.category ||
        (parsed.data as any).category ||
        "maintenance"
      ).toLowerCase();

      // التحقق من الصلاحية حسب فئة الطلب
      if (!isSysAdmin) {
        if (category === "housekeeping") {
          if (!userHasHskCreate) {
            res.status(403).json({
              error: "Permission denied to create housekeeping orders",
            });
            return;
          }
        } else {
          if (!userHasMntCreate) {
            res.status(403).json({
              error: "Permission denied to create maintenance orders",
            });
            return;
          }
        }
      }

      const propertyId =
        Number(req.body.propertyId) ||
        Number(req.query.propertyId) ||
        getTenantId(req);

      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      // التحقق من صلاحية الوصول للعقار
      const accessibleProps = await getAccessibleProperties(user);
      if (!isSysAdmin && !accessibleProps.some((p) => p.id === propertyId)) {
        res.status(403).json({ error: "Access denied to target property" });
        return;
      }

      const parentId = req.body.parentId
        ? parseInt(String(req.body.parentId))
        : null;

      const { record, roomNumber } = await withTenant(
        propertyId,
        async (tenantDb) => {
          const inserted = await tenantDb
            .insert(maintenanceTable)
            .values({
              ...parsed.data,
              category,
              workerId: req.body.workerId ? Number(req.body.workerId) : null,
              assignedTo: req.body.assignedTo
                ? Number(req.body.assignedTo)
                : null,
              reportedBy:
                req.body.reportedBy ||
                user?.displayName ||
                user?.username ||
                null,
              photoUrl: req.body.photoUrl || null,
              notes: req.body.notes || null,
              ...(parentId ? { parentId } : {}),
              status: "open",
              source: "admin",
              assignedAt:
                req.body.workerId || req.body.assignedTo ? new Date() : null,
            } as any)
            .returning();

          // Ticket history: created (and assigned, if a technician was set).
          const actor = {
            name: user?.displayName || user?.username || null,
            userId: user?.id ?? null,
          };
          await recordTicketEvents(tenantDb, inserted[0].id, actor, [
            { type: "created", toValue: "open" },
            ...(req.body.workerId || req.body.assignedTo
              ? [
                  {
                    type: "assigned" as const,
                    toValue: req.body.workerId
                      ? `worker:${req.body.workerId}`
                      : `profile:${req.body.assignedTo}`,
                  },
                ]
              : []),
          ]);

          let roomNum: string | undefined;
          if (inserted[0]?.roomId) {
            const [rm] = await tenantDb
              .select({ roomNumber: roomsTable.roomNumber })
              .from(roomsTable)
              .where(eq(roomsTable.id, inserted[0].roomId))
              .limit(1);
            roomNum = rm?.roomNumber;

            // إذا كان الطلب صيانة، نضع حالة الغرفة out_of_service
            if (category === "maintenance") {
              await tenantDb
                .update(roomsTable)
                .set({ status: "out_of_service" })
                .where(eq(roomsTable.id, inserted[0].roomId));
            } else if (category === "housekeeping") {
              const [roomData] = await tenantDb
                .select({
                  currentOccupancy: roomsTable.currentOccupancy,
                  status: roomsTable.status,
                })
                .from(roomsTable)
                .where(eq(roomsTable.id, inserted[0].roomId))
                .limit(1);
              if (
                roomData &&
                roomData.status !== "out_of_service" &&
                roomData.status !== "out_of_order"
              ) {
                const isOccupied = (roomData.currentOccupancy || 0) > 0;
                await tenantDb
                  .update(roomsTable)
                  .set({ status: isOccupied ? "occupied_dirty" : "dirty" })
                  .where(eq(roomsTable.id, inserted[0].roomId));
              }
            }
          }

          return { record: inserted[0], roomNumber: roomNum };
        },
      );

      if (req.body.workerId || req.body.assignedTo) {
        void withTenant(propertyId, (tenantDb) =>
          notifyTicketAssigned(
            tenantDb,
            propertyId,
            record,
            req.body.assignedTo ? Number(req.body.assignedTo) : null,
            req.body.workerId ? Number(req.body.workerId) : null,
          ),
        ).catch(() => {});
      }

      const s = session(req);
      const isHsk = category === "housekeeping";
      const actionTitle = isHsk
        ? roomNumber
          ? `طلب نظافة للغرفة رقم ${roomNumber}: ${record.description || record.problemType}`
          : `طلب نظافة جديد: ${record.description || record.problemType}`
        : roomNumber
          ? `بلاغ صيانة في الغرفة رقم ${roomNumber}: ${record.description || record.problemType}`
          : `بلاغ صيانة جديد: ${record.description || record.problemType}`;

      logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: actionTitle,
        actionType: "CREATE",
        module: isHsk ? "housekeeping" : "maintenance",
        entityType: "maintenance",
        entityId: record.id,
        details: {
          category,
          roomNumber,
          roomId: record.roomId,
          problemType: record.problemType,
          description: record.description,
          priority: record.priority,
          status: record.status,
          user: s.username,
          role: s.userRole,
        },
      });

      broadcastToProperty(propertyId, {
        module: "maintenance",
        action: "sync",
      });
      broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
      broadcastToProperty(propertyId, { module: "rooms", action: "sync" });
      if (isHsk) {
        broadcastToProperty(propertyId, {
          module: "housekeeping",
          action: "sync",
        });
      }

      await loadServiceCatalogue(propertyId);
      return res.status(201).json(fmt({ ...record, roomNumber, propertyId }));
    } catch (err) {
      return next(err);
    }
  },
);

// 3. تحديث بلاغ موجود
router.patch(
  "/maintenance/:id",
  requireAnyPermission(
    ["maintenance", "edit"],
    ["maintenance", "view"],
    ["maintenance", "view_maintenance"],
    ["housekeeping", "edit"],
    ["housekeeping", "view"],
    ["housekeeping", "assign"],
    ["maintenance", "view_housekeeping"],
  ),
  validate({
    params: IdParams,
    query: CommonListQuery,
    body: UpdateMaintenanceTicketBody,
  }),
  async (req, res, next) => {
    try {
      const user = (req as any).authUser;
      const isSysAdmin =
        user?.isSystemAdmin ||
        user?.roles?.includes("super_admin") ||
        user?.roles?.includes("system_admin");

      const p = UpdateMaintenanceParams.safeParse(req.params);
      if (!p.success) {
        res.status(400).json({ success: false, message: p.error.message });
        return;
      }

      const accessibleProps = await getAccessibleProperties(user);
      const queryProp =
        req.body?.propertyId || req.query?.propertyId
          ? parseInt(String(req.body?.propertyId || req.query?.propertyId), 10)
          : getTenantId(req) || 0;

      let targetPropList: typeof accessibleProps;
      if (queryProp && queryProp > 0) {
        targetPropList = [
          ...accessibleProps.filter((p) => p.id === queryProp),
          ...accessibleProps.filter((p) => p.id !== queryProp),
        ];
      } else {
        const sessionProp = (req.session as any)?.propertyId;
        if (sessionProp && sessionProp > 0) {
          targetPropList = [
            ...accessibleProps.filter((p) => p.id === sessionProp),
            ...accessibleProps.filter((p) => p.id !== sessionProp),
          ];
        } else {
          targetPropList = accessibleProps;
        }
      }

      let targetPropertyId = queryProp;
      let existingRecord: any = null;

      // البحث عن البلاغ لمعرفة العقار والفئة
      for (const prop of targetPropList) {
        try {
          const found = await withTenant(prop.id, async (tenantDb) => {
            const [row] = await tenantDb
              .select()
              .from(maintenanceTable)
              .where(eq(maintenanceTable.id, p.data.id))
              .limit(1);
            return row;
          });
          if (found) {
            existingRecord = found;
            targetPropertyId = prop.id;
            break;
          }
        } catch {}
      }

      if (!existingRecord || !targetPropertyId) {
        res.status(404).json({ success: false, message: "البلاغ غير موجود" });
        return;
      }

      // التحقق من الصلاحيات حسب الفئة (تشمل صلاحيات العرض والتعامل)
      const userHasMntEdit =
        isSysAdmin ||
        hasPermission(user, "maintenance", "edit") ||
        hasPermission(user, "maintenance", "view") ||
        hasPermission(user, "maintenance", "view_maintenance");
      const userHasHskEdit =
        isSysAdmin ||
        hasPermission(user, "housekeeping", "edit") ||
        hasPermission(user, "housekeeping", "view") ||
        hasPermission(user, "housekeeping", "assign") ||
        hasPermission(user, "maintenance", "view_housekeeping");

      if (!isSysAdmin) {
        if (existingRecord.category === "housekeeping") {
          if (!userHasHskEdit) {
            res
              .status(403)
              .json({ error: "Permission denied to edit housekeeping orders" });
            return;
          }
        } else {
          if (!userHasMntEdit) {
            res
              .status(403)
              .json({ error: "Permission denied to edit maintenance orders" });
            return;
          }
        }
      }

      // إزالة propertyId من حقول التحديث لتجنب أخطاء الجدول ومعالجة معرفات الفنيين
      // req.body is UpdateMaintenanceTicketBody: only editable fields remain.
      const updateData: Record<string, any> = { ...req.body };
      delete updateData.propertyId;
      for (const k of ["startedAt", "resolvedAt"] as const) {
        if (k in updateData) {
          updateData[k] = updateData[k] ? new Date(updateData[k]) : null;
          if (updateData[k] && Number.isNaN(updateData[k].getTime())) {
            delete updateData[k];
          }
        }
      }
      // Status timestamps are kept by the server, so every way of changing a
      // status (kanban, bulk, table, detail view) records them.
      const nextStatus = updateData.status as string | undefined;
      if (nextStatus && nextStatus !== existingRecord.status) {
        const now = new Date();
        if (nextStatus === "in_progress" && !existingRecord.startedAt) {
          updateData.startedAt ??= now;
        }
        if (nextStatus === "resolved" || nextStatus === "closed") {
          if (!existingRecord.resolvedAt) updateData.resolvedAt ??= now;
          if (!existingRecord.startedAt) updateData.startedAt ??= now;
        }
        if (nextStatus === "open" || nextStatus === "in_progress") {
          // Reopened: the earlier resolution no longer applies.
          if (existingRecord.resolvedAt) updateData.resolvedAt = null;
        }
      }
      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          message: "لا توجد حقول قابلة للتعديل / No editable fields",
        });
        return;
      }

      // First assignment time (for the ticket's response-time metrics).
      const assigning =
        ("workerId" in updateData && updateData.workerId) ||
        ("assignedTo" in updateData && updateData.assignedTo);
      if (assigning && !existingRecord.assignedAt) {
        updateData.assignedAt = new Date();
      }

      // Ticket history entries for what this change does.
      const historyEvents: Array<{
        type: "status" | "assigned" | "priority";
        fromValue?: string | null;
        toValue?: string | null;
      }> = [];
      if (updateData.status && updateData.status !== existingRecord.status) {
        historyEvents.push({
          type: "status",
          fromValue: existingRecord.status,
          toValue: updateData.status,
        });
      }
      for (const key of ["workerId", "assignedTo"] as const) {
        if (
          key in updateData &&
          String(updateData[key] ?? "") !== String(existingRecord[key] ?? "")
        ) {
          const kind = key === "workerId" ? "worker" : "profile";
          historyEvents.push({
            type: "assigned",
            fromValue:
              existingRecord[key] != null
                ? `${kind}:${existingRecord[key]}`
                : null,
            toValue:
              updateData[key] != null ? `${kind}:${updateData[key]}` : null,
          });
        }
      }
      if (
        updateData.priority &&
        String(updateData.priority).toLowerCase() !==
          String(existingRecord.priority ?? "").toLowerCase()
      ) {
        historyEvents.push({
          type: "priority",
          fromValue: existingRecord.priority,
          toValue: updateData.priority,
        });
      }
      if ("workerId" in updateData) {
        updateData.workerId = updateData.workerId
          ? Number(updateData.workerId)
          : null;
      }
      if ("assignedTo" in updateData) {
        updateData.assignedTo = updateData.assignedTo
          ? Number(updateData.assignedTo)
          : null;
      }

      const { updated, roomNumber } = await withTenant(
        targetPropertyId,
        async (tenantDb) => {
          const result = await tenantDb
            .update(maintenanceTable)
            .set(updateData as any)
            .where(eq(maintenanceTable.id, p.data.id))
            .returning();

          if (result[0]) {
            await recordTicketEvents(
              tenantDb,
              result[0].id,
              {
                name: user?.displayName || user?.username || null,
                userId: user?.id ?? null,
              },
              historyEvents,
            );
          }

          let roomNum: string | undefined;
          if (result[0]?.roomId) {
            const [rm] = await tenantDb
              .select({ roomNumber: roomsTable.roomNumber })
              .from(roomsTable)
              .where(eq(roomsTable.id, result[0].roomId))
              .limit(1);
            roomNum = rm?.roomNumber;
          }

          // معالجة تغيير حالة الغرفة للصيانة والهاوس كيبنج
          if (result[0]?.roomId && req.body.status) {
            const newStatus = req.body.status;
            const isResolvedOrClosed =
              newStatus === "resolved" || newStatus === "closed";
            const isOpenOrProgress =
              newStatus === "open" || newStatus === "in_progress";

            if (result[0].category === "maintenance") {
              if (isResolvedOrClosed) {
                const [openTickets] = await tenantDb
                  .select({ count: sql<number>`count(*)` })
                  .from(maintenanceTable)
                  .where(
                    and(
                      eq(maintenanceTable.roomId, result[0].roomId),
                      or(
                        eq(maintenanceTable.status, "open"),
                        eq(maintenanceTable.status, "in_progress"),
                      ),
                      eq(maintenanceTable.category, "maintenance"),
                    ),
                  );

                if (Number(openTickets?.count || 0) === 0) {
                  const roomData = await tenantDb
                    .select({ currentOccupancy: roomsTable.currentOccupancy })
                    .from(roomsTable)
                    .where(eq(roomsTable.id, result[0].roomId))
                    .limit(1);

                  const isOccupied = (roomData[0]?.currentOccupancy || 0) > 0;
                  await tenantDb
                    .update(roomsTable)
                    .set({ status: isOccupied ? "occupied_dirty" : "dirty" })
                    .where(eq(roomsTable.id, result[0].roomId));
                }
              } else if (isOpenOrProgress) {
                await tenantDb
                  .update(roomsTable)
                  .set({ status: "out_of_service" })
                  .where(eq(roomsTable.id, result[0].roomId));
              }
            } else if (result[0].category === "housekeeping") {
              if (isResolvedOrClosed) {
                // عند إنجاز طلب النظافة والتأكد من عدم وجود طلبات نظافة أخرى مفتوحة للغرفة
                const [openHsk] = await tenantDb
                  .select({ count: sql<number>`count(*)` })
                  .from(maintenanceTable)
                  .where(
                    and(
                      eq(maintenanceTable.roomId, result[0].roomId),
                      or(
                        eq(maintenanceTable.status, "open"),
                        eq(maintenanceTable.status, "in_progress"),
                      ),
                      eq(maintenanceTable.category, "housekeeping"),
                    ),
                  );

                if (Number(openHsk?.count || 0) === 0) {
                  const [roomData] = await tenantDb
                    .select({
                      currentOccupancy: roomsTable.currentOccupancy,
                      status: roomsTable.status,
                    })
                    .from(roomsTable)
                    .where(eq(roomsTable.id, result[0].roomId))
                    .limit(1);

                  if (
                    roomData &&
                    roomData.status !== "out_of_service" &&
                    roomData.status !== "out_of_order"
                  ) {
                    const isOccupied = (roomData.currentOccupancy || 0) > 0;
                    await tenantDb
                      .update(roomsTable)
                      .set({ status: isOccupied ? "occupied" : "available" })
                      .where(eq(roomsTable.id, result[0].roomId));
                  }
                }
              } else if (isOpenOrProgress) {
                const [roomData] = await tenantDb
                  .select({
                    currentOccupancy: roomsTable.currentOccupancy,
                    status: roomsTable.status,
                  })
                  .from(roomsTable)
                  .where(eq(roomsTable.id, result[0].roomId))
                  .limit(1);

                if (
                  roomData &&
                  roomData.status !== "out_of_service" &&
                  roomData.status !== "out_of_order"
                ) {
                  const isOccupied = (roomData.currentOccupancy || 0) > 0;
                  await tenantDb
                    .update(roomsTable)
                    .set({ status: isOccupied ? "occupied_dirty" : "dirty" })
                    .where(eq(roomsTable.id, result[0].roomId));
                }
              }
            }
          }

          return { updated: result[0], roomNumber: roomNum };
        },
      );

      if (!updated) {
        res.status(404).json({ success: false, message: "البلاغ غير موجود" });
        return;
      }

      // Notifications (after the change; never block or fail the request).
      const newlyAssigned = historyEvents.some(
        (e) => e.type === "assigned" && e.toValue,
      );
      const nowResolved =
        updateData.status === "resolved" &&
        existingRecord.status !== "resolved";
      if (newlyAssigned || nowResolved) {
        void withTenant(targetPropertyId, async (tenantDb) => {
          if (newlyAssigned) {
            await notifyTicketAssigned(
              tenantDb,
              targetPropertyId,
              updated,
              "assignedTo" in updateData ? updateData.assignedTo : null,
              "workerId" in updateData ? updateData.workerId : null,
            );
          }
          if (nowResolved) {
            await notifyTicketResolved(tenantDb, targetPropertyId, updated);
          }
        }).catch(() => {});
      }

      const s = session(req);
      const isHsk = updated.category === "housekeeping";
      logActivity({
        req,
        propertyId: targetPropertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: roomNumber
          ? `تحديث طلب ${isHsk ? "نظافة" : "صيانة"} الغرفة رقم ${roomNumber} -> ${updated.status}`
          : `تحديث طلب #${updated.id} -> ${updated.status}`,
        actionType: "UPDATE",
        module: isHsk ? "housekeeping" : "maintenance",
        entityType: "maintenance",
        entityId: updated.id,
        details: {
          category: updated.category,
          roomNumber,
          roomId: updated.roomId,
          status: updated.status,
          updatedFields: req.body,
          user: s.username,
          role: s.userRole,
        },
      });

      broadcastToProperty(targetPropertyId, {
        module: "maintenance",
        action: "sync",
      });
      broadcastToProperty(targetPropertyId, {
        module: "dashboard",
        action: "sync",
      });
      broadcastToProperty(targetPropertyId, {
        module: "rooms",
        action: "sync",
      });
      if (isHsk) {
        broadcastToProperty(targetPropertyId, {
          module: "housekeeping",
          action: "sync",
        });
      }

      await loadServiceCatalogue(targetPropertyId);
      return res.json(
        fmt({ ...updated, propertyId: targetPropertyId, roomNumber }),
      );
    } catch (err) {
      return next(err);
    }
  },
);

// 4. حذف بلاغ
router.delete(
  "/maintenance/:id",
  requireAnyPermission(
    ["maintenance", "delete"],
    ["maintenance", "edit"],
    ["housekeeping", "delete"],
    ["housekeeping", "edit"],
  ),
  validate({ params: IdParams, query: CommonListQuery }),
  async (req, res, next) => {
    try {
      const user = (req as any).authUser;
      const isSysAdmin =
        user?.isSystemAdmin ||
        user?.roles?.includes("super_admin") ||
        user?.roles?.includes("system_admin");

      const p = DeleteMaintenanceParams.safeParse(req.params);
      if (!p.success) {
        res.status(400).json({ success: false, message: p.error.message });
        return;
      }

      const accessibleProps = await getAccessibleProperties(user);
      const queryProp =
        req.query?.propertyId || req.body?.propertyId
          ? parseInt(String(req.query?.propertyId || req.body?.propertyId), 10)
          : getTenantId(req) || 0;

      let targetPropList: typeof accessibleProps;
      if (queryProp && queryProp > 0) {
        targetPropList = [
          ...accessibleProps.filter((p) => p.id === queryProp),
          ...accessibleProps.filter((p) => p.id !== queryProp),
        ];
      } else {
        const sessionProp = (req.session as any)?.propertyId;
        if (sessionProp && sessionProp > 0) {
          targetPropList = [
            ...accessibleProps.filter((p) => p.id === sessionProp),
            ...accessibleProps.filter((p) => p.id !== sessionProp),
          ];
        } else {
          targetPropList = accessibleProps;
        }
      }

      let targetPropertyId = queryProp;
      let existingRecord: any = null;

      for (const prop of targetPropList) {
        try {
          const found = await withTenant(prop.id, async (tenantDb) => {
            const [row] = await tenantDb
              .select()
              .from(maintenanceTable)
              .where(eq(maintenanceTable.id, p.data.id))
              .limit(1);
            return row;
          });
          if (found) {
            existingRecord = found;
            targetPropertyId = prop.id;
            break;
          }
        } catch {}
      }

      if (!existingRecord || !targetPropertyId) {
        res.status(404).json({ success: false, message: "البلاغ غير موجود" });
        return;
      }

      // التحقق من الصلاحية
      const userHasMntDelete =
        isSysAdmin ||
        hasPermission(user, "maintenance", "delete") ||
        hasPermission(user, "maintenance", "edit");
      const userHasHskDelete =
        isSysAdmin ||
        hasPermission(user, "housekeeping", "delete") ||
        hasPermission(user, "housekeeping", "edit");

      if (!isSysAdmin) {
        if (existingRecord.category === "housekeeping") {
          if (!userHasHskDelete) {
            res.status(403).json({
              error: "Permission denied to delete housekeeping orders",
            });
            return;
          }
        } else {
          if (!userHasMntDelete) {
            res.status(403).json({
              error: "Permission denied to delete maintenance orders",
            });
            return;
          }
        }
      }

      const { row, roomNumber } = await withTenant(
        targetPropertyId,
        async (tenantDb) => {
          let roomNum: string | undefined;
          if (existingRecord.roomId) {
            const [rm] = await tenantDb
              .select({ roomNumber: roomsTable.roomNumber })
              .from(roomsTable)
              .where(eq(roomsTable.id, existingRecord.roomId))
              .limit(1);
            roomNum = rm?.roomNumber;
          }
          await tenantDb
            .delete(maintenanceTable)
            .where(eq(maintenanceTable.id, p.data.id));

          return { row: existingRecord, roomNumber: roomNum };
        },
      );

      const s = session(req);
      const isHsk = row.category === "housekeeping";
      logActivity({
        req,
        propertyId: targetPropertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: roomNumber
          ? `حذف طلب ${isHsk ? "نظافة" : "صيانة"} الغرفة رقم ${roomNumber} (#${row.id})`
          : `حذف طلب #${row.id}`,
        actionType: "DELETE",
        module: isHsk ? "housekeeping" : "maintenance",
        entityType: "maintenance",
        entityId: row.id,
        details: {
          category: row.category,
          roomNumber,
          roomId: row.roomId,
          ticketId: row.id,
          user: s.username,
          role: s.userRole,
        },
      });

      broadcastToProperty(targetPropertyId, {
        module: "maintenance",
        action: "sync",
      });
      broadcastToProperty(targetPropertyId, {
        module: "dashboard",
        action: "sync",
      });
      if (isHsk) {
        broadcastToProperty(targetPropertyId, {
          module: "housekeeping",
          action: "sync",
        });
      }

      return res.sendStatus(204);
    } catch (err) {
      return next(err);
    }
  },
);

// 5. جلب التذاكر الفرعية
router.get(
  "/maintenance/:id/sub-tickets",
  requireAnyPermission(["maintenance", "view"], ["housekeeping", "view"]),
  validate({ params: IdParams, query: CommonListQuery }),
  async (req, res, next) => {
    try {
      const user = (req as any).authUser;
      const parentId = parseInt(String(req.params.id), 10);
      if (isNaN(parentId)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }

      const accessibleProps = await getAccessibleProperties(user);
      const queryProp = req.query?.propertyId
        ? parseInt(String(req.query.propertyId), 10)
        : 0;
      const targetPropList = queryProp
        ? accessibleProps.filter((p) => p.id === queryProp)
        : accessibleProps;

      let subTickets: any[] = [];

      for (const prop of targetPropList) {
        try {
          const rows = await withTenant(prop.id, async (tenantDb) => {
            return await tenantDb
              .select({
                id: maintenanceTable.id,
                parentId: maintenanceTable.parentId,
                roomId: maintenanceTable.roomId,
                roomNumber: roomsTable.roomNumber,
                problemType: maintenanceTable.problemType,
                description: maintenanceTable.description,
                status: maintenanceTable.status,
                priority: maintenanceTable.priority,
                category: maintenanceTable.category,
                reportedAt: maintenanceTable.reportedAt,
                resolvedAt: maintenanceTable.resolvedAt,
              })
              .from(maintenanceTable)
              .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
              .where(eq(maintenanceTable.parentId, parentId))
              .orderBy(
                desc(maintenanceTable.reportedAt),
                desc(maintenanceTable.id),
              );
          });
          if (rows.length > 0) {
            subTickets = rows.map((r) => ({ ...r, propertyId: prop.id }));
            break;
          }
        } catch {}
      }

      return res.json(subTickets.map(fmt));
    } catch (err) {
      return next(err);
    }
  },
);

// 6. إضافة تذكرة فرعية
router.post(
  "/maintenance/:id/sub-tickets",
  requireAnyPermission(
    ["maintenance", "create"],
    ["housekeeping", "create"],
    ["housekeeping", "edit"],
  ),
  validate({ params: IdParams, query: CommonListQuery }),
  validate({ body: SubTicketBody }),
  async (req, res, next) => {
    try {
      const user = (req as any).authUser;
      const parentId = parseInt(String(req.params.id), 10);
      if (isNaN(parentId)) {
        res.status(400).json({ error: "Invalid parent ID" });
        return;
      }

      const accessibleProps = await getAccessibleProperties(user);
      const queryProp =
        req.body?.propertyId || req.query?.propertyId
          ? parseInt(String(req.body?.propertyId || req.query?.propertyId), 10)
          : 0;
      const targetPropList = queryProp
        ? accessibleProps.filter((p) => p.id === queryProp)
        : accessibleProps;

      let targetPropertyId = queryProp;
      let parentRecord: any = null;

      for (const prop of targetPropList) {
        try {
          const found = await withTenant(prop.id, async (tenantDb) => {
            const [row] = await tenantDb
              .select()
              .from(maintenanceTable)
              .where(eq(maintenanceTable.id, parentId))
              .limit(1);
            return row;
          });
          if (found) {
            parentRecord = found;
            targetPropertyId = prop.id;
            break;
          }
        } catch {}
      }

      if (!parentRecord || !targetPropertyId) {
        res.status(404).json({ error: "Parent ticket not found" });
        return;
      }

      const { problemType, description, priority, roomId, category } = req.body;
      let targetRoomId = roomId
        ? parseInt(String(roomId))
        : parentRecord.roomId;

      const [record] = await withTenant(targetPropertyId, async (tenantDb) => {
        return await tenantDb
          .insert(maintenanceTable)
          .values({
            roomId: targetRoomId,
            category: category || parentRecord.category || "maintenance",
            problemType: problemType || "General",
            description: description || "",
            priority: priority || "medium",
            parentId,
            status: "open",
          } as any)
          .returning();
      });

      broadcastToProperty(targetPropertyId, {
        module: "maintenance",
        action: "sync",
      });
      return res.status(201).json(
        fmt({
          ...record,
          propertyId: targetPropertyId,
          ...(await loadServiceCatalogue(targetPropertyId).then(() => ({}))),
        }),
      );
    } catch (err) {
      return next(err);
    }
  },
);

// ─── Ticket history & comments ─────────────────────────────────────────────
// Loads a ticket of the request's property and checks the user may see /
// work on its category. Returns null after answering when not allowed.
async function loadTicketForHistory(req: any, res: any, mode: "view" | "edit") {
  const user = (req as any).authUser;
  const isSysAdmin =
    user?.isSystemAdmin ||
    user?.roles?.includes("super_admin") ||
    user?.roles?.includes("system_admin");
  const propertyId = getTenantId(req);
  const ticketId = Number(req.params.id);
  if (!propertyId || !ticketId) {
    res
      .status(400)
      .json({ success: false, message: "propertyId and id required" });
    return null;
  }
  const [ticket] = await withTenant(propertyId, (tenantDb) =>
    tenantDb
      .select({ id: maintenanceTable.id, category: maintenanceTable.category })
      .from(maintenanceTable)
      .where(eq(maintenanceTable.id, ticketId))
      .limit(1),
  );
  if (!ticket) {
    res
      .status(404)
      .json({ success: false, message: "البلاغ غير موجود / Ticket not found" });
    return null;
  }
  if (!isSysAdmin) {
    const hsk = ticket.category === "housekeeping";
    const allowed = hsk
      ? hasPermission(user, "housekeeping", mode) ||
        hasPermission(user, "housekeeping", "view") ||
        hasPermission(user, "maintenance", "view_housekeeping")
      : hasPermission(user, "maintenance", mode) ||
        hasPermission(user, "maintenance", "view") ||
        hasPermission(user, "maintenance", "view_maintenance");
    if (!allowed) {
      res.status(403).json({ success: false, message: "Permission denied" });
      return null;
    }
  }
  return { user, propertyId, ticketId };
}

// GET /maintenance/:id/events — the ticket's history and comments, oldest first
router.get(
  "/maintenance/:id/events",
  requireAnyPermission(
    ["maintenance", "view"],
    ["maintenance", "view_maintenance"],
    ["maintenance", "view_housekeeping"],
    ["housekeeping", "view"],
  ),
  validate({ params: IdParams, query: CommonListQuery }),
  async (req, res, next) => {
    try {
      const ctx = await loadTicketForHistory(req, res, "view");
      if (!ctx) return;
      const events = await withTenant(ctx.propertyId, async (tenantDb) => {
        const rows = await tenantDb
          .select()
          .from(maintenanceEventsTable)
          .where(eq(maintenanceEventsTable.ticketId, ctx.ticketId))
          .orderBy(maintenanceEventsTable.createdAt, maintenanceEventsTable.id);

        // Names for assignment entries ("worker:5" / "profile:7").
        const ids = { worker: new Set<number>(), profile: new Set<number>() };
        for (const r of rows) {
          for (const v of [r.fromValue, r.toValue]) {
            const m = /^(worker|profile):(\d+)$/.exec(String(v ?? ""));
            if (m) ids[m[1] as "worker" | "profile"].add(Number(m[2]));
          }
        }
        const names = new Map<string, string>();
        if (ids.worker.size) {
          const ws = await tenantDb
            .select({ id: workersTable.id, name: workersTable.name })
            .from(workersTable)
            .where(inArray(workersTable.id, [...ids.worker]));
          for (const w of ws) names.set(`worker:${w.id}`, w.name);
        }
        if (ids.profile.size) {
          const ps = await tenantDb
            .select({
              id: profilesTable.id,
              firstName: profilesTable.firstName,
              lastName: profilesTable.lastName,
            })
            .from(profilesTable)
            .where(inArray(profilesTable.id, [...ids.profile]));
          for (const p of ps)
            names.set(
              `profile:${p.id}`,
              `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
            );
        }
        const label = (v: string | null) => (v ? (names.get(v) ?? v) : null);
        return rows.map((r) => ({
          id: r.id,
          type: r.type,
          fromValue: r.type === "assigned" ? label(r.fromValue) : r.fromValue,
          toValue: r.type === "assigned" ? label(r.toValue) : r.toValue,
          comment: r.comment,
          actorName: r.actorName,
          createdAt:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : r.createdAt,
        }));
      });
      res.json({ success: true, data: events });
    } catch (err) {
      next(err);
    }
  },
);

// POST /maintenance/:id/comments — add a comment to the ticket's history
router.post(
  "/maintenance/:id/comments",
  requireAnyPermission(
    ["maintenance", "edit"],
    ["maintenance", "view"],
    ["maintenance", "view_maintenance"],
    ["housekeeping", "edit"],
    ["housekeeping", "view"],
    ["maintenance", "view_housekeeping"],
  ),
  validate({
    params: IdParams,
    query: CommonListQuery,
    body: MaintenanceCommentBody,
  }),
  async (req, res, next) => {
    try {
      const ctx = await loadTicketForHistory(req, res, "edit");
      if (!ctx) return;
      const actorName = ctx.user?.displayName || ctx.user?.username || null;
      await withTenant(ctx.propertyId, (tenantDb) =>
        recordTicketEvents(
          tenantDb,
          ctx.ticketId,
          { name: actorName, userId: ctx.user?.id ?? null },
          [{ type: "comment", comment: req.body.comment }],
        ),
      );
      broadcastToProperty(ctx.propertyId, {
        module: "maintenance",
        action: "sync",
      });
      res.status(201).json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
