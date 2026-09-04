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
    const canViewHousekeeping  = can(authUser, "housekeeping", "view");
    const canViewHousing       = can(authUser, "housing", "view");
    const canViewProfiles      = can(authUser, "profiles", "view");
    const canViewEvaluations   = can(authUser, "evaluations", "view");
    const canViewPortalContent = can(authUser, "portal_content", "view");
    const isSystemAdmin        = authUser?.isSystemAdmin ?? false;
    const userRoles: string[]  = authUser?.roles ?? [];

    try {
      await withTenant(pid, async (tenantDb) => {
        const today = new Date().toISOString().split("T")[0];
        const threeDaysLater = new Date(Date.now() + 3 * 86400000)
          .toISOString()
          .split("T")[0];
        const thirtyDaysLater = new Date(Date.now() + 30 * 86400000)
          .toISOString()
          .split("T")[0];

        const notifications: Array<{
          id: string;
          type: string;
          category: string;
          priority: "high" | "medium" | "low";
          title: string;
          titleAr: string;
          description: string;
          descriptionAr: string;
          entityId: number;
          entityType: string;
          targetUrl: string;
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

        // 6. Maintenance issues — maintenance.view required
        if (canViewMaintenance) {
          queries.push(
            tenantDb.execute(
              sql`SELECT id, description, status, priority, reported_at FROM maintenance
                  WHERE status IN ('open', 'pending', 'in_progress')
                  ORDER BY CASE WHEN priority IN ('emergency', 'urgent', 'high') THEN 0 ELSE 1 END, reported_at DESC
                  LIMIT 30`,
            ).catch(() => ({ rows: [] })),
          );
          queryLabels.push("openIssues");
        }

        // 7. Hosting requests waiting for approval
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
                ).catch(() => ({ rows: [] }))
              : tenantDb.execute(
                  sql`SELECT f.id, f.profile_name, f.current_step_order, s.role_required
                      FROM hosting_requests f
                      JOIN hosting_request_approval_steps s
                        ON f.id = s.request_id AND f.current_step_order = s.step_order
                      WHERE f.status = 'in_signing'
                        AND s.role_required = ANY(ARRAY[${sql.raw(rolesArr)}]::text[])
                      LIMIT 20`,
                ).catch(() => ({ rows: [] })),
          );
          queryLabels.push("pendingFamilyVisits");
        }

        // 8. Housekeeping: Dirty rooms needing cleaning — housekeeping.view or housing.view required
        if (canViewHousekeeping || canViewHousing) {
          queries.push(
            tenantDb.execute(
              sql`SELECT id, room_number, status, building_id, floor_id 
                  FROM rooms 
                  WHERE status IN ('dirty', 'occupied_dirty')
                  LIMIT 30`,
            ).catch(() => ({ rows: [] })),
          );
          queryLabels.push("dirtyRooms");
        }

        // 9. Housing: Out of service / Out of order rooms — housing.view required
        if (canViewHousing) {
          queries.push(
            tenantDb.execute(
              sql`SELECT id, room_number, status 
                  FROM rooms 
                  WHERE status IN ('out_of_service', 'out_of_order')
                  LIMIT 30`,
            ).catch(() => ({ rows: [] })),
          );
          queryLabels.push("oosRooms");
        }

        // 10. Profiles: Expiring contracts (within 30 days) — profiles.view required
        if (canViewProfiles) {
          queries.push(
            tenantDb.execute(
              sql`SELECT id, profile_id, first_name, last_name, contract_end_date 
                  FROM profiles 
                  WHERE status = 'ACTIVE' 
                    AND contract_end_date IS NOT NULL 
                    AND contract_end_date <> '' 
                    AND contract_end_date <= ${thirtyDaysLater}
                    AND contract_end_date >= ${today}
                  ORDER BY contract_end_date ASC
                  LIMIT 20`,
            ).catch(() => ({ rows: [] })),
          );
          queryLabels.push("expiringContracts");
        }

        // 11. Profiles: Active profiles with NO room assignment — profiles.view or accommodation.view required
        if (canViewProfiles || canViewAccommodation) {
          queries.push(
            tenantDb.execute(
              sql`SELECT p.id, p.profile_id, p.first_name, p.last_name 
                  FROM profiles p 
                  WHERE p.status = 'ACTIVE' 
                    AND NOT EXISTS (
                      SELECT 1 FROM assignments a 
                      WHERE a.profile_id = p.id AND a.status = 'ACTIVE'
                    )
                  LIMIT 20`,
            ).catch(() => ({ rows: [] })),
          );
          queryLabels.push("unassignedProfiles");
        }

        // 12. Smart Keys: Expired keys that need revocation — housing.view required
        if (canViewHousing || canViewAccommodation) {
          queries.push(
            tenantDb.execute(
              sql`SELECT id, room_id, card_number, expires_at 
                  FROM room_keys 
                  WHERE status = 'active' AND expires_at < NOW()
                  LIMIT 20`,
            ).catch(() => ({ rows: [] })),
          );
          queryLabels.push("expiredKeys");
        }

        // 13. Evaluations: Pending evaluations awaiting review — evaluations.view required
        if (canViewEvaluations || isSystemAdmin) {
          queries.push(
            tenantDb.execute(
              sql`SELECT id, COALESCE(title_ar, title_en, 'Evaluation') AS title, status FROM evaluations WHERE status = 'pending' LIMIT 10`,
            ).catch(() => ({ rows: [] })),
          );
          queryLabels.push("pendingEvaluations");
        }

        // 14. Portal Chat: Unread messages from residents — portal_content.view or admin required
        if (canViewPortalContent || isSystemAdmin) {
          queries.push(
            tenantDb.execute(
              sql`SELECT id, sender_id AS profile_id, content AS message, created_at 
                  FROM portal_messages 
                  WHERE is_deleted = false
                  ORDER BY created_at DESC 
                  LIMIT 15`,
            ).catch(() => ({ rows: [] })),
          );
          queryLabels.push("unreadPortalChat");
        }

        // ── Execute all permitted queries in parallel ─────────────────────
        const results = await Promise.all(queries);
        const byLabel: Record<string, any> = {};
        queryLabels.forEach((label, i) => {
          byLabel[label] = results[i];
        });

        // ── Map results to notification objects ───────────────────────────

        // Hosting requests
        for (const row of (byLabel.pendingFamilyVisits as any)?.rows ?? []) {
          notifications.push({
            id: `hosting-requests-${row.id}`,
            type: "HOSTING_REQUEST_PENDING",
            category: "accommodation",
            priority: "high",
            title: `Pending Hosting Request Approval`,
            titleAr: `طلب استضافة بانتظار الاعتماد`,
            description: `Hosting request for ${row.profile_name} is waiting for ${row.role_required} approval`,
            descriptionAr: `طلب استضافة للموظف ${row.profile_name} بانتظار اعتماد ${row.role_required}`,
            entityId: row.id,
            entityType: "hosting_requests",
            targetUrl: "/hosting-requests",
            createdAt: new Date().toISOString(),
          });
        }

        // Overdue checkouts
        for (const a of byLabel.overdueAssignments ?? []) {
          notifications.push({
            id: `overdue-${a.id}`,
            type: "OVERDUE_CHECKOUT",
            category: "accommodation",
            priority: "high",
            title: `Overdue Checkout`,
            titleAr: `مغادرة متأخرة`,
            description: `${a.empFirst} ${a.empLast} was expected to checkout on ${a.expectedCheckOutDate}`,
            descriptionAr: `${a.empFirst} ${a.empLast} كان من المفترض مغادرته بتاريخ ${a.expectedCheckOutDate}`,
            entityId: a.id,
            entityType: "assignment",
            targetUrl: "/accommodation/in-house",
            createdAt: new Date().toISOString(),
          });
        }

        // Upcoming checkouts
        for (const a of byLabel.upcomingCheckouts ?? []) {
          notifications.push({
            id: `upcoming-checkout-${a.id}`,
            type: "UPCOMING_CHECKOUT",
            category: "accommodation",
            priority: "medium",
            title: `Upcoming Checkout`,
            titleAr: `مغادرة قريبة خلال 3 أيام`,
            description: `${a.empFirst} ${a.empLast} is expected to checkout on ${a.expectedCheckOutDate}`,
            descriptionAr: `${a.empFirst} ${a.empLast} من المقرر مغادرته بتاريخ ${a.expectedCheckOutDate}`,
            entityId: a.id,
            entityType: "assignment",
            targetUrl: "/accommodation/in-house",
            createdAt: new Date().toISOString(),
          });
        }

        // Today reservations
        for (const r of byLabel.todayReservations ?? []) {
          notifications.push({
            id: `reservation-checkin-${r.id}`,
            type: "RESERVATION_CHECKIN",
            category: "reservations",
            priority: "medium",
            title: `Guest Arriving Today`,
            titleAr: `وصول حجز اليوم`,
            description: `${r.firstName} ${r.lastName} is expected to check in today`,
            descriptionAr: `${r.firstName} ${r.lastName} من المتوقع وصوله اليوم`,
            entityId: r.id,
            entityType: "reservation",
            targetUrl: "/accommodation/reservations",
            createdAt: new Date().toISOString(),
          });
        }

        // Pending guest hostings
        for (const h of byLabel.pendingHostings ?? []) {
          notifications.push({
            id: `pending-hosting-${h.id}`,
            type: "PENDING_HOSTING",
            category: "accommodation",
            priority: "low",
            title: `Pending Guest Hosting`,
            titleAr: `تسكين ضيافة معلق`,
            description: `${h.empFirst} ${h.empLast} requested hosting for ${h.guestsCount} guest(s)`,
            descriptionAr: `${h.empFirst} ${h.empLast} طلب استضافة لعدد ${h.guestsCount} ضيف`,
            entityId: h.id,
            entityType: "hosting",
            targetUrl: "/accommodation/guest-hosting",
            createdAt: new Date().toISOString(),
          });
        }

        // Assignments missing checkout date
        const noDateArr: any[] = byLabel.noDateAssignments ?? [];
        if (noDateArr.length > 0) {
          notifications.push({
            id: `no-checkout-date-${noDateArr.length}`,
            type: "NO_CHECKOUT_DATE",
            category: "accommodation",
            priority: "medium",
            title: `${noDateArr.length} Assignment(s) Missing Checkout Date`,
            titleAr: `${noDateArr.length} تسكين بدون تاريخ مغادرة`,
            description: `${noDateArr.length} active resident(s) have no checkout date set.`,
            descriptionAr: `يوجد ${noDateArr.length} ساكن نشط بدون تحديد تاريخ مغادرة متوقع.`,
            entityId: noDateArr[0].id,
            entityType: "assignment",
            targetUrl: "/accommodation/in-house",
            createdAt: new Date().toISOString(),
          });
        }

        // Maintenance tickets
        const openIssues: any[] = (byLabel.openIssues as any)?.rows ?? (Array.isArray(byLabel.openIssues) ? byLabel.openIssues : []);
        if (openIssues.length > 0) {
          const emergencyTickets = openIssues.filter((m: any) =>
            ["emergency", "urgent", "critical", "high"].includes(String(m.priority || "").toLowerCase())
          );

          if (emergencyTickets.length > 0) {
            notifications.push({
              id: `urgent-maintenance-${emergencyTickets.length}`,
              type: "EMERGENCY_MAINTENANCE",
              category: "maintenance",
              priority: "high",
              title: `${emergencyTickets.length} Urgent Maintenance Ticket(s)`,
              titleAr: `${emergencyTickets.length} بلاغ صيانة طارئ وعاجل`,
              description: `Critical maintenance ticket(s) requiring immediate attention.`,
              descriptionAr: `يوجد بلاغات صيانة طارئة تتطلب تدخلاً فورياً.`,
              entityId: emergencyTickets[0].id,
              entityType: "maintenance",
              targetUrl: "/maintenance",
              createdAt: new Date().toISOString(),
            });
          }

          const regularTickets = openIssues.filter((m: any) =>
            !["emergency", "urgent", "critical", "high"].includes(String(m.priority || "").toLowerCase())
          );

          if (regularTickets.length > 0) {
            notifications.push({
              id: `open-maintenance-${regularTickets.length}`,
              type: "OPEN_MAINTENANCE",
              category: "maintenance",
              priority: "medium",
              title: `${regularTickets.length} Open Maintenance Request(s)`,
              titleAr: `${regularTickets.length} طلب صيانة قيد المتابعة`,
              description: `${regularTickets.length} maintenance request(s) waiting for resolution.`,
              descriptionAr: `يوجد ${regularTickets.length} طلب صيانة قيد المعالجة والإنجاز.`,
              entityId: regularTickets[0].id,
              entityType: "maintenance",
              targetUrl: "/maintenance",
              createdAt: new Date().toISOString(),
            });
          }
        }

        // Housekeeping: Dirty rooms
        const dirtyRows: any[] = (byLabel.dirtyRooms as any)?.rows ?? [];
        if (dirtyRows.length > 0) {
          notifications.push({
            id: `dirty-rooms-${dirtyRows.length}`,
            type: "DIRTY_ROOMS",
            category: "housekeeping",
            priority: "high",
            title: `${dirtyRows.length} Room(s) Need Housekeeping Cleaning`,
            titleAr: `${dirtyRows.length} غرفة تحتاج تنظيف فوري (هاوس كيبنج)`,
            description: `${dirtyRows.length} room(s) are currently dirty or occupied dirty.`,
            descriptionAr: `يوجد ${dirtyRows.length} غرفة متسخة أو مشغولة تحتاج للتنظيف.`,
            entityId: dirtyRows[0].id,
            entityType: "room",
            targetUrl: "/housekeeping",
            createdAt: new Date().toISOString(),
          });
        }

        // Housing: Out of Service rooms
        const oosRows: any[] = (byLabel.oosRooms as any)?.rows ?? [];
        if (oosRows.length > 0) {
          notifications.push({
            id: `oos-rooms-${oosRows.length}`,
            type: "OUT_OF_SERVICE_ROOMS",
            category: "housekeeping",
            priority: "medium",
            title: `${oosRows.length} Room(s) Out of Service`,
            titleAr: `${oosRows.length} غرفة خارج الخدمة أو تحت الصيانة`,
            description: `${oosRows.length} room(s) are currently marked out of service or out of order.`,
            descriptionAr: `يوجد ${oosRows.length} غرفة معطلة أو خارج الخدمة حالياً.`,
            entityId: oosRows[0].id,
            entityType: "room",
            targetUrl: "/housing",
            createdAt: new Date().toISOString(),
          });
        }

        // Profiles: Expiring contracts
        const expiringRows: any[] = (byLabel.expiringContracts as any)?.rows ?? [];
        if (expiringRows.length > 0) {
          notifications.push({
            id: `expiring-contracts-${expiringRows.length}`,
            type: "EXPIRING_CONTRACT",
            category: "profiles",
            priority: "high",
            title: `${expiringRows.length} Employee Contract(s) Expiring Soon`,
            titleAr: `${expiringRows.length} عقد موظف ينتهي خلال 30 يوماً`,
            description: `${expiringRows.length} employee contract(s) will expire soon. Please review.`,
            descriptionAr: `يوجد ${expiringRows.length} موظف تشارف عقودهم على الانتهاء قريباً.`,
            entityId: expiringRows[0].id,
            entityType: "profile",
            targetUrl: "/profiles",
            createdAt: new Date().toISOString(),
          });
        }

        // Profiles: Active with NO room assignment
        const unassignedRows: any[] = (byLabel.unassignedProfiles as any)?.rows ?? [];
        if (unassignedRows.length > 0) {
          notifications.push({
            id: `unassigned-profiles-${unassignedRows.length}`,
            type: "UNASSIGNED_PROFILES",
            category: "profiles",
            priority: "medium",
            title: `${unassignedRows.length} Active Profile(s) Without Room Assignment`,
            titleAr: `${unassignedRows.length} موظف نشط بدون تسكين في غرفة`,
            description: `${unassignedRows.length} active employee(s) have not been assigned to any room.`,
            descriptionAr: `يوجد ${unassignedRows.length} موظف بحالة نشطة لكنهم غير مسكنين في أي غرفة حالياً.`,
            entityId: unassignedRows[0].id,
            entityType: "profile",
            targetUrl: "/accommodation/in-house",
            createdAt: new Date().toISOString(),
          });
        }

        // Smart Keys: Expired keys
        const expiredKeyRows: any[] = (byLabel.expiredKeys as any)?.rows ?? [];
        if (expiredKeyRows.length > 0) {
          notifications.push({
            id: `expired-keys-${expiredKeyRows.length}`,
            type: "EXPIRED_KEYS",
            category: "accommodation",
            priority: "medium",
            title: `${expiredKeyRows.length} Expired Room Key Card(s)`,
            titleAr: `${expiredKeyRows.length} كرت غرفة منتهي الصلاحية`,
            description: `${expiredKeyRows.length} key card(s) have passed their expiration date.`,
            descriptionAr: `يوجد ${expiredKeyRows.length} كرت غرفة منتهي الصلاحية يحتاج للتحديث أو الإلغاء.`,
            entityId: expiredKeyRows[0].id,
            entityType: "room_key",
            targetUrl: "/housing",
            createdAt: new Date().toISOString(),
          });
        }

        // Evaluations: Pending
        const evalRows: any[] = (byLabel.pendingEvaluations as any)?.rows ?? [];
        if (evalRows.length > 0) {
          notifications.push({
            id: `pending-evaluations-${evalRows.length}`,
            type: "PENDING_EVALUATION",
            category: "evaluations",
            priority: "low",
            title: `${evalRows.length} Pending Evaluation(s)`,
            titleAr: `${evalRows.length} تقييم موظف بانتظار الاعتماد`,
            description: `${evalRows.length} evaluation(s) waiting for review.`,
            descriptionAr: `يوجد ${evalRows.length} تقييم للموظفين بحاجة للمراجعة والاعتماد.`,
            entityId: evalRows[0].id,
            entityType: "evaluation",
            targetUrl: "/portal",
            createdAt: new Date().toISOString(),
          });
        }

        // Portal Chat: Unread messages
        const chatRows: any[] = (byLabel.unreadPortalChat as any)?.rows ?? [];
        if (chatRows.length > 0) {
          notifications.push({
            id: `unread-chat-${chatRows.length}`,
            type: "UNREAD_PORTAL_CHAT",
            category: "chat",
            priority: "high",
            title: `${chatRows.length} New Message(s) From Portal Chat`,
            titleAr: `${chatRows.length} رسالة جديدة في شات البوابة`,
            description: `${chatRows.length} resident message(s) awaiting your response.`,
            descriptionAr: `وصلت ${chatRows.length} رسالة جديدة من الموظفين عبر البوابة بانتظار الرد.`,
            entityId: chatRows[0].id,
            entityType: "portal_chat",
            targetUrl: "/portal",
            createdAt: new Date().toISOString(),
          });
        }

        // Sort: high priority first, then medium, then low
        const sorted = notifications.sort((a, b) => {
          const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3);
        });

        res.json({
          count: sorted.length,
          notifications: sorted,
        });
      });
    } catch (err) {
      console.error("[notifications] failed to build notifications", err);
      res.json({ count: 0, notifications: [] });
    }
  },
);

export default router;
