import { Router } from "express";
import {
  assignmentsTable,
  reservationsTable,
  hostingsTable,
  employeesTable,
  withTenant,
  evaluationsTable,
  portalDocumentsTable,
  activitiesTable,
} from "@workspace/db";
import { eq, and, lte, gte, isNull, gt, sql } from "drizzle-orm";
import { requirePermission } from "../middlewares/permissions.js";

const router: Router = Router();

router.get(
  "/notifications",
  requirePermission("dashboard", "view"),
  async (req, res): Promise<void> => {
    const { propertyId } = req.query as Record<string, string>;
    const pid = propertyId ? parseInt(propertyId) : null;

    if (!pid) {
      res.json({ count: 0, notifications: [] });
      return;
    }

    try {
      await withTenant(pid, async (tenantDb) => {
        const today = new Date().toISOString().split("T")[0];
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

        // Execute all queries in parallel
        const [
          overdueAssignments,
          upcomingCheckouts,
          todayReservations,
          pendingHostings,
          noDateAssignments,
          openIssuesResult,
          recentSurveys,
          recentDocs,
          recentActivities,
          pendingFamilyVisitsResult,
        ] = await Promise.all([
          /* 1. Overdue check-outs */
          tenantDb
            .select({
              id: assignmentsTable.id,
              employeeId: assignmentsTable.employeeId,
              expectedCheckOutDate: assignmentsTable.expectedCheckOutDate,
              empFirst: employeesTable.firstName,
              empLast: employeesTable.lastName,
            })
            .from(assignmentsTable)
            .leftJoin(
              employeesTable,
              eq(assignmentsTable.employeeId, employeesTable.id),
            )
            .where(
              and(
                eq(assignmentsTable.status, "ACTIVE"),
                lte(assignmentsTable.expectedCheckOutDate, today),
              ),
            ),

          /* 2. Upcoming check-outs */
          tenantDb
            .select({
              id: assignmentsTable.id,
              employeeId: assignmentsTable.employeeId,
              expectedCheckOutDate: assignmentsTable.expectedCheckOutDate,
              empFirst: employeesTable.firstName,
              empLast: employeesTable.lastName,
            })
            .from(assignmentsTable)
            .leftJoin(
              employeesTable,
              eq(assignmentsTable.employeeId, employeesTable.id),
            )
            .where(
              and(
                eq(assignmentsTable.status, "ACTIVE"),
                gte(assignmentsTable.expectedCheckOutDate, today),
                lte(assignmentsTable.expectedCheckOutDate, threeDaysLater),
              ),
            ),

          /* 3. Today's Reservations */
          tenantDb
            .select()
            .from(reservationsTable)
            .where(
              and(
                eq(reservationsTable.status, "UPCOMING"),
                lte(reservationsTable.checkInDate, today),
              ),
            ),

          /* 4. Pending hosting requests */
          tenantDb
            .select({
              id: hostingsTable.id,
              employeeId: hostingsTable.employeeId,
              guestsCount: hostingsTable.guestsCount,
              expectedFrom: hostingsTable.expectedFrom,
              empFirst: employeesTable.firstName,
              empLast: employeesTable.lastName,
            })
            .from(hostingsTable)
            .leftJoin(
              employeesTable,
              eq(hostingsTable.employeeId, employeesTable.id),
            )
            .where(eq(hostingsTable.status, "PENDING")),

          /* 5. Active assignments with no expected checkout date */
          tenantDb
            .select({
              id: assignmentsTable.id,
              employeeId: assignmentsTable.employeeId,
              checkInDate: assignmentsTable.checkInDate,
              empFirst: employeesTable.firstName,
              empLast: employeesTable.lastName,
            })
            .from(assignmentsTable)
            .leftJoin(
              employeesTable,
              eq(assignmentsTable.employeeId, employeesTable.id),
            )
            .where(
              and(
                eq(assignmentsTable.status, "ACTIVE"),
                isNull(assignmentsTable.expectedCheckOutDate),
              ),
            ),

          /* 6. Open / in-progress maintenance issues */
          tenantDb.execute(
            sql`SELECT id, description, status, priority FROM maintenance WHERE status IN ('open', 'in_progress') LIMIT 20`,
          ),

          /* 7. New Surveys (last 7 days) */
          tenantDb
            .select({
              id: evaluationsTable.id,
              titleAr: evaluationsTable.titleAr,
              titleEn: evaluationsTable.titleEn,
              category: evaluationsTable.category,
              createdAt: evaluationsTable.createdAt,
            })
            .from(evaluationsTable)
            .where(
              gt(
                evaluationsTable.createdAt,
                new Date(Date.now() - 7 * 86400000),
              ),
            )
            .limit(5),

          /* 8. New Documents (last 7 days) */
          tenantDb
            .select({
              id: portalDocumentsTable.id,
              titleAr: portalDocumentsTable.titleAr,
              titleEn: portalDocumentsTable.titleEn,
              fileName: portalDocumentsTable.fileName,
              createdAt: portalDocumentsTable.createdAt,
            })
            .from(portalDocumentsTable)
            .where(
              gt(
                portalDocumentsTable.createdAt,
                new Date(Date.now() - 7 * 86400000),
              ),
            )
            .limit(5),

          /* 9. New Activities (last 7 days) */
          tenantDb
            .select({
              id: activitiesTable.id,
              titleAr: activitiesTable.titleAr,
              titleEn: activitiesTable.titleEn,
              createdAt: activitiesTable.createdAt,
            })
            .from(activitiesTable)
            .where(
              gt(
                activitiesTable.createdAt,
                new Date(Date.now() - 7 * 86400000),
              ),
            )
            .limit(5),
          /* 10. Pending Family Visit Requests */
          tenantDb.execute(
            sql`SELECT f.id, f.employee_name, f.current_step_order, s.role_required
                FROM hosting_requests f
                JOIN hosting_request_approval_steps s ON f.id = s.request_id AND f.current_step_order = s.step_order
                WHERE f.status = 'in_signing' LIMIT 20`,
          ),
        ]);


        for (const row of (pendingFamilyVisitsResult as any).rows || []) {
            notifications.push({
              id: `hosting-requests-${row.id}`,
              type: "HOSTING_REQUEST_PENDING",
              priority: "high",
              title: `Pending Hosting Request Approval`,
              titleAr: `طلب استضافة في انتظار الاعتماد`,
              description: `Hosting request for ${row.employee_name} is waiting for ${row.role_required} approval`,
              descriptionAr: `طلب استضافة للموظف ${row.employee_name} بانتظار اعتماد ${row.role_required}`,
              entityId: row.id,
              entityType: "hosting_requests",
              createdAt: new Date().toISOString(),
            });
        }

        for (const a of overdueAssignments) {
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

        for (const a of upcomingCheckouts) {
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

        for (const r of todayReservations) {
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

        for (const h of pendingHostings) {
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

        if (noDateAssignments.length > 0) {
          notifications.push({
            id: `no-checkout-date-${noDateAssignments.map((a) => a.id).join("-")}`,
            type: "NO_CHECKOUT_DATE",
            priority: "medium",
            title: `${noDateAssignments.length} Assignment${noDateAssignments.length !== 1 ? "s" : ""} Missing Checkout Date`,
            titleAr: `${noDateAssignments.length} تسكين${noDateAssignments.length !== 1 ? " بدون" : " بدون"} تاريخ مغادرة`,
            description: `${noDateAssignments.length} active assignment${noDateAssignments.length !== 1 ? "s" : ""} have no expected checkout date set.`,
            descriptionAr: `يوجد ${noDateAssignments.length} تسكين نشط بدون تاريخ مغادرة متوقع. يرجى تحديد تواريخ المغادرة.`,
            entityId: noDateAssignments[0].id,
            entityType: "assignment",
            createdAt: new Date().toISOString(),
          });
        }

        const openIssues: any[] = Array.isArray(openIssuesResult)
          ? openIssuesResult
          : ((openIssuesResult as any)?.rows ?? []);

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
            descriptionAr: `يوجد ${openIssues.length} بلاغ صيانة قيد المعالجة بحاجة إلى اتخاذ إجراء.`,
            entityId: openIssues[0].id,
            entityType: "maintenance",
            createdAt: new Date().toISOString(),
          });
        }

        for (const s of recentSurveys) {
          const title = s.titleEn || s.titleAr || s.category || "Survey";
          const titleAr = s.titleAr || s.titleEn || s.category || "استبيان";
          notifications.push({
            id: `new-survey-${s.id}`,
            type: "NEW_SURVEY",
            priority: "medium",
            title: `New Survey: ${title}`,
            titleAr: `استبيان جديد: ${titleAr}`,
            description: `A new survey "${title}" is available for your feedback.`,
            descriptionAr: `استبيان جديد "${titleAr}" متاح لمشاركة رأيك.`,
            entityId: s.id,
            entityType: "survey",
            createdAt: s.createdAt.toISOString(),
          });
        }

        for (const d of recentDocs) {
          const title = d.titleEn || d.titleAr || d.fileName;
          const titleAr = d.titleAr || d.titleEn || d.fileName;
          notifications.push({
            id: `new-doc-${d.id}`,
            type: "NEW_DOCUMENT",
            priority: "low",
            title: `New Document: ${title}`,
            titleAr: `مستند جديد: ${titleAr}`,
            description: `"${title}" has been published.`,
            descriptionAr: `تم نشر "${titleAr}" جديد.`,
            entityId: d.id,
            entityType: "document",
            createdAt: d.createdAt.toISOString(),
          });
        }

        for (const a of recentActivities) {
          const title = a.titleEn || a.titleAr;
          const titleAr = a.titleAr || a.titleEn;
          notifications.push({
            id: `new-activity-${a.id}`,
            type: "NEW_ACTIVITY",
            priority: "low",
            title: `New Activity: ${title}`,
            titleAr: `فعالية جديدة: ${titleAr}`,
            description: `"${title}" is now available. Check it out!`,
            descriptionAr: `تمت إضافة "${titleAr}" جديدة. تفقدها الآن!`,
            entityId: a.id,
            entityType: "activity",
            createdAt: a.createdAt.toISOString(),
          });
        }

        res.json({
          count: notifications.length,
          notifications: notifications.sort((a, b) => {
            const pOrder = { high: 0, medium: 1, low: 2 };
            return pOrder[a.priority] - pOrder[b.priority];
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
