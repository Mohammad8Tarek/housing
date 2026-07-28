# Source Bundle

Generated: 2026-07-21 16:46:10
Files included: 110

================================================================================
FILE: artifacts/api-server/src/routes/family-visit.ts
================================================================================

import { Router } from "express";
import { pool } from "@workspace/db";
import { logActivity } from "../lib/activity-logger.js";
import { broadcastToProperty } from "../lib/websocket.js";
import { logger } from "../lib/logger.js";
import { hasPermission, requirePermission } from "../middlewares/permissions.js";
import { z } from "zod/v4";

const router: Router = Router();

const APPROVAL_ROLES = ["housing_manager", "hr_manager", "accounts_manager"] as const;
const STEP_ROLES: Record<number, string> = { 1: "housing_manager", 2: "hr_manager", 3: "accounts_manager" };

const CreateFamilyVisitBody = z.object({
hotelId: z.number().optional(),
visitHotelId: z.number().optional(),
numberOfRooms: z.number().int().min(1),
familyMembersCount: z.number().int().min(1),
familyMembersIncluded: z.string().optional(),
fromDate: z.string().min(1),
toDate: z.string().min(1),
consumedDays: z.number().int().min(1),
remarks: z.string().optional(),
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
return {
userId: s.userId,
propertyId: s.propertyId,
username: s.username,
userRole: Array.isArray(s.userRole) ? s.userRole[0] : (s.userRole || ""),
roles: s.userRole ? (Array.isArray(s.userRole) ? s.userRole : [s.userRole]) : [],
jobTitle: s.jobTitle || "",
isSystemAdmin: !!s.isSystemAdmin,
};
}

async function generateRequestNumber(propertyId: number): Promise<string> {
const year = new Date().getFullYear();
let code = "FV";

if (propertyId) {
const propRes = await pool.query(
"SELECT code FROM public.properties WHERE id = $1",
[propertyId]
);
if (propRes.rows.length > 0 && propRes.rows[0].code) {
code = propRes.rows[0].code.toUpperCase();
}
}

const prefix = `${code}-${year}-`;
const res = await pool.query(
"SELECT COUNT(\*)::int AS cnt FROM public.family_visit_requests WHERE request_number LIKE $1",
    [`${prefix}%`],
  );
  const seq = (res.rows[0]?.cnt ?? 0) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function getRequestWithSteps(requestId: number, propertyId: number, isSystemAdmin: boolean) {
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
    FROM public.family_visit_requests fvr
    LEFT JOIN public.properties p ON p.id = fvr.property_id
    LEFT JOIN public.family_visit_approval_steps fas ON fas.request_id = fvr.id
    LEFT JOIN public.users su ON su.id = fas.signed_by_user_id
    WHERE fvr.id = $1
    GROUP BY fvr.id, p.display_name`,
[requestId],
);
if (requestRes.rows.length === 0) return null;
const request = requestRes.rows[0];
if (!isSystemAdmin && request.property_id !== propertyId) return null;
return request;
}

// POST /api/family-visit — Create
router.post("/family-visit", requirePermission("hosting_requests", "create"), async (req, res): Promise<void> => {
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

    const requestNumber = await generateRequestNumber(user.propertyId);

    const result = await pool.query(
      `INSERT INTO public.family_visit_requests
        (request_number, property_id, hotel_id, visit_hotel_id,
         requester_user_id, employee_name, clock_number, department, position,
         number_of_rooms, family_members_count, family_members_included,
         from_date, to_date, consumed_days, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [
        requestNumber, user.propertyId, body.hotelId ?? null, body.visitHotelId ?? null,
        user.userId, requester.username, requester.username, requester.department ?? "", requester.job_title ?? "",
        body.numberOfRooms, body.familyMembersCount, body.familyMembersIncluded ?? null,
        body.fromDate, body.toDate, body.consumedDays, body.remarks ?? null,
      ],
    );

    const requestId = result.rows[0].id;

    // Create 3 approval steps
    for (let step = 1; step <= 3; step++) {
      await pool.query(
        `INSERT INTO public.family_visit_approval_steps
          (request_id, step_order, role_required, status)
         VALUES ($1, $2, $3, 'pending')`,
        [requestId, step, STEP_ROLES[step]],
      );
    }

    logActivity({
      req,
      propertyId: user.propertyId ?? 0,
      username: user.username,
      userId: user.userId,
      userRole: user.userRole,
      action: "FAMILY_VISIT_CREATED",
      actionType: "CREATE",
      module: "family-visit",
      entityType: "family_visit_request",
      entityId: requestId,
      details: `Created request ${requestNumber}`,
    });

    const created = await getRequestWithSteps(requestId, user.propertyId, user.isSystemAdmin);
    res.status(201).json({ success: true, data: created });

} catch (err: unknown) {
const message = err instanceof Error ? err.message : String(err);
res.status(500).json({ success: false, message });
}
});

// GET /api/family-visit — List with pagination & filters
router.get("/family-visit", requirePermission("hosting_requests", "view"), async (req, res): Promise<void> => {
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
      `SELECT COUNT(*)::int AS total FROM public.family_visit_requests fvr WHERE ${whereClause}`,
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
      FROM public.family_visit_requests fvr
      LEFT JOIN public.family_visit_approval_steps fas ON fas.request_id = fvr.id
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
const message = err instanceof Error ? err.message : String(err);
res.status(500).json({ success: false, message });
}
});

// GET /api/family-visit/counts — Status counts for tabs
router.get("/family-visit/counts", requirePermission("hosting_requests", "view"), async (req, res): Promise<void> => {
const user = su(req);
try {
const res2 = await pool.query(
`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'in_signing')::int AS in_signing,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
      FROM public.family_visit_requests
      WHERE property_id = $1`,
[user.propertyId],
);
res.json({ success: true, data: res2.rows[0] });
} catch (err: unknown) {
const message = err instanceof Error ? err.message : String(err);
res.status(500).json({ success: false, message });
}
});

// GET /api/family-visit/pending-my-signature
router.get("/family-visit/pending-my-signature", requirePermission("hosting_requests", "view"), async (req, res): Promise<void> => {
const user = su(req);
try {
const rows = await pool.query(
`SELECT fvr.id, fvr.request_number, fvr.employee_name, fvr.created_at,
        fas.step_order, fas.role_required
      FROM public.family_visit_requests fvr
      JOIN public.family_visit_approval_steps fas ON fas.request_id = fvr.id
        AND fas.step_order = fvr.current_step_order
        AND fas.status = 'pending'
      WHERE fvr.property_id = $1
        AND fvr.status = 'in_signing'
        AND fas.role_required = ANY($2::text[])
      ORDER BY fvr.created_at DESC`,
[user.propertyId, user.roles],
);
res.json({ success: true, count: rows.rows.length, data: rows.rows });
} catch (err: unknown) {
const message = err instanceof Error ? err.message : String(err);
res.status(500).json({ success: false, message });
}
});

// POST /api/family-visit/:id/create-guest-hosting — إنشاء طلب استضافة من زيارة عائلية
router.post("/family-visit/:id/create-guest-hosting", requirePermission("hosting_requests", "create"), async (req, res): Promise<void> => {
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

      // 1. Lock family visit request row
      const lockRes = await client.query(
        `SELECT id, status, guest_hosting_id, employee_name, clock_number,
                family_members_count, from_date, to_date, remarks, property_id
         FROM public.family_visit_requests
         WHERE id = $1 FOR UPDATE`,
        [requestId],
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
        const empByName = await client.query(
          `SELECT id FROM "${schemaName}".employees
           WHERE (first_name || ' ' || last_name) ILIKE $1 LIMIT 1`,
          [`%${visit.employee_name}%`],
        );
        if (empByName.rows.length > 0) {
          employeeId = empByName.rows[0].id;
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

      // 5. Create hosting record
      const hostingRes = await client.query(
        `INSERT INTO "${schemaName}".hostings
         (employee_id, hosting_type, guests_count, expected_from, expected_to, notes, created_by, status)
         VALUES ($1, 'SEPARATE_ROOM', $2, $3, $4, $5, $6, 'PENDING')
         RETURNING id`,
        [
          employeeId,
          visit.family_members_count,
          visit.from_date,
          visit.to_date,
          visit.remarks || "",
          user.username || String(user.userId),
        ],
      );
      const hostingId = hostingRes.rows[0].id;

      // 6. Update family visit request with hosting ID
      await client.query(
        `UPDATE public.family_visit_requests
         SET guest_hosting_id = $1, guest_hosting_status = 'PENDING', updated_at = NOW()
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
const message = err instanceof Error ? err.message : String(err);
res.status(500).json({ success: false, message });
}
});

// GET /api/family-visit/:id — Request detail
router.get("/family-visit/:id", requirePermission("hosting_requests", "view"), async (req, res): Promise<void> => {
const user = su(req);
try {
const requestId = parseInt(String(req.params.id));
if (isNaN(requestId)) {
res.status(400).json({ success: false, message: "Invalid ID" });
return;
}

    const request = await getRequestWithSteps(requestId, user.propertyId, user.isSystemAdmin);
    if (!request) {
      res.status(404).json({ success: false, message: "Request not found" });
      return;
    }

    res.json({ success: true, data: request });

} catch (err: unknown) {
const message = err instanceof Error ? err.message : String(err);
res.status(500).json({ success: false, message });
}
});

// POST /api/family-visit/:id/sign — Sign current step
router.post("/family-visit/:id/sign", requirePermission("hosting_requests", "approve"), async (req, res): Promise<void> => {
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
    try {
      await client.query("BEGIN");

      // Lock the request row
      const lockRes = await client.query(
        "SELECT id, status, current_step_order FROM public.family_visit_requests WHERE id = $1 FOR UPDATE",
        [requestId],
      );
      if (lockRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ success: false, message: "Request not found" });
        return;
      }

      const request = lockRes.rows[0];

      if (request.status !== "in_signing") {
        await client.query("ROLLBACK");
        res.status(400).json({ success: false, message: "Request is not in signing status" });
        return;
      }

      const stepOrder = request.current_step_order;
      const requiredRole = STEP_ROLES[stepOrder];

      // Check user has the required role or is system admin or explicit 'approve' permission
      const hasRole = user.jobTitle === requiredRole || user.roles.includes(requiredRole);
      const authUser = (req as any).authUser;
      const canApproveByPermission = authUser ? hasPermission(authUser, "hosting_requests", "approve") : false;
      if (!hasRole && !user.isSystemAdmin && !canApproveByPermission) {
        // Log a helpful debug message to help identify mis-configured roles
        logger.warn({ userId: user.userId, jobTitle: user.jobTitle, roles: user.roles, requiredRole, canApproveByPermission }, "Permission denied for signing family visit request");
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

        logActivity({
          req,
          propertyId: user.propertyId ?? 0,
          username: user.username,
          userId: user.userId,
          userRole: user.userRole,
          action: "FAMILY_VISIT_SIGN_FAILED_NO_SIGNATURE",
          actionType: "WARNING",
          module: "family-visit",
          entityType: "family_visit_request",
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
        "SELECT id, status FROM public.family_visit_approval_steps WHERE request_id = $1 AND step_order = $2",
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

      // Mark step as signed
      await client.query(
        `UPDATE public.family_visit_approval_steps
         SET status = 'signed', signed_by_user_id = $1, signed_at = NOW(),
             signature_image_url_snapshot = $2, comment = $3
         WHERE id = $4`,
        [user.userId, signatureUrl, comment ?? null, stepRes.rows[0].id],
      );

      let nextStepOrder: number | null = null;
      if (stepOrder >= 3) {
        // Final step — mark request approved
        await client.query(
          "UPDATE public.family_visit_requests SET status = 'approved', updated_at = NOW() WHERE id = $1",
          [requestId],
        );
      } else {
        // Move to next step
        nextStepOrder = stepOrder + 1;
        await client.query(
          "UPDATE public.family_visit_requests SET current_step_order = $1, updated_at = NOW() WHERE id = $2",
          [nextStepOrder, requestId],
        );
      }

      await client.query("COMMIT");

      logActivity({
        req,
        propertyId: user.propertyId ?? 0,
        username: user.username,
        userId: user.userId,
        userRole: user.userRole,
        action: "FAMILY_VISIT_SIGNED",
        actionType: "UPDATE",
        module: "family-visit",
        entityType: "family_visit_request",
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
          `SELECT id, username FROM public.users WHERE property_id = $1 AND COALESCE(ARRAY(SELECT unnest(roles) WHERE unnest IS NOT NULL), ARRAY[]::text[]) @> ARRAY[$2]::text[]`,
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

      const updated = await getRequestWithSteps(requestId, user.propertyId, user.isSystemAdmin);
      res.json({ success: true, data: updated });
    } catch (txErr: unknown) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

} catch (err: unknown) {
const message = err instanceof Error ? err.message : String(err);
res.status(500).json({ success: false, message });
}
});

// POST /api/family-visit/:id/reject — Reject request
router.post("/family-visit/:id/reject", requirePermission("hosting_requests", "approve"), async (req, res): Promise<void> => {
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
    try {
      await client.query("BEGIN");

      const lockRes = await client.query(
        "SELECT id, status, current_step_order FROM public.family_visit_requests WHERE id = $1 FOR UPDATE",
        [requestId],
      );
      if (lockRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ success: false, message: "Request not found" });
        return;
      }

      const request = lockRes.rows[0];

      if (request.status !== "in_signing") {
        await client.query("ROLLBACK");
        res.status(400).json({ success: false, message: "Request is not in signing status" });
        return;
      }

      const stepOrder = request.current_step_order;
      const requiredRole = STEP_ROLES[stepOrder];

      const hasRole = user.jobTitle === requiredRole || user.roles.includes(requiredRole);
      if (!hasRole && !user.isSystemAdmin) {
        await client.query("ROLLBACK");
        res.status(403).json({ success: false, message: `Only ${requiredRole} can reject this request` });
        return;
      }

      // Update request status
      await client.query(
        `UPDATE public.family_visit_requests
         SET status = 'rejected', rejected_at_step = $1, rejection_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [stepOrder, reason, requestId],
      );

      // Mark current step as rejected
      await client.query(
        `UPDATE public.family_visit_approval_steps
         SET status = 'rejected', signed_by_user_id = $1, signed_at = NOW(), comment = $2
         WHERE request_id = $3 AND step_order = $4`,
        [user.userId, reason, requestId, stepOrder],
      );

      await client.query("COMMIT");

      logActivity({
        req,
        propertyId: user.propertyId ?? 0,
        username: user.username,
        userId: user.userId,
        userRole: user.userRole,
        action: "FAMILY_VISIT_REJECTED",
        actionType: "UPDATE",
        module: "family-visit",
        entityType: "family_visit_request",
        entityId: requestId,
        details: `Step ${stepOrder} (${requiredRole}) rejected: ${reason}`,
      });

      const updated = await getRequestWithSteps(requestId, user.propertyId, user.isSystemAdmin);
      res.json({ success: true, data: updated });
    } catch (txErr: unknown) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

} catch (err: unknown) {
const message = err instanceof Error ? err.message : String(err);
res.status(500).json({ success: false, message });
}
});

// POST /api/family-visit/:id/reback - Reback request
router.post("/family-visit/:id/reback", requirePermission("hosting_requests", "edit"), async (req, res): Promise<void> => {
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
    try {
      await client.query("BEGIN");

      const lockRes = await client.query(
        "SELECT id, status, current_step_order FROM public.family_visit_requests WHERE id = $1 FOR UPDATE",
        [requestId],
      );
      if (lockRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ success: false, message: "Request not found" });
        return;
      }

      const request = lockRes.rows[0];

      if (request.status !== "in_signing") {
        await client.query("ROLLBACK");
        res.status(400).json({ success: false, message: "Request is not in signing status" });
        return;
      }

      const stepOrder = request.current_step_order;

      const stepRes = await client.query(
        "SELECT id, role_required FROM public.family_visit_approval_steps WHERE request_id = $1 AND step_order = $2",
        [requestId, stepOrder],
      );
      if (stepRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(400).json({ success: false, message: "Current approval step not found" });
        return;
      }

      const requiredRole = stepRes.rows[0].role_required;
      const hasRole = user.jobTitle === requiredRole || user.roles.includes(requiredRole);
      if (!hasRole && !user.isSystemAdmin) {
        await client.query("ROLLBACK");
        res.status(403).json({ success: false, message: `Only ${requiredRole} can reback this request` });
        return;
      }

      // Update request status to returned
      await client.query(
        `UPDATE public.family_visit_requests
         SET status = 'returned', rejected_at_step = $1, rejection_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [stepOrder, reason, requestId],
      );

      // Mark current step as returned
      await client.query(
        `UPDATE public.family_visit_approval_steps
         SET status = 'returned', signed_by_user_id = $1, signed_at = NOW(), comment = $2
         WHERE request_id = $3 AND step_order = $4`,
        [user.userId, reason, requestId, stepOrder],
      );

      await client.query("COMMIT");

      logActivity({
        req,
        propertyId: user.propertyId ?? 0,
        username: user.username,
        userId: user.userId,
        userRole: user.userRole,
        action: "FAMILY_VISIT_REBACKED",
        actionType: "UPDATE",
        module: "family-visit",
        entityType: "family_visit_request",
        entityId: requestId,
        details: `Step ${stepOrder} (${requiredRole}) rebacked: ${reason}`,
      });

      const updated = await getRequestWithSteps(requestId, user.propertyId, user.isSystemAdmin);
      res.json({ success: true, data: updated });
    } catch (txErr: unknown) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

} catch (err: unknown) {
const message = err instanceof Error ? err.message : String(err);
res.status(500).json({ success: false, message });
}
});

// PUT /api/family-visit/:id - Edit request
router.put("/family-visit/:id", requirePermission("hosting_requests", "edit"), async (req, res): Promise<void> => {
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

      const lockRes = await client.query(
        "SELECT id, status FROM public.family_visit_requests WHERE id = $1 AND property_id = $2 FOR UPDATE",
        [requestId, user.propertyId]
      );
      if (lockRes.rows.length === 0 && !user.isSystemAdmin) {
        await client.query("ROLLBACK");
        res.status(404).json({ success: false, message: "Request not found or access denied" });
        return;
      }

      const reqStatus = lockRes.rows[0]?.status;
      if (reqStatus !== "PENDING" && reqStatus !== "returned" && !user.isSystemAdmin) {
        await client.query("ROLLBACK");
        res.status(400).json({ success: false, message: "Cannot edit this request in its current status unless you are an admin" });
        return;
      }

      await client.query(
        `UPDATE public.family_visit_requests
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

      logActivity({
        req,
        propertyId: user.propertyId ?? 0,
        username: user.username,
        userId: user.userId,
        userRole: user.userRole,
        action: "FAMILY_VISIT_EDITED",
        actionType: "UPDATE",
        module: "accommodation",
        entityType: "family_visit_request",
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
const message = err instanceof Error ? err.message : String(err);
res.status(500).json({ success: false, message });
}
});

// DELETE /api/family-visit/:id - Delete request
router.delete("/family-visit/:id", requirePermission("hosting_requests", "delete"), async (req, res): Promise<void> => {
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

      const checkRes = await client.query(
        "SELECT id FROM public.family_visit_requests WHERE id = $1 AND property_id = $2 FOR UPDATE",
        [requestId, user.propertyId]
      );
      if (checkRes.rows.length === 0 && !user.isSystemAdmin) {
        await client.query("ROLLBACK");
        res.status(404).json({ success: false, message: "Request not found or access denied" });
        return;
      }

      await client.query("DELETE FROM public.family_visit_approval_steps WHERE request_id = $1", [requestId]);
      await client.query("DELETE FROM public.family_visit_requests WHERE id = $1", [requestId]);

      await client.query("COMMIT");

      logActivity({
        req,
        propertyId: user.propertyId ?? 0,
        username: user.username,
        userId: user.userId,
        userRole: user.userRole,
        action: "FAMILY_VISIT_DELETED",
        actionType: "DELETE",
        module: "accommodation",
        entityType: "family_visit_request",
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
const message = err instanceof Error ? err.message : String(err);
res.status(500).json({ success: false, message });
}
});

export default router;

================================================================================
FILE: artifacts/api-server/src/routes/hostings.ts
================================================================================

import { Router } from "express";
import {
db,
withTenant,
hostingsTable,
hostingCompanionsTable,
employeesTable,
roomsTable,
buildingsTable,
floorsTable,
} from "@workspace/db";
import { eq, and, inArray, SQL } from "drizzle-orm";
import {
CreateHostingBody,
UpdateHostingBody,
UpdateHostingParams,
DeleteHostingParams,
ApproveHostingParams,
CheckinHostingParams,
CheckinHostingBody,
CheckoutHostingParams,
ListHostingsQueryParams,
ListHostingsResponse,
UpdateHostingResponse,
ApproveHostingResponse,
CheckinHostingResponse,
CheckoutHostingResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { requirePermission } from "../middlewares/permissions.js";
import { getTenantId, su } from "../lib/request-utils.js";

const router: Router = Router();
const MAX*DOCUMENT_IMAGE_LENGTH = 7 * 1024 \_ 1024;
const DOCUMENT_DATA_IMAGE_RE =
/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
const DOCUMENT_WEB_URL_RE = /^https?:\/\/[^\s]+$/i;
const DOCUMENT_TYPES = new Set(["ID", "PASSPORT", "OTHER"]);

function fmtHosting(r: Record<string, any>) {
const dateFields = [
"expectedFrom",
"expectedTo",
"actualCheckIn",
"actualCheckOut",
"createdAt",
"updatedAt",
];
const out: Record<string, any> = { ...r };
for (const f of dateFields) {
if (out[f] instanceof Date && typeof out[f].toISOString === "function")
out[f] = out[f].toISOString();
else if (out[f] == null) out[f] = null;
}
return out;
}

function fmtCompanion(c: Record<string, any>) {
const out: Record<string, any> = { ...c };
const dateFields = ["createdAt", "updatedAt"];
for (const f of dateFields) {
if (out[f] instanceof Date && typeof out[f].toISOString === "function")
out[f] = out[f].toISOString();
else if (out[f] == null) out[f] = null;
}
out.documentImage = safeDocumentImage(out.documentImage);
return out;
}

function safeDocumentImage(value: unknown) {
if (value == null || value === "") return null;
const image = String(value);
if (image.length > MAX_DOCUMENT_IMAGE_LENGTH) return null;
if (DOCUMENT_DATA_IMAGE_RE.test(image) || DOCUMENT_WEB_URL_RE.test(image))
return image;
return null;
}

function normalizeDocumentImage(value: unknown) {
if (value == null || value === "") return null;
const image = String(value);
if (image.length > MAX_DOCUMENT_IMAGE_LENGTH) {
throw new Error("Document image exceeds the 5 MB upload limit");
}
if (!DOCUMENT_DATA_IMAGE_RE.test(image) && !DOCUMENT_WEB_URL_RE.test(image)) {
throw new Error("Document image must be a PNG, JPG, WEBP, or GIF image");
}
return image;
}

function normalizeDocumentFileName(value: unknown) {
if (value == null || value === "") return null;
return (
String(value)
.replace(/[^\w.\- ()]/g, "")
.slice(0, 160)
.trim() || null
);
}

function normalizeCompanionInput(c: Record<string, any>) {
const name = String(c.name ?? "").trim();
if (!name) throw new Error("Companion name is required");
const documentType = c.documentType
? String(c.documentType).toUpperCase()
: null;
const isChild = Number(c.isChild) === 1 ? 1 : 0;
return {
name,
idNumber: c.idNumber ? String(c.idNumber).trim().slice(0, 80) : null,
documentType:
documentType && DOCUMENT_TYPES.has(documentType) ? documentType : null,
documentImage: normalizeDocumentImage(c.documentImage),
documentFileName: normalizeDocumentFileName(c.documentFileName),
relation: c.relation ? String(c.relation).trim().slice(0, 80) : null,
isChild,
age:
isChild && c.age != null && c.age !== ""
? Math.max(0, Math.min(17, Number(c.age) || 0))
: null,
};
}

function fmtRelated(r: Record<string, any> | null | undefined) {
if (!r) return null;
const out: Record<string, any> = { ...r };
for (const [key, value] of Object.entries(out)) {
if (value instanceof Date && typeof value.toISOString === "function") {
out[key] = value.toISOString();
}
}
return out;
}

async function fetchCompanions(tenantDb: any, hostingId: number) {
const rows = await tenantDb
.select()
.from(hostingCompanionsTable)
.where(eq(hostingCompanionsTable.hostingId, hostingId));
return rows.map(fmtCompanion);
}

router.get(
"/hostings",
requirePermission("accommodation", "view"),
async (req, res): Promise<void> => {
const propertyId = getTenantId(req);
if (!propertyId) {
res.status(400).json({ error: "propertyId is required" });
return;
}

    try {
      const query = ListHostingsQueryParams.safeParse(req.query);
      const conditions: SQL[] = [];
      if (query.success) {
        if (query.data.status)
          conditions.push(eq(hostingsTable.status, query.data.status));
      }

      const { hostings, companions } = await withTenant(
        propertyId,
        async (tenantDb) => {
          const hostingsQuery = tenantDb
            .select({
              hosting: hostingsTable,
              employee: employeesTable,
              room: roomsTable,
              building: buildingsTable,
              floor: floorsTable,
            })
            .from(hostingsTable)
            .leftJoin(
              employeesTable,
              eq(hostingsTable.employeeId, employeesTable.id),
            )
            .leftJoin(roomsTable, eq(hostingsTable.roomId, roomsTable.id))
            .leftJoin(
              buildingsTable,
              eq(roomsTable.buildingId, buildingsTable.id),
            )
            .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id));

          const rows =
            conditions.length > 0
              ? await hostingsQuery.where(and(...conditions))
              : await hostingsQuery;

          const hostingIds = rows.map((r) => r.hosting.id);
          const companionsList =
            hostingIds.length > 0
              ? await tenantDb
                  .select()
                  .from(hostingCompanionsTable)
                  .where(inArray(hostingCompanionsTable.hostingId, hostingIds))
              : [];

          return { hostings: rows, companions: companionsList };
        },
      );

      const companionsByHosting = new Map<number, any[]>();
      companions.forEach((c) => {
        const list = companionsByHosting.get(c.hostingId) ?? [];
        list.push(fmtCompanion(c));
        companionsByHosting.set(c.hostingId, list);
      });

      const enriched = hostings.map(
        ({ hosting, employee, room, building, floor }) => {
          const comps = companionsByHosting.get(hosting.id) ?? [];
          const base = fmtHosting({
            ...hosting,
            propertyId,
            companions: comps,
          });
          const parsedBase = ListHostingsResponse.parse([base])[0];

          return {
            ...parsedBase,
            companions: comps,
            employee: employee ? fmtRelated(employee) : null,
            room: room
              ? {
                  ...fmtRelated(room),
                  buildingName: building?.name ?? null,
                  buildingLocation: building?.location ?? null,
                  floorNumber: floor?.floorNumber ?? null,
                  floorDescription: floor?.description ?? null,
                }
              : null,
          };
        },
      );

      res.json(enriched);
    } catch (error: any) {
      console.error(
        "[Hostings API] Error fetching hostings:",
        error.message || error,
      );
      res.status(500).json({ error: "Failed to fetch hostings" });
    }

},
);

router.post(
"/hostings",
requirePermission("accommodation", "create"),
async (req, res): Promise<void> => {
const propertyId = getTenantId(req);
if (!propertyId) {
res.status(400).json({ error: "propertyId is required" });
return;
}

    const parsed = CreateHostingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const data = parsed.data as any;
    let companions: ReturnType<typeof normalizeCompanionInput>[] | undefined;
    try {
      companions = Array.isArray((req.body as any).companions)
        ? ((req.body as any).companions as Record<string, any>[]).map(
            normalizeCompanionInput,
          )
        : undefined;
    } catch (error: any) {
      res
        .status(400)
        .json({ error: error.message || "Invalid companion data" });
      return;
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [hosting] = await tenantDb
        .insert(hostingsTable)
        .values({
          ...data,
          notes: data.notes ?? "",
          status: "PENDING",
        })
        .returning();

      if (companions && companions.length > 0) {
        await tenantDb.insert(hostingCompanionsTable).values(
          companions.map((c) => ({
            hostingId: hosting.id,
            ...c,
          })),
        );
      }
      const companionsList = await tenantDb
        .select()
        .from(hostingCompanionsTable)
        .where(eq(hostingCompanionsTable.hostingId, hosting.id));
      return { hosting, companionsList };
    });

    const s = su(req);
    logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `طلب استضافة جديد للموظف #${result.hosting.employeeId}`,
      actionType: "CREATE",
      module: "accommodation",
      entityType: "hosting",
      entityId: result.hosting.id,
      details: `Guests: ${result.hosting.guestsCount}`,
    });
    res
      .status(201)
      .json({
        ...fmtHosting(result.hosting),
        propertyId,
        companions: result.companionsList.map(fmtCompanion),
      });

},
);

router.patch(
"/hostings/:id",
requirePermission("accommodation", "edit"),
async (req, res): Promise<void> => {
const propertyId = getTenantId(req);
if (!propertyId) {
res.status(400).json({ error: "propertyId is required" });
return;
}

    try {
      const params = UpdateHostingParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const parsed = UpdateHostingBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const [updated] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .update(hostingsTable)
          .set(parsed.data as any)
          .where(eq(hostingsTable.id, params.data.id))
          .returning();
      });

      if (!updated) {
        res.status(404).json({ error: "Hosting not found" });
        return;
      }

      const updatedCompanions = await withTenant(propertyId, (tenantDb) =>
        fetchCompanions(tenantDb, updated.id),
      );

      const s = su(req);
      logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تعديل طلب استضافة #${updated.id}`,
        actionType: "UPDATE",
        module: "accommodation",
        entityType: "hosting",
        entityId: updated.id,
      });

      const response = {
        ...fmtHosting(updated),
        companions: updatedCompanions,
        propertyId,
      };
      res.json(response);
    } catch (error: any) {
      console.error("[Update Hosting API] Error:", error.message || error);
      res.status(500).json({ error: "Failed to update hosting" });
    }

},
);

router.delete(
"/hostings/:id",
requirePermission("accommodation", "delete"),
async (req, res): Promise<void> => {
const propertyId = getTenantId(req);
if (!propertyId) {
res.status(400).json({ error: "propertyId is required" });
return;
}

    const params = DeleteHostingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const existingH = await withTenant(propertyId, async (tenantDb) => {
      const [h] = await tenantDb
        .select()
        .from(hostingsTable)
        .where(eq(hostingsTable.id, params.data.id));
      if (h)
        await tenantDb
          .delete(hostingsTable)
          .where(eq(hostingsTable.id, params.data.id));
      return h;
    });

    if (existingH) {
      const s = su(req);
      logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف طلب استضافة #${existingH.id}`,
        actionType: "DELETE",
        module: "accommodation",
        entityType: "hosting",
        entityId: existingH.id,
        severity: "warning",
      });
    }
    res.sendStatus(204);

},
);

router.post(
"/hostings/:id/approve",
requirePermission("accommodation", "edit"),
async (req, res): Promise<void> => {
const propertyId = getTenantId(req);
if (!propertyId) {
res.status(400).json({ error: "propertyId is required" });
return;
}

    try {
      const params = ApproveHostingParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const [updated] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .update(hostingsTable)
          .set({ status: "APPROVED" })
          .where(eq(hostingsTable.id, params.data.id))
          .returning();
      });

      if (!updated) {
        res.status(404).json({ error: "Hosting not found" });
        return;
      }

      const s = su(req);
      logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `الموافقة على طلب الاستضافة #${updated.id}`,
        actionType: "UPDATE",
        module: "accommodation",
        entityType: "hosting",
        entityId: updated.id,
      });

      const approveCompanions = await withTenant(propertyId, (tenantDb) =>
        fetchCompanions(tenantDb, updated.id),
      );
      const response = {
        ...fmtHosting(updated),
        companions: approveCompanions,
        propertyId,
      };
      res.json(response);
    } catch (error: any) {
      console.error("[Approve Hosting API] Error:", error.message || error);
      res.status(500).json({ error: "Failed to approve hosting" });
    }

},
);

router.post(
"/hostings/:id/checkin",
requirePermission("accommodation", "edit"),
async (req, res): Promise<void> => {
const propertyId = getTenantId(req);
if (!propertyId) {
res.status(400).json({ error: "propertyId is required" });
return;
}

    try {
      const params = CheckinHostingParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const parsed = CheckinHostingBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const [updated] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .update(hostingsTable)
          .set({
            actualCheckIn: parsed.data.actualCheckIn,
            ...(parsed.data.roomId !== undefined
              ? { roomId: parsed.data.roomId }
              : {}),
            status: "ACTIVE",
          })
          .where(eq(hostingsTable.id, params.data.id))
          .returning();
      });

      if (!updated) {
        res.status(404).json({ error: "Hosting not found" });
        return;
      }

      const s = su(req);
      logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `وصول الضيوف للموظف #${updated.employeeId}`,
        actionType: "CHECKIN",
        module: "accommodation",
        entityType: "hosting",
        entityId: updated.id,
      });

      const checkinCompanions = await withTenant(propertyId, (tenantDb) =>
        fetchCompanions(tenantDb, updated.id),
      );
      const response = {
        ...fmtHosting(updated),
        companions: checkinCompanions,
        propertyId,
      };
      res.json(response);
    } catch (error: any) {
      console.error("[Checkin Hosting API] Error:", error.message || error);
      res.status(500).json({ error: "Failed to checkin hosting" });
    }

},
);

router.post(
"/hostings/:id/checkout",
requirePermission("accommodation", "edit"),
async (req, res): Promise<void> => {
const propertyId = getTenantId(req);
if (!propertyId) {
res.status(400).json({ error: "propertyId is required" });
return;
}

    try {
      const params = CheckoutHostingParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const [updated] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .update(hostingsTable)
          .set({
            actualCheckOut: new Date().toISOString().split("T")[0],
            status: "COMPLETED",
          })
          .where(eq(hostingsTable.id, params.data.id))
          .returning();
      });

      if (!updated) {
        res.status(404).json({ error: "Hosting not found" });
        return;
      }

      const s = su(req);
      logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تسجيل مغادرة ضيوف للموظف #${updated.employeeId}`,
        actionType: "CHECKOUT",
        module: "accommodation",
        entityType: "hosting",
        entityId: updated.id,
      });

      const checkoutCompanions = await withTenant(propertyId, (tenantDb) =>
        fetchCompanions(tenantDb, updated.id),
      );
      const response = {
        ...fmtHosting(updated),
        companions: checkoutCompanions,
        propertyId,
      };
      res.json(response);
    } catch (error: any) {
      console.error("[Checkout API] Error:", error.message || error);
      res.status(500).json({ error: "Failed to checkout hosting" });
    }

},
);

/_ Companions CRUD _/
router.get(
"/hostings/:id/companions",
requirePermission("accommodation", "view"),
async (req, res): Promise<void> => {
const propertyId = getTenantId(req);
if (!propertyId) {
res.status(400).json({ error: "propertyId is required" });
return;
}

    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const companions = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(hostingCompanionsTable)
        .where(eq(hostingCompanionsTable.hostingId, id));
    });

    res.json(companions.map(fmtCompanion));

},
);

router.post(
"/hostings/:id/companions",
requirePermission("accommodation", "create"),
async (req, res): Promise<void> => {
const propertyId = getTenantId(req);
if (!propertyId) {
res.status(400).json({ error: "propertyId is required" });
return;
}

    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    let body: ReturnType<typeof normalizeCompanionInput>;
    try {
      body = normalizeCompanionInput(req.body as Record<string, any>);
    } catch (error: any) {
      res
        .status(400)
        .json({ error: error.message || "Invalid companion data" });
      return;
    }

    const [companion] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .insert(hostingCompanionsTable)
        .values({
          hostingId: id,
          ...body,
        })
        .returning();
    });

    res.status(201).json(fmtCompanion(companion));

},
);

router.delete(
"/hostings/:id/companions/:companionId",
requirePermission("accommodation", "delete"),
async (req, res): Promise<void> => {
const propertyId = getTenantId(req);
if (!propertyId) {
res.status(400).json({ error: "propertyId is required" });
return;
}

    const hostingId = parseInt(req.params.id as string);
    if (isNaN(hostingId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const companionId = parseInt(req.params.companionId as string);
    if (isNaN(companionId)) {
      res.status(400).json({ error: "Invalid companion id" });
      return;
    }

    await withTenant(propertyId, async (tenantDb) => {
      await tenantDb
        .delete(hostingCompanionsTable)
        .where(
          and(
            eq(hostingCompanionsTable.id, companionId),
            eq(hostingCompanionsTable.hostingId, hostingId),
          ),
        );
    });

    res.sendStatus(204);

},
);

export default router;

================================================================================
FILE: lib/db/src/schema/family_visit.ts
================================================================================

import { pgTable, serial, integer, varchar, text, date, timestamp, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";
import { usersTable } from "./users";

export const familyVisitRequestsTable = pgTable("family_visit_requests", {
id: serial("id").primaryKey(),
requestNumber: varchar("request_number", { length: 20 }).notNull().unique(),
propertyId: integer("property_id").notNull().references(() => propertiesTable.id),
hotelId: integer("hotel_id"),
visitHotelId: integer("visit_hotel_id"),

requesterUserId: integer("requester_user_id").notNull().references(() => usersTable.id),
employeeName: varchar("employee_name", { length: 200 }).notNull(),
clockNumber: varchar("clock_number", { length: 50 }).notNull(),
department: varchar("department", { length: 150 }).notNull(),
position: varchar("position", { length: 150 }).notNull(),

numberOfRooms: integer("number_of_rooms").notNull(),
familyMembersCount: integer("family_members_count").notNull(),
familyMembersIncluded: varchar("family_members_included", { length: 100 }),
fromDate: date("from_date").notNull(),
toDate: date("to_date").notNull(),
consumedDays: integer("consumed_days").notNull(),
remarks: text("remarks"),

status: varchar("status", { length: 30 }).notNull().default("in_signing"),
currentStepOrder: integer("current_step_order").notNull().default(1),
rejectedAtStep: integer("rejected_at_step"),
rejectionReason: text("rejection_reason"),

guestHostingId: integer("guest_hosting_id"),
guestHostingStatus: varchar("guest_hosting_status", { length: 30 }),

createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
statusIdx: index("idx_fvr_status").on(table.status),
propertyIdIdx: index("idx_fvr_property_id").on(table.propertyId),
}));

export const insertFamilyVisitRequestSchema = createInsertSchema(familyVisitRequestsTable).omit({
id: true,
requestNumber: true,
createdAt: true,
updatedAt: true,
});
export type InsertFamilyVisitRequest = typeof familyVisitRequestsTable.$inferInsert;
export type FamilyVisitRequest = typeof familyVisitRequestsTable.$inferSelect;

export const familyVisitApprovalStepsTable = pgTable("family_visit_approval_steps", {
id: serial("id").primaryKey(),
requestId: integer("request_id").notNull().references(() => familyVisitRequestsTable.id, { onDelete: "cascade" }),
stepOrder: integer("step_order").notNull(),
roleRequired: varchar("role_required", { length: 50 }).notNull(),

status: varchar("status", { length: 30 }).notNull().default("pending"),

signedByUserId: integer("signed_by_user_id").references(() => usersTable.id),
signedAt: timestamp("signed_at", { withTimezone: true }),
signatureImageUrlSnapshot: text("signature_image_url_snapshot"),
comment: text("comment"),

createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
requestIdIdx: index("index_fvas_request_id").on(table.requestId),
statusIdx: index("index_fvas_status").on(table.status),
}));

export const insertFamilyVisitApprovalStepSchema = createInsertSchema(familyVisitApprovalStepsTable).omit({
id: true,
createdAt: true,
});
export type InsertFamilyVisitApprovalStep = typeof familyVisitApprovalStepsTable.$inferInsert;
export type FamilyVisitApprovalStep = typeof familyVisitApprovalStepsTable.$inferSelect;

================================================================================
FILE: lib/db/src/schema/user_signatures.ts
================================================================================

import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const userSignaturesTable = pgTable("user_signatures", {
id: serial("id").primaryKey(),
userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
signatureImageUrl: text("signature_image_url").notNull(),
uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSignatureSchema = createInsertSchema(userSignaturesTable).omit({
id: true,
uploadedAt: true,
updatedAt: true,
});

export type InsertUserSignature = typeof userSignaturesTable.$inferInsert;
export type UserSignature = typeof userSignaturesTable.$inferSelect;

================================================================================
FILE: artifacts/housing/src/pages/family-visit/FamilyVisitIndex.tsx
================================================================================

import { useState, useCallback, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useLocation } from "wouter";
import { Plus, Search } from "lucide-react";
import { usePermission } from "@/hooks/use-permission";

const STATUS_TABS = ["all", "in_signing", "approved", "rejected"] as const;

const statusLabels: Record<string, Record<string, string>> = {
all: { en: "All", ar: "الكل" },
in_signing: { en: "In Signing", ar: "قيد التوقيع" },
approved: { en: "Approved", ar: "معتمد" },
rejected: { en: "Rejected", ar: "مرفوض" },
};

const statusColors: Record<string, string> = {
all: "",
in_signing: "bg-muted-foreground",
approved: "bg-green-500",
rejected: "bg-red-500",
};

const statusBadgeVariant: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
in_signing: "warning",
approved: "success",
rejected: "danger",
cancelled: "muted",
};

export default function FamilyVisitIndex() {
const { language } = useLanguage();
const ar = language === "ar";
const [, setLocation] = useLocation();
const { canCreate } = usePermission();
const [statusFilter, setStatusFilter] = useState("all");
const [search, setSearch] = useState("");
const [page, setPage] = useState(1);
const limit = 25;

const { data: countsData } = useQuery({
queryKey: ["/api/family-visit/counts"],
queryFn: async () => {
const res = await fetch("/api/family-visit/counts");
const json = await res.json();
return json.data;
},
});

const { data, isLoading, isFetching, isError, error } = useQuery({
queryKey: ["/api/family-visit", { page, limit, status: statusFilter, search }],
queryFn: async () => {
const params = new URLSearchParams({ page: String(page), limit: String(limit) });
if (statusFilter !== "all") params.set("status", statusFilter);
if (search) params.set("search", search);
const res = await fetch(`/api/family-visit?${params}`);
if (!res.ok) {
throw new Error("Failed to load hosting requests");
}
return res.json();
},
placeholderData: (prev: any) => prev,
});

const handleSearch = useCallback((e: FormEvent<HTMLFormElement>) => {
e.preventDefault();
setPage(1);
}, []);

const getStatusLabel = (status: string) => {
if (status === "approved") return ar ? "معتمد" : "Approved";
if (status === "in_signing") return ar ? "قيد التوقيع" : "In Signing";
if (status === "rejected") return ar ? "مرفوض" : "Rejected";
if (status === "cancelled") return ar ? "ملغي" : "Cancelled";
return status;
};

const getPendingRole = (request: any) => {
if (request.pendingOn) {
const roleMap: Record<string, Record<string, string>> = {
housing_manager: { en: "Housing Manager", ar: "مدير السكن" },
hr_manager: { en: "HR Manager", ar: "مدير الموارد البشرية" },
accounts_manager: { en: "Accounts Manager", ar: "مدير الحسابات" },
};
return roleMap[request.pendingOn]?.[language] ?? request.pendingOn;
}

    if (request.status !== "in_signing" || !Array.isArray(request.approval_steps)) return null;

    const stepOrder = request.current_step_order ?? request.currentStepOrder;
    const step = request.approval_steps.find((s: any) => s.stepOrder === stepOrder);
    if (!step) return null;

    const roleMap: Record<string, Record<string, string>> = {
      housing_manager: { en: "Housing Manager", ar: "مدير السكن" },
      hr_manager: { en: "HR Manager", ar: "مدير الموارد البشرية" },
      accounts_manager: { en: "Accounts Manager", ar: "مدير الحسابات" },
    };
    return roleMap[step.roleRequired]?.[language] ?? step.roleRequired;

};

const formatDateValue = (value: unknown) => {
if (!value) return "—";

    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString(ar ? "ar-EG" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

};

const getTabLabel = (tab: string) => {
const label = statusLabels[tab]?.[language] ?? statusLabels[tab]?.en ?? tab;
return label;
};

return (

<div className="space-y-6 p-1">
<div className="flex items-center justify-between">
<div>
<h1 className="text-2xl font-bold text-foreground">
{ar ? "طلبات الاستضافة" : "Hosting Requests"}
</h1>
<p className="text-muted-foreground text-sm mt-1">
{countsData?.total != null
? `${countsData.total} ${ar ? "طلب" : "requests"}`
: ""}
</p>
</div>
{canCreate("hosting_requests") && (
<Button type="button" onClick={() => setLocation("/family-visit/create")}>
<Plus className="w-4 h-4 mr-2" />
{ar ? "طلب استضافة جديد" : "New Hosting Request"}
</Button>
)}
</div>

      {/* Status Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {STATUS_TABS.map((tab) => {
          const count = countsData?.[tab] ?? countsData?.total;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => { setStatusFilter(tab); setPage(1); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab !== "all" && (
                <span className={`w-2 h-2 rounded-full ${statusColors[tab]}`} />
              )}
              {getTabLabel(tab)}
              {count != null && (
                <span className="text-xs text-muted-foreground">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={ar ? "بحث بالاسم أو رقم الطلب" : "Search by name or request ID"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </form>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-12 text-center text-muted-foreground">
              <p className="font-medium text-foreground">
                {ar ? "تعذر تحميل طلبات الاستضافة" : "Unable to load hosting requests"}
              </p>
              <p className="mt-2 text-sm">
                {error instanceof Error ? error.message : ar ? "يرجى المحاولة مرة أخرى" : "Please try again later"}
              </p>
            </div>
          ) : !data?.data?.length ? (
            <div className="p-12 text-center text-muted-foreground">
              {ar ? "لا توجد طلبات" : "No requests found"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">{ar ? "رقم الطلب" : "ID"}</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">{ar ? "الموظف" : "Employee"}</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">{ar ? "القسم" : "Dept"}</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">{ar ? "الحالة" : "Status"}</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">{ar ? "بانتظار" : "Pending On"}</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">{ar ? "التاريخ" : "Date"}</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">{ar ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((request: any) => (
                    <tr key={request.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{request.request_number}</td>
                      <td className="p-3">{request.employee_name}</td>
                      <td className="p-3 text-muted-foreground">{request.department}</td>
                      <td className="p-3">
                        <StatusBadge
                          label={getStatusLabel(request.status)}
                          variant={statusBadgeVariant[request.status] ?? "muted"}
                        />
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {getPendingRole(request) || "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDateValue(request.created_at)}
                      </td>
                      <td className="p-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/family-visit/${request.id}`)}
                        >
                          {ar ? "عرض" : "View"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data?.pagination && (
        <PaginationBar
          pagination={data.pagination}
          isFetching={isFetching}
          onPageChange={setPage}
        />
      )}
    </div>

);
}

================================================================================
FILE: artifacts/housing/src/pages/family-visit/CreateFamilyVisit.tsx
================================================================================

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Upload, Trash2, Paperclip } from "lucide-react";
import { useProperty } from "@/context/PropertyContext";

type EmployeeResult = {
id: number;
employeeId: string;
firstName: string;
lastName: string;
jobTitle: string | null;
department: string | null; accommodationRoom?: string | null; accommodationRoomType?: string | null; accommodationBuilding?: string | null; accommodationFloor?: string | null;
};

export default function CreateFamilyVisit() {
const { language } = useLanguage();
const ar = language === "ar";
const [, setLocation] = useLocation();
const { properties, activePropertyId } = useProperty();

const [form, setForm] = useState({
hotelId: "",
clockNumber: "",
visitHotelId: "",
numberOfRooms: "",
familyMembersCount: "",
familyMembersIncluded: "",
fromDate: "",
toDate: "",
consumedDays: 0,
remarks: "",
});

const [employee, setEmployee] = useState<EmployeeResult | null>(null);
const [isSearchingEmp, setIsSearchingEmp] = useState(false);
const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// Auto-fetch employee by Clock Number
useEffect(() => {
if (!form.clockNumber || form.clockNumber.length < 2) {
setEmployee(null);
return;
}

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingEmp(true);
      try {
        const propId = form.hotelId || activePropertyId || "";
        const resp = await fetch(`/api/employees/search?q=${encodeURIComponent(form.clockNumber)}&propertyId=${propId}`);
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          // Find exact match or first result
          const exact = data.find((e) => String(e.employeeId) === String(form.clockNumber));
          setEmployee(exact || data[0]);
        } else {
          setEmployee(null);
        }
      } catch (err) {
        setEmployee(null);
      } finally {
        setIsSearchingEmp(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };

}, [form.clockNumber, form.hotelId, activePropertyId]);

const updateField = (field: string, value: any) => {
setForm((prev) => {
const updated = { ...prev, [field]: value };
if (field === "fromDate" || field === "toDate") {
const from = field === "fromDate" ? value : prev.fromDate;
const to = field === "toDate" ? value : prev.toDate;
if (from && to) {
const diff = Math.max(0, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 _ 60 _ 60 \* 24)));
updated.consumedDays = diff;
}
}
return updated;
});
};

const createMutation = useMutation({
mutationFn: async () => {
// In a real scenario, attachments would be uploaded first or sent as FormData
const res = await fetch("/api/family-visit", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
hotelId: form.hotelId ? parseInt(form.hotelId) : undefined,
visitHotelId: form.visitHotelId ? parseInt(form.visitHotelId) : undefined,
numberOfRooms: parseInt(form.numberOfRooms),
familyMembersCount: parseInt(form.familyMembersCount),
familyMembersIncluded: form.familyMembersIncluded || undefined,
fromDate: form.fromDate,
toDate: form.toDate,
consumedDays: form.consumedDays,
remarks: form.remarks || undefined,
}),
});
const data = await res.json();
if (!res.ok) throw new Error(data.message || "Failed to create");
return data.data;
},
onSuccess: (created) => {
toast.success(
ar
? `تم إنشاء الطلب ${created.request_number}`
: `Request ${created.request_number} created`,
);
setLocation(`/family-visit/${created.id}`);
},
onError: (err: Error) => {
toast.error(err.message);
},
});

const handleSubmit = (e: React.FormEvent) => {
e.preventDefault();
if (!form.hotelId || !form.clockNumber || !form.visitHotelId || !form.numberOfRooms || !form.familyMembersCount || !form.fromDate || !form.toDate) {
toast.error(ar ? "يرجى ملء الحقول المطلوبة (_)" : "Please fill required fields (_)");
return;
}
createMutation.mutate();
};

return (

<div className="space-y-6 p-1">
<div className="flex items-center gap-4">
<Button variant="ghost" size="icon" onClick={() => setLocation("/accommodation/guest-hosting")}>
<ArrowLeft className="w-5 h-5" />
</Button>
<div>
<h1 className="text-2xl font-bold text-foreground">
{ar ? "إنشاء طلب استضافة" : "Create Hosting Request"}
</h1>
<p className="text-muted-foreground text-sm mt-1">
{ar ? "طلبات" : "requests"}
</p>
</div>
</div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Request Information */}
        <Card className="border-t-4 border-t-primary/20">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Paperclip className="w-5 h-5" />
              {ar ? "معلومات الطلب" : "Request Information"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div className="space-y-2">
              <Label>{ar ? "الفندق *" : "Hotel *"}</Label>
              <Select value={form.hotelId} onValueChange={(v) => updateField("hotelId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder={ar ? "اختر الفندق" : "Select Hotel"} />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>{ar ? "رقم البصمة *" : "Clock Number *"}</span>
                {isSearchingEmp && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </Label>
              <Input
                placeholder="12345"
                value={form.clockNumber}
                onChange={(e) => updateField("clockNumber", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{ar ? "فندق الزيارة *" : "Visit Hotel *"}</Label>
              <Select value={form.visitHotelId} onValueChange={(v) => updateField("visitHotelId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder={ar ? "اختر فندق الزيارة" : "Select Visit Hotel"} />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Employee Data */}
        <Card className="border-t-4 border-t-primary/20 bg-muted/10">
          <CardHeader className="bg-muted/30 pb-4 flex flex-row items-center gap-3 space-y-0">
            <CardTitle className="text-lg flex items-center gap-2">
              {ar ? "بيانات الموظف" : "Employee Data"}
            </CardTitle>
            <span className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-blue-100 text-blue-700 rounded-full">
              {ar ? "تعبئة تلقائية" : "Auto-filled"}
            </span>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div className="space-y-2">
              <Label>{ar ? "الاسم *" : "Name *"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee ? `${employee.firstName} ${employee.lastName}` : ""}
                placeholder={ar ? "الاسم" : "Name"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "القسم *" : "Department *"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.department || ""}
                placeholder={ar ? "القسم" : "Department"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "المنصب *" : "Position *"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.jobTitle || ""}
                placeholder={ar ? "المنصب" : "Position"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "المبنى" : "Building"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.accommodationBuilding || ""}
                placeholder={ar ? "المبنى" : "Building"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "الدور" : "Floor"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.accommodationFloor || ""}
                placeholder={ar ? "الدور" : "Floor"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "رقم الغرفة" : "Room Number"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.accommodationRoom || ""}
                placeholder={ar ? "رقم الغرفة" : "Room Number"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "نوع الغرفة" : "Room Type"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.accommodationRoomType || ""}
                placeholder={ar ? "نوع الغرفة" : "Room Type"}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Visit Details */}
        <Card className="border-t-4 border-t-primary/20">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              {ar ? "تفاصيل الزيارة" : "Visit Details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>{ar ? "عدد الغرف *" : "No of Rooms *"}</Label>
                <Input
                  type="number"
                  min={1}
                  required
                  value={form.numberOfRooms}
                  onChange={(e) => updateField("numberOfRooms", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "أفراد العائلة *" : "Family Members *"}</Label>
                <Input
                  type="number"
                  min={1}
                  required
                  value={form.familyMembersCount}
                  onChange={(e) => updateField("familyMembersCount", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "أفراد العائلة المشمولين *" : "Family Members Included *"}</Label>
                <Select value={form.familyMembersIncluded} onValueChange={(v) => updateField("familyMembersIncluded", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={ar ? "اختر" : "Select"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Spouse">{ar ? "الزوج/الزوجة" : "Spouse"}</SelectItem>
                    <SelectItem value="Children">{ar ? "الأبناء" : "Children"}</SelectItem>
                    <SelectItem value="Parents">{ar ? "الوالدين" : "Parents"}</SelectItem>
                    <SelectItem value="Spouse & Children">{ar ? "الزوج/الزوجة والأبناء" : "Spouse & Children"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>{ar ? "من *" : "From *"}</Label>
                <Input
                  type="date"
                  required
                  value={form.fromDate}
                  onChange={(e) => updateField("fromDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "إلى *" : "To *"}</Label>
                <Input
                  type="date"
                  required
                  value={form.toDate}
                  onChange={(e) => updateField("toDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "الأيام المستهلكة *" : "Consumed Days *"}</Label>
                <Input type="number" value={form.consumedDays} readOnly className="bg-muted/50" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{ar ? "ملاحظات" : "Remarks"}</Label>
              <Textarea
                rows={3}
                value={form.remarks}
                onChange={(e) => updateField("remarks", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Attachments */}
        <Card className="border-t-4 border-t-primary/20">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Paperclip className="w-5 h-5 transform rotate-45" />
              {ar ? "المرفقات" : "Attachments"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-muted-foreground gap-3 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">
                  {ar ? "انقر للرفع أو اسحب الملفات هنا" : "Click to upload or drag files here"}
                </p>
                <p className="text-sm mt-1">
                  {ar ? "الحد الأقصى لحجم الملف 5 ميجابايت" : "Max file size 5MB"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation("/accommodation/guest-hosting")}
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {ar ? "تقديم الطلب" : "Submit Request"}
          </Button>
        </div>
      </form>
    </div>

);
}

================================================================================
FILE: artifacts/housing/src/pages/family-visit/EditFamilyVisit.tsx
================================================================================

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { PageLoader } from "@/components/ui/loader";
import { ArrowLeft, Loader2, Upload, Trash2, Paperclip } from "lucide-react";
import { useProperty } from "@/context/PropertyContext";

type EmployeeResult = {
id: number;
employeeId: string;
firstName: string;
lastName: string;
jobTitle: string | null;
department: string | null; accommodationRoom?: string | null; accommodationRoomType?: string | null; accommodationBuilding?: string | null; accommodationFloor?: string | null;
};

export default function EditFamilyVisit() {
const { language } = useLanguage();
const ar = language === "ar";
const [, setLocation] = useLocation();
const { properties, activePropertyId } = useProperty();

const [form, setForm] = useState({
hotelId: "",
clockNumber: "",
visitHotelId: "",
numberOfRooms: "",
familyMembersCount: "",
familyMembersIncluded: "",
fromDate: "",
toDate: "",
consumedDays: 0,
remarks: "",
});

    const params = useParams();

const requestId = params.id;

const { data: requestRes, isLoading: isLoadingRequest } = useQuery({
queryKey: ["family-visit", requestId],
queryFn: async () => {
const res = await fetch(`/api/family-visit/${requestId}`);
if (!res.ok) throw new Error("Failed to fetch request");
return res.json();
},
enabled: !!requestId,
});

useEffect(() => {
if (requestRes?.data) {
const r = requestRes.data;
setForm({
hotelId: r.property_id ? String(r.property_id) : "",
clockNumber: r.employee_id ? String(r.employee_id) : "",
visitHotelId: r.visit_hotel_id ? String(r.visit_hotel_id) : "",
numberOfRooms: r.number_of_rooms ? String(r.number_of_rooms) : "",
familyMembersCount: r.family_members_count ? String(r.family_members_count) : "",
familyMembersIncluded: r.family_members_included || "",
fromDate: r.from_date ? String(r.from_date).split("T")[0] : "",
toDate: r.to_date ? String(r.to_date).split("T")[0] : "",
consumedDays: r.consumed_days || 0,
remarks: r.remarks || "",
});
}
}, [requestRes?.data]);

const [employee, setEmployee] = useState<EmployeeResult | null>(null);
const [isSearchingEmp, setIsSearchingEmp] = useState(false);
const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// Auto-fetch employee by Clock Number
useEffect(() => {
if (!form.clockNumber || form.clockNumber.length < 2) {
setEmployee(null);
return;
}

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingEmp(true);
      try {
        const propId = form.hotelId || activePropertyId || "";
        const resp = await fetch(`/api/employees/search?q=${encodeURIComponent(form.clockNumber)}&propertyId=${propId}`);
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          // Find exact match or first result
          const exact = data.find((e) => String(e.employeeId) === String(form.clockNumber));
          setEmployee(exact || data[0]);
        } else {
          setEmployee(null);
        }
      } catch (err) {
        setEmployee(null);
      } finally {
        setIsSearchingEmp(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };

}, [form.clockNumber, form.hotelId, activePropertyId]);

const updateField = (field: string, value: any) => {
setForm((prev) => {
const updated = { ...prev, [field]: value };
if (field === "fromDate" || field === "toDate") {
const from = field === "fromDate" ? value : prev.fromDate;
const to = field === "toDate" ? value : prev.toDate;
if (from && to) {
const diff = Math.max(0, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 _ 60 _ 60 \* 24)));
updated.consumedDays = diff;
}
}
return updated;
});
};

const updateMutation = useMutation({
mutationFn: async () => {
// In a real scenario, attachments would be uploaded first or sent as FormData
const res = await fetch(`/api/family-visit/${requestId}`, {
method: "PUT",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
hotelId: form.hotelId ? parseInt(form.hotelId) : undefined,
visitHotelId: form.visitHotelId ? parseInt(form.visitHotelId) : undefined,
numberOfRooms: parseInt(form.numberOfRooms),
familyMembersCount: parseInt(form.familyMembersCount),
familyMembersIncluded: form.familyMembersIncluded || undefined,
fromDate: form.fromDate,
toDate: form.toDate,
consumedDays: form.consumedDays,
remarks: form.remarks || undefined,
}),
});
const data = await res.json();
if (!res.ok) throw new Error(data.message || "Failed to create");
return data.data;
},
onSuccess: (updated) => {
toast.success(
ar
? `تم تحديث الطلب ${updated.request_number}`
: `Request ${updated.request_number} updated`,
);
setLocation(`/family-visit/${updated.id}`);
},
onError: (err: Error) => {
toast.error(err.message);
},
});

const handleSubmit = (e: React.FormEvent) => {
e.preventDefault();
if (!form.hotelId || !form.clockNumber || !form.visitHotelId || !form.numberOfRooms || !form.familyMembersCount || !form.fromDate || !form.toDate) {
toast.error(ar ? "يرجى ملء الحقول المطلوبة (_)" : "Please fill required fields (_)");
return;
}
updateMutation.mutate();
};

if (isLoadingRequest) return <PageLoader />;

return (

<div className="space-y-6 p-1">
<div className="flex items-center gap-4">
<Button variant="ghost" size="icon" onClick={() => setLocation(`/family-visit/${requestId}`)}>
<ArrowLeft className="w-5 h-5" />
</Button>
<div>
<h1 className="text-2xl font-bold text-foreground">
{ar ? "تعديل طلب استضافة" : "Edit Hosting Request"}
</h1>
<p className="text-muted-foreground text-sm mt-1">
{ar ? "طلبات" : "requests"}
</p>
</div>
</div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Request Information */}
        <Card className="border-t-4 border-t-primary/20">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Paperclip className="w-5 h-5" />
              {ar ? "معلومات الطلب" : "Request Information"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div className="space-y-2">
              <Label>{ar ? "الفندق *" : "Hotel *"}</Label>
              <Select value={form.hotelId} onValueChange={(v) => updateField("hotelId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder={ar ? "اختر الفندق" : "Select Hotel"} />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>{ar ? "رقم البصمة *" : "Clock Number *"}</span>
                {isSearchingEmp && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </Label>
              <Input
                placeholder="12345"
                value={form.clockNumber}
                onChange={(e) => updateField("clockNumber", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{ar ? "فندق الزيارة *" : "Visit Hotel *"}</Label>
              <Select value={form.visitHotelId} onValueChange={(v) => updateField("visitHotelId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder={ar ? "اختر فندق الزيارة" : "Select Visit Hotel"} />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Employee Data */}
        <Card className="border-t-4 border-t-primary/20 bg-muted/10">
          <CardHeader className="bg-muted/30 pb-4 flex flex-row items-center gap-3 space-y-0">
            <CardTitle className="text-lg flex items-center gap-2">
              {ar ? "بيانات الموظف" : "Employee Data"}
            </CardTitle>
            <span className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-blue-100 text-blue-700 rounded-full">
              {ar ? "تعبئة تلقائية" : "Auto-filled"}
            </span>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div className="space-y-2">
              <Label>{ar ? "الاسم *" : "Name *"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee ? `${employee.firstName} ${employee.lastName}` : ""}
                placeholder={ar ? "الاسم" : "Name"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "القسم *" : "Department *"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.department || ""}
                placeholder={ar ? "القسم" : "Department"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "المنصب *" : "Position *"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.jobTitle || ""}
                placeholder={ar ? "المنصب" : "Position"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "المبنى" : "Building"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.accommodationBuilding || ""}
                placeholder={ar ? "المبنى" : "Building"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "الدور" : "Floor"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.accommodationFloor || ""}
                placeholder={ar ? "الدور" : "Floor"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "رقم الغرفة" : "Room Number"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.accommodationRoom || ""}
                placeholder={ar ? "رقم الغرفة" : "Room Number"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "نوع الغرفة" : "Room Type"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.accommodationRoomType || ""}
                placeholder={ar ? "نوع الغرفة" : "Room Type"}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Visit Details */}
        <Card className="border-t-4 border-t-primary/20">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              {ar ? "تفاصيل الزيارة" : "Visit Details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>{ar ? "عدد الغرف *" : "No of Rooms *"}</Label>
                <Input
                  type="number"
                  min={1}
                  required
                  value={form.numberOfRooms}
                  onChange={(e) => updateField("numberOfRooms", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "أفراد العائلة *" : "Family Members *"}</Label>
                <Input
                  type="number"
                  min={1}
                  required
                  value={form.familyMembersCount}
                  onChange={(e) => updateField("familyMembersCount", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "أفراد العائلة المشمولين *" : "Family Members Included *"}</Label>
                <Select value={form.familyMembersIncluded} onValueChange={(v) => updateField("familyMembersIncluded", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={ar ? "اختر" : "Select"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Spouse">{ar ? "الزوج/الزوجة" : "Spouse"}</SelectItem>
                    <SelectItem value="Children">{ar ? "الأبناء" : "Children"}</SelectItem>
                    <SelectItem value="Parents">{ar ? "الوالدين" : "Parents"}</SelectItem>
                    <SelectItem value="Spouse & Children">{ar ? "الزوج/الزوجة والأبناء" : "Spouse & Children"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>{ar ? "من *" : "From *"}</Label>
                <Input
                  type="date"
                  required
                  value={form.fromDate}
                  onChange={(e) => updateField("fromDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "إلى *" : "To *"}</Label>
                <Input
                  type="date"
                  required
                  value={form.toDate}
                  onChange={(e) => updateField("toDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "الأيام المستهلكة *" : "Consumed Days *"}</Label>
                <Input type="number" value={form.consumedDays} readOnly className="bg-muted/50" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{ar ? "ملاحظات" : "Remarks"}</Label>
              <Textarea
                rows={3}
                value={form.remarks}
                onChange={(e) => updateField("remarks", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Attachments */}
        <Card className="border-t-4 border-t-primary/20">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Paperclip className="w-5 h-5 transform rotate-45" />
              {ar ? "المرفقات" : "Attachments"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-muted-foreground gap-3 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">
                  {ar ? "انقر للرفع أو اسحب الملفات هنا" : "Click to upload or drag files here"}
                </p>
                <p className="text-sm mt-1">
                  {ar ? "الحد الأقصى لحجم الملف 5 ميجابايت" : "Max file size 5MB"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation(`/family-visit/${requestId}`)}
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {ar ? "تقديم الطلب" : "Submit Request"}
          </Button>
        </div>
      </form>
    </div>

);
}

================================================================================
FILE: artifacts/housing/src/pages/family-visit/FamilyVisitDetail.tsx
================================================================================

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { usePermission } from "@/hooks/use-permission";
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader2, Home, ExternalLink, Users, Edit, Trash2 } from "lucide-react";

const stepRoles: Record<string, Record<string, string>> = {
housing_manager: { en: "Housing Manager", ar: "مدير السكن" },
hr_manager: { en: "HR Manager", ar: "مدير الموارد البشرية" },
accounts_manager: { en: "Accounts Manager", ar: "مدير الحسابات" },
};

export default function FamilyVisitDetail() {
const { language } = useLanguage();
const ar = language === "ar";
const { user } = useAuth();
const { canEdit, canDelete, isAdmin } = usePermission();
const [, setLocation] = useLocation();
const [, params] = useRoute("/family-visit/:id");
const requestId = params?.id;

const [showRejectDialog, setShowRejectDialog] = useState(false);
const [rejectReason, setRejectReason] = useState("");
const [showRebackDialog, setShowRebackDialog] = useState(false);
const [rebackReason, setRebackReason] = useState("");
const [showSignConfirm, setShowSignConfirm] = useState(false);
const [showRejectConfirm, setShowRejectConfirm] = useState(false);
const [showRebackConfirm, setShowRebackConfirm] = useState(false);

const { data, isLoading, isError, error, refetch } = useQuery({
queryKey: ["/api/family-visit", requestId],
queryFn: async () => {
const res = await fetch(`/api/family-visit/${requestId}`);
const json = await res.json();
if (!res.ok) {
const err: any = new Error(json.message);
err.status = res.status;
throw err;
}
return json.data;
},
enabled: !!requestId,
});

const { data: mySignature } = useQuery({
queryKey: ["/api/users/me/signature"],
queryFn: async () => {
const res = await fetch("/api/users/me/signature");
return res.json();
},
});

const signMutation = useMutation({
mutationFn: async () => {
const res = await fetch(`/api/family-visit/${requestId}/sign`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ comment: "" }),
});
const json = await res.json();
if (!res.ok) throw new Error(json.message);
return json.data;
},
onSuccess: () => {
toast.success(ar ? "تم الاعتماد بنجاح" : "Successfully approved");
refetch();
},
onError: (err: Error) => toast.error(err.message),
});
const rebackMutation = useMutation({
mutationFn: async () => {
const res = await fetch(`/api/family-visit/${requestId}/reback`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ reason: rebackReason }),
});
const json = await res.json();
if (!res.ok) throw new Error(json.message);
return json.data;
},
onSuccess: () => {
toast.success(ar ? "تم إعادة الطلب بنجاح" : "Successfully returned");
setRebackReason("");
setShowRebackConfirm(false);
refetch();
},
onError: (err: Error) => toast.error(err.message),
});

const rejectMutation = useMutation({
mutationFn: async () => {
const res = await fetch(`/api/family-visit/${requestId}/reject`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ reason: rejectReason }),
});
const json = await res.json();
if (!res.ok) throw new Error(json.message);
return json.data;
},
onSuccess: () => {
toast.success(ar ? "تم الرفض بنجاح" : "Successfully rejected");
setRejectReason("");
setShowRejectConfirm(false);
refetch();
},
onError: (err: Error) => toast.error(err.message),
});

const createGuestHostingMutation = useMutation({
mutationFn: async () => {
const res = await fetch(`/api/family-visit/${requestId}/create-guest-hosting`, {
method: "POST",
});
const json = await res.json();
if (!res.ok) throw new Error(json.message);
return json.data;
},
onSuccess: () => {
toast.success(ar ? "تم إنشاء طلب الاستضافة" : "Guest hosting created");
refetch();
},
onError: (err: Error) => toast.error(err.message),
});

const deleteMutation = useMutation({
mutationFn: async () => {
const res = await fetch(`/api/family-visit/${requestId}`, {
method: "DELETE",
});
const json = await res.json();
if (!res.ok) throw new Error(json.message);
return json.data;
},
onSuccess: () => {
toast.success(ar ? "تم الحذف بنجاح" : "Successfully deleted");
setLocation("/family-visit");
},
onError: (err: Error) => toast.error(err.message),
});

const { data: guestHosting } = useQuery({
queryKey: ["/api/hostings", data?.guest_hosting_id],
queryFn: async () => {
if (!data?.guest_hosting_id) return null;
const res = await fetch(`/api/hostings/${data.guest_hosting_id}?propertyId=${data.property_id}`);
const json = await res.json();
if (!res.ok) throw new Error(json.message);
return json.data;
},
enabled: !!data?.guest_hosting_id,
});

if (isLoading) {
return (

<div className="space-y-4 p-1 max-w-4xl">
<Skeleton className="h-8 w-64" />
<Skeleton className="h-96 w-full" />
</div>
);
}

if (isError && ((error as any)?.status === 403 || (error as any)?.message?.toLowerCase().includes("not allowed"))) {
return (

<div className="p-12 text-center">
<div className="mx-auto bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full w-20 h-20 flex items-center justify-center mb-4">
<svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
</svg>
</div>
<h2 className="text-xl font-bold mb-2">
{ar ? "غير مصرح بالوصول" : "Permission Denied"}
</h2>
<p className="text-muted-foreground mb-6">
{ar ? "عذراً، ليس لديك الصلاحية لعرض هذه الصفحة أو التعامل مع هذا الطلب." : "Sorry, you don't have permission to view this page or handle this request."}
</p>
<Button onClick={() => setLocation("/")} variant="default">
{ar ? "العودة للرئيسية" : "Back to Home"}
</Button>
</div>
);
}

if (!data) {
return (

<div className="p-12 text-center text-muted-foreground">
{ar ? "الطلب غير موجود" : "Request not found"}
</div>
);
}

const request = data;
const steps = request.approval_steps || [];
const currentStep = steps.find((s: any) => s.stepOrder === request.current_step_order);
const userHasSignature = Boolean(mySignature?.signatureImageUrl);
const currentUserJobTitle = (user as any)?.jobTitle;

const userRoles = Array.isArray((user as any)?.roles) ? (user as any).roles : [];
const hasExplicitApprovePermission = userRoles.includes("hosting_requests.approve") || userRoles.includes("approve") || (user as any)?.permissions?.includes("hosting_requests.approve") || (user as any)?.permissions?.includes("approve");
const isAuthorizedToSign = isAdmin || currentStep?.roleRequired === currentUserJobTitle || userRoles.includes(currentStep?.roleRequired) || hasExplicitApprovePermission;
const userCanAct = currentStep?.status === "pending" && isAuthorizedToSign;

const hostingStatusLabels: Record<string, { en: string; ar: string }> = {
PENDING: { en: "Pending Approval", ar: "قيد الانتظار" },
APPROVED: { en: "Approved", ar: "معتمد" },
ACTIVE: { en: "Active", ar: "نشط" },
COMPLETED: { en: "Completed", ar: "مكتمل" },
};

const hostingStatusVariants: Record<string, "warning" | "success" | "info" | "muted"> = {
PENDING: "warning",
APPROVED: "success",
ACTIVE: "info",
COMPLETED: "muted",
};

const hostingStatusVariant =
request.guest_hosting_status ? hostingStatusVariants[request.guest_hosting_status] ?? "muted" : "muted";
const hostingStatusLabel =
request.guest_hosting_status ? hostingStatusLabels[request.guest_hosting_status] : null;

const statusBadgeVariant: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
in_signing: "warning",
approved: "success",
rejected: "danger",
};

return (

<div className="space-y-6 p-1">
<div className="flex items-center gap-4">
<Button variant="ghost" size="icon" onClick={() => setLocation("/family-visit")}>
<ArrowLeft className="w-5 h-5" />
</Button>
<div className="flex-1">
<div className="flex items-center gap-3">
<h1 className="text-2xl font-bold text-foreground">
{request.request_number}
</h1>
<StatusBadge
label={
request.status === "approved" ? (ar ? "معتمد" : "Approved") :
request.status === "rejected" ? (ar ? "مرفوض" : "Rejected") :
request.status === "in_signing" ? (ar ? "قيد التوقيع" : "In Signing") :
request.status
}
variant={statusBadgeVariant[request.status] ?? "muted"}
/>
</div>
<p className="text-muted-foreground text-sm mt-1">
{request.employee_name} — {request.department}
</p>
</div>
<div className="flex items-center gap-2">
{canEdit("hosting_requests") && (
<Button variant="outline" onClick={() => setLocation(`/family-visit/${request.id}/edit`)}>
<Edit className="w-4 h-4 mr-2" />
{ar ? "تعديل" : "Edit"}
</Button>
)}
{canDelete("hosting_requests") && (
<Button variant="destructive" onClick={() => {
if (window.confirm(ar ? "هل أنت متأكد من حذف هذا الطلب؟" : "Are you sure you want to delete this request?")) {
deleteMutation.mutate();
}
}}>
<Trash2 className="w-4 h-4 mr-2" />
{ar ? "حذف" : "Delete"}
</Button>
)}
</div>
</div>

      {/* Request Details */}
      <div className="flex flex-col gap-6">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-6">
            {ar ? "بيانات طلب الاستضافة" : "Hosting Request Data"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "الموظف" : "NAME"}</span>
              <span className="font-medium">{request.employee_name}</span>
            </div>
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "الوظيفة" : "POSITION"}</span>
              <span className="font-medium">{request.position || "-"}</span>
            </div>
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "القسم" : "DEPARTMENT"}</span>
              <span className="font-medium">{request.department || "-"}</span>
            </div>
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "الرقم الوظيفي" : "CLOCK NUMBER"}</span>
              <span className="font-medium">{request.clock_number || "-"}</span>
            </div>
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "عدد الغرف" : "ROOMS"}</span>
              <div className="flex items-center">
                <Badge variant="secondary" className="bg-muted text-foreground hover:bg-muted font-bold rounded-full">{request.number_of_rooms || "-"}</Badge>
              </div>
            </div>
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "أفراد العائلة" : "FAMILY MEMBERS"}</span>
              <div className="flex items-center">
                <Badge variant="secondary" className="bg-muted text-foreground hover:bg-muted font-bold rounded-full">{request.family_members_count}</Badge>
                {request.family_members_included && <span className="text-sm text-muted-foreground ml-2">({request.family_members_included})</span>}
              </div>
            </div>
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "تاريخ الوصول" : "CHECK-IN DATE"}</span>
              <span className="font-medium">{request.from_date ? new Date(request.from_date).toLocaleDateString('en-GB') : "-"}</span>
            </div>
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "تاريخ المغادرة" : "CHECK-OUT DATE"}</span>
              <span className="font-medium">{request.to_date ? new Date(request.to_date).toLocaleDateString('en-GB') : "-"}</span>
            </div>
            {request.remarks && (
              <div className="flex flex-col md:col-span-2 border-b pb-3">
                <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "ملاحظات" : "REMARKS"}</span>
                <span className="font-medium">{request.remarks}</span>
              </div>
            )}
          </div>
        </div>

        {/* Approval Chain */}
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-6">
            {ar ? "مسار الاعتماد" : "Approval Workflow"}
          </h2>
          <div className="flex flex-wrap gap-4">
            {steps.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {ar ? "لا توجد خطوات اعتماد" : "No approval steps"}
              </p>
            ) : (
              steps.map((step: any, idx: number) => {
                const roleName = stepRoles[step.roleRequired]?.[language] ?? step.roleRequired;
                const isActive = step.stepOrder === request.current_step_order;
                const isSigned = step.status === "signed";
                const isRejected = step.status === "rejected";

                let cardClasses = "flex flex-col items-center justify-center p-4 rounded-lg border w-48 text-center bg-card";
                let iconClasses = "w-10 h-10 rounded-lg flex items-center justify-center mb-3";

                if (isSigned) {
                  cardClasses += " border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20";
                  iconClasses += " text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50";
                } else if (isRejected) {
                  cardClasses += " border-red-500 bg-red-50/50 dark:bg-red-950/20";
                  iconClasses += " text-red-600 bg-red-100 dark:bg-red-900/50";
                } else if (isActive) {
                  cardClasses += " border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm";
                  iconClasses += " text-amber-600 bg-amber-100 dark:bg-amber-900/50";
                } else {
                  cardClasses += " border-border";
                  iconClasses += " text-muted-foreground bg-muted";
                }

                return (
                  <div key={step.id} className={cardClasses}>
                    <div className={iconClasses}>
                      {isSigned ? <Users className="w-5 h-5" /> :
                       isRejected ? <Users className="w-5 h-5" /> :
                       <Users className="w-5 h-5" />}
                    </div>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                      {roleName}
                    </span>
                    <span className="text-sm font-bold mt-1 text-foreground line-clamp-1">
                      {step.signerName || step.signed_by_user_id || "-"}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-1 min-h-[16px]">
                      {step.signedAt ? new Date(step.signedAt).toLocaleString('en-GB') : ""}
                    </span>
                    <div className="mt-4 w-full px-2 text-center">
                      {step.signatureImageUrlSnapshot ? (
                        <div className="mb-3 flex justify-center">
                          <div className="w-[180px] h-[84px] bg-white rounded border shadow-sm flex items-center justify-center p-2">
                            <img src={step.signatureImageUrlSnapshot} alt="Signature" className="max-h-full max-w-full object-contain" />
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3 flex justify-center">
                          <div className="w-[180px] h-[84px] bg-muted/20 rounded border border-dashed text-muted-foreground flex items-center justify-center">
                            <span className="text-xs">{ar ? "لا يوجد توقيع" : "No signature"}</span>
                          </div>
                        </div>
                      )}
                      {(isSigned && !step.signatureImageUrlSnapshot) ? (
                        <div className="bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded mx-auto w-fit">
                          APPROVED
                        </div>
                      ) : isRejected ? (
                        <div className="bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded mx-auto w-fit">
                          REJECTED
                        </div>
                      ) : (isActive && userCanAct) ? (
                        <div className="pt-3 border-t border-amber-200 dark:border-amber-900/30 flex flex-col gap-2 w-full">
                          {!userHasSignature ? (
                            <div className="text-center">
                              <span className="text-[10px] text-amber-700 leading-tight block mb-1">
                                {ar ? "يرجى رفع توقيعك في الإعدادات قبل الاعتماد" : "Please upload your signature in Settings before signing"}
                              </span>
                              <Button variant="link" size="sm" className="px-1 h-6 text-[10px] underline" onClick={() => setLocation("/settings")}>
                                {ar ? "الإعدادات" : "Settings"}
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Button size="sm" className="w-full text-xs h-8" onClick={() => signMutation.mutate()} disabled={signMutation.isPending}>
                                {signMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                                {ar ? "اعتماد" : "Approve"}
                              </Button>
                              <Button size="sm" variant="outline" className="w-full text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => setShowRejectDialog(true)}>
                                <XCircle className="w-3 h-3 mr-1 text-red-500" />
                                {ar ? "رفض" : "Reject"}
                              </Button>
                              {currentStep?.stepOrder > 1 && (
                                <Button size="sm" variant="outline" className="w-full text-xs h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30" onClick={() => setShowRebackDialog(true)}>
                                  <ArrowLeft className="w-3 h-3 mr-1" />
                                  {ar ? "إرجاع" : "Return"}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      ) : isActive ? (
                        <div className="bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded mx-auto w-fit">
                          PENDING
                        </div>
                      ) : (
                        <div className="bg-muted text-muted-foreground text-[10px] font-bold px-3 py-1 rounded mx-auto w-fit">
                          PENDING
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6">
            {request.status === "in_signing" && currentStep && (
              <div className="space-y-3">
                    {/* Reback dialog */}
                    {showRebackDialog && (
                      <div className="p-3 border rounded-lg space-y-3 bg-amber-50/50 border-amber-200">
                        <p className="text-sm font-medium text-amber-800">
                          {ar ? "سبب الإرجاع" : "Return Reason"}
                        </p>
                        <Textarea
                          rows={3}
                          value={rebackReason}
                          onChange={(e) => setRebackReason(e.target.value)}
                          placeholder={ar ? "اكتب سبب إرجاع الطلب..." : "Enter reason for returning..."}
                          className="border-amber-200 focus-visible:ring-amber-500"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700"
                            onClick={() => rebackMutation.mutate()}
                            disabled={!rebackReason.trim() || rebackMutation.isPending}
                          >
                            {rebackMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <ArrowLeft className="w-4 h-4 mr-2" />
                            )}
                            {ar ? "تأكيد الإرجاع" : "Confirm Return"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setShowRebackDialog(false); setRebackReason(""); }}
                          >
                            {ar ? "إلغاء" : "Cancel"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Reject dialog */}
                    {showRejectDialog && (
                      <div className="p-3 border rounded-lg space-y-3 bg-muted/30">
                        <p className="text-sm font-medium">
                          {ar ? "سبب الرفض" : "Rejection Reason"}
                        </p>
                        <Textarea
                          rows={3}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={ar ? "اكتب سبب الرفض..." : "Enter rejection reason..."}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectMutation.mutate()}
                            disabled={!rejectReason.trim() || rejectMutation.isPending}
                          >
                            {rejectMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-2" />
                            )}
                            {ar ? "تأكيد الرفض" : "Confirm Reject"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setShowRejectDialog(false); setRejectReason(""); }}
                          >
                            {ar ? "إلغاء" : "Cancel"}
                          </Button>
                        </div>
                      </div>
                    )}
              </div>
            )}
            </div>
          </div>
        </div>

      {/* Housing Card — الحالة السكنية */}
      {request.status === "approved" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Home className="w-5 h-5" />
              {ar ? "السكن" : "Housing"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {request.guest_hosting_id ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {ar ? "طلب الاستضافة" : "Guest Hosting"}
                    </p>
                    {hostingStatusLabel && (
                      <StatusBadge
                        label={ar ? hostingStatusLabel.ar : hostingStatusLabel.en}
                        variant={hostingStatusVariant}
                      />
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/accommodation/guest-hosting`)}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    {ar ? "عرض" : "View"}
                  </Button>
                </div>
                {guestHosting && (
                  <div className="grid grid-cols-2 gap-3 text-sm p-3 bg-muted/30 rounded-lg">
                    <div>
                      <span className="text-muted-foreground">{ar ? "رقم الطلب" : "ID"}</span>
                      <p className="font-medium">#{guestHosting.id}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{ar ? "عدد الضيوف" : "Guests"}</span>
                      <p className="font-medium">{guestHosting.guestsCount}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{ar ? "من" : "From"}</span>
                      <p className="font-medium">{new Date(guestHosting.expectedFrom).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{ar ? "إلى" : "To"}</span>
                      <p className="font-medium">{new Date(guestHosting.expectedTo).toLocaleDateString()}</p>
                    </div>
                    {guestHosting.roomId && (
                      <div>
                        <span className="text-muted-foreground">{ar ? "الغرفة" : "Room"}</span>
                        <p className="font-medium">{guestHosting.roomId}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {ar
                    ? "الطلب معتمد. يمكنك الآن المتابعة إلى السكن لإنشاء طلب استضافة."
                    : "Request approved. Proceed to housing to create a guest hosting record."}
                </p>
                <Button
                  onClick={() => createGuestHostingMutation.mutate()}
                  disabled={createGuestHostingMutation.isPending}
                >
                  {createGuestHostingMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Home className="w-4 h-4 mr-2" />
                  )}
                  {ar ? "متابعة إلى السكن" : "Proceed to Housing"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Previous Requests Link */}
      <div className="flex justify-start pt-2">
        <Button variant="link" onClick={() => setLocation("/family-visit")}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          {ar ? "العودة إلى الطلبات" : "Back to Requests"}
        </Button>
      </div>
    </div>

);
}

================================================================================
FILE: artifacts/housing/src/pages/accommodation/guest-hosting
================================================================================

FILE NOT FOUND: artifacts/housing/src/pages/accommodation/guest-hosting

================================================================================
FILE: artifacts/api-server/src/routes/users.ts
================================================================================

import { Router } from "express";
import { db, pool, usersTable } from "@workspace/db";
import { eq, and, SQL, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
CreateUserBody,
UpdateUserBody,
GetUserParams,
UpdateUserParams,
DeleteUserParams,
ListUsersQueryParams,
ListUsersResponse,
GetUserResponse,
UpdateUserResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { requireAuth } from "../middlewares/permissions.js";
import { requirePermission } from "../middlewares/permissions.js";
import { BCRYPT_ROUNDS } from "../lib/security-constants.js";
import { getPasswordPolicy, validatePassword } from "../lib/password-policy.js";

const router: Router = Router();

// ℹ️ Schema column 'property_ids' is managed via migration (scripts/add-missing-indexes.sql)
// Do NOT run DDL here — it was removed to prevent startup delays and silent failures.

/\*_ Returns true if the roles array contains a system-admin role _/
function isSystemAdminRoles(roles: string[]): boolean {
return roles.some((role) =>
["super_admin", "system_admin", "admin"].includes(String(role).trim().toLowerCase()),
);
}

function requireUserUpdatePermission(req: any, res: any, next: any): void {
const guards: any[] = [];
if (
Object.prototype.hasOwnProperty.call(req.body ?? {}, "permissions") ||
Object.prototype.hasOwnProperty.call(req.body ?? {}, "roles")
) {
guards.push(requirePermission("users", "manage_permissions"));
}
if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "password")) {
guards.push(requirePermission("users", "reset_password"));
}
if (guards.length === 0) {
guards.push(requirePermission("users", "edit"));
}

let index = 0;
const run = (err?: any) => {
if (err) return next(err);
const guard = guards[index++];
if (!guard) return next();
return guard(req, res, run);
};
run();
}

// 1. جلب المستخدمين مع دعم كامل للمصفوفة و Server-side Pagination
router.get(
"/users",
requirePermission("users", "view"),
async (req, res): Promise<void> => {
const isSystemAdmin = (req.session as any)?.isSystemAdmin;
const sessionPropertyId = (req.session as any)?.propertyId;

    // Server-side pagination params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 50),
    );
    const offset = (page - 1) * limit;

    let rows: any;
    let totalRows: number;

    if (isSystemAdmin) {
      // Get total count for pagination
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM users`,
      );
      totalRows = parseInt(countResult.rows[0]?.count ?? 0);

      const result = await pool.query(
        `SELECT id, property_id, property_ids, username, email, phone, roles, permissions, status, created_at, failed_login_attempts, locked_until, job_title FROM users ORDER BY id LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      rows = result.rows;
    } else {
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM users
       WHERE property_id = $1
         AND NOT (($2 = ANY(roles)) OR ($3 = ANY(roles)) OR ($4 = ANY(roles)))`,
        [
          Number(sessionPropertyId),
          "super_admin",
          "system_admin",
          "SYSTEM_ADMIN",
        ],
      );
      totalRows = parseInt(countResult.rows[0]?.count ?? 0);

      const result = await pool.query(
        `SELECT id, property_id, property_ids, username, email, phone, roles, permissions, status, created_at, failed_login_attempts, locked_until, job_title FROM users
       WHERE property_id = $1
         AND NOT (($2 = ANY(roles)) OR ($3 = ANY(roles)) OR ($4 = ANY(roles)))
       ORDER BY id LIMIT $5 OFFSET $6`,
        [
          Number(sessionPropertyId),
          "super_admin",
          "system_admin",
          "SYSTEM_ADMIN",
          limit,
          offset,
        ],
      );
      rows = result.rows;
    }

    const actualRows = rows || [];
    const safeUsers = actualRows.map((u: any) => ({
      id: u.id,
      propertyId: u.property_id,
      propertyIds: u.property_ids ?? [],
      username: u.username,
      email: u.email ?? null,
      phone: u.phone ?? null,
      jobTitle: u.job_title ?? null,
      roles: u.roles ?? [],
      permissions: u.permissions ?? [],
      status:
        u.locked_until && new Date(u.locked_until) > new Date()
          ? "LOCKED"
          : u.status || "ACTIVE",
      createdAt: u.created_at,
    }));

    // Return paginated response with metadata
    res.json({
      data: safeUsers,
      pagination: {
        page,
        limit,
        total: totalRows,
        totalPages: Math.ceil(totalRows / limit),
      },
    });

},
);

// 2. إنشاء مستخدم جديد
router.post(
"/users",
requirePermission("users", "create"),
async (req, res): Promise<void> => {
const parsed = CreateUserBody.safeParse(req.body);
if (!parsed.success) {
res.status(400).json({ error: parsed.error.message });
return;
}
const { password, propertyIds, ...userData } = parsed.data as any;
if (
isSystemAdminRoles(userData.roles ?? []) &&
!(req.session as any)?.isSystemAdmin
) {
res
.status(403)
.json({ error: "Only system admins can create system admins" });
return;
}

    // ─── Validate password against policy ─────────────────────────────
    const policy = await getPasswordPolicy(userData.propertyId ?? 0);
    const pwdValidation = validatePassword(password, policy);
    if (!pwdValidation.valid) {
      res.status(400).json({ error: pwdValidation.errors.join("; ") });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const pids: number[] =
      propertyIds ?? (userData.propertyId ? [userData.propertyId] : []);

    const [user] = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(usersTable)
        .values({
          ...userData,
          passwordHash,
          email: userData.email || null,
          phone: userData.phone || null,
          permissions: userData.permissions ?? [],
        })
        .returning();

      if (pids.length > 0) {
        await tx.execute(
          sql`UPDATE users SET property_ids = ${pids}::int[] WHERE id = ${created.id}`,
        );
      }

      return [created];
    });

    const actorUsername = (req.session as any)?.username ?? "system";
    await logActivity({
      req,
      propertyId: userData.propertyId ?? pids[0] ?? 0,
      username: actorUsername,
      action: `Created user '${userData.username}'`,
      actionType: "CREATE",
      module: "users",
      severity: "info",
      entityType: "user",
      entityId: user.id,
    });

    const { passwordHash: _, ...safeUser } = user;
    const safeUserAny = safeUser as any;
    res.status(201).json({
      ...safeUser,
      email: safeUserAny.email || null,
      phone: safeUserAny.phone || null,
      propertyIds: pids,
    });

},
);

// 3. تحديث مستخدم (التعديل الجوهري هنا)
router.patch(
"/users/:id",
requireUserUpdatePermission,
async (req, res): Promise<void> => {
const params = UpdateUserParams.safeParse(req.params);
if (!params.success) {
res.status(400).json({ error: params.error.message });
return;
}

    const [targetUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.id))
      .limit(1);
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const requesterIsSystemAdmin = (req.session as any)?.isSystemAdmin;
    if (isSystemAdminRoles(targetUser.roles ?? []) && !requesterIsSystemAdmin) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    const parsed = UpdateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { password, propertyIds, ...updateData } = parsed.data as any;

    // تحقق من تغيير اسم المستخدم - يجب أن يكون فريداً
    if (updateData.username && updateData.username !== targetUser.username) {
      const [existingUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.username, updateData.username))
        .limit(1);
      if (existingUser) {
        res.status(400).json({ error: "Username already exists" });
        return;
      }
    }

    if (
      updateData.roles &&
      isSystemAdminRoles(updateData.roles) &&
      !requesterIsSystemAdmin
    ) {
      res
        .status(403)
        .json({ error: "Only system admins can grant system-admin roles" });
      return;
    }
    let extraData: any = {};
    if (password) {
      // ─── Validate password against policy ───────────────────────────
      const policy = await getPasswordPolicy(
        updateData.propertyId ?? targetUser.propertyId ?? 0,
      );
      const pwdValidation = validatePassword(password, policy);
      if (!pwdValidation.valid) {
        res.status(400).json({ error: pwdValidation.errors.join("; ") });
        return;
      }
      extraData.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      extraData.passwordChangedAt = new Date();
    }

    let updated: any;
    const hasFieldsToUpdate =
      Object.keys(updateData).length > 0 || Object.keys(extraData).length > 0;

    if (hasFieldsToUpdate) {
      const rows = await db
        .update(usersTable)
        .set({ ...updateData, ...extraData })
        .where(eq(usersTable.id, params.data.id))
        .returning();
      updated = rows[0];
    } else {
      updated = { ...targetUser };
    }

    // تحديث الـ Property IDs بشكل صحيح (سواء كانت مصفوفة جديدة أو فارغة)
    if (Array.isArray(propertyIds)) {
      const arrLiteral = `{${propertyIds.join(",")}}`;
      const primaryId =
        propertyIds.length > 0 ? propertyIds[0] : targetUser.propertyId;

      // تنفيذ التحديث مباشرة في الداتا بيز كـ Array
      await pool.query(
        `UPDATE users SET property_ids = $1, property_id = $2 WHERE id = $3`,
        [propertyIds, primaryId, params.data.id],
      );

      // تحديث الكائن الذي سيتم إرساله للفرونت إند ليعكس التغيير فوراً
      updated.property_ids = propertyIds;
      updated.property_id = primaryId;
    }

    // Activity log...
    const actorUsername2 = (req.session as any)?.username ?? "system";
    const oldRoles: string[] = targetUser.roles ?? [];
    const newRoles: string[] = updateData.roles ?? oldRoles;
    const oldPerms: string[] = targetUser.permissions ?? [];
    const newPerms: string[] = updateData.permissions ?? oldPerms;

    const rolesChanged = JSON.stringify(oldRoles) !== JSON.stringify(newRoles);
    const permsChanged = JSON.stringify(oldPerms) !== JSON.stringify(newPerms);

    let actionDetail = `Updated user '${targetUser.username}'`;
    if (rolesChanged)
      actionDetail += ` | Roles: [${oldRoles.join(",")}] → [${newRoles.join(",")}]`;
    if (permsChanged) {
      const added = newPerms.filter((p) => !oldPerms.includes(p));
      const removed = oldPerms.filter((p) => !newPerms.includes(p));
      if (added.length) actionDetail += ` | Perms added: [${added.join(",")}]`;
      if (removed.length)
        actionDetail += ` | Perms removed: [${removed.join(",")}]`;
    }

    await logActivity({
      req,
      propertyId: updated.property_id ?? 0,
      username: actorUsername2,
      action: actionDetail,
      actionType: "UPDATE",
      module: "users",
      severity: rolesChanged || permsChanged ? "warning" : "info",
      entityType: "user",
      entityId: params.data.id,
    });

    // إرجاع البيانات المعدلة مع التأكد من تسمية الحقول كما يتوقعها الفرونت إند
    res.json({
      id: updated.id,
      username: updated.username,
      email: updated.email || null,
      phone: updated.phone || null,
      propertyId: updated.property_id,
      propertyIds: updated.property_ids ?? propertyIds ?? [],
      roles: updated.roles,
      permissions: updated.permissions,
      status: updated.status,
    });

},
);

// Unlock user account (reset failedLoginAttempts, clear lockedUntil)
router.post(
"/users/:id/unlock",
requirePermission("users", "unlock"),
async (req, res): Promise<void> => {
const id = Number(req.params.id);
if (!id) {
res.status(400).json({ error: "Invalid user ID" });
return;
}

    const [targetUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (
      isSystemAdminRoles(targetUser.roles ?? []) &&
      !(req.session as any)?.isSystemAdmin
    ) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    await pool.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
      [id],
    );

    const actorUsername = (req.session as any)?.username ?? "system";
    await logActivity({
      req,
      propertyId: targetUser.propertyId ?? 0,
      username: actorUsername,
      action: `Unlocked user '${targetUser.username}' (was locked)`,
      actionType: "UPDATE",
      module: "users",
      severity: "info",
      entityType: "user",
      entityId: id,
    });

    res.json({
      success: true,
      message: `User '${targetUser.username}' unlocked`,
    });

},
);

router.delete(
"/users/:id",
requirePermission("users", "delete"),
async (req, res): Promise<void> => {
const params = DeleteUserParams.safeParse(req.params);
if (!params.success) {
res.status(400).json({ error: params.error.message });
return;
}

    const [targetUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.id))
      .limit(1);
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const requesterIsSystemAdmin = (req.session as any)?.isSystemAdmin;
    if (isSystemAdminRoles(targetUser.roles ?? []) && !requesterIsSystemAdmin) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    await db.delete(usersTable).where(eq(usersTable.id, params.data.id));
    res.sendStatus(204);

},
);

// ─── PATCH /users/me/last-property ──────────────────────────────────────
router.patch(
"/users/me/last-property",
requireAuth,
async (req, res): Promise<void> => {
const userId = (req.session as any)?.userId;
if (!userId) {
res.status(401).json({ error: "Not authenticated" });
return;
}

    const { propertyId } = req.body as { propertyId?: number };
    if (propertyId == null || typeof propertyId !== "number") {
      res.status(400).json({ error: "propertyId (number) is required" });
      return;
    }

    await db
      .update(usersTable)
      .set({ lastPropertyId: propertyId } as any)
      .where(eq(usersTable.id, userId));
    res.json({ success: true });

},
);

export default router;

================================================================================
FILE: artifacts/api-server/src/routes/auth.ts
================================================================================

import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { LoginBody, ChangePasswordBody } from "@workspace/api-zod";
import { logActivity, getClientIp } from "../lib/activity-logger.js";
import {
loginRateLimit,
changePasswordRateLimit,
resetLoginAttempts,
} from "../middlewares/rate-limit.js";
import {
getPasswordPolicy,
validatePassword,
checkPasswordHistory,
recordPasswordHistory,
cleanupOldPasswordHistory,
isPasswordExpired,
PasswordPolicy,
} from "../lib/password-policy.js";
import { BCRYPT_ROUNDS } from "../lib/security-constants.js";
import { formatZodError } from "../utils/error-response.js";

const router: Router = Router();

const normalizeRole = (role: unknown): string =>
String(role ?? "")
.trim()
.toLowerCase();

// ─── POST /auth/login ─────────────────────────────────────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
const parsed = LoginBody.safeParse(req.body);
if (!parsed.success) {
const ar = (req.headers["accept-language"] ?? "")
.toLowerCase()
.startsWith("ar");
res
.status(400)
.json({ success: false, message: formatZodError(parsed.error, ar) });
return;
}

const { username, password } = parsed.data;
const ip = getClientIp(req);

const [user] = await db
.select()
.from(usersTable)
.where(sql`lower(${usersTable.username}) = lower(${username.trim()})`)
.limit(1);

if (!user) {
res.status(401).json({ error: "Invalid credentials" });
return;
}

const propertyId = user.propertyId ?? 0;
const policy = propertyId
? await getPasswordPolicy(propertyId)
: await getPasswordPolicy(0);

// ─── Account Lockout Check ──────────────────────────────────────────
if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
const remaining = Math.ceil(
(new Date(user.lockedUntil).getTime() - Date.now()) / 60000,
);
logActivity({
req,
propertyId,
username,
userId: user.id,
userRole: user.roles?.[0],
action: "LOGIN_BLOCKED_LOCKED",
actionType: "SECURITY",
module: "auth",
severity: "warning",
details: `Blocked login attempt from ${ip} — account locked for ${remaining} more minutes`,
ipAddress: ip,
});
res.status(423).json({
error: `الحساب مقفل. حاول مرة أخرى بعد ${remaining} دقيقة`,
code: "ACCOUNT_LOCKED",
retryAfterMinutes: remaining,
});
return;
}

const valid = await bcrypt.compare(password, user.passwordHash);
if (!valid) {
const threshold = policy.lockoutThreshold ?? 5;

    // Atomic SQL increment to prevent race-condition undercounting
    // Two parallel failed requests could each read the same count and write count+1,
    // both bypassing the lockout threshold. SET x = x + 1 eliminates the read-modify-write gap.
    await db
      .update(usersTable)
      .set({
        failedLoginAttempts: sql`${usersTable.failedLoginAttempts} + 1`,
        lockedUntil: sql`CASE
          WHEN ${usersTable.failedLoginAttempts} + 1 >= ${threshold}
          THEN NOW() + INTERVAL '1 minute' * ${policy.lockoutDurationMinutes ?? 15}
          ELSE NULL
        END`,
      })
      .where(eq(usersTable.id, user.id));

    // Re-fetch the post-update row to get the accurate count and lockout state
    const [updated] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);

    const newCount = updated.failedLoginAttempts ?? 0;
    const lockedUntil = updated.lockedUntil;
    const remainingBeforeLock = Math.max(0, threshold - newCount);

    if (lockedUntil && new Date(lockedUntil) > new Date()) {
      const lockMinutes = policy.lockoutDurationMinutes ?? 15;

      logActivity({
        req,
        propertyId,
        username,
        userId: user.id,
        userRole: user.roles?.[0],
        action: "ACCOUNT_LOCKED",
        actionType: "SECURITY",
        module: "auth",
        severity: "high",
        details: `Account locked for ${lockMinutes} minutes after ${newCount} failed attempts from ${ip}`,
        ipAddress: ip,
      });

      res.status(423).json({
        error: `تم قفل الحساب. حاول مرة أخرى بعد ${lockMinutes} دقيقة`,
        code: "ACCOUNT_LOCKED",
        lockedUntil: lockedUntil.toISOString(),
        retryAfterMinutes: lockMinutes,
      });
      return;
    }

    logActivity({
      req,
      propertyId,
      username,
      userId: user.id,
      userRole: user.roles?.[0],
      action: "LOGIN_FAILED",
      actionType: "SECURITY",
      module: "auth",
      severity: "warning",
      details: `Failed login attempt ${newCount}/${threshold} from ${ip}`,
      ipAddress: ip,
    });

    res.status(401).json({
      error: `بيانات الدخول غير صحيحة. متبقي ${remainingBeforeLock} محاولات قبل قفل الحساب`,
      code: "INVALID_CREDENTIALS",
      failedAttempts: newCount,
      maxAttempts: threshold,
      remainingAttempts: remainingBeforeLock,
    });
    return;

}

if (user.status?.toLowerCase() === "inactive") {
res.status(401).json({ error: "Account disabled" });
return;
}

// ─── Reset lockout counters on success ──────────────────────────────
await db
.update(usersTable)
.set({
failedLoginAttempts: 0,
lockedUntil: null,
lastLoginAt: new Date(),
})
.where(eq(usersTable.id, user.id));

// ✅ إعادة تعيين عداد rate limit بعد نجاح الدخول
resetLoginAttempts(req);

// ─── Check password expiry ──────────────────────────────────────────
const passwordExpired = await isPasswordExpired(user, policy);

// ✅ Session Regeneration — prevents Session Fixation Attack
const roles = (user.roles ?? []).map(normalizeRole);
const isSystemAdmin =
roles.includes("super_admin") || roles.includes("system_admin") || roles.includes("admin");

const sessionData = {
userId: user.id,
propertyId: user.propertyId,
isSystemAdmin,
username: user.username,
userRole: user.roles?.[0] ?? null,
jobTitle: user.jobTitle ?? null,
loginAt: Date.now(),
passwordExpired,
};

req.session.regenerate((err) => {
if (err) {
res.status(500).json({ error: "Session error" });
return;
}

    Object.assign(req.session, sessionData);

    if (user.propertyId) {
      logActivity({
        req,
        propertyId: user.propertyId ?? 0,
        username: user.username,
        userId: user.id,
        userRole: user.roles?.[0],
        action: "LOGIN",
        actionType: "AUTH",
        module: "auth",
        severity: "info",
        details: `User logged in from ${ip}${passwordExpired ? " (password expired)" : ""}`,
        ipAddress: ip,
      });
    }

    const { passwordHash: _, ...safeUser } = user;
    res.json({
      user: {
        ...safeUser,
        isSystemAdmin: sessionData.isSystemAdmin,
        passwordExpired,
      },
    });

});
});

// ─── POST /auth/logout ────────────────────────────────────────────────────
router.post("/auth/logout", async (req, res): Promise<void> => {
const session = req.session as any;
const userId = session?.userId;
const propertyId = session?.propertyId;

if (userId && propertyId) {
const [user] = await db
.select()
.from(usersTable)
.where(eq(usersTable.id, userId))
.limit(1);
if (user) {
logActivity({
req,
propertyId,
username: user.username,
userId: user.id,
userRole: user.roles?.[0],
action: "LOGOUT",
actionType: "AUTH",
module: "auth",
severity: "info",
details: "User logged out",
ipAddress: getClientIp(req),
});
}
}

req.session.destroy((err) => {
// Always clear cookie and respond, even if session store is unreachable
// (e.g., Redis/PG down). Otherwise, the client hangs indefinitely.
if (err) {
console.error("Session destroy error:", err.message);
}
res.clearCookie("sunrise.sid");
res.json({ message: "Logged out" });
});
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────
router.get("/auth/me", async (req, res): Promise<void> => {
const userId = (req.session as any)?.userId;
if (!userId) {
res.status(401).json({ error: "Not authenticated" });
return;
}

const [user] = await db
.select()
.from(usersTable)
.where(eq(usersTable.id, userId))
.limit(1);
if (!user) {
req.session.destroy(() => {});
res.status(401).json({ error: "User not found" });
return;
}

const roles = (user.roles ?? []).map(normalizeRole);
const isSystemAdmin =
roles.includes("super_admin") || roles.includes("system_admin") || roles.includes("admin");

const session = req.session as any;
const passwordExpired = session?.passwordExpired ?? false;

const { passwordHash: \_, ...safeUser } = user;
res.json({ ...safeUser, isSystemAdmin, passwordExpired });
});

// ─── POST /auth/change-password ───────────────────────────────────────────
router.post(
"/auth/change-password",
changePasswordRateLimit,
async (req, res): Promise<void> => {
const userId = (req.session as any)?.userId;
if (!userId) {
res.status(401).json({ error: "Not authenticated" });
return;
}

    const parsed = ChangePasswordBody.safeParse(req.body);
    if (!parsed.success) {
      const ar = (req.headers["accept-language"] ?? "")
        .toLowerCase()
        .startsWith("ar");
      res
        .status(400)
        .json({ success: false, message: formatZodError(parsed.error, ar) });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const valid = await bcrypt.compare(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const propertyId = user.propertyId ?? 0;
    const policy = propertyId
      ? await getPasswordPolicy(propertyId)
      : await getPasswordPolicy(0);

    // ─── Validate new password against policy ───────────────────────────
    const validation = validatePassword(parsed.data.newPassword, policy);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors.join("; ") });
      return;
    }

    // ─── Check password history (reuse prevention) ──────────────────────
    const historyError = await checkPasswordHistory(
      userId,
      parsed.data.newPassword,
      policy.historyCount,
    );
    if (historyError) {
      res.status(400).json({ error: historyError });
      return;
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);

    await db
      .update(usersTable)
      .set({
        passwordHash: newHash,
        passwordChangedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));

    // ─── Record password history ────────────────────────────────────────
    await recordPasswordHistory(userId, newHash);
    await cleanupOldPasswordHistory(userId, policy.historyCount);

    // Clear passwordExpired flag from session
    const session = req.session as any;
    if (session) {
      session.passwordExpired = false;
    }

    const ip = getClientIp(req);
    logActivity({
      req,
      propertyId: user.propertyId ?? 0,
      username: user.username,
      userId: user.id,
      userRole: user.roles?.[0],
      action: "PASSWORD_CHANGED",
      actionType: "SECURITY",
      module: "auth",
      severity: "info",
      ipAddress: ip,
    });

    res.json({ message: "Password changed successfully" });

},
);

// ─── POST /auth/switch-property ───────────────────────────────────────────
router.post("/auth/switch-property", async (req, res): Promise<void> => {
const session = req.session as any;
const userId = session?.userId;
if (!userId) {
res.status(401).json({ error: "Not authenticated" });
return;
}

const newPropertyId = Number(req.body?.propertyId);
// Guard against NaN, zero, negative values that could slip past DB constraints
if (!Number.isFinite(newPropertyId) || newPropertyId <= 0) {
res.status(400).json({ error: "A valid positive propertyId is required" });
return;
}

const [user] = await db
.select()
.from(usersTable)
.where(eq(usersTable.id, userId))
.limit(1);
if (!user) {
res.status(404).json({ error: "User not found" });
return;
}

// Use normalizeRole (defined above) for consistent case-insensitive role matching
// Previously used `user.roles.includes("SYSTEM_ADMIN")` — that (uppercase) never matched
// the lowercase-stored roles, silently denying system admins the bypass they should have.
const isSystemAdmin =
(user.roles ?? []).map(normalizeRole).includes("super_admin") ||
(user.roles ?? []).map(normalizeRole).includes("system_admin");

if (!isSystemAdmin) {
const allowedIds: number[] = (user as any).propertyIds?.length
? (user as any).propertyIds
: user.propertyId
? [user.propertyId]
: [];
if (!allowedIds.includes(newPropertyId)) {
// Log denied attempts — could indicate privilege escalation probing
logActivity({
req,
propertyId: newPropertyId,
username: user.username,
userId: user.id,
userRole: user.roles?.[0],
action: "PROPERTY_SWITCH_DENIED",
actionType: "SECURITY",
module: "auth",
severity: "warning",
details: `Access denied switching to property ${newPropertyId} (allowed: ${JSON.stringify(allowedIds)})`,
ipAddress: getClientIp(req),
});
res.status(403).json({ error: "Access denied to this property" });
return;
}
}

const oldPropertyId = session.propertyId;
session.propertyId = newPropertyId;

await new Promise<void>((resolve, reject) =>
req.session.save((err: any) => (err ? reject(err) : resolve())),
);

if (oldPropertyId !== newPropertyId) {
logActivity({
req,
propertyId: newPropertyId,
username: user.username,
userId: user.id,
userRole: user.roles?.[0],
action: "PROPERTY_SWITCH",
actionType: "UPDATE",
module: "auth",
severity: "info",
details: `Switched from property ${oldPropertyId ?? "none"} to ${newPropertyId}`,
ipAddress: getClientIp(req),
});
}

res.json({ success: true, propertyId: newPropertyId });
});

export default router;

================================================================================
FILE: artifacts/housing/src/pages/users/index.tsx
================================================================================

// @ts-nocheck
import { useState, useMemo } from "react";
import {
useListUsers,
useListProperties,
getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import {
Table,
TableBody,
TableCell,
TableHead,
TableHeader,
TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuTrigger,
DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import {
Trash,
UserCog,
ShieldCheck,
Shield,
KeyRound,
Building2,
Search,
Users,
Crown,
Briefcase,
Headphones,
Wrench,
MoreVertical,
Unlock,
X,
Pen,
Upload,
} from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import {
ColumnChooser,
useColumnVisibility,
} from "@/components/ui/column-chooser";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import \* as XLSX from "xlsx";
import { DataPagination } from "@/components/DataPagination";
import {
ErrorState,
EmptyState,
TableSkeleton,
} from "@/components/ui/page-states";

// Import extracted components
import { PermissionMatrixDialog } from "./components/PermissionMatrixDialog";
import { EditUserDialog } from "./components/EditUserDialog";
import { EditPropertiesDialog } from "./components/EditPropertiesDialog";
import { CreateUserDialog } from "./components/CreateUserDialog";
import { ResetPasswordDialog } from "./components/ResetPasswordDialog";
import { DeleteUserDialog } from "./components/DeleteUserDialog";
import { UnlockUserDialog } from "./components/UnlockUserDialog";
import { UploadSignatureDialog } from "./components/UploadSignatureDialog";

import { SYSTEM_ROLES, WORKFLOW_ROLES, roleColor } from "./utils";
const ALL_ROLES = [...SYSTEM_ROLES, ...WORKFLOW_ROLES];

export default function UsersPage() {
const { user: currentUser } = useAuth();
const { isSuperAdmin } = useProperty();
const { language } = useLanguage();
const ar = language === "ar";
const queryClient = useQueryClient();

const [deleteUser, setDeleteUser] = useState<any | null>(null);
const [matrixUser, setMatrixUser] = useState<any | null>(null);
const [pageSize, setPageSize] = useState(10);
const [currentPage, setCurrentPage] = useState(1);
const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
const [resetUser, setResetUser] = useState<any | null>(null);
const [searchQuery, setSearchQuery] = useState("");
const [roleFilter, setRoleFilter] = useState<string>("all");
const [statusFilter, setStatusFilter] = useState<string>("all");
const [editUser, setEditUser] = useState<any | null>(null);
const [unlockUser, setUnlockUser] = useState<any | null>(null);
const [editPropsUser, setEditPropsUser] = useState<any | null>(null);
const [signatureUser, setSignatureUser] = useState<any | null>(null);

const {
data: \_apiResponseWrapper,
isLoading,
isError,
refetch,
} = useListUsers({ page: currentPage, limit: pageSize as any });
const { data: properties } = useListProperties();

const users = \_apiResponseWrapper?.data ?? [];
const pagination = \_apiResponseWrapper?.pagination;

const invalidate = () =>
queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

const isUserLocked = (u: any) => u.status === "LOCKED";

// ── Enterprise: filtered + searched users ──
const filteredUsers = useMemo(() => {
let list = users || [];
if (searchQuery.trim()) {
const q = searchQuery.toLowerCase();
list = list.filter((u: any) => u.username.toLowerCase().includes(q));
}
if (roleFilter !== "all") {
list = list.filter((u: any) =>
u.roles?.some((r: string) => r.toLowerCase() === roleFilter),
);
}
if (statusFilter !== "all") {
list = list.filter(
(u: any) =>
(u.status || "").toUpperCase() === statusFilter.toUpperCase(),
);
}
return list;
}, [users, searchQuery, roleFilter, statusFilter]);

// ── Optimized Stats (Single Pass) ──
const stats = useMemo(() => {
const all = users || [];
const s = {
total: all.length,
superAdmin: 0,
admin: 0,
manager: 0,
receptionist: 0,
maintenance: 0,
active: 0,
};
for (const u of all) {
if (u.status === "ACTIVE") s.active++;
const roles = u.roles || [];
if (roles.some((r: string) => r.toLowerCase() === "super_admin"))
s.superAdmin++;
if (roles.some((r: string) => r.toLowerCase() === "admin")) s.admin++;
if (roles.some((r: string) => r.toLowerCase() === "manager")) s.manager++;
if (roles.some((r: string) => r.toLowerCase() === "receptionist"))
s.receptionist++;
if (roles.some((r: string) => r.toLowerCase() === "maintenance_staff"))
s.maintenance++;
}
return s;
}, [users]);

const ROLE_TABS = [
{ id: "all", label: ar ? "الكل" : "All", icon: Users, count: stats.total },
{
id: "super_admin",
label: ar ? "سوبر ادمن" : "Super Admin",
icon: Crown,
count: stats.superAdmin,
},
{
id: "admin",
label: ar ? "ادمن" : "Admin",
icon: ShieldCheck,
count: stats.admin,
},
{
id: "manager",
label: ar ? "مدير" : "Manager",
icon: Briefcase,
count: stats.manager,
},
{
id: "receptionist",
label: ar ? "استقبال" : "Receptionist",
icon: Headphones,
count: stats.receptionist,
},
{
id: "maintenance_staff",
label: ar ? "صيانة" : "Maintenance",
icon: Wrench,
count: stats.maintenance,
},
];

const USER_COLS = [
{
key: "username",
label: "Username",
labelAr: "اسم المستخدم",
defaultVisible: true,
},
{
key: "email",
label: "Email",
labelAr: "البريد الإلكتروني",
defaultVisible: true,
},
{ key: "phone", label: "Phone", labelAr: "الهاتف", defaultVisible: true },
{ key: "roles", label: "Roles", labelAr: "الأدوار", defaultVisible: true },
{
key: "property",
label: "Property",
labelAr: "البروبرتي",
defaultVisible: true,
},
{
key: "permissions",
label: "Permissions",
labelAr: "الصلاحيات",
defaultVisible: true,
},
{ key: "status", label: "Status", labelAr: "الحالة", defaultVisible: true },
{
key: "actions",
label: "Actions",
labelAr: "إجراءات",
defaultVisible: true,
fixed: true,
},
];
const {
visible: uVisible,
toggle: uToggle,
showAll: uShowAll,
hideAll: uHideAll,
isVisible: isUVisible,
} = useColumnVisibility(USER_COLS);

const pagedUsers = filteredUsers.slice(
(currentPage - 1) _ pageSize,
currentPage _ pageSize,
);
const pagedUserIds = pagedUsers.map((u: any) => u.id);
const allUserPageSelected =
pagedUserIds.length > 0 &&
pagedUserIds.every((id: number) => selectedRows.has(id));

const toggleSelectAllUser = () => {
if (allUserPageSelected) {
setSelectedRows((prev) => {
const next = new Set(prev);
pagedUserIds.forEach((id: number) => next.delete(id));
return next;
});
} else {
setSelectedRows((prev) => {
const next = new Set(prev);
pagedUserIds.forEach((id: number) => next.add(id));
return next;
});
}
};

const toggleUserRow = (id: number) => {
setSelectedRows((prev) => {
const next = new Set(prev);
next.has(id) ? next.delete(id) : next.add(id);
return next;
});
};

const exportUserExcel = () => {
const all: any[] = users || [];
const target =
selectedRows.size > 0
? all.filter((u: any) => selectedRows.has(u.id))
: all;
const rows = target.map((u: any) => ({
Username: u.username,
Email: u.email || "",
Phone: u.phone || "",
Roles: (u.roles || []).join(", "),
Status: u.status ?? "",
}));
const ws = XLSX.utils.json*to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Users");
XLSX.writeFile(wb, `users*${new Date().toISOString().slice(0, 10)}.xlsx`);
};

return (

<div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
{/_ Dynamic Dialogs _/}
{matrixUser && (
<PermissionMatrixDialog
user={matrixUser}
onClose={() => setMatrixUser(null)}
/>
)}
{editUser && (
<EditUserDialog user={editUser} onClose={() => setEditUser(null)} />
)}
{editPropsUser && (
<EditPropertiesDialog
user={editPropsUser}
properties={properties ?? []}
onClose={() => setEditPropsUser(null)}
onSuccess={invalidate}
/>
)}
{resetUser && (
<ResetPasswordDialog
user={resetUser}
onClose={() => setResetUser(null)}
/>
)}
{deleteUser && (
<DeleteUserDialog
user={deleteUser}
onClose={() => setDeleteUser(null)}
/>
)}
{unlockUser && (
<UnlockUserDialog
user={unlockUser}
onClose={() => setUnlockUser(null)}
/>
)}
{signatureUser && (
<UploadSignatureDialog
user={signatureUser}
onClose={() => setSignatureUser(null)}
/>
)}

      {/* ── Enterprise Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A24D] to-[#0F2A44] flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {ar ? "إدارة المستخدمين والصلاحيات" : "Users & Permissions"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {ar
                  ? "إدارة المستخدمين والأدوار وصلاحيات الوصول"
                  : "Manage system users, roles, and granular access control"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ColumnChooser
            cols={USER_COLS}
            visible={uVisible}
            onToggle={uToggle}
            onShowAll={uShowAll}
            onHideAll={uHideAll}
            ar={ar}
          />
          <CreateUserDialog properties={properties ?? []} />
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: ar ? "إجمالي المستخدمين" : "Total Users",
            count: stats.total,
            icon: Users,
            color:
              "from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800/40",
            iconColor: "text-blue-600 dark:text-blue-400",
          },
          {
            label: ar ? "سوبر أدمن" : "Super Admin",
            count: stats.superAdmin,
            icon: Crown,
            color:
              "from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800/40",
            iconColor: "text-purple-600 dark:text-purple-400",
          },
          {
            label: ar ? "أدمن" : "Admin",
            count: stats.admin,
            icon: ShieldCheck,
            color:
              "from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800/40",
            iconColor: "text-red-600 dark:text-red-400",
          },
          {
            label: ar ? "مدير" : "Manager",
            count: stats.manager,
            icon: Briefcase,
            color:
              "from-sky-500/10 to-sky-600/5 border-sky-200 dark:border-sky-800/40",
            iconColor: "text-sky-600 dark:text-sky-400",
          },
          {
            label: ar ? "استقبال" : "Receptionist",
            count: stats.receptionist,
            icon: Headphones,
            color:
              "from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800/40",
            iconColor: "text-green-600 dark:text-green-400",
          },
          {
            label: ar ? "صيانة" : "Maintenance",
            count: stats.maintenance,
            icon: Wrench,
            color:
              "from-orange-500/10 to-orange-600/5 border-orange-200 dark:border-orange-800/40",
            iconColor: "text-orange-600 dark:text-orange-400",
          },
        ].map((card, i) => (
          <div
            key={i}
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${card.color} p-4 transition-all hover:shadow-md`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {card.label}
                </p>
                <p className="text-2xl font-bold mt-1">{card.count}</p>
              </div>
              <card.icon className={`w-8 h-8 ${card.iconColor} opacity-60`} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={ar ? "بحث بالاسم..." : "Search users by name..."}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10 rtl:pr-10 rtl:pl-3 h-10"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${ar ? 'left-3' : 'right-3'}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[150px] h-10">
            <SelectValue placeholder={ar ? "الحالة" : "Status"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {ar ? "كل الحالات" : "All Status"}
            </SelectItem>
            <SelectItem value="ACTIVE">{ar ? "نشط" : "Active"}</SelectItem>
            <SelectItem value="LOCKED">{ar ? "مقفول" : "Locked"}</SelectItem>
            <SelectItem value="INACTIVE">
              {ar ? "غير نشط" : "Inactive"}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Role Filter Tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {ROLE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setRoleFilter(tab.id);
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-all ${
              roleFilter === tab.id
                ? "bg-[#0F2A44] text-white border-[#0F2A44] shadow-md shadow-[#0F2A44]/20"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-[#C9A24D]/40"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                roleFilter === tab.id ? "bg-white/20" : "bg-muted"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <BulkActionBar
        count={selectedRows.size}
        onClear={() => setSelectedRows(new Set())}
        onExportExcel={exportUserExcel}
        ar={ar}
      />

      {/* ── Results count ── */}
      {(searchQuery || roleFilter !== "all" || statusFilter !== "all") && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {ar
              ? `عرض ${filteredUsers.length} من ${stats.total} مستخدم`
              : `Showing ${filteredUsers.length} of ${stats.total} users`}
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setRoleFilter("all");
              setStatusFilter("all");
            }}
            className="text-xs text-[#C9A24D] hover:underline"
          >
            {ar ? "مسح الفلاتر" : "Clear filters"}
          </button>
        </div>
      )}

      {/* ── Main Table ── */}
      {isError ? (
        <ErrorState
          onRetry={() => refetch()}
          className="border rounded-xl bg-card my-4"
        />
      ) : isLoading ? (
        <TableSkeleton rows={5} columns={8} className="my-4" />
      ) : pagedUsers.length === 0 ? (
        <EmptyState
          title={ar ? "لا يوجد مستخدمين" : "No users found"}
          description={ar ? "لم يتم العثور على أي مستخدمين يتطابقون مع البحث." : "No users found matching your search criteria."}
          className="border rounded-xl bg-card my-4"
        />
      ) : (
        <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-10 px-3">
                  <Checkbox
                    checked={allUserPageSelected}
                    onCheckedChange={toggleSelectAllUser}
                  />
                </TableHead>
                {isUVisible("username") && (
                  <TableHead className="font-semibold">
                    {ar ? "اسم المستخدم" : "Username"}
                  </TableHead>
                )}
                {isUVisible("email") && (
                  <TableHead className="font-semibold">
                    {ar ? "البريد الإلكتروني" : "Email"}
                  </TableHead>
                )}
                {isUVisible("phone") && (
                  <TableHead className="font-semibold">
                    {ar ? "الهاتف" : "Phone"}
                  </TableHead>
                )}
                {isUVisible("roles") && (
                  <TableHead className="font-semibold">
                    {ar ? "الدور" : "Role"}
                  </TableHead>
                )}
                {isUVisible("property") && isSuperAdmin && (
                  <TableHead className="font-semibold">
                    {ar ? "البروبرتي" : "Property"}
                  </TableHead>
                )}
                {isUVisible("permissions") && (
                  <TableHead className="font-semibold">
                    {ar ? "الصلاحيات" : "Permissions"}
                  </TableHead>
                )}
                {isUVisible("status") && (
                  <TableHead className="font-semibold">
                    {ar ? "الحالة" : "Status"}
                  </TableHead>
                )}
                {isUVisible("actions") && (
                  <TableHead className="font-semibold">
                    {ar ? "إجراءات" : "Actions"}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedUsers.map((u: any) => {
                const isUserSelected = selectedRows.has(u.id);
                const explicit = (u as any).permissions as string[] | undefined;
                const permCount = explicit?.length ?? 0;
                return (
                  <TableRow
                    key={u.id}
                    className={
                      isUserSelected ? "bg-primary/5" : "hover:bg-muted/20"
                    }
                  >
                    <TableCell className="px-3">
                      <Checkbox
                        checked={isUserSelected}
                        onCheckedChange={() => toggleUserRow(u.id)}
                      />
                    </TableCell>
                    {isUVisible("username") && (
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white ${u.roles?.some((r: string) => r.toLowerCase() === "super_admin") ? "bg-gradient-to-br from-purple-500 to-purple-700" : u.roles?.some((r: string) => r.toLowerCase() === "admin") ? "bg-gradient-to-br from-red-500 to-red-700" : "bg-gradient-to-br from-[#0F2A44] to-[#1a3d5c]"}`}
                          >
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-sm">
                              {u.username}
                            </span>
                            {u.username === currentUser?.username && (
                              <Badge
                                variant="outline"
                                className="text-[10px] ms-2 rtl:mr-2 rtl:ml-0 border-[#C9A24D]/40 text-[#C9A24D]"
                              >
                                {ar ? "أنت" : "You"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {isUVisible("email") && (
                      <TableCell className="max-w-xs">
                        <div
                          className="text-sm text-muted-foreground truncate"
                          title={(u as any).email || "-"}
                        >
                          {(u as any).email ? (
                            <a
                              href={`mailto:${(u as any).email}`}
                              className="text-blue-600 hover:underline truncate block"
                            >
                              {(u as any).email}
                            </a>
                          ) : (
                            <span className="italic text-gray-400">—</span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isUVisible("phone") && (
                      <TableCell className="max-w-xs">
                        <div
                          className="text-sm text-muted-foreground truncate"
                          title={(u as any).phone || "-"}
                        >
                          {(u as any).phone ? (
                            <a
                              href={`tel:${(u as any).phone}`}
                              className="text-blue-600 hover:underline truncate block"
                            >
                              {(u as any).phone}
                            </a>
                          ) : (
                            <span className="italic text-gray-400">—</span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isUVisible("roles") && (
                      <TableCell className="min-w-max">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(u.roles || []).slice(0, 2).map((r: string) => (
                            <span
                              key={r}
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${roleColor(r)}`}
                            >
                              {ALL_ROLES.find(
                                (x: any) => x.value === r.toLowerCase(),
                              )?.label ?? r.replace(/_/g, " ")}
                            </span>
                          ))}
                          {(u.roles || []).length > 2 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300 whitespace-nowrap">
                              +{(u.roles || []).length - 2}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isUVisible("property") && isSuperAdmin && (
                      <TableCell>
                        {(() => {
                          const pids: number[] = (u as any).propertyIds?.length
                            ? (u as any).propertyIds
                            : (u as any).propertyId
                              ? [(u as any).propertyId]
                              : [];
                          if (!pids.length)
                            return (
                              <span className="text-xs text-muted-foreground italic">
                                Global
                              </span>
                            );
                          return (
                            <div className="flex flex-wrap gap-1">
                              {pids.map((pid) => {
                                const p = properties?.find((x) => x.id === pid);
                                return (
                                  <span
                                    key={pid}
                                    className="text-xs font-mono bg-muted px-2 py-0.5 rounded font-semibold"
                                  >
                                    {p?.code ?? `#${pid}`}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </TableCell>
                    )}
                    {isUVisible("permissions") && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(u.permissions || []).length > 0 ? (
                            (u.permissions || []).slice(0, 4).map((p: string) => (
                              <span
                                key={p}
                                className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 whitespace-nowrap"
                              >
                                {p.split(".").pop() ?? p}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              —
                            </span>
                          )}
                          {(u.permissions || []).length > 4 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300 whitespace-nowrap">
                              +{(u.permissions || []).length - 4}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isUVisible("status") && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {u.status === "LOCKED" ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                {ar ? "مقفول" : "Locked"}
                              </span>
                            </>
                          ) : (
                            <>
                              <div
                                className={`w-2 h-2 rounded-full ${u.status === "ACTIVE" ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
                              />
                              <span
                                className={`text-xs font-semibold ${u.status === "ACTIVE" ? "text-green-700 dark:text-green-400" : "text-gray-500"}`}
                              >
                                {u.status === "ACTIVE"
                                  ? ar
                                    ? "نشط"
                                    : "Active"
                                  : ar
                                    ? "غير نشط"
                                    : "Inactive"}
                              </span>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isUVisible("actions") && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => setEditUser(u)}
                              className="cursor-pointer"
                            >
                              <UserCog className="w-4 h-4 me-2 text-blue-600" />
                              <span>
                                {ar ? "تعديل البيانات" : "Edit User Data"}
                              </span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setMatrixUser(u)}
                              className="cursor-pointer"
                            >
                              <Shield className="w-4 h-4 me-2 text-[#C9A24D]" />
                              <span>
                                {ar ? "تعديل الصلاحيات" : "Edit Permissions"}
                              </span>
                            </DropdownMenuItem>
                            {(isSuperAdmin || u.id === currentUser?.id) && (
                              <DropdownMenuItem
                                onClick={() => setSignatureUser(u)}
                                className="cursor-pointer"
                              >
                                <Upload className="w-4 h-4 me-2 text-slate-600" />
                                <span>
                                  {ar ? "رفع توقيع" : "Upload Signature"}
                                </span>
                              </DropdownMenuItem>
                            )}
                            {isSuperAdmin && u.roles?.[0] !== "super_admin" && (
                              <DropdownMenuItem
                                onClick={() => setEditPropsUser(u)}
                                className="cursor-pointer"
                              >
                                <Building2 className="w-4 h-4 me-2 text-green-600" />
                                <span>
                                  {ar ? "تعديل الفروع" : "Edit Properties"}
                                </span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => setResetUser(u)}
                              className="cursor-pointer"
                            >
                              <KeyRound className="w-4 h-4 me-2 text-blue-500" />
                              <span>
                                {ar
                                  ? "إعادة تعيين كلمة المرور"
                                  : "Reset Password"}
                              </span>
                            </DropdownMenuItem>
                            {isUserLocked(u) && (
                              <PermissionGate module="users" action="unlock">
                                <DropdownMenuItem
                                  onClick={() => setUnlockUser(u)}
                                  className="cursor-pointer"
                                >
                                  <Unlock className="w-4 h-4 me-2 text-amber-600" />
                                  <span>
                                    {ar ? "فتح قفل الحساب" : "Unlock Account"}
                                  </span>
                                </DropdownMenuItem>
                              </PermissionGate>
                            )}
                            <DropdownMenuSeparator />
                            <PermissionGate module="users" action="delete">
                              <DropdownMenuItem
                                onClick={() => setDeleteUser(u)}
                                disabled={u.username === currentUser?.username}
                                className="cursor-pointer text-red-600 dark:text-red-400"
                              >
                                <Trash className="w-4 h-4 mr-2" />
                                <span>
                                  {ar ? "حذف المستخدم" : "Delete User"}
                                </span>
                              </DropdownMenuItem>
                            </PermissionGate>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {pagedUsers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={uVisible.size + 1}
                    className="py-16 text-center"
                  >
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                        {searchQuery || roleFilter !== "all" ? (
                          <Search className="w-7 h-7 opacity-40" />
                        ) : (
                          <ShieldCheck className="w-7 h-7 opacity-40" />
                        )}
                      </div>
                      <p className="font-semibold text-foreground">
                        {searchQuery || roleFilter !== "all"
                          ? ar
                            ? "لا توجد نتائج"
                            : "No matching users"
                          : ar
                            ? "لا يوجد مستخدمين"
                            : "No users found"}
                      </p>
                      <p className="text-sm max-w-xs">
                        {searchQuery || roleFilter !== "all"
                          ? ar
                            ? "حاول تغيير معايير البحث أو الفلتر"
                            : "Try adjusting your search or filter criteria"
                          : ar
                            ? "اضغط إضافة مستخدم لإنشاء مستخدم جديد"
                            : 'Click "Add User" to create a new system user'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {filteredUsers.length > 0 && (
            <DataPagination
              total={filteredUsers.length}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              currentPage={currentPage}
              onPageChange={(page) => {
                setCurrentPage(page);
              }}
            />
          )}
        </div>
      )}
    </div>

);
}

================================================================================
FILE: artifacts/housing/src/pages/users/utils.ts
================================================================================

export const SYSTEM_ROLES = [
{ value: "super_admin", label: "Super Admin" },
{ value: "admin", label: "System Admin" },
{ value: "manager", label: "Property Manager" },
{ value: "receptionist", label: "Receptionist" },
{ value: "maintenance_staff", label: "Tickets Staff" },
];

export const WORKFLOW_ROLES = [
{ value: "none", label: "None / Not a Manager" },
{ value: "department_manager", label: "Department Manager" },
{ value: "housing_manager", label: "Housing Manager" },
{ value: "hr_manager", label: "HR Manager" },
{ value: "accounts_manager", label: "Accounts Manager" },
{ value: "hotel_gm", label: "Hotel General Manager" },
{ value: "hotel_fc", label: "Hotel Financial Controller" },
];

export const roleColor = (role: string) => {
switch (role.toLowerCase()) {
case "super_admin":
return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
case "admin":
return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
case "manager":
return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
case "housing_manager":
return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300";
case "hr_manager":
return "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300";
case "accounts_manager":
return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
case "receptionist":
return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
case "maintenance_staff":
return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
default:
return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}
};

================================================================================
FILE: artifacts/housing/src/pages/users/components/CreateUserDialog.tsx
================================================================================

import { useState } from "react";
import {
useCreateUser,
getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { useProperty } from "@/context/PropertyContext";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { UserCog, Plus } from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import { getPermissionsForRoles } from "@/lib/permissions";
import { SYSTEM_ROLES, WORKFLOW_ROLES } from "../utils";

interface CreateUserDialogProps {
properties: any[];
}

export function CreateUserDialog({ properties }: CreateUserDialogProps) {
const { toast } = useToast();
const { language } = useLanguage();
const ar = language === "ar";
const queryClient = useQueryClient();
const { activePropertyId, isSuperAdmin } = useProperty();

const [isOpen, setIsOpen] = useState(false);
const [form, setForm] = useState({
username: "",
email: "",
phone: "",
password: "",
role: "manager",
jobTitle: "none",
propertyId: activePropertyId ?? 0,
propertyIds: activePropertyId ? [activePropertyId] : ([] as number[]),
});

const resetForm = () =>
setForm({
username: "",
email: "",
phone: "",
password: "",
role: "manager",
jobTitle: "none",
propertyId: activePropertyId ?? 0,
propertyIds: activePropertyId ? [activePropertyId] : [],
});

const createMutation = useCreateUser({
mutation: {
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
toast({
title: ar ? "تم إنشاء المستخدم بنجاح" : "User created successfully",
});
setIsOpen(false);
resetForm();
},
onError: (e: any) =>
toast({
title: ar ? "خطأ في إنشاء المستخدم" : "Error creating user",
description: e.message,
variant: "destructive",
}),
},
});

const onSubmit = () => {
if (!form.username || !form.password) {
toast({
title: ar
? "الرجاء ملء جميع الحقول المطلوبة"
: "Please fill all required fields",
variant: "destructive",
});
return;
}
const needsProperty = form.role !== "super_admin";
const pids =
form.propertyIds.length > 0
? form.propertyIds
: form.propertyId
? [form.propertyId]
: [];
const primaryPid = pids[0] || activePropertyId || 1;

    if (needsProperty && !primaryPid) {
      toast({
        title: ar
          ? "الرجاء اختيار فرع واحد على الأقل"
          : "Please select at least one property",
        variant: "destructive",
      });
      return;
    }

    const resolvedRoles = [form.role].filter(Boolean);
    const resolvedPermissions = getPermissionsForRoles(resolvedRoles);

    createMutation.mutate({
      data: {
        username: form.username,
        email: form.email || undefined,
        phone: form.phone || undefined,
        password: form.password,
        propertyId: primaryPid,
        propertyIds: pids,
        roles: resolvedRoles,
        jobTitle: form.jobTitle === "none" ? null : form.jobTitle,
        permissions: resolvedPermissions,
        status: "ACTIVE" as any,
      } as any,
    });

};

return (

<Dialog
open={isOpen}
onOpenChange={(v) => {
setIsOpen(v);
if (!v) resetForm();
}} >
<PermissionGate module="users" action="create">
<DialogTrigger asChild>
<Button className="bg-[#0F2A44] hover:bg-[#0F2A44]/90 text-white gap-2">
<Plus className="w-4 h-4" />
{ar ? "إضافة مستخدم" : "Add User"}
</Button>
</DialogTrigger>
</PermissionGate>

      <DialogContent
        className="max-w-md"
        srTitle={ar ? "إضافة مستخدم جديد" : "Add New User"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            {ar ? "إضافة مستخدم جديد" : "Add New User"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>
              {ar ? "اسم المستخدم" : "Username"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="e.g. john.doe"
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{ar ? "البريد الإلكتروني" : "Email"}</Label>
            <Input
              type="email"
              placeholder="e.g. john@example.com"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{ar ? "الهاتف" : "Phone"}</Label>
            <Input
              type="tel"
              placeholder="e.g. +1 (555) 123-4567"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              autoComplete="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              {ar ? "كلمة المرور" : "Password"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              type="password"
              placeholder={ar ? "6 أحرف كحد أدنى" : "Minimum 6 characters"}
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{ar ? "الدور" : "Role"}</Label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "سيتم تطبيق الصلاحيات الافتراضية لهذا الدور تلقائياً. يمكنك تعديلها لاحقاً."
                : "Default permissions for this role will be applied automatically. You can edit them afterwards."}
            </p>
          </div>

          {/* Property assignment */}
          {isSuperAdmin && form.role !== "super_admin" && (
            <div className="space-y-1.5">
              <Label>
                {ar ? "تعيين في الفروع" : "Assign to Properties"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-44 overflow-y-auto bg-muted/20">
                {properties?.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/30 px-2 py-1.5 rounded-md transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={form.propertyIds.includes(p.id)}
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          propertyIds: e.target.checked
                            ? [...f.propertyIds, p.id]
                            : f.propertyIds.filter((id) => id !== p.id),
                          propertyId:
                            e.target.checked && f.propertyIds.length === 0
                              ? p.id
                              : f.propertyId,
                        }));
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-primary"
                    />
                    <span className="flex-1 text-sm font-medium">{p.name}</span>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {p.code}
                    </span>
                  </label>
                ))}
                {!properties?.length && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {ar ? "لا توجد فروع" : "No properties available"}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.propertyIds.length === 0
                  ? ar
                    ? "اختر فرعاً واحداً على الأقل"
                    : "Select at least one property"
                  : ar
                    ? `تم اختيار ${form.propertyIds.length} فرع`
                    : `${form.propertyIds.length} propert${form.propertyIds.length > 1 ? "ies" : "y"} selected`}
              </p>
            </div>
          )}
          {isSuperAdmin && form.role === "super_admin" && (
            <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
              {ar
                ? "المدير العام له صلاحية الوصول لجميع الفروع افتراضياً."
                : "Super Admin has access to all properties by default."}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={onSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending
                ? ar
                  ? "جاري الإنشاء..."
                  : "Creating..."
                : ar
                  ? "إنشاء المستخدم"
                  : "Create User"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

);
}

================================================================================
FILE: artifacts/housing/src/pages/users/components/DeleteUserDialog.tsx
================================================================================

import {
useDeleteUser,
getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import {
AlertDialog,
AlertDialogAction,
AlertDialogCancel,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteUserDialogProps {
user: any;
onClose: () => void;
}

export function DeleteUserDialog({ user, onClose }: DeleteUserDialogProps) {
const { toast } = useToast();
const { language } = useLanguage();
const ar = language === "ar";
const queryClient = useQueryClient();

const deleteMutation = useDeleteUser({
mutation: {
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
toast({ title: ar ? "تم حذف المستخدم" : "User deleted" });
onClose();
},
onError: (e: any) =>
toast({
title: ar ? "فشل حذف المستخدم" : "Failed to delete user",
description: e.message,
variant: "destructive",
}),
},
});

return (
<AlertDialog
open
onOpenChange={(open) => {
if (!open) onClose();
}} >
<AlertDialogContent>
<AlertDialogHeader>
<AlertDialogTitle>
{ar ? "حذف المستخدم" : "Delete User"}
</AlertDialogTitle>
<AlertDialogDescription>
{ar ? (
<>
هل أنت متأكد من حذف المستخدم <strong>{user?.username}</strong>؟
لا يمكن التراجع عن هذا الإجراء.
</>
) : (
<>
Are you sure you want to delete{" "}
<strong>{user?.username}</strong>? This cannot be undone.
</>
)}
</AlertDialogDescription>
</AlertDialogHeader>
<AlertDialogFooter>
<AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
<AlertDialogAction
className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
onClick={() => deleteMutation.mutate({ id: user.id })}
disabled={deleteMutation.isPending} >
{deleteMutation.isPending
? ar
? "جاري الحذف..."
: "Deleting..."
: ar
? "حذف"
: "Delete"}
</AlertDialogAction>
</AlertDialogFooter>
</AlertDialogContent>
</AlertDialog>
);
}

================================================================================
FILE: artifacts/housing/src/pages/users/components/EditPropertiesDialog.tsx
================================================================================

import { useState } from "react";
import { useUpdateUser } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

interface EditPropertiesDialogProps {
user: any;
properties: any[];
onClose: () => void;
onSuccess?: () => void;
}

export function EditPropertiesDialog({
user,
properties,
onClose,
onSuccess,
}: EditPropertiesDialogProps) {
const { toast } = useToast();
const { language } = useLanguage();
const ar = language === "ar";
const updateMutation = useUpdateUser({
mutation: {
onError: (e: any) =>
toast({
title: "Error",
description: e.message,
variant: "destructive",
}),
},
});

const initialPids: number[] = user.propertyIds?.length
? user.propertyIds
: user.propertyId
? [user.propertyId]
: [];
const [selectedIds, setSelectedIds] = useState<number[]>(initialPids);
const [saving, setSaving] = useState(false);

const toggle = (id: number) => {
setSelectedIds((prev) =>
prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
);
};

const save = async () => {
if (!selectedIds.length) {
toast({
title: ar
? "يجب اختيار فرع واحد على الأقل"
: "Select at least one property",
variant: "destructive",
});
return;
}
setSaving(true);
try {
await updateMutation.mutateAsync({
id: user.id,
data: { propertyIds: selectedIds, propertyId: selectedIds[0] } as any,
});
toast({ title: ar ? "تم تحديث الفروع" : "Properties updated" });
onSuccess?.();
onClose();
} finally {
setSaving(false);
}
};

return (

<Dialog
open
onOpenChange={(open) => {
if (!open) onClose();
}} >
<DialogContent
className="max-w-sm"
srTitle={ar ? "تعديل الفروع" : "Edit Properties"} >
<DialogHeader>
<DialogTitle className="flex items-center gap-2">
<Building2 className="w-5 h-5 text-green-600" />
{ar ? "تعديل الفروع" : "Edit Properties"} —{" "}
<span className="font-mono">{user.username}</span>
</DialogTitle>
</DialogHeader>
<div className="space-y-3 pt-1">
<p className="text-sm text-muted-foreground">
{ar
? "اختر جميع الفروع التي يمكن لهذا المستخدم الوصول إليها:"
: "Select all properties this user can access:"}
</p>
<div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto bg-muted/10">
{properties.map((p) => (
<label
                key={p.id}
                className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/30 px-2 py-1.5 rounded-md transition-colors"
              >
<input
type="checkbox"
checked={selectedIds.includes(p.id)}
onChange={() => toggle(p.id)}
className="w-4 h-4 rounded"
/>
<span className="flex-1 text-sm font-medium">{p.name}</span>
<span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
{p.code}
</span>
</label>
))}
</div>
<p className="text-xs text-muted-foreground">
{selectedIds.length === 0
? ar
? "لم يتم اختيار أي فرع"
: "No properties selected"
: ar
? `تم اختيار ${selectedIds.length} فرع`
: `${selectedIds.length} propert${selectedIds.length > 1 ? "ies" : "y"} selected`}
</p>
<div className="flex gap-2 justify-end pt-1">
<Button variant="outline" onClick={onClose}>
{ar ? "إلغاء" : "Cancel"}
</Button>
<Button
              onClick={save}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
{saving
? ar
? "جاري الحفظ..."
: "Saving..."
: ar
? "حفظ الفروع"
: "Save Properties"}
</Button>
</div>
</div>
</DialogContent>
</Dialog>
);
}

================================================================================
FILE: artifacts/housing/src/pages/users/components/EditUserDialog.tsx
================================================================================

import { useState } from "react";
import {
useUpdateUser,
getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { UserCog, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { SYSTEM_ROLES, WORKFLOW_ROLES } from "../utils";
import { getPermissionsForRoles } from "@/lib/permissions";
import { toast as sonnerToast } from "sonner";

interface EditUserDialogProps {
user: any;
onClose: () => void;
}

export function EditUserDialog({ user, onClose }: EditUserDialogProps) {
const { toast } = useToast();
const { language } = useLanguage();
const ar = language === "ar";
const { user: currentUser, isSystemAdmin } = useAuth();
const queryClient = useQueryClient();

const [formData, setFormData] = useState({
username: user.username || "",
email: user.email || "",
phone: user.phone || "",
status: user.status || "ACTIVE",
role: user.roles?.[0] || "manager",
jobTitle: user.jobTitle || "none",
});
const [signatureFile, setSignatureFile] = useState<File | null>(null);

const isSelf = currentUser?.id === user.id;
const canUploadSignature = isSystemAdmin || isSelf;
const [isUploadingSig, setIsUploadingSig] = useState(false);
const [saving, setSaving] = useState(false);

const updateMutation = useUpdateUser({
mutation: {
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
toast({
title: ar
? "تم تحديث البيانات بنجاح"
: "User data updated successfully",
});
onClose();
},
onError: (e: any) =>
toast({
title: ar ? "فشل تحديث البيانات" : "Failed to update user data",
description: e.message,
variant: "destructive",
}),
},
});

const handleSignatureUpload = async (file: File) => {
if (!["image/png", "image/jpeg"].includes(file.type)) {
sonnerToast.error(ar ? "يرجى رفع صورة PNG أو JPEG" : "Please upload a PNG or JPEG image");
return;
}
setIsUploadingSig(true);
try {
const reader = new FileReader();
reader.onload = async () => {
const base64 = reader.result as string;
const endpoint = isSelf ? "/api/users/me/signature" : `/api/users/${user.id}/signature`;
const res = await fetch(endpoint, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ signatureImage: base64 }),
});
if (!res.ok) throw new Error("Upload failed");
sonnerToast.success(ar ? "تم حفظ التوقيع بنجاح" : "Signature saved successfully");
setSignatureFile(file);
};
reader.readAsDataURL(file);
} catch (err: any) {
sonnerToast.error(ar ? "فشل الرفع" : "Upload failed");
} finally {
setIsUploadingSig(false);
}
};

const save = async () => {
if (!formData.username.trim()) {
toast({
title: ar ? "الاسم مطلوب" : "Username is required",
variant: "destructive",
});
return;
}

    setSaving(true);
    try {
      const resolvedRoles = [formData.role].filter(Boolean);
      await updateMutation.mutateAsync({
        id: user.id,
        data: {
          username: formData.username,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          status: formData.status,
          roles: resolvedRoles,
          jobTitle: formData.jobTitle === "none" ? null : formData.jobTitle,
          permissions: getPermissionsForRoles(resolvedRoles),
        } as any,
      });
    } finally {
      setSaving(false);
    }

};

return (

<Dialog
open
onOpenChange={(open) => {
if (!open) onClose();
}} >
<DialogContent
className="max-w-sm"
srTitle={ar ? "تعديل بيانات المستخدم" : "Edit User Data"} >
<DialogHeader>
<DialogTitle className="flex items-center gap-2">
<UserCog className="w-5 h-5 text-blue-600" />
{ar ? "تعديل بيانات المستخدم" : "Edit User Data"}
</DialogTitle>
</DialogHeader>
<div className="space-y-4 pt-2">
{/_ Username _/}
<div className="space-y-2">
<Label htmlFor="username" className="text-sm font-medium">
{ar ? "اسم المستخدم" : "Username"}
</Label>
<Input
id="username"
value={formData.username}
onChange={(e) =>
setFormData({ ...formData, username: e.target.value })
}
placeholder={ar ? "أدخل اسم المستخدم" : "Enter username"}
className="font-mono"
/>
</div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              {ar ? "البريد الإلكتروني" : "Email"}
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder={ar ? "مثال@gmail.com" : "example@gmail.com"}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              {ar ? "رقم الهاتف" : "Phone"}
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder={ar ? "+966 50 0000000" : "+1 (555) 000-0000"}
            />
          </div>


            {/* Role / Position */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {ar ? "صلاحية النظام" : "System Role"}
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Workflow Role */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {ar ? "منصب الاعتماد (Workflow Role)" : "Workflow Role (Manager)"}
              </Label>
              <Select
                value={formData.jobTitle}
                onValueChange={(value) => setFormData({ ...formData, jobTitle: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Signature */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {ar ? "توقيع المستخدم" : "User Signature"}
              </Label>
              <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingSig || !canUploadSignature}
                  onClick={() => document.getElementById('sig-upload')?.click()}
                >
                  {isUploadingSig ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {ar ? "رفع صورة التوقيع" : "Upload Signature"}
                </Button>
                <input
                  id="sig-upload"
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSignatureUpload(file);
                  }}
                />
                {signatureFile && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {ar ? "تم رفع التوقيع" : "Signature Uploaded"}
                  </span>
                )}
              </div>
              {!canUploadSignature && (
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? "فقط المدير العام يمكنه رفع توقيع لمستخدم آخر"
                    : "Only system admins can upload signatures for other users."}
                </p>
              )}
            </div>
            </div>

            {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-medium">
              {ar ? "الحالة" : "Status"}
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    {ar ? "نشط" : "Active"}
                  </div>
                </SelectItem>
                <SelectItem value="INACTIVE">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    {ar ? "غير نشط" : "Inactive"}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="outline" onClick={onClose}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={save}
              disabled={saving || updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <UserCog className="w-4 h-4" />
              {updateMutation.isPending
                ? ar
                  ? "جارٍ الحفظ..."
                  : "Saving..."
                : ar
                  ? "حفظ التغييرات"
                  : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

);
}

================================================================================
FILE: artifacts/housing/src/pages/users/components/PermissionMatrixDialog.tsx
================================================================================

import { useState } from "react";
import {
useUpdateUser,
getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Shield } from "lucide-react";
import {
MODULES,
MODULE_ACTIONS,
MODULE_LABELS,
ACTION_LABELS,
permKey,
ROLE_DEFAULT_PERMISSIONS,
type Module,
type Action,
} from "@/lib/permissions";
import { SYSTEM_ROLES as ROLES, roleColor } from "../utils";

interface PermissionMatrixDialogProps {
user: any; // We'll fix this type later if possible, or just keep any for now.
onClose: () => void;
}

export function PermissionMatrixDialog({
user,
onClose,
}: PermissionMatrixDialogProps) {
const { toast } = useToast();
const { language } = useLanguage();
const ar = language === "ar";
const queryClient = useQueryClient();

const initialPerms = (): Set<string> => {
const explicit = (user.permissions as string[] | undefined) ?? [];
if (explicit.length > 0) return new Set(explicit);
const role = user.roles?.[0]?.toLowerCase() ?? "";
return new Set(ROLE_DEFAULT_PERMISSIONS[role] ?? []);
};

const [perms, setPerms] = useState<Set<string>>(initialPerms);
const [saving, setSaving] = useState(false);

const updateMutation = useUpdateUser({
mutation: {
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
toast({
title: ar
? "تم تحديث الصلاحيات بنجاح"
: "Permissions updated successfully",
});
onClose();
},
onError: (e: any) =>
toast({
title: ar ? "فشل حفظ الصلاحيات" : "Failed to save permissions",
description: e.message,
variant: "destructive",
}),
},
});

const toggle = (m: Module, a: Action) => {
const key = permKey(m, a);
setPerms((prev) => {
const next = new Set(prev);
next.has(key) ? next.delete(key) : next.add(key);
return next;
});
};

const toggleModule = (m: Module) => {
const modulePerms = MODULE_ACTIONS[m] ?? [];
const allChecked = modulePerms.every((a) => perms.has(permKey(m, a)));
setPerms((prev) => {
const next = new Set(prev);
modulePerms.forEach((a) =>
allChecked ? next.delete(permKey(m, a)) : next.add(permKey(m, a)),
);
return next;
});
};

const applyRoleDefaults = (roleKey: string) => {
setPerms(new Set(ROLE_DEFAULT_PERMISSIONS[roleKey] ?? []));
};

const selectAll = () => {
setPerms(
new Set(
MODULES.flatMap((m) =>
(MODULE_ACTIONS[m] ?? []).map((a) => permKey(m, a)),
),
),
);
};

const deselectAll = () => {
setPerms(new Set());
};

const save = () => {
setSaving(true);
updateMutation.mutate({
id: user.id,
data: { permissions: Array.from(perms) },
});
};

const totalPossible = MODULES.reduce(
(sum, m) => sum + (MODULE_ACTIONS[m] ?? []).length,
0,
);

return (

<Dialog
open
onOpenChange={(open) => {
if (!open) onClose();
}} >
<DialogContent
className="max-w-5xl max-h-[90vh] overflow-y-auto"
srTitle={ar ? "مصفوفة الصلاحيات" : "Permission Matrix"} >
<DialogHeader>
<DialogTitle className="flex flex-col gap-3 sm:flex-row sm:items-center">
<div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#C9A24D] to-[#8B7532] flex items-center justify-center">
<Shield className="w-5 h-5 text-white" />
</div>
<div>
<div className="text-lg font-semibold">
{ar ? "مصفوفة الصلاحيات" : "Permission Matrix"}
</div>
<div className="text-sm text-muted-foreground">
{user.username} •{" "}
{ar
? "تحكم في صلاحيات المستخدم"
: "Control permissions for the user"}
</div>
</div>
</DialogTitle>
</DialogHeader>

        {/* Summary bar */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 rounded-lg bg-muted/30 border text-sm">
          <span className="text-muted-foreground">
            {ar ? "الصلاحيات المفعلة:" : "Active permissions:"}
            <span className="font-semibold text-foreground">{perms.size}</span>
            <span className="text-muted-foreground"> / {totalPossible}</span>
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-blue-600 hover:underline"
            >
              {ar ? "تحديد الكل" : "Select All"}
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={deselectAll}
              className="text-xs text-muted-foreground hover:underline"
            >
              {ar ? "إلغاء الكل" : "Deselect All"}
            </button>
          </div>
        </div>

        {/* Quick apply role defaults */}
        <div className="mt-4 flex flex-wrap gap-2 pb-3 border-b">
          <span className="text-xs text-muted-foreground self-center">
            {ar ? "تطبيق صلاحيات الدور:" : "Apply role defaults:"}
          </span>
          {ROLES.map((r: any) => (
            <button
              key={r.value}
              onClick={() => applyRoleDefaults(r.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors hover:opacity-80 ${roleColor(r.value)}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Matrix list */}
        <div className="mt-4 space-y-4">
          {MODULES.map((m) => {
            const modulePerms = MODULE_ACTIONS[m] ?? [];
            const allChecked = modulePerms.every((a) =>
              perms.has(permKey(m, a)),
            );
            const someChecked = modulePerms.some((a) =>
              perms.has(permKey(m, a)),
            );
            const checkedCount = modulePerms.filter((a) =>
              perms.has(permKey(m, a)),
            ).length;
            return (
              <div
                key={m}
                className="rounded-2xl border bg-background p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {ar ? MODULE_LABELS[m].ar : MODULE_LABELS[m].en}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {checkedCount}/{modulePerms.length}{" "}
                      {ar ? "مفعل" : "enabled"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleModule(m)}
                    className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm font-medium transition ${
                      allChecked
                        ? "bg-[#0F2A44] text-white border-[#0F2A44]"
                        : someChecked
                          ? "border-[#C9A24D] bg-[#C9A24D]/10 text-foreground"
                          : "border-gray-300 text-muted-foreground hover:border-[#0F2A44]"
                    }`}
                  >
                    {allChecked
                      ? ar
                        ? "إلغاء التحديد"
                        : "Unselect"
                      : ar
                        ? "تحديد الكل"
                        : "Select all"}
                  </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {modulePerms.map((a) => (
                    <label
                      key={a}
                      className="flex items-center gap-3 rounded-2xl border px-3 py-2 hover:border-slate-400 transition-colors"
                    >
                      <Switch
                        checked={perms.has(permKey(m, a))}
                        onCheckedChange={() => toggle(m, a)}
                        className="scale-75"
                      />
                      <div>
                        <div className="text-sm font-medium">
                          {ar ? ACTION_LABELS[a].ar : ACTION_LABELS[a].en}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {permKey(m, a)}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2 justify-end pt-2 border-t">
          <Button variant="outline" onClick={onClose}>
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={save}
            disabled={saving || updateMutation.isPending}
            className="bg-[#0F2A44] hover:bg-[#0F2A44]/90 text-white gap-2"
          >
            <Shield className="w-4 h-4" />
            {updateMutation.isPending
              ? ar
                ? "جارٍ الحفظ..."
                : "Saving..."
              : ar
                ? "حفظ الصلاحيات"
                : "Save Permissions"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

);
}

================================================================================
FILE: artifacts/housing/src/pages/users/components/ResetPasswordDialog.tsx
================================================================================

import { useState } from "react";
import {
useUpdateUser,
getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";

interface ResetPasswordDialogProps {
user: any;
onClose: () => void;
}

export function ResetPasswordDialog({
user,
onClose,
}: ResetPasswordDialogProps) {
const { toast } = useToast();
const { language } = useLanguage();
const ar = language === "ar";
const queryClient = useQueryClient();

const [newPassword, setNewPassword] = useState("");

const resetPasswordMutation = useUpdateUser({
mutation: {
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
toast({
title: ar
? "تمت إعادة تعيين كلمة المرور بنجاح"
: "Password reset successfully",
});
onClose();
},
onError: (e: any) =>
toast({
title: ar
? "فشل إعادة تعيين كلمة المرور"
: "Failed to reset password",
description: e.message,
variant: "destructive",
}),
},
});

const handleResetPassword = () => {
if (!newPassword || newPassword.length < 6) {
toast({
title: ar
? "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل"
: "Password must be at least 6 characters",
variant: "destructive",
});
return;
}
resetPasswordMutation.mutate({
id: user.id,
data: { password: newPassword } as any,
});
};

return (

<Dialog
open
onOpenChange={(open) => {
if (!open) onClose();
}} >
<DialogContent
className="max-w-sm"
srTitle={ar ? "إعادة تعيين كلمة المرور" : "Reset Password"} >
<DialogHeader>
<DialogTitle className="flex items-center gap-2">
<KeyRound className="w-5 h-5 text-blue-500" />
{ar ? "إعادة تعيين كلمة المرور" : "Reset Password"} —{" "}
<span className="font-mono">{user.username}</span>
</DialogTitle>
</DialogHeader>
<div className="space-y-4 pt-1">
<div className="space-y-1.5">
<Label>
{ar ? "كلمة المرور الجديدة" : "New Password"}{" "}
<span className="text-red-500">\*</span>
</Label>
<Input
type="password"
placeholder={ar ? "6 أحرف كحد أدنى" : "Minimum 6 characters"}
value={newPassword}
onChange={(e) => setNewPassword(e.target.value)}
autoComplete="off"
onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
/>
<p className="text-xs text-muted-foreground">
{ar
? "سيحتاج المستخدم إلى استخدام كلمة المرور الجديدة لتسجيل الدخول."
: "The user will need to use this new password to sign in."}
</p>
</div>
<div className="flex gap-2 justify-end">
<Button variant="outline" onClick={onClose}>
{ar ? "إلغاء" : "Cancel"}
</Button>
<Button
              onClick={handleResetPassword}
              disabled={resetPasswordMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
{resetPasswordMutation.isPending
? ar
? "جاري الحفظ..."
: "Saving..."
: ar
? "إعادة تعيين كلمة المرور"
: "Reset Password"}
</Button>
</div>
</div>
</DialogContent>
</Dialog>
);
}

================================================================================
FILE: artifacts/housing/src/pages/users/components/UnlockUserDialog.tsx
================================================================================

import { useState } from "react";
import { getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import {
AlertDialog,
AlertDialogAction,
AlertDialogCancel,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UnlockUserDialogProps {
user: any;
onClose: () => void;
}

export function UnlockUserDialog({ user, onClose }: UnlockUserDialogProps) {
const { toast } = useToast();
const { language } = useLanguage();
const ar = language === "ar";
const queryClient = useQueryClient();
const [unlocking, setUnlocking] = useState(false);

const handleUnlock = async () => {
setUnlocking(true);
try {
const res = await fetch("/api/users/" + user.id + "/unlock", {
method: "POST",
});
if (!res.ok)
throw new Error((await res.json()).error || "Failed to unlock");
toast({
title: ar ? "تم فتح قفل الحساب بنجاح" : "Account unlocked successfully",
});
queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
onClose();
} catch (e: any) {
toast({
title: ar ? "فشل فتح القفل" : "Failed to unlock",
description: e.message,
variant: "destructive",
});
} finally {
setUnlocking(false);
}
};

return (
<AlertDialog
open
onOpenChange={(open) => {
if (!open) onClose();
}} >
<AlertDialogContent>
<AlertDialogHeader>
<AlertDialogTitle>
{ar ? "فتح قفل الحساب" : "Unlock Account"}
</AlertDialogTitle>
<AlertDialogDescription>
{ar
? `هل أنت متأكد من فتح قفل حساب "${user.username}"؟ سيتم مسح محاولات تسجيل الدخول الفاشلة وفتح الحساب فوراً.`
: `Are you sure you want to unlock "${user.username}"? Failed login attempts will be cleared and the account will be unlocked immediately.`}
</AlertDialogDescription>
</AlertDialogHeader>
<AlertDialogFooter>
<AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
<AlertDialogAction
            onClick={handleUnlock}
            disabled={unlocking}
            className="bg-amber-600 hover:bg-amber-700"
          >
{unlocking
? ar
? "جاري الفتح..."
: "Unlocking..."
: ar
? "فتح القفل"
: "Unlock"}
</AlertDialogAction>
</AlertDialogFooter>
</AlertDialogContent>
</AlertDialog>
);
}

================================================================================
FILE: artifacts/housing/src/pages/users/components/UploadSignatureDialog.tsx
================================================================================

import { useState, useRef } from "react";
import {
Dialog,
DialogContent,
DialogDescription,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Pen, Upload } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface UploadSignatureDialogProps {
user: any;
onClose: () => void;
}

export function UploadSignatureDialog({ user, onClose }: UploadSignatureDialogProps) {
const { language } = useLanguage();
const ar = language === "ar";
const [isUploading, setIsUploading] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);

const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
const file = e.target.files?.[0];
if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error(ar ? "يرجى رفع صورة PNG أو JPEG" : "Please upload a PNG or JPEG image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(ar ? "حجم الصورة يجب أن يكون أقل من 2 ميجابايت" : "Image must be under 2MB");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetch(`/api/users/${user.id}/signature`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signatureImage: base64 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Upload failed");
        toast.success(ar ? "تم حفظ التوقيع بنجاح" : "Signature saved successfully");
        onClose();
      };
      reader.readAsDataURL(file);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : ar ? "فشل الرفع" : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

};

if (!user) return null;

return (

<Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
<DialogContent>
<DialogHeader>
<DialogTitle>{ar ? "رفع توقيع للمستخدم" : "Upload User Signature"}</DialogTitle>
<DialogDescription>
{ar ? `رفع صورة توقيع للمستخدم: ${user.username}` : `Upload a signature image for user: ${user.username}`}
</DialogDescription>
</DialogHeader>

        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <div className="p-4 bg-muted/20 rounded-full border border-dashed border-primary/50">
            <Pen className="w-8 h-8 text-muted-foreground" />
          </div>

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full max-w-sm"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {isUploading
              ? (ar ? "جاري الرفع..." : "Uploading...")
              : (ar ? "اختيار صورة التوقيع" : "Select Signature Image")}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </DialogContent>
    </Dialog>

);
}

================================================================================
FILE: artifacts/housing/src/App.tsx
================================================================================

import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as SonnerToaster } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { PropertyProvider } from "@/context/PropertyContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageLoader } from "@/components/ui/loader";
import { useWebSocket } from "@/hooks/use-websocket";
import { usePermission } from "@/hooks/use-permission";
import type { Module, Action } from "@/lib/permissions";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Properties = lazy(() => import("@/pages/properties"));
const Housing = lazy(() => import("@/pages/housing"));
const Employees = lazy(() => import("@/pages/employees/index"));
const EmployeeDetail = lazy(() => import("@/pages/employees/detail"));
const Portal = lazy(() => import("@/pages/portal"));
const Reservations = lazy(() => import("@/pages/accommodation/reservations"));
const InHouse = lazy(() => import("@/pages/accommodation/in-house"));
const RoomAssignment = lazy(
() => import("@/pages/accommodation/room-assignment"),
);
const GuestHosting = lazy(() => import("@/pages/accommodation/guest-hosting"));
const History = lazy(() => import("@/pages/accommodation/history"));
const Tickets = lazy(() => import("@/pages/maintenance"));
const Reports = lazy(() => import("@/pages/reports"));
const Users = lazy(() => import("@/pages/users"));
const ActivityLog = lazy(() => import("@/pages/activity-log"));
const Settings = lazy(() => import("@/pages/settings"));
const EditFamilyVisit = lazy(() => import("@/pages/family-visit/EditFamilyVisit"));
const FamilyVisitIndex = lazy(() => import("@/pages/family-visit/FamilyVisitIndex"));
const CreateFamilyVisit = lazy(() => import("@/pages/family-visit/CreateFamilyVisit"));
const FamilyVisitDetail = lazy(() => import("@/pages/family-visit/FamilyVisitDetail"));

// Employee Portal Pages (Moved to standalone app)

const queryClient = new QueryClient({
defaultOptions: {
queries: {
staleTime: 60_000, // 1 min
refetchInterval: 60_000, // 1 min
gcTime: 5 \* 60_000, // 5 min cache
refetchOnWindowFocus: true,
refetchOnReconnect: true,
retry: 1,
},
},
});

/\*\*

- Global WebSocket Provider - stays mounted for the entire app session
- This ensures WebSocket connection persists across route changes
  \*/
  function WebSocketProvider({ children }: { children: React.ReactNode }) {
  useWebSocket();
  return <>{children}</>;
  }

function ProtectedLayout({ children }: { children: React.ReactNode }) {
const { isAuthenticated, isLoading } = useAuth();
if (isLoading) return <PageLoader />;
if (!isAuthenticated) return <Redirect to="/login" />;
return <AppLayout>{children}</AppLayout>;
}

/\*_ Renders `children` if user has permission, else redirects to /dashboard _/
function PermissionLayout({
module,
action = "view",
children,
}: {
module: Module;
action?: Action;
children: React.ReactNode;
}) {
const { isAuthenticated, isLoading } = useAuth();
const { can, isAdmin } = usePermission();

if (isLoading) return <PageLoader />;
if (!isAuthenticated) return <Redirect to="/login" />;

// If user is admin they bypass permission checks
if (!isAdmin && !can(module, action)) {
return (
<AppLayout>

<div className="flex flex-col items-center justify-center h-full gap-4 py-20">
<div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
<svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
<path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
</svg>
</div>
<h2 className="text-xl font-bold text-foreground">Access Denied</h2>
<p className="text-muted-foreground text-sm text-center max-w-sm">
You don&apos;t have permission to view this page. Contact your
administrator to request access.
</p>
<a
            href="/dashboard"
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
Go to Dashboard
</a>
</div>
</AppLayout>
);
}

return <AppLayout>{children}</AppLayout>;
}

function Router() {
return (
<Suspense fallback={<PageLoader />}>
<Switch>
<Route path="/login">
<Login />
</Route>

        <Route path="/">
          <Redirect to="/dashboard" />
        </Route>

        {/* Protected Routes wrapped in AppLayout */}
        <Route path="/dashboard">
          <ProtectedLayout>
            <Dashboard />
          </ProtectedLayout>
        </Route>

        <Route path="/housing">
          <PermissionLayout module="housing">
            <Housing />
          </PermissionLayout>
        </Route>
        <Route path="/employees/:id">
          <PermissionLayout module="employees">
            <EmployeeDetail />
          </PermissionLayout>
        </Route>
        <Route path="/employees">
          <PermissionLayout module="employees">
            <Employees />
          </PermissionLayout>
        </Route>
        <Route path="/accommodation/reservations">
          <PermissionLayout module="accommodation">
            <Reservations />
          </PermissionLayout>
        </Route>
        <Route path="/accommodation/in-house">
          <PermissionLayout module="accommodation">
            <InHouse />
          </PermissionLayout>
        </Route>
        <Route path="/accommodation/room-assignment">
          <PermissionLayout module="accommodation">
            <RoomAssignment />
          </PermissionLayout>
        </Route>
        <Route path="/accommodation/guest-hosting">
          <PermissionLayout module="accommodation">
            <GuestHosting />
          </PermissionLayout>
        </Route>
        <Route path="/accommodation/history">
          <PermissionLayout module="accommodation">
            <History />
          </PermissionLayout>
        </Route>
        <Route path="/accommodation">
          <Redirect to="/accommodation/reservations" />
        </Route>
        <Route path="/maintenance">
          <PermissionLayout module="maintenance">
            <Tickets />
          </PermissionLayout>
        </Route>
        <Route path="/reports">
          <PermissionLayout module="reports">
            <Reports />
          </PermissionLayout>
        </Route>
        <Route path="/users">
          <PermissionLayout module="users">
            <Users />
          </PermissionLayout>
        </Route>
        <Route path="/properties">
          <PermissionLayout module="properties">
            <Properties />
          </PermissionLayout>
        </Route>
        <Route path="/portal">
          <PermissionLayout module="employees">
            <Portal />
          </PermissionLayout>
        </Route>
        <Route path="/settings">
          <PermissionLayout module="settings">
            <Settings />
          </PermissionLayout>
        </Route>
        <Route path="/activity-log">
          <PermissionLayout module="activity_log">
            <ActivityLog />
          </PermissionLayout>
        </Route>

        <Route path="/family-visit/create">
          <PermissionLayout module="hosting_requests" action="create">
            <CreateFamilyVisit />
          </PermissionLayout>
        </Route>
        <Route path="/family-visit/:id/edit">
          <PermissionLayout module="hosting_requests" action="edit">
            <EditFamilyVisit />
          </PermissionLayout>
        </Route>
        <Route path="/family-visit/:id">
          <PermissionLayout module="hosting_requests" action="view">
            <FamilyVisitDetail />
          </PermissionLayout>
        </Route>
        <Route path="/family-visit">
          <PermissionLayout module="hosting_requests" action="view">
            <FamilyVisitIndex />
          </PermissionLayout>
        </Route>

        <Route>
          <ProtectedLayout>
            <NotFound />
          </ProtectedLayout>
        </Route>
      </Switch>
    </Suspense>

);
}

function App() {
return (
<ErrorBoundary>
<QueryClientProvider client={queryClient}>
<ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
<LanguageProvider>
<AuthProvider>
<PropertyProvider>
<WebSocketProvider>
<TooltipProvider>
<WouterRouter>
<Router />
</WouterRouter>
<Toaster />
<SonnerToaster
position="top-right"
richColors
toastOptions={{
                        style: { '--normal-bg': 'var(--brand-teal, #2AB5B5)' } as React.CSSProperties,
                      }}
/>
</TooltipProvider>
</WebSocketProvider>
</PropertyProvider>
</AuthProvider>
</LanguageProvider>
</ThemeProvider>
</QueryClientProvider>
</ErrorBoundary>
);
}

export default App;

================================================================================
FILE: artifacts/housing/src/main.tsx
================================================================================

// @ts-nocheck
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./register-service-worker";

createRoot(document.getElementById("root")!).render(<App />);
registerServiceWorker();

================================================================================
FILE: artifacts/housing/src/components/ui/accordion.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
React.ElementRef<typeof AccordionPrimitive.Item>,
React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>

> (({ className, ...props }, ref) => (
> <AccordionPrimitive.Item

    ref={ref}
    className={cn("border-b", className)}
    {...props}

/>
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
React.ElementRef<typeof AccordionPrimitive.Trigger>,
React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>

> (({ className, children, ...props }, ref) => (
> <AccordionPrimitive.Header className="flex">

    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline text-left [&[data-state=open]>svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
    </AccordionPrimitive.Trigger>

</AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
React.ElementRef<typeof AccordionPrimitive.Content>,
React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>

> (({ className, children, ...props }, ref) => (
> <AccordionPrimitive.Content

    ref={ref}
    className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}

>

    <div className={cn("pb-4 pt-0", className)}>{children}</div>

</AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };

================================================================================
FILE: artifacts/housing/src/components/ui/alert-dialog.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>

> (({ className, ...props }, ref) => (
> <AlertDialogPrimitive.Overlay

    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}

/>
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
React.ElementRef<typeof AlertDialogPrimitive.Content>,
React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>

> (({ className, ...props }, ref) => (
> <AlertDialogPortal>

    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className,
      )}
      {...props}
    />

  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({
className,
...props
}: React.HTMLAttributes<HTMLDivElement>) => (

  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({
className,
...props
}: React.HTMLAttributes<HTMLDivElement>) => (

  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
React.ElementRef<typeof AlertDialogPrimitive.Title>,
React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>

> (({ className, ...props }, ref) => (
> <AlertDialogPrimitive.Title

    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}

/>
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
React.ElementRef<typeof AlertDialogPrimitive.Description>,
React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>

> (({ className, ...props }, ref) => (
> <AlertDialogPrimitive.Description

    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}

/>
));
AlertDialogDescription.displayName =
AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
React.ElementRef<typeof AlertDialogPrimitive.Action>,
React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>

> (({ className, ...props }, ref) => (
> <AlertDialogPrimitive.Action

    ref={ref}
    className={cn(buttonVariants(), className)}
    {...props}

/>
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>

> (({ className, ...props }, ref) => (
> <AlertDialogPrimitive.Cancel

    ref={ref}
    className={cn(
      buttonVariants({ variant: "outline" }),
      "mt-2 sm:mt-0",
      className,
    )}
    {...props}

/>
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
AlertDialog,
AlertDialogPortal,
AlertDialogOverlay,
AlertDialogTrigger,
AlertDialogContent,
AlertDialogHeader,
AlertDialogFooter,
AlertDialogTitle,
AlertDialogDescription,
AlertDialogAction,
AlertDialogCancel,
};

================================================================================
FILE: artifacts/housing/src/components/ui/alert.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
"relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
{
variants: {
variant: {
default: "bg-background text-foreground",
destructive:
"border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
},
},
defaultVariants: {
variant: "default",
},
},
);

const Alert = React.forwardRef<
HTMLDivElement,
React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>

> (({ className, variant, ...props }, ref) => (

  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
HTMLParagraphElement,
React.HTMLAttributes<HTMLHeadingElement>

> (({ className, ...props }, ref) => (

  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
HTMLParagraphElement,
React.HTMLAttributes<HTMLParagraphElement>

> (({ className, ...props }, ref) => (

  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };

================================================================================
FILE: artifacts/housing/src/components/ui/aspect-ratio.tsx
================================================================================

// @ts-nocheck
import \* as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio";

const AspectRatio = AspectRatioPrimitive.Root;

export { AspectRatio };

================================================================================
FILE: artifacts/housing/src/components/ui/avatar.tsx
================================================================================

// @ts-nocheck
"use client";

import _ as React from "react";
import _ as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<
React.ElementRef<typeof AvatarPrimitive.Root>,
React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>

> (({ className, ...props }, ref) => (
> <AvatarPrimitive.Root

    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className,
    )}
    {...props}

/>
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
React.ElementRef<typeof AvatarPrimitive.Image>,
React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>

> (({ className, ...props }, ref) => (
> <AvatarPrimitive.Image

    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}

/>
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
React.ElementRef<typeof AvatarPrimitive.Fallback>,
React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>

> (({ className, ...props }, ref) => (
> <AvatarPrimitive.Fallback

    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className,
    )}
    {...props}

/>
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };

================================================================================
FILE: artifacts/housing/src/components/ui/badge.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
// @replit
// Whitespace-nowrap: Badges should never wrap.
"whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" +
" hover-elevate ",
{
variants: {
variant: {
default:
// @replit shadow-xs instead of shadow, no hover because we use hover-elevate
"border-transparent bg-primary text-primary-foreground shadow-xs",
secondary:
// @replit no hover because we use hover-elevate
"border-transparent bg-secondary text-secondary-foreground",
destructive:
// @replit shadow-xs instead of shadow, no hover because we use hover-elevate
"border-transparent bg-destructive text-destructive-foreground shadow-xs",
// @replit shadow-xs" - use badge outline variable
outline: "text-foreground border [border-color:var(--badge-outline)]",
},
},
defaultVariants: {
variant: "default",
},
},
);

export interface BadgeProps
extends
React.HTMLAttributes<HTMLDivElement>,
VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
return (

<div className={cn(badgeVariants({ variant }), className)} {...props} />
);
}

export { Badge, badgeVariants };

================================================================================
FILE: artifacts/housing/src/components/ui/breadcrumb.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

const Breadcrumb = React.forwardRef<
HTMLElement,
React.ComponentPropsWithoutRef<"nav"> & {
separator?: React.ReactNode;
}

> (({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />);
> Breadcrumb.displayName = "Breadcrumb";

const BreadcrumbList = React.forwardRef<
HTMLOListElement,
React.ComponentPropsWithoutRef<"ol">

> (({ className, ...props }, ref) => (

  <ol
    ref={ref}
    className={cn(
      "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
      className,
    )}
    {...props}
  />
));
BreadcrumbList.displayName = "BreadcrumbList";

const BreadcrumbItem = React.forwardRef<
HTMLLIElement,
React.ComponentPropsWithoutRef<"li">

> (({ className, ...props }, ref) => (

  <li
    ref={ref}
    className={cn("inline-flex items-center gap-1.5", className)}
    {...props}
  />
));
BreadcrumbItem.displayName = "BreadcrumbItem";

const BreadcrumbLink = React.forwardRef<
HTMLAnchorElement,
React.ComponentPropsWithoutRef<"a"> & {
asChild?: boolean;
}

> (({ asChild, className, ...props }, ref) => {
> const Comp = asChild ? Slot : "a";

return (
<Comp
ref={ref}
className={cn("transition-colors hover:text-foreground", className)}
{...props}
/>
);
});
BreadcrumbLink.displayName = "BreadcrumbLink";

const BreadcrumbPage = React.forwardRef<
HTMLSpanElement,
React.ComponentPropsWithoutRef<"span">

> (({ className, ...props }, ref) => (
> <span

    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn("font-normal text-foreground", className)}
    {...props}

/>
));
BreadcrumbPage.displayName = "BreadcrumbPage";

const BreadcrumbSeparator = ({
children,
className,
...props
}: React.ComponentProps<"li">) => (

  <li
    role="presentation"
    aria-hidden="true"
    className={cn("[&>svg]:w-3.5 [&>svg]:h-3.5", className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
);
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

const BreadcrumbEllipsis = ({
className,
...props
}: React.ComponentProps<"span">) => (
<span
role="presentation"
aria-hidden="true"
className={cn("flex h-9 w-9 items-center justify-center", className)}
{...props}

>

    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>

  </span>
);
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis";

export {
Breadcrumb,
BreadcrumbList,
BreadcrumbItem,
BreadcrumbLink,
BreadcrumbPage,
BreadcrumbSeparator,
BreadcrumbEllipsis,
};

================================================================================
FILE: artifacts/housing/src/components/ui/bulk-action-bar.tsx
================================================================================

// @ts-nocheck
import { Button } from "@/components/ui/button";
import { X, FileSpreadsheet } from "lucide-react";

interface BulkActionBarProps {
count: number;
onClear: () => void;
onExportExcel?: () => void;
extraActions?: React.ReactNode;
ar?: boolean;
}

export function BulkActionBar({
count,
onClear,
onExportExcel,
extraActions,
ar,
}: BulkActionBarProps) {
if (count === 0) return null;

return (

<div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5">
<div className="flex items-center gap-2 flex-1 min-w-0">
<span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
{count}
</span>
<span className="text-sm font-medium truncate">
{ar
? `${count} صف محدد`
: `${count} row${count !== 1 ? "s" : ""} selected`}
</span>
</div>
<div className="flex items-center gap-2 shrink-0">
{onExportExcel && (
<Button
            variant="outline"
            size="sm"
            onClick={onExportExcel}
            className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/40"
          >
<FileSpreadsheet className="w-3.5 h-3.5" />
{ar ? "تصدير Excel" : "Export Excel"}
</Button>
)}
{extraActions}
<Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
<X className="w-3.5 h-3.5" />
{ar ? "إلغاء التحديد" : "Clear"}
</Button>
</div>
</div>
);
}

================================================================================
FILE: artifacts/housing/src/components/ui/button-group.tsx
================================================================================

// @ts-nocheck
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const buttonGroupVariants = cva(
"flex w-fit items-stretch has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
{
variants: {
orientation: {
horizontal:
"[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
vertical:
"flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
},
},
defaultVariants: {
orientation: "horizontal",
},
},
);

function ButtonGroup({
className,
orientation,
...props
}: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
return (

<div
role="group"
data-slot="button-group"
data-orientation={orientation}
className={cn(buttonGroupVariants({ orientation }), className)}
{...props}
/>
);
}

function ButtonGroupText({
className,
asChild = false,
...props
}: React.ComponentProps<"div"> & {
asChild?: boolean;
}) {
const Comp = asChild ? Slot : "div";

return (
<Comp
className={cn(
"bg-muted shadow-xs flex items-center gap-2 rounded-md border px-4 text-sm font-medium [&\_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
className,
)}
{...props}
/>
);
}

function ButtonGroupSeparator({
className,
orientation = "vertical",
...props
}: React.ComponentProps<typeof Separator>) {
return (
<Separator
data-slot="button-group-separator"
orientation={orientation}
className={cn(
"bg-input relative !m-0 self-stretch data-[orientation=vertical]:h-auto",
className,
)}
{...props}
/>
);
}

export {
ButtonGroup,
ButtonGroupSeparator,
ButtonGroupText,
buttonGroupVariants,
};

================================================================================
FILE: artifacts/housing/src/components/ui/button.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
" hover-elevate active-elevate-2",
{
variants: {
variant: {
default:
// @replit: no hover, and add primary border
"bg-primary text-primary-foreground border border-primary-border",
destructive:
"bg-destructive text-destructive-foreground shadow-sm border-destructive-border",
outline:
// @replit Shows the background color of whatever card / sidebar / accent background it is inside of.
// Inherits the current text color. Uses shadow-xs. no shadow on active
// No hover state
" border [border-color:var(--button-outline)] shadow-xs active:shadow-none ",
secondary:
// @replit border, no hover, no shadow, secondary border.
"border bg-secondary text-secondary-foreground border border-secondary-border ",
// @replit no hover, transparent border
ghost: "border border-transparent",
link: "text-primary underline-offset-4 hover:underline",
},
size: {
// @replit changed sizes
default: "min-h-9 px-4 py-2",
sm: "min-h-8 rounded-md px-3 text-xs",
lg: "min-h-10 rounded-md px-8",
icon: "h-9 w-9",
},
},
defaultVariants: {
variant: "default",
size: "default",
},
},
);

export interface ButtonProps
extends
React.ButtonHTMLAttributes<HTMLButtonElement>,
VariantProps<typeof buttonVariants> {
asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
({ className, variant, size, asChild = false, ...props }, ref) => {
const Comp = asChild ? Slot : "button";
return (
<Comp
className={cn(buttonVariants({ variant, size, className }))}
ref={ref}
{...props}
/>
);
},
);
Button.displayName = "Button";

export { Button, buttonVariants };

================================================================================
FILE: artifacts/housing/src/components/ui/calendar.tsx
================================================================================

// @ts-nocheck
"use client";

import \* as React from "react";
import {
ChevronDownIcon,
ChevronLeftIcon,
ChevronRightIcon,
} from "lucide-react";
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

function Calendar({
className,
classNames,
showOutsideDays = true,
captionLayout = "label",
buttonVariant = "ghost",
formatters,
components,
...props
}: React.ComponentProps<typeof DayPicker> & {
buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
const defaultClassNames = getDefaultClassNames();

return (
<DayPicker
showOutsideDays={showOutsideDays}
className={cn(
"bg-background group/calendar p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
className,
)}
captionLayout={captionLayout}
formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months,
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-[--cell-size] w-[--cell-size] select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-[--cell-size] w-[--cell-size] select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-[--cell-size] w-full items-center justify-center px-[--cell-size]",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-[--cell-size] w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          "bg-popover absolute inset-0 opacity-0",
          defaultClassNames.dropdown,
        ),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5",
          defaultClassNames.caption_label,
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal",
          defaultClassNames.weekday,
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-[--cell-size] select-none",
          defaultClassNames.week_number_header,
        ),
        week_number: cn(
          "text-muted-foreground select-none text-[0.8rem]",
          defaultClassNames.week_number,
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
          defaultClassNames.day,
        ),
        range_start: cn(
          "bg-accent rounded-l-md",
          defaultClassNames.range_start,
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled,
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
components={{
Root: ({ className, rootRef, ...props }) => {
return (

<div
data-slot="calendar"
ref={rootRef}
className={cn(className)}
{...props}
/>
);
},
Chevron: ({ className, orientation, ...props }) => {
if (orientation === "left") {
return (
<ChevronLeftIcon className={cn("size-4", className)} {...props} />
);
}

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            );
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          );
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-[--cell-size] items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
    />

);
}

function CalendarDayButton({
className,
day,
modifiers,
...props
}: React.ComponentProps<typeof DayButton>) {
const defaultClassNames = getDefaultClassNames();

const ref = React.useRef<HTMLButtonElement>(null);
React.useEffect(() => {
if (modifiers.focused) ref.current?.focus();
}, [modifiers.focused]);

return (
<Button
ref={ref}
variant="ghost"
size="icon"
data-day={day.date.toLocaleDateString()}
data-selected-single={
modifiers.selected &&
!modifiers.range_start &&
!modifiers.range_end &&
!modifiers.range_middle
}
data-range-start={modifiers.range_start}
data-range-end={modifiers.range_end}
data-range-middle={modifiers.range_middle}
className={cn(
"data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-[--cell-size] flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70",
defaultClassNames.day,
className,
)}
{...props}
/>
);
}

export { Calendar, CalendarDayButton };

================================================================================
FILE: artifacts/housing/src/components/ui/card.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<
HTMLDivElement,
React.HTMLAttributes<HTMLDivElement>

> (({ className, ...props }, ref) => (

  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
HTMLDivElement,
React.HTMLAttributes<HTMLDivElement>

> (({ className, ...props }, ref) => (

  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
HTMLDivElement,
React.HTMLAttributes<HTMLDivElement>

> (({ className, ...props }, ref) => (

  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
HTMLDivElement,
React.HTMLAttributes<HTMLDivElement>

> (({ className, ...props }, ref) => (

  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
HTMLDivElement,
React.HTMLAttributes<HTMLDivElement>

> (({ className, ...props }, ref) => (

  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
HTMLDivElement,
React.HTMLAttributes<HTMLDivElement>

> (({ className, ...props }, ref) => (

  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
Card,
CardHeader,
CardFooter,
CardTitle,
CardDescription,
CardContent,
};

================================================================================
FILE: artifacts/housing/src/components/ui/carousel.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";
import useEmblaCarousel, {
type UseEmblaCarouselType,
} from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
opts?: CarouselOptions;
plugins?: CarouselPlugin;
orientation?: "horizontal" | "vertical";
setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
carouselRef: ReturnType<typeof useEmblaCarousel>[0];
api: ReturnType<typeof useEmblaCarousel>[1];
scrollPrev: () => void;
scrollNext: () => void;
canScrollPrev: boolean;
canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
const context = React.useContext(CarouselContext);

if (!context) {
throw new Error("useCarousel must be used within a <Carousel />");
}

return context;
}

const Carousel = React.forwardRef<
HTMLDivElement,
React.HTMLAttributes<HTMLDivElement> & CarouselProps

> (
> (

    {
      orientation = "horizontal",
      opts,
      setApi,
      plugins,
      className,
      children,
      ...props
    },
    ref,

) => {
const [carouselRef, api] = useEmblaCarousel(
{
...opts,
axis: orientation === "horizontal" ? "x" : "y",
},
plugins,
);
const [canScrollPrev, setCanScrollPrev] = React.useState(false);
const [canScrollNext, setCanScrollNext] = React.useState(false);

    const onSelect = React.useCallback((api: CarouselApi) => {
      if (!api) {
        return;
      }

      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    }, []);

    const scrollPrev = React.useCallback(() => {
      api?.scrollPrev();
    }, [api]);

    const scrollNext = React.useCallback(() => {
      api?.scrollNext();
    }, [api]);

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          scrollPrev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          scrollNext();
        }
      },
      [scrollPrev, scrollNext],
    );

    React.useEffect(() => {
      if (!api || !setApi) {
        return;
      }

      setApi(api);
    }, [api, setApi]);

    React.useEffect(() => {
      if (!api) {
        return;
      }

      onSelect(api);
      api.on("reInit", onSelect);
      api.on("select", onSelect);

      return () => {
        api?.off("select", onSelect);
      };
    }, [api, onSelect]);

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api: api,
          opts,
          orientation:
            orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );

},
);
Carousel.displayName = "Carousel";

const CarouselContent = React.forwardRef<
HTMLDivElement,
React.HTMLAttributes<HTMLDivElement>

> (({ className, ...props }, ref) => {
> const { carouselRef, orientation } = useCarousel();

return (

<div ref={carouselRef} className="overflow-hidden">
<div
ref={ref}
className={cn(
"flex",
orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
className,
)}
{...props}
/>
</div>
);
});
CarouselContent.displayName = "CarouselContent";

const CarouselItem = React.forwardRef<
HTMLDivElement,
React.HTMLAttributes<HTMLDivElement>

> (({ className, ...props }, ref) => {
> const { orientation } = useCarousel();

return (

<div
ref={ref}
role="group"
aria-roledescription="slide"
className={cn(
"min-w-0 shrink-0 grow-0 basis-full",
orientation === "horizontal" ? "pl-4" : "pt-4",
className,
)}
{...props}
/>
);
});
CarouselItem.displayName = "CarouselItem";

const CarouselPrevious = React.forwardRef<
HTMLButtonElement,
React.ComponentProps<typeof Button>

> (({ className, variant = "outline", size = "icon", ...props }, ref) => {
> const { orientation, scrollPrev, canScrollPrev } = useCarousel();

return (
<Button
ref={ref}
variant={variant}
size={size}
className={cn(
"absolute h-8 w-8 rounded-full",
orientation === "horizontal"
? "-left-12 top-1/2 -translate-y-1/2"
: "-top-12 left-1/2 -translate-x-1/2 rotate-90",
className,
)}
disabled={!canScrollPrev}
onClick={scrollPrev}
{...props} >
<ArrowLeft className="h-4 w-4" />
<span className="sr-only">Previous slide</span>
</Button>
);
});
CarouselPrevious.displayName = "CarouselPrevious";

const CarouselNext = React.forwardRef<
HTMLButtonElement,
React.ComponentProps<typeof Button>

> (({ className, variant = "outline", size = "icon", ...props }, ref) => {
> const { orientation, scrollNext, canScrollNext } = useCarousel();

return (
<Button
ref={ref}
variant={variant}
size={size}
className={cn(
"absolute h-8 w-8 rounded-full",
orientation === "horizontal"
? "-right-12 top-1/2 -translate-y-1/2"
: "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
className,
)}
disabled={!canScrollNext}
onClick={scrollNext}
{...props} >
<ArrowRight className="h-4 w-4" />
<span className="sr-only">Next slide</span>
</Button>
);
});
CarouselNext.displayName = "CarouselNext";

export {
type CarouselApi,
Carousel,
CarouselContent,
CarouselItem,
CarouselPrevious,
CarouselNext,
};

================================================================================
FILE: artifacts/housing/src/components/ui/chart.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
[k in string]: {
label?: React.ReactNode;
icon?: React.ComponentType;
} & (
| { color?: string; theme?: never }
| { color?: never; theme: Record<keyof typeof THEMES, string> }
);
};

type ChartContextProps = {
config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
const context = React.useContext(ChartContext);

if (!context) {
throw new Error("useChart must be used within a <ChartContainer />");
}

return context;
}

const ChartContainer = React.forwardRef<
HTMLDivElement,
React.ComponentProps<"div"> & {
config: ChartConfig;
children: React.ComponentProps<
typeof RechartsPrimitive.ResponsiveContainer >["children"];
}

> (({ id, className, children, config, ...props }, ref) => {
> const uniqueId = React.useId();
> const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

return (
<ChartContext.Provider value={{ config }}>

<div
data-chart={chartId}
ref={ref}
className={cn(
"flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
className,
)}
{...props} >
<ChartStyle id={chartId} config={config} />
<RechartsPrimitive.ResponsiveContainer>
{children}
</RechartsPrimitive.ResponsiveContainer>
</div>
</ChartContext.Provider>
);
});
ChartContainer.displayName = "Chart";

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
const colorConfig = Object.entries(config).filter(
([, config]) => config.theme || config.color,
);

if (!colorConfig.length) {
return null;
}

return (

<style
dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}
`,
          )
          .join("\n"),
      }}
/>
);
};

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef<
HTMLDivElement,
React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
React.ComponentProps<"div"> & {
hideLabel?: boolean;
hideIndicator?: boolean;
indicator?: "line" | "dot" | "dashed";
nameKey?: string;
labelKey?: string;
}

> (
> (

    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref,

) => {
const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null;
      }

      const [item] = payload;
      const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === "string"
          ? config[label as keyof typeof config]?.label || label
          : itemConfig?.label;

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>
            {labelFormatter(value, payload)}
          </div>
        );
      }

      if (!value) {
        return null;
      }

      return <div className={cn("font-medium", labelClassName)}>{value}</div>;
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      config,
      labelKey,
    ]);

    if (!active || !payload?.length) {
      return null;
    }

    const nestLabel = payload.length === 1 && indicator !== "dot";

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className,
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload
            .filter((item) => item.type !== "none")
            .map((item, index) => {
              const key = `${nameKey || item.name || item.dataKey || "value"}`;
              const itemConfig = getPayloadConfigFromPayload(config, item, key);
              const indicatorColor = color || item.payload.fill || item.color;

              return (
                <div
                  key={item.dataKey}
                  className={cn(
                    "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                    indicator === "dot" && "items-center",
                  )}
                >
                  {formatter && item?.value !== undefined && item.name ? (
                    formatter(item.value, item.name, item, index, item.payload)
                  ) : (
                    <>
                      {itemConfig?.icon ? (
                        <itemConfig.icon />
                      ) : (
                        !hideIndicator && (
                          <div
                            className={cn(
                              "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                              {
                                "h-2.5 w-2.5": indicator === "dot",
                                "w-1": indicator === "line",
                                "w-0 border-[1.5px] border-dashed bg-transparent":
                                  indicator === "dashed",
                                "my-0.5": nestLabel && indicator === "dashed",
                              },
                            )}
                            style={
                              {
                                "--color-bg": indicatorColor,
                                "--color-border": indicatorColor,
                              } as React.CSSProperties
                            }
                          />
                        )
                      )}
                      <div
                        className={cn(
                          "flex flex-1 justify-between leading-none",
                          nestLabel ? "items-end" : "items-center",
                        )}
                      >
                        <div className="grid gap-1.5">
                          {nestLabel ? tooltipLabel : null}
                          <span className="text-muted-foreground">
                            {itemConfig?.label || item.name}
                          </span>
                        </div>
                        {item.value && (
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {item.value.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    );

},
);
ChartTooltipContent.displayName = "ChartTooltip";

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef<
HTMLDivElement,
React.ComponentProps<"div"> &
Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
hideIcon?: boolean;
nameKey?: string;
}

> (
> (

    { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey },
    ref,

) => {
const { config } = useChart();

    if (!payload?.length) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className,
        )}
      >
        {payload
          .filter((item) => item.type !== "none")
          .map((item) => {
            const key = `${nameKey || item.dataKey || "value"}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);

            return (
              <div
                key={item.value}
                className={cn(
                  "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground",
                )}
              >
                {itemConfig?.icon && !hideIcon ? (
                  <itemConfig.icon />
                ) : (
                  <div
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{
                      backgroundColor: item.color,
                    }}
                  />
                )}
                {itemConfig?.label}
              </div>
            );
          })}
      </div>
    );

},
);
ChartLegendContent.displayName = "ChartLegend";

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
config: ChartConfig,
payload: unknown,
key: string,
) {
if (typeof payload !== "object" || payload === null) {
return undefined;
}

const payloadPayload =
"payload" in payload &&
typeof payload.payload === "object" &&
payload.payload !== null
? payload.payload
: undefined;

let configLabelKey: string = key;

if (
key in payload &&
typeof payload[key as keyof typeof payload] === "string"
) {
configLabelKey = payload[key as keyof typeof payload] as string;
} else if (
payloadPayload &&
key in payloadPayload &&
typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
) {
configLabelKey = payloadPayload[
key as keyof typeof payloadPayload
] as string;
}

return configLabelKey in config
? config[configLabelKey]
: config[key as keyof typeof config];
}

export {
ChartContainer,
ChartTooltip,
ChartTooltipContent,
ChartLegend,
ChartLegendContent,
ChartStyle,
};

================================================================================
FILE: artifacts/housing/src/components/ui/checkbox.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
React.ElementRef<typeof CheckboxPrimitive.Root>,
React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>

> (({ className, ...props }, ref) => (
> <CheckboxPrimitive.Root

    ref={ref}
    className={cn(
      "grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className,
    )}
    {...props}

>

    <CheckboxPrimitive.Indicator
      className={cn("grid place-content-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>

</CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };

================================================================================
FILE: artifacts/housing/src/components/ui/collapsible.tsx
================================================================================

// @ts-nocheck
"use client";

import \* as CollapsiblePrimitive from "@radix-ui/react-collapsible";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };

================================================================================
FILE: artifacts/housing/src/components/ui/column-chooser.tsx
================================================================================

// @ts-nocheck
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
DropdownMenu,
DropdownMenuCheckboxItem,
DropdownMenuContent,
DropdownMenuLabel,
DropdownMenuSeparator,
DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Columns3 } from "lucide-react";

export type ColDef = {
key: string;
label: string;
labelAr?: string;
defaultVisible?: boolean;
fixed?: boolean;
};

export function useColumnVisibility(cols: ColDef[]) {
const [visible, setVisible] = useState<Set<string>>(
() =>
new Set(cols.filter((c) => c.defaultVisible !== false).map((c) => c.key)),
);

const toggle = (key: string, checked: boolean) => {
setVisible((prev) => {
const next = new Set(prev);
if (checked) next.add(key);
else next.delete(key);
return next;
});
};

const showAll = () => setVisible(new Set(cols.map((c) => c.key)));
const hideAll = () =>
setVisible(new Set(cols.filter((c) => c.fixed).map((c) => c.key)));
const isVisible = (key: string) =>
cols.some((c) => c.key === key) && visible.has(key);

return { visible, toggle, showAll, hideAll, isVisible };
}

interface ColumnChooserProps {
cols: ColDef[];
visible: Set<string>;
onToggle: (key: string, checked: boolean) => void;
onShowAll?: () => void;
onHideAll?: () => void;
ar?: boolean;
}

export function ColumnChooser({
cols,
visible,
onToggle,
onShowAll,
onHideAll,
ar,
}: ColumnChooserProps) {
const visibleCount = cols.filter((col) => visible.has(col.key)).length;

return (
<DropdownMenu>
<DropdownMenuTrigger asChild>
<Button variant="outline" size="sm" className="gap-1.5">
<Columns3 className="w-4 h-4" />
<span>{ar ? "الأعمدة" : "Columns"}</span>
<span className="text-muted-foreground text-xs">
({visibleCount}/{cols.length})
</span>
</Button>
</DropdownMenuTrigger>
<DropdownMenuContent align="end" className="w-52">
<DropdownMenuLabel className="flex items-center justify-between">
<span>{ar ? "إظهار / إخفاء الأعمدة" : "Toggle Columns"}</span>
</DropdownMenuLabel>
<DropdownMenuSeparator />

        {(onShowAll || onHideAll) && (
          <>
            <div className="flex gap-1 px-2 py-1">
              {onShowAll && (
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={onShowAll}
                >
                  {ar ? "الكل" : "All"}
                </button>
              )}
              {onShowAll && onHideAll && (
                <span className="text-muted-foreground text-xs">·</span>
              )}
              {onHideAll && (
                <button
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={onHideAll}
                >
                  {ar ? "إخفاء الكل" : "None"}
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {cols.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={visible.has(col.key)}
            disabled={col.fixed}
            onCheckedChange={(checked) => onToggle(col.key, !!checked)}
          >
            {ar && col.labelAr ? col.labelAr : col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>

);
}

================================================================================
FILE: artifacts/housing/src/components/ui/command.tsx
================================================================================

// @ts-nocheck
"use client";

import \* as React from "react";
import { type DialogProps } from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const Command = React.forwardRef<
React.ElementRef<typeof CommandPrimitive>,
React.ComponentPropsWithoutRef<typeof CommandPrimitive>

> (({ className, ...props }, ref) => (
> <CommandPrimitive

    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className,
    )}
    {...props}

/>
));
Command.displayName = CommandPrimitive.displayName;

const CommandDialog = ({ children, ...props }: DialogProps) => {
return (
<Dialog {...props}>
<DialogContent className="overflow-hidden p-0" srTitle="Command Menu">
<Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
{children}
</Command>
</DialogContent>
</Dialog>
);
};

const CommandInput = React.forwardRef<
React.ElementRef<typeof CommandPrimitive.Input>,
React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>

> (({ className, ...props }, ref) => (

  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
React.ElementRef<typeof CommandPrimitive.List>,
React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>

> (({ className, ...props }, ref) => (
> <CommandPrimitive.List

    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}

/>
));

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
React.ElementRef<typeof CommandPrimitive.Empty>,
React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>

> ((props, ref) => (
> <CommandPrimitive.Empty

    ref={ref}
    className="py-6 text-center text-sm"
    {...props}

/>
));

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
React.ElementRef<typeof CommandPrimitive.Group>,
React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>

> (({ className, ...props }, ref) => (
> <CommandPrimitive.Group

    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className,
    )}
    {...props}

/>
));

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
React.ElementRef<typeof CommandPrimitive.Separator>,
React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>

> (({ className, ...props }, ref) => (
> <CommandPrimitive.Separator

    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}

/>
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
React.ElementRef<typeof CommandPrimitive.Item>,
React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>

> (({ className, ...props }, ref) => (
> <CommandPrimitive.Item

    ref={ref}
    className={cn(
      "relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className,
    )}
    {...props}

/>
));

CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({
className,
...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
return (
<span
className={cn(
"ml-auto text-xs tracking-widest text-muted-foreground",
className,
)}
{...props}
/>
);
};
CommandShortcut.displayName = "CommandShortcut";

export {
Command,
CommandDialog,
CommandInput,
CommandList,
CommandEmpty,
CommandGroup,
CommandItem,
CommandShortcut,
CommandSeparator,
};

================================================================================
FILE: artifacts/housing/src/components/ui/context-menu.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const ContextMenu = ContextMenuPrimitive.Root;

const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

const ContextMenuGroup = ContextMenuPrimitive.Group;

const ContextMenuPortal = ContextMenuPrimitive.Portal;

const ContextMenuSub = ContextMenuPrimitive.Sub;

const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const ContextMenuSubTrigger = React.forwardRef<
React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
inset?: boolean;
}

> (({ className, inset, children, ...props }, ref) => (
> <ContextMenuPrimitive.SubTrigger

    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}

>

    {children}
    <ChevronRight className="ml-auto h-4 w-4" />

</ContextMenuPrimitive.SubTrigger>
));
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName;

const ContextMenuSubContent = React.forwardRef<
React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>

> (({ className, ...props }, ref) => (
> <ContextMenuPrimitive.SubContent

    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-context-menu-content-transform-origin]",
      className,
    )}
    {...props}

/>
));
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName;

const ContextMenuContent = React.forwardRef<
React.ElementRef<typeof ContextMenuPrimitive.Content>,
React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>

> (({ className, ...props }, ref) => (
> <ContextMenuPrimitive.Portal>

    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 max-h-[--radix-context-menu-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-context-menu-content-transform-origin]",
        className,
      )}
      {...props}
    />

</ContextMenuPrimitive.Portal>
));
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

const ContextMenuItem = React.forwardRef<
React.ElementRef<typeof ContextMenuPrimitive.Item>,
React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
inset?: boolean;
}

> (({ className, inset, ...props }, ref) => (
> <ContextMenuPrimitive.Item

    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className,
    )}
    {...props}

/>
));
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

const ContextMenuCheckboxItem = React.forwardRef<
React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>

> (({ className, children, checked, ...props }, ref) => (
> <ContextMenuPrimitive.CheckboxItem

    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    checked={checked}
    {...props}

>

    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}

</ContextMenuPrimitive.CheckboxItem>
));
ContextMenuCheckboxItem.displayName =
ContextMenuPrimitive.CheckboxItem.displayName;

const ContextMenuRadioItem = React.forwardRef<
React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>

> (({ className, children, ...props }, ref) => (
> <ContextMenuPrimitive.RadioItem

    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}

>

    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <ContextMenuPrimitive.ItemIndicator>
        <Circle className="h-4 w-4 fill-current" />
      </ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}

</ContextMenuPrimitive.RadioItem>
));
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName;

const ContextMenuLabel = React.forwardRef<
React.ElementRef<typeof ContextMenuPrimitive.Label>,
React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
inset?: boolean;
}

> (({ className, inset, ...props }, ref) => (
> <ContextMenuPrimitive.Label

    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold text-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}

/>
));
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName;

const ContextMenuSeparator = React.forwardRef<
React.ElementRef<typeof ContextMenuPrimitive.Separator>,
React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>

> (({ className, ...props }, ref) => (
> <ContextMenuPrimitive.Separator

    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    {...props}

/>
));
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName;

const ContextMenuShortcut = ({
className,
...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
return (
<span
className={cn(
"ml-auto text-xs tracking-widest text-muted-foreground",
className,
)}
{...props}
/>
);
};
ContextMenuShortcut.displayName = "ContextMenuShortcut";

export {
ContextMenu,
ContextMenuTrigger,
ContextMenuContent,
ContextMenuItem,
ContextMenuCheckboxItem,
ContextMenuRadioItem,
ContextMenuLabel,
ContextMenuSeparator,
ContextMenuShortcut,
ContextMenuGroup,
ContextMenuPortal,
ContextMenuSub,
ContextMenuSubContent,
ContextMenuSubTrigger,
ContextMenuRadioGroup,
};

================================================================================
FILE: artifacts/housing/src/components/ui/dialog.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
React.ElementRef<typeof DialogPrimitive.Overlay>,
React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>

> (({ className, ...props }, ref) => (
> <DialogPrimitive.Overlay

    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}

/>
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
React.ElementRef<typeof DialogPrimitive.Content>,
React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
srTitle?: string;
}

> (({ className, children, srTitle, ...props }, ref) => (
> <DialogPortal>

    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 flex flex-col w-full max-w-lg translate-x-[-50%] translate-y-[-50%]",
        "max-h-[90vh] overflow-hidden",
        "border bg-background shadow-2xl duration-200",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
        "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        "sm:rounded-xl",
        className,
      )}
      {...props}
    >
      {/* Hidden title satisfies Radix UI accessibility requirement on every dialog */}
      <DialogPrimitive.Title className="sr-only">
        {srTitle ?? "Dialog"}
      </DialogPrimitive.Title>
      {/* Hidden description satisfies Radix UI accessibility requirement */}
      <DialogPrimitive.Description className="sr-only">
        Dialog content
      </DialogPrimitive.Description>
      <div className="overflow-y-auto flex-1 p-6">{children}</div>
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg w-8 h-8 flex items-center justify-center opacity-60 ring-offset-background transition-all hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>

  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
className,
...props
}: React.HTMLAttributes<HTMLDivElement>) => (

  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
className,
...props
}: React.HTMLAttributes<HTMLDivElement>) => (

  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t border-border mt-4",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
React.ElementRef<typeof DialogPrimitive.Title>,
React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>

> (({ className, ...props }, ref) => (
> <DialogPrimitive.Title

    ref={ref}
    className={cn("text-base font-bold leading-none tracking-tight", className)}
    {...props}

/>
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
React.ElementRef<typeof DialogPrimitive.Description>,
React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>

> (({ className, ...props }, ref) => (
> <DialogPrimitive.Description

    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}

/>
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
Dialog,
DialogPortal,
DialogOverlay,
DialogTrigger,
DialogClose,
DialogContent,
DialogHeader,
DialogFooter,
DialogTitle,
DialogDescription,
};

================================================================================
FILE: artifacts/housing/src/components/ui/drawer.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

const Drawer = ({
shouldScaleBackground = true,
...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
<DrawerPrimitive.Root
shouldScaleBackground={shouldScaleBackground}
{...props}
/>
);
Drawer.displayName = "Drawer";

const DrawerTrigger = DrawerPrimitive.Trigger;

const DrawerPortal = DrawerPrimitive.Portal;

const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
React.ElementRef<typeof DrawerPrimitive.Overlay>,
React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>

> (({ className, ...props }, ref) => (
> <DrawerPrimitive.Overlay

    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}

/>
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
React.ElementRef<typeof DrawerPrimitive.Content>,
React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>

> (({ className, children, ...props }, ref) => (
> <DrawerPortal>

    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
        className,
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      {children}
    </DrawerPrimitive.Content>

  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({
className,
...props
}: React.HTMLAttributes<HTMLDivElement>) => (

  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({
className,
...props
}: React.HTMLAttributes<HTMLDivElement>) => (

  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
React.ElementRef<typeof DrawerPrimitive.Title>,
React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>

> (({ className, ...props }, ref) => (
> <DrawerPrimitive.Title

    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}

/>
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
React.ElementRef<typeof DrawerPrimitive.Description>,
React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>

> (({ className, ...props }, ref) => (
> <DrawerPrimitive.Description

    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}

/>
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
Drawer,
DrawerPortal,
DrawerOverlay,
DrawerTrigger,
DrawerClose,
DrawerContent,
DrawerHeader,
DrawerFooter,
DrawerTitle,
DrawerDescription,
};

================================================================================
FILE: artifacts/housing/src/components/ui/dropdown-menu.tsx
================================================================================

// @ts-nocheck
"use client";

import _ as React from "react";
import _ as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
inset?: boolean;
}

> (({ className, inset, children, ...props }, ref) => (
> <DropdownMenuPrimitive.SubTrigger

    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className,
    )}
    {...props}

>

    {children}
    <ChevronRight className="ml-auto" />

</DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName =
DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>

> (({ className, ...props }, ref) => (
> <DropdownMenuPrimitive.SubContent

    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]",
      className,
    )}
    {...props}

/>
));
DropdownMenuSubContent.displayName =
DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
React.ElementRef<typeof DropdownMenuPrimitive.Content>,
React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>

> (({ className, sideOffset = 4, ...props }, ref) => (
> <DropdownMenuPrimitive.Portal>

    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]",
        className,
      )}
      {...props}
    />

</DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
React.ElementRef<typeof DropdownMenuPrimitive.Item>,
React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
inset?: boolean;
}

> (({ className, inset, ...props }, ref) => (
> <DropdownMenuPrimitive.Item

    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
      inset && "pl-8",
      className,
    )}
    {...props}

/>
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>

> (({ className, children, checked, ...props }, ref) => (
> <DropdownMenuPrimitive.CheckboxItem

    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    checked={checked}
    {...props}

>

    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}

</DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName =
DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>

> (({ className, children, ...props }, ref) => (
> <DropdownMenuPrimitive.RadioItem

    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}

>

    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}

</DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
React.ElementRef<typeof DropdownMenuPrimitive.Label>,
React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
inset?: boolean;
}

> (({ className, inset, ...props }, ref) => (
> <DropdownMenuPrimitive.Label

    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className,
    )}
    {...props}

/>
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>

> (({ className, ...props }, ref) => (
> <DropdownMenuPrimitive.Separator

    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}

/>
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
className,
...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
return (
<span
className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
{...props}
/>
);
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
DropdownMenu,
DropdownMenuTrigger,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuCheckboxItem,
DropdownMenuRadioItem,
DropdownMenuLabel,
DropdownMenuSeparator,
DropdownMenuShortcut,
DropdownMenuGroup,
DropdownMenuPortal,
DropdownMenuSub,
DropdownMenuSubContent,
DropdownMenuSubTrigger,
DropdownMenuRadioGroup,
};

================================================================================
FILE: artifacts/housing/src/components/ui/employee-profile-popup.tsx
================================================================================

// @ts-nocheck
import { useEffect, useState } from "react";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import {
useGetEmployee,
useListAssignments,
useListRooms,
useListBuildings,
useListFloors,
useListEmployees,
useListHostings,
} from "@workspace/api-client-react";
import { useLanguage } from "@/context/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
Building2,
BedDouble,
Calendar,
Phone,
Shield,
Globe2,
User,
Users,
Home,
Briefcase,
ExternalLink,
FileText,
Image as ImageIcon,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { Link } from "wouter";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface EmployeeProfilePopupProps {
employeeId: number | null;
propertyId: number | undefined;
onClose: () => void;
}

export function EmployeeProfilePopup({
employeeId,
propertyId,
onClose,
}: EmployeeProfilePopupProps) {
const { language } = useLanguage();
const ar = language === "ar";
const [companionCache, setCompanionCache] = useState<Record<number, any[]>>(
{},
);
const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
const [lightboxName, setLightboxName] = useState<string | undefined>(
undefined,
);

const { data: employee, isLoading: empLoading } = useGetEmployee(
employeeId!,
{
query: { enabled: !!employeeId },
},
);

const { data: assignments = [] } = useListAssignments({ propertyId } as any, {
query: { enabled: !!propertyId },
});

const { data: \_rData } = useListRooms(
{ propertyId },
{ query: { enabled: !!propertyId } },
);
const rooms = \_rData?.data || [];
const { data: buildings = [] } = useListBuildings(
{ propertyId },
{ query: { enabled: !!propertyId } },
);
const { data: floors = [] } = useListFloors(
{ propertyId },
{ query: { enabled: !!propertyId } },
);
const { data: \_eData , isLoading: employeesLoading } = useListEmployees({ propertyId }, { query: { enabled: !!propertyId } });
const employees = \_eData?.data || [];
const { data: hostings = [] } = useListHostings(
{ propertyId },
{ query: { enabled: !!propertyId && !!employeeId } },
);

const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
const buildingMap = Object.fromEntries(buildings.map((b) => [b.id, b.name]));
const floorMap = Object.fromEntries(floors.map((f) => [f.id, f.floorNumber]));
const empMap = Object.fromEntries(employees.map((e: any) => [e.id, e]));

const activeAssignments = (assignments as any[]).filter(
(a) => a.status === "ACTIVE",
);
const currentAssignment = activeAssignments.find(
(a) => a.employeeId === employeeId,
);
const roommates = currentAssignment
? activeAssignments.filter(
(a) =>
a.roomId === currentAssignment.roomId && a.employeeId !== employeeId,
)
: [];

const emp = (employee as any) ?? empMap[employeeId as number];
const room = currentAssignment ? roomMap[currentAssignment.roomId] : null;
const building = room ? buildingMap[room.buildingId] : null;
const floorNum = room ? floorMap[room.floorId] : null;
const daysStayed = currentAssignment
? differenceInDays(new Date(), new Date(currentAssignment.checkInDate))
: null;
const employeeHostings = (hostings as any[])
.filter((h) => h.employeeId === employeeId)
.sort(
(a, b) =>
new Date(b.expectedFrom ?? b.createdAt ?? 0).getTime() -
new Date(a.expectedFrom ?? a.createdAt ?? 0).getTime(),
);
useEffect(() => {
if (!propertyId || !employeeHostings.length) return;
const missing = employeeHostings.filter(
(h) =>
Number(h.guestsCount ?? 0) > 0 &&
(!Array.isArray(h.companions) || h.companions.length === 0) &&
companionCache[h.id] === undefined,
);
if (!missing.length) return;

    let cancelled = false;
    Promise.all(
      missing.map(async (h) => {
        try {
          const resp = await fetch(
            `/api/hostings/${h.id}/companions?propertyId=${propertyId}`,
          );
          if (!resp.ok) return [h.id, []] as const;
          const list = await resp.json();
          return [h.id, Array.isArray(list) ? list : []] as const;
        } catch {
          return [h.id, []] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setCompanionCache((prev) => {
        const next = { ...prev };
        entries.forEach(([id, list]) => {
          next[id] = list;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };

}, [propertyId, employeeHostings, companionCache]);

const getHostingGuests = (hosting: any) =>
Array.isArray(hosting.companions) && hosting.companions.length > 0
? hosting.companions
: (companionCache[hosting.id] ?? []);

const hostingRoomLabel = (hosting: any) => {
const hostingRoom =
hosting.room ?? (hosting.roomId ? roomMap[hosting.roomId] : null);
return (
hostingRoom?.roomNumber ?? (hosting.roomId ? `#${hosting.roomId}` : "—")
);
};
const guestLabel = (guest: any) => {
const parts = [
Number(guest.isChild) === 1
? ar
? "طفل"
: "Child"
: ar
? "بالغ"
: "Adult",
guest.relation,
guest.age != null ? `${guest.age}${ar ? " سنة" : "y"}` : "",
].filter(Boolean);
return parts.join(" • ");
};

return (
<>
<Dialog
open={!!employeeId}
onOpenChange={(open) => {
if (!open) onClose();
}} >
<DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
<DialogHeader>
<DialogTitle className="flex items-center gap-2">
<User className="w-5 h-5 text-primary" />
{ar ? "بطاقة الموظف" : "Employee Profile"}
</DialogTitle>
</DialogHeader>

          {empLoading || employeesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : emp ? (
            <div className="space-y-4">
              {/* Photo + Name */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-gradient-to-r from-primary/10 to-transparent">
                {emp.photoUrl ? (
                  <img
                    src={emp.photoUrl}
                    className="w-16 h-16 rounded-full object-cover border-2 border-background shadow-md flex-shrink-0"
                    alt=""
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center border-2 border-background shadow-md flex-shrink-0">
                    <span className="text-2xl font-bold text-primary">
                      {emp.firstName?.[0]}
                      {emp.lastName?.[0]}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold">
                    {emp.firstName} {emp.lastName}
                  </h3>
                  <p className="text-sm font-mono text-muted-foreground">
                    {emp.employeeId || emp.employeeCode}
                  </p>
                  {emp.jobTitle && (
                    <p className="text-sm text-primary font-medium mt-0.5">
                      {emp.jobTitle}
                      {emp.department ? ` • ${emp.department}` : ""}
                    </p>
                  )}
                  <Badge
                    variant={emp.status === "ACTIVE" ? "default" : "secondary"}
                    className="mt-1 text-xs"
                  >
                    {emp.status === "ACTIVE"
                      ? ar
                        ? "نشط"
                        : "Active"
                      : emp.status}
                  </Badge>
                </div>
                <Link href={`/employees/${emp.id}`} onClick={onClose}>
                  <Button size="sm" variant="outline" className="shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-2 gap-2">
                {emp.nationalId && (
                  <div className="flex gap-2 items-start p-2.5 rounded-lg bg-muted/40">
                    <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                        {ar ? "رقم الهوية" : "National ID"}
                      </p>
                      <p className="text-sm font-mono truncate">
                        {emp.nationalId}
                      </p>
                    </div>
                  </div>
                )}
                {(emp.phone || emp.phoneNumber) && (
                  <div className="flex gap-2 items-start p-2.5 rounded-lg bg-muted/40">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                        {ar ? "الهاتف" : "Phone"}
                      </p>
                      <p className="text-sm">{emp.phone || emp.phoneNumber}</p>
                    </div>
                  </div>
                )}
                {emp.nationality && (
                  <div className="flex gap-2 items-start p-2.5 rounded-lg bg-muted/40">
                    <Globe2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                        {ar ? "الجنسية" : "Nationality"}
                      </p>
                      <p className="text-sm">{emp.nationality}</p>
                    </div>
                  </div>
                )}
                {emp.gender && (
                  <div className="flex gap-2 items-start p-2.5 rounded-lg bg-muted/40">
                    <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                        {ar ? "الجنس" : "Gender"}
                      </p>
                      <p className="text-sm">
                        {emp.gender === "M"
                          ? ar
                            ? "ذكر"
                            : "Male"
                          : emp.gender === "F"
                            ? ar
                              ? "أنثى"
                              : "Female"
                            : emp.gender}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Current Housing */}
              <div className="rounded-xl border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5" />
                  {ar ? "السكن الحالي" : "Current Housing"}
                </p>
                {currentAssignment && room ? (
                  <div className="grid grid-cols-2 gap-2">
                    {building && (
                      <div className="flex gap-1.5 items-center text-sm">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{building}</span>
                      </div>
                    )}
                    {floorNum != null && (
                      <div className="text-sm text-muted-foreground">
                        {ar ? "الطابق" : "Floor"} {floorNum}
                      </div>
                    )}
                    <div className="flex gap-2 items-center">
                      <span className="font-mono font-bold text-primary text-base">
                        {room.roomNumber}
                      </span>
                      {currentAssignment.bedNumber && (
                        <Badge variant="outline" className="text-xs">
                          <BedDouble className="w-3 h-3 mr-1" />
                          {ar ? "سرير" : "Bed"} {currentAssignment.bedNumber}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      {format(
                        new Date(currentAssignment.checkInDate),
                        "MMM d, yyyy",
                      )}
                      {daysStayed !== null && (
                        <span className="ml-1 text-xs">
                          ({daysStayed}
                          {ar ? "د" : "d"})
                        </span>
                      )}
                    </div>
                    {currentAssignment.expectedCheckOutDate && (
                      <div className="col-span-2 text-xs text-muted-foreground">
                        {ar ? "مغادرة متوقعة:" : "Expected out:"}{" "}
                        {format(
                          new Date(currentAssignment.expectedCheckOutDate),
                          "MMM d, yyyy",
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-3 text-center text-sm text-muted-foreground">
                    <Home className="w-6 h-6 mx-auto mb-1 opacity-30" />
                    {ar
                      ? "لا يوجد تسكين نشط حالياً"
                      : "No active housing assignment"}
                  </div>
                )}
              </div>

              {/* Guest Hosting */}
              <div className="rounded-xl border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {ar ? "ضيوف الموظف" : "Guest Hosting"} (
                  {employeeHostings.length})
                </p>
                {employeeHostings.length > 0 ? (
                  <div className="space-y-2">
                    {employeeHostings.map((hosting: any) => {
                      const guests = getHostingGuests(hosting);
                      return (
                        <div
                          key={hosting.id}
                          className="rounded-lg bg-muted/30 p-2.5 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">
                                {hosting.hostingType?.replace("_", " ") ||
                                  (ar ? "استضافة" : "Hosting")}
                                <span className="text-muted-foreground font-normal">
                                  {" "}
                                  • {ar ? "غرفة" : "Room"}{" "}
                                  {hostingRoomLabel(hosting)}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {hosting.expectedFrom
                                  ? format(
                                      new Date(hosting.expectedFrom),
                                      "MMM d, yyyy",
                                    )
                                  : "—"}
                                {" - "}
                                {hosting.expectedTo
                                  ? format(
                                      new Date(hosting.expectedTo),
                                      "MMM d, yyyy",
                                    )
                                  : "—"}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {hosting.status}
                            </Badge>
                          </div>

                          {guests.length > 0 ? (
                            <div className="space-y-1.5">
                              {guests.map((guest: any) => (
                                <div
                                  key={
                                    guest.id ?? `${hosting.id}-${guest.name}`
                                  }
                                  className="flex items-center gap-2 rounded-md bg-background/70 p-2"
                                >
                                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">
                                      {guest.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {guestLabel(guest) ||
                                        (ar ? "بيانات الضيف" : "Guest details")}
                                      {guest.idNumber
                                        ? ` • ${guest.idNumber}`
                                        : ""}
                                    </p>
                                  </div>
                                  {guest.documentImage && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setLightboxSrc(guest.documentImage);
                                        setLightboxName(guest.documentFileName);
                                      }}
                                      className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border bg-background text-primary hover:bg-muted hover:border-primary transition-colors overflow-hidden"
                                      title={
                                        guest.documentFileName ||
                                        (ar ? "عرض المستند" : "View document")
                                      }
                                    >
                                      {guest.documentImage.startsWith(
                                        "data:image/",
                                      ) ||
                                      /\.(png|jpg|jpeg|gif|webp)$/i.test(
                                        guest.documentImage,
                                      ) ? (
                                        <img
                                          src={guest.documentImage}
                                          alt=""
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <ImageIcon className="h-4 w-4" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 rounded-md bg-background/70 p-2 text-sm text-muted-foreground">
                              <FileText className="h-4 w-4" />
                              {ar
                                ? "لا توجد بيانات ضيوف مسجلة"
                                : "No guest details recorded"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-3 text-center text-sm text-muted-foreground">
                    <Users className="w-6 h-6 mx-auto mb-1 opacity-30" />
                    {ar
                      ? "لا توجد استضافات ضيوف لهذا الموظف"
                      : "No guest hostings for this employee"}
                  </div>
                )}
              </div>

              {/* Roommates */}
              {roommates.length > 0 && (
                <div className="rounded-xl border p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {ar ? "زملاء الغرفة" : "Roommates"} ({roommates.length})
                  </p>
                  <div className="space-y-1.5">
                    {roommates.map((rm: any) => {
                      const rmEmp = empMap[rm.employeeId] as any;
                      return (
                        <div
                          key={rm.id}
                          className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          {rmEmp?.photoUrl ? (
                            <img
                              src={rmEmp.photoUrl}
                              className="w-8 h-8 rounded-full object-cover border flex-shrink-0"
                              alt=""
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-primary">
                                {rmEmp
                                  ? `${rmEmp.firstName?.[0] ?? ""}${rmEmp.lastName?.[0] ?? ""}`
                                  : "?"}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">
                              {rmEmp
                                ? `${rmEmp.firstName} ${rmEmp.lastName}`
                                : `#${rm.employeeId}`}
                            </p>
                            {rmEmp && (
                              <p className="text-xs text-muted-foreground truncate">
                                {rmEmp.jobTitle || rmEmp.department || ""}
                              </p>
                            )}
                          </div>
                          {rm.bedNumber && (
                            <Badge
                              variant="outline"
                              className="text-xs shrink-0"
                            >
                              <BedDouble className="w-3 h-3 mr-1" />
                              {rm.bedNumber}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              {ar ? "الموظف غير موجود" : "Employee not found"}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <ImageLightbox
        src={lightboxSrc}
        fileName={lightboxName}
        onClose={() => setLightboxSrc(null)}
      />
    </>

);
}

================================================================================
FILE: artifacts/housing/src/components/ui/empty.tsx
================================================================================

// @ts-nocheck
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="empty"
className={cn(
"flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance rounded-lg border-dashed p-6 text-center md:p-12",
className,
)}
{...props}
/>
);
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="empty-header"
className={cn(
"flex max-w-sm flex-col items-center gap-2 text-center",
className,
)}
{...props}
/>
);
}

const emptyMediaVariants = cva(
"mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
{
variants: {
variant: {
default: "bg-transparent",
icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&\_svg:not([class*='size-'])]:size-6",
},
},
defaultVariants: {
variant: "default",
},
},
);

function EmptyMedia({
className,
variant = "default",
...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
return (
<div
data-slot="empty-icon"
data-variant={variant}
className={cn(emptyMediaVariants({ variant, className }))}
{...props}
/>
);
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="empty-title"
className={cn("text-lg font-medium tracking-tight", className)}
{...props}
/>
);
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
return (
<div
data-slot="empty-description"
className={cn(
"text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4",
className,
)}
{...props}
/>
);
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="empty-content"
className={cn(
"flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm",
className,
)}
{...props}
/>
);
}

export {
Empty,
EmptyHeader,
EmptyTitle,
EmptyDescription,
EmptyContent,
EmptyMedia,
};

================================================================================
FILE: artifacts/housing/src/components/ui/field.tsx
================================================================================

// @ts-nocheck
"use client";

import { useMemo } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
return (
<fieldset
data-slot="field-set"
className={cn(
"flex flex-col gap-6",
"has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
className,
)}
{...props}
/>
);
}

function FieldLegend({
className,
variant = "legend",
...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
return (
<legend
data-slot="field-legend"
data-variant={variant}
className={cn(
"mb-3 font-medium",
"data-[variant=legend]:text-base",
"data-[variant=label]:text-sm",
className,
)}
{...props}
/>
);
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="field-group"
className={cn(
"group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4",
className,
)}
{...props}
/>
);
}

const fieldVariants = cva(
"group/field data-[invalid=true]:text-destructive flex w-full gap-3",
{
variants: {
orientation: {
vertical: ["flex-col [&>*]:w-full [&>.sr-only]:w-auto"],
horizontal: [
"flex-row items-center",
"[&>[data-slot=field-label]]:flex-auto",
"has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px has-[>[data-slot=field-content]]:items-start",
],
responsive: [
"@md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto flex-col [&>*]:w-full [&>.sr-only]:w-auto",
"@md/field-group:[&>[data-slot=field-label]]:flex-auto",
"@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
],
},
},
defaultVariants: {
orientation: "vertical",
},
},
);

function Field({
className,
orientation = "vertical",
...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
return (
<div
role="group"
data-slot="field"
data-orientation={orientation}
className={cn(fieldVariants({ orientation }), className)}
{...props}
/>
);
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="field-content"
className={cn(
"group/field-content flex flex-1 flex-col gap-1.5 leading-snug",
className,
)}
{...props}
/>
);
}

function FieldLabel({
className,
...props
}: React.ComponentProps<typeof Label>) {
return (
<Label
data-slot="field-label"
className={cn(
"group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50",
"has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>[data-slot=field]]:p-4",
"has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:border-primary dark:has-data-[state=checked]:bg-primary/10",
className,
)}
{...props}
/>
);
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="field-label"
className={cn(
"flex w-fit items-center gap-2 text-sm font-medium leading-snug group-data-[disabled=true]/field:opacity-50",
className,
)}
{...props}
/>
);
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
return (
<p
data-slot="field-description"
className={cn(
"text-muted-foreground text-sm font-normal leading-normal group-has-[[data-orientation=horizontal]]/field:text-balance",
"nth-last-2:-mt-1 last:mt-0 [[data-variant=legend]+&]:-mt-1.5",
"[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
className,
)}
{...props}
/>
);
}

function FieldSeparator({
children,
className,
...props
}: React.ComponentProps<"div"> & {
children?: React.ReactNode;
}) {
return (
<div
data-slot="field-separator"
data-content={!!children}
className={cn(
"relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
className,
)}
{...props} >
<Separator className="absolute inset-0 top-1/2" />
{children && (
<span
          className="bg-background text-muted-foreground relative mx-auto block w-fit px-2"
          data-slot="field-separator-content"
        >
{children}
</span>
)}
</div>
);
}

function FieldError({
className,
children,
errors,
...props
}: React.ComponentProps<"div"> & {
errors?: Array<{ message?: string } | undefined>;
}) {
const content = useMemo(() => {
if (children) {
return children;
}

    if (!errors) {
      return null;
    }

    if (errors?.length === 1 && errors[0]?.message) {
      return errors[0].message;
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {errors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>,
        )}
      </ul>
    );

}, [children, errors]);

if (!content) {
return null;
}

return (
<div
role="alert"
data-slot="field-error"
className={cn("text-destructive text-sm font-normal", className)}
{...props} >
{content}
</div>
);
}

export {
Field,
FieldLabel,
FieldDescription,
FieldError,
FieldGroup,
FieldLegend,
FieldSeparator,
FieldSet,
FieldContent,
FieldTitle,
};

================================================================================
FILE: artifacts/housing/src/components/ui/form.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import {
Controller,
FormProvider,
useFormContext,
type ControllerProps,
type FieldPath,
type FieldValues,
} from "react-hook-form";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const Form = FormProvider;

type FormFieldContextValue<
TFieldValues extends FieldValues = FieldValues,
TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,

> = {
> name: TName;
> };

const FormFieldContext = React.createContext<FormFieldContextValue | null>(
null,
);

const FormField = <
TFieldValues extends FieldValues = FieldValues,
TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,

> ({
> ...props
> }: ControllerProps<TFieldValues, TName>) => {
> return (

    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>

);
};

const useFormField = () => {
const fieldContext = React.useContext(FormFieldContext);
const itemContext = React.useContext(FormItemContext);
const { getFieldState, formState } = useFormContext();

if (!fieldContext) {
throw new Error("useFormField should be used within <FormField>");
}

if (!itemContext) {
throw new Error("useFormField should be used within <FormItem>");
}

const fieldState = getFieldState(fieldContext.name, formState);

const { id } = itemContext;

return {
id,
name: fieldContext.name,
formItemId: `${id}-form-item`,
formDescriptionId: `${id}-form-item-description`,
formMessageId: `${id}-form-item-message`,
...fieldState,
};
};

type FormItemContextValue = {
id: string;
};

const FormItemContext = React.createContext<FormItemContextValue | null>(null);

const FormItem = React.forwardRef<
HTMLDivElement,
React.HTMLAttributes<HTMLDivElement>

> (({ className, ...props }, ref) => {
> const id = React.useId();

return (
<FormItemContext.Provider value={{ id }}>
<div ref={ref} className={cn("space-y-2", className)} {...props} />
</FormItemContext.Provider>
);
});
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<
React.ElementRef<typeof LabelPrimitive.Root>,
React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>

> (({ className, ...props }, ref) => {
> const { error, formItemId } = useFormField();

return (
<Label
ref={ref}
className={cn(error && "text-destructive", className)}
htmlFor={formItemId}
{...props}
/>
);
});
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef<
React.ElementRef<typeof Slot>,
React.ComponentPropsWithoutRef<typeof Slot>

> (({ ...props }, ref) => {
> const { error, formItemId, formDescriptionId, formMessageId } =

    useFormField();

return (
<Slot
ref={ref}
id={formItemId}
aria-describedby={
!error
? `${formDescriptionId}`
: `${formDescriptionId} ${formMessageId}`
}
aria-invalid={!!error}
{...props}
/>
);
});
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef<
HTMLParagraphElement,
React.HTMLAttributes<HTMLParagraphElement>

> (({ className, ...props }, ref) => {
> const { formDescriptionId } = useFormField();

return (
<p
ref={ref}
id={formDescriptionId}
className={cn("text-[0.8rem] text-muted-foreground", className)}
{...props}
/>
);
});
FormDescription.displayName = "FormDescription";

const FormMessage = React.forwardRef<
HTMLParagraphElement,
React.HTMLAttributes<HTMLParagraphElement>

> (({ className, children, ...props }, ref) => {
> const { error, formMessageId } = useFormField();
> const body = error ? String(error?.message ?? "") : children;

if (!body) {
return null;
}

return (
<p
ref={ref}
id={formMessageId}
className={cn("text-[0.8rem] font-medium text-destructive", className)}
{...props} >
{body}
</p>
);
});
FormMessage.displayName = "FormMessage";

export {
useFormField,
Form,
FormItem,
FormLabel,
FormControl,
FormDescription,
FormMessage,
FormField,
};

================================================================================
FILE: artifacts/housing/src/components/ui/hover-card.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as HoverCardPrimitive from "@radix-ui/react-hover-card";

import { cn } from "@/lib/utils";

const HoverCard = HoverCardPrimitive.Root;

const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = React.forwardRef<
React.ElementRef<typeof HoverCardPrimitive.Content>,
React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>

> (({ className, align = "center", sideOffset = 4, ...props }, ref) => (
> <HoverCardPrimitive.Content

    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-hover-card-content-transform-origin]",
      className,
    )}
    {...props}

/>
));
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

export { HoverCard, HoverCardTrigger, HoverCardContent };

================================================================================
FILE: artifacts/housing/src/components/ui/image-lightbox.tsx
================================================================================

// @ts-nocheck
import { useEffect, useCallback, useState } from "react";
import {
X,
ZoomIn,
ZoomOut,
Download,
RotateCw,
ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface ImageLightboxProps {
src: string | null;
alt?: string;
fileName?: string;
onClose: () => void;
}

export function ImageLightbox({
src,
alt = "",
fileName,
onClose,
}: ImageLightboxProps) {
const [zoom, setZoom] = useState(1);
const [rotation, setRotation] = useState(0);

const handleKeyDown = useCallback(
(e: KeyboardEvent) => {
if (!src) return;
if (e.key === "Escape") onClose();
if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 4));
if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.25));
},
[onClose, src],
);

useEffect(() => {
if (!src) return;
document.addEventListener("keydown", handleKeyDown);
return () => {
document.removeEventListener("keydown", handleKeyDown);
};
}, [src, handleKeyDown]);

// Reset zoom/rotation when image changes
useEffect(() => {
setZoom(1);
setRotation(0);
}, [src]);

const isImage = src
? src.startsWith("data:image/") ||
/\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?|$)/i.test(src)
: false;

const handleDownload = () => {
if (!src) return;
const a = document.createElement("a");
a.href = src;
a.download = fileName || "document";
a.click();
};

return (
<Dialog
open={!!src}
onOpenChange={(open) => {
if (!open) onClose();
}} >
<DialogContent
className="max-w-none w-full h-full p-0 border-none bg-transparent shadow-none [&>button]:hidden flex items-center justify-center overflow-hidden"
srTitle={fileName || "Image Viewer"}
style={{
          transform: "none",
          top: 0,
          left: 0,
          translate: "none",
          margin: 0,
        }}
onClick={(e) => {
if (e.target === e.currentTarget) onClose();
}} >
<div
          className="fixed inset-0 z-0 bg-black/90 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Toolbar */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
          <span className="text-white/80 text-sm font-medium truncate max-w-[50%] px-4">
            {fileName || alt || ""}
          </span>
          <div className="flex items-center gap-1.5 px-4">
            {isImage && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
                  title="Zoom out (−)"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-white/70 text-xs w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
                  title="Zoom in (+)"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="Rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => window.open(src || "", "_blank")}
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={onClose}
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Image/Content */}
        <div className="relative z-10 flex items-center justify-center w-full h-full p-16 pointer-events-none">
          {isImage ? (
            <div
              className="overflow-auto max-w-full max-h-full flex items-center justify-center pointer-events-auto"
              style={{ cursor: zoom > 1 ? "grab" : "default" }}
            >
              <img
                src={src || ""}
                alt={alt}
                draggable={false}
                className="rounded-lg shadow-2xl object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  maxWidth: zoom <= 1 ? "min(90vw, 1000px)" : undefined,
                  maxHeight: zoom <= 1 ? "80vh" : undefined,
                }}
              />
            </div>
          ) : (
            <div className="bg-card rounded-xl p-8 text-center shadow-2xl max-w-sm w-full pointer-events-auto">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="w-8 h-8 text-primary" />
              </div>
              <p className="text-foreground font-semibold mb-1">
                {fileName || "Document"}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                This file cannot be previewed inline.
              </p>
              <div className="flex gap-2 justify-center">
                <Button size="sm" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(src || "", "_blank")}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Click-outside hint */}
        <div className="absolute bottom-4 left-0 right-0 text-center z-10 pointer-events-none">
          <span className="text-white/40 text-xs">
            Click outside or press Esc to close
          </span>
        </div>
      </DialogContent>
    </Dialog>

);
}

================================================================================
FILE: artifacts/housing/src/components/ui/input-group.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="input-group"
role="group"
className={cn(
"group/input-group border-input dark:bg-input/30 shadow-xs relative flex w-full items-center rounded-md border outline-none transition-[color,box-shadow]",
"h-9 has-[>textarea]:h-auto",

        // Variants based on alignment.
        "has-[>[data-align=inline-start]]:[&>input]:pl-2",
        "has-[>[data-align=inline-end]]:[&>input]:pr-2",
        "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
        "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",

        // Focus state.
        "has-[[data-slot=input-group-control]:focus-visible]:ring-ring has-[[data-slot=input-group-control]:focus-visible]:ring-1",

        // Error state.
        "has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",

        className,
      )}
      {...props}
    />

);
}

const inputGroupAddonVariants = cva(
"text-muted-foreground flex h-auto cursor-text select-none items-center justify-center gap-2 py-1.5 text-sm font-medium group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
{
variants: {
align: {
"inline-start":
"order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
"inline-end":
"order-last pr-3 has-[>button]:mr-[-0.4rem] has-[>kbd]:mr-[-0.35rem]",
"block-start":
"[.border-b]:pb-3 order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5",
"block-end":
"[.border-t]:pt-3 order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5",
},
},
defaultVariants: {
align: "inline-start",
},
},
);

function InputGroupAddon({
className,
align = "inline-start",
...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
return (
<div
role="group"
data-slot="input-group-addon"
data-align={align}
className={cn(inputGroupAddonVariants({ align }), className)}
onClick={(e) => {
if ((e.target as HTMLElement).closest("button")) {
return;
}
e.currentTarget.parentElement?.querySelector("input")?.focus();
}}
{...props}
/>
);
}

const inputGroupButtonVariants = cva(
"flex items-center gap-2 text-sm shadow-none",
{
variants: {
size: {
xs: "h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
sm: "h-8 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5",
"icon-xs":
"size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
"icon-sm": "size-8 p-0 has-[>svg]:p-0",
},
},
defaultVariants: {
size: "xs",
},
},
);

function InputGroupButton({
className,
type = "button",
variant = "ghost",
size = "xs",
...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
VariantProps<typeof inputGroupButtonVariants>) {
return (
<Button
type={type}
data-size={size}
variant={variant}
className={cn(inputGroupButtonVariants({ size }), className)}
{...props}
/>
);
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
return (
<span
className={cn(
"text-muted-foreground flex items-center gap-2 text-sm [&\_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
className,
)}
{...props}
/>
);
}

function InputGroupInput({
className,
...props
}: React.ComponentProps<"input">) {
return (
<Input
data-slot="input-group-control"
className={cn(
"flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent",
className,
)}
{...props}
/>
);
}

function InputGroupTextarea({
className,
...props
}: React.ComponentProps<"textarea">) {
return (
<Textarea
data-slot="input-group-control"
className={cn(
"flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent",
className,
)}
{...props}
/>
);
}

export {
InputGroup,
InputGroupAddon,
InputGroupButton,
InputGroupText,
InputGroupInput,
InputGroupTextarea,
};

================================================================================
FILE: artifacts/housing/src/components/ui/input-otp.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { Minus } from "lucide-react";

import { cn } from "@/lib/utils";

const InputOTP = React.forwardRef<
React.ElementRef<typeof OTPInput>,
React.ComponentPropsWithoutRef<typeof OTPInput>

> (({ className, containerClassName, ...props }, ref) => (
> <OTPInput

    ref={ref}
    containerClassName={cn(
      "flex items-center gap-2 has-[:disabled]:opacity-50",
      containerClassName,
    )}
    className={cn("disabled:cursor-not-allowed", className)}
    {...props}

/>
));
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef<
React.ElementRef<"div">,
React.ComponentPropsWithoutRef<"div">

> (({ className, ...props }, ref) => (

  <div ref={ref} className={cn("flex items-center", className)} {...props} />
));
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = React.forwardRef<
React.ElementRef<"div">,
React.ComponentPropsWithoutRef<"div"> & { index: number }

> (({ index, className, ...props }, ref) => {
> const inputOTPContext = React.useContext(OTPInputContext);
> const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index];

return (
<div
ref={ref}
className={cn(
"relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
isActive && "z-10 ring-1 ring-ring",
className,
)}
{...props} >
{char}
{hasFakeCaret && (
<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
<div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
</div>
)}
</div>
);
});
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = React.forwardRef<
React.ElementRef<"div">,
React.ComponentPropsWithoutRef<"div">

> (({ ...props }, ref) => (

  <div ref={ref} role="separator" {...props}>
    <Minus />
  </div>
));
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };

================================================================================
FILE: artifacts/housing/src/components/ui/input.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
({ className, type, ...props }, ref) => {
return (
<input
type={type}
className={cn(
"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
className,
)}
ref={ref}
{...props}
/>
);
},
);
Input.displayName = "Input";

export { Input };

================================================================================
FILE: artifacts/housing/src/components/ui/item.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
role="list"
data-slot="item-group"
className={cn("group/item-group flex flex-col", className)}
{...props}
/>
);
}

function ItemSeparator({
className,
...props
}: React.ComponentProps<typeof Separator>) {
return (
<Separator
data-slot="item-separator"
orientation="horizontal"
className={cn("my-0", className)}
{...props}
/>
);
}

const itemVariants = cva(
"group/item [a]:hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-ring/50 [a]:transition-colors flex flex-wrap items-center rounded-md border border-transparent text-sm outline-none transition-colors duration-100 focus-visible:ring-[3px]",
{
variants: {
variant: {
default: "bg-transparent",
outline: "border-border",
muted: "bg-muted/50",
},
size: {
default: "gap-4 p-4 ",
sm: "gap-2.5 px-4 py-3",
},
},
defaultVariants: {
variant: "default",
size: "default",
},
},
);

function Item({
className,
variant = "default",
size = "default",
asChild = false,
...props
}: React.ComponentProps<"div"> &
VariantProps<typeof itemVariants> & { asChild?: boolean }) {
const Comp = asChild ? Slot : "div";
return (
<Comp
data-slot="item"
data-variant={variant}
data-size={size}
className={cn(itemVariants({ variant, size, className }))}
{...props}
/>
);
}

const itemMediaVariants = cva(
"flex shrink-0 items-center justify-center gap-2 group-has-[[data-slot=item-description]]/item:translate-y-0.5 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none",
{
variants: {
variant: {
default: "bg-transparent",
icon: "bg-muted size-8 rounded-sm border [&\_svg:not([class*='size-'])]:size-4",
image:
"size-10 overflow-hidden rounded-sm [&_img]:size-full [&_img]:object-cover",
},
},
defaultVariants: {
variant: "default",
},
},
);

function ItemMedia({
className,
variant = "default",
...props
}: React.ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
return (
<div
data-slot="item-media"
data-variant={variant}
className={cn(itemMediaVariants({ variant, className }))}
{...props}
/>
);
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="item-content"
className={cn(
"flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none",
className,
)}
{...props}
/>
);
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="item-title"
className={cn(
"flex w-fit items-center gap-2 text-sm font-medium leading-snug",
className,
)}
{...props}
/>
);
}

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
return (
<p
data-slot="item-description"
className={cn(
"text-muted-foreground line-clamp-2 text-balance text-sm font-normal leading-normal",
"[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
className,
)}
{...props}
/>
);
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="item-actions"
className={cn("flex items-center gap-2", className)}
{...props}
/>
);
}

function ItemHeader({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="item-header"
className={cn(
"flex basis-full items-center justify-between gap-2",
className,
)}
{...props}
/>
);
}

function ItemFooter({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="item-footer"
className={cn(
"flex basis-full items-center justify-between gap-2",
className,
)}
{...props}
/>
);
}

export {
Item,
ItemMedia,
ItemContent,
ItemActions,
ItemGroup,
ItemSeparator,
ItemTitle,
ItemDescription,
ItemHeader,
ItemFooter,
};

================================================================================
FILE: artifacts/housing/src/components/ui/kbd.tsx
================================================================================

// @ts-nocheck
import { cn } from "@/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
return (
<kbd
data-slot="kbd"
className={cn(
"bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium",
"[&_svg:not([class*='size-'])]:size-3",
"[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10",
className,
)}
{...props}
/>
);
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
return (
<kbd
data-slot="kbd-group"
className={cn("inline-flex items-center gap-1", className)}
{...props}
/>
);
}

export { Kbd, KbdGroup };

================================================================================
FILE: artifacts/housing/src/components/ui/label.tsx
================================================================================

// @ts-nocheck
"use client";

import _ as React from "react";
import _ as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva(
"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
React.ElementRef<typeof LabelPrimitive.Root>,
React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
VariantProps<typeof labelVariants>

> (({ className, ...props }, ref) => (
> <LabelPrimitive.Root

    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}

/>
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };

================================================================================
FILE: artifacts/housing/src/components/ui/loader.tsx
================================================================================

// @ts-nocheck
import { Loader2 } from "lucide-react";

export function Loader({ className }: { className?: string }) {
return <Loader2 className={`h-4 w-4 animate-spin ${className || ""}`} />;
}

export function PageLoader() {
return (
<div className="flex h-full w-full items-center justify-center min-h-[400px]">
<Loader className="h-8 w-8 text-primary" />
</div>
);
}

================================================================================
FILE: artifacts/housing/src/components/ui/maintenance-drawer.tsx
================================================================================

import { X, MessageSquare, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface MaintenanceDrawerProps {
isOpen: boolean;
onClose: () => void;
ticket?: any;
employees?: any[];
ar?: boolean;
onStatusChange?: (status: string) => void;
onAssignChange?: (empId: number | null) => void;
}

export default function MaintenanceDrawer({
isOpen,
onClose,
ticket,
employees = [],
ar = false,
onStatusChange,
onAssignChange,
}: MaintenanceDrawerProps) {
if (!isOpen || !ticket) return null;

const empMap = Object.fromEntries(
employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]),
);

const formatDuration = (startedAt: any, resolvedAt: any, reportedAt: any) => {
const start = reportedAt ?? startedAt;
if (!start) return "—";
const startDate = new Date(start);
const endDate = resolvedAt ? new Date(resolvedAt) : new Date();
const totalMins = Math.floor(
(endDate.getTime() - startDate.getTime()) / (1000 \* 60),
);
if (totalMins < 1) return "<1m";
if (totalMins < 60) return `${totalMins}m`;
const hrs = Math.floor(totalMins / 60);
const mins = totalMins % 60;
return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

return (
<>
{/_ Backdrop _/}
<div
className={`fixed inset-0 bg-black/50 transition-opacity z-40 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
onClick={onClose}
/>

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 z-50 flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {ar ? "تفاصيل الطلب" : "Request Details"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Details Section */}
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                {ar ? "التفاصيل" : "Details"}
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "رقم الطلب" : "Request ID"}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {ticket.id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "الحالة" : "Status"}
                  </p>
                  <div className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                    {ticket.status?.replace("_", " ")}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "الأولوية" : "Priority"}
                  </p>
                  <div className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                    {ticket.priority}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "الغرفة" : "Room"}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    Room {ticket.roomId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "النوع" : "Type"}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {ticket.category}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "الوصف" : "Description"}
                  </p>
                  <p className="text-sm text-gray-700">{ticket.description}</p>
                </div>
              </div>
            </div>

            {/* Tasks/Actions Section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                {ar ? "الإجراءات" : "Actions"}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    {ar ? "التعيين إلى" : "Assign To"}
                  </label>
                  <Select
                    value={ticket.assignedTo ? String(ticket.assignedTo) : ""}
                    onValueChange={(v) => {
                      const empId = v ? parseInt(v) : null;
                      onAssignChange?.(empId);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={ar ? "اختر..." : "Select..."} />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className="max-h-48 overflow-y-auto"
                    >
                      <SelectItem value="unassigned">
                        — {ar ? "غير مسند" : "Unassigned"} —
                      </SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.firstName} {e.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    {ar ? "تغيير الحالة" : "Change Status"}
                  </label>
                  <Select
                    value={ticket.status || ""}
                    onValueChange={(status) => onStatusChange?.(status)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">
                        {ar ? "مفتوح" : "Open"}
                      </SelectItem>
                      <SelectItem value="in_progress">
                        {ar ? "قيد التنفيذ" : "In Progress"}
                      </SelectItem>
                      <SelectItem value="resolved">
                        {ar ? "محلول" : "Resolved"}
                      </SelectItem>
                      <SelectItem value="closed">
                        {ar ? "مغلق" : "Closed"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full h-8 text-xs gap-2" variant="outline">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {ar ? "إضافة تعليق" : "Add Comment"}
                </Button>
              </div>
            </div>

            {/* Time Sheet Section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                {ar ? "الوقت" : "Time"}
              </h3>
              <div className="space-y-3 bg-gray-50 p-3 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "تاريخ الإبلاغ" : "Reported"}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {ticket.reportedAt
                      ? format(
                          new Date(ticket.reportedAt),
                          "dd MMM yyyy - HH:mm",
                        )
                      : "—"}
                  </p>
                </div>
                {ticket.startedAt && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      {ar ? "بدء التنفيذ" : "Started"}
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {format(
                        new Date(ticket.startedAt),
                        "dd MMM yyyy - HH:mm",
                      )}
                    </p>
                  </div>
                )}
                {ticket.resolvedAt && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      {ar ? "تم الحل" : "Resolved"}
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {format(
                        new Date(ticket.resolvedAt),
                        "dd MMM yyyy - HH:mm",
                      )}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "المدة الإجمالية" : "Total Duration"}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDuration(
                      ticket.startedAt,
                      ticket.resolvedAt,
                      ticket.reportedAt,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={onClose}
          >
            {ar ? "إغلاق" : "Close"}
          </Button>
        </div>
      </div>
    </>

);
}

================================================================================
FILE: artifacts/housing/src/components/ui/maintenance-filter-bar.tsx
================================================================================

import { useState } from "react";
import { Plus, RotateCcw } from "lucide-react";

interface MaintenanceFilterBarProps {
properties?: any[];
departments?: string[];
employees?: any[];
onCreateNew?: () => void;
onFiltersChange?: (filters: MaintenanceFilterState) => void;
ar?: boolean;
}

interface MaintenanceFilterState {
fromDate: string;
toDate: string;
status: string;
type: string;
priority: string;
departments: string[];
creatorType: string;
propertyId: string;
}

const INITIAL_FILTERS: MaintenanceFilterState = {
fromDate: "",
toDate: "",
status: "",
type: "",
priority: "",
departments: [],
creatorType: "",
propertyId: "",
};

const STATUS_OPTIONS = [
{ value: "open", label: "Open", labelAr: "مفتوحة" },
{ value: "in_progress", label: "In Progress", labelAr: "قيد التنفيذ" },
{ value: "resolved", label: "Resolved", labelAr: "محلولة" },
{ value: "closed", label: "Closed", labelAr: "مغلقة" },
];
const PRIORITY_OPTIONS = [
{ value: "low", label: "Low", labelAr: "منخفضة" },
{ value: "medium", label: "Medium", labelAr: "متوسطة" },
{ value: "high", label: "High", labelAr: "عالية" },
{ value: "urgent", label: "Urgent", labelAr: "عاجلة" },
];
const TYPE_OPTIONS = [
{ value: "maintenance", label: "Maintenance", labelAr: "صيانة" },
{ value: "housekeeping", label: "Housekeeping", labelAr: "هاوس كيبنج" },
{ value: "general", label: "General", labelAr: "عام" },
];
const CREATOR_OPTIONS = [
{ value: "", label: "All", labelAr: "الكل" },
{ value: "staff", label: "Staff", labelAr: "موظف" },
{ value: "guest", label: "Guest From App", labelAr: "ضيف من التطبيق" },
];

export default function MaintenanceFilterBar({
properties = [],
departments = ["Front Office", "Engineering", "House Keeping"],
employees = [],
onCreateNew,
onFiltersChange,
ar = false,
}: MaintenanceFilterBarProps) {
const [filters, setFilters] = useState<MaintenanceFilterState>({
...INITIAL_FILTERS,
});
const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>(
{},
);

const toggleDropdown = (key: string) => {
setOpenDropdowns((prev) => ({
...Object.keys(prev).reduce((acc, k) => ({ ...acc, [k]: false }), {}),
[key]: !prev[key],
}));
};

const handleMultiSelect = (value: string) => {
const newFilters = {
...filters,
departments: filters.departments.includes(value)
? filters.departments.filter((item) => item !== value)
: [...filters.departments, value],
};
setFilters(newFilters);
onFiltersChange?.(newFilters);
};

const handleSingleSelect = (
key: keyof MaintenanceFilterState,
value: string,
) => {
const newFilters = { ...filters, [key]: value };
setFilters(newFilters);
onFiltersChange?.(newFilters);
};

const handleDateChange = (key: "fromDate" | "toDate", value: string) => {
const newFilters = { ...filters, [key]: value };
setFilters(newFilters);
onFiltersChange?.(newFilters);
};

const handleResetAll = () => {
const resetFilters = { ...INITIAL_FILTERS };
setFilters(resetFilters);
onFiltersChange?.(resetFilters);
};

const hasActiveFilters =
filters.fromDate ||
filters.toDate ||
filters.status ||
filters.type ||
filters.priority ||
filters.departments.length > 0 ||
filters.creatorType ||
filters.propertyId;

const getSelectedLabel = (arr: string[]) => {
if (arr.length === 0) return ar ? "اختر..." : "Select...";
if (arr.length === 1) return arr[0];
return `${arr[0]}, ${arr[1]}${arr.length > 2 ? "..." : ""}`;
};

const selectClass =
"w-full px-3 py-1.5 bg-muted/50 border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary transition-colors";
const labelClass = "block text-xs font-semibold text-muted-foreground";

return (
<div className="bg-card rounded-lg p-4 space-y-4 border border-border shadow-sm">
{/_ Row 1 _/}
<div className="grid grid-cols-4 gap-3">
{/_ Property _/}
<div className="space-y-1">
<label className={labelClass}>{ar ? "الفرع" : "Properties"}</label>
<select
value={filters.propertyId}
onChange={(e) => handleSingleSelect("propertyId", e.target.value)}
className={selectClass} >
<option value="">{ar ? "الكل" : "All"}</option>
{properties.map((p) => (
<option key={p.id} value={String(p.id)}>
{p.displayName || p.name}
</option>
))}
</select>
</div>

        {/* From Date */}
        <div className="space-y-1">
          <label className={labelClass}>
            {ar ? "من التاريخ" : "From Date"}
          </label>
          <input
            type="date"
            value={filters.fromDate}
            onChange={(e) => handleDateChange("fromDate", e.target.value)}
            className={selectClass}
          />
        </div>

        {/* To Date */}
        <div className="space-y-1">
          <label className={labelClass}>{ar ? "إلى التاريخ" : "To Date"}</label>
          <input
            type="date"
            value={filters.toDate}
            onChange={(e) => handleDateChange("toDate", e.target.value)}
            className={selectClass}
          />
        </div>

        {/* Status */}
        <div className="space-y-1">
          <label className={labelClass}>{ar ? "الحالة" : "Status"}</label>
          <select
            value={filters.status}
            onChange={(e) => handleSingleSelect("status", e.target.value)}
            className={selectClass}
          >
            <option value="">{ar ? "الكل" : "All"}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {ar ? s.labelAr : s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-4 gap-3">
        {/* Type */}
        <div className="space-y-1">
          <label className={labelClass}>{ar ? "النوع" : "Type"}</label>
          <select
            value={filters.type}
            onChange={(e) => handleSingleSelect("type", e.target.value)}
            className={selectClass}
          >
            <option value="">{ar ? "الكل" : "All"}</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {ar ? t.labelAr : t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="space-y-1">
          <label className={labelClass}>{ar ? "الأولوية" : "Priority"}</label>
          <select
            value={filters.priority}
            onChange={(e) => handleSingleSelect("priority", e.target.value)}
            className={selectClass}
          >
            <option value="">{ar ? "الكل" : "All"}</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {ar ? p.labelAr : p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Departments */}
        <div className="space-y-1">
          <label className={labelClass}>{ar ? "الأقسام" : "Departments"}</label>
          <div className="relative">
            <button
              onClick={() => toggleDropdown("departments")}
              className="w-full px-3 py-1.5 bg-muted/50 border border-border rounded text-left text-xs text-foreground hover:border-primary/40 focus:outline-none flex items-center justify-between transition-colors"
            >
              <span className="truncate">
                {filters.departments.length === 0
                  ? ar
                    ? "اختر..."
                    : "Select..."
                  : getSelectedLabel(filters.departments)}
              </span>
              <svg
                className="w-3 h-3 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {openDropdowns["departments"] && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded shadow-lg">
                <div className="max-h-40 overflow-y-auto">
                  {departments.map((dept) => (
                    <label
                      key={dept}
                      className="flex items-center px-3 py-1.5 hover:bg-accent cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={filters.departments.includes(dept)}
                        onChange={() => handleMultiSelect(dept)}
                        className="rounded"
                      />
                      <span className="ml-2 text-xs text-foreground">
                        {dept}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Creator Type */}
        <div className="space-y-1">
          <label className={labelClass}>
            {ar ? "نوع المنشئ" : "Creator Type"}
          </label>
          <select
            value={filters.creatorType}
            onChange={(e) => handleSingleSelect("creatorType", e.target.value)}
            className={selectClass}
          >
            {CREATOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {ar ? opt.labelAr : opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        {hasActiveFilters ? (
          <button
            onClick={handleResetAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded border border-border hover:bg-accent transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            {ar ? "إعادة تعيين الفلاتر" : "Reset Filters"}
          </button>
        ) : (
          <div />
        )}
        <button
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded text-xs font-semibold hover:bg-primary/90 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          {ar ? "إنشاء تذكرة جديدة" : "Create New Ticket"}
        </button>
      </div>
    </div>

);
}

================================================================================
FILE: artifacts/housing/src/components/ui/menubar.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as MenubarPrimitive from "@radix-ui/react-menubar";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

function MenubarMenu({
...props
}: React.ComponentProps<typeof MenubarPrimitive.Menu>) {
return <MenubarPrimitive.Menu {...props} />;
}

function MenubarGroup({
...props
}: React.ComponentProps<typeof MenubarPrimitive.Group>) {
return <MenubarPrimitive.Group {...props} />;
}

function MenubarPortal({
...props
}: React.ComponentProps<typeof MenubarPrimitive.Portal>) {
return <MenubarPrimitive.Portal {...props} />;
}

function MenubarRadioGroup({
...props
}: React.ComponentProps<typeof MenubarPrimitive.RadioGroup>) {
return <MenubarPrimitive.RadioGroup {...props} />;
}

function MenubarSub({
...props
}: React.ComponentProps<typeof MenubarPrimitive.Sub>) {
return <MenubarPrimitive.Sub data-slot="menubar-sub" {...props} />;
}

const Menubar = React.forwardRef<
React.ElementRef<typeof MenubarPrimitive.Root>,
React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>

> (({ className, ...props }, ref) => (
> <MenubarPrimitive.Root

    ref={ref}
    className={cn(
      "flex h-9 items-center space-x-1 rounded-md border bg-background p-1 shadow-sm",
      className,
    )}
    {...props}

/>
));
Menubar.displayName = MenubarPrimitive.Root.displayName;

const MenubarTrigger = React.forwardRef<
React.ElementRef<typeof MenubarPrimitive.Trigger>,
React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>

> (({ className, ...props }, ref) => (
> <MenubarPrimitive.Trigger

    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-3 py-1 text-sm font-medium outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      className,
    )}
    {...props}

/>
));
MenubarTrigger.displayName = MenubarPrimitive.Trigger.displayName;

const MenubarSubTrigger = React.forwardRef<
React.ElementRef<typeof MenubarPrimitive.SubTrigger>,
React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubTrigger> & {
inset?: boolean;
}

> (({ className, inset, children, ...props }, ref) => (
> <MenubarPrimitive.SubTrigger

    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}

>

    {children}
    <ChevronRight className="ml-auto h-4 w-4" />

</MenubarPrimitive.SubTrigger>
));
MenubarSubTrigger.displayName = MenubarPrimitive.SubTrigger.displayName;

const MenubarSubContent = React.forwardRef<
React.ElementRef<typeof MenubarPrimitive.SubContent>,
React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>

> (({ className, ...props }, ref) => (
> <MenubarPrimitive.SubContent

    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-menubar-content-transform-origin]",
      className,
    )}
    {...props}

/>
));
MenubarSubContent.displayName = MenubarPrimitive.SubContent.displayName;

const MenubarContent = React.forwardRef<
React.ElementRef<typeof MenubarPrimitive.Content>,
React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Content>

> (
> (

    { className, align = "start", alignOffset = -4, sideOffset = 8, ...props },
    ref,

) => (
<MenubarPrimitive.Portal>
<MenubarPrimitive.Content
ref={ref}
align={align}
alignOffset={alignOffset}
sideOffset={sideOffset}
className={cn(
"z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-menubar-content-transform-origin]",
className,
)}
{...props}
/>
</MenubarPrimitive.Portal>
),
);
MenubarContent.displayName = MenubarPrimitive.Content.displayName;

const MenubarItem = React.forwardRef<
React.ElementRef<typeof MenubarPrimitive.Item>,
React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Item> & {
inset?: boolean;
}

> (({ className, inset, ...props }, ref) => (
> <MenubarPrimitive.Item

    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      inset && "pl-8",
      className,
    )}
    {...props}

/>
));
MenubarItem.displayName = MenubarPrimitive.Item.displayName;

const MenubarCheckboxItem = React.forwardRef<
React.ElementRef<typeof MenubarPrimitive.CheckboxItem>,
React.ComponentPropsWithoutRef<typeof MenubarPrimitive.CheckboxItem>

> (({ className, children, checked, ...props }, ref) => (
> <MenubarPrimitive.CheckboxItem

    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    checked={checked}
    {...props}

>

    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}

</MenubarPrimitive.CheckboxItem>
));
MenubarCheckboxItem.displayName = MenubarPrimitive.CheckboxItem.displayName;

const MenubarRadioItem = React.forwardRef<
React.ElementRef<typeof MenubarPrimitive.RadioItem>,
React.ComponentPropsWithoutRef<typeof MenubarPrimitive.RadioItem>

> (({ className, children, ...props }, ref) => (
> <MenubarPrimitive.RadioItem

    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}

>

    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <MenubarPrimitive.ItemIndicator>
        <Circle className="h-4 w-4 fill-current" />
      </MenubarPrimitive.ItemIndicator>
    </span>
    {children}

</MenubarPrimitive.RadioItem>
));
MenubarRadioItem.displayName = MenubarPrimitive.RadioItem.displayName;

const MenubarLabel = React.forwardRef<
React.ElementRef<typeof MenubarPrimitive.Label>,
React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Label> & {
inset?: boolean;
}

> (({ className, inset, ...props }, ref) => (
> <MenubarPrimitive.Label

    ref={ref}
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className,
    )}
    {...props}

/>
));
MenubarLabel.displayName = MenubarPrimitive.Label.displayName;

const MenubarSeparator = React.forwardRef<
React.ElementRef<typeof MenubarPrimitive.Separator>,
React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Separator>

> (({ className, ...props }, ref) => (
> <MenubarPrimitive.Separator

    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}

/>
));
MenubarSeparator.displayName = MenubarPrimitive.Separator.displayName;

const MenubarShortcut = ({
className,
...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
return (
<span
className={cn(
"ml-auto text-xs tracking-widest text-muted-foreground",
className,
)}
{...props}
/>
);
};
MenubarShortcut.displayname = "MenubarShortcut";

export {
Menubar,
MenubarMenu,
MenubarTrigger,
MenubarContent,
MenubarItem,
MenubarSeparator,
MenubarLabel,
MenubarCheckboxItem,
MenubarRadioGroup,
MenubarRadioItem,
MenubarPortal,
MenubarSubContent,
MenubarSubTrigger,
MenubarGroup,
MenubarSub,
MenubarShortcut,
};

================================================================================
FILE: artifacts/housing/src/components/ui/navigation-menu.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { cva } from "class-variance-authority";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const NavigationMenu = React.forwardRef<
React.ElementRef<typeof NavigationMenuPrimitive.Root>,
React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>

> (({ className, children, ...props }, ref) => (
> <NavigationMenuPrimitive.Root

    ref={ref}
    className={cn(
      "relative z-10 flex max-w-max flex-1 items-center justify-center",
      className,
    )}
    {...props}

>

    {children}
    <NavigationMenuViewport />

</NavigationMenuPrimitive.Root>
));
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName;

const NavigationMenuList = React.forwardRef<
React.ElementRef<typeof NavigationMenuPrimitive.List>,
React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>

> (({ className, ...props }, ref) => (
> <NavigationMenuPrimitive.List

    ref={ref}
    className={cn(
      "group flex flex-1 list-none items-center justify-center space-x-1",
      className,
    )}
    {...props}

/>
));
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName;

const NavigationMenuItem = NavigationMenuPrimitive.Item;

const navigationMenuTriggerStyle = cva(
"group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=open]:text-accent-foreground data-[state=open]:bg-accent/50 data-[state=open]:hover:bg-accent data-[state=open]:focus:bg-accent",
);

const NavigationMenuTrigger = React.forwardRef<
React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>

> (({ className, children, ...props }, ref) => (
> <NavigationMenuPrimitive.Trigger

    ref={ref}
    className={cn(navigationMenuTriggerStyle(), "group", className)}
    {...props}

>

    {children}{" "}
    <ChevronDown
      className="relative top-[1px] ml-1 h-3 w-3 transition duration-300 group-data-[state=open]:rotate-180"
      aria-hidden="true"
    />

</NavigationMenuPrimitive.Trigger>
));
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName;

const NavigationMenuContent = React.forwardRef<
React.ElementRef<typeof NavigationMenuPrimitive.Content>,
React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>

> (({ className, ...props }, ref) => (
> <NavigationMenuPrimitive.Content

    ref={ref}
    className={cn(
      "left-0 top-0 w-full data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 md:absolute md:w-auto ",
      className,
    )}
    {...props}

/>
));
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName;

const NavigationMenuLink = NavigationMenuPrimitive.Link;

const NavigationMenuViewport = React.forwardRef<
React.ElementRef<typeof NavigationMenuPrimitive.Viewport>,
React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>

> (({ className, ...props }, ref) => (

  <div className={cn("absolute left-0 top-full flex justify-center")}>
    <NavigationMenuPrimitive.Viewport
      className={cn(
        "origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]",
        className,
      )}
      ref={ref}
      {...props}
    />
  </div>
));
NavigationMenuViewport.displayName =
  NavigationMenuPrimitive.Viewport.displayName;

const NavigationMenuIndicator = React.forwardRef<
React.ElementRef<typeof NavigationMenuPrimitive.Indicator>,
React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Indicator>

> (({ className, ...props }, ref) => (
> <NavigationMenuPrimitive.Indicator

    ref={ref}
    className={cn(
      "top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in",
      className,
    )}
    {...props}

>

    <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />

</NavigationMenuPrimitive.Indicator>
));
NavigationMenuIndicator.displayName =
NavigationMenuPrimitive.Indicator.displayName;

export {
navigationMenuTriggerStyle,
NavigationMenu,
NavigationMenuList,
NavigationMenuItem,
NavigationMenuContent,
NavigationMenuTrigger,
NavigationMenuLink,
NavigationMenuIndicator,
NavigationMenuViewport,
};

================================================================================
FILE: artifacts/housing/src/components/ui/page-states.tsx
================================================================================

import React from "react";
import { AlertCircle, RefreshCw, WifiOff, Database, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// ErrorState — shown when an API call fails
// ─────────────────────────────────────────────────────────────
interface ErrorStateProps {
message?: string;
onRetry?: () => void;
className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
const isNetworkError =
message?.toLowerCase().includes("network") ||
message?.toLowerCase().includes("fetch") ||
message?.toLowerCase().includes("failed to fetch");

return (
<div
className={cn(
"flex flex-col items-center justify-center py-16 text-center gap-4",
className,
)} >
<div className="rounded-full bg-destructive/10 p-4">
{isNetworkError ? (
<WifiOff className="w-8 h-8 text-destructive opacity-80" />
) : (
<AlertCircle className="w-8 h-8 text-destructive opacity-80" />
)}
</div>
<div>
<h3 className="font-semibold text-base mb-1">
{isNetworkError ? "تعذر الاتصال بالسيرفر" : "حدث خطأ غير متوقع"}
</h3>
<p className="text-sm text-muted-foreground max-w-xs">
{message || "تعذر تحميل البيانات. يرجى المحاولة مرة أخرى."}
</p>
</div>
{onRetry && (
<Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
<RefreshCw className="w-4 h-4" />
إعادة المحاولة
</Button>
)}
</div>
);
}

// ─────────────────────────────────────────────────────────────
// EmptyState — shown when query succeeds but returns no data
// ─────────────────────────────────────────────────────────────
interface EmptyStateProps {
title?: string;
description?: string;
icon?: React.ReactNode;
action?: React.ReactNode;
className?: string;
}

export function EmptyState({
title,
description,
icon,
action,
className,
}: EmptyStateProps) {
return (
<div
className={cn(
"flex flex-col items-center justify-center py-16 text-center gap-4",
className,
)} >
<div className="rounded-full bg-muted p-4">
{icon || <FileX className="w-8 h-8 text-muted-foreground opacity-60" />}
</div>
<div>
<h3 className="font-semibold text-base mb-1">
{title || "لا توجد بيانات"}
</h3>
{description && (
<p className="text-sm text-muted-foreground max-w-xs">
{description}
</p>
)}
</div>
{action && <div>{action}</div>}
</div>
);
}

// ─────────────────────────────────────────────────────────────
// TableSkeleton — shown while table data loads
// ─────────────────────────────────────────────────────────────
interface TableSkeletonProps {
rows?: number;
columns?: number;
className?: string;
}

export function TableSkeleton({
rows = 5,
columns = 4,
className,
}: TableSkeletonProps) {
return (
<div className={cn("space-y-3", className)}>
{/_ Header _/}
<div className="flex gap-4 px-4 py-2 bg-muted/40 rounded-lg">
{Array.from({ length: columns }).map((_, i) => (
<Skeleton key={i} className="h-4 flex-1" />
))}
</div>
{/* Rows */}
{Array.from({ length: rows }).map((_, i) => (
<div
          key={i}
          className="flex gap-4 px-4 py-3 border-b border-border/50 last:border-0"
        >
{Array.from({ length: columns }).map((\_, j) => (
<Skeleton
key={j}
className={cn(
"h-4 flex-1",
j === 0 && "w-8 flex-none",
j === columns - 1 && "w-20 flex-none",
)}
/>
))}
</div>
))}
</div>
);
}

// ─────────────────────────────────────────────────────────────
// CardSkeleton — shown while card-based data loads
// ─────────────────────────────────────────────────────────────
interface CardSkeletonProps {
count?: number;
className?: string;
}

export function CardSkeleton({ count = 3, className }: CardSkeletonProps) {
return (
<div
className={cn(
"grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
className,
)} >
{Array.from({ length: count }).map((\_, i) => (
<div key={i} className="rounded-xl border bg-card p-5 space-y-3">
<div className="flex items-center gap-3">
<Skeleton className="w-10 h-10 rounded-full" />
<div className="flex-1 space-y-2">
<Skeleton className="h-4 w-3/4" />
<Skeleton className="h-3 w-1/2" />
</div>
</div>
<Skeleton className="h-3 w-full" />
<Skeleton className="h-3 w-4/5" />
</div>
))}
</div>
);
}

// ─────────────────────────────────────────────────────────────
// InlineLoader — small spinner for inline loading
// ─────────────────────────────────────────────────────────────
export function InlineLoader({ message }: { message?: string }) {
return (
<div className="flex items-center justify-center gap-3 py-8 text-muted-foreground text-sm">
<RefreshCw className="w-4 h-4 animate-spin" />
<span>{message || "جاري التحميل..."}</span>
</div>
);
}

// ─────────────────────────────────────────────────────────────
// DBErrorState — specifically for database connectivity issues
// ─────────────────────────────────────────────────────────────
export function DBErrorState({ onRetry }: { onRetry?: () => void }) {
return (
<div className="flex flex-col items-center justify-center py-16 text-center gap-4">
<div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-4">
<Database className="w-8 h-8 text-amber-600 dark:text-amber-400" />
</div>
<div>
<h3 className="font-semibold text-base mb-1">
تعذر الاتصال بقاعدة البيانات
</h3>
<p className="text-sm text-muted-foreground max-w-xs">
السيرفر يواجه مشكلة مؤقتة. تأكد من أن قاعدة البيانات تعمل بشكل صحيح.
</p>
</div>
{onRetry && (
<Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
<RefreshCw className="w-4 h-4" />
إعادة المحاولة
</Button>
)}
</div>
);
}

================================================================================
FILE: artifacts/housing/src/components/ui/pagination.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { ButtonProps, buttonVariants } from "@/components/ui/button";

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (

  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
);
Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef<
HTMLUListElement,
React.ComponentProps<"ul">

> (({ className, ...props }, ref) => (

  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
));
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef<
HTMLLIElement,
React.ComponentProps<"li">

> (({ className, ...props }, ref) => (

  <li ref={ref} className={cn("", className)} {...props} />
));
PaginationItem.displayName = "PaginationItem";

type PaginationLinkProps = {
isActive?: boolean;
} & Pick<ButtonProps, "size"> &
React.ComponentProps<"a">;

const PaginationLink = ({
className,
isActive,
size = "icon",
...props
}: PaginationLinkProps) => (
<a
aria-current={isActive ? "page" : undefined}
className={cn(
buttonVariants({
variant: isActive ? "outline" : "ghost",
size,
}),
className,
)}
{...props}
/>
);
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({
className,
...props
}: React.ComponentProps<typeof PaginationLink>) => (
<PaginationLink
aria-label="Go to previous page"
size="default"
className={cn("gap-1 pl-2.5", className)}
{...props}

>

    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>

  </PaginationLink>
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({
className,
...props
}: React.ComponentProps<typeof PaginationLink>) => (
<PaginationLink
aria-label="Go to next page"
size="default"
className={cn("gap-1 pr-2.5", className)}
{...props}

>

    <span>Next</span>
    <ChevronRight className="h-4 w-4" />

  </PaginationLink>
);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({
className,
...props
}: React.ComponentProps<"span">) => (
<span
aria-hidden
className={cn("flex h-9 w-9 items-center justify-center", className)}
{...props}

>

    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>

  </span>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
Pagination,
PaginationContent,
PaginationLink,
PaginationItem,
PaginationPrevious,
PaginationNext,
PaginationEllipsis,
};

================================================================================
FILE: artifacts/housing/src/components/ui/PaginationBar.tsx
================================================================================

// @ts-nocheck
import type { PaginationMeta } from '@workspace/api-client-react';

interface PaginationBarProps {
pagination: PaginationMeta;
isFetching?: boolean;
onPageChange: (page: number) => void;
}

export function PaginationBar({ pagination, isFetching, onPageChange }: PaginationBarProps) {
const { page, totalPages, total, limit } = pagination;
const start = (page - 1) _ limit + 1;
const end = Math.min(page _ limit, total);

return (
<div
style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderTop: '1px solid var(--border, #e5e7eb)',
        marginTop: '8px',
        fontSize: '14px',
        color: 'var(--text-secondary, #6b7280)',
      }} >
<span>
{isFetching
? 'Loading...'
: `${start}–${end} of ${total} records`}
</span>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
<button
onClick={() => onPageChange(page - 1)}
disabled={!pagination.hasPrevPage || isFetching}
style={{ padding: '4px 12px', borderRadius: '6px', cursor: 'pointer' }} >
← Prev
</button>
<span style={{ fontWeight: 500, color: 'var(--text-primary, #111)' }}>
{page} / {totalPages}
</span>
<button
onClick={() => onPageChange(page + 1)}
disabled={!pagination.hasNextPage || isFetching}
style={{ padding: '4px 12px', borderRadius: '6px', cursor: 'pointer' }} >
Next →
</button>
</div>
</div>
);
}

================================================================================
FILE: artifacts/housing/src/components/ui/permission-gate.tsx
================================================================================

// @ts-nocheck
import type { ReactNode } from "react";
import { usePermission } from "@/hooks/use-permission";
import type { Module, Action } from "@/lib/permissions";

interface PermissionGateProps {
module: Module;
action: Action;
/\*_ Fallback to render if permission is denied. Defaults to null. _/
fallback?: ReactNode;
children: ReactNode;
}

/\*\*

- Renders `children` only when the current user has `module.action` permission.
- Use `fallback` to show a disabled state or nothing.
-
- @example
- <PermissionGate module="users" action="create">
- <Button>Add User</Button>
- </PermissionGate>
   */
  export function PermissionGate({
    module,
    action,
    fallback = null,
    children,
  }: PermissionGateProps) {
    const { can } = usePermission();
    if (!can(module, action)) return <>{fallback}</>;
    return <>{children}</>;
  }

================================================================================
FILE: artifacts/housing/src/components/ui/popover.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
React.ElementRef<typeof PopoverPrimitive.Content>,
React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>

> (({ className, align = "center", sideOffset = 4, ...props }, ref) => (
> <PopoverPrimitive.Portal>

    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]",
        className,
      )}
      {...props}
    />

</PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };

================================================================================
FILE: artifacts/housing/src/components/ui/progress.tsx
================================================================================

// @ts-nocheck
"use client";

import _ as React from "react";
import _ as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
React.ElementRef<typeof ProgressPrimitive.Root>,
React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>

> (({ className, value, ...props }, ref) => (
> <ProgressPrimitive.Root

    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
      className,
    )}
    {...props}

>

    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />

</ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };

================================================================================
FILE: artifacts/housing/src/components/ui/radio-group.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
React.ElementRef<typeof RadioGroupPrimitive.Root>,
React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>

> (({ className, ...props }, ref) => {
> return (

    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />

);
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
React.ElementRef<typeof RadioGroupPrimitive.Item>,
React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>

> (({ className, ...props }, ref) => {
> return (

    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-3.5 w-3.5 fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>

);
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };

================================================================================
FILE: artifacts/housing/src/components/ui/resizable.tsx
================================================================================

// @ts-nocheck
"use client";

import { GripVertical } from "lucide-react";
import \* as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

const ResizablePanelGroup = ({
className,
...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
<ResizablePrimitive.PanelGroup
className={cn(
"flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
className,
)}
{...props}
/>
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
withHandle,
className,
...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
withHandle?: boolean;
}) => (
<ResizablePrimitive.PanelResizeHandle
className={cn(
"relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
className,
)}
{...props}

>

    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}

</ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };

================================================================================
FILE: artifacts/housing/src/components/ui/scroll-area.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
React.ElementRef<typeof ScrollAreaPrimitive.Root>,
React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>

> (({ className, children, ...props }, ref) => (
> <ScrollAreaPrimitive.Root

    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}

>

    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />

</ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>

> (({ className, orientation = "vertical", ...props }, ref) => (
> <ScrollAreaPrimitive.ScrollAreaScrollbar

    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className,
    )}
    {...props}

>

    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />

</ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };

================================================================================
FILE: artifacts/housing/src/components/ui/select.tsx
================================================================================

// @ts-nocheck
"use client";

import _ as React from "react";
import _ as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
React.ElementRef<typeof SelectPrimitive.Trigger>,
React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>

> (({ className, children, ...props }, ref) => (
> <SelectPrimitive.Trigger

    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className,
    )}
    {...props}

>

    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>

</SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>

> (({ className, ...props }, ref) => (
> <SelectPrimitive.ScrollUpButton

    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className,
    )}
    {...props}

>

    <ChevronUp className="h-4 w-4" />

</SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>

> (({ className, ...props }, ref) => (
> <SelectPrimitive.ScrollDownButton

    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className,
    )}
    {...props}

>

    <ChevronDown className="h-4 w-4" />

</SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName =
SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
React.ElementRef<typeof SelectPrimitive.Content>,
React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>

> (({ className, children, position = "popper", ...props }, ref) => (
> <SelectPrimitive.Portal>

    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-[var(--radix-select-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>

</SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
React.ElementRef<typeof SelectPrimitive.Label>,
React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>

> (({ className, ...props }, ref) => (
> <SelectPrimitive.Label

    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}

/>
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
React.ElementRef<typeof SelectPrimitive.Item>,
React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>

> (({ className, children, ...props }, ref) => (
> <SelectPrimitive.Item

    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}

>

    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>

</SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
React.ElementRef<typeof SelectPrimitive.Separator>,
React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>

> (({ className, ...props }, ref) => (
> <SelectPrimitive.Separator

    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}

/>
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
Select,
SelectGroup,
SelectValue,
SelectTrigger,
SelectContent,
SelectLabel,
SelectItem,
SelectSeparator,
SelectScrollUpButton,
SelectScrollDownButton,
};

================================================================================
FILE: artifacts/housing/src/components/ui/separator.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

const Separator = React.forwardRef<
React.ElementRef<typeof SeparatorPrimitive.Root>,
React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>

> (
> (

    { className, orientation = "horizontal", decorative = true, ...props },
    ref,

) => (
<SeparatorPrimitive.Root
ref={ref}
decorative={decorative}
orientation={orientation}
className={cn(
"shrink-0 bg-border",
orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
className,
)}
{...props}
/>
),
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };

================================================================================
FILE: artifacts/housing/src/components/ui/sheet.tsx
================================================================================

// @ts-nocheck
"use client";

import _ as React from "react";
import _ as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
React.ElementRef<typeof SheetPrimitive.Overlay>,
React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>

> (({ className, ...props }, ref) => (
> <SheetPrimitive.Overlay

    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}

/>
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
"fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
{
variants: {
side: {
top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
bottom:
"inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
right:
"inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
},
},
defaultVariants: {
side: "right",
},
},
);

interface SheetContentProps
extends
React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
React.ElementRef<typeof SheetPrimitive.Content>,
SheetContentProps

> (({ side = "right", className, children, ...props }, ref) => (
> <SheetPortal>

    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
      {children}
    </SheetPrimitive.Content>

  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({
className,
...props
}: React.HTMLAttributes<HTMLDivElement>) => (

  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({
className,
...props
}: React.HTMLAttributes<HTMLDivElement>) => (

  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
React.ElementRef<typeof SheetPrimitive.Title>,
React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>

> (({ className, ...props }, ref) => (
> <SheetPrimitive.Title

    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}

/>
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
React.ElementRef<typeof SheetPrimitive.Description>,
React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>

> (({ className, ...props }, ref) => (
> <SheetPrimitive.Description

    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}

/>
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
Sheet,
SheetPortal,
SheetOverlay,
SheetTrigger,
SheetClose,
SheetContent,
SheetHeader,
SheetFooter,
SheetTitle,
SheetDescription,
};

================================================================================
FILE: artifacts/housing/src/components/ui/sidebar.tsx
================================================================================

// @ts-nocheck
"use client";

import \* as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, VariantProps } from "class-variance-authority";
import { PanelLeftIcon } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
Sheet,
SheetContent,
SheetDescription,
SheetHeader,
SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
Tooltip,
TooltipContent,
TooltipProvider,
TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 _ 60 _ 24 \* 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextProps = {
state: "expanded" | "collapsed";
open: boolean;
setOpen: (open: boolean) => void;
openMobile: boolean;
setOpenMobile: (open: boolean) => void;
isMobile: boolean;
toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
const context = React.useContext(SidebarContext);
if (!context) {
throw new Error("useSidebar must be used within a SidebarProvider.");
}

return context;
}

function SidebarProvider({
defaultOpen = true,
open: openProp,
onOpenChange: setOpenProp,
className,
style,
children,
...props
}: React.ComponentProps<"div"> & {
defaultOpen?: boolean;
open?: boolean;
onOpenChange?: (open: boolean) => void;
}) {
const isMobile = useIsMobile();
const [openMobile, setOpenMobile] = React.useState(false);

// This is the internal state of the sidebar.
// We use openProp and setOpenProp for control from outside the component.
const [_open, _setOpen] = React.useState(defaultOpen);
const open = openProp ?? \_open;
const setOpen = React.useCallback(
(value: boolean | ((value: boolean) => boolean)) => {
const openState = typeof value === "function" ? value(open) : value;
if (setOpenProp) {
setOpenProp(openState);
} else {
\_setOpen(openState);
}

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open],

);

// Helper to toggle the sidebar.
const toggleSidebar = React.useCallback(() => {
return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
}, [isMobile, setOpen, setOpenMobile]);

// Adds a keyboard shortcut to toggle the sidebar.
React.useEffect(() => {
const handleKeyDown = (event: KeyboardEvent) => {
if (
event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
(event.metaKey || event.ctrlKey)
) {
event.preventDefault();
toggleSidebar();
}
};

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);

}, [toggleSidebar]);

// We add a state so that we can do data-state="expanded" or "collapsed".
// This makes it easier to style the sidebar with Tailwind classes.
const state = open ? "expanded" : "collapsed";

const contextValue = React.useMemo<SidebarContextProps>(
() => ({
state,
open,
setOpen,
isMobile,
openMobile,
setOpenMobile,
toggleSidebar,
}),
[state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar],
);

return (
<SidebarContext.Provider value={contextValue}>
<TooltipProvider delayDuration={0}>
<div
data-slot="sidebar-wrapper"
style={
{
"--sidebar-width": SIDEBAR_WIDTH,
"--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
...style,
} as React.CSSProperties
}
className={cn(
"group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
className,
)}
{...props} >
{children}
</div>
</TooltipProvider>
</SidebarContext.Provider>
);
}

function Sidebar({
side = "left",
variant = "sidebar",
collapsible = "offcanvas",
className,
children,
...props
}: React.ComponentProps<"div"> & {
side?: "left" | "right";
variant?: "sidebar" | "floating" | "inset";
collapsible?: "offcanvas" | "icon" | "none";
}) {
const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

if (collapsible === "none") {
return (
<div
data-slot="sidebar"
className={cn(
"bg-sidebar text-sidebar-foreground flex h-full w-[var(--sidebar-width)] flex-col",
className,
)}
{...props} >
{children}
</div>
);
}

if (isMobile) {
return (
<Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
<SheetContent
data-sidebar="sidebar"
data-slot="sidebar"
data-mobile="true"
className="bg-sidebar text-sidebar-foreground w-[var(--sidebar-width)] p-0 [&>button]:hidden"
style={
{
"--sidebar-width": SIDEBAR_WIDTH_MOBILE,
} as React.CSSProperties
}
side={side} >
<SheetHeader className="sr-only">
<SheetTitle>Sidebar</SheetTitle>
<SheetDescription>Displays the mobile sidebar.</SheetDescription>
</SheetHeader>
<div className="flex h-full w-full flex-col">{children}</div>
</SheetContent>
</Sheet>
);
}

return (
<div
className="group peer text-sidebar-foreground hidden md:block"
data-state={state}
data-collapsible={state === "collapsed" ? collapsible : ""}
data-variant={variant}
data-side={side}
data-slot="sidebar" >
{/_ This is what handles the sidebar gap on desktop _/}
<div
data-slot="sidebar-gap"
className={cn(
"relative w-[var(--sidebar-width)] bg-transparent transition-[width] duration-200 ease-linear",
"group-data-[collapsible=offcanvas]:w-0",
"group-data-[side=right]:rotate-180",
variant === "floating" || variant === "inset"
? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+var(--spacing-4))]"
: "group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]",
)}
/>
<div
data-slot="sidebar-container"
className={cn(
"fixed inset-y-0 z-10 hidden h-svh w-[var(--sidebar-width)] transition-[left,right,width] duration-200 ease-linear md:flex",
side === "left"
? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
: "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
// Adjust the padding for floating and inset variants.
variant === "floating" || variant === "inset"
? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+var(--spacing-4)+2px)]"
: "group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)] group-data-[side=left]:border-r group-data-[side=right]:border-l",
className,
)}
{...props} >
<div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
        >
{children}
</div>
</div>
</div>
);
}

function SidebarTrigger({
className,
onClick,
...props
}: React.ComponentProps<typeof Button>) {
const { toggleSidebar } = useSidebar();

return (
<Button
data-sidebar="trigger"
data-slot="sidebar-trigger"
variant="ghost"
size="icon"
className={cn("h-7 w-7", className)}
onClick={(event) => {
onClick?.(event);
toggleSidebar();
}}
{...props} >
<PanelLeftIcon />
<span className="sr-only">Toggle Sidebar</span>
</Button>
);
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
const { toggleSidebar } = useSidebar();

// Note: Tailwind v3.4 doesn't support "in-" selectors. So the rail won't work perfectly.
return (
<button
data-sidebar="rail"
data-slot="sidebar-rail"
aria-label="Toggle Sidebar"
tabIndex={-1}
onClick={toggleSidebar}
title="Toggle Sidebar"
className={cn(
"hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex",
"in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
"[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
"hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
"[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
"[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
className,
)}
{...props}
/>
);
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
return (
<main
data-slot="sidebar-inset"
className={cn(
"bg-background relative flex w-full flex-1 flex-col",
"md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
className,
)}
{...props}
/>
);
}

function SidebarInput({
className,
...props
}: React.ComponentProps<typeof Input>) {
return (
<Input
data-slot="sidebar-input"
data-sidebar="input"
className={cn("bg-background h-8 w-full shadow-none", className)}
{...props}
/>
);
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="sidebar-header"
data-sidebar="header"
className={cn("flex flex-col gap-2 p-2", className)}
{...props}
/>
);
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="sidebar-footer"
data-sidebar="footer"
className={cn("flex flex-col gap-2 p-2", className)}
{...props}
/>
);
}

function SidebarSeparator({
className,
...props
}: React.ComponentProps<typeof Separator>) {
return (
<Separator
data-slot="sidebar-separator"
data-sidebar="separator"
className={cn("bg-sidebar-border mx-2 w-auto", className)}
{...props}
/>
);
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="sidebar-content"
data-sidebar="content"
className={cn(
"flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
className,
)}
{...props}
/>
);
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
return (
<div
data-slot="sidebar-group"
data-sidebar="group"
className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
{...props}
/>
);
}

function SidebarGroupLabel({
className,
asChild = false,
...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
const Comp = asChild ? Slot : "div";

return (
<Comp
data-slot="sidebar-group-label"
data-sidebar="group-label"
className={cn(
"text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
"group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
className,
)}
{...props}
/>
);
}

function SidebarGroupAction({
className,
asChild = false,
...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
const Comp = asChild ? Slot : "button";

return (
<Comp
data-slot="sidebar-group-action"
data-sidebar="group-action"
className={cn(
"text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
// Increases the hit area of the button on mobile.
"after:absolute after:-inset-2 md:after:hidden",
"group-data-[collapsible=icon]:hidden",
className,
)}
{...props}
/>
);
}

function SidebarGroupContent({
className,
...props
}: React.ComponentProps<"div">) {
return (
<div
data-slot="sidebar-group-content"
data-sidebar="group-content"
className={cn("w-full text-sm", className)}
{...props}
/>
);
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
return (
<ul
data-slot="sidebar-menu"
data-sidebar="menu"
className={cn("flex w-full min-w-0 flex-col gap-1", className)}
{...props}
/>
);
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
return (
<li
data-slot="sidebar-menu-item"
data-sidebar="menu-item"
className={cn("group/menu-item relative", className)}
{...props}
/>
);
}

const sidebarMenuButtonVariants = cva(
"peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:w-8! group-data-[collapsible=icon]:h-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
{
variants: {
variant: {
default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
outline:
"bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
},
size: {
default: "h-8 text-sm",
sm: "h-7 text-xs",
lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
},
},
defaultVariants: {
variant: "default",
size: "default",
},
},
);

function SidebarMenuButton({
asChild = false,
isActive = false,
variant = "default",
size = "default",
tooltip,
className,
...props
}: React.ComponentProps<"button"> & {
asChild?: boolean;
isActive?: boolean;
tooltip?: string | React.ComponentProps<typeof TooltipContent>;
} & VariantProps<typeof sidebarMenuButtonVariants>) {
const Comp = asChild ? Slot : "button";
const { isMobile, state } = useSidebar();

const button = (
<Comp
data-slot="sidebar-menu-button"
data-sidebar="menu-button"
data-size={size}
data-active={isActive}
className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
{...props}
/>
);

if (!tooltip) {
return button;
}

if (typeof tooltip === "string") {
tooltip = {
children: tooltip,
};
}

return (
<Tooltip>
<TooltipTrigger asChild>{button}</TooltipTrigger>
<TooltipContent
side="right"
align="center"
hidden={state !== "collapsed" || isMobile}
{...tooltip}
/>
</Tooltip>
);
}

function SidebarMenuAction({
className,
asChild = false,
showOnHover = false,
...props
}: React.ComponentProps<"button"> & {
asChild?: boolean;
showOnHover?: boolean;
}) {
const Comp = asChild ? Slot : "button";

return (
<Comp
data-slot="sidebar-menu-action"
data-sidebar="menu-action"
className={cn(
"text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
// Increases the hit area of the button on mobile.
"after:absolute after:-inset-2 md:after:hidden",
"peer-data-[size=sm]/menu-button:top-1",
"peer-data-[size=default]/menu-button:top-1.5",
"peer-data-[size=lg]/menu-button:top-2.5",
"group-data-[collapsible=icon]:hidden",
showOnHover &&
"peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
className,
)}
{...props}
/>
);
}

function SidebarMenuBadge({
className,
...props
}: React.ComponentProps<"div">) {
return (
<div
data-slot="sidebar-menu-badge"
data-sidebar="menu-badge"
className={cn(
"text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none",
"peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
"peer-data-[size=sm]/menu-button:top-1",
"peer-data-[size=default]/menu-button:top-1.5",
"peer-data-[size=lg]/menu-button:top-2.5",
"group-data-[collapsible=icon]:hidden",
className,
)}
{...props}
/>
);
}

function SidebarMenuSkeleton({
className,
showIcon = false,
...props
}: React.ComponentProps<"div"> & {
showIcon?: boolean;
}) {
// Random width between 50 to 90%.
const width = React.useMemo(() => {
return `${Math.floor(Math.random() * 40) + 50}%`;
}, []);

return (
<div
data-slot="sidebar-menu-skeleton"
data-sidebar="menu-skeleton"
className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
{...props} >
{showIcon && (
<Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
)}
<Skeleton
className="h-4 max-w-[var(--skeleton-width)] flex-1"
data-sidebar="menu-skeleton-text"
style={
{
"--skeleton-width": width,
} as React.CSSProperties
}
/>
</div>
);
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
return (
<ul
data-slot="sidebar-menu-sub"
data-sidebar="menu-sub"
className={cn(
"border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5",
"group-data-[collapsible=icon]:hidden",
className,
)}
{...props}
/>
);
}

function SidebarMenuSubItem({
className,
...props
}: React.ComponentProps<"li">) {
return (
<li
data-slot="sidebar-menu-sub-item"
data-sidebar="menu-sub-item"
className={cn("group/menu-sub-item relative", className)}
{...props}
/>
);
}

function SidebarMenuSubButton({
asChild = false,
size = "md",
isActive = false,
className,
...props
}: React.ComponentProps<"a"> & {
asChild?: boolean;
size?: "sm" | "md";
isActive?: boolean;
}) {
const Comp = asChild ? Slot : "a";

return (
<Comp
data-slot="sidebar-menu-sub-button"
data-sidebar="menu-sub-button"
data-size={size}
data-active={isActive}
className={cn(
"text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline outline-2 outline-transparent outline-offset-2 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
"data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
size === "sm" && "text-xs",
size === "md" && "text-sm",
"group-data-[collapsible=icon]:hidden",
className,
)}
{...props}
/>
);
}

export {
Sidebar,
SidebarContent,
SidebarFooter,
SidebarGroup,
SidebarGroupAction,
SidebarGroupContent,
SidebarGroupLabel,
SidebarHeader,
SidebarInput,
SidebarInset,
SidebarMenu,
SidebarMenuAction,
SidebarMenuBadge,
SidebarMenuButton,
SidebarMenuItem,
SidebarMenuSkeleton,
SidebarMenuSub,
SidebarMenuSubButton,
SidebarMenuSubItem,
SidebarProvider,
SidebarRail,
SidebarSeparator,
SidebarTrigger,
useSidebar,
};

================================================================================
FILE: artifacts/housing/src/components/ui/skeleton.tsx
================================================================================

// @ts-nocheck
import { cn } from "@/lib/utils";

function Skeleton({
className,
...props
}: React.HTMLAttributes<HTMLDivElement>) {
return (
<div
className={cn("animate-pulse rounded-md bg-primary/10", className)}
{...props}
/>
);
}

export { Skeleton };

================================================================================
FILE: artifacts/housing/src/components/ui/SkeletonCard.tsx
================================================================================

export function SkeletonCard({ height = "120px" }: { height?: string }) {
return (
<div
style={{
        height,
        backgroundColor: "var(--bg-secondary, #f3f4f6)",
        borderRadius: "8px",
        animation: "pulse 1.5s infinite",
      }}
/>
);
}

================================================================================
FILE: artifacts/housing/src/components/ui/slider.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
React.ElementRef<typeof SliderPrimitive.Root>,
React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>

> (({ className, ...props }, ref) => (
> <SliderPrimitive.Root

    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className,
    )}
    {...props}

>

    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />

</SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

================================================================================
FILE: artifacts/housing/src/components/ui/sonner.tsx
================================================================================

// @ts-nocheck
"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
const { theme = "system" } = useTheme();

return (
<Sonner
theme={theme as ToasterProps["theme"]}
className="toaster group"
toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
{...props}
/>
);
};

export { Toaster };

================================================================================
FILE: artifacts/housing/src/components/ui/spinner.tsx
================================================================================

// @ts-nocheck
import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
return (
<Loader2Icon
role="status"
aria-label="Loading"
className={cn("size-4 animate-spin", className)}
{...props}
/>
);
}

export { Spinner };

================================================================================
FILE: artifacts/housing/src/components/ui/switch.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
React.ElementRef<typeof SwitchPrimitives.Root>,
React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>

> (({ className, ...props }, ref) => (
> <SwitchPrimitives.Root

    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className,
    )}
    {...props}
    ref={ref}

>

    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
      )}
    />

</SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };

================================================================================
FILE: artifacts/housing/src/components/ui/table.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";

import { cn } from "@/lib/utils";

const Table = React.forwardRef<
HTMLTableElement,
React.HTMLAttributes<HTMLTableElement>

> (({ className, ...props }, ref) => (

  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
HTMLTableSectionElement,
React.HTMLAttributes<HTMLTableSectionElement>

> (({ className, ...props }, ref) => (

  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
HTMLTableSectionElement,
React.HTMLAttributes<HTMLTableSectionElement>

> (({ className, ...props }, ref) => (

  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
HTMLTableSectionElement,
React.HTMLAttributes<HTMLTableSectionElement>

> (({ className, ...props }, ref) => (

  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className,
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
HTMLTableRowElement,
React.HTMLAttributes<HTMLTableRowElement>

> (({ className, ...props }, ref) => (

  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
HTMLTableCellElement,
React.ThHTMLAttributes<HTMLTableCellElement>

> (({ className, ...props }, ref) => (

  <th
    ref={ref}
    className={cn(
      "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
HTMLTableCellElement,
React.TdHTMLAttributes<HTMLTableCellElement>

> (({ className, ...props }, ref) => (

  <td
    ref={ref}
    className={cn(
      "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
HTMLTableCaptionElement,
React.HTMLAttributes<HTMLTableCaptionElement>

> (({ className, ...props }, ref) => (

  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export {
Table,
TableHeader,
TableBody,
TableFooter,
TableHead,
TableRow,
TableCell,
TableCaption,
};

================================================================================
FILE: artifacts/housing/src/components/ui/tabs.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
React.ElementRef<typeof TabsPrimitive.List>,
React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>

> (({ className, ...props }, ref) => (
> <TabsPrimitive.List

    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}

/>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
React.ElementRef<typeof TabsPrimitive.Trigger>,
React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>

> (({ className, ...props }, ref) => (
> <TabsPrimitive.Trigger

    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className,
    )}
    {...props}

/>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
React.ElementRef<typeof TabsPrimitive.Content>,
React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>

> (({ className, ...props }, ref) => (
> <TabsPrimitive.Content

    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}

/>
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };

================================================================================
FILE: artifacts/housing/src/components/ui/textarea.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
HTMLTextAreaElement,
React.ComponentProps<"textarea">

> (({ className, ...props }, ref) => {
> return (

    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />

);
});
Textarea.displayName = "Textarea";

export { Textarea };

================================================================================
FILE: artifacts/housing/src/components/ui/ticket-detail-modal.tsx
================================================================================

// @ts-nocheck
import { useState, useEffect } from "react";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import {
Play,
CheckCircle2,
Clock,
User,
Calendar,
AlertTriangle,
MessageSquare,
Paperclip,
Plus,
RotateCcw,
Handshake,
ChevronDown,
ChevronRight,
X,
Eye,
FileText,
Wrench,
Loader2,
} from "lucide-react";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface TicketDetailModalProps {
open: boolean;
onClose: () => void;
ticket: any;
employees: any[];
ar: boolean;
onStatusChange: (id: number, data: any) => void;
onAssignChange: (id: number, empId: number | null) => void;
onCreateSubTicket?: (parentId: number, data: any) => void;
subTickets?: any[];
loadingSubTickets?: boolean;
}

const STATUS_AR: Record<string, string> = {
open: "مفتوحة",
in_progress: "قيد التنفيذ",
resolved: "محلولة",
closed: "مغلقة",
};
const PRIORITY_AR: Record<string, string> = {
LOW: "منخفضة",
MEDIUM: "متوسطة",
HIGH: "عالية",
URGENT: "عاجلة",
};
const CATEGORY_AR = {
maintenance: "صيانة",
housekeeping: "هاوس كيبنج",
general: "عام",
};

function statusColor(s: string) {
switch ((s || "").toLowerCase()) {
case "open":
return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
case "in_progress":
return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
case "resolved":
return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
case "closed":
return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
default:
return "bg-gray-100 text-gray-600";
}
}

function priorityColor(p: string) {
switch ((p || "").toLowerCase()) {
case "urgent":
return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
case "high":
return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
case "medium":
return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
default:
return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}
}

function formatDuration(startedAt: any, resolvedAt: any, reportedAt: any) {
const start = reportedAt ?? startedAt;
if (!start) return "—";
const startDate = new Date(start);
const endDate = resolvedAt ? new Date(resolvedAt) : new Date();
const totalMins = differenceInMinutes(endDate, startDate);
if (totalMins < 1) return "<1m";
if (totalMins < 60) return `${totalMins}m`;
const hrs = differenceInHours(endDate, startDate);
const mins = totalMins % 60;
return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function timeColor(diff: number) {
if (diff < 21) return "bg-gray-200 text-gray-700";
if (diff < 31) return "bg-blue-100 text-blue-700";
if (diff < 41) return "bg-yellow-100 text-yellow-700";
if (diff < 51) return "bg-orange-100 text-orange-700";
if (diff < 61) return "bg-red-100 text-red-700";
return "bg-gray-800 text-white";
}

export default function TicketDetailModal({
open,
onClose,
ticket,
employees = [],
ar,
onStatusChange,
onAssignChange,
onCreateSubTicket,
subTickets = [],
loadingSubTickets = false,
}: TicketDetailModalProps) {
const [activeTab, setActiveTab] = useState<
"details" | "tasks" | "comments" | "attachments"

> ("details");
> const [commentText, setCommentText] = useState("");
> const [showSubTicketForm, setShowSubTicketForm] = useState(false);
> const [subTicketForm, setSubTicketForm] = useState({

    problemType: "",
    description: "",
    priority: "MEDIUM",

});
const [creatingSub, setCreatingSub] = useState(false);
const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

if (!ticket) return null;

const empMap = Object.fromEntries(
employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]),
);

const reportedDate = ticket.reportedAt
? format(new Date(ticket.reportedAt), "dd MMM yyyy")
: "—";
const reportedTime = ticket.reportedAt
? format(new Date(ticket.reportedAt), "HH:mm")
: "—";
const startedDate = ticket.startedAt
? format(new Date(ticket.startedAt), "dd MMM yyyy")
: null;
const startedTime = ticket.startedAt
? format(new Date(ticket.startedAt), "HH:mm")
: null;
const resolvedDate = ticket.resolvedAt
? format(new Date(ticket.resolvedAt), "dd MMM yyyy")
: null;
const resolvedTime = ticket.resolvedAt
? format(new Date(ticket.resolvedAt), "HH:mm")
: null;

const timeToAssign =
ticket.startedAt && ticket.reportedAt
? formatDuration(ticket.reportedAt, ticket.startedAt, null)
: "—";
const workingTime = ticket.startedAt
? formatDuration(ticket.startedAt, ticket.resolvedAt, null)
: "—";
const totalTime = formatDuration(
ticket.startedAt,
ticket.resolvedAt,
ticket.reportedAt,
);

const status = (ticket.status || "").toLowerCase();
const canStart = status === "open";
const canResolve = status === "in_progress";
const canDone = status === "resolved";
const canReopen = status !== "open" && status !== "closed";

const tabs = [
{ key: "details" as const, label: ar ? "التفاصيل" : "Details", icon: Eye },
{ key: "tasks" as const, label: ar ? "المهام" : "Tasks", icon: Wrench },
{
key: "comments" as const,
label: ar ? "التعليقات" : "Comments",
icon: MessageSquare,
},
{
key: "attachments" as const,
label: ar ? "المرفقات" : "Attachments",
icon: Paperclip,
},
];

return (
<>
<Dialog
open={open}
onOpenChange={(v) => {
if (!v) onClose();
}} >
<DialogContent
className="max-w-4xl max-h-[90vh] overflow-y-auto p-0"
srTitle={ar ? "تفاصيل التذكرة" : "Ticket Details"} >
{/_ Header _/}
<DialogHeader className="px-6 pt-6 pb-4 border-b">
<div className="flex items-center justify-between">
<div className="flex items-center gap-3">
<DialogTitle className="text-xl font-bold">
{ar ? "تذكرة #" : "Ticket #"}
{ticket.id}
</DialogTitle>
<Badge className={`${statusColor(ticket.status)} text-xs`}>
{ar
? (STATUS*AR[ticket.status?.toLowerCase()] ?? ticket.status)
: ticket.status?.replace("*", " ")}
</Badge>
<Badge className={`${priorityColor(ticket.priority)} text-xs`}>
{ar
? (PRIORITY_AR[ticket.priority?.toUpperCase()] ??
PRIORITY_AR[ticket.priority] ??
ticket.priority)
: ticket.priority
? ticket.priority.charAt(0).toUpperCase() +
ticket.priority.slice(1).toLowerCase()
: ticket.priority}
</Badge>
</div>
<Button variant="ghost" size="icon" onClick={onClose}>
<X className="w-4 h-4" />
</Button>
</div>
</DialogHeader>

          {/* Tabs */}
          <div className="px-6 border-b">
            <div className="flex gap-4">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as "details" | "comments" | "activity")}
                  className={`px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === tab.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <tab.icon />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {activeTab === "details" && (
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                    {ar ? "معلومات التذكرة" : "Ticket Information"}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {ar ? "الاسم" : "Name"}
                        </p>
                        <p className="text-sm font-medium">
                          {ticket.problemType || ticket.category}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {ar ? "الوصف" : "Description"}
                        </p>
                        <p className="text-sm">{ticket.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {ar ? "تاريخ الإبلاغ" : "Reported"}
                        </p>
                        <p className="text-sm font-medium">
                          {reportedDate}{" "}
                          <span className="text-muted-foreground">
                            {reportedTime}
                          </span>
                        </p>
                      </div>
                    </div>
                    {startedDate && (
                      <div className="flex items-center gap-3">
                        <Play className="w-4 h-4 text-purple-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {ar ? "بدء التنفيذ" : "Started"}
                          </p>
                          <p className="text-sm font-medium">
                            {startedDate}{" "}
                            <span className="text-muted-foreground">
                              {startedTime}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                    {resolvedDate && (
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {ar ? "تم الحل" : "Resolved"}
                          </p>
                          <p className="text-sm font-medium">
                            {resolvedDate}{" "}
                            <span className="text-muted-foreground">
                              {resolvedTime}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Actions & Time */}
                <div className="space-y-6">
                  {/* Actions */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                      {ar ? "الإجراءات" : "Actions"}
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">
                          {ar ? "تعيين إلى" : "Assign To"}
                        </Label>
                        <Select
                          value={
                            ticket.assignedTo ? String(ticket.assignedTo) : ""
                          }
                          onValueChange={(v) =>
                            onAssignChange(ticket.id, v ? parseInt(v) : null)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs mt-1">
                            <SelectValue
                              placeholder={ar ? "اختر..." : "Select..."}
                            />
                          </SelectTrigger>
                          <SelectContent className="max-h-48 overflow-y-auto">
                            <SelectItem value="unassigned">
                              — {ar ? "غير مسند" : "Unassigned"} —
                            </SelectItem>
                            {employees.map((e) => (
                              <SelectItem key={e.id} value={String(e.id)}>
                                {e.firstName} {e.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canStart && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              onStatusChange(ticket.id, {
                                status: "in_progress",
                                startedAt: new Date().toISOString(),
                              })
                            }
                          >
                            <Play className="w-3 h-3 mr-1" />
                            {ar ? "بدء" : "Start"}
                          </Button>
                        )}
                        {canResolve && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() =>
                              onStatusChange(ticket.id, {
                                status: "resolved",
                                resolvedAt: new Date().toISOString(),
                              })
                            }
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {ar ? "حل" : "Resolve"}
                          </Button>
                        )}
                        {canDone && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() =>
                              onStatusChange(ticket.id, { status: "closed" })
                            }
                          >
                            <Handshake className="w-3 h-3 mr-1" />
                            {ar ? "تم" : "Done"}
                          </Button>
                        )}
                        {canReopen && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                            onClick={() =>
                              onStatusChange(ticket.id, { status: "open" })
                            }
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            {ar ? "إعادة فتح" : "Re-open"}
                          </Button>
                        )}
                        {onCreateSubTicket && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setActiveTab("tasks");
                              setShowSubTicketForm(true);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {ar ? "تذكرة فرعية" : "Sub Ticket"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Time Sheet */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                      {ar ? "الوقت" : "Time Sheet"}
                    </h3>
                    <div className="space-y-2 bg-muted/30 p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                          {ar ? "وقت الإبلاغ" : "Reported"}
                        </span>
                        <span className="text-sm font-medium">
                          {reportedDate} {reportedTime}
                        </span>
                      </div>
                      {startedDate && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            {ar ? "وقت البدء" : "Started"}
                          </span>
                          <span className="text-sm font-medium">
                            {startedDate} {startedTime}
                          </span>
                        </div>
                      )}
                      {resolvedDate && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            {ar ? "وقت الحل" : "Resolved"}
                          </span>
                          <span className="text-sm font-medium">
                            {resolvedDate} {resolvedTime}
                          </span>
                        </div>
                      )}
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            {ar ? "المدة الإجمالية" : "Total Duration"}
                          </span>
                          <span
                            className={`text-sm font-semibold px-2 py-0.5 rounded ${ticket.startedAt || ticket.reportedAt ? timeColor(differenceInMinutes(new Date(), new Date(ticket.startedAt || ticket.reportedAt))) : "bg-gray-200 text-gray-700"}`}
                          >
                            {totalTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tasks" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                    {ar ? "التذاكر الفرعية" : "Sub-Tickets"}
                    {subTickets.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {subTickets.length}
                      </Badge>
                    )}
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setShowSubTicketForm(!showSubTicketForm)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {ar ? "إضافة تذكرة فرعية" : "Add Sub-Ticket"}
                  </Button>
                </div>

                {showSubTicketForm && (
                  <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                    <h4 className="text-sm font-semibold">
                      {ar ? "تذكرة فرعية جديدة" : "New Sub-Ticket"}
                    </h4>
                    <div>
                      <Label className="text-xs">
                        {ar ? "نوع المشكلة" : "Problem Type"}
                      </Label>
                      <Input
                        value={subTicketForm.problemType}
                        onChange={(e) =>
                          setSubTicketForm((f) => ({
                            ...f,
                            problemType: e.target.value,
                          }))
                        }
                        placeholder={ar ? "مثال: سباكة" : "e.g. Plumbing"}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">
                        {ar ? "الوصف" : "Description"}
                      </Label>
                      <Textarea
                        value={subTicketForm.description}
                        onChange={(e) =>
                          setSubTicketForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        placeholder={
                          ar ? "صف المشكلة..." : "Describe the issue..."
                        }
                        rows={2}
                        className="text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">
                        {ar ? "الأولوية" : "Priority"}
                      </Label>
                      <Select
                        value={subTicketForm.priority}
                        onValueChange={(v) =>
                          setSubTicketForm((f) => ({ ...f, priority: v }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">
                            {ar ? "منخفضة" : "Low"}
                          </SelectItem>
                          <SelectItem value="MEDIUM">
                            {ar ? "متوسطة" : "Medium"}
                          </SelectItem>
                          <SelectItem value="HIGH">
                            {ar ? "عالية" : "High"}
                          </SelectItem>
                          <SelectItem value="URGENT">
                            {ar ? "عاجلة" : "Urgent"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setShowSubTicketForm(false)}
                      >
                        {ar ? "إلغاء" : "Cancel"}
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={
                          creatingSub ||
                          !subTicketForm.problemType ||
                          !subTicketForm.description
                        }
                        onClick={() => {
                          setCreatingSub(true);
                          onCreateSubTicket?.(ticket.id, subTicketForm);
                          setTimeout(() => {
                            setCreatingSub(false);
                            setShowSubTicketForm(false);
                            setSubTicketForm({
                              problemType: "",
                              description: "",
                              priority: "MEDIUM",
                            });
                          }, 1000);
                        }}
                      >
                        {creatingSub ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Plus className="w-3 h-3 mr-1" />
                        )}
                        {ar ? "إنشاء" : "Create"}
                      </Button>
                    </div>
                  </div>
                )}

                {loadingSubTickets ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  </div>
                ) : subTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      {ar ? "لا توجد تذاكر فرعية" : "No sub-tickets yet"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {subTickets.map((st) => (
                      <div
                        key={st.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{st.id}
                          </span>
                          <div>
                            <p className="text-sm font-medium">
                              {st.problemType}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {st.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`${statusColor(st.status)} text-[10px]`}
                          >
                            {ar
                              ? (STATUS_AR[st.status?.toLowerCase()] ??
                                st.status)
                              : st.status?.replace("_", " ")}
                          </Badge>
                          <Badge
                            className={`${priorityColor(st.priority)} text-[10px]`}
                          >
                            {ar
                              ? (PRIORITY_AR[st.priority] ?? st.priority)
                              : st.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "comments" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                  {ar ? "التعليقات" : "Comments"}
                </h3>
                <div className="space-y-3">
                  <Textarea
                    placeholder={ar ? "أضف تعليقاً..." : "Add a comment..."}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                  />
                  <Button size="sm" className="h-7 text-xs">
                    <MessageSquare className="w-3 h-3 mr-1" />
                    {ar ? "إرسال" : "Send"}
                  </Button>
                </div>
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {ar ? "لا توجد تعليقات بعد" : "No comments yet"}
                  </p>
                </div>
              </div>
            )}

            {activeTab === "attachments" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                  {ar ? "المرفقات" : "Attachments"}
                </h3>
                {ticket.photoUrl ? (
                  <div className="space-y-3">

                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      {ar ? "لا توجد مرفقات" : "No attachments"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>

);
}

================================================================================
FILE: artifacts/housing/src/components/ui/toast.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
React.ElementRef<typeof ToastPrimitives.Viewport>,
React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>

> (({ className, ...props }, ref) => (
> <ToastPrimitives.Viewport

    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className,
    )}
    {...props}

/>
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
"group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
{
variants: {
variant: {
default: "border bg-background text-foreground",
destructive:
"destructive group border-destructive bg-destructive text-destructive-foreground",
},
},
defaultVariants: {
variant: "default",
},
},
);

const Toast = React.forwardRef<
React.ElementRef<typeof ToastPrimitives.Root>,
React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
VariantProps<typeof toastVariants>

> (({ className, variant, ...props }, ref) => {
> return (

    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />

);
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
React.ElementRef<typeof ToastPrimitives.Action>,
React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>

> (({ className, ...props }, ref) => (
> <ToastPrimitives.Action

    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className,
    )}
    {...props}

/>
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
React.ElementRef<typeof ToastPrimitives.Close>,
React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>

> (({ className, ...props }, ref) => (
> <ToastPrimitives.Close

    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className,
    )}
    toast-close=""
    {...props}

>

    <X className="h-4 w-4" />

</ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
React.ElementRef<typeof ToastPrimitives.Title>,
React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>

> (({ className, ...props }, ref) => (
> <ToastPrimitives.Title

    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}

/>
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
React.ElementRef<typeof ToastPrimitives.Description>,
React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>

> (({ className, ...props }, ref) => (
> <ToastPrimitives.Description

    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}

/>
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
type ToastProps,
type ToastActionElement,
ToastProvider,
ToastViewport,
Toast,
ToastTitle,
ToastDescription,
ToastClose,
ToastAction,
};

================================================================================
FILE: artifacts/housing/src/components/ui/toaster.tsx
================================================================================

// @ts-nocheck
import { useToast } from "@/hooks/use-toast";
import {
Toast,
ToastClose,
ToastDescription,
ToastProvider,
ToastTitle,
ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
const { toasts } = useToast();

return (
<ToastProvider>
{toasts.map(function ({ id, title, description, action, ...props }) {
return (
<Toast key={id} {...props}>
<div className="grid gap-1">
{title && <ToastTitle>{title}</ToastTitle>}
{description && (
<ToastDescription>{description}</ToastDescription>
)}
</div>
{action}
<ToastClose />
</Toast>
);
})}
<ToastViewport />
</ToastProvider>
);
}

================================================================================
FILE: artifacts/housing/src/components/ui/toggle-group.tsx
================================================================================

// @ts-nocheck
"use client";

import _ as React from "react";
import _ as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";

const ToggleGroupContext = React.createContext<
VariantProps<typeof toggleVariants>

> ({
> size: "default",
> variant: "default",
> });

const ToggleGroup = React.forwardRef<
React.ElementRef<typeof ToggleGroupPrimitive.Root>,
React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
VariantProps<typeof toggleVariants>

> (({ className, variant, size, children, ...props }, ref) => (
> <ToggleGroupPrimitive.Root

    ref={ref}
    className={cn("flex items-center justify-center gap-1", className)}
    {...props}

>

    <ToggleGroupContext.Provider value={{ variant, size }}>
      {children}
    </ToggleGroupContext.Provider>

</ToggleGroupPrimitive.Root>
));

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
React.ElementRef<typeof ToggleGroupPrimitive.Item>,
React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
VariantProps<typeof toggleVariants>

> (({ className, children, variant, size, ...props }, ref) => {
> const context = React.useContext(ToggleGroupContext);

return (
<ToggleGroupPrimitive.Item
ref={ref}
className={cn(
toggleVariants({
variant: context.variant || variant,
size: context.size || size,
}),
className,
)}
{...props} >
{children}
</ToggleGroupPrimitive.Item>
);
});

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };

================================================================================
FILE: artifacts/housing/src/components/ui/toggle.tsx
================================================================================

// @ts-nocheck
import _ as React from "react";
import _ as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
"inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
{
variants: {
variant: {
default: "bg-transparent",
outline:
"border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
},
size: {
default: "h-9 px-2 min-w-9",
sm: "h-8 px-1.5 min-w-8",
lg: "h-10 px-2.5 min-w-10",
},
},
defaultVariants: {
variant: "default",
size: "default",
},
},
);

const Toggle = React.forwardRef<
React.ElementRef<typeof TogglePrimitive.Root>,
React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
VariantProps<typeof toggleVariants>

> (({ className, variant, size, ...props }, ref) => (
> <TogglePrimitive.Root

    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}

/>
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };

================================================================================
FILE: artifacts/housing/src/components/ui/tooltip.tsx
================================================================================

// @ts-nocheck
"use client";

import _ as React from "react";
import _ as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
React.ElementRef<typeof TooltipPrimitive.Content>,
React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>

> (({ className, sideOffset = 4, ...props }, ref) => (
> <TooltipPrimitive.Portal>

    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]",
        className,
      )}
      {...props}
    />

</TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

================================================================================
FILE: artifacts/housing/src/hooks/use-lookup-values.ts
================================================================================

// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type LookupValue = {
id: number;
propertyId: number;
category: string;
value: string;
parentValue: string | null;
sortOrder: number;
disabled: boolean;
};

const LOOKUP_CATEGORIES = {
DEPARTMENT: "department",
JOB_TITLE: "job_title",
ROOM_TYPE: "room_type",
NATIONALITY: "nationality",
} as const;

export { LOOKUP_CATEGORIES };

async function fetchLookupValues(
propertyId: number,
category?: string,
): Promise<LookupValue[]> {
const params = new URLSearchParams({ propertyId: String(propertyId) });
if (category) params.append("category", category);
const res = await fetch(`/api/lookup-values?${params}`);
if (!res.ok) throw new Error("Failed to fetch lookup values");
return res.json();
}

async function createLookupValue(data: {
propertyId: number;
category: string;
value: string;
parentValue?: string;
}): Promise<LookupValue> {
const res = await fetch("/api/lookup-values", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(data),
});
if (!res.ok) {
const err = await res.json().catch(() => ({}));
throw new Error(err.error || "Failed to create lookup value");
}
return res.json();
}

async function deleteLookupValue(id: number): Promise<void> {
const res = await fetch(`/api/lookup-values/${id}`, { method: "DELETE" });
if (!res.ok) throw new Error("Failed to delete lookup value");
}

export function getLookupValuesQueryKey(
propertyId: number,
category?: string,
includeDisabled?: boolean,
) {
return ["lookup-values", propertyId, category, includeDisabled];
}

export function useLookupValues(
propertyId: number | undefined,
category?: string,
includeDisabled = false,
) {
return useQuery({
queryKey: getLookupValuesQueryKey(propertyId!, category, includeDisabled),
queryFn: async () => {
const data = await fetchLookupValues(propertyId!, category);
return includeDisabled ? data : data.filter((v) => !v.disabled);
},
enabled: !!propertyId,
});
}

export function useCreateLookupValue(propertyId: number | undefined) {
const queryClient = useQueryClient();
return useMutation({
mutationFn: (data: {
category: string;
value: string;
parentValue?: string;
}) => createLookupValue({ ...data, propertyId: propertyId! }),
onSuccess: (created) => {
queryClient.invalidateQueries({
queryKey: ["lookup-values", propertyId!],
});
},
});
}

export function useDeleteLookupValue(
propertyId: number | undefined,
category?: string,
) {
const queryClient = useQueryClient();
return useMutation({
mutationFn: (id: number) => deleteLookupValue(id),
onSuccess: () => {
queryClient.invalidateQueries({
queryKey: ["lookup-values", propertyId!],
});
},
});
}

================================================================================
FILE: artifacts/housing/src/hooks/use-mobile.tsx
================================================================================

// @ts-nocheck
import \* as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
undefined,
);

React.useEffect(() => {
const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
const onChange = () => {
setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
};
mql.addEventListener("change", onChange);
setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
return () => mql.removeEventListener("change", onChange);
}, []);

return !!isMobile;
}

================================================================================
FILE: artifacts/housing/src/hooks/use-permission.ts
================================================================================

// @ts-nocheck
import { useAuth } from "@/context/AuthContext";
import {
permKey,
ROLE_DEFAULT_PERMISSIONS,
type Module,
type Action,
} from "@/lib/permissions";

const normalize = (value: unknown): string =>
String(value ?? "")
.trim()
.toLowerCase();

// Role hierarchy: child roles inherit all permissions from parent roles
const ROLE_INHERITANCE = {
super_admin: [],
system_admin: [],
admin: [],
manager: ["receptionist"],
hr_admin: [],
portal_admin: [],
security_staff: [],
receptionist: [],
maintenance_staff: [],
};

function resolveInheritedRoles(roles: string[]): string[] {
const resolved = new Set<string>();
const visit = (role: string) => {
if (resolved.has(role)) return;
resolved.add(role);
for (const parent of ROLE_INHERITANCE[role] ?? []) visit(parent);
};
for (const role of roles) visit(normalize(role));
return [...resolved];
}

export function usePermission() {
const { user, isSystemAdmin } = useAuth();

const isAdmin =
isSystemAdmin ||
!!user?.roles?.some((r) =>
["super_admin", "system_admin"].includes(normalize(r)),
);

const effectivePermissions = (): Set<string> => {
if (!user) return new Set();
if (isAdmin) return new Set(["*"]);

    const combined = new Set<string>();
    const resolvedRoles = resolveInheritedRoles(user.roles ?? []);

    const explicit = (user as any).permissions as string[] | undefined;
    if (explicit) {
      for (const permission of explicit) {
        const normalized = normalize(permission);
        if (normalized) combined.add(normalized);
      }
    }

    for (const role of resolvedRoles) {
      const defaults = ROLE_DEFAULT_PERMISSIONS[normalize(role)] ?? [];
      defaults.forEach((p) => combined.add(p));
    }

    return combined;

};

const perms = effectivePermissions();

const can = (module: Module, action: Action): boolean => {
if (!user) return false;
if (isAdmin) return true;
if (perms.has("\*")) return true;
if (perms.has(permKey(module, action))) return true;
if (
module === "reservations" &&
perms.has(permKey("accommodation" as Module, action))
)
return true;
return false;
};

const canAny = (module: Module, actions: Action[]): boolean =>
actions.some((a) => can(module, a));

const canView = (m: Module) => can(m, "view");
const canCreate = (m: Module) => can(m, "create");
const canEdit = (m: Module) => can(m, "edit");
const canDelete = (m: Module) => can(m, "delete");

return {
can,
canAny,
canView,
canCreate,
canEdit,
canDelete,
isAdmin,
perms,
};
}

================================================================================
FILE: artifacts/housing/src/hooks/use-reduced-motion.ts
================================================================================

import { useEffect, useState } from "react";

export function usePrefersReducedMotion() {
const [reduced, setReduced] = useState(false);

useEffect(() => {
const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
setReduced(mq.matches);
const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
mq.addEventListener("change", listener);
return () => mq.removeEventListener("change", listener);
}, []);

return reduced;
}

================================================================================
FILE: artifacts/housing/src/hooks/use-toast.ts
================================================================================

// @ts-nocheck
import \* as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 5000;

type ToasterToast = ToastProps & {
id: string;
title?: React.ReactNode;
description?: React.ReactNode;
action?: ToastActionElement;
};

const actionTypes = {
ADD_TOAST: "ADD_TOAST",
UPDATE_TOAST: "UPDATE_TOAST",
DISMISS_TOAST: "DISMISS_TOAST",
REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
count = (count + 1) % Number.MAX_SAFE_INTEGER;
return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
| {
type: ActionType["ADD_TOAST"];
toast: ToasterToast;
}
| {
type: ActionType["UPDATE_TOAST"];
toast: Partial<ToasterToast>;
}
| {
type: ActionType["DISMISS_TOAST"];
toastId?: ToasterToast["id"];
}
| {
type: ActionType["REMOVE_TOAST"];
toastId?: ToasterToast["id"];
};

interface State {
toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
if (toastTimeouts.has(toastId)) {
return;
}

const timeout = setTimeout(() => {
toastTimeouts.delete(toastId);
dispatch({
type: "REMOVE_TOAST",
toastId: toastId,
});
}, TOAST_REMOVE_DELAY);

toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
switch (action.type) {
case "ADD_TOAST":
return {
...state,
toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
};

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };

}
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
memoryState = reducer(memoryState, action);
listeners.forEach((listener) => {
listener(memoryState);
});
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
const id = genId();

const update = (props: ToasterToast) =>
dispatch({
type: "UPDATE_TOAST",
toast: { ...props, id },
});
const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

dispatch({
type: "ADD_TOAST",
toast: {
...props,
id,
open: true,
onOpenChange: (open) => {
if (!open) dismiss();
},
},
});

return {
id: id,
dismiss,
update,
};
}

function useToast() {
const [state, setState] = React.useState<State>(memoryState);

React.useEffect(() => {
listeners.push(setState);
return () => {
const index = listeners.indexOf(setState);
if (index > -1) {
listeners.splice(index, 1);
}
};
}, [state]);

return {
...state,
toast,
dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
};
}

export { useToast, toast };

================================================================================
FILE: artifacts/housing/src/hooks/use-websocket.ts
================================================================================

// @ts-nocheck
/\*\*

- housing/src/hooks/use-websocket.ts
-
- Features:
- 1.  Handles both "SYNC_DATA" (invalidate all) and "data_updated" (module-specific)
- 2.  Exponential backoff reconnect (3s → 6s → 12s → max 30s)
- 3.  Returns isConnected status
- 4.  One connection per component lifecycle — no leaks
- 5.  Real-time Toast Notifications
      \*/

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useProperty } from "@/context/PropertyContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";

const MODULE_QUERY_KEYS: Record<string, string[]> = {
assignments: ["/api/assignments"],
employees: ["/api/employees"],
rooms: ["/api/rooms"],
maintenance: ["/api/maintenance"],
reservations: ["/api/reservations"],
hostings: ["/api/hostings"],
notifications: ["/api/notifications"],
dashboard: [
"/api/dashboard/stats",
"/api/dashboard/occupancy-by-building",
"/api/dashboard/departure-alerts",
"/api/dashboard/arrival-alerts",
"/api/dashboard/recent-activity",
],
buildings: ["/api/buildings"],
floors: ["/api/floors"],
users: ["/api/users"],
settings: ["/api/settings"],
properties: ["/api/properties"],
};

const DASHBOARD_MODULES = new Set([
"assignments",
"rooms",
"employees",
"maintenance",
"reservations",
"hostings",
]);
const ALL_KEYS = Object.values(MODULE_QUERY_KEYS).flat();

export function useWebSocket(): { isConnected: boolean } {
const queryClient = useQueryClient();
const { user } = useAuth();
const { activePropertyId } = useProperty();
const { toast } = useToast();
const { language } = useLanguage();
const ar = language === "ar";

const wsRef = useRef<WebSocket | null>(null);
const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const attemptsRef = useRef(0);
const unmountingRef = useRef(false);
const [isConnected, setIsConnected] = useState(false);

// Use refs to avoid reconnecting WS when language/toast change
const toastRef = useRef(toast);
const arRef = useRef(ar);

useEffect(() => {
toastRef.current = toast;
arRef.current = ar;
}, [toast, ar]);

const invalidateModule = useCallback(
(module: string) => {
const keys = MODULE_QUERY_KEYS[module] ?? [];
const allKeys = [...keys];
if (DASHBOARD_MODULES.has(module)) {
allKeys.push(...MODULE_QUERY_KEYS.dashboard!);
}

      console.info(`[WS] Invalidating module: ${module}`, { keys: allKeys });

      queryClient.invalidateQueries({
        predicate: (query) => {
          const first = query.queryKey[0];
          if (typeof first !== "string") return false;
          return allKeys.some((k) => first === k || first.startsWith(`${k}/`));
        },
        refetchType: "active",
      });
    },
    [queryClient],

);

const invalidateAll = useCallback(() => {
console.info("[WS] Invalidating ALL queries");
queryClient.invalidateQueries({
predicate: (query) => {
const first = query.queryKey[0];
if (typeof first !== "string") return false;
return ALL_KEYS.some((k) => first === k || first.startsWith(`${k}/`));
},
refetchType: "active",
});
}, [queryClient]);

const connect = useCallback(() => {
const currentUserId = user?.id;
const currentPropertyId = activePropertyId;

    if (!currentUserId || !currentPropertyId) {
      console.info("[WS] Skipping connect — user or propertyId not ready:", {
        userId: currentUserId,
        propertyId: currentPropertyId,
      });
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.info("[WS] Already connected, skipping");
      return;
    }

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const hostname = window.location.hostname;
    const apiPort = Number(import.meta.env.VITE_API_PORT) || 4000;
    const wsUrl = `${proto}://${hostname}:${apiPort}/ws?propertyId=${currentPropertyId}`;
    console.info("[WS] Attempting connection:", wsUrl.replace(/\?.*/, "?***"));

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        attemptsRef.current = 0;
        console.info("[WS] ✅ Connected successfully");
      };

      ws.onmessage = ({ data }) => {
        try {
          const msg = JSON.parse(data as string);
          console.info(
            "[WS] 📩 Message received:",
            msg.type,
            "| module:",
            msg.module,
            "| action:",
            msg.action,
          );

          if (msg.type === "SYNC_DATA") {
            console.info("[WS] 🔄 SYNC_DATA — invalidating all queries");
            invalidateAll();
          } else if (msg.type === "notification" && msg.data) {
            const targetUserId = Number(msg.data.targetUserId);
            const isForCurrentUser = !targetUserId || targetUserId === user?.id;

            if (!isForCurrentUser) {
              console.info("[WS] 🔕 Notification filtered out for another user", {
                targetUserId,
                currentUserId: user?.id,
              });
              return;
            }

            console.info("[WS] 🔔 New Custom Notification Received");
            toastRef.current({
              title: arRef.current ? msg.data.titleAr || msg.data.title : msg.data.title,
              description: arRef.current ? msg.data.messageAr || msg.data.message : msg.data.message,
            });
            invalidateModule("notifications");
          } else if (msg.type === "data_updated" && msg.module) {
            console.info(
              `[WS] 🔔 ${msg.module}/${msg.action} — invalidating module`,
            );
            invalidateModule(msg.module as string);

            // Show toast for specific module events
            if (msg.action === "created") {
              let tTitle = "";
              let tDesc = "";
              if (msg.module === "maintenance") {
                tTitle = arRef.current ? "تذكرة صيانة جديدة" : "New Maintenance Ticket";
                tDesc = arRef.current ? "تم إنشاء تذكرة صيانة جديدة." : "A new maintenance ticket was created.";
              } else if (msg.module === "assignments") {
                tTitle = arRef.current ? "تسكين جديد" : "New Assignment";
                tDesc = arRef.current ? "تم تسكين موظف جديد." : "A new employee assignment was created.";
              } else if (msg.module === "reservations") {
                tTitle = arRef.current ? "حجز جديد" : "New Reservation";
                tDesc = arRef.current ? "تم إضافة حجز جديد." : "A new reservation was added.";
              }
              if (tTitle) {
                toastRef.current({ title: tTitle, description: tDesc });
              }
            } else if (msg.action === "updated") {
              if (msg.module === "maintenance") {
                toastRef.current({
                  title: arRef.current ? "تحديث في تذكرة صيانة" : "Maintenance Ticket Updated",
                  description: arRef.current ? "تم تحديث تذكرة صيانة." : "A maintenance ticket was updated."
                });
              } else if (msg.module === "assignments") {
                toastRef.current({
                  title: arRef.current ? "تحديث التسكين" : "Assignment Updated",
                  description: arRef.current ? "تم تحديث بيانات التسكين." : "An employee assignment was updated."
                });
              }
            }
          }
        } catch (e) {
          console.error("[WS] ❌ Failed to parse message:", e);
        }
      };

      ws.onclose = (ev) => {
        setIsConnected(false);
        wsRef.current = null;
        console.info(`[WS] Connection closed (code: ${ev.code})`);

        if (unmountingRef.current || ev.code === 1008) return;

        attemptsRef.current++;
        const delay = Math.min(3_000 * 2 ** (attemptsRef.current - 1), 30_000);
        console.info(
          `[WS] Will reconnect in ${delay}ms (attempt #${attemptsRef.current})`,
        );
        reconnectRef.current = setTimeout(connect, delay);
      };

      ws.onerror = (err) => {
        console.error("[WS] ❌ WebSocket error:", err);
      };

      const pingId = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 25_000);

      ws.addEventListener("close", () => clearInterval(pingId));
    } catch (err) {
      console.error("[WS] ❌ Failed to create WebSocket:", err);
    }

}, [user?.id, activePropertyId, invalidateModule, invalidateAll]);

useEffect(() => {
unmountingRef.current = false;
attemptsRef.current = 0;
connect();

    return () => {
      unmountingRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close(1000, "Component unmounted");
    };

}, [connect]);

return { isConnected };
}

================================================================================
FILE: artifacts/housing/src/lib/brand-colors.ts
================================================================================

// @ts-nocheck
export function hexToHslComponents(hex: string): string | null {
if (!hex?.startsWith("#") || hex.length < 7) return null;
const r = parseInt(hex.slice(1, 3), 16) / 255;
const g = parseInt(hex.slice(3, 5), 16) / 255;
const b = parseInt(hex.slice(5, 7), 16) / 255;
const max = Math.max(r, g, b),
min = Math.min(r, g, b);
const l = (max + min) / 2;
if (max === min) return `0 0% ${Math.round(l * 100)}%`;
const d = max - min;
const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
let h = 0;
switch (max) {
case r:
h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
break;
case g:
h = ((b - r) / d + 2) / 6;
break;
case b:
h = ((r - g) / d + 4) / 6;
break;
}
return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyBrandColors(
primaryColor?: string | null,
buttonColor?: string | null,
) {
if (primaryColor) {
const h = hexToHslComponents(primaryColor);
if (h) {
document.documentElement.style.setProperty("--sidebar", h);
document.documentElement.style.setProperty(
"--sidebar-border",
h.replace(/(\d+)%$/, (_, n) => `${Math.max(0, parseInt(n) - 4)}%`),
);
}
}
if (buttonColor) {
const h = hexToHslComponents(buttonColor);
if (h) {
document.documentElement.style.setProperty("--primary", h);
document.documentElement.style.setProperty("--sidebar-primary", h);
document.documentElement.style.setProperty("--ring", h);
}
}
}

================================================================================
FILE: artifacts/housing/src/lib/pdf-utils.ts
================================================================================

// @ts-nocheck
/\*_ Shared PDF utility functions for jsPDF exports _/

/\*_ Detect Arabic/RTL characters _/
export const hasArabic = (str: string | null | undefined): boolean =>
/[\u0600-\u06FF\u0750-\u077F]/.test(str ?? "");

/\*\*

- Make text safe for jsPDF Helvetica (which has no Arabic glyph support).
- - Returns string as-is if no Arabic.
- - Extracts any Latin characters from mixed strings.
- - Returns fallback or "[AR]" for all-Arabic strings.
    \*/
    export const pdfTextSafe = (
    str: string | null | undefined,
    fallback?: string,
    ): string => {
    if (!str) return "—";
    if (!hasArabic(str)) return str;
    const latin = str.replace(/[^\x20-\x7E]/g, "").trim();
    if (latin.length >= 2) return latin;
    return fallback ?? "[AR]";
    };

/\*_ Load an image URL and return base64 dataURL with pixel dimensions _/
export const loadImgDataUrl = async (
url: string,
): Promise<{ dataUrl: string; w: number; h: number } | null> => {
try {
const img = new Image();
img.crossOrigin = "anonymous";
await new Promise<void>((resolve, reject) => {
img.onload = () => resolve();
img.onerror = () => reject();
img.src = url;
});
const canvas = document.createElement("canvas");
canvas.width = img.naturalWidth || img.width || 200;
canvas.height = img.naturalHeight || img.height || 80;
canvas.getContext("2d")?.drawImage(img, 0, 0);
return {
dataUrl: canvas.toDataURL("image/png"),
w: canvas.width,
h: canvas.height,
};
} catch {
return null;
}
};

export interface PdfHeaderOptions {
systemLogoUrl?: string | null;
propLogoUrl?: string | null;
title: string;
subtitle?: string;
pageW: number;
}

/\*_ Draw dual-logo header on a jsPDF document. Returns Y position after header. _/
export const drawPdfHeader = async (
doc: any,
opts: PdfHeaderOptions,
): Promise<number> => {
const LOGO_H = 12;
const MARGIN = 14;

let sysImg: { dataUrl: string; w: number; h: number } | null = null;
let propImg: { dataUrl: string; w: number; h: number } | null = null;

if (opts.systemLogoUrl) sysImg = await loadImgDataUrl(opts.systemLogoUrl);
if (opts.propLogoUrl && opts.propLogoUrl !== opts.systemLogoUrl)
propImg = await loadImgDataUrl(opts.propLogoUrl);

if (sysImg) {
const aspect = sysImg.w / (sysImg.h || 1);
const w = LOGO_H _ (isFinite(aspect) ? aspect : 2.5);
doc.addImage(sysImg.dataUrl, "PNG", MARGIN, MARGIN, w, LOGO_H);
}
if (propImg) {
const aspect = propImg.w / (propImg.h || 1);
const w = LOGO_H _ (isFinite(aspect) ? aspect : 2.5);
doc.addImage(
propImg.dataUrl,
"PNG",
opts.pageW - MARGIN - w,
MARGIN,
w,
LOGO_H,
);
}

const textY = MARGIN + LOGO_H + 6;
doc.setFontSize(13);
doc.setFont("helvetica", "bold");
doc.setTextColor(15, 42, 68);
doc.text(opts.title, MARGIN, textY);

if (opts.subtitle) {
doc.setFontSize(8.5);
doc.setFont("helvetica", "normal");
doc.setTextColor(100, 100, 100);
doc.text(opts.subtitle, MARGIN, textY + 5);
}

doc.setTextColor(0, 0, 0);
return textY + 10;
};

/\*_ Generate Housing Letter PDF — used from employee detail, check-in, and transfer _/
export const generateHousingLetterPdf = async (opts: {
isArabic?: boolean;
employee: any;
assignment: any;
room: any;
building: string | null;
floorNum: string | number | null;
propName: string;
propAddress: string;
systemLogoUrl?: string | null;
propLogoUrl?: string | null;
}): Promise<void> => {
const emp = opts.employee;
const assignment = opts.assignment;
const room = opts.room;
const building = opts.building;
const floorNum = opts.floorNum;
const propName = opts.propName;
const propAddress = opts.propAddress;
const today = new Date().toLocaleDateString("en-CA");

const { default: jsPDF } = await import("jspdf");
const doc = new jsPDF("portrait", "mm", "a4");

if (opts.isArabic) {
await generateArabicHousingLetterPdf(doc, opts, today);
return;
}

// ── English PDF (jsPDF + autoTable) ──────────────────────────────────────
const { default: autoTable } = await import("jspdf-autotable");
const pw = 210;
const ph = 297;
const ml = 14;
const bw = pw - ml \* 2;

let y = ml;

if (opts.systemLogoUrl || opts.propLogoUrl) {
const items: { url: string; side: string }[] = [];
if (opts.systemLogoUrl)
items.push({ url: opts.systemLogoUrl, side: "left" });
if (opts.propLogoUrl && opts.propLogoUrl !== opts.systemLogoUrl)
items.push({ url: opts.propLogoUrl, side: "right" });
for (const item of items) {
try {
const img = await loadImgDataUrl(item.url);
if (!img) continue;
const maxH = 10;
const s = Math.min(maxH / (img.h || 1), 30 / (img.w || 1));
doc.addImage(
img.dataUrl,
"PNG",
item.side === "right" ? pw - ml - img.w _ s : ml,
y,
img.w _ s,
img.h _ s,
);
} catch {
/_ skip \*/
}
}
y += 13;
}

doc.setDrawColor(201, 162, 77);
doc.setLineWidth(0.7);
doc.line(ml, y, pw - ml, y);
y += 6;

doc.setFontSize(14);
doc.setTextColor(15, 42, 68);
doc.text("Housing Letter", pw / 2, y, { align: "center" });
y += 6;

if (propName) {
doc.setFontSize(8);
doc.text(
`Property: ${propName}${propAddress ? ` — ${propAddress}` : ""}`,
pw / 2,
y,
{ align: "center" },
);
y += 4;
}

doc.setDrawColor(200);
doc.setLineWidth(0.3);
doc.line(ml, y, pw - ml, y);
y += 4;

const fmtDate = (d: string | Date) =>
d ? new Date(d).toLocaleDateString("en-CA") : "—";

const infoLabels = [
"Employee Name",
"Employee Code",
"National ID",
"Nationality",
"Department",
"Job Title",
"Level",
"Phone",
"Building",
"Floor",
"Room",
"Bed",
"Check-in Date",
"Expected Check-out",
];
const infoValues = [
`${emp.firstName || ""} ${emp.lastName || ""}`,
emp.employeeId || "—",
emp.nationalId || "—",
emp.nationality || "—",
emp.department || "—",
emp.jobTitle || "—",
emp.level || "—",
emp.phone || "—",
building || "—",
floorNum ? `Floor ${floorNum}` : "—",
room?.roomNumber || String(assignment.roomId),
assignment.bedNumber ? String(assignment.bedNumber) : "—",
fmtDate(assignment.checkInDate),
fmtDate(assignment.expectedCheckOutDate),
];

autoTable(doc, {
startY: y,
tableWidth: bw,
margin: { left: ml, right: ml },
head: [["Field", "Value"]],
body: infoLabels.map((lbl, i) => [lbl, infoValues[i]]),
headStyles: {
fillColor: [15, 42, 68],
textColor: 255,
fontSize: 7,
fontStyle: "bold",
},
bodyStyles: { fontSize: 7, cellPadding: 1.2 },
alternateRowStyles: { fillColor: [245, 247, 250] },
columnStyles: {
0: { cellWidth: 48, fontStyle: "bold", textColor: [80, 80, 80] },
1: { cellWidth: bw - 48 },
},
});

y = (doc as any).lastAutoTable.finalY + 5;

doc.setDrawColor(201, 162, 77);
doc.setLineWidth(0.7);
doc.line(ml, y, pw - ml, y);
y += 5;

doc.setFontSize(12);
doc.setTextColor(15, 42, 68);
doc.text("Custody Receipt", pw / 2, y, { align: "center" });
y += 5;

doc.setFontSize(6);
doc.setTextColor(100);
doc.text(
"I acknowledge receipt of the items below in good condition and undertake to return them upon check-out.",
pw / 2,
y,
{ align: "center" },
);
y += 3;

doc.setDrawColor(200);
doc.setLineWidth(0.3);
doc.line(ml, y, pw - ml, y);
y += 3;

const citems: string[][] = [
["Room Keys", "1", ""],
["Key Card", "1", ""],
["Bed", "1", ""],
["Mattress", "1", ""],
["Pillow", "2", ""],
["Wardrobe", "1", ""],
["Desk", "1", ""],
["Chair", "1", ""],
["Curtains", "1", ""],
["Trash Can", "1", ""],
["AC Remote", "1", ""],
];

autoTable(doc, {
startY: y,
tableWidth: bw,
margin: { left: ml, right: ml },
head: [["#", "Item", "Qty", "Condition", "Notes"]],
body: citems.map((item, i) => [
String(i + 1),
item[0],
item[1],
"",
item[2],
]),
headStyles: {
fillColor: [201, 162, 77],
textColor: 255,
fontSize: 7,
fontStyle: "bold",
},
bodyStyles: { fontSize: 6.5, cellPadding: 1 },
columnStyles: {
0: { cellWidth: 10, halign: "center" },
1: { cellWidth: bw - 10 - 16 - 22 - 28 },
2: { cellWidth: 16, halign: "center" },
3: { cellWidth: 22 },
4: { cellWidth: 28 },
},
});

y = (doc as any).lastAutoTable.finalY + 5;

doc.setDrawColor(201, 162, 77);
doc.setLineWidth(0.7);
doc.line(ml, y, pw - ml, y);
y += 5;

doc.setFontSize(8);
doc.setTextColor(80);
doc.text("Signatures", ml, y);
y += 7;

const sc = (bw - 20) / 3;
doc.setFontSize(7);
doc.setTextColor(0);
doc.text("Recipient (Employee):", ml, y);
doc.text("HR Manager:", ml + sc + 10, y);
doc.text("Housing Manager:", ml + sc _ 2 + 20, y);
y += 5;
doc.setTextColor(130);
doc.text("******\_\_\_\_******", ml, y);
doc.text("******\_\_\_\_******", ml + sc + 10, y);
doc.text("******\_\_\_\_******", ml + sc _ 2 + 20, y);
y += 4;
doc.text("Date: **_ / _** / **\_**", ml, y);
doc.text("Date: **_ / _** / **\_**", ml + sc + 10, y);
doc.text("Date: **_ / _** / **\_**", ml + sc \* 2 + 20, y);

doc.setFontSize(6.5);
doc.setTextColor(130);
doc.text(`Print Date: ${today}`, ml, ph - ml);
doc.text(
"Sunrise Staff Housing Management — Confidential",
pw - ml,
ph - ml,
{ align: "right" },
);

outputPdfBlob(doc, `housing-letter-${emp.employeeId || emp.id}_${today}.pdf`);
};

/\*\*

- Arabic housing letter — opens a native browser print dialog.
- This gives PERFECT Arabic text shaping since the browser renders natively.
- The user clicks Print → Save as PDF in the browser dialog.
  \*/
  async function generateArabicHousingLetterPdf(
  \_doc: any,
  opts: any,
  today: string,
  ): Promise<void> {
  const emp = opts.employee;
  const assignment = opts.assignment;
  const room = opts.room;

const sysLogo = opts.systemLogoUrl
? await loadImgDataUrl(opts.systemLogoUrl)
: null;
const propLogo =
opts.propLogoUrl && opts.propLogoUrl !== opts.systemLogoUrl
? await loadImgDataUrl(opts.propLogoUrl)
: null;

const fmtDate = (d: string | Date) =>
d ? new Date(d).toLocaleDateString("ar-EG") : "—";
const floorNum = opts.floorNum;
const bldg = opts.building;
const propName = opts.propName;
const propAddress = opts.propAddress;

const html = `<!DOCTYPE html>

<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title></title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      background: #fff;
      color: #111;
      font-size: 8.5pt;
      line-height: 1.35;
    }
    .page {
      width: 210mm;
      padding: 8mm 12mm;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }
    .header img { max-height: 32px; max-width: 110px; object-fit: contain; }
    .gold { border: none; border-top: 1.5px solid #c9a24d; margin: 3px 0; }
    .gray { border: none; border-top: 0.5px solid #ccc; margin: 2px 0; }
    h1 {
      text-align: center;
      font-size: 13pt;
      font-weight: 700;
      color: #0f2a44;
      margin: 3px 0;
    }
    .sub { text-align: center; font-size: 8pt; color: #555; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 2px 0; font-size: 8pt; }
    th, td { border: 1px solid #ccd; padding: 2.5px 7px; text-align: right; }
    th { background: #0f2a44; color: #fff; font-weight: 700; }
    tr:nth-child(even) td { background: #f4f6f9; }
    .gld th { background: #c9a24d; color: #fff; }
    .ack {
      font-size: 8pt;
      color: #555;
      text-align: center;
      margin: 2px 0;
      padding: 3px 10px;
      background: #f9f9f9;
      border-radius: 3px;
      border: 1px solid #e0e0e0;
    }
    .sig-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin: 4px 0 2px;
    }
    .sig-item {
      flex: 1;
      padding: 5px;
      border: 1px solid #eee;
      border-radius: 4px;
      text-align: center;
    }
    .sig-label { font-weight: 700; font-size: 8.5pt; display: block; margin-bottom: 14px; }
    .sig-line { border-top: 1px solid #555; margin-bottom: 3px; }
    .sig-date { font-size: 7.5pt; color: #666; }
    .foot {
      display: flex;
      justify-content: space-between;
      font-size: 7pt;
      color: #999;
      margin-top: 4px;
      border-top: 1px solid #eee;
      padding-top: 3px;
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 0;  /* removes browser name/date/time headers */
      }
      html, body {
        width: 210mm;
        height: 297mm;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        padding: 7mm 12mm;
      }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${propLogo ? `<img src="${propLogo.dataUrl}" alt="شعار الفرع" />` : "<div></div>"}
      ${sysLogo ? `<img src="${sysLogo.dataUrl}" alt="شعار النظام" />` : "<div></div>"}
    </div>
    <hr class="gold" />
    <h1>خطاب سكن</h1>
    ${propName ? `<div class="sub">الفرع: ${propName}${propAddress ? ` — ${propAddress}` : ""}</div>` : ""}
    <hr class="gray" />

    <table>
      <tr><th style="width:160px">البيان</th><th>القيمة</th></tr>
      <tr><td>اسم الموظف</td><td>${emp.firstName || ""} ${emp.lastName || ""}</td></tr>
      <tr><td>كود الموظف</td><td>${emp.employeeId || "—"}</td></tr>
      <tr><td>رقم الهوية</td><td>${emp.nationalId || "—"}</td></tr>
      <tr><td>الجنسية</td><td>${emp.nationality || "—"}</td></tr>
      <tr><td>القسم</td><td>${emp.department || "—"}</td></tr>
      <tr><td>المسمى الوظيفي</td><td>${emp.jobTitle || "—"}</td></tr>
      <tr><td>الدرجة</td><td>${emp.level || "—"}</td></tr>
      <tr><td>الهاتف</td><td>${emp.phone || "—"}</td></tr>
      <tr><td>المبنى</td><td>${bldg || "—"}</td></tr>
      <tr><td>الدور</td><td>${floorNum ? `طابق ${floorNum}` : "—"}</td></tr>
      <tr><td>الغرفة</td><td>${room?.roomNumber || String(assignment.roomId)}</td></tr>
      <tr><td>السرير</td><td>${assignment.bedNumber ? String(assignment.bedNumber) : "—"}</td></tr>
      <tr><td>تاريخ الدخول</td><td>${fmtDate(assignment.checkInDate)}</td></tr>
      <tr><td>تاريخ المغادرة المتوقع</td><td>${fmtDate(assignment.expectedCheckOutDate)}</td></tr>
    </table>

    <hr class="gold" />
    <h1 style="font-size:15pt; margin:6px 0">إيصال استلام العهد</h1>
    <p class="ack">أقر باستلام العهد أدناه بحالة جيدة وأتعهد بإعادتها عند انتهاء الإقامة.</p>
    <hr class="gray" />

    <table>
      <tr class="gld">
        <th style="width:32px">#</th>
        <th>الصنف</th>
        <th style="width:46px">العدد</th>
        <th style="width:65px">الحالة</th>
        <th style="width:80px">ملاحظات</th>
      </tr>
      <tr><td style="text-align:center">1</td><td>مفاتيح الغرفة</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">2</td><td>كارت الدخول</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">3</td><td>السرير</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">4</td><td>المرتبة</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">5</td><td>الوسادة</td><td style="text-align:center">2</td><td></td><td></td></tr>
      <tr><td style="text-align:center">6</td><td>خزانة ملابس</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">7</td><td>المكتب</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">8</td><td>الكرسي</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">9</td><td>الستائر</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">10</td><td>سلة مهملات</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">11</td><td>ريموت مكيف</td><td style="text-align:center">1</td><td></td><td></td></tr>
    </table>

    <hr class="gold" />
    <div style="margin-top:6px">
      <p style="font-weight:700; font-size:11pt; margin-bottom:8px">التوقيعات</p>
      <div class="sig-row">
        <div class="sig-item">
          <span class="sig-label">المستلم (الموظف)</span>
          <div class="sig-line"></div>
          <span class="sig-date">التاريخ: ___ / ___ / _____</span>
        </div>
        <div class="sig-item">
          <span class="sig-label">مدير الموارد البشرية</span>
          <div class="sig-line"></div>
          <span class="sig-date">التاريخ: ___ / ___ / _____</span>
        </div>
        <div class="sig-item">
          <span class="sig-label">مدير السكن</span>
          <div class="sig-line"></div>
          <span class="sig-date">التاريخ: ___ / ___ / _____</span>
        </div>
      </div>
    </div>

    <div class="foot">
      <span>تاريخ الطباعة: ${today}</span>
      <span>Sunrise Staff Housing Management — Confidential</span>
    </div>

  </div>

  <script>
    // Auto-trigger print after fonts load
    document.fonts.ready.then(function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

// Open a new window with the fully rendered HTML — browser handles Arabic perfectly
const printWindow = window.open("", "_blank", "width=900,height=700");
if (!printWindow) {
// Popup blocked — fallback: download as .html
const blob = new Blob([html], { type: "text/html;charset=utf-8" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = `housing-letter-${emp.employeeId || emp.id}_${today}.html`;
a.click();
return;
}
printWindow.document.open();
printWindow.document.write(html);
printWindow.document.close();
}

/\*_ Try to output a PDF blob, open in new window (falls back to download) _/
function outputPdfBlob(doc: any, filename: string): void {
if (typeof doc.output !== "function") {
const a = document.createElement("a");
a.href = "#";
a.download = filename;
a.click();
return;
}
try {
const b = doc.output("blob");
if (!b || typeof b !== "object") throw new Error("no blob");
const u = URL.createObjectURL(b);
const w = window.open(u, "\_blank");
if (!w) {
const a = document.createElement("a");
a.href = u;
a.download = filename;
a.click();
}
} catch {
try {
const u2 = doc.output("datauristring");
const a = document.createElement("a");
a.href = u2;
a.download = filename;
a.click();
} catch {
/_ give up _/
}
}
}

/\*_ Draw standard PDF footer _/
export const drawPdfFooter = (doc: any, pageW: number, y?: number): void => {
const footY = y ?? doc.internal.pageSize.getHeight() - 10;
doc.setFontSize(8);
doc.setFont("helvetica", "normal");
doc.setTextColor(150, 150, 150);
doc.text(
"Sunrise Staff Housing Management · Confidential",
pageW / 2,
footY,
{ align: "center" },
);
doc.setTextColor(0, 0, 0);
};

================================================================================
FILE: artifacts/housing/src/lib/permissions.test.ts
================================================================================

import { describe, expect, it } from "vitest";
import { getPermissionsForRoles } from "./permissions";

describe("getPermissionsForRoles", () => {
it("returns the default permissions for a single role", () => {
const perms = getPermissionsForRoles(["manager"]);

    expect(perms).toContain("users.manage_permissions");
    expect(perms).toContain("dashboard.view");
    expect(perms).toContain("maintenance.approve");

});

it("merges the defaults from multiple roles", () => {
const perms = getPermissionsForRoles(["receptionist", "maintenance_staff"]);

    expect(perms).toContain("communications.create");
    expect(perms).toContain("maintenance.assign");
    expect(perms).toContain("documents.view");

});
});

================================================================================
FILE: artifacts/housing/src/lib/permissions.ts
================================================================================

// @ts-nocheck

export const MODULES = [
"dashboard",
"housing",
"employees",
"accommodation",
"reservations",
"maintenance",
"reports",
"users",
"settings",
"activity_log",
"properties",
"documents",
"billing",
"communications",
"evaluations",
"surveys",
"portal_content",
"activities",
"smart_locks",
"hosting_requests",
] as const;

export type Module = (typeof MODULES)[number];

export type Action =
| "view"
| "create"
| "edit"
| "delete"
| "export"
| "bulk_delete"
| "bulk_export"
| "assign"
| "checkin"
| "checkout"
| "approve"
| "transfer"
| "reset_password"
| "manage_permissions"
| "view_sensitive"
| "audit"
| "publish"
| "archive"
| "unlock";

export const ACTIONS: Action[] = [
"view",
"create",
"edit",
"delete",
"export",
"bulk_delete",
"bulk_export",
"assign",
"checkin",
"checkout",
"approve",
"transfer",
"reset_password",
"manage_permissions",
"view_sensitive",
"audit",
"publish",
"archive",
"unlock",
];

export const MODULE_ACTIONS: Record<Module, Action[]> = {
dashboard: ["view", "export"],
housing: ["view", "create", "edit", "delete", "export", "bulk_export"],
employees: [
"view",
"create",
"edit",
"delete",
"export",
"reset_password",
"manage_permissions",
"view_sensitive",
],
accommodation: [
"view",
"create",
"edit",
"assign",
"checkin",
"checkout",
"approve",
"transfer",
"bulk_delete",
"bulk_export",
"archive",
],
reservations: [
"view",
"create",
"edit",
"checkin",
"checkout",
"approve",
"bulk_export",
"archive",
],
maintenance: [
"view",
"create",
"edit",
"assign",
"approve",
"bulk_export",
"archive",
],
reports: ["view", "export", "audit"],
users: [
"view",
"create",
"edit",
"delete",
"manage_permissions",
"reset_password",
"unlock",
],
settings: ["view", "edit", "create", "delete"],
activity_log: ["view", "export", "audit"],
properties: ["view", "create", "edit", "delete"],
documents: ["view", "create", "edit", "delete", "publish", "archive"],
billing: ["view", "export"],
communications: ["view", "create"],
evaluations: ["view", "create", "edit", "delete", "export"],
surveys: ["view", "create", "edit", "delete"],
portal_content: ["view", "create", "edit", "delete"],
activities: ["view", "create", "edit", "delete", "publish"],
smart_locks: ["view", "create", "edit", "delete"],
hosting_requests: ["view", "create", "edit", "delete", "approve"],
};

export const moduleActions = (module: Module): Action[] =>
MODULE_ACTIONS[module] ?? [];

export const permKey = (module: Module, action: Action) =>
`${module}.${action}`;

export const getPermissionsForRoles = (roles: Array<string | undefined | null>): string[] => {
const normalized = (roles ?? [])
.map((role) => String(role ?? "").trim().toLowerCase())
.filter(Boolean);

const merged = new Set<string>();
for (const role of normalized) {
for (const permission of ROLE_DEFAULT_PERMISSIONS[role] ?? []) {
merged.add(permission);
}
}

return Array.from(merged);
};

export const allModulePerms = (module: Module): string[] =>
(MODULE_ACTIONS[module] ?? []).map((action) => permKey(module, action));

const crudPerms = (module: Module): string[] =>
(["view", "create", "edit", "delete"] as Action[])
.filter((action) => (MODULE_ACTIONS[module] ?? []).includes(action))
.map((action) => permKey(module, action));

const readExportPerms = (module: Module): string[] =>
(["view", "export"] as Action[])
.filter((action) => (MODULE_ACTIONS[module] ?? []).includes(action))
.map((action) => permKey(module, action));

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
super_admin: MODULES.flatMap((module) => allModulePerms(module)),
system_admin: MODULES.flatMap((module) => allModulePerms(module)),
admin: MODULES.filter((module) => module !== "properties").flatMap((module) =>
allModulePerms(module),
),
manager: [
// Dashboard
"dashboard.view",
"dashboard.export",
// Housing
...crudPerms("housing"),
"housing.bulk_export",
// Employees
...crudPerms("employees"),
"employees.export",
// Accommodation
...crudPerms("accommodation"),
"accommodation.assign",
"accommodation.checkin",
"accommodation.checkout",
"accommodation.approve",
"accommodation.transfer",
"accommodation.bulk_delete",
"accommodation.bulk_export",
"accommodation.archive",
// Reservations
...crudPerms("reservations"),
"reservations.checkin",
"reservations.checkout",
"reservations.bulk_export",
"reservations.archive",
// Hosting Requests
...crudPerms("hosting_requests"),
// Maintenance
...crudPerms("maintenance"),
"maintenance.assign",
"maintenance.approve",
"maintenance.bulk_export",
"maintenance.archive",
// Reports
...readExportPerms("reports"),
"reports.audit",
// Users
"users.view",
"users.edit",
"users.manage_permissions",
"users.unlock",
// Settings
"settings.view",
"settings.edit",
// Activity Log
"activity_log.view",
"activity_log.export",
"activity_log.audit",
// Documents
...crudPerms("documents"),
"documents.publish",
"documents.archive",
// Billing
"billing.view",
"billing.export",
// Communications
"communications.view",
"communications.create",
],
receptionist: [
"dashboard.view",
"housing.view",
"housing.export",
"employees.view",
"accommodation.view",
"accommodation.create",
"accommodation.edit",
"accommodation.assign",
"accommodation.checkin",
"accommodation.checkout",
"accommodation.approve",
"reservations.view",
"reservations.create",
"reservations.edit",
"reservations.checkin",
"reservations.checkout",
"reservations.approve",
"hosting_requests.view",
"hosting_requests.create",
"maintenance.view",
"maintenance.create",
"maintenance.edit",
"reports.view",
"reports.export",
"activity_log.view",
"documents.view",
"communications.view",
"communications.create",
],
maintenance_staff: [
"dashboard.view",
"housing.view",
"maintenance.view",
"maintenance.create",
"maintenance.edit",
"maintenance.assign",
"maintenance.approve",
"employees.view",
"activity_log.view",
"documents.view",
],
hr_admin: [
"dashboard.view",
"dashboard.export",
...crudPerms("employees"),
"employees.export",
...crudPerms("evaluations"),
"evaluations.export",
...crudPerms("surveys"),
...crudPerms("activities"),
"activities.publish",
...crudPerms("documents"),
...crudPerms("portal_content"),
...crudPerms("communications"),
"reports.view",
"reports.export",
...crudPerms("hosting_requests"),
],
portal_admin: [
"dashboard.view",
...crudPerms("activities"),
"activities.publish",
...crudPerms("documents"),
...crudPerms("portal_content"),
...crudPerms("communications"),
"reports.view",
],
security_staff: [
"dashboard.view",
"housing.view",
"accommodation.view",
...crudPerms("smart_locks"),
"activities.view",
],
};

export const MODULE_LABELS: Record<Module, { en: string; ar: string }> = {
dashboard: { en: "Dashboard", ar: "لوحة القيادة" },
housing: { en: "Housing", ar: "الإسكان" },
employees: { en: "Employees", ar: "الموظفين" },
accommodation: { en: "Accommodation", ar: "الإقامة" },
reservations: { en: "Reservations", ar: "الحجوزات" },
maintenance: { en: "Tickets", ar: "التذاكر" },
reports: { en: "Reports", ar: "التقارير" },
users: { en: "Users", ar: "المستخدمين" },
settings: { en: "Settings", ar: "الإعدادات" },
activity_log: { en: "Activity Log", ar: "سجل النشاط" },
properties: { en: "Properties", ar: "الفروع" },
documents: { en: "Documents", ar: "المستندات" },
billing: { en: "Billing", ar: "الفواتير" },
communications: { en: "Communications", ar: "الاتصالات" },
evaluations: { en: "Evaluations", ar: "التقييمات" },
surveys: { en: "Surveys", ar: "الاستبيانات" },
portal_content: { en: "Portal Content", ar: "محتوى البوابة" },
activities: { en: "Activities", ar: "الأنشطة" },
smart_locks: { en: "Smart Locks", ar: "الأقفال الذكية" },
hosting_requests: { en: "Hosting Requests", ar: "طلبات الاستضافة" },
};

export const ACTION_LABELS: Record<Action, { en: string; ar: string }> = {
view: { en: "View", ar: "عرض" },
create: { en: "Create", ar: "إضافة" },
edit: { en: "Edit", ar: "تعديل" },
delete: { en: "Delete", ar: "حذف" },
export: { en: "Export", ar: "تصدير" },
bulk_delete: { en: "Bulk Delete", ar: "حذف جماعي" },
bulk_export: { en: "Bulk Export", ar: "تصدير جماعي" },
assign: { en: "Assign", ar: "تعيين" },
checkin: { en: "Check-in", ar: "تسجيل وصول" },
checkout: { en: "Check-out", ar: "تسجيل مغادرة" },
approve: { en: "Approve", ar: "موافقة" },
transfer: { en: "Transfer", ar: "نقل" },
reset_password: { en: "Reset Password", ar: "إعادة كلمة المرور" },
manage_permissions: { en: "Manage Permissions", ar: "إدارة الصلاحيات" },
view_sensitive: { en: "View Sensitive", ar: "عرض بيانات حساسة" },
audit: { en: "Audit", ar: "تدقيق" },
publish: { en: "Publish", ar: "نشر" },
archive: { en: "Archive", ar: "أرشفة" },
unlock: { en: "Unlock", ar: "فتح القفل" },
};

================================================================================
FILE: artifacts/housing/src/lib/PrintLanguageDialog.tsx
================================================================================

import { useState, useCallback, useRef } from "react";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function PrintLanguageDialog({
open,
onSelect,
onCancel,
}: {
open: boolean;
onSelect: (isArabic: boolean) => void;
onCancel: () => void;
}) {
return (

<Dialog
open={open}
onOpenChange={(o) => {
if (!o) onCancel();
}} >
<DialogContent
        className="max-w-xs"
        srTitle="Choose language / اختر اللغة"
      >
<DialogHeader>
<DialogTitle className="text-base">
Choose Language / اختر اللغة
</DialogTitle>
</DialogHeader>
<p className="text-sm text-muted-foreground mb-3">
Choose the PDF language / اختر لغة التقرير
</p>
<div className="flex gap-3 justify-end">
<Button variant="outline" onClick={() => onSelect(false)}>
English
</Button>
<Button onClick={() => onSelect(true)}>العربية</Button>
</div>
</DialogContent>
</Dialog>
);
}

export function usePrintLanguage() {
const [open, setOpen] = useState(false);
const resolveRef = useRef<((ar: boolean) => void) | null>(null);

const openDialog = useCallback(() => {
return new Promise<boolean>((resolve) => {
resolveRef.current = resolve;
setOpen(true);
});
}, []);

const handleSelect = useCallback((isArabic: boolean) => {
resolveRef.current?.(isArabic);
resolveRef.current = null;
setOpen(false);
}, []);

const handleCancel = useCallback(() => {
resolveRef.current?.(false);
resolveRef.current = null;
setOpen(false);
}, []);

return { langDialogOpen: open, openDialog, handleSelect, handleCancel };
}

================================================================================
FILE: artifacts/housing/src/lib/utils.ts
================================================================================

// @ts-nocheck
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
return twMerge(clsx(inputs));
}

================================================================================
FILE: lib/api-client-react/src/custom-fetch.ts
================================================================================

export type CustomFetchOptions = RequestInit & {
responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;

export type BodyType<T> = T;

export type AuthTokenGetter = () => Promise<string | null> | string | null;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

// ---------------------------------------------------------------------------
// Module-level configuration
// ---------------------------------------------------------------------------

let \_baseUrl: string | null = null;
let \_authTokenGetter: AuthTokenGetter | null = null;

/\*\*

- Set a base URL that is prepended to every relative request URL
- (i.e. paths that start with `/`).
-
- Useful for Expo bundles that need to call a remote API server.
- Pass `null` to clear the base URL.
  \*/
  export function setBaseUrl(url: string | null): void {
  \_baseUrl = url ? url.replace(/\/+$/, "") : null;
  }

/\*\*

- Register a getter that supplies a bearer auth token. Before every fetch
- the getter is invoked; when it returns a non-null string, an
- `Authorization: Bearer <token>` header is attached to the request.
-
- Useful for Expo bundles making token-gated API calls.
- Pass `null` to clear the getter.
-
- NOTE: This function should never be used in web applications where session
- token cookies are automatically associated with API calls by the browser.
  \*/
  export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  \_authTokenGetter = getter;
  }

function isRequest(input: RequestInfo | URL): input is Request {
return typeof Request !== "undefined" && input instanceof Request;
}

function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
if (explicitMethod) return explicitMethod.toUpperCase();
if (isRequest(input)) return input.method.toUpperCase();
return "GET";
}

// Use loose check for URL — some runtimes (e.g. React Native) polyfill URL
// differently, so `instanceof URL` can fail.
function isUrl(input: RequestInfo | URL): input is URL {
return typeof URL !== "undefined" && input instanceof URL;
}

function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
if (!\_baseUrl) return input;
const url = resolveUrl(input);
// Only prepend to relative paths (starting with /)
if (!url.startsWith("/")) return input;

const absolute = `${_baseUrl}${url}`;
if (typeof input === "string") return absolute;
if (isUrl(input)) return new URL(absolute);
return new Request(absolute, input as Request);
}

function resolveUrl(input: RequestInfo | URL): string {
if (typeof input === "string") return input;
if (isUrl(input)) return input.toString();
return input.url;
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
const headers = new Headers();

for (const source of sources) {
if (!source) continue;
new Headers(source).forEach((value, key) => {
headers.set(key, value);
});
}

return headers;
}

function getMediaType(headers: Headers): string | null {
const value = headers.get("content-type");
return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}

function isJsonMediaType(mediaType: string | null): boolean {
return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

function isTextMediaType(mediaType: string | null): boolean {
return Boolean(
mediaType &&
(mediaType.startsWith("text/") ||
mediaType === "application/xml" ||
mediaType === "text/xml" ||
mediaType.endsWith("+xml") ||
mediaType === "application/x-www-form-urlencoded"),
);
}

// Use strict equality: in browsers, `response.body` is `null` when the
// response genuinely has no content. In React Native, `response.body` is
// always `undefined` because the ReadableStream API is not implemented —
// even when the response carries a full payload readable via `.text()` or
// `.json()`. Loose equality (`== null`) matches both `null` and `undefined`,
// which causes every React Native response to be treated as empty.
function hasNoBody(response: Response, method: string): boolean {
if (method === "HEAD") return true;
if (NO_BODY_STATUS.has(response.status)) return true;
if (response.headers.get("content-length") === "0") return true;
if (response.body === null) return true;
return false;
}

function stripBom(text: string): string {
return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function looksLikeJson(text: string): boolean {
const trimmed = text.trimStart();
return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function getStringField(value: unknown, key: string): string | undefined {
if (!value || typeof value !== "object") return undefined;

const candidate = (value as Record<string, unknown>)[key];
if (typeof candidate !== "string") return undefined;

const trimmed = candidate.trim();
return trimmed === "" ? undefined : trimmed;
}

function truncate(text: string, maxLength = 300): string {
return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildErrorMessage(response: Response, data: unknown): string {
const prefix = `HTTP ${response.status} ${response.statusText}`;

if (typeof data === "string") {
const text = data.trim();
return text ? `${prefix}: ${truncate(text)}` : prefix;
}

const title = getStringField(data, "title");
const detail = getStringField(data, "detail");
const message =
getStringField(data, "message") ??
getStringField(data, "error_description") ??
getStringField(data, "error");

if (title && detail) return `${prefix}: ${title} — ${detail}`;
if (detail) return `${prefix}: ${detail}`;
if (message) return `${prefix}: ${message}`;
if (title) return `${prefix}: ${title}`;

return prefix;
}

export class ApiError<T = unknown> extends Error {
readonly name = "ApiError";
readonly status: number;
readonly statusText: string;
readonly data: T | null;
readonly headers: Headers;
readonly response: Response;
readonly method: string;
readonly url: string;

constructor(
response: Response,
data: T | null,
requestInfo: { method: string; url: string },
) {
super(buildErrorMessage(response, data));
Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;

}
}

export class ResponseParseError extends Error {
readonly name = "ResponseParseError";
readonly status: number;
readonly statusText: string;
readonly headers: Headers;
readonly response: Response;
readonly method: string;
readonly url: string;
readonly rawBody: string;
readonly cause: unknown;

constructor(
response: Response,
rawBody: string,
cause: unknown,
requestInfo: { method: string; url: string },
) {
super(
`Failed to parse response from ${requestInfo.method} ${response.url || requestInfo.url} ` +
`(${response.status} ${response.statusText}) as JSON`,
);
Object.setPrototypeOf(this, new.target.prototype);

    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
    this.rawBody = rawBody;
    this.cause = cause;

}
}

async function parseJsonBody(
response: Response,
requestInfo: { method: string; url: string },
): Promise<unknown> {
const raw = await response.text();
const normalized = stripBom(raw);

if (normalized.trim() === "") {
return null;
}

try {
return JSON.parse(normalized);
} catch (cause) {
throw new ResponseParseError(response, raw, cause, requestInfo);
}
}

async function parseErrorBody(response: Response, method: string): Promise<unknown> {
if (hasNoBody(response, method)) {
return null;
}

const mediaType = getMediaType(response.headers);

// Fall back to text when blob() is unavailable (e.g. some React Native builds).
if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
return typeof response.blob === "function" ? response.blob() : response.text();
}

const raw = await response.text();
const normalized = stripBom(raw);
const trimmed = normalized.trim();

if (trimmed === "") {
return null;
}

if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
try {
return JSON.parse(normalized);
} catch {
return raw;
}
}

return raw;
}

function inferResponseType(response: Response): "json" | "text" | "blob" {
const mediaType = getMediaType(response.headers);

if (isJsonMediaType(mediaType)) return "json";
if (isTextMediaType(mediaType) || mediaType == null) return "text";
return "blob";
}

async function parseSuccessBody(
response: Response,
responseType: "json" | "text" | "blob" | "auto",
requestInfo: { method: string; url: string },
): Promise<unknown> {
if (hasNoBody(response, requestInfo.method)) {
return null;
}

const effectiveType =
responseType === "auto" ? inferResponseType(response) : responseType;

switch (effectiveType) {
case "json":
return parseJsonBody(response, requestInfo);

    case "text": {
      const text = await response.text();
      return text === "" ? null : text;
    }

    case "blob":
      if (typeof response.blob !== "function") {
        throw new TypeError(
          "Blob responses are not supported in this runtime. " +
            "Use responseType \"json\" or \"text\" instead.",
        );
      }
      return response.blob();

}
}

export async function customFetch<T = unknown>(
input: RequestInfo | URL,
options: CustomFetchOptions = {},
): Promise<T> {
input = applyBaseUrl(input);
const { responseType = "auto", headers: headersInit, ...init } = options;

const method = resolveMethod(input, init.method);

if (init.body != null && (method === "GET" || method === "HEAD")) {
throw new TypeError(`customFetch: ${method} requests cannot have a body.`);
}

const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);

if (
typeof init.body === "string" &&
!headers.has("content-type") &&
looksLikeJson(init.body)
) {
headers.set("content-type", "application/json");
}

if (responseType === "json" && !headers.has("accept")) {
headers.set("accept", DEFAULT_JSON_ACCEPT);
}

// Attach bearer token when an auth getter is configured and no
// Authorization header has been explicitly provided.
if (\_authTokenGetter && !headers.has("authorization")) {
const token = await \_authTokenGetter();
if (token) {
headers.set("authorization", `Bearer ${token}`);
}
}

const requestInfo = { method, url: resolveUrl(input) };

// Set up AbortController with 30s timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30_000);
const signal = init.signal || controller.signal;

try {
const response = await fetch(input, { ...init, method, headers, signal });
clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await parseErrorBody(response, method);
      throw new ApiError(response, errorData, requestInfo);
    }

    return (await parseSuccessBody(response, responseType, requestInfo)) as T;

} catch (error: any) {
clearTimeout(timeoutId);
if (error.name === "AbortError" && !init.signal) {
throw new Error(`Request timed out after 30 seconds. Server may be unreachable: ${requestInfo.method} ${requestInfo.url}`);
}
throw error;
}
}

================================================================================
FILE: lib/api-client-react/src/index.ts
================================================================================

export _ from "./generated/api";
export _ from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
export \* from "./hooks/smart-lock";

export \* from "./hooks/portal";

export \* from "./pagination.types";

================================================================================
FILE: lib/api-client-react/src/pagination.types.ts
================================================================================

export interface PaginationMeta {
page: number;
limit: number;
total: number;
totalPages: number;
hasNextPage: boolean;
hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
data: T[];
pagination: PaginationMeta;
}

export interface PaginationParams {
page?: number;
limit?: number;
search?: string;
status?: string;
buildingId?: number;
departmentId?: number;
}

================================================================================
FILE: lib/api-client-react/src/generated/api.schemas.ts
================================================================================

/\*\*

- Generated by orval v8.12.3 🍺
- Do not edit manually.
- Api
- Sunrise Staff Housing Management System API
- OpenAPI spec version: 0.1.0
  \*/
  export interface HealthStatus {
  status: string;
  }

export interface ErrorResponse {
error: string;
}

export interface MessageResponse {
message: string;
}

export interface LoginBody {
username: string;
password: string;
/\*_ @nullable _/
propertyCode?: string | null;
}

export interface User {
id: number;
propertyId: number;
username: string;
roles: string[];
permissions: string[];
status: string;
}

export interface LoginResponse {
user: User;
token: string;
}

export interface ChangePasswordBody {
currentPassword: string;
newPassword: string;
}

export interface Property {
id: number;
name: string;
code: string;
/** @nullable \*/
displayName?: string | null;
/** @nullable \*/
logo?: string | null;
primaryColor: string;
defaultLanguage: string;
status: string;
createdAt: string;
}

export interface CreatePropertyBody {
name: string;
code: string;
/** @nullable \*/
displayName?: string | null;
/** @nullable \*/
logo?: string | null;
primaryColor: string;
defaultLanguage: string;
adminUsername: string;
adminPassword: string;
}

export interface UpdatePropertyBody {
name?: string;
/** @nullable \*/
displayName?: string | null;
/** @nullable \*/
logo?: string | null;
primaryColor?: string;
defaultLanguage?: string;
status?: string;
}

export interface Building {
id: number;
propertyId: number;
name: string;
location: string;
capacity: number;
status: string;
}

export interface CreateBuildingBody {
propertyId: number;
name: string;
location: string;
capacity: number;
status?: string;
}

export interface UpdateBuildingBody {
name?: string;
location?: string;
capacity?: number;
status?: string;
}

export interface Floor {
id: number;
propertyId: number;
buildingId: number;
floorNumber: string;
description: string;
}

export interface CreateFloorBody {
propertyId: number;
buildingId: number;
floorNumber: string;
description?: string;
}

export interface UpdateFloorBody {
floorNumber?: string;
description?: string;
}

export interface Room {
id: number;
propertyId: number;
buildingId: number;
floorId: number;
roomNumber: string;
roomType: string;
capacity: number;
currentOccupancy: number;
status: string;
/\*_ @nullable _/
gender?: string | null;
}

export interface CreateRoomBody {
propertyId: number;
buildingId: number;
floorId: number;
roomNumber: string;
roomType: string;
capacity: number;
status?: string;
/\*_ @nullable _/
gender?: string | null;
}

export interface UpdateRoomBody {
roomNumber?: string;
roomType?: string;
capacity?: number;
status?: string;
/\*_ @nullable _/
gender?: string | null;
}

export interface Employee {
id: number;
propertyId: number;
employeeId: string;
firstName: string;
lastName: string;
nationalId: string;
nationality: string;
address: string;
jobTitle: string;
level: string;
phone: string;
department: string;
status: string;
hireDate: string;
gender: string;
/\*_ @nullable _/
idImage?: string | null;
}

export interface CreateEmployeeBody {
propertyId: number;
employeeId: string;
firstName: string;
lastName: string;
nationalId: string;
nationality: string;
address: string;
jobTitle: string;
level: string;
phone: string;
department: string;
status?: string;
hireDate: string;
gender: string;
/\*_ @nullable _/
idImage?: string | null;
}

export interface UpdateEmployeeBody {
firstName?: string;
lastName?: string;
nationalId?: string;
nationality?: string;
address?: string;
jobTitle?: string;
level?: string;
phone?: string;
department?: string;
status?: string;
gender?: string;
/\*_ @nullable _/
idImage?: string | null;
}

export interface Assignment {
id: number;
propertyId: number;
employeeId: number;
roomId: number;
/** @nullable \*/
bedNumber?: number | null;
checkInDate: string;
/** @nullable _/
expectedCheckOutDate?: string | null;
/\*\* @nullable _/
checkOutDate?: string | null;
notes: string;
status: string;
createdAt: string;
}

export interface CreateAssignmentBody {
propertyId: number;
employeeId: number;
roomId: number;
/** @nullable \*/
bedNumber?: number | null;
checkInDate: string;
/** @nullable \*/
expectedCheckOutDate?: string | null;
notes?: string;
}

export interface UpdateAssignmentBody {
/\*_ @nullable _/
expectedCheckOutDate?: string | null;
notes?: string;
}

export interface CheckoutBody {
checkOutDate: string;
notes?: string;
}

export interface TransferBody {
newRoomId: number;
newBedNumber?: number;
transferReason?: string;
transferDate: string;
}

export interface Reservation {
id: number;
propertyId: number;
/** @nullable \*/
roomId?: number | null;
/** @nullable _/
roomType?: string | null;
firstName: string;
lastName: string;
checkInDate: string;
/\*\* @nullable _/
checkOutDate?: string | null;
notes: string;
guestIdCardNumber: string;
guestPhone: string;
jobTitle: string;
department: string;
status: string;
createdAt: string;
}

export interface CreateReservationBody {
propertyId: number;
/** @nullable \*/
roomId?: number | null;
/** @nullable _/
roomType?: string | null;
firstName: string;
lastName: string;
checkInDate: string;
/\*\* @nullable _/
checkOutDate?: string | null;
notes?: string;
guestIdCardNumber: string;
guestPhone: string;
jobTitle: string;
department: string;
}

export interface UpdateReservationBody {
/** @nullable \*/
roomId?: number | null;
checkInDate?: string;
/** @nullable \*/
checkOutDate?: string | null;
notes?: string;
status?: string;
}

export interface ReservationCheckinBody {
roomId: number;
actualCheckInDate: string;
}

export type HostingCompanionsItem = {
name: string;
/** @nullable \*/
idNumber?: string | null;
/** @nullable _/
documentType?: string | null;
/\*\* @nullable _/
documentImage?: string | null;
/** @nullable \*/
documentFileName?: string | null;
/** @nullable _/
relation?: string | null;
isChild?: number;
/\*\* @nullable _/
age?: number | null;
};

export interface Hosting {
id: number;
propertyId: number;
employeeId: number;
hostingType: string;
guestsCount: number;
expectedFrom: string;
expectedTo: string;
/** @nullable \*/
actualCheckIn?: string | null;
/** @nullable _/
actualCheckOut?: string | null;
/\*\* @nullable _/
roomId?: number | null;
/\*_ @nullable _/
roomType?: string | null;
status: string;
notes: string;
createdBy: string;
createdAt: string;
companions: HostingCompanionsItem[];
}

export type CreateHostingBodyCompanionsItem = {
name: string;
/** @nullable \*/
idNumber?: string | null;
/** @nullable _/
documentType?: string | null;
/\*\* @nullable _/
documentImage?: string | null;
/** @nullable \*/
documentFileName?: string | null;
/** @nullable _/
relation?: string | null;
isChild?: number;
/\*\* @nullable _/
age?: number | null;
};

export interface CreateHostingBody {
propertyId: number;
employeeId: number;
hostingType: string;
guestsCount: number;
expectedFrom: string;
expectedTo: string;
/** @nullable \*/
roomId?: number | null;
/** @nullable \*/
roomType?: string | null;
notes?: string;
createdBy: string;
companions?: CreateHostingBodyCompanionsItem[];
}

export interface UpdateHostingBody {
expectedFrom?: string;
expectedTo?: string;
/\*_ @nullable _/
roomId?: number | null;
notes?: string;
status?: string;
}

export interface HostingCheckinBody {
actualCheckIn: string;
/\*_ @nullable _/
roomId?: number | null;
}

export interface MaintenanceRequest {
id: number;
propertyId: number;
roomId: number;
problemType: string;
description: string;
status: string;
priority: string;
reportedAt: string;
/\*_ @nullable _/
dueDate?: string | null;
}

export interface CreateMaintenanceBody {
propertyId: number;
roomId: number;
problemType: string;
description: string;
priority: string;
/\*_ @nullable _/
dueDate?: string | null;
}

export interface UpdateMaintenanceBody {
status?: string;
priority?: string;
description?: string;
/\*_ @nullable _/
dueDate?: string | null;
}

export interface CreateUserBody {
propertyId: number;
propertyIds?: number[];
username: string;
password: string;
roles: string[];
permissions?: string[];
status?: string;
/** @nullable \*/
jobTitle?: string | null;
/** @nullable _/
email?: string | null;
/\*\* @nullable _/
phone?: string | null;
}

export interface UpdateUserBody {
username?: string;
/** @nullable \*/
email?: string | null;
/** @nullable _/
phone?: string | null;
roles?: string[];
permissions?: string[];
status?: string;
/\*\* @nullable _/
password?: string | null;
/\*_ @nullable _/
jobTitle?: string | null;
propertyIds?: number[];
propertyId?: number;
}

export interface ActivityLog {
id: number;
propertyId: number;
username: string;
/** @nullable \*/
userId?: number | null;
/** @nullable _/
userRole?: string | null;
action: string;
actionType: string;
module: string;
severity: string;
timestamp: string;
/\*\* @nullable _/
entityType?: string | null;
/\*_ @nullable _/
entityId?: number | null;
}

export interface AppSettings {
id: number;
propertyId: number;
systemName: string;
/\*_ @nullable _/
systemLogo?: string | null;
defaultLanguage: string;
primaryColor: string;
sidebarColor: string;
buttonColor: string;
departureAlertsEnabled: boolean;
departureAlertThreshold: number;
reportFooter: string;
}

export interface UpdateSettingsBody {
propertyId?: number;
systemName?: string;
/\*_ @nullable _/
systemLogo?: string | null;
defaultLanguage?: string;
primaryColor?: string;
sidebarColor?: string;
buttonColor?: string;
departureAlertsEnabled?: boolean;
departureAlertThreshold?: number;
reportFooter?: string;
}

export interface DashboardStats {
totalEmployees: number;
activeEmployees: number;
unhousedEmployees: number;
totalRooms: number;
occupiedRooms: number;
availableRooms: number;
occupancyRate: number;
totalBuildings: number;
openMaintenance: number;
overdueMaintenance: number;
upcomingReservations: number;
totalReservations: number;
}

export interface DepartureAlert {
assignmentId: number;
employeeId: number;
employeeName: string;
roomId: number;
roomNumber: string;
buildingName: string;
expectedCheckOutDate: string;
daysRemaining: number;
alertStatus: string;
}

export interface ArrivalAlert {
reservationId: number;
guestName: string;
/** @nullable \*/
roomId?: number | null;
/** @nullable \*/
roomNumber?: string | null;
checkInDate: string;
daysUntilArrival: number;
alertStatus: string;
}

export interface OccupancyByBuilding {
buildingId: number;
buildingName: string;
totalCapacity: number;
currentOccupancy: number;
occupancyRate: number;
}

export type ListBuildingsParams = {
propertyId?: number;
};

export type ListFloorsParams = {
buildingId?: number;
propertyId?: number;
};

export type ListRoomsParams = {
propertyId?: number;
buildingId?: number;
floorId?: number;
status?: string;
};

export type ListEmployeesParams = {
propertyId?: number;
status?: string;
department?: string;
search?: string;
};

export type ListAssignmentsParams = {
propertyId?: number;
status?: string;
employeeId?: number;
roomId?: number;
};

export type ListReservationsParams = {
propertyId?: number;
status?: string;
};

export type ListHostingsParams = {
propertyId?: number;
status?: string;
};

export type ListMaintenanceParams = {
propertyId?: number;
status?: string;
priority?: string;
};

export type ListUsersParams = {
propertyId?: number;
};

export type ListActivityLogsParams = {
propertyId?: number;
module?: string;
userId?: number;
limit?: number;
};

export type GetSettingsParams = {
propertyId?: number;
};

export type GetDashboardStatsParams = {
propertyId?: number;
};

export type GetDepartureAlertsParams = {
propertyId?: number;
threshold?: number;
};

export type GetArrivalAlertsParams = {
propertyId?: number;
threshold?: number;
};

export type GetOccupancyByBuildingParams = {
propertyId?: number;
};

export type GetRecentActivityParams = {
propertyId?: number;
limit?: number;
};

================================================================================
FILE: lib/api-client-react/src/generated/api.ts
================================================================================

/\*\*

- Generated by orval v8.12.3 🍺
- Do not edit manually.
- Api
- Sunrise Staff Housing Management System API
- OpenAPI spec version: 0.1.0
  \*/
  import {
  useMutation,
  useQuery
  } from '@tanstack/react-query';
  import type {
  MutationFunction,
  QueryFunction,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult
  } from '@tanstack/react-query';

import type {
ActivityLog,
AppSettings,
ArrivalAlert,
Assignment,
Building,
ChangePasswordBody,
CheckoutBody,
CreateAssignmentBody,
CreateBuildingBody,
CreateEmployeeBody,
CreateFloorBody,
CreateHostingBody,
CreateMaintenanceBody,
CreatePropertyBody,
CreateReservationBody,
CreateRoomBody,
CreateUserBody,
DashboardStats,
DepartureAlert,
Employee,
ErrorResponse,
Floor,
GetArrivalAlertsParams,
GetDashboardStatsParams,
GetDepartureAlertsParams,
GetOccupancyByBuildingParams,
GetRecentActivityParams,
GetSettingsParams,
HealthStatus,
Hosting,
HostingCheckinBody,
ListActivityLogsParams,
ListAssignmentsParams,
ListBuildingsParams,
ListEmployeesParams,
ListFloorsParams,
ListHostingsParams,
ListMaintenanceParams,
ListReservationsParams,
ListRoomsParams,
ListUsersParams,
LoginBody,
LoginResponse,
MaintenanceRequest,
MessageResponse,
OccupancyByBuilding,
Property,
Reservation,
ReservationCheckinBody,
Room,
TransferBody,
UpdateAssignmentBody,
UpdateBuildingBody,
UpdateEmployeeBody,
UpdateFloorBody,
UpdateHostingBody,
UpdateMaintenanceBody,
UpdatePropertyBody,
UpdateReservationBody,
UpdateRoomBody,
UpdateSettingsBody,
UpdateUserBody,
User
} from './api.schemas';

import { customFetch } from '../custom-fetch';
import type { ErrorType , BodyType } from '../custom-fetch';

type AwaitedInput<T> = PromiseLike<T> | T;

      type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;

type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];

export const getHealthCheckUrl = () => {

return `/api/healthz`
}

/\*\*

- @summary Health check
  \*/
  export const healthCheck = async ( options?: RequestInit): Promise<HealthStatus> => {

return customFetch<HealthStatus>(getHealthCheckUrl(),
{
...options,
method: 'GET'

}
);}

export const getHealthCheckQueryKey = () => {
return [
`/api/healthz`
] as const;
}

export const getHealthCheckQueryOptions = <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getHealthCheckQueryKey();

    const queryFn: QueryFunction<Awaited<ReturnType<typeof healthCheck>>> = ({ signal }) => healthCheck({ signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & { queryKey: QueryKey }
}

export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>
export type HealthCheckQueryError = ErrorType<unknown>

/\*\*

- @summary Health check
  \*/

export function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(
options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getHealthCheckQueryOptions(options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getLoginUrl = () => {

return `/api/auth/login`
}

/\*\*

- @summary Login
  \*/
  export const login = async (loginBody: LoginBody, options?: RequestInit): Promise<LoginResponse> => {

return customFetch<LoginResponse>(getLoginUrl(),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(loginBody)
}
);}

export const getLoginMutationOptions = <TError = ErrorType<ErrorResponse>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof login>>, TError,{data: BodyType<LoginBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof login>>, TError,{data: BodyType<LoginBody>}, TContext> => {

const mutationKey = ['login'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof login>>, {data: BodyType<LoginBody>}> = (props) => {
          const {data} = props ?? {};

          return  login(data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type LoginMutationResult = NonNullable<Awaited<ReturnType<typeof login>>>
    export type LoginMutationBody = BodyType<LoginBody>
    export type LoginMutationError = ErrorType<ErrorResponse>

    /**

- @summary Login
  \*/
  export const useLogin = <TError = ErrorType<ErrorResponse>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof login>>, TError,{data: BodyType<LoginBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof login>>,
  TError,
  {data: BodyType<LoginBody>},
  TContext > => {
  return useMutation(getLoginMutationOptions(options));
  }

export const getLogoutUrl = () => {

return `/api/auth/logout`
}

/\*\*

- @summary Logout
  \*/
  export const logout = async ( options?: RequestInit): Promise<MessageResponse> => {

return customFetch<MessageResponse>(getLogoutUrl(),
{
...options,
method: 'POST'

}
);}

export const getLogoutMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError,void, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError,void, TContext> => {

const mutationKey = ['logout'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof logout>>, void> = () => {


          return  logout(requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type LogoutMutationResult = NonNullable<Awaited<ReturnType<typeof logout>>>

    export type LogoutMutationError = ErrorType<unknown>

    /**

- @summary Logout
  \*/
  export const useLogout = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError,void, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof logout>>,
  TError,
  void,
  TContext > => {
  return useMutation(getLogoutMutationOptions(options));
  }

export const getGetMeUrl = () => {

return `/api/auth/me`
}

/\*\*

- @summary Get current user
  \*/
  export const getMe = async ( options?: RequestInit): Promise<User> => {

return customFetch<User>(getGetMeUrl(),
{
...options,
method: 'GET'

}
);}

export const getGetMeQueryKey = () => {
return [
`/api/auth/me`
] as const;
}

export const getGetMeQueryOptions = <TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<ErrorResponse>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetMeQueryKey();

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getMe>>> = ({ signal }) => getMe({ signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData> & { queryKey: QueryKey }
}

export type GetMeQueryResult = NonNullable<Awaited<ReturnType<typeof getMe>>>
export type GetMeQueryError = ErrorType<ErrorResponse>

/\*\*

- @summary Get current user
  \*/

export function useGetMe<TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<ErrorResponse>>(
options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetMeQueryOptions(options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getChangePasswordUrl = () => {

return `/api/auth/change-password`
}

/\*\*

- @summary Change password
  \*/
  export const changePassword = async (changePasswordBody: ChangePasswordBody, options?: RequestInit): Promise<MessageResponse> => {

return customFetch<MessageResponse>(getChangePasswordUrl(),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(changePasswordBody)
}
);}

export const getChangePasswordMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof changePassword>>, TError,{data: BodyType<ChangePasswordBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof changePassword>>, TError,{data: BodyType<ChangePasswordBody>}, TContext> => {

const mutationKey = ['changePassword'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof changePassword>>, {data: BodyType<ChangePasswordBody>}> = (props) => {
          const {data} = props ?? {};

          return  changePassword(data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type ChangePasswordMutationResult = NonNullable<Awaited<ReturnType<typeof changePassword>>>
    export type ChangePasswordMutationBody = BodyType<ChangePasswordBody>
    export type ChangePasswordMutationError = ErrorType<unknown>

    /**

- @summary Change password
  \*/
  export const useChangePassword = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof changePassword>>, TError,{data: BodyType<ChangePasswordBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof changePassword>>,
  TError,
  {data: BodyType<ChangePasswordBody>},
  TContext > => {
  return useMutation(getChangePasswordMutationOptions(options));
  }

export const getListPropertiesUrl = () => {

return `/api/properties`
}

/\*\*

- @summary List all properties
  \*/
  export const listProperties = async ( options?: RequestInit): Promise<Property[]> => {

return customFetch<Property[]>(getListPropertiesUrl(),
{
...options,
method: 'GET'

}
);}

export const getListPropertiesQueryKey = () => {
return [
`/api/properties`
] as const;
}

export const getListPropertiesQueryOptions = <TData = Awaited<ReturnType<typeof listProperties>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listProperties>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getListPropertiesQueryKey();

    const queryFn: QueryFunction<Awaited<ReturnType<typeof listProperties>>> = ({ signal }) => listProperties({ signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listProperties>>, TError, TData> & { queryKey: QueryKey }
}

export type ListPropertiesQueryResult = NonNullable<Awaited<ReturnType<typeof listProperties>>>
export type ListPropertiesQueryError = ErrorType<unknown>

/\*\*

- @summary List all properties
  \*/

export function useListProperties<TData = Awaited<ReturnType<typeof listProperties>>, TError = ErrorType<unknown>>(
options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listProperties>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getListPropertiesQueryOptions(options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getCreatePropertyUrl = () => {

return `/api/properties`
}

/\*\*

- @summary Create property
  \*/
  export const createProperty = async (createPropertyBody: CreatePropertyBody, options?: RequestInit): Promise<Property> => {

return customFetch<Property>(getCreatePropertyUrl(),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(createPropertyBody)
}
);}

export const getCreatePropertyMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createProperty>>, TError,{data: BodyType<CreatePropertyBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createProperty>>, TError,{data: BodyType<CreatePropertyBody>}, TContext> => {

const mutationKey = ['createProperty'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createProperty>>, {data: BodyType<CreatePropertyBody>}> = (props) => {
          const {data} = props ?? {};

          return  createProperty(data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CreatePropertyMutationResult = NonNullable<Awaited<ReturnType<typeof createProperty>>>
    export type CreatePropertyMutationBody = BodyType<CreatePropertyBody>
    export type CreatePropertyMutationError = ErrorType<unknown>

    /**

- @summary Create property
  \*/
  export const useCreateProperty = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createProperty>>, TError,{data: BodyType<CreatePropertyBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof createProperty>>,
  TError,
  {data: BodyType<CreatePropertyBody>},
  TContext > => {
  return useMutation(getCreatePropertyMutationOptions(options));
  }

export const getGetPropertyUrl = (id: number,) => {

return `/api/properties/${id}`
}

/\*\*

- @summary Get property
  \*/
  export const getProperty = async (id: number, options?: RequestInit): Promise<Property> => {

return customFetch<Property>(getGetPropertyUrl(id),
{
...options,
method: 'GET'

}
);}

export const getGetPropertyQueryKey = (id: number,) => {
return [
`/api/properties/${id}`
] as const;
}

export const getGetPropertyQueryOptions = <TData = Awaited<ReturnType<typeof getProperty>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getProperty>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetPropertyQueryKey(id);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getProperty>>> = ({ signal }) => getProperty(id, { signal, ...requestOptions });

return { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getProperty>>, TError, TData> & { queryKey: QueryKey }
}

export type GetPropertyQueryResult = NonNullable<Awaited<ReturnType<typeof getProperty>>>
export type GetPropertyQueryError = ErrorType<unknown>

/\*\*

- @summary Get property
  \*/

export function useGetProperty<TData = Awaited<ReturnType<typeof getProperty>>, TError = ErrorType<unknown>>(
id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getProperty>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetPropertyQueryOptions(id,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getUpdatePropertyUrl = (id: number,) => {

return `/api/properties/${id}`
}

/\*\*

- @summary Update property
  \*/
  export const updateProperty = async (id: number,
  updatePropertyBody: UpdatePropertyBody, options?: RequestInit): Promise<Property> => {

return customFetch<Property>(getUpdatePropertyUrl(id),
{
...options,
method: 'PATCH',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(updatePropertyBody)
}
);}

export const getUpdatePropertyMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateProperty>>, TError,{id: number;data: BodyType<UpdatePropertyBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateProperty>>, TError,{id: number;data: BodyType<UpdatePropertyBody>}, TContext> => {

const mutationKey = ['updateProperty'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateProperty>>, {id: number;data: BodyType<UpdatePropertyBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  updateProperty(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type UpdatePropertyMutationResult = NonNullable<Awaited<ReturnType<typeof updateProperty>>>
    export type UpdatePropertyMutationBody = BodyType<UpdatePropertyBody>
    export type UpdatePropertyMutationError = ErrorType<unknown>

    /**

- @summary Update property
  \*/
  export const useUpdateProperty = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateProperty>>, TError,{id: number;data: BodyType<UpdatePropertyBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof updateProperty>>,
  TError,
  {id: number;data: BodyType<UpdatePropertyBody>},
  TContext > => {
  return useMutation(getUpdatePropertyMutationOptions(options));
  }

export const getDeletePropertyUrl = (id: number,) => {

return `/api/properties/${id}`
}

/\*\*

- @summary Delete property
  \*/
  export const deleteProperty = async (id: number, options?: RequestInit): Promise<void> => {

return customFetch<void>(getDeletePropertyUrl(id),
{
...options,
method: 'DELETE'

}
);}

export const getDeletePropertyMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteProperty>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteProperty>>, TError,{id: number}, TContext> => {

const mutationKey = ['deleteProperty'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteProperty>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  deleteProperty(id,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type DeletePropertyMutationResult = NonNullable<Awaited<ReturnType<typeof deleteProperty>>>

    export type DeletePropertyMutationError = ErrorType<unknown>

    /**

- @summary Delete property
  \*/
  export const useDeleteProperty = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteProperty>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof deleteProperty>>,
  TError,
  {id: number},
  TContext > => {
  return useMutation(getDeletePropertyMutationOptions(options));
  }

export const getListBuildingsUrl = (params?: ListBuildingsParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/buildings?${stringifiedParams}` : `/api/buildings`
}

/\*\*

- @summary List buildings
  \*/
  export const listBuildings = async (params?: ListBuildingsParams, options?: RequestInit): Promise<Building[]> => {

return customFetch<Building[]>(getListBuildingsUrl(params),
{
...options,
method: 'GET'

}
);}

export const getListBuildingsQueryKey = (params?: ListBuildingsParams,) => {
return [
`/api/buildings`, ...(params ? [params] : [])
] as const;
}

export const getListBuildingsQueryOptions = <TData = Awaited<ReturnType<typeof listBuildings>>, TError = ErrorType<unknown>>(params?: ListBuildingsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listBuildings>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getListBuildingsQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof listBuildings>>> = ({ signal }) => listBuildings(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listBuildings>>, TError, TData> & { queryKey: QueryKey }
}

export type ListBuildingsQueryResult = NonNullable<Awaited<ReturnType<typeof listBuildings>>>
export type ListBuildingsQueryError = ErrorType<unknown>

/\*\*

- @summary List buildings
  \*/

export function useListBuildings<TData = Awaited<ReturnType<typeof listBuildings>>, TError = ErrorType<unknown>>(
params?: ListBuildingsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listBuildings>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getListBuildingsQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getCreateBuildingUrl = () => {

return `/api/buildings`
}

/\*\*

- @summary Create building
  \*/
  export const createBuilding = async (createBuildingBody: CreateBuildingBody, options?: RequestInit): Promise<Building> => {

return customFetch<Building>(getCreateBuildingUrl(),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(createBuildingBody)
}
);}

export const getCreateBuildingMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createBuilding>>, TError,{data: BodyType<CreateBuildingBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createBuilding>>, TError,{data: BodyType<CreateBuildingBody>}, TContext> => {

const mutationKey = ['createBuilding'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createBuilding>>, {data: BodyType<CreateBuildingBody>}> = (props) => {
          const {data} = props ?? {};

          return  createBuilding(data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CreateBuildingMutationResult = NonNullable<Awaited<ReturnType<typeof createBuilding>>>
    export type CreateBuildingMutationBody = BodyType<CreateBuildingBody>
    export type CreateBuildingMutationError = ErrorType<unknown>

    /**

- @summary Create building
  \*/
  export const useCreateBuilding = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createBuilding>>, TError,{data: BodyType<CreateBuildingBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof createBuilding>>,
  TError,
  {data: BodyType<CreateBuildingBody>},
  TContext > => {
  return useMutation(getCreateBuildingMutationOptions(options));
  }

export const getUpdateBuildingUrl = (id: number,) => {

return `/api/buildings/${id}`
}

/\*\*

- @summary Update building
  \*/
  export const updateBuilding = async (id: number,
  updateBuildingBody: UpdateBuildingBody, options?: RequestInit): Promise<Building> => {

return customFetch<Building>(getUpdateBuildingUrl(id),
{
...options,
method: 'PATCH',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(updateBuildingBody)
}
);}

export const getUpdateBuildingMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateBuilding>>, TError,{id: number;data: BodyType<UpdateBuildingBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateBuilding>>, TError,{id: number;data: BodyType<UpdateBuildingBody>}, TContext> => {

const mutationKey = ['updateBuilding'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateBuilding>>, {id: number;data: BodyType<UpdateBuildingBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  updateBuilding(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type UpdateBuildingMutationResult = NonNullable<Awaited<ReturnType<typeof updateBuilding>>>
    export type UpdateBuildingMutationBody = BodyType<UpdateBuildingBody>
    export type UpdateBuildingMutationError = ErrorType<unknown>

    /**

- @summary Update building
  \*/
  export const useUpdateBuilding = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateBuilding>>, TError,{id: number;data: BodyType<UpdateBuildingBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof updateBuilding>>,
  TError,
  {id: number;data: BodyType<UpdateBuildingBody>},
  TContext > => {
  return useMutation(getUpdateBuildingMutationOptions(options));
  }

export const getDeleteBuildingUrl = (id: number,) => {

return `/api/buildings/${id}`
}

/\*\*

- @summary Delete building
  \*/
  export const deleteBuilding = async (id: number, options?: RequestInit): Promise<void> => {

return customFetch<void>(getDeleteBuildingUrl(id),
{
...options,
method: 'DELETE'

}
);}

export const getDeleteBuildingMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteBuilding>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteBuilding>>, TError,{id: number}, TContext> => {

const mutationKey = ['deleteBuilding'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteBuilding>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  deleteBuilding(id,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type DeleteBuildingMutationResult = NonNullable<Awaited<ReturnType<typeof deleteBuilding>>>

    export type DeleteBuildingMutationError = ErrorType<unknown>

    /**

- @summary Delete building
  \*/
  export const useDeleteBuilding = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteBuilding>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof deleteBuilding>>,
  TError,
  {id: number},
  TContext > => {
  return useMutation(getDeleteBuildingMutationOptions(options));
  }

export const getListFloorsUrl = (params?: ListFloorsParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/floors?${stringifiedParams}` : `/api/floors`
}

/\*\*

- @summary List floors
  \*/
  export const listFloors = async (params?: ListFloorsParams, options?: RequestInit): Promise<Floor[]> => {

return customFetch<Floor[]>(getListFloorsUrl(params),
{
...options,
method: 'GET'

}
);}

export const getListFloorsQueryKey = (params?: ListFloorsParams,) => {
return [
`/api/floors`, ...(params ? [params] : [])
] as const;
}

export const getListFloorsQueryOptions = <TData = Awaited<ReturnType<typeof listFloors>>, TError = ErrorType<unknown>>(params?: ListFloorsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listFloors>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getListFloorsQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof listFloors>>> = ({ signal }) => listFloors(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listFloors>>, TError, TData> & { queryKey: QueryKey }
}

export type ListFloorsQueryResult = NonNullable<Awaited<ReturnType<typeof listFloors>>>
export type ListFloorsQueryError = ErrorType<unknown>

/\*\*

- @summary List floors
  \*/

export function useListFloors<TData = Awaited<ReturnType<typeof listFloors>>, TError = ErrorType<unknown>>(
params?: ListFloorsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listFloors>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getListFloorsQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getCreateFloorUrl = () => {

return `/api/floors`
}

/\*\*

- @summary Create floor
  \*/
  export const createFloor = async (createFloorBody: CreateFloorBody, options?: RequestInit): Promise<Floor> => {

return customFetch<Floor>(getCreateFloorUrl(),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(createFloorBody)
}
);}

export const getCreateFloorMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createFloor>>, TError,{data: BodyType<CreateFloorBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createFloor>>, TError,{data: BodyType<CreateFloorBody>}, TContext> => {

const mutationKey = ['createFloor'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createFloor>>, {data: BodyType<CreateFloorBody>}> = (props) => {
          const {data} = props ?? {};

          return  createFloor(data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CreateFloorMutationResult = NonNullable<Awaited<ReturnType<typeof createFloor>>>
    export type CreateFloorMutationBody = BodyType<CreateFloorBody>
    export type CreateFloorMutationError = ErrorType<unknown>

    /**

- @summary Create floor
  \*/
  export const useCreateFloor = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createFloor>>, TError,{data: BodyType<CreateFloorBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof createFloor>>,
  TError,
  {data: BodyType<CreateFloorBody>},
  TContext > => {
  return useMutation(getCreateFloorMutationOptions(options));
  }

export const getUpdateFloorUrl = (id: number,) => {

return `/api/floors/${id}`
}

/\*\*

- @summary Update floor
  \*/
  export const updateFloor = async (id: number,
  updateFloorBody: UpdateFloorBody, options?: RequestInit): Promise<Floor> => {

return customFetch<Floor>(getUpdateFloorUrl(id),
{
...options,
method: 'PATCH',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(updateFloorBody)
}
);}

export const getUpdateFloorMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateFloor>>, TError,{id: number;data: BodyType<UpdateFloorBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateFloor>>, TError,{id: number;data: BodyType<UpdateFloorBody>}, TContext> => {

const mutationKey = ['updateFloor'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateFloor>>, {id: number;data: BodyType<UpdateFloorBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  updateFloor(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type UpdateFloorMutationResult = NonNullable<Awaited<ReturnType<typeof updateFloor>>>
    export type UpdateFloorMutationBody = BodyType<UpdateFloorBody>
    export type UpdateFloorMutationError = ErrorType<unknown>

    /**

- @summary Update floor
  \*/
  export const useUpdateFloor = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateFloor>>, TError,{id: number;data: BodyType<UpdateFloorBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof updateFloor>>,
  TError,
  {id: number;data: BodyType<UpdateFloorBody>},
  TContext > => {
  return useMutation(getUpdateFloorMutationOptions(options));
  }

export const getDeleteFloorUrl = (id: number,) => {

return `/api/floors/${id}`
}

/\*\*

- @summary Delete floor
  \*/
  export const deleteFloor = async (id: number, options?: RequestInit): Promise<void> => {

return customFetch<void>(getDeleteFloorUrl(id),
{
...options,
method: 'DELETE'

}
);}

export const getDeleteFloorMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteFloor>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteFloor>>, TError,{id: number}, TContext> => {

const mutationKey = ['deleteFloor'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteFloor>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  deleteFloor(id,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type DeleteFloorMutationResult = NonNullable<Awaited<ReturnType<typeof deleteFloor>>>

    export type DeleteFloorMutationError = ErrorType<unknown>

    /**

- @summary Delete floor
  \*/
  export const useDeleteFloor = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteFloor>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof deleteFloor>>,
  TError,
  {id: number},
  TContext > => {
  return useMutation(getDeleteFloorMutationOptions(options));
  }

export const getListRoomsUrl = (params?: ListRoomsParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/rooms?${stringifiedParams}` : `/api/rooms`
}

/\*\*

- @summary List rooms
  \*/
  export const listRooms = async (params?: ListRoomsParams, options?: RequestInit): Promise<Room[]> => {

return customFetch<Room[]>(getListRoomsUrl(params),
{
...options,
method: 'GET'

}
);}

export const getListRoomsQueryKey = (params?: ListRoomsParams,) => {
return [
`/api/rooms`, ...(params ? [params] : [])
] as const;
}

export const getListRoomsQueryOptions = <TData = Awaited<ReturnType<typeof listRooms>>, TError = ErrorType<unknown>>(params?: ListRoomsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listRooms>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getListRoomsQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof listRooms>>> = ({ signal }) => listRooms(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listRooms>>, TError, TData> & { queryKey: QueryKey }
}

export type ListRoomsQueryResult = NonNullable<Awaited<ReturnType<typeof listRooms>>>
export type ListRoomsQueryError = ErrorType<unknown>

/\*\*

- @summary List rooms
  \*/

export function useListRooms<TData = Awaited<ReturnType<typeof listRooms>>, TError = ErrorType<unknown>>(
params?: ListRoomsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listRooms>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getListRoomsQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getCreateRoomUrl = () => {

return `/api/rooms`
}

/\*\*

- @summary Create room
  \*/
  export const createRoom = async (createRoomBody: CreateRoomBody, options?: RequestInit): Promise<Room> => {

return customFetch<Room>(getCreateRoomUrl(),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(createRoomBody)
}
);}

export const getCreateRoomMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createRoom>>, TError,{data: BodyType<CreateRoomBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createRoom>>, TError,{data: BodyType<CreateRoomBody>}, TContext> => {

const mutationKey = ['createRoom'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createRoom>>, {data: BodyType<CreateRoomBody>}> = (props) => {
          const {data} = props ?? {};

          return  createRoom(data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CreateRoomMutationResult = NonNullable<Awaited<ReturnType<typeof createRoom>>>
    export type CreateRoomMutationBody = BodyType<CreateRoomBody>
    export type CreateRoomMutationError = ErrorType<unknown>

    /**

- @summary Create room
  \*/
  export const useCreateRoom = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createRoom>>, TError,{data: BodyType<CreateRoomBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof createRoom>>,
  TError,
  {data: BodyType<CreateRoomBody>},
  TContext > => {
  return useMutation(getCreateRoomMutationOptions(options));
  }

export const getGetRoomUrl = (id: number,) => {

return `/api/rooms/${id}`
}

/\*\*

- @summary Get room
  \*/
  export const getRoom = async (id: number, options?: RequestInit): Promise<Room> => {

return customFetch<Room>(getGetRoomUrl(id),
{
...options,
method: 'GET'

}
);}

export const getGetRoomQueryKey = (id: number,) => {
return [
`/api/rooms/${id}`
] as const;
}

export const getGetRoomQueryOptions = <TData = Awaited<ReturnType<typeof getRoom>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getRoom>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetRoomQueryKey(id);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getRoom>>> = ({ signal }) => getRoom(id, { signal, ...requestOptions });

return { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getRoom>>, TError, TData> & { queryKey: QueryKey }
}

export type GetRoomQueryResult = NonNullable<Awaited<ReturnType<typeof getRoom>>>
export type GetRoomQueryError = ErrorType<unknown>

/\*\*

- @summary Get room
  \*/

export function useGetRoom<TData = Awaited<ReturnType<typeof getRoom>>, TError = ErrorType<unknown>>(
id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getRoom>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetRoomQueryOptions(id,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getUpdateRoomUrl = (id: number,) => {

return `/api/rooms/${id}`
}

/\*\*

- @summary Update room
  \*/
  export const updateRoom = async (id: number,
  updateRoomBody: UpdateRoomBody, options?: RequestInit): Promise<Room> => {

return customFetch<Room>(getUpdateRoomUrl(id),
{
...options,
method: 'PATCH',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(updateRoomBody)
}
);}

export const getUpdateRoomMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateRoom>>, TError,{id: number;data: BodyType<UpdateRoomBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateRoom>>, TError,{id: number;data: BodyType<UpdateRoomBody>}, TContext> => {

const mutationKey = ['updateRoom'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateRoom>>, {id: number;data: BodyType<UpdateRoomBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  updateRoom(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type UpdateRoomMutationResult = NonNullable<Awaited<ReturnType<typeof updateRoom>>>
    export type UpdateRoomMutationBody = BodyType<UpdateRoomBody>
    export type UpdateRoomMutationError = ErrorType<unknown>

    /**

- @summary Update room
  \*/
  export const useUpdateRoom = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateRoom>>, TError,{id: number;data: BodyType<UpdateRoomBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof updateRoom>>,
  TError,
  {id: number;data: BodyType<UpdateRoomBody>},
  TContext > => {
  return useMutation(getUpdateRoomMutationOptions(options));
  }

export const getDeleteRoomUrl = (id: number,) => {

return `/api/rooms/${id}`
}

/\*\*

- @summary Delete room
  \*/
  export const deleteRoom = async (id: number, options?: RequestInit): Promise<void> => {

return customFetch<void>(getDeleteRoomUrl(id),
{
...options,
method: 'DELETE'

}
);}

export const getDeleteRoomMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteRoom>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteRoom>>, TError,{id: number}, TContext> => {

const mutationKey = ['deleteRoom'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteRoom>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  deleteRoom(id,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type DeleteRoomMutationResult = NonNullable<Awaited<ReturnType<typeof deleteRoom>>>

    export type DeleteRoomMutationError = ErrorType<unknown>

    /**

- @summary Delete room
  \*/
  export const useDeleteRoom = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteRoom>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof deleteRoom>>,
  TError,
  {id: number},
  TContext > => {
  return useMutation(getDeleteRoomMutationOptions(options));
  }

export const getListEmployeesUrl = (params?: ListEmployeesParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/employees?${stringifiedParams}` : `/api/employees`
}

/\*\*

- @summary List employees
  \*/
  export const listEmployees = async (params?: ListEmployeesParams, options?: RequestInit): Promise<Employee[]> => {

return customFetch<Employee[]>(getListEmployeesUrl(params),
{
...options,
method: 'GET'

}
);}

export const getListEmployeesQueryKey = (params?: ListEmployeesParams,) => {
return [
`/api/employees`, ...(params ? [params] : [])
] as const;
}

export const getListEmployeesQueryOptions = <TData = Awaited<ReturnType<typeof listEmployees>>, TError = ErrorType<unknown>>(params?: ListEmployeesParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listEmployees>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getListEmployeesQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof listEmployees>>> = ({ signal }) => listEmployees(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listEmployees>>, TError, TData> & { queryKey: QueryKey }
}

export type ListEmployeesQueryResult = NonNullable<Awaited<ReturnType<typeof listEmployees>>>
export type ListEmployeesQueryError = ErrorType<unknown>

/\*\*

- @summary List employees
  \*/

export function useListEmployees<TData = Awaited<ReturnType<typeof listEmployees>>, TError = ErrorType<unknown>>(
params?: ListEmployeesParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listEmployees>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getListEmployeesQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getCreateEmployeeUrl = () => {

return `/api/employees`
}

/\*\*

- @summary Create employee
  \*/
  export const createEmployee = async (createEmployeeBody: CreateEmployeeBody, options?: RequestInit): Promise<Employee> => {

return customFetch<Employee>(getCreateEmployeeUrl(),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(createEmployeeBody)
}
);}

export const getCreateEmployeeMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createEmployee>>, TError,{data: BodyType<CreateEmployeeBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createEmployee>>, TError,{data: BodyType<CreateEmployeeBody>}, TContext> => {

const mutationKey = ['createEmployee'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createEmployee>>, {data: BodyType<CreateEmployeeBody>}> = (props) => {
          const {data} = props ?? {};

          return  createEmployee(data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CreateEmployeeMutationResult = NonNullable<Awaited<ReturnType<typeof createEmployee>>>
    export type CreateEmployeeMutationBody = BodyType<CreateEmployeeBody>
    export type CreateEmployeeMutationError = ErrorType<unknown>

    /**

- @summary Create employee
  \*/
  export const useCreateEmployee = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createEmployee>>, TError,{data: BodyType<CreateEmployeeBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof createEmployee>>,
  TError,
  {data: BodyType<CreateEmployeeBody>},
  TContext > => {
  return useMutation(getCreateEmployeeMutationOptions(options));
  }

export const getGetEmployeeUrl = (id: number,) => {

return `/api/employees/${id}`
}

/\*\*

- @summary Get employee
  \*/
  export const getEmployee = async (id: number, options?: RequestInit): Promise<Employee> => {

return customFetch<Employee>(getGetEmployeeUrl(id),
{
...options,
method: 'GET'

}
);}

export const getGetEmployeeQueryKey = (id: number,) => {
return [
`/api/employees/${id}`
] as const;
}

export const getGetEmployeeQueryOptions = <TData = Awaited<ReturnType<typeof getEmployee>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getEmployee>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetEmployeeQueryKey(id);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getEmployee>>> = ({ signal }) => getEmployee(id, { signal, ...requestOptions });

return { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getEmployee>>, TError, TData> & { queryKey: QueryKey }
}

export type GetEmployeeQueryResult = NonNullable<Awaited<ReturnType<typeof getEmployee>>>
export type GetEmployeeQueryError = ErrorType<unknown>

/\*\*

- @summary Get employee
  \*/

export function useGetEmployee<TData = Awaited<ReturnType<typeof getEmployee>>, TError = ErrorType<unknown>>(
id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getEmployee>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetEmployeeQueryOptions(id,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getUpdateEmployeeUrl = (id: number,) => {

return `/api/employees/${id}`
}

/\*\*

- @summary Update employee
  \*/
  export const updateEmployee = async (id: number,
  updateEmployeeBody: UpdateEmployeeBody, options?: RequestInit): Promise<Employee> => {

return customFetch<Employee>(getUpdateEmployeeUrl(id),
{
...options,
method: 'PATCH',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(updateEmployeeBody)
}
);}

export const getUpdateEmployeeMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateEmployee>>, TError,{id: number;data: BodyType<UpdateEmployeeBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateEmployee>>, TError,{id: number;data: BodyType<UpdateEmployeeBody>}, TContext> => {

const mutationKey = ['updateEmployee'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateEmployee>>, {id: number;data: BodyType<UpdateEmployeeBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  updateEmployee(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type UpdateEmployeeMutationResult = NonNullable<Awaited<ReturnType<typeof updateEmployee>>>
    export type UpdateEmployeeMutationBody = BodyType<UpdateEmployeeBody>
    export type UpdateEmployeeMutationError = ErrorType<unknown>

    /**

- @summary Update employee
  \*/
  export const useUpdateEmployee = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateEmployee>>, TError,{id: number;data: BodyType<UpdateEmployeeBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof updateEmployee>>,
  TError,
  {id: number;data: BodyType<UpdateEmployeeBody>},
  TContext > => {
  return useMutation(getUpdateEmployeeMutationOptions(options));
  }

export const getDeleteEmployeeUrl = (id: number,) => {

return `/api/employees/${id}`
}

/\*\*

- @summary Delete employee
  \*/
  export const deleteEmployee = async (id: number, options?: RequestInit): Promise<void> => {

return customFetch<void>(getDeleteEmployeeUrl(id),
{
...options,
method: 'DELETE'

}
);}

export const getDeleteEmployeeMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteEmployee>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteEmployee>>, TError,{id: number}, TContext> => {

const mutationKey = ['deleteEmployee'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteEmployee>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  deleteEmployee(id,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type DeleteEmployeeMutationResult = NonNullable<Awaited<ReturnType<typeof deleteEmployee>>>

    export type DeleteEmployeeMutationError = ErrorType<unknown>

    /**

- @summary Delete employee
  \*/
  export const useDeleteEmployee = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteEmployee>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof deleteEmployee>>,
  TError,
  {id: number},
  TContext > => {
  return useMutation(getDeleteEmployeeMutationOptions(options));
  }

export const getListAssignmentsUrl = (params?: ListAssignmentsParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/assignments?${stringifiedParams}` : `/api/assignments`
}

/\*\*

- @summary List assignments
  \*/
  export const listAssignments = async (params?: ListAssignmentsParams, options?: RequestInit): Promise<Assignment[]> => {

return customFetch<Assignment[]>(getListAssignmentsUrl(params),
{
...options,
method: 'GET'

}
);}

export const getListAssignmentsQueryKey = (params?: ListAssignmentsParams,) => {
return [
`/api/assignments`, ...(params ? [params] : [])
] as const;
}

export const getListAssignmentsQueryOptions = <TData = Awaited<ReturnType<typeof listAssignments>>, TError = ErrorType<unknown>>(params?: ListAssignmentsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listAssignments>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getListAssignmentsQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof listAssignments>>> = ({ signal }) => listAssignments(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listAssignments>>, TError, TData> & { queryKey: QueryKey }
}

export type ListAssignmentsQueryResult = NonNullable<Awaited<ReturnType<typeof listAssignments>>>
export type ListAssignmentsQueryError = ErrorType<unknown>

/\*\*

- @summary List assignments
  \*/

export function useListAssignments<TData = Awaited<ReturnType<typeof listAssignments>>, TError = ErrorType<unknown>>(
params?: ListAssignmentsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listAssignments>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getListAssignmentsQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getCreateAssignmentUrl = () => {

return `/api/assignments`
}

/\*\*

- @summary Create assignment (check-in employee)
  \*/
  export const createAssignment = async (createAssignmentBody: CreateAssignmentBody, options?: RequestInit): Promise<Assignment> => {

return customFetch<Assignment>(getCreateAssignmentUrl(),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(createAssignmentBody)
}
);}

export const getCreateAssignmentMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createAssignment>>, TError,{data: BodyType<CreateAssignmentBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createAssignment>>, TError,{data: BodyType<CreateAssignmentBody>}, TContext> => {

const mutationKey = ['createAssignment'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createAssignment>>, {data: BodyType<CreateAssignmentBody>}> = (props) => {
          const {data} = props ?? {};

          return  createAssignment(data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CreateAssignmentMutationResult = NonNullable<Awaited<ReturnType<typeof createAssignment>>>
    export type CreateAssignmentMutationBody = BodyType<CreateAssignmentBody>
    export type CreateAssignmentMutationError = ErrorType<unknown>

    /**

- @summary Create assignment (check-in employee)
  \*/
  export const useCreateAssignment = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createAssignment>>, TError,{data: BodyType<CreateAssignmentBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof createAssignment>>,
  TError,
  {data: BodyType<CreateAssignmentBody>},
  TContext > => {
  return useMutation(getCreateAssignmentMutationOptions(options));
  }

export const getGetAssignmentUrl = (id: number,) => {

return `/api/assignments/${id}`
}

/\*\*

- @summary Get assignment
  \*/
  export const getAssignment = async (id: number, options?: RequestInit): Promise<Assignment> => {

return customFetch<Assignment>(getGetAssignmentUrl(id),
{
...options,
method: 'GET'

}
);}

export const getGetAssignmentQueryKey = (id: number,) => {
return [
`/api/assignments/${id}`
] as const;
}

export const getGetAssignmentQueryOptions = <TData = Awaited<ReturnType<typeof getAssignment>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getAssignment>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetAssignmentQueryKey(id);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getAssignment>>> = ({ signal }) => getAssignment(id, { signal, ...requestOptions });

return { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getAssignment>>, TError, TData> & { queryKey: QueryKey }
}

export type GetAssignmentQueryResult = NonNullable<Awaited<ReturnType<typeof getAssignment>>>
export type GetAssignmentQueryError = ErrorType<unknown>

/\*\*

- @summary Get assignment
  \*/

export function useGetAssignment<TData = Awaited<ReturnType<typeof getAssignment>>, TError = ErrorType<unknown>>(
id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getAssignment>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetAssignmentQueryOptions(id,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getUpdateAssignmentUrl = (id: number,) => {

return `/api/assignments/${id}`
}

/\*\*

- @summary Update assignment
  \*/
  export const updateAssignment = async (id: number,
  updateAssignmentBody: UpdateAssignmentBody, options?: RequestInit): Promise<Assignment> => {

return customFetch<Assignment>(getUpdateAssignmentUrl(id),
{
...options,
method: 'PATCH',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(updateAssignmentBody)
}
);}

export const getUpdateAssignmentMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateAssignment>>, TError,{id: number;data: BodyType<UpdateAssignmentBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateAssignment>>, TError,{id: number;data: BodyType<UpdateAssignmentBody>}, TContext> => {

const mutationKey = ['updateAssignment'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateAssignment>>, {id: number;data: BodyType<UpdateAssignmentBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  updateAssignment(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type UpdateAssignmentMutationResult = NonNullable<Awaited<ReturnType<typeof updateAssignment>>>
    export type UpdateAssignmentMutationBody = BodyType<UpdateAssignmentBody>
    export type UpdateAssignmentMutationError = ErrorType<unknown>

    /**

- @summary Update assignment
  \*/
  export const useUpdateAssignment = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateAssignment>>, TError,{id: number;data: BodyType<UpdateAssignmentBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof updateAssignment>>,
  TError,
  {id: number;data: BodyType<UpdateAssignmentBody>},
  TContext > => {
  return useMutation(getUpdateAssignmentMutationOptions(options));
  }

export const getCheckoutAssignmentUrl = (id: number,) => {

return `/api/assignments/${id}/checkout`
}

/\*\*

- @summary Check out employee from room
  \*/
  export const checkoutAssignment = async (id: number,
  checkoutBody: CheckoutBody, options?: RequestInit): Promise<Assignment> => {

return customFetch<Assignment>(getCheckoutAssignmentUrl(id),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(checkoutBody)
}
);}

export const getCheckoutAssignmentMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof checkoutAssignment>>, TError,{id: number;data: BodyType<CheckoutBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof checkoutAssignment>>, TError,{id: number;data: BodyType<CheckoutBody>}, TContext> => {

const mutationKey = ['checkoutAssignment'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof checkoutAssignment>>, {id: number;data: BodyType<CheckoutBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  checkoutAssignment(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CheckoutAssignmentMutationResult = NonNullable<Awaited<ReturnType<typeof checkoutAssignment>>>
    export type CheckoutAssignmentMutationBody = BodyType<CheckoutBody>
    export type CheckoutAssignmentMutationError = ErrorType<unknown>

    /**

- @summary Check out employee from room
  \*/
  export const useCheckoutAssignment = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof checkoutAssignment>>, TError,{id: number;data: BodyType<CheckoutBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof checkoutAssignment>>,
  TError,
  {id: number;data: BodyType<CheckoutBody>},
  TContext > => {
  return useMutation(getCheckoutAssignmentMutationOptions(options));
  }

export const getTransferAssignmentUrl = (id: number,) => {

return `/api/assignments/${id}/transfer`
}

/\*\*

- @summary Transfer employee to another room
  \*/
  export const transferAssignment = async (id: number,
  transferBody: TransferBody, options?: RequestInit): Promise<Assignment> => {

return customFetch<Assignment>(getTransferAssignmentUrl(id),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(transferBody)
}
);}

export const getTransferAssignmentMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof transferAssignment>>, TError,{id: number;data: BodyType<TransferBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof transferAssignment>>, TError,{id: number;data: BodyType<TransferBody>}, TContext> => {

const mutationKey = ['transferAssignment'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof transferAssignment>>, {id: number;data: BodyType<TransferBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  transferAssignment(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type TransferAssignmentMutationResult = NonNullable<Awaited<ReturnType<typeof transferAssignment>>>
    export type TransferAssignmentMutationBody = BodyType<TransferBody>
    export type TransferAssignmentMutationError = ErrorType<unknown>

    /**

- @summary Transfer employee to another room
  \*/
  export const useTransferAssignment = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof transferAssignment>>, TError,{id: number;data: BodyType<TransferBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof transferAssignment>>,
  TError,
  {id: number;data: BodyType<TransferBody>},
  TContext > => {
  return useMutation(getTransferAssignmentMutationOptions(options));
  }

export const getListReservationsUrl = (params?: ListReservationsParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/reservations?${stringifiedParams}` : `/api/reservations`
}

/\*\*

- @summary List reservations
  \*/
  export const listReservations = async (params?: ListReservationsParams, options?: RequestInit): Promise<Reservation[]> => {

return customFetch<Reservation[]>(getListReservationsUrl(params),
{
...options,
method: 'GET'

}
);}

export const getListReservationsQueryKey = (params?: ListReservationsParams,) => {
return [
`/api/reservations`, ...(params ? [params] : [])
] as const;
}

export const getListReservationsQueryOptions = <TData = Awaited<ReturnType<typeof listReservations>>, TError = ErrorType<unknown>>(params?: ListReservationsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listReservations>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getListReservationsQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof listReservations>>> = ({ signal }) => listReservations(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listReservations>>, TError, TData> & { queryKey: QueryKey }
}

export type ListReservationsQueryResult = NonNullable<Awaited<ReturnType<typeof listReservations>>>
export type ListReservationsQueryError = ErrorType<unknown>

/\*\*

- @summary List reservations
  \*/

export function useListReservations<TData = Awaited<ReturnType<typeof listReservations>>, TError = ErrorType<unknown>>(
params?: ListReservationsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listReservations>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getListReservationsQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getCreateReservationUrl = () => {

return `/api/reservations`
}

/\*\*

- @summary Create reservation
  \*/
  export const createReservation = async (createReservationBody: CreateReservationBody, options?: RequestInit): Promise<Reservation> => {

return customFetch<Reservation>(getCreateReservationUrl(),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(createReservationBody)
}
);}

export const getCreateReservationMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createReservation>>, TError,{data: BodyType<CreateReservationBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createReservation>>, TError,{data: BodyType<CreateReservationBody>}, TContext> => {

const mutationKey = ['createReservation'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createReservation>>, {data: BodyType<CreateReservationBody>}> = (props) => {
          const {data} = props ?? {};

          return  createReservation(data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CreateReservationMutationResult = NonNullable<Awaited<ReturnType<typeof createReservation>>>
    export type CreateReservationMutationBody = BodyType<CreateReservationBody>
    export type CreateReservationMutationError = ErrorType<unknown>

    /**

- @summary Create reservation
  \*/
  export const useCreateReservation = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createReservation>>, TError,{data: BodyType<CreateReservationBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof createReservation>>,
  TError,
  {data: BodyType<CreateReservationBody>},
  TContext > => {
  return useMutation(getCreateReservationMutationOptions(options));
  }

export const getGetReservationUrl = (id: number,) => {

return `/api/reservations/${id}`
}

/\*\*

- @summary Get reservation
  \*/
  export const getReservation = async (id: number, options?: RequestInit): Promise<Reservation> => {

return customFetch<Reservation>(getGetReservationUrl(id),
{
...options,
method: 'GET'

}
);}

export const getGetReservationQueryKey = (id: number,) => {
return [
`/api/reservations/${id}`
] as const;
}

export const getGetReservationQueryOptions = <TData = Awaited<ReturnType<typeof getReservation>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getReservation>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetReservationQueryKey(id);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getReservation>>> = ({ signal }) => getReservation(id, { signal, ...requestOptions });

return { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getReservation>>, TError, TData> & { queryKey: QueryKey }
}

export type GetReservationQueryResult = NonNullable<Awaited<ReturnType<typeof getReservation>>>
export type GetReservationQueryError = ErrorType<unknown>

/\*\*

- @summary Get reservation
  \*/

export function useGetReservation<TData = Awaited<ReturnType<typeof getReservation>>, TError = ErrorType<unknown>>(
id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getReservation>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetReservationQueryOptions(id,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getUpdateReservationUrl = (id: number,) => {

return `/api/reservations/${id}`
}

/\*\*

- @summary Update reservation
  \*/
  export const updateReservation = async (id: number,
  updateReservationBody: UpdateReservationBody, options?: RequestInit): Promise<Reservation> => {

return customFetch<Reservation>(getUpdateReservationUrl(id),
{
...options,
method: 'PATCH',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(updateReservationBody)
}
);}

export const getUpdateReservationMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateReservation>>, TError,{id: number;data: BodyType<UpdateReservationBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateReservation>>, TError,{id: number;data: BodyType<UpdateReservationBody>}, TContext> => {

const mutationKey = ['updateReservation'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateReservation>>, {id: number;data: BodyType<UpdateReservationBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  updateReservation(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type UpdateReservationMutationResult = NonNullable<Awaited<ReturnType<typeof updateReservation>>>
    export type UpdateReservationMutationBody = BodyType<UpdateReservationBody>
    export type UpdateReservationMutationError = ErrorType<unknown>

    /**

- @summary Update reservation
  \*/
  export const useUpdateReservation = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateReservation>>, TError,{id: number;data: BodyType<UpdateReservationBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof updateReservation>>,
  TError,
  {id: number;data: BodyType<UpdateReservationBody>},
  TContext > => {
  return useMutation(getUpdateReservationMutationOptions(options));
  }

export const getDeleteReservationUrl = (id: number,) => {

return `/api/reservations/${id}`
}

/\*\*

- @summary Delete reservation
  \*/
  export const deleteReservation = async (id: number, options?: RequestInit): Promise<void> => {

return customFetch<void>(getDeleteReservationUrl(id),
{
...options,
method: 'DELETE'

}
);}

export const getDeleteReservationMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteReservation>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteReservation>>, TError,{id: number}, TContext> => {

const mutationKey = ['deleteReservation'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteReservation>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  deleteReservation(id,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type DeleteReservationMutationResult = NonNullable<Awaited<ReturnType<typeof deleteReservation>>>

    export type DeleteReservationMutationError = ErrorType<unknown>

    /**

- @summary Delete reservation
  \*/
  export const useDeleteReservation = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteReservation>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof deleteReservation>>,
  TError,
  {id: number},
  TContext > => {
  return useMutation(getDeleteReservationMutationOptions(options));
  }

export const getCheckinReservationUrl = (id: number,) => {

return `/api/reservations/${id}/checkin`
}

/\*\*

- @summary Check in a reservation guest
  \*/
  export const checkinReservation = async (id: number,
  reservationCheckinBody: ReservationCheckinBody, options?: RequestInit): Promise<Reservation> => {

return customFetch<Reservation>(getCheckinReservationUrl(id),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(reservationCheckinBody)
}
);}

export const getCheckinReservationMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof checkinReservation>>, TError,{id: number;data: BodyType<ReservationCheckinBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof checkinReservation>>, TError,{id: number;data: BodyType<ReservationCheckinBody>}, TContext> => {

const mutationKey = ['checkinReservation'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof checkinReservation>>, {id: number;data: BodyType<ReservationCheckinBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  checkinReservation(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CheckinReservationMutationResult = NonNullable<Awaited<ReturnType<typeof checkinReservation>>>
    export type CheckinReservationMutationBody = BodyType<ReservationCheckinBody>
    export type CheckinReservationMutationError = ErrorType<unknown>

    /**

- @summary Check in a reservation guest
  \*/
  export const useCheckinReservation = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof checkinReservation>>, TError,{id: number;data: BodyType<ReservationCheckinBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof checkinReservation>>,
  TError,
  {id: number;data: BodyType<ReservationCheckinBody>},
  TContext > => {
  return useMutation(getCheckinReservationMutationOptions(options));
  }

export const getListHostingsUrl = (params?: ListHostingsParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/hostings?${stringifiedParams}` : `/api/hostings`
}

/\*\*

- @summary List employee hostings
  \*/
  export const listHostings = async (params?: ListHostingsParams, options?: RequestInit): Promise<Hosting[]> => {

return customFetch<Hosting[]>(getListHostingsUrl(params),
{
...options,
method: 'GET'

}
);}

export const getListHostingsQueryKey = (params?: ListHostingsParams,) => {
return [
`/api/hostings`, ...(params ? [params] : [])
] as const;
}

export const getListHostingsQueryOptions = <TData = Awaited<ReturnType<typeof listHostings>>, TError = ErrorType<unknown>>(params?: ListHostingsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listHostings>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getListHostingsQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof listHostings>>> = ({ signal }) => listHostings(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listHostings>>, TError, TData> & { queryKey: QueryKey }
}

export type ListHostingsQueryResult = NonNullable<Awaited<ReturnType<typeof listHostings>>>
export type ListHostingsQueryError = ErrorType<unknown>

/\*\*

- @summary List employee hostings
  \*/

export function useListHostings<TData = Awaited<ReturnType<typeof listHostings>>, TError = ErrorType<unknown>>(
params?: ListHostingsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listHostings>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getListHostingsQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getCreateHostingUrl = () => {

return `/api/hostings`
}

/\*\*

- @summary Create hosting request
  \*/
  export const createHosting = async (createHostingBody: CreateHostingBody, options?: RequestInit): Promise<Hosting> => {

return customFetch<Hosting>(getCreateHostingUrl(),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(createHostingBody)
}
);}

export const getCreateHostingMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createHosting>>, TError,{data: BodyType<CreateHostingBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createHosting>>, TError,{data: BodyType<CreateHostingBody>}, TContext> => {

const mutationKey = ['createHosting'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createHosting>>, {data: BodyType<CreateHostingBody>}> = (props) => {
          const {data} = props ?? {};

          return  createHosting(data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CreateHostingMutationResult = NonNullable<Awaited<ReturnType<typeof createHosting>>>
    export type CreateHostingMutationBody = BodyType<CreateHostingBody>
    export type CreateHostingMutationError = ErrorType<unknown>

    /**

- @summary Create hosting request
  \*/
  export const useCreateHosting = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createHosting>>, TError,{data: BodyType<CreateHostingBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof createHosting>>,
  TError,
  {data: BodyType<CreateHostingBody>},
  TContext > => {
  return useMutation(getCreateHostingMutationOptions(options));
  }

export const getUpdateHostingUrl = (id: number,) => {

return `/api/hostings/${id}`
}

/\*\*

- @summary Update hosting
  \*/
  export const updateHosting = async (id: number,
  updateHostingBody: UpdateHostingBody, options?: RequestInit): Promise<Hosting> => {

return customFetch<Hosting>(getUpdateHostingUrl(id),
{
...options,
method: 'PATCH',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(updateHostingBody)
}
);}

export const getUpdateHostingMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateHosting>>, TError,{id: number;data: BodyType<UpdateHostingBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateHosting>>, TError,{id: number;data: BodyType<UpdateHostingBody>}, TContext> => {

const mutationKey = ['updateHosting'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateHosting>>, {id: number;data: BodyType<UpdateHostingBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  updateHosting(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type UpdateHostingMutationResult = NonNullable<Awaited<ReturnType<typeof updateHosting>>>
    export type UpdateHostingMutationBody = BodyType<UpdateHostingBody>
    export type UpdateHostingMutationError = ErrorType<unknown>

    /**

- @summary Update hosting
  \*/
  export const useUpdateHosting = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateHosting>>, TError,{id: number;data: BodyType<UpdateHostingBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof updateHosting>>,
  TError,
  {id: number;data: BodyType<UpdateHostingBody>},
  TContext > => {
  return useMutation(getUpdateHostingMutationOptions(options));
  }

export const getDeleteHostingUrl = (id: number,) => {

return `/api/hostings/${id}`
}

/\*\*

- @summary Delete hosting
  \*/
  export const deleteHosting = async (id: number, options?: RequestInit): Promise<void> => {

return customFetch<void>(getDeleteHostingUrl(id),
{
...options,
method: 'DELETE'

}
);}

export const getDeleteHostingMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteHosting>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteHosting>>, TError,{id: number}, TContext> => {

const mutationKey = ['deleteHosting'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteHosting>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  deleteHosting(id,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type DeleteHostingMutationResult = NonNullable<Awaited<ReturnType<typeof deleteHosting>>>

    export type DeleteHostingMutationError = ErrorType<unknown>

    /**

- @summary Delete hosting
  \*/
  export const useDeleteHosting = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteHosting>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof deleteHosting>>,
  TError,
  {id: number},
  TContext > => {
  return useMutation(getDeleteHostingMutationOptions(options));
  }

export const getApproveHostingUrl = (id: number,) => {

return `/api/hostings/${id}/approve`
}

/\*\*

- @summary Approve hosting request
  \*/
  export const approveHosting = async (id: number, options?: RequestInit): Promise<Hosting> => {

return customFetch<Hosting>(getApproveHostingUrl(id),
{
...options,
method: 'POST'

}
);}

export const getApproveHostingMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof approveHosting>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof approveHosting>>, TError,{id: number}, TContext> => {

const mutationKey = ['approveHosting'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof approveHosting>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  approveHosting(id,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type ApproveHostingMutationResult = NonNullable<Awaited<ReturnType<typeof approveHosting>>>

    export type ApproveHostingMutationError = ErrorType<unknown>

    /**

- @summary Approve hosting request
  \*/
  export const useApproveHosting = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof approveHosting>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof approveHosting>>,
  TError,
  {id: number},
  TContext > => {
  return useMutation(getApproveHostingMutationOptions(options));
  }

export const getCheckinHostingUrl = (id: number,) => {

return `/api/hostings/${id}/checkin`
}

/\*\*

- @summary Check in hosting guest
  \*/
  export const checkinHosting = async (id: number,
  hostingCheckinBody: HostingCheckinBody, options?: RequestInit): Promise<Hosting> => {

return customFetch<Hosting>(getCheckinHostingUrl(id),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(hostingCheckinBody)
}
);}

export const getCheckinHostingMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof checkinHosting>>, TError,{id: number;data: BodyType<HostingCheckinBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof checkinHosting>>, TError,{id: number;data: BodyType<HostingCheckinBody>}, TContext> => {

const mutationKey = ['checkinHosting'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof checkinHosting>>, {id: number;data: BodyType<HostingCheckinBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  checkinHosting(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CheckinHostingMutationResult = NonNullable<Awaited<ReturnType<typeof checkinHosting>>>
    export type CheckinHostingMutationBody = BodyType<HostingCheckinBody>
    export type CheckinHostingMutationError = ErrorType<unknown>

    /**

- @summary Check in hosting guest
  \*/
  export const useCheckinHosting = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof checkinHosting>>, TError,{id: number;data: BodyType<HostingCheckinBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof checkinHosting>>,
  TError,
  {id: number;data: BodyType<HostingCheckinBody>},
  TContext > => {
  return useMutation(getCheckinHostingMutationOptions(options));
  }

export const getCheckoutHostingUrl = (id: number,) => {

return `/api/hostings/${id}/checkout`
}

/\*\*

- @summary Check out hosting guest
  \*/
  export const checkoutHosting = async (id: number, options?: RequestInit): Promise<Hosting> => {

return customFetch<Hosting>(getCheckoutHostingUrl(id),
{
...options,
method: 'POST'

}
);}

export const getCheckoutHostingMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof checkoutHosting>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof checkoutHosting>>, TError,{id: number}, TContext> => {

const mutationKey = ['checkoutHosting'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof checkoutHosting>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  checkoutHosting(id,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CheckoutHostingMutationResult = NonNullable<Awaited<ReturnType<typeof checkoutHosting>>>

    export type CheckoutHostingMutationError = ErrorType<unknown>

    /**

- @summary Check out hosting guest
  \*/
  export const useCheckoutHosting = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof checkoutHosting>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof checkoutHosting>>,
  TError,
  {id: number},
  TContext > => {
  return useMutation(getCheckoutHostingMutationOptions(options));
  }

export const getListMaintenanceUrl = (params?: ListMaintenanceParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/maintenance?${stringifiedParams}` : `/api/maintenance`
}

/\*\*

- @summary List maintenance requests
  \*/
  export const listMaintenance = async (params?: ListMaintenanceParams, options?: RequestInit): Promise<MaintenanceRequest[]> => {

return customFetch<MaintenanceRequest[]>(getListMaintenanceUrl(params),
{
...options,
method: 'GET'

}
);}

export const getListMaintenanceQueryKey = (params?: ListMaintenanceParams,) => {
return [
`/api/maintenance`, ...(params ? [params] : [])
] as const;
}

export const getListMaintenanceQueryOptions = <TData = Awaited<ReturnType<typeof listMaintenance>>, TError = ErrorType<unknown>>(params?: ListMaintenanceParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listMaintenance>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getListMaintenanceQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof listMaintenance>>> = ({ signal }) => listMaintenance(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listMaintenance>>, TError, TData> & { queryKey: QueryKey }
}

export type ListMaintenanceQueryResult = NonNullable<Awaited<ReturnType<typeof listMaintenance>>>
export type ListMaintenanceQueryError = ErrorType<unknown>

/\*\*

- @summary List maintenance requests
  \*/

export function useListMaintenance<TData = Awaited<ReturnType<typeof listMaintenance>>, TError = ErrorType<unknown>>(
params?: ListMaintenanceParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listMaintenance>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getListMaintenanceQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getCreateMaintenanceUrl = () => {

return `/api/maintenance`
}

/\*\*

- @summary Create maintenance request
  \*/
  export const createMaintenance = async (createMaintenanceBody: CreateMaintenanceBody, options?: RequestInit): Promise<MaintenanceRequest> => {

return customFetch<MaintenanceRequest>(getCreateMaintenanceUrl(),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(createMaintenanceBody)
}
);}

export const getCreateMaintenanceMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createMaintenance>>, TError,{data: BodyType<CreateMaintenanceBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createMaintenance>>, TError,{data: BodyType<CreateMaintenanceBody>}, TContext> => {

const mutationKey = ['createMaintenance'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createMaintenance>>, {data: BodyType<CreateMaintenanceBody>}> = (props) => {
          const {data} = props ?? {};

          return  createMaintenance(data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CreateMaintenanceMutationResult = NonNullable<Awaited<ReturnType<typeof createMaintenance>>>
    export type CreateMaintenanceMutationBody = BodyType<CreateMaintenanceBody>
    export type CreateMaintenanceMutationError = ErrorType<unknown>

    /**

- @summary Create maintenance request
  \*/
  export const useCreateMaintenance = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createMaintenance>>, TError,{data: BodyType<CreateMaintenanceBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof createMaintenance>>,
  TError,
  {data: BodyType<CreateMaintenanceBody>},
  TContext > => {
  return useMutation(getCreateMaintenanceMutationOptions(options));
  }

export const getGetMaintenanceUrl = (id: number,) => {

return `/api/maintenance/${id}`
}

/\*\*

- @summary Get maintenance request
  \*/
  export const getMaintenance = async (id: number, options?: RequestInit): Promise<MaintenanceRequest> => {

return customFetch<MaintenanceRequest>(getGetMaintenanceUrl(id),
{
...options,
method: 'GET'

}
);}

export const getGetMaintenanceQueryKey = (id: number,) => {
return [
`/api/maintenance/${id}`
] as const;
}

export const getGetMaintenanceQueryOptions = <TData = Awaited<ReturnType<typeof getMaintenance>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMaintenance>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetMaintenanceQueryKey(id);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getMaintenance>>> = ({ signal }) => getMaintenance(id, { signal, ...requestOptions });

return { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getMaintenance>>, TError, TData> & { queryKey: QueryKey }
}

export type GetMaintenanceQueryResult = NonNullable<Awaited<ReturnType<typeof getMaintenance>>>
export type GetMaintenanceQueryError = ErrorType<unknown>

/\*\*

- @summary Get maintenance request
  \*/

export function useGetMaintenance<TData = Awaited<ReturnType<typeof getMaintenance>>, TError = ErrorType<unknown>>(
id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getMaintenance>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetMaintenanceQueryOptions(id,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getUpdateMaintenanceUrl = (id: number,) => {

return `/api/maintenance/${id}`
}

/\*\*

- @summary Update maintenance request
  \*/
  export const updateMaintenance = async (id: number,
  updateMaintenanceBody: UpdateMaintenanceBody, options?: RequestInit): Promise<MaintenanceRequest> => {

return customFetch<MaintenanceRequest>(getUpdateMaintenanceUrl(id),
{
...options,
method: 'PATCH',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(updateMaintenanceBody)
}
);}

export const getUpdateMaintenanceMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateMaintenance>>, TError,{id: number;data: BodyType<UpdateMaintenanceBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateMaintenance>>, TError,{id: number;data: BodyType<UpdateMaintenanceBody>}, TContext> => {

const mutationKey = ['updateMaintenance'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateMaintenance>>, {id: number;data: BodyType<UpdateMaintenanceBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  updateMaintenance(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type UpdateMaintenanceMutationResult = NonNullable<Awaited<ReturnType<typeof updateMaintenance>>>
    export type UpdateMaintenanceMutationBody = BodyType<UpdateMaintenanceBody>
    export type UpdateMaintenanceMutationError = ErrorType<unknown>

    /**

- @summary Update maintenance request
  \*/
  export const useUpdateMaintenance = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateMaintenance>>, TError,{id: number;data: BodyType<UpdateMaintenanceBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof updateMaintenance>>,
  TError,
  {id: number;data: BodyType<UpdateMaintenanceBody>},
  TContext > => {
  return useMutation(getUpdateMaintenanceMutationOptions(options));
  }

export const getDeleteMaintenanceUrl = (id: number,) => {

return `/api/maintenance/${id}`
}

/\*\*

- @summary Delete maintenance request
  \*/
  export const deleteMaintenance = async (id: number, options?: RequestInit): Promise<void> => {

return customFetch<void>(getDeleteMaintenanceUrl(id),
{
...options,
method: 'DELETE'

}
);}

export const getDeleteMaintenanceMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteMaintenance>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteMaintenance>>, TError,{id: number}, TContext> => {

const mutationKey = ['deleteMaintenance'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteMaintenance>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  deleteMaintenance(id,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type DeleteMaintenanceMutationResult = NonNullable<Awaited<ReturnType<typeof deleteMaintenance>>>

    export type DeleteMaintenanceMutationError = ErrorType<unknown>

    /**

- @summary Delete maintenance request
  \*/
  export const useDeleteMaintenance = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteMaintenance>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof deleteMaintenance>>,
  TError,
  {id: number},
  TContext > => {
  return useMutation(getDeleteMaintenanceMutationOptions(options));
  }

export const getListUsersUrl = (params?: ListUsersParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/users?${stringifiedParams}` : `/api/users`
}

/\*\*

- @summary List users
  \*/
  export const listUsers = async (params?: ListUsersParams, options?: RequestInit): Promise<User[]> => {

return customFetch<User[]>(getListUsersUrl(params),
{
...options,
method: 'GET'

}
);}

export const getListUsersQueryKey = (params?: ListUsersParams,) => {
return [
`/api/users`, ...(params ? [params] : [])
] as const;
}

export const getListUsersQueryOptions = <TData = Awaited<ReturnType<typeof listUsers>>, TError = ErrorType<unknown>>(params?: ListUsersParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listUsers>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getListUsersQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof listUsers>>> = ({ signal }) => listUsers(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listUsers>>, TError, TData> & { queryKey: QueryKey }
}

export type ListUsersQueryResult = NonNullable<Awaited<ReturnType<typeof listUsers>>>
export type ListUsersQueryError = ErrorType<unknown>

/\*\*

- @summary List users
  \*/

export function useListUsers<TData = Awaited<ReturnType<typeof listUsers>>, TError = ErrorType<unknown>>(
params?: ListUsersParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listUsers>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getListUsersQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getCreateUserUrl = () => {

return `/api/users`
}

/\*\*

- @summary Create user
  \*/
  export const createUser = async (createUserBody: CreateUserBody, options?: RequestInit): Promise<User> => {

return customFetch<User>(getCreateUserUrl(),
{
...options,
method: 'POST',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(createUserBody)
}
);}

export const getCreateUserMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createUser>>, TError,{data: BodyType<CreateUserBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createUser>>, TError,{data: BodyType<CreateUserBody>}, TContext> => {

const mutationKey = ['createUser'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createUser>>, {data: BodyType<CreateUserBody>}> = (props) => {
          const {data} = props ?? {};

          return  createUser(data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type CreateUserMutationResult = NonNullable<Awaited<ReturnType<typeof createUser>>>
    export type CreateUserMutationBody = BodyType<CreateUserBody>
    export type CreateUserMutationError = ErrorType<unknown>

    /**

- @summary Create user
  \*/
  export const useCreateUser = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createUser>>, TError,{data: BodyType<CreateUserBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof createUser>>,
  TError,
  {data: BodyType<CreateUserBody>},
  TContext > => {
  return useMutation(getCreateUserMutationOptions(options));
  }

export const getGetUserUrl = (id: number,) => {

return `/api/users/${id}`
}

/\*\*

- @summary Get user
  \*/
  export const getUser = async (id: number, options?: RequestInit): Promise<User> => {

return customFetch<User>(getGetUserUrl(id),
{
...options,
method: 'GET'

}
);}

export const getGetUserQueryKey = (id: number,) => {
return [
`/api/users/${id}`
] as const;
}

export const getGetUserQueryOptions = <TData = Awaited<ReturnType<typeof getUser>>, TError = ErrorType<unknown>>(id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getUser>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetUserQueryKey(id);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getUser>>> = ({ signal }) => getUser(id, { signal, ...requestOptions });

return { queryKey, queryFn, enabled: id !== null && id !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getUser>>, TError, TData> & { queryKey: QueryKey }
}

export type GetUserQueryResult = NonNullable<Awaited<ReturnType<typeof getUser>>>
export type GetUserQueryError = ErrorType<unknown>

/\*\*

- @summary Get user
  \*/

export function useGetUser<TData = Awaited<ReturnType<typeof getUser>>, TError = ErrorType<unknown>>(
id: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getUser>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetUserQueryOptions(id,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getUpdateUserUrl = (id: number,) => {

return `/api/users/${id}`
}

/\*\*

- @summary Update user
  \*/
  export const updateUser = async (id: number,
  updateUserBody: UpdateUserBody, options?: RequestInit): Promise<User> => {

return customFetch<User>(getUpdateUserUrl(id),
{
...options,
method: 'PATCH',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(updateUserBody)
}
);}

export const getUpdateUserMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateUser>>, TError,{id: number;data: BodyType<UpdateUserBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateUser>>, TError,{id: number;data: BodyType<UpdateUserBody>}, TContext> => {

const mutationKey = ['updateUser'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateUser>>, {id: number;data: BodyType<UpdateUserBody>}> = (props) => {
          const {id,data} = props ?? {};

          return  updateUser(id,data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type UpdateUserMutationResult = NonNullable<Awaited<ReturnType<typeof updateUser>>>
    export type UpdateUserMutationBody = BodyType<UpdateUserBody>
    export type UpdateUserMutationError = ErrorType<unknown>

    /**

- @summary Update user
  \*/
  export const useUpdateUser = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateUser>>, TError,{id: number;data: BodyType<UpdateUserBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof updateUser>>,
  TError,
  {id: number;data: BodyType<UpdateUserBody>},
  TContext > => {
  return useMutation(getUpdateUserMutationOptions(options));
  }

export const getDeleteUserUrl = (id: number,) => {

return `/api/users/${id}`
}

/\*\*

- @summary Delete user
  \*/
  export const deleteUser = async (id: number, options?: RequestInit): Promise<void> => {

return customFetch<void>(getDeleteUserUrl(id),
{
...options,
method: 'DELETE'

}
);}

export const getDeleteUserMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteUser>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof deleteUser>>, TError,{id: number}, TContext> => {

const mutationKey = ['deleteUser'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof deleteUser>>, {id: number}> = (props) => {
          const {id} = props ?? {};

          return  deleteUser(id,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type DeleteUserMutationResult = NonNullable<Awaited<ReturnType<typeof deleteUser>>>

    export type DeleteUserMutationError = ErrorType<unknown>

    /**

- @summary Delete user
  \*/
  export const useDeleteUser = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof deleteUser>>, TError,{id: number}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof deleteUser>>,
  TError,
  {id: number},
  TContext > => {
  return useMutation(getDeleteUserMutationOptions(options));
  }

export const getListActivityLogsUrl = (params?: ListActivityLogsParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/activity-logs?${stringifiedParams}` : `/api/activity-logs`
}

/\*\*

- @summary List activity logs
  \*/
  export const listActivityLogs = async (params?: ListActivityLogsParams, options?: RequestInit): Promise<ActivityLog[]> => {

return customFetch<ActivityLog[]>(getListActivityLogsUrl(params),
{
...options,
method: 'GET'

}
);}

export const getListActivityLogsQueryKey = (params?: ListActivityLogsParams,) => {
return [
`/api/activity-logs`, ...(params ? [params] : [])
] as const;
}

export const getListActivityLogsQueryOptions = <TData = Awaited<ReturnType<typeof listActivityLogs>>, TError = ErrorType<unknown>>(params?: ListActivityLogsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listActivityLogs>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getListActivityLogsQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof listActivityLogs>>> = ({ signal }) => listActivityLogs(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof listActivityLogs>>, TError, TData> & { queryKey: QueryKey }
}

export type ListActivityLogsQueryResult = NonNullable<Awaited<ReturnType<typeof listActivityLogs>>>
export type ListActivityLogsQueryError = ErrorType<unknown>

/\*\*

- @summary List activity logs
  \*/

export function useListActivityLogs<TData = Awaited<ReturnType<typeof listActivityLogs>>, TError = ErrorType<unknown>>(
params?: ListActivityLogsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof listActivityLogs>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getListActivityLogsQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getGetSettingsUrl = (params?: GetSettingsParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/settings?${stringifiedParams}` : `/api/settings`
}

/\*\*

- @summary Get system settings
  \*/
  export const getSettings = async (params?: GetSettingsParams, options?: RequestInit): Promise<AppSettings> => {

return customFetch<AppSettings>(getGetSettingsUrl(params),
{
...options,
method: 'GET'

}
);}

export const getGetSettingsQueryKey = (params?: GetSettingsParams,) => {
return [
`/api/settings`, ...(params ? [params] : [])
] as const;
}

export const getGetSettingsQueryOptions = <TData = Awaited<ReturnType<typeof getSettings>>, TError = ErrorType<unknown>>(params?: GetSettingsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetSettingsQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getSettings>>> = ({ signal }) => getSettings(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData> & { queryKey: QueryKey }
}

export type GetSettingsQueryResult = NonNullable<Awaited<ReturnType<typeof getSettings>>>
export type GetSettingsQueryError = ErrorType<unknown>

/\*\*

- @summary Get system settings
  \*/

export function useGetSettings<TData = Awaited<ReturnType<typeof getSettings>>, TError = ErrorType<unknown>>(
params?: GetSettingsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetSettingsQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getUpdateSettingsUrl = () => {

return `/api/settings`
}

/\*\*

- @summary Update system settings
  \*/
  export const updateSettings = async (updateSettingsBody: UpdateSettingsBody, options?: RequestInit): Promise<AppSettings> => {

return customFetch<AppSettings>(getUpdateSettingsUrl(),
{
...options,
method: 'PATCH',
headers: { 'Content-Type': 'application/json', ...options?.headers },
body: JSON.stringify(updateSettingsBody)
}
);}

export const getUpdateSettingsMutationOptions = <TError = ErrorType<unknown>,
TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateSettings>>, TError,{data: BodyType<UpdateSettingsBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateSettings>>, TError,{data: BodyType<UpdateSettingsBody>}, TContext> => {

const mutationKey = ['updateSettings'];
const {mutation: mutationOptions, request: requestOptions} = options ?
options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
options
: {...options, mutation: {...options.mutation, mutationKey}}
: {mutation: { mutationKey, }, request: undefined};

      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateSettings>>, {data: BodyType<UpdateSettingsBody>}> = (props) => {
          const {data} = props ?? {};

          return  updateSettings(data,requestOptions)
        }

return { mutationFn, ...mutationOptions }}

    export type UpdateSettingsMutationResult = NonNullable<Awaited<ReturnType<typeof updateSettings>>>
    export type UpdateSettingsMutationBody = BodyType<UpdateSettingsBody>
    export type UpdateSettingsMutationError = ErrorType<unknown>

    /**

- @summary Update system settings
  \*/
  export const useUpdateSettings = <TError = ErrorType<unknown>,
  TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateSettings>>, TError,{data: BodyType<UpdateSettingsBody>}, TContext>, request?: SecondParameter<typeof customFetch>}
  ): UseMutationResult<
  Awaited<ReturnType<typeof updateSettings>>,
  TError,
  {data: BodyType<UpdateSettingsBody>},
  TContext > => {
  return useMutation(getUpdateSettingsMutationOptions(options));
  }

export const getGetDashboardStatsUrl = (params?: GetDashboardStatsParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/dashboard/stats?${stringifiedParams}` : `/api/dashboard/stats`
}

/\*\*

- @summary Get dashboard statistics
  \*/
  export const getDashboardStats = async (params?: GetDashboardStatsParams, options?: RequestInit): Promise<DashboardStats> => {

return customFetch<DashboardStats>(getGetDashboardStatsUrl(params),
{
...options,
method: 'GET'

}
);}

export const getGetDashboardStatsQueryKey = (params?: GetDashboardStatsParams,) => {
return [
`/api/dashboard/stats`, ...(params ? [params] : [])
] as const;
}

export const getGetDashboardStatsQueryOptions = <TData = Awaited<ReturnType<typeof getDashboardStats>>, TError = ErrorType<unknown>>(params?: GetDashboardStatsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getDashboardStats>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetDashboardStatsQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getDashboardStats>>> = ({ signal }) => getDashboardStats(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getDashboardStats>>, TError, TData> & { queryKey: QueryKey }
}

export type GetDashboardStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboardStats>>>
export type GetDashboardStatsQueryError = ErrorType<unknown>

/\*\*

- @summary Get dashboard statistics
  \*/

export function useGetDashboardStats<TData = Awaited<ReturnType<typeof getDashboardStats>>, TError = ErrorType<unknown>>(
params?: GetDashboardStatsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getDashboardStats>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetDashboardStatsQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getGetDepartureAlertsUrl = (params?: GetDepartureAlertsParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/dashboard/departure-alerts?${stringifiedParams}` : `/api/dashboard/departure-alerts`
}

/\*\*

- @summary Get upcoming departure alerts
  \*/
  export const getDepartureAlerts = async (params?: GetDepartureAlertsParams, options?: RequestInit): Promise<DepartureAlert[]> => {

return customFetch<DepartureAlert[]>(getGetDepartureAlertsUrl(params),
{
...options,
method: 'GET'

}
);}

export const getGetDepartureAlertsQueryKey = (params?: GetDepartureAlertsParams,) => {
return [
`/api/dashboard/departure-alerts`, ...(params ? [params] : [])
] as const;
}

export const getGetDepartureAlertsQueryOptions = <TData = Awaited<ReturnType<typeof getDepartureAlerts>>, TError = ErrorType<unknown>>(params?: GetDepartureAlertsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getDepartureAlerts>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetDepartureAlertsQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getDepartureAlerts>>> = ({ signal }) => getDepartureAlerts(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getDepartureAlerts>>, TError, TData> & { queryKey: QueryKey }
}

export type GetDepartureAlertsQueryResult = NonNullable<Awaited<ReturnType<typeof getDepartureAlerts>>>
export type GetDepartureAlertsQueryError = ErrorType<unknown>

/\*\*

- @summary Get upcoming departure alerts
  \*/

export function useGetDepartureAlerts<TData = Awaited<ReturnType<typeof getDepartureAlerts>>, TError = ErrorType<unknown>>(
params?: GetDepartureAlertsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getDepartureAlerts>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetDepartureAlertsQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getGetArrivalAlertsUrl = (params?: GetArrivalAlertsParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/dashboard/arrival-alerts?${stringifiedParams}` : `/api/dashboard/arrival-alerts`
}

/\*\*

- @summary Get upcoming arrival alerts
  \*/
  export const getArrivalAlerts = async (params?: GetArrivalAlertsParams, options?: RequestInit): Promise<ArrivalAlert[]> => {

return customFetch<ArrivalAlert[]>(getGetArrivalAlertsUrl(params),
{
...options,
method: 'GET'

}
);}

export const getGetArrivalAlertsQueryKey = (params?: GetArrivalAlertsParams,) => {
return [
`/api/dashboard/arrival-alerts`, ...(params ? [params] : [])
] as const;
}

export const getGetArrivalAlertsQueryOptions = <TData = Awaited<ReturnType<typeof getArrivalAlerts>>, TError = ErrorType<unknown>>(params?: GetArrivalAlertsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getArrivalAlerts>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetArrivalAlertsQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getArrivalAlerts>>> = ({ signal }) => getArrivalAlerts(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getArrivalAlerts>>, TError, TData> & { queryKey: QueryKey }
}

export type GetArrivalAlertsQueryResult = NonNullable<Awaited<ReturnType<typeof getArrivalAlerts>>>
export type GetArrivalAlertsQueryError = ErrorType<unknown>

/\*\*

- @summary Get upcoming arrival alerts
  \*/

export function useGetArrivalAlerts<TData = Awaited<ReturnType<typeof getArrivalAlerts>>, TError = ErrorType<unknown>>(
params?: GetArrivalAlertsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getArrivalAlerts>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetArrivalAlertsQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getGetOccupancyByBuildingUrl = (params?: GetOccupancyByBuildingParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/dashboard/occupancy-by-building?${stringifiedParams}` : `/api/dashboard/occupancy-by-building`
}

/\*\*

- @summary Get occupancy breakdown by building
  \*/
  export const getOccupancyByBuilding = async (params?: GetOccupancyByBuildingParams, options?: RequestInit): Promise<OccupancyByBuilding[]> => {

return customFetch<OccupancyByBuilding[]>(getGetOccupancyByBuildingUrl(params),
{
...options,
method: 'GET'

}
);}

export const getGetOccupancyByBuildingQueryKey = (params?: GetOccupancyByBuildingParams,) => {
return [
`/api/dashboard/occupancy-by-building`, ...(params ? [params] : [])
] as const;
}

export const getGetOccupancyByBuildingQueryOptions = <TData = Awaited<ReturnType<typeof getOccupancyByBuilding>>, TError = ErrorType<unknown>>(params?: GetOccupancyByBuildingParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getOccupancyByBuilding>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetOccupancyByBuildingQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getOccupancyByBuilding>>> = ({ signal }) => getOccupancyByBuilding(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getOccupancyByBuilding>>, TError, TData> & { queryKey: QueryKey }
}

export type GetOccupancyByBuildingQueryResult = NonNullable<Awaited<ReturnType<typeof getOccupancyByBuilding>>>
export type GetOccupancyByBuildingQueryError = ErrorType<unknown>

/\*\*

- @summary Get occupancy breakdown by building
  \*/

export function useGetOccupancyByBuilding<TData = Awaited<ReturnType<typeof getOccupancyByBuilding>>, TError = ErrorType<unknown>>(
params?: GetOccupancyByBuildingParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getOccupancyByBuilding>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetOccupancyByBuildingQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

export const getGetRecentActivityUrl = (params?: GetRecentActivityParams,) => {
const normalizedParams = new URLSearchParams();

Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }

});

const stringifiedParams = normalizedParams.toString();

return stringifiedParams.length > 0 ? `/api/dashboard/recent-activity?${stringifiedParams}` : `/api/dashboard/recent-activity`
}

/\*\*

- @summary Get recent activity feed
  \*/
  export const getRecentActivity = async (params?: GetRecentActivityParams, options?: RequestInit): Promise<ActivityLog[]> => {

return customFetch<ActivityLog[]>(getGetRecentActivityUrl(params),
{
...options,
method: 'GET'

}
);}

export const getGetRecentActivityQueryKey = (params?: GetRecentActivityParams,) => {
return [
`/api/dashboard/recent-activity`, ...(params ? [params] : [])
] as const;
}

export const getGetRecentActivityQueryOptions = <TData = Awaited<ReturnType<typeof getRecentActivity>>, TError = ErrorType<unknown>>(params?: GetRecentActivityParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getRecentActivity>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

const queryKey = queryOptions?.queryKey ?? getGetRecentActivityQueryKey(params);

    const queryFn: QueryFunction<Awaited<ReturnType<typeof getRecentActivity>>> = ({ signal }) => getRecentActivity(params, { signal, ...requestOptions });

return { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getRecentActivity>>, TError, TData> & { queryKey: QueryKey }
}

export type GetRecentActivityQueryResult = NonNullable<Awaited<ReturnType<typeof getRecentActivity>>>
export type GetRecentActivityQueryError = ErrorType<unknown>

/\*\*

- @summary Get recent activity feed
  \*/

export function useGetRecentActivity<TData = Awaited<ReturnType<typeof getRecentActivity>>, TError = ErrorType<unknown>>(
params?: GetRecentActivityParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getRecentActivity>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

): UseQueryResult<TData, TError> & { queryKey: QueryKey } {

const queryOptions = getGetRecentActivityQueryOptions(params,options)

const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };

return { ...query, queryKey: queryOptions.queryKey };
}

================================================================================
FILE: lib/api-client-react/src/hooks/portal.ts
================================================================================

import { useQuery } from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";

export const usePortalProfile = () => useQuery({
queryKey: ["portal", "profile"],
queryFn: () => customFetch("/api/portal-data/profile")
});

export const usePortalRoom = () => useQuery({
queryKey: ["portal", "room"],
queryFn: () => customFetch("/api/portal-data/room")
});

export const usePortalNotifications = () => useQuery({
queryKey: ["portal", "notifications"],
queryFn: () => customFetch("/api/portal-data/notifications")
});

export const usePortalAlerts = () => useQuery({
queryKey: ["portal", "alerts"],
queryFn: () => customFetch("/api/portal-data/alerts")
});

================================================================================
FILE: lib/api-client-react/src/hooks/smart-lock.ts
================================================================================

import { useMutation, useQuery } from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";

// ─── Encoder Types ───
export type EncoderType = "ip" | "usb" | "smart";

// ─── Encoder Status ───
export const getEncoderStatusUrl = (type: EncoderType = "ip") => `/api/encoder/status?type=${type}`;
export const getEncoderStatus = async (type: EncoderType = "ip", options?: { signal?: AbortSignal }) => {
return customFetch<{ connected: boolean; host: string; port: number; lastActivity?: string; type: EncoderType }>(
getEncoderStatusUrl(type),
{ signal: options?.signal }
);
};
export const getEncoderStatusQueryKey = (type: EncoderType = "ip") => ["/api/encoder/status", type] as const;
export const getEncoderStatusQueryOptions = (type: EncoderType = "ip", options?: any) => {
const { query: queryOptions } = options ?? {};
const queryKey = queryOptions?.queryKey ?? getEncoderStatusQueryKey(type);
const queryFn = ({ signal }: any) => getEncoderStatus(type, { signal });
return { queryKey, queryFn, refetchInterval: 3000, ...queryOptions };
};
export function useEncoderStatus(type: EncoderType = "ip", options?: any) {
const queryOptions = getEncoderStatusQueryOptions(type, options);
return useQuery<{ connected: boolean; host: string; port: number; lastActivity?: string; type: EncoderType }>(queryOptions);
}

// ─── Connect Encoder ───
export const connectEncoder = async (data: { type: EncoderType; host?: string; port?: number }) => {
return customFetch<{ success: boolean; status: any; type: EncoderType }>("/api/encoder/connect", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(data),
});
};
export const useConnectEncoder = (options?: any) => {
return useMutation<unknown, Error, { type: EncoderType; host?: string; port?: number }>({
mutationKey: ["connectEncoder"],
mutationFn: connectEncoder,
...options,
});
};

// ─── Disconnect Encoder ───
export const disconnectEncoder = async (type: EncoderType = "ip") => {
return customFetch<{ success: boolean }>("/api/encoder/disconnect", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ type }),
});
};
export const useDisconnectEncoder = (options?: any) => {
return useMutation<unknown, Error, EncoderType>({
mutationKey: ["disconnectEncoder"],
mutationFn: disconnectEncoder,
...options,
});
};

// ─── Read Card ───
export const readCard = async (type: EncoderType = "ip") => {
return customFetch<any>("/api/encoder/read-card", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ type }),
});
};
export const useReadCard = (options?: any) => {
return useMutation<unknown, Error, EncoderType>({
mutationKey: ["readCard"],
mutationFn: readCard,
...options,
});
};

// ─── Eject Card ───
export const ejectCard = async (type: EncoderType = "ip") => {
return customFetch<any>("/api/encoder/eject", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ type }),
});
};
export const useEjectCard = (options?: any) => {
return useMutation<unknown, Error, EncoderType>({
mutationKey: ["ejectCard"],
mutationFn: ejectCard,
...options,
});
};

// ─── Direct Encode (via encoder, no DB) ───
export const encodeCard = async (data: {
type: EncoderType;
roomNumber: string;
checkIn: string;
checkOut: string;
cardType?: string;
ejectionType?: string;
user?: string;
}) => {
return customFetch<any>("/api/encoder/encode", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(data),
});
};
export const useEncodeCard = (options?: any) => {
return useMutation<unknown, Error, {
type: EncoderType;
roomNumber: string;
checkIn: string;
checkOut: string;
cardType?: string;
ejectionType?: string;
user?: string;
}>({
mutationKey: ["encodeCard"],
mutationFn: encodeCard,
...options,
});
};

// ─── List Serial Ports ───
export const getSerialPorts = async () => {
return customFetch<{ path: string; manufacturer?: string; serialNumber?: string }[]>("/api/encoder/serial-ports");
};
export const useSerialPorts = (options?: any) => {
return useQuery({
queryKey: ["/api/encoder/serial-ports"],
queryFn: getSerialPorts,
...options,
});
};

// ─── Keys List ───
export const getKeysUrl = (propertyId: number, roomId?: number) => {
let url = `/api/keys?propertyId=${propertyId}`;
if (roomId) url += `&roomId=${roomId}`;
return url;
};
export const getKeys = async (propertyId: number, roomId?: number) => {
return customFetch<any[]>(getKeysUrl(propertyId, roomId));
};
export const getKeysQueryKey = (propertyId: number, roomId?: number) => ["/api/keys", propertyId, roomId] as const;
export const useKeys = (propertyId: number, roomId?: number, options?: any) => {
return useQuery<any[]>({
queryKey: getKeysQueryKey(propertyId, roomId),
queryFn: () => getKeys(propertyId, roomId),
enabled: !!propertyId,
...options,
});
};

// ─── Issue Key ───
export const issueKey = async (data: any) => {
return customFetch<any>("/api/keys/issue", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(data),
});
};
export const useIssueKey = (options?: any) => {
return useMutation<unknown, Error, any>({
mutationKey: ["issueKey"],
mutationFn: issueKey,
...options,
});
};

// ─── Revoke Key ───
export const revokeKey = async ({ id, encoderType }: { id: number; encoderType?: EncoderType }) => {
return customFetch<any>(`/api/keys/${id}/revoke`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ type: encoderType || "ip" }),
});
};
export const useRevokeKey = (options?: any) => {
return useMutation<unknown, Error, { id: number; encoderType?: EncoderType }>({
mutationKey: ["revokeKey"],
mutationFn: revokeKey,
...options,
});
};

// ─── Smart Server: Check-In & Issue Key ───
export const smartCheckinIssueKey = async (data: {
roomNumber: string;
guestId: string | number;
guestName?: string;
arrivalDate: string;
departureDate: string;
checkOutTime?: string;
workstation?: string;
saveToDb?: boolean;
propertyId?: number;
roomId?: number;
assignmentId?: number;
cardType?: string;
notes?: string;
}) => {
return customFetch<{ success: boolean; cardUid: string; workstation?: string; cardCount?: number; key?: any }>(
"/api/encoder/smart/checkin-issue-key",
{
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(data),
}
);
};
export const useSmartCheckinIssueKey = (options?: any) => {
return useMutation<unknown, Error, {
roomNumber: string;
guestId: string | number;
guestName?: string;
arrivalDate: string;
departureDate: string;
checkOutTime?: string;
workstation?: string;
saveToDb?: boolean;
propertyId?: number;
roomId?: number;
assignmentId?: number;
cardType?: string;
notes?: string;
}>({
mutationKey: ["smartCheckinIssueKey"],
mutationFn: smartCheckinIssueKey,
...options,
});
};

// ─── Audit Log ───
export const getAuditLogUrl = (propertyId: number) => `/api/keys/audit?propertyId=${propertyId}`;
export const getAuditLog = async (propertyId: number) => {
return customFetch<any[]>(getAuditLogUrl(propertyId));
};
export const useAuditLog = (propertyId: number, options?: any) => {
return useQuery({
queryKey: ["/api/keys/audit", propertyId],
queryFn: () => getAuditLog(propertyId),
enabled: !!propertyId,
...options,
});
};

================================================================================
FILE: artifacts/housing/src/index.css
================================================================================

@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');

@import "tailwindcss";
@import "tw-animate-css";
@plugin "@tailwindcss/typography";

@custom-variant dark (&:is(.dark \*));

@theme inline {
--color-background: hsl(var(--background));
--color-foreground: hsl(var(--foreground));
--color-border: hsl(var(--border));
--color-input: hsl(var(--input));
--color-ring: hsl(var(--ring));

--color-card: hsl(var(--card));
--color-card-foreground: hsl(var(--card-foreground));
--color-card-border: hsl(var(--card-border));

--color-popover: hsl(var(--popover));
--color-popover-foreground: hsl(var(--popover-foreground));
--color-popover-border: hsl(var(--popover-border));

--color-primary: hsl(var(--primary));
--color-primary-foreground: hsl(var(--primary-foreground));
--color-primary-border: var(--primary-border);

--color-secondary: hsl(var(--secondary));
--color-secondary-foreground: hsl(var(--secondary-foreground));
--color-secondary-border: var(--secondary-border);

--color-muted: hsl(var(--muted));
--color-muted-foreground: hsl(var(--muted-foreground));
--color-muted-border: var(--muted-border);

--color-accent: hsl(var(--accent));
--color-accent-foreground: hsl(var(--accent-foreground));
--color-accent-border: var(--accent-border);

--color-destructive: hsl(var(--destructive));
--color-destructive-foreground: hsl(var(--destructive-foreground));
--color-destructive-border: var(--destructive-border);

--color-chart-1: hsl(var(--chart-1));
--color-chart-2: hsl(var(--chart-2));
--color-chart-3: hsl(var(--chart-3));
--color-chart-4: hsl(var(--chart-4));
--color-chart-5: hsl(var(--chart-5));

--color-sidebar: hsl(var(--sidebar));
--color-sidebar-foreground: hsl(var(--sidebar-foreground));
--color-sidebar-border: hsl(var(--sidebar-border));
--color-sidebar-primary: hsl(var(--sidebar-primary));
--color-sidebar-primary-foreground: hsl(var(--sidebar-primary-foreground));
--color-sidebar-primary-border: var(--sidebar-primary-border);
--color-sidebar-accent: hsl(var(--sidebar-accent));
--color-sidebar-accent-foreground: hsl(var(--sidebar-accent-foreground));
--color-sidebar-accent-border: var(--sidebar-accent-border);
--color-sidebar-ring: hsl(var(--sidebar-ring));

--font-sans: var(--app-font-sans);
--font-serif: var(--app-font-serif);
--font-mono: var(--app-font-mono);

--radius-sm: calc(var(--radius) - 4px);
--radius-md: calc(var(--radius) - 2px);
--radius-lg: var(--radius);
--radius-xl: calc(var(--radius) + 4px);

--animate-fade-in: fadeIn 0.25s ease-out forwards;
--animate-fade-in-up: fadeInUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards;
--animate-slide-in-right: slideInRight 0.3s cubic-bezier(0.16,1,0.3,1) forwards;
--animate-slide-in-left: slideInLeft 0.3s cubic-bezier(0.16,1,0.3,1) forwards;

@keyframes fadeIn {
from { opacity: 0; }
to { opacity: 1; }
}
@keyframes fadeInUp {
from { opacity: 0; transform: translateY(16px); }
to { opacity: 1; transform: translateY(0); }
}
@keyframes slideInRight {
from { opacity: 0; transform: translateX(24px); }
to { opacity: 1; transform: translateX(0); }
}
@keyframes slideInLeft {
from { opacity: 0; transform: translateX(-24px); }
to { opacity: 1; transform: translateX(0); }
}
}

/_ ─── LIGHT MODE ──────────────────────────────────────────── _/
:root {
--button-outline: rgba(0,0,0, .10);
--badge-outline: rgba(0,0,0, .05);
--opaque-button-border-intensity: -8;
--elevate-1: rgba(0,0,0, .03);
--elevate-2: rgba(0,0,0, .08);

--background: 210 20% 98%;
--foreground: 220 20% 15%;
--border: 220 13% 91%;

--card: 0 0% 100%;
--card-foreground: 220 20% 15%;
--card-border: 220 13% 91%;

/_ Sidebar — Navy #0F2A44 _/
--sidebar: 209 64% 16%;
--sidebar-foreground: 0 0% 98%;
--sidebar-border: 209 64% 12%;
--sidebar-primary: 41 56% 54%;
--sidebar-primary-foreground: 0 0% 100%;
--sidebar-accent: 209 50% 24%;
--sidebar-accent-foreground: 0 0% 100%;
--sidebar-ring: 41 56% 54%;

--popover: 0 0% 100%;
--popover-foreground: 220 20% 15%;
--popover-border: 220 13% 91%;

/_ Primary — Gold #C9A24D _/
--primary: 41 56% 54%;
--primary-foreground: 0 0% 100%;

--secondary: 210 40% 90%;
--secondary-foreground: 209 64% 16%;

--muted: 220 14% 96%;
--muted-foreground: 220 8% 46%;

--accent: 220 14% 96%;
--accent-foreground: 220 20% 15%;

--destructive: 0 84% 60%;
--destructive-foreground: 0 0% 100%;

--input: 220 13% 91%;
--ring: 41 56% 54%;

--chart-1: 41 56% 54%;
--chart-2: 209 64% 16%;
--chart-3: 160 60% 45%;
--chart-4: 20 80% 60%;
--chart-5: 280 60% 60%;

--app-font-sans: 'Inter', 'Cairo', sans-serif;
--app-font-serif: Georgia, serif;
--app-font-mono: 'JetBrains Mono', Menlo, monospace;
--radius: .5rem;

--shadow-2xs: 0px 2px 0px 0px hsl(220 20% 15% / 0.05);
--shadow-xs: 0px 2px 0px 0px hsl(220 20% 15% / 0.05);
--shadow-sm: 0px 2px 0px 0px hsl(220 20% 15% / 0.05), 0px 1px 2px -1px hsl(220 20% 15% / 0.05);
--shadow: 0px 2px 0px 0px hsl(220 20% 15% / 0.05), 0px 1px 2px -1px hsl(220 20% 15% / 0.05);
--shadow-md: 0px 2px 0px 0px hsl(220 20% 15% / 0.05), 0px 2px 4px -1px hsl(220 20% 15% / 0.05);
--shadow-lg: 0px 2px 0px 0px hsl(220 20% 15% / 0.05), 0px 4px 6px -1px hsl(220 20% 15% / 0.05);
--shadow-xl: 0px 2px 0px 0px hsl(220 20% 15% / 0.05), 0px 8px 10px -1px hsl(220 20% 15% / 0.05);
--shadow-2xl: 0px 2px 0px 0px hsl(220 20% 15% / 0.05);
--tracking-normal: 0em;
--spacing: 0.25rem;

--sidebar-primary-border: hsl(from hsl(var(--sidebar-primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
--sidebar-accent-border: hsl(from hsl(var(--sidebar-accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
--primary-border: hsl(from hsl(var(--primary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
--secondary-border: hsl(from hsl(var(--secondary)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
--muted-border: hsl(from hsl(var(--muted)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
--accent-border: hsl(from hsl(var(--accent)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
--destructive-border: hsl(from hsl(var(--destructive)) h s calc(l + var(--opaque-button-border-intensity)) / alpha);
}

/_ ─── DARK MODE ──────────────────────────────────────────── _/
.dark {
--button-outline: rgba(255,255,255, .10);
--badge-outline: rgba(255,255,255, .05);
--opaque-button-border-intensity: 9;
--elevate-1: rgba(255,255,255, .04);
--elevate-2: rgba(255,255,255, .09);

--background: 220 20% 8%;
--foreground: 0 0% 98%;
--border: 220 13% 15%;

--card: 220 20% 12%;
--card-foreground: 0 0% 98%;
--card-border: 220 13% 15%;

--sidebar: 209 64% 12%;
--sidebar-foreground: 0 0% 98%;
--sidebar-border: 209 64% 8%;
--sidebar-primary: 41 56% 54%;
--sidebar-primary-foreground: 0 0% 100%;
--sidebar-accent: 209 50% 20%;
--sidebar-accent-foreground: 0 0% 100%;
--sidebar-ring: 41 56% 54%;

--popover: 220 20% 12%;
--popover-foreground: 0 0% 98%;
--popover-border: 220 13% 15%;

--primary: 41 56% 54%;
--primary-foreground: 0 0% 100%;

--secondary: 210 40% 15%;
--secondary-foreground: 210 40% 90%;

--muted: 220 14% 15%;
--muted-foreground: 220 8% 60%;

--accent: 220 14% 15%;
--accent-foreground: 0 0% 98%;

--destructive: 0 84% 60%;
--destructive-foreground: 0 0% 100%;

--input: 220 13% 20%;
--ring: 41 56% 54%;

--chart-1: 41 56% 54%;
--chart-2: 210 40% 90%;
--chart-3: 160 60% 45%;
--chart-4: 20 80% 60%;
--chart-5: 280 60% 60%;

--shadow-2xs: 0px 2px 0px 0px hsl(0 0% 0% / 0.5);
--shadow-xs: 0px 2px 0px 0px hsl(0 0% 0% / 0.5);
--shadow-sm: 0px 2px 0px 0px hsl(0 0% 0% / 0.5), 0px 1px 2px -1px hsl(0 0% 0% / 0.5);
--shadow: 0px 2px 0px 0px hsl(0 0% 0% / 0.5), 0px 1px 2px -1px hsl(0 0% 0% / 0.5);
--shadow-md: 0px 2px 0px 0px hsl(0 0% 0% / 0.5), 0px 2px 4px -1px hsl(0 0% 0% / 0.5);
--shadow-lg: 0px 2px 0px 0px hsl(0 0% 0% / 0.5), 0px 4px 6px -1px hsl(0 0% 0% / 0.5);
--shadow-xl: 0px 2px 0px 0px hsl(0 0% 0% / 0.5), 0px 8px 10px -1px hsl(0 0% 0% / 0.5);
--shadow-2xl: 0px 2px 0px 0px hsl(0 0% 0% / 0.5);
}

/_ ─── BASE ───────────────────────────────────────────────── _/
@layer base {

- { @apply border-border; box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }

body {
@apply font-sans antialiased bg-background text-foreground;
font-size: 13px;
font-weight: 400;
line-height: 1.6;
overflow-x: hidden;
font-feature-settings: "cv02","cv03","cv04","cv11";
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
}

h1 { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.025em; line-height: 1.2; }
h2 { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.25; }
h3 { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.015em; line-height: 1.3; }
h4 { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.01em; }

input[type="checkbox"],
input[type="radio"] { accent-color: hsl(var(--primary)); }

/_ Arabic RTL: use Cairo font _/
[dir="rtl"], [dir="rtl"] \* { font-family: "Cairo", sans-serif; }
}

/_ ─── COMPONENTS ─────────────────────────────────────────── _/
@layer components {

/_ ── Scrollbars ── _/
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground)); }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

/_ ── Modal max-height fix (applies to all DialogContent) ── _/
[data-radix-dialog-content],
[role="dialog"] > div {
max-height: 90vh;
}

/_ ── Page helpers ── _/
.page-header {
@apply flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6;
}
.page-title {
@apply text-2xl font-bold tracking-tight text-foreground;
}
.page-subtitle {
@apply text-sm text-muted-foreground mt-0.5;
}

/_ ── Icon action buttons for table rows ── _/
.icon-btn {
@apply inline-flex items-center justify-center w-8 h-8 rounded-lg
border transition-all duration-150 cursor-pointer flex-shrink-0;
}
.icon-btn-primary {
@apply inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-150 cursor-pointer flex-shrink-0
bg-primary/10 text-primary border-primary/20
hover:bg-primary hover:text-primary-foreground hover:border-primary;
}
.icon-btn-danger {
@apply inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-150 cursor-pointer flex-shrink-0
bg-red-50 text-red-500 border-red-200
hover:bg-red-500 hover:text-white hover:border-red-500
dark:bg-red-950/30 dark:border-red-900;
}
.icon-btn-warning {
@apply inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-150 cursor-pointer flex-shrink-0
bg-amber-50 text-amber-600 border-amber-200
hover:bg-amber-500 hover:text-white hover:border-amber-500;
}
.icon-btn-success {
@apply inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-150 cursor-pointer flex-shrink-0
bg-emerald-50 text-emerald-600 border-emerald-200
hover:bg-emerald-500 hover:text-white hover:border-emerald-500;
}
.icon-btn-neutral {
@apply inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-150 cursor-pointer flex-shrink-0
bg-muted text-muted-foreground border-border
hover:bg-accent hover:text-accent-foreground;
}

/_ ── Stat cards on dashboard ── _/
.stat-card {
@apply bg-card p-5 rounded-xl border border-card-border
shadow-sm hover:shadow-md hover:-translate-y-0.5
transition-all duration-200 relative overflow-hidden;
}

/_ ── Table helpers ── _/
.table-header-cell {
@apply text-xs font-semibold uppercase tracking-wider text-muted-foreground;
}
.table-row-hover {
@apply hover:bg-muted/30 transition-colors duration-100;
}

/_ ── Empty state ── _/
.empty-state {
@apply flex flex-col items-center gap-3 py-16 text-center;
}
.empty-state-icon {
@apply w-14 h-14 rounded-2xl bg-muted flex items-center justify-center;
}

/_ ── Form section label ── _/
.form-section-label {
@apply text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3;
}

/_ ── Sidebar active nav item indicator ── _/
.nav-active {
@apply bg-sidebar-accent text-sidebar-accent-foreground font-semibold
border-l-2 border-sidebar-primary;
}
.nav-inactive {
@apply text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground;
}
}

/_ ─── UTILITIES ──────────────────────────────────────────── _/
@layer utilities {
.font-arabic { font-family: "Cairo", sans-serif; }
.glass-effect {
@apply bg-white/10 dark:bg-slate-900/10 backdrop-blur-md border border-white/20;
-webkit-backdrop-filter: blur(12px);
backdrop-filter: blur(12px);
}
.text-balance { text-wrap: balance; }
.animate-fade-in { animation: var(--animate-fade-in); }
.animate-fade-in-up { animation: var(--animate-fade-in-up); }
}
