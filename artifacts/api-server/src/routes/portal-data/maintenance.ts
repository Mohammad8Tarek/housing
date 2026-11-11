import { Router } from "express";
import { withTenant } from "@workspace/db";
import { assignmentsTable, maintenanceTable } from "@workspace/db";
import { eq, and, desc, or } from "drizzle-orm";
import { portalSession } from "../portal-auth/shared.js";
import { broadcastToProperty } from "../../lib/websocket.js";
import { logActivity } from "../../lib/activity-logger.js";
import { CreateMaintenanceSchema, RateMaintenanceSchema } from "./shared.js";
import { validate } from "../../middlewares/validate.js";
import { CommonListQuery } from "../../validation/schemas.js";

const router: Router = Router();

router.get("/my-maintenance", validate({ query: CommonListQuery }),
  async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  const targetId = req.query.id ? parseInt(String(req.query.id)) : null;

  const requests = await withTenant(sess.propertyId, async (tenantDb) => {
    const [assignment] = await tenantDb
      .select()
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.profileId, sess.profileDbId),
          eq(assignmentsTable.status, "ACTIVE"),
        ),
      )
      .limit(1);

    const userFilters = [
      eq(maintenanceTable.reportedBy, sess.fullName),
      eq(maintenanceTable.reportedBy, String(sess.profileDbId)),
      eq(maintenanceTable.assignedTo, sess.profileDbId),
      eq(maintenanceTable.ratedByProfileId, sess.profileDbId),
    ];
    if (sess.profileId) {
      userFilters.push(eq(maintenanceTable.reportedBy, sess.profileId));
    }
    if (assignment?.roomId) {
      userFilters.push(eq(maintenanceTable.roomId, assignment.roomId));
    }

    const conditions = [or(...userFilters)];
    if (targetId && !isNaN(targetId)) {
      conditions.push(eq(maintenanceTable.id, targetId));
    }

    return await tenantDb
      .select()
      .from(maintenanceTable)
      .where(and(...conditions))
      .orderBy(desc(maintenanceTable.id));
  });

  res.json({
    success: true,
    requests: requests.map((r) => ({
      id: r.id,
      category: r.category,
      problemType: r.problemType,
      description: r.description,
      status: r.status,
      priority: r.priority,
      reportedAt:
        r.reportedAt instanceof Date
          ? r.reportedAt.toISOString()
          : r.reportedAt,
      resolvedAt:
        r.resolvedAt instanceof Date
          ? r.resolvedAt.toISOString()
          : (r.resolvedAt ?? null),
      notes: r.notes ?? null,
      assignedTo: r.assignedTo ?? null,
      photoUrl: r.photoUrl ?? null,
      rating: r.rating ?? null,
      ratingComment: r.ratingComment ?? null,
      ratedAt:
        r.ratedAt instanceof Date
          ? r.ratedAt.toISOString()
          : (r.ratedAt ?? null),
    })),
  });
});

router.post("/my-maintenance", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  const parsed = CreateMaintenanceSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: parsed.error.errors[0]?.message ?? "Invalid input",
    });
    return;
  }

  const result = await withTenant(sess.propertyId, async (tenantDb) => {
    const [assignment] = await tenantDb
      .select()
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.profileId, sess.profileDbId),
          eq(assignmentsTable.status, "ACTIVE"),
        ),
      )
      .limit(1);

    if (!assignment)
      return { error: "You must be assigned to a room to submit a request" };

    const [request] = await tenantDb
      .insert(maintenanceTable)
      .values({
        roomId: assignment.roomId,
        category: parsed.data.category,
        problemType: parsed.data.problemType,
        description: parsed.data.description,
        priority: parsed.data.priority,
        status: "open",
        reportedBy: sess.fullName,
        photoUrl: parsed.data.photoUrl ?? null,
      } as any)
      .returning();

    return { request };
  });

  if (result.error) {
    res.status(400).json({ success: false, message: result.error });
    return;
  }

  const request = result.request as any;

  broadcastToProperty(sess.propertyId, {
    module: "maintenance",
    action: "created",
    entityId: request.id,
    data: { source: "profile_portal", reportedBy: sess.fullName },
  });
  broadcastToProperty(sess.propertyId, { module: "dashboard", action: "sync" });

  // Log to activity log so admin can see it
  await logActivity({
    req,
    propertyId: sess.propertyId,
    username: sess.fullName,
    userRole: "profile",
    action: `طلب جديد من البوابة (${request.category}) - ${request.problemType}`,
    actionType: "CREATE",
    module: "profile_portal",
    entityType: "maintenance",
    entityId: request.id,
    details: `البلاغ: ${request.description} | الأولوية: ${request.priority}`,
  });

  res.status(201).json({
    success: true,
    message: "Maintenance request submitted successfully",
    request: {
      id: request.id,
      problemType: request.problemType,
      description: request.description,
      status: request.status,
      priority: request.priority,
      reportedAt:
        request.reportedAt instanceof Date
          ? request.reportedAt.toISOString()
          : request.reportedAt,
    },
  });
});

router.post("/rate-maintenance", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  const parsed = RateMaintenanceSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: parsed.error.errors[0]?.message ?? "Invalid rating input",
    });
    return;
  }

  const { maintenanceId, rating, ratingComment } = parsed.data;

  const result = await withTenant(sess.propertyId, async (tenantDb) => {
    // Check if the ticket exists
    const [ticket] = await tenantDb
      .select()
      .from(maintenanceTable)
      .where(eq(maintenanceTable.id, maintenanceId))
      .limit(1);

    if (!ticket) {
      return { error: "Ticket not found", status: 404 };
    }

    // Verify ticket status is resolved, closed, completed, or done
    const allowedStatuses = ["resolved", "closed", "completed", "done"];
    if (!allowedStatuses.includes((ticket.status || "").toLowerCase())) {
      return {
        error: "Cannot rate a ticket that is not yet completed or closed",
        status: 400,
      };
    }

    // Verify authorization: resident assigned to the room or ticket was reported/rated by resident
    const [assignment] = await tenantDb
      .select()
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.profileId, sess.profileDbId),
          eq(assignmentsTable.roomId, ticket.roomId),
        ),
      )
      .limit(1);

    const isAuthorized =
      assignment ||
      ticket.ratedByProfileId === sess.profileDbId ||
      ticket.reportedBy?.includes(sess.fullName) ||
      ticket.reportedBy?.includes(sess.profileId);

    if (!isAuthorized) {
      return {
        error: "You are not authorized to rate this request",
        status: 403,
      };
    }

    const [updated] = await tenantDb
      .update(maintenanceTable)
      .set({
        rating,
        ratingComment: ratingComment || null,
        ratedAt: new Date(),
        ratedByProfileId: sess.profileDbId,
      })
      .where(eq(maintenanceTable.id, maintenanceId))
      .returning();

    return { updated };
  });

  if ("error" in result && result.error) {
    res.status(result.status || 400).json({
      success: false,
      message: result.error,
    });
    return;
  }

  // WebSocket sync for dashboard & maintenance views
  broadcastToProperty(sess.propertyId, {
    module: "maintenance",
    action: "rate",
    data: { maintenanceId, rating, ratingComment },
  });
  broadcastToProperty(sess.propertyId, { module: "dashboard", action: "sync" });

  // Log activity
  await logActivity({
    req,
    propertyId: sess.propertyId,
    username: sess.fullName,
    userRole: "profile",
    action: `تقييم طلب صيانة #${maintenanceId} (${rating} نجوم)`,
    actionType: "UPDATE",
    module: "profile_portal",
    entityType: "maintenance",
    entityId: maintenanceId,
    details: `التقييم: ${rating} نجوم | التعليق: ${ratingComment || "لا يوجد تعليق"}`,
  });

  res.json({
    success: true,
    message: "Rating submitted successfully",
    rating: {
      maintenanceId,
      rating,
      ratingComment,
      ratedAt: result.updated?.ratedAt,
    },
  });
});

export default router;
