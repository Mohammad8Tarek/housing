

export const DEFAULT_WELCOME_AR = `{مرحباً بك|أهلاً وسهلاً بك|تحياتنا الطيبة لك|عزيزنا} أ/ {employee_name} في {property_name} 🌴✨

{يسعدنا إبلاغك بأنه تم إتمام وتأكيد إجراءات تسكينك بنجاح|نحيطك علماً باعتماد تفاصيل تسكينك وإقامتك المعتمدة|تم الانتهاء من تجهيز وتأكيد غرفة إقامتك بنجاح}:
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

{نتمنى لك إقامة هانئة ومريحة! ✨|إقامة سعيدة وموفقة بإذن الله تعالى! 🌴|نسعد دائماً بوجودك ونتمنى لك وقتاً ممتعاً ومريحاً! ✨}

━━━━━━━━━━━━━━━━━━━━
🏨 إدارة سكن العاملين — مجموعة فنادق صن رايز
💡 تنبيه هام: برجاء حفظ هذا الرقم باسم "سكن العاملين" في جهات اتصالك لتفعيل خدمات البوابة واستقبال التنبيهات دائماً.
📌 للرد أو الاستفسار يمكنك إرسال رسالة مباشرة، أو للإلغاء أرسل 0.`;

export const DEFAULT_WELCOME_EN = `{Welcome|Greetings|Warm welcome} Mr/Ms {employee_name} to {property_name}! 🌴✨

{Your accommodation has been successfully confirmed|We are pleased to confirm your room assignment details|Your staff housing placement is now officially ready}:
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

{We wish you a pleasant and comfortable stay! ✨|Wishing you a safe and joyful stay! 🌴|We are glad to have you with us! ✨}

━━━━━━━━━━━━━━━━━━━━
🏨 Staff Housing Management — SUNRISE Resorts
📌 Official automated service notification. For inquiries or support, please reply to this message or visit the housing office.`;

export const DEFAULT_RESERVATION_AR = `{مرحباً بك|أهلاً وسهلاً بك|تحياتنا الطيبة لك} أ/ {guest_name} في {property_name} 🌴✨

{يسعدنا تأكيد حجز إقامتك المسبق لدينا|تم تسجيل واعتماد بيانات حجز إقامتك القادمة بنجاح|يسرنا إحاطتك علماً بتفاصيل حجز إقامتك لدينا}:
🔖 رقم الحجز: #{reservation_id}
🏢 المبنى / الغرفة: {room_info}
🛏️ تفاصيل السرير: {bed_info}
📅 تاريخ الوصول المتوقع: {checkin_date}
📅 تاريخ المغادرة المتوقع: {checkout_date}

🌐 رابط بوابة المقيمين:
{portal_url}

ℹ️ تنويه: يُرجى التوجه لمكتب الإسكان فور وصولك لاستلام المفتاح وإتمام إجراءات التسكين.

{نتمنى لك رحلة موفقة وإقامة سعيدة! ✨|نسعد باستقبالك ونتمنى لك إقامة ممتعة! 🌴|مع خالص تمنياتنا لك بإقامة طيبة ومريحة! ✨}

━━━━━━━━━━━━━━━━━━━━
🏨 إدارة سكن العاملين — مجموعة فنادق صن رايز
📌 رسالة آلية رسمية لتأكيد حجز السكن. للتواصل أو الاستفسار يرجى الرد هنا أو مراجعة مكتب الإسكان.`;

export const DEFAULT_RESERVATION_EN = `{Welcome|Greetings|Warm welcome} Mr/Ms {guest_name} to {property_name}! 🌴✨

{We are pleased to confirm your upcoming reservation|Your staff accommodation booking is confirmed|We are delighted to confirm your upcoming stay}:
🔖 Booking Ref: #{reservation_id}
🏢 Building / Room: {room_info}
🛏️ Bed Info: {bed_info}
📅 Expected Check-in: {checkin_date}
📅 Expected Check-out: {checkout_date}

🌐 Resident Portal Link:
{portal_url}

ℹ️ Note: Please visit the Housing Office upon your arrival to complete check-in and collect your keys.

{We wish you a safe trip and a pleasant stay! ✨|Looking forward to welcoming you! 🌴|Wishing you a safe journey and great stay! ✨}

━━━━━━━━━━━━━━━━━━━━
🏨 Staff Housing Management — SUNRISE Resorts
📌 Official automated reservation notice. For assistance, please reply to this message or contact the housing office.`;

/**
 * Resolves Spintax format: {option1|option2|option3} into a random choice.
 * Ensures natural linguistic variation across messages to evade duplicate text detection.
 */
export function resolveSpintax(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text.replace(/\{([^{}]+)\}/g, (match, contents) => {
    if (contents.includes("|")) {
      const parts = contents.split("|");
      return parts[Math.floor(Math.random() * parts.length)];
    }
    return match;
  });
}

/**
 * Cleans and prepares message text for safe dispatch.
 * Avoids any zero-width characters (like \u200B) which trigger Meta's automated spam classification.
 * Natural variation is achieved cleanly via Spintax ({opt1|opt2}) in message templates.
 */
export function injectAntiBanFingerprint(text: string, _seed?: string | number): string {
  if (!text || typeof text !== "string") return text;
  return text.trim();
}

/**
 * Clean & normalize phone number for WhatsApp
 */
export function normalizePhoneNumber(rawPhone: string): string {
  let cleaned = rawPhone.replace(/[^0-9]/g, "");
  // Egyptian numbers: 01xxxxxxxxx (11 digits) -> 201xxxxxxxxx
  if (cleaned.startsWith("01") && cleaned.length === 11) {
    cleaned = "2" + cleaned;
  } else if (cleaned.startsWith("1") && cleaned.length === 10) {
    cleaned = "20" + cleaned;
  }
  // Strip any leading zeros
  cleaned = cleaned.replace(/^0+/, "");
  return cleaned;
}

/**
 * Compile template variables
 */
export function compileWhatsAppTemplate(
  template: string,
  vars: Record<string, string | number | undefined | null>
): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    const regex = new RegExp(`{${key}}`, "g");
    result = result.replace(regex, String(val ?? ""));
  }
  // Anti-ban Spintax resolution: ensures each recipient receives a uniquely phrased message
  result = resolveSpintax(result);
  return result;
}

/**
 * Determines whether a profile's nationality or identity is Arabic-speaking.
 * Checks nationality text, demonyms, Arabic script, and name characters.
 */
export function isArabicProfile(
  nationality?: string | null,
  firstName?: string | null,
  lastName?: string | null
): boolean {
  if (nationality && nationality.trim()) {
    const raw = nationality.trim().toLowerCase();

    // Check for any Arabic script characters (e.g. "مصر", "مصري", "سعودي")
    if (/[\u0600-\u06FF]/.test(raw)) {
      return true;
    }

    // 2. Exact matches for 2/3 letter country codes
    const shortCodes = new Set([
      "eg", "egy", "ksa", "uae", "kw", "kwt", "qa", "qat", 
      "bh", "bhr", "om", "omn", "ye", "yem", "jo", "jor", 
      "lb", "lbn", "sy", "syr", "iq", "irq", "ps", "pse", 
      "sd", "sdn", "ly", "lby", "tn", "tun", "dz", "dza", 
      "ma", "mar", "mr", "mrt", "so", "som", "dj", "dji", "km", "com"
    ]);
    if (shortCodes.has(raw)) {
      return true;
    }

    // 3. Whole-word matching for Arabic country names and demonyms
    const arabicWords = [
      "egypt", "egyptian", "egyptians",
      "saudi", "saudi arabia", "saudis",
      "united arab emirates", "emirates", "emirati", "emiratis",
      "kuwait", "kuwaiti", "kuwaitis",
      "qatar", "qatari", "qataris",
      "bahrain", "bahraini", "bahrainis",
      "oman", "omani", "omanis",
      "yemen", "yemeni", "yemenis",
      "jordan", "jordanian", "jordanians",
      "lebanon", "lebanese",
      "syria", "syrian", "syrians",
      "iraq", "iraqi", "iraqis",
      "palestine", "palestinian", "palestinians",
      "sudan", "sudanese",
      "libya", "libyan", "libyans",
      "tunisia", "tunisian", "tunisians",
      "algeria", "algerian", "algerians",
      "morocco", "moroccan", "moroccans",
      "mauritania", "mauritanian", "mauritanians",
      "somalia", "somali", "somalis",
      "djibouti", "djiboutian", "djiboutians",
      "comoros", "comorian", "comorians",
      "arab", "arabic"
    ];

    const regex = new RegExp(`\\b(${arabicWords.join("|")})\\b`, "i");
    if (regex.test(raw)) {
      return true;
    }

    // Explicit foreign nationality (e.g. Russia, Ukraine, Italy, India, Kazakhstan, etc.)
    return false;
  }

  // Fallback if nationality is not set: check if person's name has Arabic characters
  const fullName = `${firstName || ""} ${lastName || ""}`.trim();
  if (/[\u0600-\u06FF]/.test(fullName)) {
    return true;
  }

  // Default to Arabic in local hotel context if completely unspecified
  return true;
}
