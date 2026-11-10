import { safeSchemaName } from "../pg-ident.js";
import { pool } from "@workspace/db";
import { ensureProfilePortalAccount } from "../portal-accounts.js";
import { DEFAULT_WELCOME_AR, DEFAULT_WELCOME_EN, DEFAULT_RESERVATION_AR, DEFAULT_RESERVATION_EN, compileWhatsAppTemplate, isArabicProfile } from "./templates.js";
import { getWhatsAppSession } from "./session.js";
import { sendWhatsAppMessageSafe, logDelivery } from "./send.js";

/**
 * Automatic Check-In WhatsApp Notification Handler
 */
export async function sendCheckInWhatsAppNotification(params: {
  propertyId: number;
  profileId: number;
  roomId: number;
  bedId?: number | null;
  startDate?: string;
}) {
  try {
    const { propertyId, profileId, roomId, bedId, startDate } = params;

    // 1. Check if WhatsApp is configured & auto-send is enabled
    const session = await getWhatsAppSession(propertyId);
    const configRes = await pool.query(
      `SELECT * FROM public.property_whatsapp_configs WHERE property_id = $1`,
      [propertyId]
    );
    const config = configRes.rows[0];
    
    // If auto send explicitly disabled in settings, skip
    if (config && config.is_auto_send_enabled === false) {
      console.log(`[WhatsApp Auto-Send] Auto send is disabled for property ${propertyId}, skipping.`);
      return;
    }

    // Resolve property & tenant schema name
    const propRes = await pool.query(
      `SELECT name, display_name, schema_name FROM public.properties WHERE id = $1`,
      [propertyId]
    );
    const prop = propRes.rows[0] || {};
    const schemaName = safeSchemaName(prop.schema_name);
    const propertyName = prop.display_name || prop.name || "Sunrise Housing";

    // 2. Fetch profile info from tenant schema (fallback to public if not found)
    let profileRes = await pool.query(
      `SELECT id, profile_id, first_name, last_name, phone, nationality FROM ${schemaName}.profiles WHERE id = $1`,
      [profileId]
    ).catch(() => ({ rows: [] as any[] }));

    if (!profileRes.rows[0]) {
      profileRes = await pool.query(
        `SELECT id, profile_id, first_name, last_name, phone, nationality FROM public.profiles WHERE id = $1`,
        [profileId]
      ).catch(() => ({ rows: [] as any[] }));
    }

    const profile = profileRes.rows[0];
    const fullName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : `Profile #${profileId}`;
    const employeeCode = (profile?.profile_id || String(profileId)).trim();

    // Auto ensure active portal account exists for this resident
    if (profile?.profile_id) {
      ensureProfilePortalAccount(propertyId, profile.profile_id).catch((err) => {
        console.warn("[WhatsApp Auto-Send] ensureProfilePortalAccount notice:", err?.message || err);
      });
    }

    if (!profile || !profile.phone || !profile.phone.trim()) {
      console.log(`[WhatsApp Auto-Send] Profile ${profileId} (${fullName}) has no phone number, skipping.`);
      await logDelivery(
        propertyId,
        "N/A",
        fullName || `Profile #${profileId}`,
        "CHECKIN_WELCOME",
        `تم تخطي الإرسال لعدم وجود رقم هاتف مسجل في ملف الموظف (${fullName || profileId}).`,
        "FAILED",
        "رقم هاتف الموظف غير مسجل في ملفه الشخصي (No phone number in profile)"
      ).catch(() => {});
      return;
    }

    // 3. Determine language dynamically based on nationality
    const isArabic = isArabicProfile(profile.nationality, profile.first_name, profile.last_name);
    console.log(
      `[WhatsApp Auto-Send] Profile ${profileId} nationality: "${profile.nationality || "unspecified"}" -> Selected language: ${isArabic ? "Arabic (عربي)" : "English"}`
    );

    // 4. Fetch room, floor, building info from tenant schema
    let roomRes = await pool.query(
      `SELECT r.room_number, f.floor_number as floor_name, b.name as building_name
       FROM ${schemaName}.rooms r
       LEFT JOIN ${schemaName}.floors f ON r.floor_id = f.id
       LEFT JOIN ${schemaName}.buildings b ON r.building_id = b.id
       WHERE r.id = $1`,
      [roomId]
    ).catch(() => ({ rows: [] as any[] }));

    if (!roomRes.rows[0]) {
      roomRes = await pool.query(
        `SELECT r.room_number, f.floor_number as floor_name, b.name as building_name
         FROM public.rooms r
         LEFT JOIN public.floors f ON r.floor_id = f.id
         LEFT JOIN public.buildings b ON r.building_id = b.id
         WHERE r.id = $1`,
        [roomId]
      ).catch(() => ({ rows: [] as any[] }));
    }
    const room = roomRes.rows[0] || {};

    // 5. Bed info
    let bedLabel = isArabic ? "سرير مخصص" : "Assigned Bed";
    if (bedId) {
      bedLabel = isArabic ? `سرير ${bedId}` : `Bed ${bedId}`;
    }

    // Floor label
    let floorLabel = room.floor_name
      ? (isArabic ? `الدور ${room.floor_name}` : `Floor ${room.floor_name}`)
      : (isArabic ? "الطابق الأول" : "First Floor");

    // Clean check-in date
    const cleanDate = (String(startDate || "").split("T")[0]) || new Date().toISOString().split("T")[0];

    // 6. Compile template based on detected language
    const portalUrl = process.env.PORTAL_URL || "https://resident.sunrise-resorts.com/portal/";

    const vars = {
      employee_name: fullName,
      profile_id: employeeCode,
      employee_id: employeeCode,
      property_name: propertyName,
      building_name: room.building_name || (isArabic ? "المبنى الرئيسي" : "Main Building"),
      floor_name: floorLabel,
      room_number: room.room_number || String(roomId),
      bed_label: bedLabel,
      checkin_date: cleanDate,
      portal_url: portalUrl,
      supervisor_contact: config?.supervisor_contact || "",
    };

    const template = isArabic
      ? (config?.welcome_template_ar || DEFAULT_WELCOME_AR)
      : (config?.welcome_template_en || DEFAULT_WELCOME_EN);
    const compiledMessage = compileWhatsAppTemplate(template, vars);

    // 7. Dispatch through safe queue
    console.log(`[WhatsApp Auto-Send] Queuing welcome notification for ${fullName} (${profile.phone}) in ${isArabic ? "Arabic" : "English"}`);
    sendWhatsAppMessageSafe(
      propertyId,
      profile.phone,
      compiledMessage,
      "CHECKIN_WELCOME",
      fullName
    ).catch((err) => {
      console.error("[WhatsApp Auto-Send] Failed to queue message:", err);
    });
  } catch (err: any) {
    console.error("[WhatsApp Auto-Send] Error in notification handler:", err);
  }
}

/**
 * Manually trigger or resend WhatsApp welcome notification for an assignment
 */
export async function sendWelcomeWhatsAppForAssignment(params: {
  propertyId: number;
  assignmentId: number;
  phoneOverride?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const { propertyId, assignmentId, phoneOverride } = params;

  // Resolve tenant schema name
  const propRes = await pool.query(
    `SELECT name, display_name, schema_name FROM public.properties WHERE id = $1`,
    [propertyId]
  );
  const prop = propRes.rows[0];
  if (!prop) return { success: false, error: "Property not found" };
  const schemaName = safeSchemaName(prop.schema_name);

  // Find assignment
  let assignRes = await pool.query(
    `SELECT * FROM ${schemaName}.assignments WHERE id = $1`,
    [assignmentId]
  ).catch(() => ({ rows: [] as any[] }));

  if (!assignRes.rows[0]) {
    assignRes = await pool.query(
      `SELECT * FROM public.assignments WHERE id = $1`,
      [assignmentId]
    ).catch(() => ({ rows: [] as any[] }));
  }

  const assignment = assignRes.rows[0];
  if (!assignment) {
    return { success: false, error: "Assignment record not found" };
  }

  // If phoneOverride provided, update profile phone in tenant schema
  if (phoneOverride && phoneOverride.trim()) {
    const cleanPhone = phoneOverride.trim();
    await pool.query(
      `UPDATE ${schemaName}.profiles SET phone = $1 WHERE id = $2`,
      [cleanPhone, assignment.profile_id]
    ).catch(() => {});
    await pool.query(
      `UPDATE public.profiles SET phone = $1 WHERE id = $2`,
      [cleanPhone, assignment.profile_id]
    ).catch(() => {});
  }

  // Trigger checkin notification
  await sendCheckInWhatsAppNotification({
    propertyId,
    profileId: assignment.profile_id,
    roomId: assignment.room_id,
    bedId: assignment.bed_number || assignment.bed_id || null,
    startDate: assignment.check_in_date || assignment.start_date,
  });

  return {
    success: true,
    message: "تم جدولة إرسال رسالة التسكين عبر الواتساب بنجاح",
  };
}

/**
 * Reservation Confirmation WhatsApp Notification
 */
export async function sendReservationConfirmationWhatsApp(params: {
  propertyId: number;
  reservationId: number;
  phoneOverride?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const { propertyId, reservationId, phoneOverride } = params;

    // 1. Check session & property configs
    const session = await getWhatsAppSession(propertyId);
    const configRes = await pool.query(
      `SELECT * FROM public.property_whatsapp_configs WHERE property_id = $1`,
      [propertyId]
    );
    const config = configRes.rows[0];

    if (config && config.is_reservation_send_enabled === false) {
      console.log(`[WhatsApp Reservation] Auto send is disabled for property ${propertyId}, skipping.`);
      return { success: false, error: "تم تعطيل إرسال تأكيد الحجز في إعدادات الواتساب" };
    }

    // Resolve property & tenant schema name
    const propRes = await pool.query(
      `SELECT name, display_name, schema_name FROM public.properties WHERE id = $1`,
      [propertyId]
    );
    const prop = propRes.rows[0] || {};
    const schemaName = safeSchemaName(prop.schema_name);
    const propertyName = prop.display_name || prop.name || "Sunrise Staff Housing";

    // 2. Fetch reservation details
    let resQuery = await pool.query(
      `SELECT * FROM ${schemaName}.reservations WHERE id = $1`,
      [reservationId]
    ).catch(() => ({ rows: [] as any[] }));

    if (!resQuery.rows[0]) {
      resQuery = await pool.query(
        `SELECT * FROM public.reservations WHERE id = $1`,
        [reservationId]
      ).catch(() => ({ rows: [] as any[] }));
    }

    const reservation = resQuery.rows[0];
    if (!reservation) {
      return { success: false, error: "سجل الحجز غير موجود" };
    }

    // If phone override provided, update reservation and matching profile
    let effectivePhone = (phoneOverride || reservation.guest_phone || "").trim();
    if (phoneOverride && phoneOverride.trim()) {
      await pool.query(
        `UPDATE ${schemaName}.reservations SET guest_phone = $1 WHERE id = $2`,
        [phoneOverride.trim(), reservationId]
      ).catch(() => {});
      await pool.query(
        `UPDATE public.reservations SET guest_phone = $1 WHERE id = $2`,
        [phoneOverride.trim(), reservationId]
      ).catch(() => {});

      if (reservation.profile_code || reservation.guest_id_card_number) {
        await pool.query(
          `UPDATE ${schemaName}.profiles SET phone = $1 
           WHERE (profile_id = $2 OR national_id = $3) AND (phone IS NULL OR phone = '')`,
          [phoneOverride.trim(), reservation.profile_code || "", reservation.guest_id_card_number || ""]
        ).catch(() => {});
        await pool.query(
          `UPDATE public.profiles SET phone = $1 
           WHERE (profile_id = $2 OR national_id = $3) AND (phone IS NULL OR phone = '')`,
          [phoneOverride.trim(), reservation.profile_code || "", reservation.guest_id_card_number || ""]
        ).catch(() => {});
      }
    }

    const fullName = `${reservation.first_name || ""} ${reservation.last_name || ""}`.trim() || "Guest";

    if (!effectivePhone) {
      console.log(`[WhatsApp Reservation] Reservation #${reservationId} (${fullName}) has no phone number, skipping.`);
      await logDelivery(
        propertyId,
        "N/A",
        fullName,
        "RESERVATION_CONFIRMATION",
        `تم تخطي الإرسال لعدم وجود رقم هاتف مسجل في بيانات الحجز (${fullName}).`,
        "FAILED",
        "رقم هاتف النزيل غير مسجل في بيانات الحجز (No phone number in reservation)"
      ).catch(() => {});
      return { success: false, error: "رقم هاتف النزيل غير مسجل في بيانات الحجز" };
    }

    // 3. Determine language
    const isArabic = isArabicProfile(reservation.nationality, reservation.first_name, reservation.last_name);

    // 4. Room & Bed info
    let roomInfo = isArabic ? "غرفة قياسية (تُحدد عند الوصول)" : "Standard Room (Assigned upon arrival)";
    let bedInfo = isArabic ? "حسب التوفر" : "Subject to availability";

    if (reservation.room_id) {
      let rRes = await pool.query(
        `SELECT r.room_number, f.floor_number as floor_name, b.name as building_name
         FROM ${schemaName}.rooms r
         LEFT JOIN ${schemaName}.floors f ON r.floor_id = f.id
         LEFT JOIN ${schemaName}.buildings b ON r.building_id = b.id
         WHERE r.id = $1`,
        [reservation.room_id]
      ).catch(() => ({ rows: [] as any[] }));

      if (!rRes.rows[0]) {
        rRes = await pool.query(
          `SELECT r.room_number, f.floor_number as floor_name, b.name as building_name
           FROM public.rooms r
           LEFT JOIN public.floors f ON r.floor_id = f.id
           LEFT JOIN public.buildings b ON r.building_id = b.id
           WHERE r.id = $1`,
          [reservation.room_id]
        ).catch(() => ({ rows: [] as any[] }));
      }

      const rData = rRes.rows[0];
      if (rData) {
        const bName = rData.building_name || "";
        const fLabel = rData.floor_name ? (isArabic ? `الدور ${rData.floor_name}` : `Floor ${rData.floor_name}`) : "";
        roomInfo = `${isArabic ? "غرفة" : "Room"} ${rData.room_number} ${bName ? `- ${bName}` : ""} ${fLabel ? `(${fLabel})` : ""}`.trim();
      }
    } else if (reservation.room_type) {
      roomInfo = reservation.room_type;
    }

    if (reservation.bed_number) {
      if (reservation.bed_number === "ALL") {
        bedInfo = isArabic ? "الغرفة بالكامل (حجز خاص)" : "Entire Room (Full Lock)";
      } else {
        bedInfo = isArabic ? `سرير رقم ${reservation.bed_number}` : `Bed #${reservation.bed_number}`;
      }
    }

    const checkInDate = (String(reservation.check_in_date || "").split("T")[0]) || "N/A";
    const checkOutDate = (String(reservation.check_out_date || "").split("T")[0]) || (isArabic ? "غير محدد" : "N/A");

    // 5. Compile template
    const portalUrl = process.env.PORTAL_URL || "https://resident.sunrise-resorts.com/portal/";

    const vars = {
      guest_name: fullName,
      property_name: propertyName,
      reservation_id: String(reservation.id),
      room_info: roomInfo,
      bed_info: bedInfo,
      checkin_date: checkInDate,
      checkout_date: checkOutDate,
      portal_url: portalUrl,
      supervisor_contact: config?.supervisor_contact || "",
    };

    const template = isArabic
      ? (config?.reservation_template_ar || DEFAULT_RESERVATION_AR)
      : (config?.reservation_template_en || DEFAULT_RESERVATION_EN);

    const compiledMessage = compileWhatsAppTemplate(template, vars);

    console.log(`[WhatsApp Reservation] Queuing confirmation for ${fullName} (${effectivePhone}) in ${isArabic ? "Arabic" : "English"}`);
    sendWhatsAppMessageSafe(
      propertyId,
      effectivePhone,
      compiledMessage,
      "RESERVATION_CONFIRMATION",
      fullName
    ).catch((err) => {
      console.error("[WhatsApp Reservation] Failed to queue message:", err);
    });

    return {
      success: true,
      message: isArabic ? "تم جدولة إرسال تأكيد الحجز بنجاح" : "Reservation confirmation queued successfully",
    };
  } catch (err: any) {
    console.error("[WhatsApp Reservation] Error in confirmation handler:", err);
    return { success: false, error: err.message };
  }
}

export interface BroadcastRecipient {
  profileId: number;
  name: string;
  phone: string;
  roomNumber?: string;
  buildingName?: string;
  floorName?: string;
}

/**
 * Broadcast Bulk Messaging with anti-ban safe queuing
 */
export async function sendWhatsAppBroadcast(params: {
  propertyId: number;
  recipients: BroadcastRecipient[];
  messageText: string;
}): Promise<{ total: number; queued: number; skippedNoPhone: number }> {
  const { propertyId, recipients, messageText } = params;

  // Resolve property name
  const propRes = await pool.query(
    `SELECT name, display_name FROM public.properties WHERE id = $1`,
    [propertyId]
  );
  const prop = propRes.rows[0] || {};
  const propertyName = prop.display_name || prop.name || "Sunrise Staff Housing";
  const portalUrl = process.env.PORTAL_URL || "https://resident.sunrise-resorts.com/portal/";

  let queued = 0;
  let skippedNoPhone = 0;

  for (const r of recipients) {
    const rawPhone = (r.phone || "").trim();
    if (!rawPhone) {
      skippedNoPhone++;
      continue;
    }

    // Compile dynamic variables
    const vars: Record<string, string> = {
      name: r.name || "",
      employee_name: r.name || "",
      room: r.roomNumber || "",
      room_number: r.roomNumber || "",
      building: r.buildingName || "",
      building_name: r.buildingName || "",
      floor: r.floorName || "",
      floor_name: r.floorName || "",
      property: propertyName,
      property_name: propertyName,
      portal_url: portalUrl,
    };

    const textToSend = compileWhatsAppTemplate(messageText, vars);

    sendWhatsAppMessageSafe(
      propertyId,
      rawPhone,
      textToSend,
      "BROADCAST",
      r.name
    ).catch((err) => {
      console.error(`[WhatsApp Broadcast] Error queuing for ${r.name}:`, err);
    });

    queued++;
  }

  return {
    total: recipients.length,
    queued,
    skippedNoPhone,
  };
}
