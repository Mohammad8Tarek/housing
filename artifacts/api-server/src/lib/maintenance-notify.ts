// Push notifications for maintenance tickets (portal app / PWA):
// - the technician / staff member a ticket is assigned to;
// - the resident who reported it, when it is resolved (asks for a rating).
// Never throws: a notification failure must not affect the ticket change.
import { and, eq } from "drizzle-orm";
import {
  assignmentsTable,
  maintenanceEventsTable,
  profilesTable,
  workersTable,
} from "@workspace/db";
import { sendPushToProfiles } from "../routes/push-notifications.js";
import { ticketNumber } from "./maintenance-tickets.js";

type TicketLike = {
  id: number;
  category?: string | null;
  problemType?: string | null;
  description?: string | null;
  roomId?: number | null;
  reportedBy?: string | null;
  reportedAt?: Date | string | null;
};

const short = (s?: string | null, n = 80) =>
  (s ?? "").length > n ? `${(s ?? "").slice(0, n)}…` : (s ?? "");

/** Profile ids to notify for a new assignment (staff profile and/or worker's profile). */
export async function assigneeProfileIds(
  tenantDb: any,
  assignedTo?: number | null,
  workerId?: number | null,
): Promise<number[]> {
  const ids = new Set<number>();
  if (assignedTo) ids.add(Number(assignedTo));
  if (workerId) {
    const [w] = await tenantDb
      .select({ profileId: workersTable.profileId })
      .from(workersTable)
      .where(eq(workersTable.id, Number(workerId)))
      .limit(1);
    if (w?.profileId) ids.add(Number(w.profileId));
  }
  return [...ids];
}

/**
 * The resident who reported the ticket: the profile recorded when it was
 * created from the portal, else the room's ACTIVE resident whose name matches
 * the reporter.
 */
export async function reporterProfileIds(
  tenantDb: any,
  ticket: TicketLike,
): Promise<number[]> {
  const [created] = await tenantDb
    .select({ profileId: maintenanceEventsTable.actorProfileId })
    .from(maintenanceEventsTable)
    .where(
      and(
        eq(maintenanceEventsTable.ticketId, ticket.id),
        eq(maintenanceEventsTable.type, "created"),
      ),
    )
    .limit(1);
  if (created?.profileId) return [Number(created.profileId)];

  if (!ticket.roomId || !ticket.reportedBy) return [];
  const residents = await tenantDb
    .select({
      id: profilesTable.id,
      firstName: profilesTable.firstName,
      lastName: profilesTable.lastName,
      profileId: profilesTable.profileId,
    })
    .from(assignmentsTable)
    .innerJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
    .where(
      and(
        eq(assignmentsTable.roomId, ticket.roomId),
        eq(assignmentsTable.status, "ACTIVE"),
      ),
    );
  const reporter = String(ticket.reportedBy).trim();
  return residents
    .filter(
      (p: any) =>
        `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() === reporter ||
        (p.profileId && String(p.profileId) === reporter),
    )
    .map((p: any) => Number(p.id));
}

export async function notifyTicketAssigned(
  tenantDb: any,
  propertyId: number,
  ticket: TicketLike,
  assignedTo?: number | null,
  workerId?: number | null,
): Promise<void> {
  try {
    const ids = await assigneeProfileIds(tenantDb, assignedTo, workerId);
    if (ids.length === 0) return;
    const no = ticketNumber(ticket);
    const what = short(ticket.description || ticket.problemType);
    await sendPushToProfiles(propertyId, ids, {
      title: `New ticket assigned: ${no}`,
      titleAr: `تم تعيين بلاغ لك: ${no}`,
      body: what,
      bodyAr: what,
      tag: `ticket-${ticket.id}`,
      url: "/dashboard",
    });
  } catch (err: any) {
    console.warn("[maintenance] assignment notification failed:", err?.message);
  }
}

export async function notifyTicketResolved(
  tenantDb: any,
  propertyId: number,
  ticket: TicketLike,
): Promise<void> {
  try {
    const ids = await reporterProfileIds(tenantDb, ticket);
    if (ids.length === 0) return;
    const no = ticketNumber(ticket);
    await sendPushToProfiles(propertyId, ids, {
      title: `Your request ${no} was resolved`,
      titleAr: `تم حل طلبك ${no} ✅`,
      body: "Please rate the service — it helps us improve.",
      bodyAr: "نرجو تقييم الخدمة — رأيك بيساعدنا نتحسن.",
      tag: `ticket-${ticket.id}`,
      url: `/request-details?id=${ticket.id}`,
    });
  } catch (err: any) {
    console.warn("[maintenance] resolved notification failed:", err?.message);
  }
}
