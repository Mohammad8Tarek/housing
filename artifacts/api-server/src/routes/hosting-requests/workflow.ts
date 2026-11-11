import { Router } from "express";
import { pool } from "@workspace/db";
import { logActivity } from "../../lib/activity-logger.js";
import { broadcastToProperty } from "../../lib/websocket.js";
import { logger } from "../../lib/logger.js";
import { requirePermission } from "../../middlewares/permissions.js";
import { STEP_ROLES, SignBody, RejectBody, RebackBody, su, ensureProfileInTargetSchema, resolveRequestId, canAccessProperty, userMatchesApprovalRole, hasAlreadyActedOnRequest, getRequestWithSteps } from "./shared.js";
import { validate } from "../../middlewares/validate.js";
import { RequestRefParams } from "../../validation/schemas.js";

const router: Router = Router();

// POST /api/hosting-requests/:id/sign — Sign current step
router.post(
  "/hosting-requests/:id/sign",
  requirePermission("hosting_requests", "approve"),
  validate({ params: RequestRefParams }),
  async (req, res): Promise<void> => {
    const user = su(req);
    try {
      const requestId = await resolveRequestId(String(req.params.id));
      if (!requestId) {
        res.status(404).json({ success: false, message: "Request not found" });
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
        const lockRes = await client.query(
          "SELECT id, status, current_step_order, request_number, property_id FROM public.hosting_requests WHERE id = $1 FOR UPDATE",
          [requestId],
        );
        if (lockRes.rows.length === 0) {
          await client.query("ROLLBACK");
          res
            .status(404)
            .json({ success: false, message: "Request not found" });
          return;
        }
        if (
          !canAccessProperty(
            lockRes.rows[0].property_id,
            user.propertyIds,
            user.isSystemAdmin,
          )
        ) {
          await client.query("ROLLBACK");
          res
            .status(403)
            .json({ success: false, message: "Cross-tenant access denied" });
          return;
        }

        request = lockRes.rows[0];

        if (request.status !== "in_signing") {
          await client.query("ROLLBACK");
          res.status(400).json({
            success: false,
            message: "Request is not in signing status",
          });
          return;
        }

        stepOrder = request.current_step_order;

        // Check step exists, is pending, and get its required role
        const stepRes = await client.query(
          "SELECT id, status, role_required, label_ar, label_en FROM public.hosting_request_approval_steps WHERE request_id = $1 AND step_order = $2",
          [requestId, stepOrder],
        );
        if (stepRes.rows.length === 0) {
          await client.query("ROLLBACK");
          res
            .status(400)
            .json({ success: false, message: "Approval step not found" });
          return;
        }
        if (stepRes.rows[0].status !== "pending") {
          await client.query("ROLLBACK");
          res.status(400).json({
            success: false,
            message: "This step has already been signed",
          });
          return;
        }

        requiredRole = stepRes.rows[0].role_required;

        const hasRole = userMatchesApprovalRole(user, requiredRole);
        if (!hasRole) {
          logger.warn(
            {
              userId: user.userId,
              jobTitle: user.jobTitle,
              roles: user.roles,
              requiredRole,
            },
            "Permission denied for signing family visit request",
          );
          await client.query("ROLLBACK");
          res.status(403).json({
            success: false,
            message: `Only ${requiredRole} can sign this step`,
          });
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
              message:
                "You must upload your signature before signing this request.",
              titleAr: "مطلوب توقيع",
              messageAr: "يجب رفع توقيعك قبل توقيع هذا الطلب.",
              entityId: requestId,
            },
          });

          res.status(400).json({
            success: false,
            message:
              "Upload your signature in Settings before signing requests",
          });
          return;
        }
        const signatureUrl = sigRes.rows[0].signature_image_url;

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

        // Check if there is a next step
        const nextStepRes = await client.query(
          "SELECT step_order, role_required, label_ar, label_en FROM public.hosting_request_approval_steps WHERE request_id = $1 AND step_order > $2 ORDER BY step_order ASC LIMIT 1",
          [requestId, stepOrder],
        );

        if (nextStepRes.rows.length === 0) {
          // Final step — mark request approved
          await client.query(
            "UPDATE public.hosting_requests SET status = 'approved', updated_at = NOW() WHERE id = $1",
            [requestId],
          );
        } else {
          // Move to next step
          nextStepOrder = nextStepRes.rows[0].step_order;
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

      // Use the request's own property_id for broadcast — supports cross-property requests
      const requestPropertyId = request.property_id ?? user.propertyId;

      // Notify clients to refresh hosting-requests data
      broadcastToProperty(requestPropertyId, {
        type: "data_updated",
        module: "hosting-requests",
        action: "updated",
      });

      // Broadcast signed notification to all users in that property
      broadcastToProperty(requestPropertyId, {
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

      // If there's a next step, notify the users whose role matches
      if (nextStepOrder) {
        const nextStepRow = await pool.query(
          "SELECT role_required, label_ar, label_en FROM public.hosting_request_approval_steps WHERE request_id = $1 AND step_order = $2",
          [requestId, nextStepOrder],
        );
        const nextRole = nextStepRow.rows[0]?.role_required || STEP_ROLES[nextStepOrder] || "admin";
        const nextRoleLabelAr = nextStepRow.rows[0]?.label_ar || nextRole;
        const nextRoleLabelEn = nextStepRow.rows[0]?.label_en || nextRole;

        // Search across all properties the current user manages (cross-property support)
        const propertyIdsForQuery = user.isSystemAdmin
          ? null
          : user.propertyIds.length > 0
            ? user.propertyIds
            : [requestPropertyId];

        const nextRoleUsers = propertyIdsForQuery
          ? await pool.query(
              `SELECT id, username FROM public.users
               WHERE property_id = ANY($1::int[])
                 AND (roles @> ARRAY[$2]::text[] OR LOWER(REPLACE(job_title, ' ', '_')) = $2)`,
              [propertyIdsForQuery, nextRole],
            )
          : await pool.query(
              `SELECT id, username FROM public.users
               WHERE roles @> ARRAY[$1]::text[] OR LOWER(REPLACE(job_title, ' ', '_')) = $1`,
              [nextRole],
            );

        for (const row of nextRoleUsers.rows) {
          broadcastToProperty(requestPropertyId, {
            type: "notification",
            module: "notifications",
            action: "created",
            data: {
              title: "Pending your signature",
              message: `Request ${request.request_number} is waiting for your approval as ${nextRoleLabelEn}.`,
              titleAr: "في انتظار توقيعك",
              messageAr: `الطلب ${request.request_number} ينتظر توقيعك كـ ${nextRoleLabelAr}.`,
              entityId: requestId,
              targetUserId: row.id,
            },
          });
        }
      }

      // Auto create-guest-hosting when request is fully approved (final step)
      if (stepOrder >= 3) {
        try {
          // Check if guest_hosting_id is not yet set
          const checkGH = await pool.query(
            `SELECT guest_hosting_id FROM public.hosting_requests WHERE id = $1`,
            [requestId],
          );
          if (!checkGH.rows[0]?.guest_hosting_id) {
            // Call create-guest-hosting internally
            const ghClient = await pool.connect();
            try {
              await ghClient.query("BEGIN");
              const targetPropId = request.visit_hotel_id || requestPropertyId;
              const profileCheck = await ensureProfileInTargetSchema(ghClient, requestPropertyId, targetPropId, request.clock_number);
              
              if (profileCheck) {
                  const { profileId, targetSchema: schemaName } = profileCheck;
                  
                  if (profileId) {
                    const hostingRes = await ghClient.query(
                      `INSERT INTO "${schemaName}".hostings
                       (profile_id, hosting_type, guests_count, expected_from, expected_to, notes, created_by, status, room_id)
                       VALUES ($1, 'SEPARATE_ROOM', $2, $3, $4, $5, $6, 'APPROVED', $7)
                       RETURNING id`,
                      [
                        profileId,
                        request.family_members_count,
                        request.from_date,
                        request.to_date,
                        request.remarks || "",
                        user.username || String(user.userId),
                        request.assigned_room_id || null,
                      ],
                    );
                    const hostingId = hostingRes.rows[0].id;
                    await ghClient.query(
                      `UPDATE public.hosting_requests SET guest_hosting_id = $1, guest_hosting_status = 'APPROVED', updated_at = NOW() WHERE id = $2`,
                      [hostingId, requestId],
                    );
                    await ghClient.query("COMMIT");
                    // Notify to refresh accommodation
                    broadcastToProperty(requestPropertyId, {
                      type: "data_updated",
                      module: "accommodation",
                      action: "updated",
                    });
                  } else {
                    await ghClient.query("ROLLBACK");
                  }
              } else {
                await ghClient.query("ROLLBACK");
              }
            } catch (e: any) {
              await ghClient.query("ROLLBACK").catch(() => {});
              logger.error("Auto guest-hosting creation failed: " + e.message);
            } finally {
              ghClient.release();
            }
          }
        } catch {
          // Auto-create failed silently — user can create manually
        }
      }

      const updated = await getRequestWithSteps(
        requestId,
        user.propertyIds,
        user.isSystemAdmin,
      );
      res.json({ success: true, data: updated });
    } catch (err: unknown) {
      console.error("ROUTE ERROR:", err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  },
);

// POST /api/hosting-requests/:id/reject — Reject request
router.post(
  "/hosting-requests/:id/reject",
  requirePermission("hosting_requests", "approve"),
  validate({ params: RequestRefParams }),
  async (req, res): Promise<void> => {
    const user = su(req);
    try {
      const requestId = await resolveRequestId(String(req.params.id));
      if (!requestId) {
        res.status(404).json({ success: false, message: "Request not found" });
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

        const lockRes = await client.query(
          "SELECT id, status, current_step_order, property_id FROM public.hosting_requests WHERE id = $1 FOR UPDATE",
          [requestId],
        );
        if (lockRes.rows.length === 0) {
          await client.query("ROLLBACK");
          res
            .status(404)
            .json({ success: false, message: "Request not found" });
          return;
        }
        if (
          !canAccessProperty(
            lockRes.rows[0].property_id,
            user.propertyIds,
            user.isSystemAdmin,
          )
        ) {
          await client.query("ROLLBACK");
          res
            .status(403)
            .json({ success: false, message: "Cross-tenant access denied" });
          return;
        }

        request = lockRes.rows[0];

        if (request.status !== "in_signing") {
          await client.query("ROLLBACK");
          res.status(400).json({
            success: false,
            message: "Request is not in signing status",
          });
          return;
        }

        stepOrder = request.current_step_order;
        const currentStepRes = await client.query(
          "SELECT role_required FROM public.hosting_request_approval_steps WHERE request_id = $1 AND step_order = $2",
          [requestId, stepOrder],
        );
        requiredRole = currentStepRes.rows[0]?.role_required || STEP_ROLES[stepOrder] || "admin";

        const hasRole = userMatchesApprovalRole(user, requiredRole);
        if (!hasRole) {
          await client.query("ROLLBACK");
          res.status(403).json({
            success: false,
            message: `Only ${requiredRole} can reject this request`,
          });
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

      const updated = await getRequestWithSteps(
        requestId,
        user.propertyIds,
        user.isSystemAdmin,
      );
      res.json({ success: true, data: updated });
    } catch (err: unknown) {
      console.error("ROUTE ERROR:", err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  },
);

// POST /api/hosting-requests/:id/reback - Reback request
router.post(
  "/hosting-requests/:id/reback",
  requirePermission("hosting_requests", "edit"),
  validate({ params: RequestRefParams }),
  async (req, res): Promise<void> => {
    const user = su(req);
    try {
      const requestId = await resolveRequestId(String(req.params.id));
      if (!requestId) {
        res.status(404).json({ success: false, message: "Request not found" });
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

        const lockRes = await client.query(
          "SELECT id, status, current_step_order, property_id FROM public.hosting_requests WHERE id = $1 FOR UPDATE",
          [requestId],
        );
        if (lockRes.rows.length === 0) {
          await client.query("ROLLBACK");
          res
            .status(404)
            .json({ success: false, message: "Request not found" });
          return;
        }
        if (
          !canAccessProperty(
            lockRes.rows[0].property_id,
            user.propertyIds,
            user.isSystemAdmin,
          )
        ) {
          await client.query("ROLLBACK");
          res
            .status(403)
            .json({ success: false, message: "Cross-tenant access denied" });
          return;
        }

        request = lockRes.rows[0];

        if (request.status !== "in_signing") {
          await client.query("ROLLBACK");
          res.status(400).json({
            success: false,
            message: "Request is not in signing status",
          });
          return;
        }

        stepOrder = request.current_step_order;

        const stepRes = await client.query(
          "SELECT id, role_required FROM public.hosting_request_approval_steps WHERE request_id = $1 AND step_order = $2",
          [requestId, stepOrder],
        );
        if (stepRes.rows.length === 0) {
          await client.query("ROLLBACK");
          res.status(400).json({
            success: false,
            message: "Current approval step not found",
          });
          return;
        }

        requiredRole = stepRes.rows[0].role_required;
        const hasRole = userMatchesApprovalRole(user, requiredRole);
        if (!hasRole) {
          await client.query("ROLLBACK");
          res.status(403).json({
            success: false,
            message: `Only ${requiredRole} can reback this request`,
          });
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

      const updated = await getRequestWithSteps(
        requestId,
        user.propertyIds,
        user.isSystemAdmin,
      );
      res.json({ success: true, data: updated });
    } catch (err: unknown) {
      console.error("ROUTE ERROR:", err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  },
);

export default router;
