import { Router } from "express";
import { pool } from "@workspace/db";
import { logActivity } from "../../lib/activity-logger.js";
import { broadcastToProperty } from "../../lib/websocket.js";
import { requirePermission } from "../../middlewares/permissions.js";
import {
  getPropertySignaturePolicy,
  CreateFamilyVisitBody,
  su,
  ensureProfileInTargetSchema,
  resolveRequestId,
  canAccessProperty,
  generateRequestNumber,
  getRequestWithSteps,
} from "./shared.js";
import { validate } from "../../middlewares/validate.js";
import { RequestRefParams } from "../../validation/schemas.js";

const router: Router = Router();

// POST /api/hosting-requests — Create
router.post(
  "/hosting-requests",
  requirePermission("hosting_requests", "create"),
  async (req, res): Promise<void> => {
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

      // Look up profile in tenant schema to get real name, clock number, dept & position
      const propId = body.hotelId || user.propertyId;
      const requestedClock = body.clockNumber || requester.username;
      let profileName = requestedClock;
      let clockNumber = requestedClock;
      // Always start from requester's dept/position, override with profile data if found
      let profileDepartment = requester.department ?? "";
      let profilePosition = requester.job_title ?? "";
      try {
        const propRes = await pool.query(
          "SELECT schema_name FROM public.properties WHERE id = $1",
          [propId],
        );
        if (propRes.rows.length > 0) {
          const schemaName = propRes.rows[0].schema_name || `prop_${propId}`;
          if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName)) {
            const empRes = await pool.query(
              `SELECT first_name, last_name, profile_id, department, job_title FROM "${schemaName}".profiles WHERE profile_id = $1 LIMIT 1`,
              [requestedClock],
            );
            if (empRes.rows.length > 0) {
              const emp = empRes.rows[0];
              profileName = `${emp.first_name} ${emp.last_name}`;
              clockNumber = emp.profile_id;
              // Always use the looked-up profile's dept & position (not just when different from requester)
              if (emp.department) profileDepartment = emp.department;
              if (emp.job_title) profilePosition = emp.job_title;
            }
          }
        }
      } catch {
        // If lookup fails, fall back to requester's info
      }

      // ── Duplicate Detection ────────────────────────────────────────────────
      // Reject if this profile already has an active (in_signing or approved)
      // hosting request whose date range overlaps with the new request's dates.
      const duplicateRes = await pool.query(
        `SELECT id, request_number
           FROM public.hosting_requests
          WHERE clock_number = $1
            AND property_id  = $2
            AND status IN ('in_signing', 'approved')
            AND from_date <= $3
            AND to_date   >= $4
          LIMIT 1`,
        [clockNumber, user.propertyId, body.toDate, body.fromDate],
      );
      if (duplicateRes.rows.length > 0) {
        const dup = duplicateRes.rows[0];
        res.status(409).json({
          success: false,
          message: `يوجد طلب استضافة مكرر للموظف في نفس الفترة الزمنية (طلب رقم ${dup.request_number}) / A duplicate hosting request already exists for this profile in the same date range (Request ${dup.request_number})`,
        });
        return;
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
           requester_user_id, profile_name, clock_number, department, position,
           number_of_rooms, assigned_room_id, family_members_count, family_members_included,
           from_date, to_date, consumed_days, remarks, attachment_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING id, request_number`,
          [
            requestNumber,
            user.propertyId,
            body.hotelId ?? null,
            body.visitHotelId ?? null,
            user.userId,
            profileName,
            clockNumber,
            profileDepartment,
            profilePosition,
            body.numberOfRooms,
            body.assignedRoomId ?? null,
            body.familyMembersCount,
            body.familyMembersIncluded ?? null,
            body.fromDate,
            body.toDate,
            body.consumedDays,
            body.remarks ?? null,
            body.attachmentData ?? null,
          ],
        );
        requestId = result.rows[0].id;
        await client.query("COMMIT");
        client.release();
      } catch (err: any) {
        await client.query("ROLLBACK").catch(() => {});
        client.release();
        if (
          err.code === "23505" &&
          err.constraint === "hosting_requests_request_number_key"
        ) {
          res.status(409).json({
            success: false,
            message:
              "رقم الطلب مكرر، يرجى المحاولة مرة أخرى / Duplicate request number, please try again",
          });
          return;
        }
        throw err;
      }

      // Create approval steps based on the property's configured signature policy
      const targetHotelId = body.hotelId || user.propertyId;
      const signaturePolicy = await getPropertySignaturePolicy(targetHotelId);

      for (let i = 0; i < signaturePolicy.length; i++) {
        const item = signaturePolicy[i];
        const stepOrder = item.stepOrder || i + 1;
        await pool.query(
          `INSERT INTO public.hosting_request_approval_steps
          (request_id, step_order, role_required, label_ar, label_en, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
          [
            requestId,
            stepOrder,
            item.roleRequired,
            item.labelAr || null,
            item.labelEn || null,
          ],
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

      // Notify the first-step approver
      const firstStepItem = signaturePolicy[0];
      const firstRole = firstStepItem?.roleRequired || "housing_manager";
      const firstRoleLabel = firstStepItem?.labelAr || firstRole;
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
            message: `Request ${requestNumber} is waiting for your approval as ${firstStepItem?.labelEn || firstRole}.`,
            titleAr: "طلب زيارة عائلية جديد",
            messageAr: `الطلب ${requestNumber} ينتظر موافقتك كـ ${firstRoleLabel}.`,
            entityId: requestId,
            targetUserId: row.id,
          },
        });
      }

      const created = await getRequestWithSteps(
        requestId,
        user.propertyIds,
        user.isSystemAdmin,
      );
      res.status(201).json({ success: true, data: created });
    } catch (err: unknown) {
      console.error("ROUTE ERROR:", err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  },
);

// POST /api/hosting-requests/:id/create-guest-hosting — إنشاء طلب استضافة من زيارة عائلية
router.post(
  "/hosting-requests/:id/create-guest-hosting",
  requirePermission("hosting_requests", "create"),
  validate({ params: RequestRefParams }),
  async (req, res): Promise<void> => {
    const user = su(req);
    try {
      const requestId = await resolveRequestId(String(req.params.id));
      if (!requestId) {
        res.status(404).json({ success: false, message: "Request not found" });
        return;
      }

      if (!user.propertyId) {
        res
          .status(400)
          .json({ success: false, message: "No property selected" });
        return;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // 1. Lock family visit request row (with property scoping)
        const lockRes = await client.query(
          `SELECT id, status, guest_hosting_id, profile_name, clock_number,
                family_members_count, from_date, to_date, remarks, property_id, assigned_room_id
         FROM public.hosting_requests
         WHERE id = $1 AND property_id = ANY($2::int[]) FOR UPDATE`,
          [requestId, user.propertyIds],
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

        const visit = lockRes.rows[0];

        if (visit.status !== "approved") {
          await client.query("ROLLBACK");
          res.status(400).json({
            success: false,
            message:
              "يجب الموافقة على طلب الزيارة أولاً / Request must be approved first",
          });
          return;
        }

        if (visit.guest_hosting_id) {
          await client.query("ROLLBACK");
          res.status(409).json({
            success: false,
            message:
              "تم إنشاء طلب استضافة مسبقاً / Guest hosting already created",
          });
          return;
        }

        // 2. Resolve target schema and ensure profile exists there
        const targetPropId = visit.visit_hotel_id || visit.property_id;
        const profileCheck = await ensureProfileInTargetSchema(
          client,
          visit.property_id,
          targetPropId,
          visit.clock_number,
        );

        if (!profileCheck) {
          await client.query("ROLLBACK");
          res.status(404).json({
            success: false,
            message:
              "لم يتم العثور على الموظف في النظام لتسكينه / Profile not found in housing system to accommodate",
          });
          return;
        }

        const { profileId, targetSchema: schemaName } = profileCheck;

        // 3. Set search_path to tenant schema
        await client.query(
          "SET LOCAL search_path TO " + schemaName + ", public",
        );

        // 4. Create hosting record
        const hostingRes = await client.query(
          `INSERT INTO "${schemaName}".hostings
         (profile_id, hosting_type, guests_count, expected_from, expected_to, notes, created_by, status, room_id)
         VALUES ($1, 'SEPARATE_ROOM', $2, $3, $4, $5, $6, 'APPROVED', $7)
         RETURNING id`,
          [
            profileId,
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
          action: `إنشاء طلب استضافة ضيوف للموظف #${visit.profile_name}`,
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
      console.error("ROUTE ERROR:", err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, message });
    }
  },
);

export default router;
