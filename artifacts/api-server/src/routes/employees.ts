import { Router } from "express";
import {
  db,
  pool,
  withTenant,
  employeesTable, assignmentsTable, roomsTable, buildingsTable, floorsTable,
  propertiesTable,
} from "@workspace/db";
import { eq, and, or, ilike, sql, SQL } from "drizzle-orm";
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
  GetEmployeeParams,
  UpdateEmployeeParams,
  DeleteEmployeeParams,
  ListEmployeesQueryParams,
  ListEmployeesResponse,
  GetEmployeeResponse,
  UpdateEmployeeResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import {
  requirePermission,
  hasPermission,
} from "../middlewares/permissions.js";
import {
  ensureEmployeePortalAccount,
  moveOrEnsureEmployeePortalAccount,
} from "../lib/portal-accounts.js";
import { getTenantId, su } from "../lib/request-utils.js";

const router: Router = Router();
const MAX_EMPLOYEE_LIST_ROWS = Number(
  process.env["API_MAX_EMPLOYEE_LIST_ROWS"] ?? 2000,
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
    authUser && hasPermission(authUser, "employees", "view_sensitive");
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
  process.env["EMPLOYEE_PHOTO_MAX_DATA_LENGTH"] ?? 3 * 1024 * 1024,
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
  "/employees",
  requirePermission("employees", "view"),
  async (req, res) => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const query = ListEmployeesQueryParams.safeParse(req.query);
    const conditions: SQL[] = [];
    
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const offset = (page - 1) * limit;

    if (query.success) {
      if (query.data.search) {
        conditions.push(
          or(
            ilike(employeesTable.firstName, `%${query.data.search}%`),
            ilike(employeesTable.lastName, `%${query.data.search}%`),
            ilike(employeesTable.employeeId, `%${query.data.search}%`)
          ) as SQL
        );
      }
      if (query.data.status) conditions.push(eq(employeesTable.status, query.data.status));
      if (query.data.department) conditions.push(eq(employeesTable.department, query.data.department));
    }

    const { employees, total } = await withTenant(propertyId, async (tenantDb) => {
      let countQuery = tenantDb.select({ count: sql<number>`count(*)` }).from(employeesTable) as any;
      if (conditions.length > 0) countQuery = countQuery.where(and(...conditions));
      const countResult = await countQuery;
      const totalCount = Number(countResult[0]?.count ?? 0);

      let baseQuery = tenantDb.select().from(employeesTable).limit(limit).offset(offset) as any;
      if (conditions.length > 0) baseQuery = baseQuery.where(and(...conditions));
      
      const rows = await baseQuery;
      return { employees: rows, total: totalCount };
    });

    res.json({
      data: filterSensitive(
        employees.map((e: any) => ({ ...e, propertyId })),
        req,
      ) as any[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  },
);

/* Cross-property employee search (خاص بـ SYSTEM_ADMIN) */
router.get(
  "/employees/search",
  requirePermission("employees", "view"),
  async (req, res): Promise<void> => {
    const { q = "", propertyId } = req.query as Record<string, string>;
    const conditions: SQL[] = [];

    if (q.trim().length >= 1) {
      const term = `%${q.trim()}%`;
      conditions.push(
        or(
          ilike(employeesTable.firstName, term),
          ilike(employeesTable.lastName, term),
          ilike(employeesTable.employeeId, term),
          ilike(employeesTable.nationalId, term),
          ilike(employeesTable.department, term),
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
          employee: employeesTable,
          accommodationRoom: roomsTable.roomNumber,
          accommodationRoomType: roomsTable.roomType,
          accommodationBuilding: buildingsTable.name,
          accommodationFloor: floorsTable.floorNumber,
        })
        .from(employeesTable)
        .leftJoin(assignmentsTable, and(eq(assignmentsTable.employeeId, employeesTable.id), eq(assignmentsTable.status, 'ACTIVE')))
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
        .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
        .where(and(...conditions))
        .limit(30);
        
      return queryResult.map(r => ({
        ...r.employee,
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

router.post(
  "/employees",
  requirePermission("employees", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const parsed = CreateEmployeeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // ── Prevent duplicate employee ID or national ID ─────────────────────
    const existingEmp = await withTenant(propertyId, async (tenantDb) => {
      const conditions = [];
      if (parsed.data.employeeId)
        conditions.push(eq(employeesTable.employeeId, parsed.data.employeeId));
      if (parsed.data.nationalId)
        conditions.push(eq(employeesTable.nationalId, parsed.data.nationalId));
      if (conditions.length === 0) return [];
      return await tenantDb
        .select({
          id: employeesTable.id,
          employeeId: employeesTable.employeeId,
          nationalId: employeesTable.nationalId,
        })
        .from(employeesTable)
        .where(or(...conditions));
    });
    if (existingEmp.length > 0) {
      const existing = existingEmp[0];
      let reason = "Employee already exists";
      if (existing.employeeId === parsed.data.employeeId)
        reason = `Employee ID ${parsed.data.employeeId} already exists`;
      else if (existing.nationalId === parsed.data.nationalId)
        reason = `National ID ${parsed.data.nationalId} already exists`;
      res.status(409).json({ error: reason, code: "EMPLOYEE_DUPLICATE" });
      return;
    }

    // ✅ الإضافة في الـ Schema الصحيح
    const [employee] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .insert(employeesTable)
        .values(parsed.data as any)
        .returning();
    });
    await ensureEmployeePortalAccount(propertyId, employee.employeeId);

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `إضافة موظف جديد: ${employee.firstName} ${employee.lastName}`,
      actionType: "CREATE",
      module: "employees",
      entityType: "employee",
      entityId: employee.id,
      details: `ID: ${employee.employeeId}, Dept: ${employee.department}`,
    });
    res
      .status(201)
      .json(GetEmployeeResponse.parse({ ...employee, propertyId }));
  },
);

router.get(
  "/employees/:id",
  requirePermission("employees", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = GetEmployeeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [employee] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.id, params.data.id));
    });

    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    const photoRows = await withTenant(propertyId, async (tenantDb) => {
      const [row] = await tenantDb
        .select({ photoUrl: employeesTable.photoUrl })
        .from(employeesTable)
        .where(eq(employeesTable.id, params.data.id))
        .limit(1);
      return row;
    });

    const parsed = {
      ...GetEmployeeResponse.parse({ ...employee, propertyId }),
      photoUrl: photoRows?.photoUrl ?? null,
    };
    res.json(filterSensitive(parsed, req));
  },
);

router.patch(
  "/employees/:id",
  requirePermission("employees", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = UpdateEmployeeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateEmployeeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // ── Prevent duplicate employee ID or national ID on update ─────────────
    const body = parsed.data as Record<string, any>;
    if (body.employeeId || body.nationalId) {
      const existingEmp = await withTenant(propertyId, async (tenantDb) => {
        const conditions = [];
        if (body.employeeId)
          conditions.push(eq(employeesTable.employeeId, body.employeeId));
        if (body.nationalId)
          conditions.push(eq(employeesTable.nationalId, body.nationalId));
        return await tenantDb
          .select({
            id: employeesTable.id,
            employeeId: employeesTable.employeeId,
            nationalId: employeesTable.nationalId,
          })
          .from(employeesTable)
          .where(or(...conditions));
      });

      const conflict = existingEmp.find((e) => e.id !== params.data.id);
      if (conflict) {
        let reason = "Employee already exists";
        if (conflict.employeeId === body.employeeId)
          reason = `Employee ID ${body.employeeId} already exists`;
        else if (conflict.nationalId === body.nationalId)
          reason = `National ID ${body.nationalId} already exists`;
        res.status(409).json({ error: reason, code: "EMPLOYEE_DUPLICATE" });
        return;
      }
    }

    const { previous, updated } = await withTenant(
      propertyId,
      async (tenantDb) => {
        const [existing] = await tenantDb
          .select()
          .from(employeesTable)
          .where(eq(employeesTable.id, params.data.id))
          .limit(1);
        if (!existing) return { previous: null, updated: null };
        const [updatedEmployee] = await tenantDb
          .update(employeesTable)
          .set(parsed.data as any)
          .where(eq(employeesTable.id, params.data.id))
          .returning();
        return { previous: existing, updated: updatedEmployee };
      },
    );

    if (!updated) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    await moveOrEnsureEmployeePortalAccount(
      propertyId,
      previous?.employeeId,
      updated.employeeId,
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
      module: "employees",
      entityType: "employee",
      entityId: updated.id,
    });
    res.json(UpdateEmployeeResponse.parse({ ...updated, propertyId }));
  },
);

router.delete(
  "/employees/:id",
  requirePermission("employees", "delete"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = DeleteEmployeeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const existing = await withTenant(propertyId, async (tenantDb) => {
      const [emp] = await tenantDb
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.id, params.data.id));
      if (emp)
        await tenantDb
          .delete(employeesTable)
          .where(eq(employeesTable.id, params.data.id));
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
        action: `حذف الموظف: ${existing.firstName} ${existing.lastName} (${existing.employeeId})`,
        actionType: "DELETE",
        module: "employees",
        entityType: "employee",
        entityId: existing.id,
        severity: "warning",
        details: `Dept: ${existing.department}`,
      });
    }
    res.sendStatus(204);
  },
);

router.patch(
  "/employees/:id/photo",
  requirePermission("employees", "edit"),
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
        .update(employeesTable)
        .set({ photoUrl: photoUrl ?? null })
        .where(eq(employeesTable.id, id));
      const [empData] = await tenantDb
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.id, id));
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
        module: "employees",
        entityType: "employee",
        entityId: emp.id,
      });
    }
    res.json({ success: true });
  },
);

router.get(
  "/employees/:id/photo",
  requirePermission("employees", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const id = Number(req.params.id);
    const row = await withTenant(propertyId, async (tenantDb) => {
      const [r] = await tenantDb
        .select({ photoUrl: employeesTable.photoUrl })
        .from(employeesTable)
        .where(eq(employeesTable.id, id))
        .limit(1);
      return r;
    });

    res.json({ photoUrl: row?.photoUrl ?? null });
  },
);

export default router;
