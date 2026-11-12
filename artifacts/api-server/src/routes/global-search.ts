// Quick search (Ctrl+K): one query across employees, rooms, tickets and
// users of the current property. Each section is returned only when the
// requester may view that module, and each is capped to a few hits.
import { Router } from "express";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  assignmentsTable,
  buildingsTable,
  db,
  maintenanceTable,
  profilesTable,
  roomsTable,
  usersTable,
  withTenant,
} from "@workspace/db";
import {
  hasPermission,
  requireAnyPermission,
} from "../middlewares/permissions.js";
import { validate } from "../middlewares/validate.js";
import { GlobalSearchQuery } from "../validation/schemas.js";
import { getTenantId } from "../lib/request-utils.js";
import { buildProfileSearchConditions } from "../lib/search-helper.js";
import { ticketNumber } from "../lib/maintenance-tickets.js";
import { canActOnUser, isRootUser } from "../lib/user-access.js";

const router: Router = Router();

const LIMIT = 6;

/** "MNT-2026-0037", "hk-37", "#37" or "37" -> 37. */
export function ticketIdFrom(q: string): number | null {
  const m =
    q.trim().match(/^(?:(?:mnt|hk|gen)-(?:\d{4}-)?)?#?0*(\d{1,9})$/i) ?? null;
  return m ? Number(m[1]) : null;
}

const can = (u: any, pairs: Array<[string, string]>) =>
  pairs.some(([m, a]) => hasPermission(u, m as any, a as any));

router.get(
  "/search",
  requireAnyPermission(
    ["profiles", "view"],
    ["housing", "view"],
    ["accommodation", "view"],
    ["maintenance", "view"],
    ["maintenance", "view_maintenance"],
    ["housekeeping", "view"],
    ["users", "view"],
  ),
  validate({ query: GlobalSearchQuery }),
  async (req, res, next) => {
    try {
      const actor = (req as any).authUser;
      const q = String(req.query.q ?? "").trim();
      const propertyId = getTenantId(req);
      const out: Record<string, any[]> = {
        profiles: [],
        rooms: [],
        tickets: [],
        users: [],
      };
      if (q.length < 2 && ticketIdFrom(q) == null) {
        res.json({ success: true, ...out });
        return;
      }
      const like = `%${q}%`;

      if (propertyId) {
        await withTenant(propertyId, async (tenantDb) => {
          if (can(actor, [["profiles", "view"]])) {
            const cond = buildProfileSearchConditions(q, profilesTable);
            if (cond) {
              const rows = await tenantDb
                .select({
                  id: profilesTable.id,
                  profileId: profilesTable.profileId,
                  firstName: profilesTable.firstName,
                  lastName: profilesTable.lastName,
                  firstNameAr: profilesTable.firstNameAr,
                  lastNameAr: profilesTable.lastNameAr,
                  department: profilesTable.department,
                  departmentAr: profilesTable.departmentAr,
                  jobTitle: profilesTable.jobTitle,
                  status: profilesTable.status,
                })
                .from(profilesTable)
                .where(
                  and(
                    cond,
                    sql`upper(${profilesTable.status}) != 'TRANSFERRED'`,
                  ),
                )
                .orderBy(asc(profilesTable.firstName), asc(profilesTable.id))
                .limit(LIMIT);
              // Current room of each hit, if housed.
              const ids = rows.map((r: any) => r.id);
              const rooms = ids.length
                ? await tenantDb
                    .select({
                      profileId: assignmentsTable.profileId,
                      roomNumber: roomsTable.roomNumber,
                      buildingName: buildingsTable.name,
                    })
                    .from(assignmentsTable)
                    .innerJoin(
                      roomsTable,
                      eq(roomsTable.id, assignmentsTable.roomId),
                    )
                    .leftJoin(
                      buildingsTable,
                      eq(buildingsTable.id, roomsTable.buildingId),
                    )
                    .where(
                      and(
                        inArray(assignmentsTable.profileId, ids),
                        sql`upper(${assignmentsTable.status}) = 'ACTIVE'`,
                      ),
                    )
                : [];
              const roomOf = new Map(
                rooms.map((r: any) => [r.profileId, r] as const),
              );
              out.profiles = rows.map((r: any) => ({
                ...r,
                room: roomOf.get(r.id) ?? null,
              }));
            }
          }

          if (
            can(actor, [
              ["housing", "view"],
              ["accommodation", "view"],
            ])
          ) {
            const rows = await tenantDb
              .select({
                id: roomsTable.id,
                roomNumber: roomsTable.roomNumber,
                status: roomsTable.status,
                capacity: roomsTable.capacity,
                buildingName: buildingsTable.name,
                occupants: sql<number>`(
                  SELECT count(*)::int FROM assignments a
                  WHERE a.room_id = ${roomsTable.id} AND upper(a.status) = 'ACTIVE'
                )`,
              })
              .from(roomsTable)
              .leftJoin(
                buildingsTable,
                eq(buildingsTable.id, roomsTable.buildingId),
              )
              .where(ilike(roomsTable.roomNumber, `${q}%`))
              .orderBy(
                sql`length(${roomsTable.roomNumber})`,
                asc(roomsTable.roomNumber),
              )
              .limit(LIMIT);
            out.rooms = rows;
          }

          const ticketPerms: Array<[string, string]> = [
            ["maintenance", "view"],
            ["maintenance", "view_maintenance"],
            ["housekeeping", "view"],
          ];
          if (can(actor, ticketPerms)) {
            const id = ticketIdFrom(q);
            const rows = await tenantDb
              .select({
                id: maintenanceTable.id,
                category: maintenanceTable.category,
                problemType: maintenanceTable.problemType,
                description: maintenanceTable.description,
                status: maintenanceTable.status,
                priority: maintenanceTable.priority,
                reportedAt: maintenanceTable.reportedAt,
                roomNumber: roomsTable.roomNumber,
              })
              .from(maintenanceTable)
              .leftJoin(roomsTable, eq(roomsTable.id, maintenanceTable.roomId))
              .where(
                or(
                  id != null ? eq(maintenanceTable.id, id) : undefined,
                  q.length >= 3
                    ? ilike(maintenanceTable.description, like)
                    : undefined,
                  q.length >= 3
                    ? ilike(maintenanceTable.problemType, like)
                    : undefined,
                ) ?? sql`false`,
              )
              .orderBy(
                id != null
                  ? sql`(${maintenanceTable.id} = ${id}) DESC`
                  : sql`1`,
                sql`${maintenanceTable.reportedAt} DESC`,
              )
              .limit(LIMIT);
            // Housekeeping-only staff see housekeeping tickets, and vice versa.
            const seesMnt = can(actor, [
              ["maintenance", "view"],
              ["maintenance", "view_maintenance"],
            ]);
            const seesHk = can(actor, [
              ["maintenance", "view"],
              ["housekeeping", "view"],
            ]);
            out.tickets = rows
              .filter((r: any) =>
                r.category === "housekeeping" ? seesHk : seesMnt,
              )
              .map((r: any) => ({
                ...r,
                ticketNo: ticketNumber(r),
                description: String(r.description ?? "").slice(0, 120),
              }));
          }
        });
      }

      if (can(actor, [["users", "view"]])) {
        const rows = await db
          .select({
            id: usersTable.id,
            username: usersTable.username,
            email: usersTable.email,
            roles: usersTable.roles,
            status: usersTable.status,
            propertyId: usersTable.propertyId,
            propertyIds: usersTable.propertyIds,
          })
          .from(usersTable)
          .where(
            or(ilike(usersTable.username, like), ilike(usersTable.email, like)),
          )
          .orderBy(asc(usersTable.username))
          .limit(50);
        out.users = rows
          .filter(
            (u) =>
              canActOnUser(actor, u, "view") &&
              (!isRootUser(u) || isRootUser(actor)),
          )
          .slice(0, LIMIT)
          .map(({ propertyId: _p, propertyIds: _ps, ...u }) => u);
      }

      res.json({ success: true, ...out });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
