// Module-level constants/types of WhatsAppSettingsSection (moved verbatim).

export interface WhatsAppSettingsSectionProps {
  propertyId: number | null;
  language: string;
}

export const DEFAULT_TEMPLATE_AR = `مرحباً بك أ/ {employee_name} في {property_name} 🌴✨

يسعدنا إبلاغك بأنه تم إتمام إجراءات تسكينك بنجاح:
🏢 المبنى: {building_name} ({floor_name})
🚪 رقم الغرفة: {room_number}
🛏️ السرير: {bed_label}
📅 تاريخ التسكين: {checkin_date}

🌐 رابط بوابة المقيمين:
{portal_url}

🔑 بيانات وطريقة تسجيل الدخول:
• اسم المستخدم: {profile_id} (رقمك الوظيفي)
• كلمة المرور الافتراضية: 1234
*(يرجى استخدام كلمة المرور الشخصية إذا قمت بتعيينها مسبقاً، أو سيطلب منك النظام تعيين كلمة مرور جديدة فور أول تسجيل دخول)*

📲 من خلال البوابة يمكنك:
• تسجيل ومتابعة بلاغات الصيانة والأعطال
• طلب خدمات النظافة والهاوس كيبنج
• التقديم على تصاريح استضافة الأقارب والزيارات
• المحادثة المباشرة مع مشرفي إدارة السكن

💡 تنبيه هام: برجاء حفظ هذا الرقم باسم "سكن العاملين" في جهات اتصالك لتفعيل خدمات البوابة واستقبال التنبيهات دائماً.

نتمنى لك إقامة هانئة ومريحة! ✨`;

export const DEFAULT_TEMPLATE_EN = `Welcome Mr/Ms {employee_name} to {property_name}! 🌴✨

Your accommodation has been successfully confirmed:
🏢 Building: {building_name} ({floor_name})
🚪 Room: {room_number}
🛏️ Bed: {bed_label}
📅 Check-in Date: {checkin_date}

🌐 Resident Portal Link:
{portal_url}

🔑 Portal Login Instructions:
• Username: {profile_id} (Your Employee ID)
• Default Password: 1234
*(Please use your personal password if already set, or you will be prompted to set a new password upon your first sign-in)*

📲 Through the portal you can:
• Submit and track maintenance tickets
• Request housekeeping & room cleaning
• Apply for guest and visitor hosting permits
• Chat directly with Housing Supervisors

💡 Important: Please save this contact as "Staff Housing" to receive notifications and updates smoothly.

We wish you a pleasant and comfortable stay! ✨`;

export const DEFAULT_RES_TEMPLATE_AR = `مرحباً بك أ/ {guest_name} في {property_name} 🌴✨

يسعدنا تأكيد حجز إقامتك المسبق لدينا:
🔖 رقم الحجز: #{reservation_id}
🏢 المبنى / الغرفة: {room_info}
🛏️ تفاصيل السرير: {bed_info}
📅 تاريخ الوصول المتوقع: {checkin_date}
📅 تاريخ المغادرة المتوقع: {checkout_date}

🌐 رابط بوابة المقيمين:
{portal_url}

ℹ️ تنويه: يُرجى التوجه لمكتب الإسكان فور وصولك لاستلام المفتاح وإتمام إجراءات التسكين.

💡 تنبيه هام: برجاء حفظ هذا الرقم باسم "سكن العاملين" في جهات اتصالك لتفعيل خدمات البوابة واستقبال التنبيهات دائماً.

نتمنى لك رحلة موفقة وإقامة سعيدة! ✨`;

export const DEFAULT_RES_TEMPLATE_EN = `Welcome Mr/Ms {guest_name} to {property_name}! 🌴✨

We are pleased to confirm your upcoming reservation:
🔖 Booking Ref: #{reservation_id}
🏢 Building / Room: {room_info}
🛏️ Bed Info: {bed_info}
📅 Expected Check-in: {checkin_date}
📅 Expected Check-out: {checkout_date}

🌐 Resident Portal Link:
{portal_url}

ℹ️ Note: Please visit the Housing Office upon your arrival to complete check-in and collect your keys.

💡 Important: Please save this contact as "Staff Housing" to receive notifications and updates smoothly.

We wish you a safe trip and a pleasant stay! ✨`;

export const VARIABLE_TAGS = [
  { tag: "{employee_name}", labelAr: "اسم الموظف", labelEn: "Employee Name" },
  { tag: "{profile_id}", labelAr: "الرقم الوظيفي / كود الموظف", labelEn: "Employee / Profile ID" },
  { tag: "{property_name}", labelAr: "اسم السكن/الفندق", labelEn: "Property Name" },
  { tag: "{building_name}", labelAr: "اسم المبنى", labelEn: "Building" },
  { tag: "{floor_name}", labelAr: "الدور/الطابق", labelEn: "Floor" },
  { tag: "{room_number}", labelAr: "رقم الغرفة", labelEn: "Room No." },
  { tag: "{bed_label}", labelAr: "السرير", labelEn: "Bed" },
  { tag: "{checkin_date}", labelAr: "تاريخ التسكين", labelEn: "Check-in Date" },
  { tag: "{portal_url}", labelAr: "رابط البوابة", labelEn: "Portal Link" },
  { tag: "{supervisor_contact}", labelAr: "هاتف المشرف", labelEn: "Supervisor Phone" },
];

export const RESERVATION_TAGS = [
  { tag: "{guest_name}", labelAr: "اسم النزيل", labelEn: "Guest Name" },
  { tag: "{property_name}", labelAr: "اسم السكن/الفندق", labelEn: "Property Name" },
  { tag: "{reservation_id}", labelAr: "رقم الحجز", labelEn: "Booking Ref" },
  { tag: "{room_info}", labelAr: "المبنى والغرفة", labelEn: "Building & Room" },
  { tag: "{bed_info}", labelAr: "السرير", labelEn: "Bed" },
  { tag: "{checkin_date}", labelAr: "تاريخ الوصول", labelEn: "Check-in Date" },
  { tag: "{checkout_date}", labelAr: "تاريخ المغادرة", labelEn: "Check-out Date" },
  { tag: "{portal_url}", labelAr: "رابط البوابة", labelEn: "Portal Link" },
  { tag: "{supervisor_contact}", labelAr: "هاتف المشرف", labelEn: "Supervisor Phone" },
];
