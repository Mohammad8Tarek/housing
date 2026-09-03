import { Router } from "express";
import {
  assignmentsTable,
  reservationsTable,
  hostingsTable,
  profilesTable,
  withTenant,
} from "@workspace/db";
import { eq, and, lte, gte, isNull, sql } from "drizzle-orm";
import { requirePermission, hasPermission } from "../middlewares/permissions.js";

const router: Router = Router();

// Helper: does the auth user have a specific permission?
function can(authUser: any, module: string, action: string): boolean {
  if (!authUser) return false;
  return hasPermission(authUser, module as any, action as any);
}

router.get(
  "/notifications",
  requirePermission("dashboard", "view"),
  async (req, res): Promise<void> => {
    const { propertyId } = req.query as Record<string, string>;
    const pid = propertyId ? parseInt(propertyId) : null;
    const authUser = (req as any).authUser;

    if (!pid) {
      res.json({ count: 0, notifications: [] });
      return;
    }

    // Permission flags — determine what this user is allowed to see
    const canViewAccommodation = can(authUser, "accommodation", "view");
    const canViewReservations  = can(authUser, "reservations", "view");
    const canViewMaintenance   = can(authUser, "maintenance", "view");
    const canViewHostingReqs   = can(authUser, "hosting_requests", "view");
    const isSystemAdmin        = authUser?.isSystemAdmin ?? false;
    const userRoles: string[]  = authUser?.roles ?? [];

    try {
      await withTenant(pid, async (tenantDb) => {
        const today          = new Date().toISOString().split("T")[0];
        const threeDaysLater = new Date(Date.now() + 3 * 86400000)
          .toISOString()
          .split("T")[0];

        const notifications: Array<{
          id: string;
          type: string;
          priority: "high" | "medium" | "low";
          title: string;
          titleAr: string;
          description: string;
          descriptionAr: string;
          entityId: number;
          entityType: string;
          createdAt: string;
        }> = [];

        const queries: Promise<any>[] = [];
        const queryLabels: string[]   = [];

        // 1. Overdue check-outs — accommodation.view required
        if (canViewAccommodation) {
          queries.push(
            tenantDb
              .select({
                id: assignmentsTable.id,
                expectedCheckOutDate: assignmentsTable.expectedCheckOutDate,
                empFirst: profilesTable.firstName,
                empLast: profilesTable.lastName,
              })
              .from(assignmentsTable)
              .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
              .where(
                and(
                  eq(assignmentsTable.status, "ACTIVE"),
                  lte(assignmentsTable.expectedCheckOutDate, today),
                ),
              ),
          );
          queryLabels.push("overdueAssignments");
        }

        // 2. Upcoming check-outs (within 3 days) — accommodation.view required
        if (canViewAccommodation) {
          queries.push(
            tenantDb
              .select({
                id: assignmentsTable.id,
                expectedCheckOutDate: assignmentsTable.expectedCheckOutDate,
                empFirst: profilesTable.firstName,
                empLast: profilesTable.lastName,
              })
              .from(assignmentsTable)
              .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
              .where(
                and(
                  eq(assignmentsTable.status, "ACTIVE"),
                  gte(assignmentsTable.expectedCheckOutDate, today),
                  lte(assignmentsTable.expectedCheckOutDate, threeDaysLater),
                ),
              ),
          );
          queryLabels.push("upcomingCheckouts");
        }

        // 3. Today reservations arriving — reservations.view required
        if (canViewReservations) {
          queries.push(
            tenantDb
              .select()
              .from(reservationsTable)
              .where(
                and(
                  eq(reservationsTable.status, "UPCOMING"),
                  lte(reservationsTable.checkInDate, today),
                ),
              ),
          );
          queryLabels.push("todayReservations");
        }

        // 4. Pending guest hostings — accommodation.view required
        if (canViewAccommodation) {
          queries.push(
            tenantDb
              .select({
                id: hostingsTable.id,
                guestsCount: hostingsTable.guestsCount,
                expectedFrom: hostingsTable.expectedFrom,
                empFirst: profilesTable.firstName,
                empLast: profilesTable.lastName,
              })
              .from(hostingsTable)
              .leftJoin(profilesTable, eq(hostingsTable.profileId, profilesTable.id))
              .where(eq(hostingsTable.status, "PENDING")),
          );
          queryLabels.push("pendingHostings");
        }

        // 5. Assignments missing checkout date — accommodation.view required
        if (canViewAccommodation) {
          queries.push(
            tenantDb
              .select({
                id: assignmentsTable.id,
                empFirst: profilesTable.firstName,
                empLast: profilesTable.lastName,
              })
              .from(assignmentsTable)
              .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
              .where(
                and(
                  eq(assignmentsTable.status, "ACTIVE"),
                  isNull(assignmentsTable.expectedCheckOutDate),
                ),
              ),
          );
          queryLabels.push("noDateAssignments");
        }

        // 6. Open/in-progress maintenance — maintenance.view required
        if (canViewMaintenance) {
          queries.push(
            tenantDb.execute(
              sql`SELECT id, description, status, priority FROM maintenance
                  WHERE status IN ('open', 'in_progress') LIMIT 20`,
            ),
          );
          queryLabels.push("openIssues");
        }

        // 7. Hosting requests waiting for MY approval
        //    - Requires hosting_requests.view
        //    - System admins see all; regular users only see steps matching their roles
        if (canViewHostingReqs && userRoles.length > 0) {
          const rolesArr = userRoles
            .map((r) => `'${r.replace(/'/g, "''")}'`)
            .join(",");
          queries.push(
            isSystemAdmin
              ? tenantDb.execute(
                  sql`SELECT f.id, f.profile_name, f.current_step_order, s.role_required
                      FROM hosting_requests f
                      JOIN hosting_request_approval_steps s
                        ON f.id = s.request_id AND f.current_step_order = s.step_order
                      WHERE f.status = 'in_signing'
                      LIMIT 20`,
                )
              : tenantDb.execute(
                  sql`SELECT f.id, f.profile_name, f.current_step_order, s.role_required
                      FROM hosting_requests f
                      JOIN hosting_request_approval_steps s
                        ON f.id = s.request_id AND f.current_step_order = s.step_order
                      WHERE f.status = 'in_signing'
                        AND s.role_required = ANY(ARRAY[${sql.raw(rolesArr)}]::text[])
                      LIMIT 20`,
                ),
          );
          queryLabels.push("pendingFamilyVisits");
        }

        // ── Execute all permitted queries in parallel ─────────────────────
        const results = await Promise.all(queries);
        const byLabel: Record<string, any> = {};
        queryLabels.forEach((label, i) => {
          byLabel[label] = results[i];
        });

        // ── Map to notification objects ───────────────────────────────────

        for (const row of (byLabel.pendingFamilyVisits as any)?.rows ?? []) {
          notifications.push({
            id: `hosting-requests-${row.id}`,
            type: "HOSTING_REQUEST_PENDING",
            priority: "high",
            title: `Pending Hosting Request Approval`,
            titleAr: `طلب استضافة في انتظار الاعتماد`,
            description: `Hosting request for ${row.profile_name} is waiting for ${row.role_required} approval`,
            descriptionAr: `طلب استضافة للموظف ${row.profile_name} بانتظار اعتماد ${row.role_required}`,
            entityId: row.id,
            entityType: "hosting_requests",
            createdAt: new Date().toISOString(),
          });
        }

        for (const a of byLabel.overdueAssignments ?? []) {
          notifications.push({
            id: `overdue-${a.id}`,
            type: "OVERDUE_CHECKOUT",
            priority: "high",
            title: `Overdue Checkout`,
            titleAr: `مغادرة متأخرة`,
            description: `${a.empFirst} ${a.empLast} was expected to checkout on ${a.expectedCheckOutDate}`,
            descriptionAr: `${a.empFirst} ${a.empLast} كان من المفترض مغادرته بتاريخ ${a.expectedCheckOutDate}`,
            entityId: a.id,
            entityType: "assignment",
            createdAt: new Date().toISOString(),
          });
        }

        for (const a of byLabel.upcomingCheckouts ?? []) {
          notifications.push({
            id: `upcoming-checkout-${a.id}`,
            type: "UPCOMING_CHECKOUT",
            priority: "medium",
            title: `Upcoming Checkout`,
            titleAr: `مغادرة قريبة`,
            description: `${a.empFirst} ${a.empLast} is expected to checkout on ${a.expectedCheckOutDate}`,
            descriptionAr: `${a.empFirst} ${a.empLast} من المقرر مغادرته بتاريخ ${a.expectedCheckOutDate}`,
            entityId: a.id,
            entityType: "assignment",
            createdAt: new Date().toISOString(),
          });
        }

        for (const r of byLabel.todayReservations ?? []) {
          notifications.push({
            id: `reservation-checkin-${r.id}`,
            type: "RESERVATION_CHECKIN",
            priority: "medium",
            title: `Guest Arriving Today`,
            titleAr: `وصول ضيف اليوم`,
            description: `${r.firstName} ${r.lastName} is expected to check in today`,
            descriptionAr: `${r.firstName} ${r.lastName} من المتوقع وصوله اليوم`,
            entityId: r.id,
            entityType: "reservation",
            createdAt: new Date().toISOString(),
          });
        }

        for (const h of byLabel.pendingHostings ?? []) {
          notifications.push({
            id: `pending-hosting-${h.id}`,
            type: "PENDING_HOSTING",
            priority: "low",
            title: `Pending Hosting Request`,
            titleAr: `طلب استضافة معلق`,
            description: `${h.empFirst} ${h.empLast} requested hosting for ${h.guestsCount} guest(s) from ${h.expectedFrom}`,
            descriptionAr: `${h.empFirst} ${h.empLast} طلب استضافة ${h.guestsCount} ضيف من ${h.expectedFrom}`,
            entityId: h.id,
            entityType: "hosting",
            createdAt: new Date().toISOString(),
          });
        }

        const noDateArr: any[] = byLabel.noDateAssignments ?? [];
        if (noDateArr.length > 0) {
          notifications.push({
            id: `no-checkout-date-${noDateArr.map((a) => a.id).join("-")}`,
            type: "NO_CHECKOUT_DATE",
            priority: "medium",
            title: `${noDateArr.length} Assignment${noDateArr.length !== 1 ? "s" : ""} Missing Checkout Date`,
            titleAr: `${noDateArr.length} تسكين بدون تاريخ مغادرة`,
            description: `${noDateArr.length} active assignment${noDateArr.length !== 1 ? "s" : ""} have no expected checkout date set.`,
            descriptionAr: `يوجد ${noDateArr.length} تسكين نشط بدون تاريخ مغادرة متوقع.`,
            entityId: noDateArr[0].id,
            entityType: "assignment",
            createdAt: new Date().toISOString(),
          });
        }

        const openIssues: any[] = Array.isArray(byLabel.openIssues)
          ? byLabel.openIssues
          : ((byLabel.openIssues as any)?.rows ?? []);
        if (openIssues.length > 0) {
          const highPriority = openIssues.filter(
            (m: any) =>
              (m.priority ?? "").toUpperCase() === "HIGH" ||
              (m.priority ?? "").toUpperCase() === "CRITICAL",
          );
          notifications.push({
            id: `open-maintenance-${openIssues.map((m: any) => m.id).join("-")}`,
            type: "OPEN_MAINTENANCE",
            priority: highPriority.length > 0 ? "high" : "medium",
            title: `${openIssues.length} Open Maintenance Issue${openIssues.length !== 1 ? "s" : ""}`,
            titleAr: `${openIssues.length} بلاغ صيانة مفتوح`,
            description: `${openIssues.length} maintenance request${openIssues.length !== 1 ? "s" : ""} pending resolution.`,
            descriptionAr: `يوجد ${openIssues.length} بلاغ صيانة قيد المعالجة.`,
            entityId: openIssues[0].id,
            entityType: "maintenance",
            createdAt: new Date().toISOString(),
          });
        }

        res.json({
          count: notifications.length,
          notifications: notifications.sort((a, b) => {
            const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
            return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3);
          }),
        });
      });
    } catch (err) {
      console.error("[notifications] failed to build notifications", err);
      res.json({ count: 0, notifications: [] });
    }
  },
);

export default router;