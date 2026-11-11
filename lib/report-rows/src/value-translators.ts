// Bilingual value translators shared by report rows (web + API).
export function translateRoomType(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toLowerCase().trim();
  if (s.includes("deluxe") || s.includes("ديلوكس")) return "غرفة ديلوكس";
  if (s.includes("suite") || s.includes("جناح")) return "جناح";
  if (s.includes("family") || s.includes("عائلي")) return "جناح عائلي";
  if (s.includes("single") || s.includes("فردي")) return "غرفة فردية";
  if (s.includes("double") || s.includes("مزدوج")) return "غرفة مزدوجة";
  if (s.includes("triple") || s.includes("ثلاثي")) return "غرفة ثلاثية";
  if (s.includes("quad") || s.includes("رباعي")) return "غرفة رباعية";
  if (s.includes("standard") || s.includes("قياسي")) return "غرفة قياسية";
  return val;
}

export function translateGenderPolicy(val: string, ar: boolean): string {
  if (!val || val === "—") return ar ? "متاح للجميع / مختلط" : "Any / Mixed";
  const s = val.toLowerCase().trim();
  if (
    s.includes("female") ||
    s.includes("إناث") ||
    s.includes("بنات") ||
    s.includes("انثى") ||
    s === "f"
  ) {
    return ar ? "إناث فقط" : "Female";
  }
  if (
    (s.includes("male") && !s.includes("fe")) ||
    s.includes("ذكور") ||
    s.includes("شباب") ||
    s.includes("ذكر") ||
    s === "m"
  ) {
    return ar ? "ذكور فقط" : "Male";
  }
  if (s.includes("couple") || s.includes("أزواج"))
    return ar ? "أزواج" : "Couples";
  if (s.includes("any") || s.includes("mix") || s.includes("مختلط"))
    return ar ? "متاح للجميع / مختلط" : "Any / Mixed";
  return val;
}

export function translateProfileStatus(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toUpperCase().trim();
  if (s === "ACTIVE") return "نشط بالسكن";
  if (s === "VACATION") return "في إجازة";
  if (s === "UNASSIGNED") return "غير مسكن";
  if (s === "LEFT" || s === "CHECKED_OUT") return "غادر السكن";
  if (s === "TRANSFERRED") return "منقول";
  if (s === "SUSPENDED") return "موقوف";
  return val;
}

export function translateReservationStatus(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toUpperCase().trim();
  if (s === "UPCOMING") return "حجز قادم";
  if (s === "CONFIRMED") return "مؤكد";
  if (s === "CHECKED_IN") return "تم التسكين";
  if (s === "CANCELLED") return "ملغي";
  if (s === "NO_SHOW") return "لم يحضر";
  return val;
}

export function translateMaintenanceCategory(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toLowerCase().trim();
  if (s.includes("plumb") || s.includes("سباك")) return "سباكة وصحي";
  if (s.includes("electr") || s.includes("كهرب")) return "كهرباء وإنارة";
  if (
    s.includes("ac") ||
    s.includes("hvac") ||
    s.includes("تكييف") ||
    s.includes("تبريد")
  )
    return "تكييف وتبريد";
  if (s.includes("carpent") || s.includes("نجار")) return "نجارة وأثاث";
  if (s.includes("paint") || s.includes("دهان")) return "دهانات وديكور";
  if (s.includes("appliance") || s.includes("أجهز")) return "أجهزة كهربائية";
  if (s.includes("pest") || s.includes("حشرات")) return "مكافحة حشرات";
  if (s.includes("housekeep") || s.includes("نظاف"))
    return "إشراف داخلي / نظافة";
  if (s.includes("general") || s.includes("عام")) return "صيانة عامة";
  return val;
}

export function translateMaintenancePriority(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toLowerCase().trim();
  if (s.includes("urg") || s.includes("طارئ") || s.includes("عاجل"))
    return "عاجلة / طارئة";
  if (s.includes("high") || s.includes("مرتفع")) return "مرتفعة";
  if (s.includes("med") || s.includes("متوسط") || s.includes("norm"))
    return "متوسطة";
  if (s.includes("low") || s.includes("منخفض")) return "منخفضة";
  return val;
}

export function translateMaintenanceStatus(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toLowerCase().trim();
  if (
    s === "open" ||
    s === "pending" ||
    s.includes("انتظار") ||
    s.includes("مفتوح")
  )
    return "قيد الانتظار";
  if (s === "in_progress" || s.includes("تنفيذ") || s.includes("عمل"))
    return "جاري العمل";
  if (
    s === "completed" ||
    s === "resolved" ||
    s.includes("مكتمل") ||
    s.includes("تم")
  )
    return "تم الإنجاز";
  if (s === "cancelled" || s.includes("ملغي")) return "ملغي";
  if (s === "rejected" || s.includes("مرفوض")) return "مرفوض";
  return val;
}

export function translateHostingStatus(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toLowerCase().trim();
  if (s === "pending" || s.includes("انتظار")) return "بانتظار الموافقة";
  if (s === "approved" || s.includes("موافق")) return "معتمد";
  if (s === "active" || s.includes("ساري") || s.includes("حالي"))
    return "استضافة جارية";
  if (s === "completed" || s.includes("منتهي")) return "تمت المغادرة";
  if (s === "rejected" || s.includes("مرفوض")) return "مرفوض";
  return val;
}

export function translateHostingRelation(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toLowerCase().trim();
  if (s.includes("father") || s.includes("والد") || s.includes("أب"))
    return "والد";
  if (s.includes("mother") || s.includes("والدة") || s.includes("أم"))
    return "والدة";
  if (s.includes("wife") || s.includes("زوجة")) return "زوجة";
  if (s.includes("husband") || s.includes("زوج")) return "زوج";
  if (s.includes("brother") || s.includes("أخ")) return "أخ";
  if (s.includes("sister") || s.includes("أخت")) return "أخت";
  if (s.includes("son") || s.includes("ابن")) return "ابن";
  if (s.includes("daughter") || s.includes("ابنة")) return "ابنة";
  if (s.includes("friend") || s.includes("صديق")) return "صديق";
  return val;
}
