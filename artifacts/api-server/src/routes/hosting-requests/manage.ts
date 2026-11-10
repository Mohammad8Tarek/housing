import { Router } from "express";
import { pool } from "@workspace/db";
import { logActivity } from "../../lib/activity-logger.js";
import { broadcastToProperty } from "../../lib/websocket.js";
import { requirePermission } from "../../middlewares/permissions.js";
import { CreateFamilyVisitBody, su, resolveRequestId } from "./shared.js";

const router: Router = Router();

// PUT /api/hosting-requests/:id - Edit request
router.put(
  "/hosting-requests/:id",
  requirePermission("hosting_requests", "edit"),
  async (req, res): Promise<void> => {
    const user = su(req);
    try {
      const requestId = await resolveRequestId(String(req.params.id));
      if (!requestId) {
        res.status(404).json({ success: false, message: "Request not found" });
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
          "SELECT id, status, property_id FROM public.hosting_requests WHERE id = $1 FOR UPDATE",
          [requestId],
        );
        if (lockRes.rows.length === 0) {
          await client.query("ROLLBACK");
          res.status(404).json({
            success: false,
            message: "Request not found or access denied",
          });
          return;
        }

        const reqStatus = lockRes.rows[0]?.status;
        if (
          reqStatus !== "in_signing" &&
          reqStatus !== "returned" &&
          !user.isSystemAdmin
        ) {
          await client.query("ROLLBACK");
          res.status(400).json({
            success: false,
            message:
              "Cannot edit this request in its current status unless you are an admin",
          });
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
            requestId,
          ],
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

        broadcastToProperty(user.propertyId, {
          type: "data_updated",
          module: "accommodation",
          action: "updated",
        });

        res.json({ success: true, message: "Request updated successfully" });
      } catch (txErr: unknown) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err: unknown) {
      console.error("ROUTE ERROR:", err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  },
);

// DELETE /api/hosting-requests/:id - Delete request
router.delete(
  "/hosting-requests/:id",
  requirePermission("hosting_requests", "delete"),
  async (req, res): Promise<void> => {
    const user = su(req);
    try {
      const requestId = await resolveRequestId(String(req.params.id));
      if (!requestId) {
        res.status(404).json({ success: false, message: "Request not found" });
        return;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        let checkRes;
        if (user.isSystemAdmin) {
          checkRes = await client.query(
            "SELECT id FROM public.hosting_requests WHERE id = $1 FOR UPDATE",
            [requestId],
          );
        } else {
          checkRes = await client.query(
            "SELECT id FROM public.hosting_requests WHERE id = $1 AND property_id = ANY($2::int[]) FOR UPDATE",
            [requestId, user.propertyIds],
          );
        }
        if (checkRes.rows.length === 0) {
          await client.query("ROLLBACK");
          res.status(404).json({
            success: false,
            message: "Request not found or access denied",
          });
          return;
        }

        await client.query(
          "DELETE FROM public.hosting_request_approval_steps WHERE request_id = $1",
          [requestId],
        );
        await client.query(
          "DELETE FROM public.hosting_requests WHERE id = $1",
          [requestId],
        );

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

        broadcastToProperty(user.propertyId, {
          type: "data_updated",
          module: "accommodation",
          action: "deleted",
        });

        res.json({ success: true, message: "Request deleted successfully" });
      } catch (txErr: unknown) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err: unknown) {
      console.error("ROUTE ERROR:", err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  },
);

export default router;
