import { Router } from "express";
import { pool } from "@workspace/db";
import { logActivity } from "../lib/activity-logger.js";
import { broadcastToProperty } from "../lib/websocket.js";
import { logger } from "../lib/logger.js";
import { requirePermission } from "../middlewares/permissions.js";
import { z } from "zod/v4";

const router: Router = Router();

const APPROVAL_ROLES = ["housing_manager", "hr_manager", "accounts_manager"] as const;
const STEP_ROLES: Record<number, string> = { 1: "housing_manager", 2: "hr_manager", 3: "accounts_manager" };

const CreateFamilyVisitBody = z.object({
  hotelId: z.number().optional(),
  visitHotelId: z.number().optional(),
  clockNumber: z.string().optional(),
  numberOfRooms: z.number().int().min(1),
  assignedRoomId: z.number().int().optional(),
  familyMembersCount: z.number().int().min(1),
  familyMembersIncluded: z.string().optional(),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  consumedDays: z.number().int().min(1),
  remarks: z.string().optional(),
  attachmentData: z.string().optional(),
});

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().optional(),
  hotelId: z.coerce.number().optional(),
  search: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

const SignBody = z.object({
  comment: z.string().optional(),
});

const RejectBody = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

const RebackBody = z.object({
  reason: z.string().min(1, "Reback reason is required"),
});


function su(req: any) {
  const s = req.session ?? {};
  const a = req.authUser as any;
  return {
    userId: s.userId,
    propertyId: s.propertyId,
    propertyIds: a?.propertyIds ?? (s.propertyId ? [s.propertyId] : []),
    username: s.username,
    userRole: Array.isArray(s.userRole) ? s.userRole[0] : (s.userRole || ""),
    roles: s.userRole ? (Array.isArray(s.userRole) ? s.userRole : [s.userRole]) : [],
    jobTitle: s.jobTitle || "",
    isSystemAdmin: !!s.isSystemAdmin,
  };
}

function approvalRoleKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function userMatchesApprovalRole(user: ReturnType<typeof su>, requiredRole: string): boolean {
  const required = approvalRoleKey(requiredRole);
  if (!required) return false;

  // Check by job title first (normalized comparison)
  if (approvalRoleKey(user.jobTitle) === required) return true;

  // Also check by user roles array
  for (const role of user.roles) {
    if (approvalRoleKey(role) === required) return true;
  }

  return false;
}

async function hasAlreadyActedOnRequest(client: any, requestId: number, userId: number): Promise<boolean> {
  const existingAction = await client.query(
    `SELECT id
     FROM public.hosting_request_approval_steps
     WHERE request_id = $1
       AND signed_by_user_id = $2
       AND status IN ('signed', 'rejected', 'returned')
     LIMIT 1`,
    [requestId, userId],
  );
  return existingAction.rows.length > 0;
}

async function generateRequestNumber(client: any, propertyId: number): Promise<string> {
  const year = new Date().getFullYear();
  let code = "FV";
  
  if (propertyId) {
    const propRes = await client.query(
      "SELECT code FROM public.properties WHERE id = $1",
      [propertyId]
    );
    if (propRes.rows.length > 0 && propRes.rows[0].code) {
      code = propRes.rows[0].code.toUpperCase();
    }
  }

  const prefix = `${code}-${year}-`;

  // Use advisory lock keyed by property+year to prevent race condition
  // NOTE: Uses the transaction client so the lock is held until COMMIT
  const lockKey = (propertyId * 10000 + year) || year;
  await client.query("SELECT pg_advisory_xact_lock($1)", [lockKey]);

  const res = await client.query(
    "SELECT COUNT(*)::int AS cnt FROM public.hosting_requests WHERE request_number LIKE $1",
    [`${prefix}%`],
  );
  const seq = (res.rows[0]?.cnt ?? 0) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function getRequestWithSteps(requestId: number, propertyIds: number[], isSystemAdmin: boolean) {
  const requestRes = await pool.query(
    `SELECT fvr.*, p.display_name AS property_name,
      json_agg(
        json_build_object(
          'id', fas.id,
          'stepOrder', fas.step_order,
          'roleRequired', fas.role_required,
          'status', fas.status,
          'signedByUserId', fas.signed_by_user_id,
          'signedAt', fas.signed_at,
          'signatureImageUrlSnapshot', fas.signature_image_url_snapshot,
          'comment', fas.comment,
          'signerName', su.username,
          'signerJobTitle', su.job_title
        ) ORDER BY fas.step_order
      ) FILTER (WHERE fas.id IS NOT NULL) AS approval_steps
    FROM public.hosting_requests fvr
    LEFT JOIN public.properties p ON p.id = fvr.property_id
    LEFT JOIN public.hosting_request_approval_steps fas ON fas.request_id = fvr.id
    LEFT JOIN public.users su ON su.id = fas.signed_by_user_id
    WHERE fvr.id = $1
    GROUP BY fvr.id, p.display_name`,
    [requestId],
  );
  if (requestRes.rows.length === 0) return null;
  const row = requestRes.rows[0];
  if (!isSystemAdmin && !propertyIds.includes(row.property_id)) return null;

  const request = {
    id: row.id,
    propertyId: row.property_id,
    requestNumber: row.request_number,
    hotelId: row.hotel_id,
    visitHotelId: row.visit_hotel_id,
    employeeName: row.employee_name,
    clockNumber: row.clock_number,
    department: row.department,
    position: row.position,
    numberOfRooms: row.number_of_rooms,
    assignedRoomId: row.assigned_room_id,
    assignedRoomNumber: row.assigned_room_number || null,
    familyMembersCount: row.family_members_count,
    familyMembersIncluded: row.family_members_included,
    fromDate: row.from_date,
    toDate: row.to_date,
    consumedDays: row.consumed_days,
    remarks: row.remarks,
    status: row.status,
    currentStepOrder: row.current_step_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    propertyName: row.property_name,
    approvalSteps: row.approval_steps || [],
    guestHostingId: row.guest_hosting_id,
    attachmentData: row.attachment_data,
  };

  if (request.assignedRoomId) {
    try {
      const propRes = await pool.query("SELECT schema_name FROM public.properties WHERE id = $1", [row.property_id]);
      const schemaName = propRes.rows[0]?.schema_name || `prop_${row.property_id}`;
      const roomRes = await pool.query(`SELECT room_number FROM "${schemaName}".rooms WHERE id = $1`, [request.assignedRoomId]);
      if (roomRes.rows.length > 0) {
        request.assignedRoomNumber = roomRes.rows[0].room_number;
      }
    } catch (e) {
      console.error("Error fetching room number for family visit:", e);
    }
  }

  return request;
}

// POST /api/hosting-requests — Create
router.post("/hosting-requests", requirePermission("hosting_requests", "create"), async (req, res): Promise<void> => {
  const user = su(req);
  try {
    const parsed = CreateFamilyVisitBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues.map((e: any) => e.message).join(", "),
      });
      return;
    }

    const body = parsed.data;

    // Get requester info from DB (never trust client body for these)
    const userRes = await pool.query(
      "SELECT username, department, job_title FROM public.users WHERE id = $1",
      [user.userId],
    );
    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    const requester = userRes.rows[0];

    // Look up employee in tenant schema to get real name & clock number
    const propId = body.hotelId || user.propertyId;
    const requestedClock = body.clockNumber || requester.username;
    let employeeName = requestedClock;
    let clockNumber = requestedClock;
    try {
      const propRes = await pool.query(
        "SELECT schema_name FROM public.properties WHERE id = $1",
        [propId],
      );
      if (propRes.rows.length > 0) {
        const schemaName = propRes.rows[0].schema_name || `prop_${propId}`;
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName)) {
          const empRes = await pool.query(
            `SELECT first_name, last_name, employee_id, department, job_title FROM "${schemaName}".employees WHERE employee_id = $1 LIMIT 1`,
            [requestedClock],
          );
          if (empRes.rows.length > 0) {
            const emp = empRes.rows[0];
            employeeName = `${emp.first_name} ${emp.last_name}`;
            clockNumber = emp.employee_id;
            // Also override the requester department if it's the requested user's info
            if (body.clockNumber && body.clockNumber !== requester.username) {
              requester.department = emp.department || requester.department;
              requester.job_title = emp.job_title || requester.job_title;
            }
          }
        }
      }
    } catch {
      // If lookup fails, fall back to username
    }

    let requestId = -1;
    let requestNumber = "";
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      requestNumber = await generateRequestNumber(client, user.propertyId);
      const result = await client.query(
        `INSERT INTO public.hosting_requests
          (request_number, property_id, hotel_id, visit_hotel_id,
           requester_user_id, employee_name, clock_number, department, position,
           number_of_rooms, assigned_room_id, family_members_count, family_members_included,
           from_date, to_date, consumed_days, remarks, attachment_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING id`,
        [
          requestNumber, user.propertyId, body.hotelId ?? null, body.visitHotelId ?? null,
          user.userId, employeeName, clockNumber, requester.department ?? "", requester.job_title ?? "",
          body.numberOfRooms, body.assignedRoomId ?? null, body.familyMembersCount, body.familyMembersIncluded ?? null,
          body.fromDate, body.toDate, body.consumedDays, body.remarks ?? null, body.attachmentData ?? null,
        ],
      );
      requestId = result.rows[0].id;
      await client.query("COMMIT");
      client.release();
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
      if (err.code === "23505" && err.constraint === "hosting_requests_request_number_key") {
        res.status(409).json({ success: false, message: "رقم الطلب مكرر، يرجى المحاولة مرة أخرى / Duplicate request number, please try again" });
        return;
      }
      throw err;
    }

    // Create 3 approval steps
    for (let step = 1; step <= 3; step++) {
      await pool.query(
        `INSERT INTO public.hosting_request_approval_steps
          (request_id, step_order, role_required, status)
         VALUES ($1, $2, $3, 'pending')`,
        [requestId, step, STEP_ROLES[step]],
      );
    }

    await logActivity({
      req,
      propertyId: user.propertyId ?? 0,
      username: user.username,
      userId: user.userId,
      userRole: user.userRole,
      action: "HOSTING_REQUEST_CREATED",
      actionType: "CREATE",
      module: "hosting-requests",
      entityType: "hosting_request",
      entityId: requestId,
      details: `Created request ${requestNumber}`,
    });

    // Notify the first-step approver (housing_manager)
    const firstRole = STEP_ROLES[1];
    const firstRoleUsers = await pool.query(
      `SELECT id, username FROM public.users WHERE property_id = $1 AND (roles @> ARRAY[$2]::text[] OR LOWER(REPLACE(job_title, ' ', '_')) = $2)`,
      [user.propertyId, firstRole],
    );
    for (const row of firstRoleUsers.rows) {
      broadcastToProperty(user.propertyId, {
        type: "notification",
        module: "notifications",
        action: "created",
        data: {
          title: "New family visit request",
          message: `Request ${requestNumber} is waiting for your approval as ${firstRole}.`,
          titleAr: "طلب زيارة عائلية جديد",
          messageAr: `الطلب ${requestNumber} ينتظر موافقتك كـ ${firstRole}.`,
          entityId: requestId,
          targetUserId: row.id,
        },
      });
    }

    const created = await getRequestWithSteps(requestId, user.propertyIds, user.isSystemAdmin);
    res.status(201).json({ success: true, data: created });
  } catch (err: unknown) {
    console.error("ROUTE ERROR:", err); const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

// GET /api/hosting-requests — List with pagination & filters
router.get("/hosting-requests", requirePermission("hosting_requests", "view"), async (req, res): Promise<void> => {
  const user = su(req);
  try {
    const q = ListQuery.parse(req.query as any);

    const conditions: string[] = ["fvr.property_id = $" + (1)];
    const params: any[] = [user.propertyId];
    let paramIdx = 2;

    if (q.status && q.status !== "all") {
      conditions.push(`fvr.status = $${paramIdx++}`);
      params.push(q.status);
    }
    if (q.hotelId) {
      conditions.push(`(fvr.hotel_id = $${paramIdx} OR fvr.visit_hotel_id = $${paramIdx})`);
      paramIdx++;
      params.push(q.hotelId);
    }
    if (q.search) {
      conditions.push(`(fvr.employee_name ILIKE $${paramIdx} OR fvr.request_number ILIKE $${paramIdx} OR fvr.clock_number ILIKE $${paramIdx})`);
      paramIdx++;
      params.push(`%${q.search}%`);
    }
    if (q.fromDate) {
      conditions.push(`fvr.from_date >= $${paramIdx++}`);
      params.push(q.fromDate);
    }
    if (q.toDate) {
      conditions.push(`fvr.to_date <= $${paramIdx++}`);
      params.push(q.toDate);
    }

    const whereClause = conditions.join(" AND ");

    // Get total count
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM public.hosting_requests fvr WHERE ${whereClause}`,
      params,
    );
    const total = countRes.rows[0]?.total ?? 0;

    const offset = (q.page - 1) * q.limit;
    const rowsRes = await pool.query(
      `SELECT fvr.*,
        json_agg(
          json_build_object(
            'id', fas.id, 'stepOrder', fas.step_order, 'roleRequired', fas.role_required,
            'status', fas.status, 'signedByUserId', fas.signed_by_user_id,
            'signedAt', fas.signed_at, 'signatureImageUrlSnapshot', fas.signature_image_url_snapshot,
            'comment', fas.comment
          ) ORDER BY fas.step_order
        ) FILTER (WHERE fas.id IS NOT NULL) AS approval_steps
      FROM public.hosting_requests fvr
      LEFT JOIN public.hosting_request_approval_steps fas ON fas.request_id = fvr.id
      WHERE ${whereClause}
      GROUP BY fvr.id
      ORDER BY fvr.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, q.limit, offset],
    );

    const totalPages = Math.ceil(total / q.limit);
    
    // Compute pendingOn
    const mappedRows = rowsRes.rows.map((row) => {
      let pendingOn = null;
      if (row.status === "in_signing" && Array.isArray(row.approval_steps)) {
        const pendingStep = row.approval_steps.find((s: any) => s.status === "pending");
        if (pendingStep) {
          pendingOn = pendingStep.roleRequired;
        }
      }
      return { ...row, pendingOn };
    });

    res.json({
      success: true,
      data: mappedRows,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages,
        hasNextPage: q.page < totalPages,
        hasPrevPage: q.page > 1,
      },
    });
  } catch (err: unknown) {
    console.error("ROUTE ERROR:", err); const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

// GET /api/hosting-requests/counts — Status counts for tabs
router.get("/hosting-requests/counts", requirePermission("hosting_requests", "view"), async (req, res): Promise<void> => {
  const user = su(req);
  try {
    const res2 = await pool.query(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'in_signing')::int AS in_signing,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
      FROM public.hosting_requests
      WHERE property_id = $1`,
      [user.propertyId],
    );
    res.json({ success: true, data: res2.rows[0] });
  } catch (err: unknown) {
    console.error("ROUTE ERROR:", err); const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

// GET /api/hosting-requests/pending-my-signature
router.get("/hosting-requests/pending-my-signature", requirePermission("hosting_requests", "view"), async (req, res): Promise<void> => {
  const user = su(req);
  try {
    const rows = await pool.query(
      `SELECT fvr.id, fvr.request_number, fvr.employee_name, fvr.created_at,
        fas.step_order, fas.role_required
      FROM public.hosting_requests fvr
      JOIN public.hosting_request_approval_steps fas ON fas.request_id = fvr.id
        AND fas.step_order = fvr.current_step_order
        AND fas.status = 'pending'
      WHERE fvr.property_id = $1
        AND fvr.status = 'in_signing'
        AND (fas.role_required = ANY($2::text[]) OR fas.role_required = $3)
      ORDER BY fvr.created_at DESC`,
      [user.propertyId, user.roles, approvalRoleKey(user.jobTitle)],
    );
    res.json({ success: true, count: rows.rows.length, data: rows.rows });
  } catch (err: unknown) {
    console.error("ROUTE ERROR:", err); const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

// POST /api/hosting-requests/:id/create-guest-hosting — إنشاء طلب استضافة من زيارة عائلية
router.post("/hosting-requests/:id/create-guest-hosting", requirePermission("hosting_requests", "create"), async (req, res): Promise<void> => {
  const user = su(req);
  try {
    const requestId = parseInt(String(req.params.id));
    if (isNaN(requestId)) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }

    if (!user.propertyId) {
      res.status(400).json({ success: false, message: "No property selected" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Lock family visit request row (with property scoping)
      const lockRes = await client.query(
        `SELECT id, status, guest_hosting_id, employee_name, clock_number,
                family_members_count, from_date, to_date, remarks, property_id, assigned_room_id
         FROM public.hosting_requests
         WHERE id = $1 AND property_id = ANY($2::int[]) FOR UPDATE`,
        [requestId, user.propertyIds],
      );
      if (lockRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ success: false, message: "Request not found" });
        return;
      }

      const visit = lockRes.rows[0];

      if (visit.status !== "approved") {
        await client.query("ROLLBACK");
        res.status(400).json({
          success: false,
          message: "يجب الموافقة على طلب الزيارة أولاً / Request must be approved first",
        });
        return;
      }

      if (visit.guest_hosting_id) {
        await client.query("ROLLBACK");
        res.status(409).json({
          success: false,
          message: "تم إنشاء طلب استضافة مسبقاً / Guest hosting already created",
        });
        return;
      }

      // 2. Get tenant schema name
      const propRes = await client.query(
        "SELECT schema_name FROM public.properties WHERE id = $1",
        [visit.property_id],
      );
      if (propRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(500).json({ success: false, message: "Property not found" });
        return;
      }
      const schemaName = propRes.rows[0].schema_name || `prop_${visit.property_id}`;

      // Validate schemaName against safe pattern before use in dynamic SQL
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName)) {
        await client.query("ROLLBACK");
        res.status(500).json({ success: false, message: "Invalid tenant schema name" });
        return;
      }

      // 3. Set search_path to tenant schema
      await client.query("SET LOCAL search_path TO " + schemaName + ", public");

      // 4. Find employee by clock_number then by name
      let employeeId: number | null = null;
      const empByClock = await client.query(
        `SELECT id FROM "${schemaName}".employees WHERE employee_id = $1 LIMIT 1`,
        [visit.clock_number],
      );
      if (empByClock.rows.length > 0) {
        employeeId = empByClock.rows[0].id;
      } else {
        // Fallback by name — fail loudly if more than one match
        const empByName = await client.query(
          `SELECT id FROM "${schemaName}".employees 
           WHERE (first_name || ' ' || last_name) ILIKE $1`,
          [`%${visit.employee_name}%`],
        );
        if (empByName.rows.length === 1) {
          employeeId = empByName.rows[0].id;
        } else if (empByName.rows.length > 1) {
          await client.query("ROLLBACK");
          res.status(400).json({
            success: false,
            message: "توجد عدة موظفين بهذا الاسم. يرجى تأكيد الرقم الوظيفي / Multiple employees match this name. Please verify the clock number.",
          });
          return;
        }
      }

      if (!employeeId) {
        await client.query("ROLLBACK");
        res.status(404).json({
          success: false,
          message: "لم يتم العثور على الموظف في نظام السكن / Employee not found in housing system",
        });
        return;
      }

      // 5. Create hosting record (pre-approved since family visit was already approved)
      const hostingRes = await client.query(
        `INSERT INTO "${schemaName}".hostings
         (employee_id, hosting_type, guests_count, expected_from, expected_to, notes, created_by, status, room_id)
         VALUES ($1, 'SEPARATE_ROOM', $2, $3, $4, $5, $6, 'APPROVED', $7)
         RETURNING id`,
        [
          employeeId,
          visit.family_members_count,
          visit.from_date,
          visit.to_date,
          visit.remarks || "",
          user.username || String(user.userId),
          visit.assigned_room_id || null,
        ],
      );
      const hostingId = hostingRes.rows[0].id;

      // 6. Update family visit request with hosting ID
      await client.query(
        `UPDATE public.hosting_requests
         SET guest_hosting_id = $1, guest_hosting_status = 'APPROVED', updated_at = NOW()
         WHERE id = $2`,
        [hostingId, requestId],
      );

      await client.query("COMMIT");

      await logActivity({
        req,
        propertyId: user.propertyId ?? 0,
        username: user.username,
        userId: user.userId,
        userRole: user.userRole,
        module: "accommodation",
        action: `إنشاء طلب استضافة ضيوف للموظف #${visit.employee_name}`,
        entityType: "hosting",
        entityId: hostingId,
        details: `Created from hosting request #${requestId}`,
      });

      res.json({ success: true, data: { hostingId } });
    } catch (txErr: unknown) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    if (res.headersSent) return;
    console.error("ROUTE ERROR:", err); const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

// GET /api/hosting-requests/:id — Request detail
router.get("/hosting-requests/:id", requirePermission("hosting_requests", "view"), async (req, res): Promise<void> => {
  const user = su(req);
  try {
    const requestId = parseInt(String(req.params.id));
    if (isNaN(requestId)) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }

    const request = await getRequestWithSteps(requestId, user.propertyIds, user.isSystemAdmin);
    if (!request) {
      res.status(404).json({ success: false, message: "Request not found" });
      return;
    }

    res.json({ success: true, data: request });
  } catch (err: unknown) {
    console.error("ROUTE ERROR:", err); const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

// POST /api/hosting-requests/:id/sign — Sign current step
router.post("/hosting-requests/:id/sign", requirePermission("hosting_requests", "approve"), async (req, res): Promise<void> => {
  const user = su(req);
  try {
    const requestId = parseInt(String(req.params.id));
    if (isNaN(requestId)) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }

    const parsed = SignBody.safeParse(req.body);
    const comment = parsed.success ? parsed.data.comment : undefined;

    // Transaction with row lock
    const client = await pool.connect();
    let committed = false;
    let request;
    let stepOrder;
    let requiredRole;
    let nextStepOrder = null;
    try {
      await client.query("BEGIN");

      // Lock the request row
      let lockRes;
        if (user.isSystemAdmin) {
          lockRes = await client.query(
            "SELECT id, status, current_step_order, request_number FROM public.hosting_requests WHERE id = $1 FOR UPDATE",
            [requestId]
          );
        } else {
          lockRes = await client.query(
            "SELECT id, status, current_step_order, request_number FROM public.hosting_requests WHERE id = $1 AND property_id = ANY($2::int[]) FOR UPDATE",
            [requestId, user.propertyIds]
          );
        }
      if (lockRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ success: false, message: "Request not found" });
        return;
      }

      request = lockRes.rows[0];

      if (request.status !== "in_signing") {
        await client.query("ROLLBACK");
        res.status(400).json({ success: false, message: "Request is not in signing status" });
        return;
      }

      stepOrder = request.current_step_order;
      requiredRole = STEP_ROLES[stepOrder];

      const hasRole = user.isSystemAdmin || userMatchesApprovalRole(user, requiredRole);
      if (!hasRole) {
        logger.warn({ userId: user.userId, jobTitle: user.jobTitle, roles: user.roles, requiredRole }, "Permission denied for signing family visit request");
        await client.query("ROLLBACK");
        res.status(403).json({ success: false, message: `Only ${requiredRole} can sign this step` });
        return;
      }

      // Check user has a saved signature
      const sigRes = await client.query(
        "SELECT signature_image_url FROM public.user_signatures WHERE user_id = $1",
        [user.userId],
      );
      if (sigRes.rows.length === 0 || !sigRes.rows[0]?.signature_image_url) {
        await client.query("ROLLBACK");

        await logActivity({
          req,
          propertyId: user.propertyId ?? 0,
          username: user.username,
          userId: user.userId,
          userRole: user.userRole,
          action: "HOSTING_REQUEST_SIGN_FAILED_NO_SIGNATURE",
          actionType: "WARNING",
          module: "hosting-requests",
          entityType: "hosting_request",
          entityId: requestId,
          severity: "warning",
          details: `Sign attempt blocked: user has no saved signature for step ${stepOrder}`,
        });

        broadcastToProperty(user.propertyId, {
          type: "notification",
          module: "notifications",
          action: "created",
          data: {
            title: "Signature required",
            message: "You must upload your signature before signing this request.",
            titleAr: "مطلوب توقيع",
            messageAr: "يجب رفع توقيعك قبل توقيع هذا الطلب.",
            entityId: requestId,
          },
        });

        res.status(400).json({
          success: false,
          message: "Upload your signature in Settings before signing requests",
        });
        return;
      }
      const signatureUrl = sigRes.rows[0].signature_image_url;

      // Check step is pending (no double-sign)
      const stepRes = await client.query(
        "SELECT id, status FROM public.hosting_request_approval_steps WHERE request_id = $1 AND step_order = $2",
        [requestId, stepOrder],
      );
      if (stepRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(400).json({ success: false, message: "Approval step not found" });
        return;
      }
      if (stepRes.rows[0].status !== "pending") {
        await client.query("ROLLBACK");
        res.status(400).json({ success: false, message: "This step has already been signed" });
        return;
      }

      if (await hasAlreadyActedOnRequest(client, requestId, user.userId)) {
        await client.query("ROLLBACK");
        res.status(409).json({
          success: false,
          message: "This user has already approved a step for this request",
        });
        return;
      }

      // Mark step as signed
      await client.query(
        `UPDATE public.hosting_request_approval_steps
         SET status = 'signed', signed_by_user_id = $1, signed_at = NOW(),
             signature_image_url_snapshot = $2, comment = $3
         WHERE id = $4`,
        [user.userId, signatureUrl, comment ?? null, stepRes.rows[0].id],
      );

      if (stepOrder >= 3) {
        // Final step — mark request approved
        await client.query(
          "UPDATE public.hosting_requests SET status = 'approved', updated_at = NOW() WHERE id = $1",
          [requestId],
        );
      } else {
        // Move to next step
        nextStepOrder = stepOrder + 1;
        await client.query(
          "UPDATE public.hosting_requests SET current_step_order = $1, updated_at = NOW() WHERE id = $2",
          [nextStepOrder, requestId],
        );
      }

      await client.query("COMMIT");
      committed = true;
    } catch (txErr: unknown) {
      if (!committed) await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    // Post-commit operations
    await logActivity({
      req,
      propertyId: user.propertyId ?? 0,
      username: user.username,
      userId: user.userId,
      userRole: user.userRole,
      action: "HOSTING_REQUEST_SIGNED",
      actionType: "UPDATE",
      module: "hosting-requests",
      entityType: "hosting_request",
      entityId: requestId,
      severity: "info",
      details: `Step ${stepOrder} (${requiredRole}) signed with stored signature`,
    });

    // Notify clients to refresh accommodation data and show a notification
    broadcastToProperty(user.propertyId, { type: "data_updated", module: "accommodation", action: "updated" });
    broadcastToProperty(user.propertyId, {
      type: "notification",
      module: "notifications",
      action: "created",
      data: {
        title: "Family visit request updated",
        message: `Request ${request.request_number} signed by ${user.username}`,
        titleAr: "تم تحديث طلب الزيارة العائلية",
        messageAr: `تم توقيع الطلب ${request.request_number} بواسطة ${user.username}`,
        entityId: requestId,
      },
    });

    if (nextStepOrder) {
      const nextRole = STEP_ROLES[nextStepOrder];
      const nextRoleUsers = await pool.query(
      `SELECT id, username FROM public.users WHERE property_id = $1 AND (roles @> ARRAY[$2]::text[] OR LOWER(REPLACE(job_title, ' ', '_')) = $2)`,
      [user.propertyId, nextRole],
      );

      for (const row of nextRoleUsers.rows) {
        broadcastToProperty(user.propertyId, {
          type: "notification",
          module: "notifications",
          action: "created",
          data: {
            title: "Pending your signature",
            message: `Request ${request.request_number} is waiting for your approval as ${nextRole}.`,
            titleAr: "في انتظار توقيعك",
            messageAr: `الطلب ${request.request_number} ينتظر توقيعك كـ ${nextRole}.`,
            entityId: requestId,
            targetUserId: row.id,
          },
        });
      }
    }

    const updated = await getRequestWithSteps(requestId, user.propertyIds, user.isSystemAdmin);
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    console.error("ROUTE ERROR:", err); const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

// POST /api/hosting-requests/:id/reject — Reject request
router.post("/hosting-requests/:id/reject", requirePermission("hosting_requests", "approve"), async (req, res): Promise<void> => {
  const user = su(req);
  try {
    const requestId = parseInt(String(req.params.id));
    if (isNaN(requestId)) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }

    const parsed = RejectBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
      return;
    }

    const { reason } = parsed.data;

    const client = await pool.connect();
    let committed = false;
    let request;
    let stepOrder;
    let requiredRole;
    try {
      await client.query("BEGIN");

      let lockRes;
        if (user.isSystemAdmin) {
          lockRes = await client.query(
            "SELECT id, status, current_step_order FROM public.hosting_requests WHERE id = $1 FOR UPDATE",
            [requestId]
          );
        } else {
          lockRes = await client.query(
            "SELECT id, status, current_step_order FROM public.hosting_requests WHERE id = $1 AND property_id = ANY($2::int[]) FOR UPDATE",
            [requestId, user.propertyIds]
          );
        }
      if (lockRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ success: false, message: "Request not found" });
        return;
      }

      request = lockRes.rows[0];

      if (request.status !== "in_signing") {
        await client.query("ROLLBACK");
        res.status(400).json({ success: false, message: "Request is not in signing status" });
        return;
      }

      stepOrder = request.current_step_order;
      requiredRole = STEP_ROLES[stepOrder];

      const hasRole = user.isSystemAdmin || userMatchesApprovalRole(user, requiredRole);
      if (!hasRole) {
        await client.query("ROLLBACK");
        res.status(403).json({ success: false, message: `Only ${requiredRole} can reject this request` });
        return;
      }

      if (await hasAlreadyActedOnRequest(client, requestId, user.userId)) {
        await client.query("ROLLBACK");
        res.status(409).json({
          success: false,
          message: "This user has already acted on this request",
        });
        return;
      }

      // Update request status
      await client.query(
        `UPDATE public.hosting_requests
         SET status = 'rejected', rejected_at_step = $1, rejection_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [stepOrder, reason, requestId],
      );

      // Mark current step as rejected
      await client.query(
        `UPDATE public.hosting_request_approval_steps
         SET status = 'rejected', signed_by_user_id = $1, signed_at = NOW(), comment = $2
         WHERE request_id = $3 AND step_order = $4`,
        [user.userId, reason, requestId, stepOrder],
      );

      await client.query("COMMIT");
      committed = true;
    } catch (txErr: unknown) {
      if (!committed) await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    // Post-commit operations
    await logActivity({
      req,
      propertyId: user.propertyId ?? 0,
      username: user.username,
      userId: user.userId,
      userRole: user.userRole,
      action: "HOSTING_REQUEST_REJECTED",
      actionType: "UPDATE",
      module: "hosting-requests",
      entityType: "hosting_request",
      entityId: requestId,
      details: `Step ${stepOrder} (${requiredRole}) rejected: ${reason}`,
    });

    const updated = await getRequestWithSteps(requestId, user.propertyIds, user.isSystemAdmin);
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    console.error("ROUTE ERROR:", err); const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});


// POST /api/hosting-requests/:id/reback - Reback request
router.post("/hosting-requests/:id/reback", requirePermission("hosting_requests", "edit"), async (req, res): Promise<void> => {
  const user = su(req);
  try {
    const requestId = parseInt(String(req.params.id));
    if (isNaN(requestId)) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }

    const parsed = RebackBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Reback reason is required",
      });
      return;
    }

    const { reason } = parsed.data;

    const client = await pool.connect();
    let committed = false;
    let request;
    let stepOrder;
    let requiredRole;
    try {
      await client.query("BEGIN");

      let lockRes;
        if (user.isSystemAdmin) {
          lockRes = await client.query(
            "SELECT id, status, current_step_order FROM public.hosting_requests WHERE id = $1 FOR UPDATE",
            [requestId]
          );
        } else {
          lockRes = await client.query(
            "SELECT id, status, current_step_order FROM public.hosting_requests WHERE id = $1 AND property_id = ANY($2::int[]) FOR UPDATE",
            [requestId, user.propertyIds]
          );
        }
      if (lockRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ success: false, message: "Request not found" });
        return;
      }

      request = lockRes.rows[0];

      if (request.status !== "in_signing") {
        await client.query("ROLLBACK");
        res.status(400).json({ success: false, message: "Request is not in signing status" });
        return;
      }

      stepOrder = request.current_step_order;

      const stepRes = await client.query(
        "SELECT id, role_required FROM public.hosting_request_approval_steps WHERE request_id = $1 AND step_order = $2",
        [requestId, stepOrder],
      );
      if (stepRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(400).json({ success: false, message: "Current approval step not found" });
        return;
      }

      requiredRole = stepRes.rows[0].role_required;
      const hasRole = user.isSystemAdmin || userMatchesApprovalRole(user, requiredRole);
      if (!hasRole) {
        await client.query("ROLLBACK");
        res.status(403).json({ success: false, message: `Only ${requiredRole} can reback this request` });
        return;
      }

      if (await hasAlreadyActedOnRequest(client, requestId, user.userId)) {
        await client.query("ROLLBACK");
        res.status(409).json({
          success: false,
          message: "This user has already acted on this request",
        });
        return;
      }

      if (stepOrder > 1) {
        const prevStepOrder = stepOrder - 1;
        await client.query(
          `UPDATE public.hosting_requests
           SET current_step_order = $1, rejected_at_step = $2, rejection_reason = $3, updated_at = NOW()
           WHERE id = $4`,
          [prevStepOrder, stepOrder, reason, requestId],
        );

        await client.query(
          `UPDATE public.hosting_request_approval_steps
           SET status = 'pending', signed_by_user_id = NULL, signed_at = NULL, signature_image_url_snapshot = NULL, comment = NULL
           WHERE request_id = $1 AND step_order = $2`,
          [requestId, prevStepOrder],
        );
      } else {
        await client.query(
          `UPDATE public.hosting_requests
           SET status = 'returned', rejected_at_step = $1, rejection_reason = $2, updated_at = NOW()
           WHERE id = $3`,
          [stepOrder, reason, requestId],
        );

        await client.query(
          `UPDATE public.hosting_request_approval_steps
           SET status = 'returned', signed_by_user_id = $1, signed_at = NOW(), comment = $2
           WHERE request_id = $3 AND step_order = $4`,
          [user.userId, reason, requestId, stepOrder],
        );
      }

      await client.query("COMMIT");
      committed = true;
    } catch (txErr: unknown) {
      if (!committed) await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    // Post-commit operations
    await logActivity({
      req,
      propertyId: user.propertyId ?? 0,
      username: user.username,
      userId: user.userId,
      userRole: user.userRole,
      action: "HOSTING_REQUEST_REBACKED",
      actionType: "UPDATE",
      module: "hosting-requests",
      entityType: "hosting_request",
      entityId: requestId,
      details: `Step ${stepOrder} (${requiredRole}) rebacked: ${reason}`,
    });

    const updated = await getRequestWithSteps(requestId, user.propertyIds, user.isSystemAdmin);
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    console.error("ROUTE ERROR:", err); const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

// PUT /api/hosting-requests/:id - Edit request
router.put("/hosting-requests/:id", requirePermission("hosting_requests", "edit"), async (req, res): Promise<void> => {
  const user = su(req);
  try {
    const requestId = parseInt(String(req.params.id));
    if (isNaN(requestId)) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }

    const parsed = CreateFamilyVisitBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.issues.map((e: any) => e.message).join(", "),
      });
      return;
    }
    const body = parsed.data;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let lockRes;
        if (user.isSystemAdmin) {
          lockRes = await client.query(
            "SELECT id, status FROM public.hosting_requests WHERE id = $1 FOR UPDATE",
            [requestId]
          );
        } else {
          lockRes = await client.query(
            "SELECT id, status FROM public.hosting_requests WHERE id = $1 AND property_id = ANY($2::int[]) FOR UPDATE",
            [requestId, user.propertyIds]
          );
        }
        if (lockRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ success: false, message: "Request not found or access denied" });
        return;
      }
      
      const reqStatus = lockRes.rows[0]?.status;
      if (reqStatus !== "in_signing" && reqStatus !== "returned" && !user.isSystemAdmin) {
        await client.query("ROLLBACK");
        res.status(400).json({ success: false, message: "Cannot edit this request in its current status unless you are an admin" });
        return;
      }

      await client.query(
        `UPDATE public.hosting_requests
         SET
           number_of_rooms = $1,
           family_members_count = $2,
           from_date = $3,
           to_date = $4,
           consumed_days = $5,
           hotel_id = $6,
           visit_hotel_id = $7,
           family_members_included = $8,
           remarks = $9,
           updated_at = NOW()
         WHERE id = $10`,
        [
          body.numberOfRooms,
          body.familyMembersCount,
          body.fromDate,
          body.toDate,
          body.consumedDays,
          body.hotelId ?? null,
          body.visitHotelId ?? null,
          body.familyMembersIncluded ?? null,
          body.remarks ?? null,
          requestId
        ]
      );

      await client.query("COMMIT");

      await logActivity({
        req,
        propertyId: user.propertyId ?? 0,
        username: user.username,
        userId: user.userId,
        userRole: user.userRole,
        action: "HOSTING_REQUEST_EDITED",
        actionType: "UPDATE",
        module: "accommodation",
        entityType: "hosting_request",
        entityId: requestId,
        details: "Edited hosting request",
      });

      broadcastToProperty(user.propertyId, { type: "data_updated", module: "accommodation", action: "updated" });

      res.json({ success: true, message: "Request updated successfully" });
    } catch (txErr: unknown) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    console.error("ROUTE ERROR:", err); const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

// DELETE /api/hosting-requests/:id - Delete request
router.delete("/hosting-requests/:id", requirePermission("hosting_requests", "delete"), async (req, res): Promise<void> => {
  const user = su(req);
  try {
    const requestId = parseInt(String(req.params.id));
    if (isNaN(requestId)) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let checkRes;
      if (user.isSystemAdmin) {
        checkRes = await client.query(
          "SELECT id FROM public.hosting_requests WHERE id = $1 FOR UPDATE",
          [requestId]
        );
      } else {
        checkRes = await client.query(
          "SELECT id FROM public.hosting_requests WHERE id = $1 AND property_id = ANY($2::int[]) FOR UPDATE",
          [requestId, user.propertyIds]
        );
      }
        if (checkRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ success: false, message: "Request not found or access denied" });
        return;
      }

      await client.query("DELETE FROM public.hosting_request_approval_steps WHERE request_id = $1", [requestId]);
      await client.query("DELETE FROM public.hosting_requests WHERE id = $1", [requestId]);

      await client.query("COMMIT");

      await logActivity({
        req,
        propertyId: user.propertyId ?? 0,
        username: user.username,
        userId: user.userId,
        userRole: user.userRole,
        action: "HOSTING_REQUEST_DELETED",
        actionType: "DELETE",
        module: "accommodation",
        entityType: "hosting_request",
        entityId: requestId,
        details: "Deleted hosting request",
      });

      broadcastToProperty(user.propertyId, { type: "data_updated", module: "accommodation", action: "deleted" });

      res.json({ success: true, message: "Request deleted successfully" });
    } catch (txErr: unknown) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    console.error("ROUTE ERROR:", err); const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

export default router;
