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
        "مرحباً بك أ/ {employee_name} في {property_name} 🌴✨\n\nيسعدنا إبلاغك بأنه تم إتمام إجراءات تسكينك بنجاح:\n🏢 المبنى: {building_name} ({floor_name})\n🚪 رقم الغرفة: {room_number}\n🛏️ السرير: {bed_label}\n📅 تاريخ التسكين: {checkin_date}\n\n🌐 رابط بوابة المقيمين:\n{portal_url}\n\n🔑 بيانات وطريقة تسجيل الدخول:\n• اسم المستخدم: {profile_id} (رقمك الوظيفي)\n• كلمة المرور الافتراضية: 1234\n*(يرجى استخدام كلمة المرور الشخصية إذا قمت بتعيينها مسبقاً، أو سيطلب منك النظام تعيين كلمة مرور جديدة فور أول تسجيل دخول)*\n\n📲 من خلال البوابة يمكنك:\n• تسجيل ومتابعة بلاغات الصيانة والأعطال\n• طلب خدمات النظافة والهاوس كيبنج\n• التقديم على تصاريح استضافة الأقارب والزيارات\n• المحادثة المباشرة مع مشرفي إدارة السكن\n\nنتمنى لك إقامة هانئة ومريحة! ✨"
      ),
    welcomeTemplateEn: text("welcome_template_en")
      .notNull()
      .default(
        "Welcome Mr/Ms {employee_name} to {property_name}! 🌴✨\n\nYour accommodation has been successfully confirmed:\n🏢 Building: {building_name} ({floor_name})\n🚪 Room: {room_number}\n🛏️ Bed: {bed_label}\n📅 Check-in Date: {checkin_date}\n\n🌐 Resident Portal Link:\n{portal_url}\n\n🔑 Portal Login Instructions:\n• Username: {profile_id} (Your Employee ID)\n• Default Password: 1234\n*(Please use your personal password if already set, or you will be prompted to set a new password upon your first sign-in)*\n\n📲 Through the portal you can:\n• Submit and track maintenance tickets\n• Request housekeeping & room cleaning\n• Apply for guest and visitor hosting permits\n• Chat directly with Housing Supervisors\n\nWe wish you a pleasant and comfortable stay! ✨"
      ),
    supervisorContact: text("supervisor_contact").default(""),
    isReservationSendEnabled: boolean("is_reservation_send_enabled").notNull().default(true),
    reservationTemplateAr: text("reservation_template_ar")
      .notNull()
      .default(
        "مرحباً بك أ/ {guest_name} في {property_name} 🌴✨\n\nيسعدنا تأكيد حجز إقامتك المسبق لدينا:\n🔖 رقم الحجز: #{reservation_id}\n🏢 المبنى / الغرفة: {room_info}\n🛏️ تفاصيل السرير: {bed_info}\n📅 تاريخ الوصول المتوقع: {checkin_date}\n📅 تاريخ المغادرة المتوقع: {checkout_date}\n\n🌐 رابط بوابة المقيمين:\n{portal_url}\n\nℹ️ تنويه: يُرجى التوجه لمكتب الإسكان فور وصولك لاستلام المفتاح وإتمام إجراءات التسكين.\n\nنتمنى لك رحلة موفقة وإقامة سعيدة! ✨"
      ),
    reservationTemplateEn: text("reservation_template_en")
      .notNull()
      .default(
        "Welcome Mr/Ms {guest_name} to {property_name}! 🌴✨\n\nWe are pleased to confirm your upcoming reservation:\n🔖 Booking Ref: #{reservation_id}\n🏢 Building / Room: {room_info}\n🛏️ Bed Info: {bed_info}\n📅 Expected Check-in: {checkin_date}\n📅 Expected Check-out: {checkout_date}\n\n🌐 Resident Portal Link:\n{portal_url}\n\nℹ️ Note: Please visit the Housing Office upon your arrival to complete check-in and collect your keys.\n\nWe wish you a safe trip and a pleasant stay! ✨"
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
    messageType: text("message_type").notNull().default("CHECKIN_WELCOME"), // CHECKIN_WELCOME | TEST | MANUAL | RESERVATION_CONFIRMATION | BROADCAST
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

export const whatsappOutboxQueueTable = pgTable(
  "whatsapp_outbox_queue",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull(),
    recipientPhone: text("recipient_phone").notNull(),
    recipientName: text("recipient_name"),
    messageType: text("message_type").notNull().default("CHECKIN_WELCOME"), // CHECKIN_WELCOME | RESERVATION_CONFIRMATION | BROADCAST | TEST | MANUAL
    messageContent: text("message_content").notNull(),
    status: text("status").notNull().default("PENDING"), // PENDING | PROCESSING | SENT | FAILED | NOT_REGISTERED
    retryCount: integer("retry_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_wa_outbox_property_status").on(table.propertyId, table.status),
    index("idx_wa_outbox_created_at").on(table.createdAt),
  ]
);

export const insertPropertyWhatsappConfigSchema = createInsertSchema(
  propertyWhatsappConfigsTable
).omit({
  id: true,
  updatedAt: true,
});

export const insertWhatsappOutboxQueueSchema = createInsertSchema(
  whatsappOutboxQueueTable
).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type InsertPropertyWhatsappConfig = z.infer<
  typeof insertPropertyWhatsappConfigSchema
>;
export type PropertyWhatsappConfig =
  typeof propertyWhatsappConfigsTable.$inferSelect;
export type WhatsappDeliveryLog =
  typeof whatsappDeliveryLogsTable.$inferSelect;
export type WhatsappOutboxQueueItem =
  typeof whatsappOutboxQueueTable.$inferSelect;
export type InsertWhatsappOutboxQueueItem = z.infer<
  typeof insertWhatsappOutboxQueueSchema
>;
