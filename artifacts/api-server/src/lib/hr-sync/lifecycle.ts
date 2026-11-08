/**
 * hr-sync/lifecycle.ts — Accommodation/room lifecycle sync for an HR employee record (checkout, vacation, return).
 */
import { profilesTable, profileVacationsTable, assignmentsTable, roomsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logActivity } from "../activity-logger.js";
import { broadcastToProperty } from "../websocket.js";

// ============================================================================
// Helper: Sync accommodation and room lifecycle for an employee
// ============================================================================
export async function syncEmployeeAccommodationLifecycle({
  tenantDb,
  propertyId,
  profile,
  previousStatus,
  newStatus,
  autoCheckoutOnDeparture = true,
  autoVacationSync = true,
  departureDate,
  departureReason,
  vacationStartDate,
  vacationEndDate,
  vacationNotes,
  req,
}: {
  tenantDb: any;
  propertyId: number;
  profile: any;
  previousStatus: string;
  newStatus: "ACTIVE" | "VACATION" | "DEPARTED" | "UNASSIGNED";
  autoCheckoutOnDeparture?: boolean;
  autoVacationSync?: boolean;
  departureDate?: string;
  departureReason?: string;
  vacationStartDate?: string | null;
  vacationEndDate?: string | null;
  vacationNotes?: string;
  req?: any;
}) {
  let checkoutResult: any = null;

  try {
    // 1. Find active assignment if any
    const [activeAssign] = await tenantDb
      .select()
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.profileId, profile.id),
          eq(assignmentsTable.status, "ACTIVE"),
        ),
      );

    // ========================================================================
    // Case A: Employee Departed / Terminated / Left (تصفية / مغادرة)
    // ========================================================================
    if (newStatus === "DEPARTED") {
      if (activeAssign && autoCheckoutOnDeparture) {
        const checkOutDate =
          departureDate || new Date().toISOString().split("T")[0];
        const notes = departureReason
          ? `تصفية من الموارد البشرية (HR Departure): ${departureReason}`
          : "تصفية من الموارد البشرية (HR Departure) — إنهاء خدمة / استقالة";

        await tenantDb
          .update(assignmentsTable)
          .set({
            status: "CHECKED_OUT",
            checkOutDate,
            notes,
          })
          .where(eq(assignmentsTable.id, activeAssign.id));

        // Fetch Room & Update status to DIRTY (Rule 5!)
        const [room] = await tenantDb
          .select()
          .from(roomsTable)
          .where(eq(roomsTable.id, activeAssign.roomId));

        if (room) {
          const newOcc = Math.max(0, room.currentOccupancy - 1);
          const newRoomStatus = newOcc === 0 ? "dirty" : "occupied_dirty";

          await tenantDb
            .update(roomsTable)
            .set({
              currentOccupancy: newOcc,
              status: newRoomStatus,
            })
            .where(eq(roomsTable.id, room.id));

          checkoutResult = {
            assignmentId: activeAssign.id,
            roomId: room.id,
            roomNumber: room.roomNumber,
            bedNumber: activeAssign.bedNumber,
            checkOutDate,
          };

          // Broadcast HIGH-PRIORITY ALARM via WebSocket
          broadcastToProperty(propertyId, {
            module: "accommodation",
            action: "hr_departure_alarm",
            data: {
              priority: "high",
              title: "إنذار تصفية موظف من الموارد البشرية",
              message: `تم تسجيل مغادرة/تصفية الموظف ${profile.firstName} ${profile.lastName} (${profile.profileId}) من الموارد البشرية وإخلاء غرفته رقم ${room.roomNumber} (سرير ${activeAssign.bedNumber}). يرجى فحص وتنظيف الغرفة.`,
              profileId: profile.profileId,
              profileName: `${profile.firstName} ${profile.lastName}`,
              roomId: room.id,
              roomNumber: room.roomNumber,
              bedNumber: activeAssign.bedNumber,
              assignmentId: activeAssign.id,
            },
          });

          broadcastToProperty(propertyId, {
            module: "housing",
            action: "updated",
            entityId: room.id,
          });
        }

        broadcastToProperty(propertyId, {
          module: "accommodation",
          action: "checkout",
          entityId: activeAssign.id,
        });
        broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });

        // Activity log
        await logActivity({
          req: req || null,
          propertyId,
          username: "hr-sync",
          userId: 0,
          userRole: "system",
          action: `تصفية موظف من الموارد البشرية (HR) — إنهاء سكن الموظف #${profile.profileId} (${profile.firstName} ${profile.lastName}) وإخلاء السرير: ${departureReason || "تصفية عمل"}`,
          actionType: "UPDATE",
          module: "hr_sync",
          entityType: "assignment",
          entityId: activeAssign.id,
          details: {
            profileId: profile.profileId,
            roomId: room?.id,
            roomNumber: room?.roomNumber,
            bedNumber: activeAssign.bedNumber,
            departureReason: departureReason || "تصفية عمل من HR",
            checkOutDate,
            source: "HR Sync",
          },
        });
      }
    }

    // ========================================================================
    // Case B: Employee On Vacation (إجازة)
    // ========================================================================
    else if (newStatus === "VACATION" && autoVacationSync) {
      // Record in profile_vacations if dates provided
      if (vacationStartDate && vacationEndDate) {
        const [existingVac] = await tenantDb
          .select()
          .from(profileVacationsTable)
          .where(
            and(
              eq(profileVacationsTable.profileId, profile.id),
              eq(profileVacationsTable.startDate, vacationStartDate),
              eq(profileVacationsTable.endDate, vacationEndDate),
            ),
          );

        if (!existingVac) {
          await tenantDb.insert(profileVacationsTable).values({
            profileId: profile.id,
            startDate: vacationStartDate,
            endDate: vacationEndDate,
            notes: vacationNotes || "إجازة مسجلة من نظام الموارد البشرية (HR Sync)",
            status: "ACTIVE",
          });
        }
      }

      // If active assignment, check if room should be marked occupied_vacation
      if (activeAssign && activeAssign.roomId) {
        const [room] = await tenantDb
          .select()
          .from(roomsTable)
          .where(eq(roomsTable.id, activeAssign.roomId));

        if (room) {
          const roomAssignments = await tenantDb
            .select({
              profileId: assignmentsTable.profileId,
              status: profilesTable.status,
            })
            .from(assignmentsTable)
            .leftJoin(
              profilesTable,
              eq(assignmentsTable.profileId, profilesTable.id),
            )
            .where(
              and(
                eq(assignmentsTable.roomId, room.id),
                eq(assignmentsTable.status, "ACTIVE"),
              ),
            );

          const allOnVacation = roomAssignments.every((ra: any) =>
            ra.profileId === profile.id
              ? true
              : String(ra.status).toUpperCase() === "VACATION",
          );

          if (allOnVacation) {
            await tenantDb
              .update(roomsTable)
              .set({ status: "occupied_vacation" })
              .where(eq(roomsTable.id, room.id));

            broadcastToProperty(propertyId, {
              module: "housing",
              action: "updated",
              entityId: room.id,
            });
          }

          broadcastToProperty(propertyId, {
            module: "accommodation",
            action: "vacation_start",
            entityId: activeAssign.id,
            data: { profileId: profile.profileId },
          });
          broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
        }
      }

      await logActivity({
        req: req || null,
        propertyId,
        username: "hr-sync",
        userId: 0,
        userRole: "system",
        action: `تسجيل إجازة للموظف #${profile.profileId} (${profile.firstName} ${profile.lastName}) من الموارد البشرية (HR)${vacationStartDate ? ` من ${vacationStartDate}` : ""}${vacationEndDate ? ` إلى ${vacationEndDate}` : ""}`,
        actionType: "UPDATE",
        module: "hr_sync",
        entityType: "profile",
        entityId: profile.id,
        details: {
          profileId: profile.profileId,
          vacationStartDate,
          vacationEndDate,
          vacationNotes: vacationNotes || "إجازة مسجلة من HR",
          source: "HR Sync",
        },
      });
    }

    // ========================================================================
    // Case C: Return from Vacation to Active (عودة من الإجازة)
    // ========================================================================
    else if (
      newStatus === "ACTIVE" &&
      previousStatus?.toUpperCase() === "VACATION" &&
      autoVacationSync
    ) {
      // Close active vacation records
      const returnDate = new Date().toISOString().split("T")[0];
      await tenantDb
        .update(profileVacationsTable)
        .set({
          status: "COMPLETED",
          actualReturnDate: returnDate,
        })
        .where(
          and(
            eq(profileVacationsTable.profileId, profile.id),
            eq(profileVacationsTable.status, "ACTIVE"),
          ),
        );

      // If active room was occupied_vacation, set back to occupied
      if (activeAssign && activeAssign.roomId) {
        const [room] = await tenantDb
          .select()
          .from(roomsTable)
          .where(eq(roomsTable.id, activeAssign.roomId));

        if (room && room.status === "occupied_vacation") {
          await tenantDb
            .update(roomsTable)
            .set({ status: "occupied" })
            .where(eq(roomsTable.id, room.id));

          broadcastToProperty(propertyId, {
            module: "housing",
            action: "updated",
            entityId: room.id,
          });
        }

        broadcastToProperty(propertyId, {
          module: "accommodation",
          action: "vacation_return",
          entityId: activeAssign.id,
          data: { profileId: profile.profileId },
        });
        broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
      }

      await logActivity({
        req: req || null,
        propertyId,
        username: "hr-sync",
        userId: 0,
        userRole: "system",
        action: `تسجيل عودة الموظف #${profile.profileId} (${profile.firstName} ${profile.lastName}) من الإجازة ومباشرة العمل عبر HR`,
        actionType: "UPDATE",
        module: "hr_sync",
        entityType: "profile",
        entityId: profile.id,
        details: {
          profileId: profile.profileId,
          actualReturnDate: returnDate,
          source: "HR Sync",
        },
      });
    }
  } catch (err) {
    console.error("[HrSync] Error in syncEmployeeAccommodationLifecycle:", err);
  }

  return checkoutResult;
}
