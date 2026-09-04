import { Router } from "express";
import {
  db,
  withTenant,
  evaluationsTable,
  activityRegistrationsTable,
  surveyItemsTable,
  surveyItemResponsesTable,
} from "@workspace/db";
import {
  profilesTable,
  assignmentsTable,
  roomsTable,
  buildingsTable,
  floorsTable,
  maintenanceTable,
  propertiesTable,
  settingsTable,
  portalDocumentsTable,
  portalContactsTable,
  activitiesTable,
} from "@workspace/db";
import {
  eq,
  and,
  desc,
  sql,
  inArray,
  or,
  isNull,
  gte,
  isNotNull,
} from "drizzle-orm";
import {
  getActivityStatuses,
  getPortalCategories,
} from "../lib/portal-catalog.js";
import { z } from "zod";
import { requirePortalAuth, portalSession } from "./portal-auth.js";
import { broadcastToProperty } from "../lib/websocket.js";
import { logActivity } from "../lib/activity-logger.js";

const router: Router = Router();

router.use(requirePortalAuth);

router.get("/profile", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  const result = await withTenant(sess.propertyId, async (tenantDb) => {
    const [profile] = await tenantDb
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, sess.profileDbId))
      .limit(1);
    if (!profile) return null;
    return {
      id: profile.id,
      name: `${profile.firstName} ${profile.lastName}`,
      profileId: profile.profileId,
      department: profile.department,
      position: profile.jobTitle,
      photo: profile.photoUrl,
    };
  });
  res.json(result || {});
});

router.get("/room", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
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
    if (!assignment) return null;
    const [room] = await tenantDb
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, assignment.roomId))
      .limit(1);
    if (!room) return null;
    const [building] = await tenantDb
      .select()
      .from(buildingsTable)
      .where(eq(buildingsTable.id, room.buildingId))
      .limit(1);
    const [floor] = await tenantDb
      .select()
      .from(floorsTable)
      .where(eq(floorsTable.id, room.floorId))
      .limit(1);
    const roommates = await tenantDb
      .select()
      .from(assignmentsTable)
      .leftJoin(
        profilesTable,
        eq(assignmentsTable.profileId, profilesTable.id),
      )
      .where(
        and(
          eq(assignmentsTable.roomId, room.id),
          eq(assignmentsTable.status, "ACTIVE"),
          sql`${assignmentsTable.profileId} != ${sess.profileDbId}`,
        ),
      );
    return {
      roomNumber: room.roomNumber,
      building: building?.name,
      floor: floor?.floorNumber,
      assignedSince: assignment.checkInDate,
      roommates: roommates
        .map((r) =>
          r.profiles
            ? {
                id: r.profiles.id,
                name: `${r.profiles.firstName} ${r.profiles.lastName}`,
              }
            : null,
        )
        .filter(Boolean),
    };
  });
  res.json(result || {});
});

router.get("/notifications", async (req, res): Promise<void> => {
  res.json({ items: [], unreadCount: 0 }); // Placeholder until notification table logic is mapped
});

router.get("/alerts", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  const result = await withTenant(sess.propertyId, async (tenantDb) => {
    const maintenance = await tenantDb
      .select()
      .from(maintenanceTable)
      .where(
        and(
          eq(maintenanceTable.reportedBy, String(sess.profileDbId)),
          inArray(maintenanceTable.status, ["open", "in_progress"]),
        ),
      );
    return {
      items: maintenance.map((m) => ({
        id: m.id,
        title: m.problemType || m.description || "Maintenance",
        status: m.status,
        type: "maintenance",
      })),
    };
  });
  res.json(result || { items: [] });
});

router.get("/my-profile", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

  const [profile] = await withTenant(sess.propertyId, async (tenantDb) => {
    return await tenantDb
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, sess.profileDbId))
      .limit(1);
  });

  if (!profile) {
    res.status(404).json({ success: false, message: "Profile not found" });
    return;
  }

  res.json({
    success: true,
    profile: {
      profileId: profile.profileId,
      fullName: `${profile.firstName} ${profile.lastName}`,
      firstName: profile.firstName,
      lastName: profile.lastName,
      jobTitle: profile.jobTitle,
      department: profile.department,
      nationality: profile.nationality,
      phone: profile.phone,
      gender: profile.gender,
      hireDate: profile.hireDate,
      status: profile.status,
      address: profile.address,
      photoUrl: profile.photoUrl ?? null,
      email: profile.email ?? null,
      emergencyContact: profile.emergencyContact ?? null,
    },
  });
});

router.patch("/my-profile", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  const { phone, address, photo, email, emergencyContact } = req.body;

  const updateData: Record<string, any> = {};
  if (phone !== undefined) updateData.phone = phone;
  if (address !== undefined) updateData.address = address;
  if (photo !== undefined) updateData.photoUrl = photo;
  if (email !== undefined) updateData.email = email;
  if (emergencyContact !== undefined)
    updateData.emergencyContact = emergencyContact;

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ success: false, message: "No fields to update" });
    return;
  }

  const [updated] = await withTenant(sess.propertyId, async (tenantDb) => {
    return await tenantDb
      .update(profilesTable)
      .set(updateData)
      .where(eq(profilesTable.id, sess.profileDbId))
      .returning();
  });

  if (!updated) {
    res.status(404).json({ success: false, message: "Profile not found" });
    return;
  }

  const details = Object.entries(updateData)
    .map(([k, v]) => `${k}: ${k === "photoUrl" ? "(image)" : v}`)
    .join(" | ");

  await logActivity({
    req,
    propertyId: sess.propertyId,
    username: sess.fullName,
    userRole: "profile",
    action: `تحديث البيانات الشخصية من البوابة`,
    actionType: "UPDATE",
    module: "profiles",
    entityType: "profile",
    entityId: updated.id,
    details,
  });

  res.json({
    success: true,
    message: "Profile updated successfully",
    profile: {
      phone: updated.phone,
      address: updated.address,
      photoUrl: updated.photoUrl,
    },
  });
});

router.get("/my-room", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

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

    if (!assignment) return { assigned: false };

    const [room] = await tenantDb
      .select()
      .from(roomsTable)
      .where(eq(roomsTable.id, assignment.roomId))
      .limit(1);
    if (!room) return { assigned: false };

    const [building, floor, property] = await Promise.all([
      tenantDb
        .select()
        .from(buildingsTable)
        .where(eq(buildingsTable.id, room.buildingId))
        .limit(1)
        .then((r) => r[0] ?? null),
      tenantDb
        .select()
        .from(floorsTable)
        .where(eq(floorsTable.id, room.floorId))
        .limit(1)
        .then((r) => r[0] ?? null),
      tenantDb
        .select()
        .from(propertiesTable)
        .where(eq(propertiesTable.id, sess.propertyId))
        .limit(1)
        .then((r) => r[0] ?? null),
    ]);

    const roomAssignments = await tenantDb
      .select()
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.roomId, room.id),
          eq(assignmentsTable.status, "ACTIVE"),
        ),
      );

    const roommates = roomAssignments.filter(
      (a) => a.profileId !== sess.profileDbId,
    ).length;
    const currentOccupancy = roomAssignments.length;

    return {
      assigned: true,
      assignment,
      room,
      building,
      floor,
      property,
      roommates,
      currentOccupancy,
    };
  });

  if (!result.assigned) {
    res.json({ success: true, assigned: false, room: null });
    return;
  }

  const {
    assignment,
    room,
    building,
    floor,
    property,
    roommates,
    currentOccupancy,
  } = result as any;

  res.json({
    success: true,
    assigned: true,
    room: {
      checkInDate: assignment.checkInDate,
      expectedCheckOutDate: assignment.expectedCheckOutDate,
      bedNumber: assignment.bedNumber,

      roomId: room.id,
      roomNumber: room.roomNumber,
      roomType: room.roomType,
      capacity: room.capacity,
      currentOccupancy,
      gender: room.gender,
      status: room.status,
      roommates,

      floor: floor
        ? {
            id: floor.id,
            floorNumber: floor.floorNumber,
            description: floor.description ?? "",
          }
        : null,
      building: building
        ? {
            id: building.id,
            name: building.name,
            location: building.location ?? "",
          }
        : null,
      property: property ? { id: property.id, name: property.name } : null,
    },
  });
});

router.get("/roommates", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

  try {
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

      if (!assignment) return { roommates: [] };

      const roomAssignments = await tenantDb
        .select()
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.roomId, assignment.roomId),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        );

      const roommateIds = roomAssignments
        .filter((a) => a.profileId !== sess.profileDbId)
        .map((a) => a.profileId)
        .filter(Boolean);

      if (roommateIds.length === 0) return { roommates: [] };
      // Basic debug logging to help trace portal roommate fetches
      console.debug(
        "[portal-data]/roommates: propertyId=",
        sess.propertyId,
        "profileDbId=",
        sess.profileDbId,
        "roommateCount=",
        roommateIds.length,
      );

      const profiles = await tenantDb
        .select()
        .from(profilesTable)
        .where(inArray(profilesTable.id, roommateIds));

      return {
        roommates: profiles.map((profile: any) => ({
          id: profile.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          profileCode: profile.profileId,
          email: profile.email,
          phone: profile.phone ?? null,
          department: profile.department ?? "",
          jobTitle: profile.jobTitle ?? null,
          photoUrl: profile.photoUrl ?? null,
        })),
      };
    });

    // Log activity for auditing (only when session present and endpoint executed)
    try {
      await logActivity({
        req,
        propertyId: sess.propertyId,
        username: sess.fullName,
        userRole: "profile",
        action: `جلب رفقاء الغرفة`,
        actionType: "READ",
        module: "profiles",
        entityType: "room",
        entityId: (result as any)?.roomId ?? null,
        details: `roommateCount=${(result.roommates || []).length}`,
      });
    } catch (e) {
      console.warn("Failed to log portal roommates activity:", e);
    }

    res.json({ success: true, roommates: result.roommates ?? [] });
  } catch (err) {
    console.error("/roommates error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get("/my-maintenance", async (req, res): Promise<void> => {
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

    if (!assignment) return [];

    const conditions = [eq(maintenanceTable.roomId, assignment.roomId)];
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
    })),
  });
});

const CreateMaintenanceSchema = z.object({
  category: z
    .enum(["maintenance", "housekeeping", "complaint"])
    .default("maintenance"),
  problemType: z.string().min(1, "Problem type is required"),
  description: z
    .string()
    .min(5, "Please describe the issue (min 5 characters)"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  photoUrl: z.string().optional(),
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

// ─── Portal Contacts (Multi-contact list) ──────────────────────
router.get("/my-contacts", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

  const contacts = await withTenant(sess.propertyId, async (tenantDb) => {
    return await tenantDb
      .select()
      .from(portalContactsTable)
      .orderBy(portalContactsTable.createdAt);
  });

  // Fallback to settings-based single contact if none configured
  if (contacts.length === 0) {
    const settings = await withTenant(sess.propertyId, async (tenantDb) => {
      const [s] = await tenantDb.select().from(settingsTable).limit(1);
      return s;
    });
    if (settings?.portalContactEmail || settings?.portalContactPhone) {
      res.json({
        success: true,
        contacts: [
          {
            id: 0,
            nameAr: "الموارد البشرية",
            nameEn: "HR",
            roleAr: "موارد بشرية",
            roleEn: "Human Resources",
            email: settings.portalContactEmail ?? null,
            phone: settings.portalContactPhone ?? null,
            extension: settings.portalContactExt ?? null,
          },
        ],
      });
      return;
    }
  }

  res.json({ success: true, contacts });
});

// ─── Portal Contacts (from property settings) — legacy kept for compatibility
router.get("/contacts", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

  const settings = await withTenant(sess.propertyId, async (tenantDb) => {
    const [s] = await tenantDb.select().from(settingsTable).limit(1);
    return s;
  });

  res.json({
    success: true,
    email: settings?.portalContactEmail ?? "hr@sunrise-housing.com",
    phone: settings?.portalContactPhone ?? "",
    extension: settings?.portalContactExt ?? "#4055",
  });
});

// ─── Portal Documents ──────────────────────────
router.get("/documents", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

  const documents = await withTenant(sess.propertyId, async (tenantDb) => {
    return await tenantDb
      .select()
      .from(portalDocumentsTable)
      .orderBy(desc(portalDocumentsTable.createdAt));
  });

  res.json({
    success: true,
    documents: documents.map((d) => ({
      id: d.id,
      titleAr: d.titleAr,
      titleEn: d.titleEn,
      fileName: d.fileName,
      fileType: d.fileType,
      fileData: d.fileData,
      category: d.category,
      createdAt:
        d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    })),
  });
});

// ─── Portal catalog (categories + activity statuses) ─────────
router.get("/catalog", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  res.json({
    success: true,
    activityCategories: getPortalCategories(sess.propertyId, "activities"),
    evaluationCategories: getPortalCategories(sess.propertyId, "evaluations"),
    activityStatuses: getActivityStatuses(),
  });
});

// ─── Portal Activities ──────────────────────────
router.get("/my-activities", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;

  const result = await withTenant(sess.propertyId, async (tenantDb) => {
    const activities = await tenantDb
      .select()
      .from(activitiesTable)
      .where(
        or(
          isNull(activitiesTable.expiresAt),
          gte(activitiesTable.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(activitiesTable.createdAt));

    let registrations: { activityId: number; status: string }[] = [];
    try {
      const regRows = await tenantDb
        .select()
        .from(activityRegistrationsTable)
        .where(eq(activityRegistrationsTable.profileId, sess.profileDbId));
      registrations = regRows.map((r) => ({
        activityId: r.activityId,
        status: r.status,
      }));
    } catch {
      registrations = [];
    }

    return { activities, registrations };
  });

  const regMap = Object.fromEntries(
    result.registrations.map((r) => [r.activityId, r.status]),
  );

  res.json({
    success: true,
    activities: result.activities.map((a: any) => ({
      ...a,
      startDate: (a.startDate instanceof Date
        ? a.startDate.toISOString()
        : a.startDate) as string,
      endDate: (a.endDate instanceof Date
        ? a.endDate.toISOString()
        : a.endDate) as string,
      createdAt: (a.createdAt instanceof Date
        ? a.createdAt.toISOString()
        : a.createdAt) as string,
      registrationStatus: regMap[a.id] ?? null,
    })),
  });
});

// ─── Portal Evaluations ──────────────────────────────────────
// Profiles see evaluations that are: no department set, or match their department
router.get("/my-evaluations", async (req, res): Promise<void> => {
  try {
    const sess = portalSession(req)!;
    if (!sess) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    const [profile] = await withTenant(sess.propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, sess.profileDbId))
        .limit(1);
    });

    const profileDept = profile?.department || null;

    const rows = await withTenant(sess.propertyId, async (tenantDb) => {
      const templates = await tenantDb
        .select()
        .from(evaluationsTable)
        .where(
          and(
            isNull(evaluationsTable.surveyTemplateId),
            or(
              isNull(evaluationsTable.department),
              eq(evaluationsTable.department, ""),
              profileDept
                ? eq(evaluationsTable.department, profileDept)
                : sql`false`,
            ),
            or(
              isNull(evaluationsTable.expiresAt),
              gte(evaluationsTable.expiresAt, new Date()),
            ),
          ),
        )
        .orderBy(desc(evaluationsTable.createdAt));

      const templateIds = templates.map((t) => t.id);

      // Fetch items for each template
      const allItems =
        templateIds.length > 0
          ? await tenantDb
              .select()
              .from(surveyItemsTable)
              .where(inArray(surveyItemsTable.templateId, templateIds))
          : [];
      const itemsByTemplate: Record<number, any[]> = {};
      for (const item of allItems) {
        if (!itemsByTemplate[item.templateId])
          itemsByTemplate[item.templateId] = [];
        itemsByTemplate[item.templateId].push(item);
      }

      // Check if profile has responded via survey_item_responses
      const respondedTemplateIds: Set<number> = new Set();
      if (templateIds.length > 0) {
        const myResponses = await tenantDb
          .select({
            templateId: surveyItemResponsesTable.templateId,
          })
          .from(surveyItemResponsesTable)
          .where(
            and(
              eq(surveyItemResponsesTable.profileId, sess.profileDbId),
              inArray(surveyItemResponsesTable.templateId, templateIds),
            ),
          )
          .groupBy(surveyItemResponsesTable.templateId);
        for (const r of myResponses) respondedTemplateIds.add(r.templateId);
      }

      // Also check old-style responses (profileRating in evaluations table)
      const oldResponses = await tenantDb
        .select()
        .from(evaluationsTable)
        .where(
          and(
            isNotNull(evaluationsTable.surveyTemplateId),
            eq(evaluationsTable.profileId, sess.profileDbId),
          ),
        );
      const oldResponseByTemplate = Object.fromEntries(
        oldResponses.map((r) => [r.surveyTemplateId!, r]),
      );

      return templates.map((template) => {
        const hasItemResponses = respondedTemplateIds.has(template.id);
        const oldResp = oldResponseByTemplate[template.id];
        const _hasResponded =
          hasItemResponses ||
          Boolean(
            oldResp?.profileRating != null ||
            (oldResp?.profileResponse &&
              String(oldResp.profileResponse).trim()),
          );
        return {
          ...template,
          items: itemsByTemplate[template.id] || [],
          profileRating: oldResp?.profileRating ?? template.profileRating,
          profileResponse:
            oldResp?.profileResponse ?? template.profileResponse,
          _hasResponded,
          _responseId: oldResp?.id ?? null,
        };
      });
    });

    res.json(
      rows.map((r) => ({
        ...r,
        submittedAt:
          r.submittedAt instanceof Date
            ? r.submittedAt.toISOString()
            : r.submittedAt,
        createdAt:
          r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      })),
    );
  } catch (err) {
    console.error("GET /my-evaluations error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch evaluations" });
  }
});

// Profile submits multi-item responses to an evaluation
router.post("/my-evaluations/:id/respond", async (req, res): Promise<void> => {
  try {
    const sess = portalSession(req)!;
    if (!sess) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }
    const evaluationId = Number(req.params.id);
    const { profileRating, profileResponse, itemResponses } = req.body as {
      profileRating?: number;
      profileResponse?: string;
      itemResponses?: Array<{
        itemId: number;
        ratingValue?: number;
        textValue?: string;
      }>;
    };

    if (!evaluationId) {
      res
        .status(400)
        .json({ success: false, message: "Evaluation ID required" });
      return;
    }

    const [template] = await withTenant(sess.propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(evaluationsTable)
        .where(
          and(
            eq(evaluationsTable.id, evaluationId),
            isNull(evaluationsTable.surveyTemplateId),
          ),
        );
    });

    if (!template) {
      res.status(404).json({ success: false, message: "Evaluation not found" });
      return;
    }

    // Save multi-item responses if provided
    if (itemResponses && itemResponses.length > 0) {
      await withTenant(sess.propertyId, async (tenantDb) => {
        // Delete existing responses for this profile+template
        await tenantDb
          .delete(surveyItemResponsesTable)
          .where(
            and(
              eq(surveyItemResponsesTable.templateId, evaluationId),
              eq(surveyItemResponsesTable.profileId, sess.profileDbId),
            ),
          );

        // Insert new responses
        const values = itemResponses.map((ir) => ({
          templateId: evaluationId,
          profileId: sess.profileDbId,
          itemId: ir.itemId,
          ratingValue: ir.ratingValue ?? null,
          textValue: ir.textValue ?? null,
        }));
        await tenantDb.insert(surveyItemResponsesTable).values(values);
      });
    }

    // Also save old-style rating/response if provided (backward compat)
    const updateData: Record<string, unknown> = {};
    if (profileRating !== undefined) {
      const r = Number(profileRating);
      if (!isNaN(r) && r >= 1 && r <= 5) {
        updateData.profileRating = r;
      }
    }
    if (
      profileResponse &&
      typeof profileResponse === "string" &&
      profileResponse.trim()
    ) {
      updateData.profileResponse = profileResponse.trim();
    }

    if (
      Object.keys(updateData).length > 0 ||
      (itemResponses && itemResponses.length > 0)
    ) {
      await withTenant(sess.propertyId, async (tenantDb) => {
        const [existing] = await tenantDb
          .select()
          .from(evaluationsTable)
          .where(
            and(
              eq(evaluationsTable.surveyTemplateId, evaluationId),
              eq(evaluationsTable.profileId, sess.profileDbId),
            ),
          );

        if (existing && Object.keys(updateData).length > 0) {
          await tenantDb
            .update(evaluationsTable)
            .set(updateData)
            .where(eq(evaluationsTable.id, existing.id));
        } else if (!existing && Object.keys(updateData).length > 0) {
          await tenantDb.insert(evaluationsTable).values({
            surveyTemplateId: evaluationId,
            profileId: sess.profileDbId,
            category: template.category,
            titleAr: template.titleAr,
            titleEn: template.titleEn,
            descriptionAr: template.descriptionAr,
            descriptionEn: template.descriptionEn,
            department: template.department,
            expiresAt: template.expiresAt,
            ...updateData,
          } as any);
        }
      });
    }

    await logActivity({
      req,
      propertyId: sess.propertyId,
      username: sess.fullName,
      userRole: "profile",
      action: `تقييم موظف: ${template.titleAr || template.titleEn || template.category}`,
      actionType: "UPDATE",
      module: "evaluations",
      entityType: "evaluation",
      entityId: evaluationId,
    });

    res.json({ success: true, message: "Evaluation response saved" });
  } catch (err) {
    console.error("POST /my-evaluations/:id/respond error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to submit evaluation response",
    });
  }
});

// ─── POST /portal-data/activity-registration ──────────────────
router.post("/activity-registration", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  if (!sess) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }

  const { activityId, status, badgeNumber } = req.body as {
    activityId: number;
    status: string;
    badgeNumber?: string;
  };
  if (!activityId || !status) {
    res
      .status(400)
      .json({ success: false, message: "activityId and status required" });
    return;
  }

  try {
    await withTenant(sess.propertyId, async (tenantDb) => {
      const [existing] = await tenantDb
        .select()
        .from(activityRegistrationsTable)
        .where(
          sql`profile_id = ${sess.profileDbId} AND activity_id = ${activityId}`,
        )
        .limit(1);

      if (existing) {
        await tenantDb
          .update(activityRegistrationsTable)
          .set({ status, badgeNumber: badgeNumber || existing.badgeNumber })
          .where(sql`id = ${existing.id}`);
      } else {
        await tenantDb.insert(activityRegistrationsTable).values({
          profileId: sess.profileDbId,
          activityId,
          badgeNumber: badgeNumber || null,
          status,
        });
      }
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: "Registration failed" });
  }
});

// ─── DELETE /portal-data/activity-registration ──────────────────
// Profile cancels their own registration
router.delete("/activity-registration", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  if (!sess) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }

  const { activityId } = req.body as { activityId: number };
  if (!activityId) {
    res.status(400).json({ success: false, message: "activityId required" });
    return;
  }

  try {
    await withTenant(sess.propertyId, async (tenantDb) => {
      await tenantDb
        .delete(activityRegistrationsTable)
        .where(
          sql`profile_id = ${sess.profileDbId} AND activity_id = ${activityId}`,
        );
    });

    res.json({ success: true });
  } catch (err: any) {
    res
      .status(500)
      .json({ success: false, message: "Failed to cancel registration" });
  }
});

// ─── POST /portal-data/activity-attendance ──────────────────
// Admin marks attendance for a registration
router.post("/activity-attendance", async (req, res): Promise<void> => {
  const sess = portalSession(req)!;
  if (!sess) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }

  const { registrationId, attended } = req.body as {
    registrationId: number;
    attended: boolean;
  };
  if (!registrationId) {
    res
      .status(400)
      .json({ success: false, message: "registrationId required" });
    return;
  }

  try {
    await withTenant(sess.propertyId, async (tenantDb) => {
      await tenantDb
        .update(activityRegistrationsTable)
        .set({
          attended,
          attendedAt: attended ? new Date() : null,
        })
        .where(sql`id = ${registrationId}`);
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Attendance update failed:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update attendance" });
  }
});

export default router;
