import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const propertyWhatsappConfigsTable = pgTable(
  "property_whatsapp_configs",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull().unique(),
    phoneNumber: text("phone_number"),
    status: text("status").notNull().default("disconnected"), // disconnected | pairing | connected
    qrCode: text("qr_code"),
    isAutoSendEnabled: boolean("is_auto_send_enabled").notNull().default(true),
    welcomeTemplateAr: text("welcome_template_ar")
      .notNull()
      .default(
        "مرحباً بك أ/ {employee_name} في {property_name} 🌴✨\n\nيسعدنا إبلاغك بأنه تم إتمام إجراءات تسكينك بنجاح:\n🏢 المبنى: {building_name} ({floor_name})\n🚪 رقم الغرفة: {room_number}\n🛏️ السرير: {bed_label}\n📅 تاريخ التسكين: {checkin_date}\n\n📱 للدخول إلى بوابة المقيمين وطلب الخدمات:\n{portal_url}\n\nنتمنى لك إقامة هانئة ومريحة! ✨"
      ),
    welcomeTemplateEn: text("welcome_template_en")
      .notNull()
      .default(
        "Welcome Mr/Ms {employee_name} to {property_name}! 🌴✨\n\nYour accommodation has been successfully confirmed:\n🏢 Building: {building_name} ({floor_name})\n🚪 Room: {room_number}\n🛏️ Bed: {bed_label}\n📅 Check-in Date: {checkin_date}\n\n📱 Access Resident Portal:\n{portal_url}\n\nWe wish you a pleasant and comfortable stay! ✨"
      ),
    supervisorContact: text("supervisor_contact").default(""),
    isReservationSendEnabled: boolean("is_reservation_send_enabled").notNull().default(true),
    reservationTemplateAr: text("reservation_template_ar")
      .notNull()
      .default(
        "مرحباً بك أ/ {guest_name} في {property_name} 🌴✨\n\nيسعدنا تأكيد حجز إقامتك المسبق لدينا:\n🔖 رقم الحجز: #{reservation_id}\n🏢 المبنى / الغرفة: {room_info}\n🛏️ تفاصيل السرير: {bed_info}\n📅 تاريخ الوصول المتوقع: {checkin_date}\n📅 تاريخ المغادرة المتوقع: {checkout_date}\n\nℹ️ تنويه: يُرجى التوجه لمكتب الإسكان فور وصولك لاستلام المفتاح وإتمام إجراءات التسكين.\n\nنتمنى لك رحلة موفقة وإقامة سعيدة! ✨"
      ),
    reservationTemplateEn: text("reservation_template_en")
      .notNull()
      .default(
        "Welcome Mr/Ms {guest_name} to {property_name}! 🌴✨\n\nWe are pleased to confirm your upcoming reservation:\n🔖 Booking Ref: #{reservation_id}\n🏢 Building / Room: {room_info}\n🛏️ Bed Info: {bed_info}\n📅 Expected Check-in: {checkin_date}\n📅 Expected Check-out: {checkout_date}\n\nℹ️ Note: Please visit the Housing Office upon your arrival to complete check-in and collect your keys.\n\nWe wish you a safe trip and a pleasant stay! ✨"
      ),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_prop_whatsapp_property_id").on(table.propertyId)]
);

export const whatsappDeliveryLogsTable = pgTable(
  "whatsapp_delivery_logs",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull(),
    recipientPhone: text("recipient_phone").notNull(),
    recipientName: text("recipient_name"),
    messageType: text("message_type").notNull().default("CHECKIN_WELCOME"), // CHECKIN_WELCOME | TEST | MANUAL
    messageContent: text("message_content").notNull(),
    status: text("status").notNull().default("SENT"), // SENT | FAILED | NOT_REGISTERED | QUEUED
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_wa_delivery_logs_property_id").on(table.propertyId),
    index("idx_wa_delivery_logs_created_at").on(table.createdAt),
  ]
);

export const insertPropertyWhatsappConfigSchema = createInsertSchema(
  propertyWhatsappConfigsTable
).omit({
  id: true,
  updatedAt: true,
});

export type InsertPropertyWhatsappConfig = z.infer<
  typeof insertPropertyWhatsappConfigSchema
>;
export type PropertyWhatsappConfig =
  typeof propertyWhatsappConfigsTable.$inferSelect;
export type WhatsappDeliveryLog =
  typeof whatsappDeliveryLogsTable.$inferSelect;
