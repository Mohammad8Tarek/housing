import { Router } from "express";
import { pool } from "@workspace/db";
import { requirePermission } from "../../middlewares/permissions.js";
import { ListQuery, su, resolveRequestId, approvalRoleKey, getRequestWithSteps } from "./shared.js";

const router: Router = Router();

// GET /api/hosting-requests/history/:clockNumber — Get history of hosting requests for an profile
router.get(
  "/hosting-requests/history/:clockNumber",
  requirePermission("hosting_requests", "view"),
  async (req, res): Promise<void> => {
    const user = su(req);
    try {
      const { clockNumber } = req.params;
      if (!clockNumber) {
        res
          .status(400)
          .json({ success: false, message: "clockNumber is required" });
        return;
      }

      const rowsRes = await pool.query(
        `SELECT id, request_number as "requestNumber", status, from_date as "fromDate", to_date as "toDate", consumed_days as "consumedDays"
         FROM public.hosting_requests 
         WHERE clock_number = $1 AND property_id = $2
         ORDER BY created_at DESC`,
        [clockNumber, user.propertyId],
      );

      res.status(200).json({ success: true, data: rowsRes.rows });
    } catch (err: unknown) {
      console.error("ROUTE ERROR:", err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  },
);

// GET /api/hosting-requests — List with pagination & filters
router.get(
  "/hosting-requests",
  requirePermission("hosting_requests", "view"),
  async (req, res): Promise<void> => {
    const user = su(req);
    try {
      const q = ListQuery.parse(req.query as any);

      const conditions: string[] = ["fvr.property_id = $" + 1];
      const params: any[] = [user.propertyId];
      let paramIdx = 2;

      if (q.status && q.status !== "all") {
        conditions.push(`fvr.status = $${paramIdx++}`);
        params.push(q.status);
      }
      if (q.hotelId) {
        conditions.push(
          `(fvr.hotel_id = $${paramIdx} OR fvr.visit_hotel_id = $${paramIdx})`,
        );
        paramIdx++;
        params.push(q.hotelId);
      }
      if (q.search) {
        conditions.push(
          `(fvr.profile_name ILIKE $${paramIdx} OR fvr.request_number ILIKE $${paramIdx} OR fvr.clock_number ILIKE $${paramIdx})`,
        );
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
        `SELECT fvr.*, h1.display_name AS hotel_name, h2.display_name AS visit_hotel_name,
        json_agg(
          json_build_object(
            'id', fas.id, 'stepOrder', fas.step_order, 'roleRequired', fas.role_required,
            'status', fas.status, 'labelAr', fas.label_ar, 'labelEn', fas.label_en,
            'signedByUserId', fas.signed_by_user_id,
            'signedAt', fas.signed_at, 'signatureImageUrlSnapshot', fas.signature_image_url_snapshot,
            'comment', fas.comment
          ) ORDER BY fas.step_order
        ) FILTER (WHERE fas.id IS NOT NULL) AS approval_steps
      FROM public.hosting_requests fvr
      LEFT JOIN public.properties h1 ON h1.id = fvr.hotel_id
      LEFT JOIN public.properties h2 ON h2.id = fvr.visit_hotel_id
      LEFT JOIN public.hosting_request_approval_steps fas ON fas.request_id = fvr.id
      WHERE ${whereClause}
      GROUP BY fvr.id, h1.display_name, h2.display_name
      ORDER BY fvr.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, q.limit, offset],
      );

      const totalPages = Math.ceil(total / q.limit);

      // Compute pendingOn
      const mappedRows = rowsRes.rows.map((row) => {
        let pendingOn = null;
        if (row.status === "in_signing" && Array.isArray(row.approval_steps)) {
          const pendingStep = row.approval_steps.find(
            (s: any) => s.status === "pending",
          );
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
      console.error("ROUTE ERROR:", err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  },
);

// GET /api/hosting-requests/counts — Status counts for tabs
router.get(
  "/hosting-requests/counts",
  requirePermission("hosting_requests", "view"),
  async (req, res): Promise<void> => {
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
      console.error("ROUTE ERROR:", err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  },
);

// GET /api/hosting-requests/pending-my-signature
router.get(
  "/hosting-requests/pending-my-signature",
  requirePermission("hosting_requests", "view"),
  async (req, res): Promise<void> => {
    const user = su(req);
    try {
      const rows = await pool.query(
        `SELECT fvr.id, fvr.request_number, fvr.profile_name, fvr.created_at,
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
      console.error("ROUTE ERROR:", err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  },
);

// GET /api/hosting-requests/:id — Request detail
router.get(
  "/hosting-requests/:id",
  requirePermission("hosting_requests", "view"),
  async (req, res): Promise<void> => {
    const user = su(req);
    try {
      const requestId = await resolveRequestId(String(req.params.id));
      if (!requestId) {
        res.status(404).json({ success: false, message: "Request not found" });
        return;
      }

      const request = await getRequestWithSteps(
        requestId,
        user.propertyIds,
        user.isSystemAdmin,
      );
      if (!request) {
        res.status(404).json({ success: false, message: "Request not found" });
        return;
      }

      res.json({ success: true, data: request });
    } catch (err: unknown) {
      console.error("ROUTE ERROR:", err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  },
);

export default router;
