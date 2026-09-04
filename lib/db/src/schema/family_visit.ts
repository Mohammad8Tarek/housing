import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  date,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";
import { usersTable } from "./users";

export const familyVisitRequestsTable = pgTable(
  "hosting_requests",
  {
    id: serial("id").primaryKey(),
    requestNumber: varchar("request_number", { length: 20 }).notNull().unique(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => propertiesTable.id),
    hotelId: integer("hotel_id"),
    visitHotelId: integer("visit_hotel_id"),

    requesterUserId: integer("requester_user_id")
      .notNull()
      .references(() => usersTable.id),
    profileName: varchar("profile_name", { length: 200 }).notNull(),
    clockNumber: varchar("clock_number", { length: 50 }).notNull(),
    department: varchar("department", { length: 150 }).notNull(),
    position: varchar("position", { length: 150 }).notNull(),

    numberOfRooms: integer("number_of_rooms").notNull(),
    assignedRoomId: integer("assigned_room_id"),
    familyMembersCount: integer("family_members_count").notNull(),
    familyMembersIncluded: varchar("family_members_included", { length: 100 }),
    fromDate: date("from_date").notNull(),
    toDate: date("to_date").notNull(),
    consumedDays: integer("consumed_days").notNull(),
    remarks: text("remarks"),
    attachmentData: text("attachment_data"),

    status: varchar("status", { length: 30 }).notNull().default("in_signing"),
    currentStepOrder: integer("current_step_order").notNull().default(1),
    rejectedAtStep: integer("rejected_at_step"),
    rejectionReason: text("rejection_reason"),

    guestHostingId: integer("guest_hosting_id"),
    guestHostingStatus: varchar("guest_hosting_status", { length: 30 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    statusIdx: index("idx_fvr_status").on(table.status),
    propertyIdIdx: index("idx_fvr_property_id").on(table.propertyId),
  }),
);

export const insertFamilyVisitRequestSchema = createInsertSchema(
  familyVisitRequestsTable,
).omit({
  id: true,
  requestNumber: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFamilyVisitRequest =
  typeof familyVisitRequestsTable.$inferInsert;
export type FamilyVisitRequest = typeof familyVisitRequestsTable.$inferSelect;

export const familyVisitApprovalStepsTable = pgTable(
  "hosting_request_approval_steps",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => familyVisitRequestsTable.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(),
    roleRequired: varchar("role_required", { length: 50 }).notNull(),

    status: varchar("status", { length: 30 }).notNull().default("pending"),

    signedByUserId: integer("signed_by_user_id").references(
      () => usersTable.id,
    ),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signatureImageUrlSnapshot: text("signature_image_url_snapshot"),
    comment: text("comment"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    requestIdIdx: index("index_fvas_request_id").on(table.requestId),
    statusIdx: index("index_fvas_status").on(table.status),
  }),
);

export const insertFamilyVisitApprovalStepSchema = createInsertSchema(
  familyVisitApprovalStepsTable,
).omit({
  id: true,
  createdAt: true,
});
export type InsertFamilyVisitApprovalStep =
  typeof familyVisitApprovalStepsTable.$inferInsert;
export type FamilyVisitApprovalStep =
  typeof familyVisitApprovalStepsTable.$inferSelect;

// Aliases for modern naming
export const hostingRequestsTable = familyVisitRequestsTable;
export const hostingRequestApprovalStepsTable = familyVisitApprovalStepsTable;
export type HostingRequest = FamilyVisitRequest;
export type HostingRequestApprovalStep = FamilyVisitApprovalStep;
