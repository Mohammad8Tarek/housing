import { Router } from "express";
import { withTenant, activityRegistrationsTable } from "@workspace/db";
import { profilesTable, activitiesTable } from "@workspace/db";
import { eq, ne, and, desc, sql } from "drizzle-orm";
import { portalSession } from "../portal-auth/shared.js";

const router: Router = Router();

// ─── Portal Activities ──────────────────────────
router.get("/my-activities", async (req, res): Promise<void> => {
  const sess = portalSession(req);
  if (!sess) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const result = await withTenant(sess.propertyId, async (tenantDb) => {
    // Fetch profile's department for targeting filter
    let employeeDept: string | null = null;
    try {
      const [prof] = await tenantDb
        .select({ department: profilesTable.department })
        .from(profilesTable)
        .where(eq(profilesTable.id, sess.profileDbId))
        .limit(1);
      employeeDept = prof?.department ?? null;
    } catch {}

    const allActivities = await tenantDb
      .select()
      .from(activitiesTable)
      .where(
        and(
          eq(activitiesTable.isPublished, true),
          ne(activitiesTable.status, "cancelled"),
        ),
      )
      .orderBy(desc(activitiesTable.startDate), desc(activitiesTable.createdAt));

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const activities = allActivities.filter((act) => {
      // Expiry logic: if expiresAt is set and in the past, only skip if start and end dates are also in past
      if (act.expiresAt && new Date(act.expiresAt) < now) {
        const startStr = String(act.startDate);
        const endStr = act.endDate ? String(act.endDate) : startStr;
        if (endStr < todayStr) return false;
      }

      // Target departments filter
      if (
        act.targetDepartments &&
        Array.isArray(act.targetDepartments) &&
        act.targetDepartments.length > 0
      ) {
        if (!employeeDept || !act.targetDepartments.includes(employeeDept)) {
          return false;
        }
      }

      return true;
    });

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
