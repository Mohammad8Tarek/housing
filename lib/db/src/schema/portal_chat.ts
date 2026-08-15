import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  foreignKey,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portalConversationsTable = pgTable("portal_conversations", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  subject: text("subject"),
  isGroup: boolean("is_group").notNull().default(false),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_portal_conversations_property_id").on(table.propertyId),
]);

export const portalConversationParticipantsTable = pgTable(
  "portal_conversation_participants",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull(),
    employeeId: integer("employee_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_portal_conv_participants_conversation_id").on(table.conversationId),
    index("idx_portal_conv_participants_employee_id").on(table.employeeId),
  ]
);

export const portalMessagesTable = pgTable("portal_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  senderId: integer("sender_id").notNull(),
  content: text("content").notNull(),
  contentType: text("content_type").notNull().default("text"), // text | image | system
  isEdited: boolean("is_edited").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_portal_messages_conversation_id").on(table.conversationId),
  index("idx_portal_messages_sender_id").on(table.senderId),
  index("idx_portal_messages_created_at").on(table.createdAt),
]);

export const portalMessageReadsTable = pgTable("portal_message_reads", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_portal_message_reads_message_id").on(table.messageId),
  index("idx_portal_message_reads_employee_id").on(table.employeeId),
]);

export const insertConversationSchema = createInsertSchema(
  portalConversationsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(portalMessagesTable)
  .omit({ id: true, createdAt: true, editedAt: true, deletedAt: true })
  .extend({
    content: z.string().min(1),
  });
export const addParticipantSchema = z.object({
  employeeId: z.number(),
});

export type Conversation = typeof portalConversationsTable.$inferSelect;
export type ConversationParticipant =
  typeof portalConversationParticipantsTable.$inferSelect;
export type Message = typeof portalMessagesTable.$inferSelect;
export type MessageRead = typeof portalMessageReadsTable.$inferSelect;
