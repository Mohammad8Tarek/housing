import { Router } from "express";
import {
  db,
  maintenanceTable,
  roomsTable,
  propertiesTable,
  profilesTable,
  withTenant,
} from "@workspace/db";
import { eq, and, or, ilike, sql, SQL, desc, inArray } from "drizzle-orm";
import {
  CreateMaintenanceBody,
  GetMaintenanceParams,
  UpdateMaintenanceParams,
  DeleteMaintenanceParams,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { broadcastToProperty } from "../lib/websocket.js";
import {
  requirePermission,
  requireAnyPermission,
  hasPermission,
} from "../middlewares/permissions.js";
import { getTenantId, su } from "../lib/request-utils.js";

const router: Router = Router();

/**
 * جلب العقارات المصرح للمستخدم الوصول إليها
 */
async function getAccessibleProperties(user: any): Promise<{ id: number; name: string; displayName?: string | null }[]> {
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
          inArray(propertiesTable.id, pIds)
        )
      );
    return props;
  } catch (err) {
    console.error("[Maintenance Route] Failed to get accessible properties:", err);
    return [];
  }
}

/**
 * بناء شروط الفلترة لبلاغات الصيانة / النظافة مع دعم الحصر للموظف
 */
function buildConditions(
  query: any,
  allowedCategory: string | null,
  userProfileId?: number | null,
  isStaffOnly?: boolean,
): SQL[] {
  const conditions: SQL[] = [];

  // 1. تقييد الفئة بناءً على الصلاحيات أو الفلتر
  if (allowedCategory) {
    conditions.push(eq(maintenanceTable.category, allowedCategory));
  } else if (query.category && query.category !== "all") {
    conditions.push(eq(maintenanceTable.category, String(query.category)));
  }

  // 2. الحالة
  if (query.status && query.status !== "all") {
    conditions.push(eq(maintenanceTable.status, String(query.status)));
  }

  // 3. الأولوية
  if (query.priority && query.priority !== "all") {
    conditions.push(eq(maintenanceTable.priority, String(query.priority)));
  }

  // 4. تقييد التعيين للموظف (Assigned To / Scoping)
  if (isStaffOnly && userProfileId) {
    // موظف / فني بدون صلاحيات إشرافية: يرى أوردراته فقط حصرًا
    conditions.push(eq(maintenanceTable.assignedTo, userProfileId));
  } else if (query.assignedTo) {
    if (query.assignedTo === "unassigned") {
      conditions.push(sql`${maintenanceTable.assignedTo} IS NULL`);
    } else if (query.assignedTo === "me" && userProfileId) {
      conditions.push(eq(maintenanceTable.assignedTo, userProfileId));
    } else if (query.assignedTo !== "all") {
      const aId = parseInt(String(query.assignedTo), 10);
      if (!isNaN(aId)) {
        conditions.push(eq(maintenanceTable.assignedTo, aId));
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
        conditions.push(sql`${maintenanceTable.reportedAt} >= ${fromD.toISOString()}::timestamptz`);
      }
    } catch {}
  }
  if (query.toDate) {
    try {
      const toD = new Date(query.toDate);
      if (!isNaN(toD.getTime())) {
        toD.setHours(23, 59, 59, 999);
        conditions.push(sql`${maintenanceTable.reportedAt} <= ${toD.toISOString()}::timestamptz`);
      }
    } catch {}
  }

  // 7. البحث النصي
  if (query.search && String(query.search).trim()) {
    const s = String(query.search).trim();
    conditions.push(
      or(
        ilike(maintenanceTable.description, `%${s}%`),
        ilike(maintenanceTable.problemType, `%${s}%`),
        ilike(roomsTable.roomNumber, `%${s}%`)
      )!
    );
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
  };
}

// 1. جلب قائمة البلاغات مع الفلترة والفرز ودعم العقارات المتعددة
router.get(
  "/maintenance",
  requireAnyPermission(
    ["maintenance", "view"],
    ["housekeeping", "view"]
  ),
  async (req, res, next) => {
    try {
      const user = (req as any).authUser;
      const isSysAdmin =
        user?.isSystemAdmin ||
        user?.roles?.includes("super_admin") ||
        user?.roles?.includes("system_admin");

      const userHasMaintenance = isSysAdmin || hasPermission(user, "maintenance", "view");
      const userHasHousekeeping = isSysAdmin || hasPermission(user, "housekeeping", "view");

      // تقييد الفئة حسب الصلاحية:
      // إذا كان المستخدم لديه فقط housekeeping يرى فقط housekeeping
      // إذا كان لديه فقط maintenance يرى فقط maintenance
      // إذا كان لديه كلاهما يرى حسب query.category
      let allowedCategory: string | null = null;
      if (!isSysAdmin) {
        if (userHasHousekeeping && !userHasMaintenance) {
          allowedCategory = "housekeeping";
        } else if (userHasMaintenance && !userHasHousekeeping) {
          allowedCategory = "maintenance";
        }
      }

      const canAssignMnt = isSysAdmin || hasPermission(user, "maintenance", "assign");
      const canAssignHsk = isSysAdmin || hasPermission(user, "housekeeping", "assign");
      const hasManagerialScope = isSysAdmin || canAssignMnt || canAssignHsk || user?.roles?.includes("manager") || user?.roles?.includes("admin");
      const isStaffOnly = !hasManagerialScope;
      const queryProfileId = req.query.assignedToProfileId ? parseInt(String(req.query.assignedToProfileId), 10) : null;

      let page = 1;
      let limit = 1000;
      if (req.query.page) page = Math.max(1, parseInt(req.query.page as string) || 1);
      if (req.query.limit) limit = Math.min(5000, Math.max(1, parseInt(req.query.limit as string) || 10));

      const queryProp = req.query.propertyId ? String(req.query.propertyId).trim() : "";
      const isAllProperties = queryProp === "all" || (!queryProp && (req.session?.propertyId === -1 || !req.session?.propertyId));

      const accessibleProps = await getAccessibleProperties(user);
      if (accessibleProps.length === 0) {
        res.json({ data: [], pagination: { total: 0, page, limit } });
        return;
      }

      const offset = (page - 1) * limit;

      // أ) في حال طلب جميع العقارات "all":
      if (isAllProperties) {
        let totalRecords = 0;
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

              const conditions = buildConditions(req.query, allowedCategory, effectiveProfileId, isStaffOnly);
              const whereClause = conditions.length ? and(...conditions) : undefined;

              const [countRes] = await tenantDb
                .select({ count: sql<number>`count(*)` })
                .from(maintenanceTable)
                .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
                .where(whereClause);

              const propTotal = Number(countRes?.count || 0);
              totalRecords += propTotal;

              if (propTotal > 0) {
                // جلب حتى offset + limit من كل عقار لضمان دقة الفرز المشترك
                const rows = await tenantDb
                  .select({
                    id: maintenanceTable.id,
                    parentId: maintenanceTable.parentId,
                    roomId: maintenanceTable.roomId,
                    roomNumber: roomsTable.roomNumber,
                    category: maintenanceTable.category,
                    problemType: maintenanceTable.problemType,
                    description: maintenanceTable.description,
                    status: maintenanceTable.status,
                    priority: maintenanceTable.priority,
                    reportedBy: maintenanceTable.reportedBy,
                    assignedTo: maintenanceTable.assignedTo,
                    reportedAt: maintenanceTable.reportedAt,
                    startedAt: maintenanceTable.startedAt,
                    resolvedAt: maintenanceTable.resolvedAt,
                    dueDate: maintenanceTable.dueDate,
                    notes: maintenanceTable.notes,
                    photoUrl: maintenanceTable.photoUrl,
                    createdAt: maintenanceTable.createdAt,
                  })
                  .from(maintenanceTable)
                  .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
                  .where(whereClause)
                  .orderBy(desc(maintenanceTable.reportedAt), desc(maintenanceTable.id))
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
            console.error(`[Maintenance Route] Error querying tenant ${prop.id}:`, propErr);
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

        res.json({
          data: pagedRows.map(fmt),
          pagination: { total: totalRecords, page, limit },
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

        const conditions = buildConditions(req.query, allowedCategory, effectiveProfileId, isStaffOnly);
        const whereClause = conditions.length ? and(...conditions) : undefined;

        const [countResult] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(maintenanceTable)
          .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
          .where(whereClause);

        const rows = await tenantDb
          .select({
            id: maintenanceTable.id,
            parentId: maintenanceTable.parentId,
            roomId: maintenanceTable.roomId,
            roomNumber: roomsTable.roomNumber,
            category: maintenanceTable.category,
            problemType: maintenanceTable.problemType,
            description: maintenanceTable.description,
            status: maintenanceTable.status,
            priority: maintenanceTable.priority,
            reportedBy: maintenanceTable.reportedBy,
            assignedTo: maintenanceTable.assignedTo,
            reportedAt: maintenanceTable.reportedAt,
            startedAt: maintenanceTable.startedAt,
            resolvedAt: maintenanceTable.resolvedAt,
            dueDate: maintenanceTable.dueDate,
            notes: maintenanceTable.notes,
            photoUrl: maintenanceTable.photoUrl,
            createdAt: maintenanceTable.createdAt,
          })
          .from(maintenanceTable)
          .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
          .where(whereClause)
          .orderBy(desc(maintenanceTable.reportedAt), desc(maintenanceTable.id))
          .limit(limit)
          .offset(offset);

        return {
          total: Number(countResult?.count || 0),
          rows: rows.map((r) => ({
            ...r,
            propertyId: targetPropId,
            propertyName: propObj?.displayName || propObj?.name || "",
          })),
        };
      });

      res.json({
        data: result.rows.map(fmt),
        pagination: { total: result.total, page, limit },
      });
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
    ["housekeeping", "view"]
  ),
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
      const queryProp = req.query.propertyId ? parseInt(String(req.query.propertyId), 10) : 0;
      const targetPropList = queryProp ? accessibleProps.filter((p) => p.id === queryProp) : accessibleProps;

      let foundRecord: any = null;
      let matchedProp: any = null;

      for (const prop of targetPropList) {
        try {
          const rec = await withTenant(prop.id, async (tenantDb) => {
            const [found] = await tenantDb
              .select({
                id: maintenanceTable.id,
                parentId: maintenanceTable.parentId,
                roomId: maintenanceTable.roomId,
                roomNumber: roomsTable.roomNumber,
                problemType: maintenanceTable.problemType,
                description: maintenanceTable.description,
                priority: maintenanceTable.priority,
                status: maintenanceTable.status,
                assignedTo: maintenanceTable.assignedTo,
                reportedBy: maintenanceTable.reportedBy,
                notes: maintenanceTable.notes,
                category: maintenanceTable.category,
                photoUrl: maintenanceTable.photoUrl,
                dueDate: maintenanceTable.dueDate,
                startedAt: maintenanceTable.startedAt,
                reportedAt: maintenanceTable.reportedAt,
                createdAt: maintenanceTable.createdAt,
                resolvedAt: maintenanceTable.resolvedAt,
              })
              .from(maintenanceTable)
              .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
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
      const userHasMaintenance = isSysAdmin || hasPermission(user, "maintenance", "view");
      const userHasHousekeeping = isSysAdmin || hasPermission(user, "housekeeping", "view");
      if (!isSysAdmin) {
        if (foundRecord.category === "housekeeping" && !userHasHousekeeping) {
          res.status(403).json({ error: "Permission denied" });
          return;
        }
        if (foundRecord.category === "maintenance" && !userHasMaintenance) {
          res.status(403).json({ error: "Permission denied" });
          return;
        }
      }

      res.json(fmt({
        ...foundRecord,
        propertyId: matchedProp?.id,
        propertyName: matchedProp?.displayName || matchedProp?.name,
      }));
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
    ["housekeeping", "create"],
    ["housekeeping", "edit"]
  ),
  async (req, res, next) => {
    try {
      const user = (req as any).authUser;
      const isSysAdmin =
        user?.isSystemAdmin ||
        user?.roles?.includes("super_admin") ||
        user?.roles?.includes("system_admin");

      const userHasMntCreate = isSysAdmin || hasPermission(user, "maintenance", "create");
      const userHasHskCreate =
        isSysAdmin ||
        hasPermission(user, "housekeeping", "create") ||
        hasPermission(user, "housekeeping", "edit");

      const parsed = CreateMaintenanceBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.message });
        return;
      }

      const category = (req.body.category || parsed.data.category || "maintenance").toLowerCase();

      // التحقق من الصلاحية حسب فئة الطلب
      if (!isSysAdmin) {
        if (category === "housekeeping" && !userHasHskCreate) {
          res.status(403).json({ error: "Permission denied to create housekeeping orders" });
          return;
        }
        if (category === "maintenance" && !userHasMntCreate) {
          res.status(403).json({ error: "Permission denied to create maintenance orders" });
          return;
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

      const parentId = req.body.parentId ? parseInt(String(req.body.parentId)) : null;

      const { record, roomNumber } = await withTenant(propertyId, async (tenantDb) => {
        const inserted = await tenantDb
          .insert(maintenanceTable)
          .values({
            ...parsed.data,
            category,
            ...(parentId ? { parentId } : {}),
            status: "open",
          } as any)
          .returning();

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
          }
        }

        return { record: inserted[0], roomNumber: roomNum };
      });

      const s = session(req);
      const isHsk = category === "housekeeping";
      const actionTitle = isHsk
        ? (roomNumber ? `طلب نظافة للغرفة رقم ${roomNumber}: ${record.description || record.problemType}` : `طلب نظافة جديد: ${record.description || record.problemType}`)
        : (roomNumber ? `بلاغ صيانة في الغرفة رقم ${roomNumber}: ${record.description || record.problemType}` : `بلاغ صيانة جديد: ${record.description || record.problemType}`);

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
        broadcastToProperty(propertyId, { module: "housekeeping", action: "sync" });
      }

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
    ["housekeeping", "edit"],
    ["housekeeping", "assign"]
  ),
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
      const queryProp = req.body?.propertyId || req.query?.propertyId ? parseInt(String(req.body?.propertyId || req.query?.propertyId), 10) : 0;
      const targetPropList = queryProp ? accessibleProps.filter((p) => p.id === queryProp) : accessibleProps;

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

      // التحقق من الصلاحيات حسب الفئة
      const userHasMntEdit = isSysAdmin || hasPermission(user, "maintenance", "edit");
      const userHasHskEdit =
        isSysAdmin ||
        hasPermission(user, "housekeeping", "edit") ||
        hasPermission(user, "housekeeping", "assign");

      if (!isSysAdmin) {
        if (existingRecord.category === "housekeeping" && !userHasHskEdit) {
          res.status(403).json({ error: "Permission denied to edit housekeeping orders" });
          return;
        }
        if (existingRecord.category === "maintenance" && !userHasMntEdit) {
          res.status(403).json({ error: "Permission denied to edit maintenance orders" });
          return;
        }
      }

      // إزالة propertyId من حقول التحديث لتجنب أخطاء الجدول
      const updateData = { ...req.body };
      delete updateData.propertyId;

      const { updated, roomNumber } = await withTenant(targetPropertyId, async (tenantDb) => {
        const result = await tenantDb
          .update(maintenanceTable)
          .set(updateData as any)
          .where(eq(maintenanceTable.id, p.data.id))
          .returning();

        let roomNum: string | undefined;
        if (result[0]?.roomId) {
          const [rm] = await tenantDb
            .select({ roomNumber: roomsTable.roomNumber })
            .from(roomsTable)
            .where(eq(roomsTable.id, result[0].roomId))
            .limit(1);
          roomNum = rm?.roomNumber;
        }

        // معالجة تغيير حالة الغرفة إن كانت صيانة
        if (result[0]?.roomId && req.body.status && result[0].category === "maintenance") {
          const newStatus = req.body.status;
          if (newStatus === "resolved" || newStatus === "closed") {
            const [openTickets] = await tenantDb
              .select({ count: sql<number>`count(*)` })
              .from(maintenanceTable)
              .where(
                and(
                  eq(maintenanceTable.roomId, result[0].roomId),
                  or(eq(maintenanceTable.status, "open"), eq(maintenanceTable.status, "in_progress")),
                  eq(maintenanceTable.category, "maintenance")
                )
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
          } else if (newStatus === "open" || newStatus === "in_progress") {
            await tenantDb
              .update(roomsTable)
              .set({ status: "out_of_service" })
              .where(eq(roomsTable.id, result[0].roomId));
          }
        }

        return { updated: result[0], roomNumber: roomNum };
      });

      if (!updated) {
        res.status(404).json({ success: false, message: "البلاغ غير موجود" });
        return;
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
      broadcastToProperty(targetPropertyId, { module: "dashboard", action: "sync" });
      broadcastToProperty(targetPropertyId, { module: "rooms", action: "sync" });
      if (isHsk) {
        broadcastToProperty(targetPropertyId, { module: "housekeeping", action: "sync" });
      }

      return res.json(fmt({ ...updated, propertyId: targetPropertyId, roomNumber }));
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
    ["housekeeping", "delete"],
    ["housekeeping", "edit"]
  ),
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
      const queryProp = req.query?.propertyId ? parseInt(String(req.query.propertyId), 10) : 0;
      const targetPropList = queryProp ? accessibleProps.filter((p) => p.id === queryProp) : accessibleProps;

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
      const userHasMntDelete = isSysAdmin || hasPermission(user, "maintenance", "delete");
      const userHasHskDelete =
        isSysAdmin ||
        hasPermission(user, "housekeeping", "delete") ||
        hasPermission(user, "housekeeping", "edit");

      if (!isSysAdmin) {
        if (existingRecord.category === "housekeeping" && !userHasHskDelete) {
          res.status(403).json({ error: "Permission denied to delete housekeeping orders" });
          return;
        }
        if (existingRecord.category === "maintenance" && !userHasMntDelete) {
          res.status(403).json({ error: "Permission denied to delete maintenance orders" });
          return;
        }
      }

      const { row, roomNumber } = await withTenant(targetPropertyId, async (tenantDb) => {
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
      });

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
      broadcastToProperty(targetPropertyId, { module: "dashboard", action: "sync" });
      if (isHsk) {
        broadcastToProperty(targetPropertyId, { module: "housekeeping", action: "sync" });
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
  requireAnyPermission(
    ["maintenance", "view"],
    ["housekeeping", "view"]
  ),
  async (req, res, next) => {
    try {
      const user = (req as any).authUser;
      const parentId = parseInt(String(req.params.id), 10);
      if (isNaN(parentId)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }

      const accessibleProps = await getAccessibleProperties(user);
      const queryProp = req.query?.propertyId ? parseInt(String(req.query.propertyId), 10) : 0;
      const targetPropList = queryProp ? accessibleProps.filter((p) => p.id === queryProp) : accessibleProps;

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
              .orderBy(desc(maintenanceTable.reportedAt), desc(maintenanceTable.id));
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
    ["housekeeping", "edit"]
  ),
  async (req, res, next) => {
    try {
      const user = (req as any).authUser;
      const parentId = parseInt(String(req.params.id), 10);
      if (isNaN(parentId)) {
        res.status(400).json({ error: "Invalid parent ID" });
        return;
      }

      const accessibleProps = await getAccessibleProperties(user);
      const queryProp = req.body?.propertyId || req.query?.propertyId ? parseInt(String(req.body?.propertyId || req.query?.propertyId), 10) : 0;
      const targetPropList = queryProp ? accessibleProps.filter((p) => p.id === queryProp) : accessibleProps;

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
      let targetRoomId = roomId ? parseInt(String(roomId)) : parentRecord.roomId;

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

      broadcastToProperty(targetPropertyId, { module: "maintenance", action: "sync" });
      return res.status(201).json(fmt({ ...record, propertyId: targetPropertyId }));
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
