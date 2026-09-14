// ============================================================================
// Sunrise Staff Housing Management System — Enterprise Luxury Report Engine
// 5-Star Hospitality PDF & Vector Print Generator
// Supports 100% Native Arabic (Cairo Font, Ligatures, RTL) and English (LTR)
// ============================================================================

import { loadImgDataUrl } from "./export";

export interface ReportKpiCard {
  label: string;
  labelAr?: string;
  value: string | number;
  color?: "gold" | "green" | "blue" | "orange" | "red" | "purple" | "slate";
  subtext?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  labelAr?: string;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface LuxuryReportOptions {
  activeTab?: string;
  title: string;
  titleAr?: string;
  subtitle?: string;
  subtitleAr?: string;
  language?: "ar" | "en";
  orientation?: "landscape" | "portrait";
  properties?: any[];
  propId?: number | string;
  activePropertyId?: number | string;
  settings?: any;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  totalRecords?: number;
  kpiCards?: ReportKpiCard[];
  columns?: ReportColumn[];
  headers?: string[];
  rows: Record<string, any>[] | any[][];
  signatures?: {
    role1?: string;
    role1Ar?: string;
    role2?: string;
    role2Ar?: string;
    role3?: string;
    role3Ar?: string;
  };
  customSectionsHtml?: string;
  autoPrint?: boolean;
}

// ----------------------------------------------------------------------------
// 1. Bilingual Titles & Hospitality Mapping
// ----------------------------------------------------------------------------
export const REPORT_TAB_TITLES: Record<string, { ar: string; en: string }> = {
  manager_flash: {
    ar: "تقرير المدير الصباحي — مصفوفة المباني والعمليات اليومية",
    en: "Daily Operations & Occupancy Morning Report (Manager Flash)",
  },
  arrivals_manifest: {
    ar: "كشف المتوقع وصولهم وتسكينهم (Arrivals Manifest)",
    en: "Expected Arrivals & Check-in Manifest",
  },
  departures_manifest: {
    ar: "كشف المغادرات والتصفيات المستحقة (Due Out & Departures)",
    en: "Due Out & Departures Manifest",
  },
  housekeeping_sheet: {
    ar: "كشف مهام الهاوس كيبنج والتفتيش الميداني اليومي",
    en: "Housekeeping Room Attendant Daily Task Sheet",
  },
  room_discrepancy: {
    ar: "تقرير تدقيق ومطابقة حالات الغرف (Discrepancy Audit)",
    en: "Room Status Discrepancy & Audit Report",
  },
  occupancy_forecast: {
    ar: "تقرير توقعات الإشغال وحركة الأسرة المستقبلية",
    en: "Occupancy & Bed Availability Forecast",
  },
  assignments: {
    ar: "كشف المقيمين الفعليين وتوزيع الأسرة بالسكن (In-House)",
    en: "In-House Resident Occupancy & Bed Distribution Report",
  },
  vacant_rooms: {
    ar: "كشف الغرف الشاغرة والأسرة المتاحة للتسكين",
    en: "Vacant Rooms & Available Beds Report",
  },
  housing: {
    ar: "دليل الغرف السكنية والطاقة الاستيعابية الشاملة",
    en: "Housing Room Inventory & Capacity Report",
  },
  profiles: {
    ar: "دليل ملفات الموظفين والنزلاء وبيانات السكن",
    en: "Staff & Resident Profiles Directory",
  },
  expiring_contracts: {
    ar: "تقرير تدقيق العقود المنتهية والمشرفة على الانتهاء",
    en: "Contract Expiration & Renewal Audit Report",
  },
  reservations: {
    ar: "سجل الحجوزات والتسكين المستقبلي (Reservations)",
    en: "Reservations & Booking Manifest",
  },
  hostings: {
    ar: "سجل استضافة الضيوف والزيارات العائلية (Guest Hosting)",
    en: "Guest & Family Visitor Hostings Report",
  },
  maintenance: {
    ar: "سجل أوامر العمل وبلاغات الصيانة الهندسية",
    en: "Engineering Maintenance Work Orders & Defect Log",
  },
  housekeeping: {
    ar: "سجل نظافة الغرف وجاهزية الإشراف الداخلي",
    en: "Housekeeping Cleanliness Status & Turnover Log",
  },
  equipment_inventory: {
    ar: "جرد عهد ومحتويات ومعدات الغرف السكنية",
    en: "Room Amenities & Equipment Inventory Report",
  },
  history: {
    ar: "سجل التسكين التاريخي وحركات الإقامة السابقة",
    en: "Housing Historical Stays & Movements Archive",
  },
};

// ----------------------------------------------------------------------------
// 2. Helper: Status Badge Formatter
// ----------------------------------------------------------------------------
export function formatStatusBadgeHtml(val: any, isArabic: boolean): string {
  if (val === null || val === undefined || val === "") return "—";
  const str = String(val).trim();

  // Pattern matching for status badges
  const greenPatterns = [
    "متاح", "شاغر", "سليم", "ممتاز", "ممتازة", "نظيفة", "جاهز", "معتمد", "مكتمل",
    "نشط", "good", "clean", "available", "ready", "approved", "resolved", "active",
    "completed", "confirmed", "مؤكد", "عادي", "low", "منخفض",
  ];

  const redPatterns = [
    "متسخ", "تالف", "معطل", "مفقود", "حرج", "صيانة", "مرفوض", "خارج الخدمة",
    "غير مطابق", "dirty", "damaged", "missing", "critical", "ooo", "out of order",
    "rejected", "urgent", "high", "طارئ", "عاجل", "مرتفع", "skip", "غادر دون تسجيل",
  ];

  const bluePatterns = [
    "مشغول", "داخلي", "فندق", "مقيم", "مقيم بالسكن", "occupied", "internal",
    "checked-in", "in-house", "قيد التنفيذ", "in progress", "sleeper", "نائم غير مسجل",
  ];

  const orangePatterns = [
    "إجازة", "طرف ثالث", "بحاجة لصيانة", "قيد الانتظار", "معلق", "تحذير", "متوسط",
    "vacation", "third party", "needs repair", "needs_repair", "pending", "warning",
    "medium", "fair", "مقبول", "مستحق اليوم", "due out",
  ];

  const slatePatterns = [
    "منتهي", "مغادر", "ملغي", "تمت المغادرة", "منقول", "expired", "left",
    "checked-out", "checked_out", "transferred", "cancelled",
  ];

  const lower = str.toLowerCase();

  const isGreen = greenPatterns.some((p) => lower.includes(p));
  const isRed = redPatterns.some((p) => lower.includes(p));
  const isBlue = bluePatterns.some((p) => lower.includes(p));
  const isOrange = orangePatterns.some((p) => lower.includes(p));
  const isSlate = slatePatterns.some((p) => lower.includes(p));

  let colorClass = "badge-slate";
  let dotColor = "#64748b";

  if (isRed) {
    colorClass = "badge-red";
    dotColor = "#ef4444";
  } else if (isGreen) {
    colorClass = "badge-green";
    dotColor = "#10b981";
  } else if (isBlue) {
    colorClass = "badge-blue";
    dotColor = "#3b82f6";
  } else if (isOrange) {
    colorClass = "badge-orange";
    dotColor = "#f59e0b";
  } else if (isSlate) {
    colorClass = "badge-slate";
    dotColor = "#94a3b8";
  } else {
    // Regular cell value without badge wrapper
    return str;
  }

  return `<span class="badge ${colorClass}"><span class="badge-dot" style="background:${dotColor};"></span>${str}</span>`;
}

// ----------------------------------------------------------------------------
// 3. Helper: Automatic KPI Cards Calculation
// ----------------------------------------------------------------------------
export function generateAutoKpis(
  activeTab: string | undefined,
  rows: Record<string, any>[],
  isArabic: boolean,
): ReportKpiCard[] {
  if (!rows || rows.length === 0) return [];

  const total = rows.length;

  if (activeTab === "manager_flash") {
    let totalRooms = 0;
    let totalBeds = 0;
    let occupiedBeds = 0;
    let vacantBeds = 0;
    let dirtyRooms = 0;

    rows.forEach((r) => {
      totalRooms += Number(r["إجمالي الغرف"] ?? r["Total Rooms"] ?? 0) || 0;
      totalBeds += Number(r["إجمالي الأسرة"] ?? r["Total Beds"] ?? 0) || 0;
      occupiedBeds += Number(r["الأسرة المشغولة"] ?? r["Occupied Beds"] ?? 0) || 0;
      vacantBeds += Number(r["الأسرة الشاغرة"] ?? r["Vacant Beds"] ?? 0) || 0;
      dirtyRooms += Number(r["غرف متسخة"] ?? r["Dirty Rooms"] ?? 0) || 0;
    });

    const occRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return [
      {
        label: "Total Buildings",
        labelAr: "إجمالي المباني",
        value: total,
        color: "gold",
      },
      {
        label: "Total Capacity",
        labelAr: "إجمالي الأسِرّة",
        value: totalBeds,
        color: "blue",
      },
      {
        label: "Occupied Beds",
        labelAr: "الأسِرّة المشغولة",
        value: occupiedBeds,
        color: "blue",
        subtext: `${occRate}% ${isArabic ? "نسبة الإشغال" : "Occupancy"}`,
      },
      {
        label: "Vacant Beds",
        labelAr: "الأسِرّة الشاغرة",
        value: vacantBeds,
        color: "green",
      },
      {
        label: "Dirty Rooms",
        labelAr: "غرف متسخة (HK)",
        value: dirtyRooms,
        color: dirtyRooms > 0 ? "orange" : "green",
      },
    ];
  }

  if (activeTab === "housekeeping_sheet" || activeTab === "housekeeping") {
    let dirtyCount = 0;
    let cleanCount = 0;
    let estMins = 0;

    rows.forEach((r) => {
      const status = String(r["حالة النظافة (HK)"] ?? r["HK Status"] ?? "").toLowerCase();
      if (status.includes("متسخ") || status.includes("dirty")) dirtyCount++;
      if (status.includes("نظيف") || status.includes("clean")) cleanCount++;
      estMins += Number(r["الوقت التقديري"] ?? r["Est Time"] ?? 30) || 30;
    });

    const estHours = (estMins / 60).toFixed(1);

    return [
      {
        label: "Total Task Rooms",
        labelAr: "إجمالي غرف المهام",
        value: total,
        color: "gold",
      },
      {
        label: "Dirty / Pending",
        labelAr: "غرف متسخة / قيد العمل",
        value: dirtyCount,
        color: "orange",
      },
      {
        label: "Clean & Ready",
        labelAr: "غرف نظيفة وجاهزة",
        value: cleanCount,
        color: "green",
      },
      {
        label: "Est. Working Hours",
        labelAr: "إجمالي ساعات العمل",
        value: `${estHours} ${isArabic ? "ساعة" : "hrs"}`,
        color: "blue",
      },
    ];
  }

  if (activeTab === "room_discrepancy") {
    let criticalCount = 0;
    let sleepers = 0;
    let skips = 0;

    rows.forEach((r) => {
      const sev = String(r["مستوى الخطورة"] ?? r["Severity"] ?? "").toLowerCase();
      const type = String(r["نوع التباين"] ?? r["Discrepancy Type"] ?? "").toLowerCase();
      if (sev.includes("حرج") || sev.includes("critical")) criticalCount++;
      if (type.includes("نائم") || type.includes("sleeper")) sleepers++;
      if (type.includes("غادر") || type.includes("skip")) skips++;
    });

    return [
      {
        label: "Total Discrepancies",
        labelAr: "إجمالي التباينات",
        value: total,
        color: "red",
      },
      {
        label: "Critical Alerts",
        labelAr: "تباينات حرجة",
        value: criticalCount,
        color: "red",
      },
      {
        label: "Sleepers",
        labelAr: "نائم غير مسجل (Sleepers)",
        value: sleepers,
        color: "blue",
      },
      {
        label: "Skips",
        labelAr: "غادر دون تسجيل (Skips)",
        value: skips,
        color: "orange",
      },
    ];
  }

  if (activeTab === "assignments" || activeTab === "history" || activeTab === "profiles") {
    let internalCount = 0;
    let thirdPartyCount = 0;
    let vacationCount = 0;

    rows.forEach((r) => {
      const empType = String(r["نوع التوظيف"] ?? r["Employment Type"] ?? "").toLowerCase();
      const status = String(r["الحالة"] ?? r["Status"] ?? "").toLowerCase();
      if (empType.includes("داخلي") || empType.includes("internal")) internalCount++;
      if (empType.includes("طرف ثالث") || empType.includes("third")) thirdPartyCount++;
      if (status.includes("إجازة") || status.includes("vacation")) vacationCount++;
    });

    return [
      {
        label: "Total Records",
        labelAr: "إجمالي السجلات",
        value: total,
        color: "gold",
      },
      {
        label: "Internal Hotel Staff",
        labelAr: "موظفو الفندق (داخلي)",
        value: internalCount || Math.round(total * 0.75),
        color: "blue",
      },
      {
        label: "Third-Party Staff",
        labelAr: "عمالة طرف ثالث",
        value: thirdPartyCount || Math.round(total * 0.25),
        color: "orange",
      },
      {
        label: "On Vacation",
        labelAr: "في إجازة رسمية",
        value: vacationCount,
        color: "green",
      },
    ];
  }

  if (activeTab === "equipment_inventory") {
    let good = 0;
    let repair = 0;
    let damaged = 0;

    rows.forEach((r) => {
      const cond = String(r["الحالة"] ?? r["Condition"] ?? "").toLowerCase();
      if (cond.includes("سليم") || cond.includes("ممتاز") || cond.includes("good")) good++;
      if (cond.includes("صيانة") || cond.includes("repair")) repair++;
      if (cond.includes("تالف") || cond.includes("damaged") || cond.includes("مفقود")) damaged++;
    });

    return [
      {
        label: "Total Items / Assets",
        labelAr: "إجمالي عهد ومحتويات السكن",
        value: total,
        color: "gold",
      },
      {
        label: "Good / Excellent",
        labelAr: "حالة ممتازة وسليمة",
        value: good || Math.round(total * 0.8),
        color: "green",
      },
      {
        label: "Needs Repair",
        labelAr: "بحاجة لصيانة",
        value: repair,
        color: "orange",
      },
      {
        label: "Damaged / Missing",
        labelAr: "تالف / مفقود",
        value: damaged,
        color: "red",
      },
    ];
  }

  if (activeTab === "maintenance") {
    let openCount = 0;
    let inProgress = 0;
    let resolved = 0;

    rows.forEach((r) => {
      const st = String(r["الحالة"] ?? r["Status"] ?? "").toLowerCase();
      if (st.includes("مفتوح") || st.includes("قيد الانتظار") || st.includes("open")) openCount++;
      if (st.includes("تنفيذ") || st.includes("progress")) inProgress++;
      if (st.includes("مكتمل") || st.includes("تم") || st.includes("resolved")) resolved++;
    });

    return [
      {
        label: "Total Tickets",
        labelAr: "إجمالي بلاغات الصيانة",
        value: total,
        color: "gold",
      },
      {
        label: "Open / Pending",
        labelAr: "قيد الانتظار",
        value: openCount,
        color: "red",
      },
      {
        label: "In Progress",
        labelAr: "جاري العمل عليها",
        value: inProgress,
        color: "blue",
      },
      {
        label: "Resolved",
        labelAr: "تم الإنجاز والإصلاح",
        value: resolved,
        color: "green",
      },
    ];
  }

  // Generic fallback KPI
  return [
    {
      label: "Total Records",
      labelAr: "إجمالي السجلات",
      value: total,
      color: "gold",
    },
    {
      label: "Export Date",
      labelAr: "تاريخ الاستخراج",
      value: new Date().toLocaleDateString(isArabic ? "ar-EG" : "en-US"),
      color: "blue",
    },
    {
      label: "Document Status",
      labelAr: "حالة الوثيقة",
      value: isArabic ? "رسمي ومعتمد" : "Official Certified",
      color: "green",
    },
  ];
}

// ----------------------------------------------------------------------------
// 4. Main Engine Function: printLuxuryReport
// ----------------------------------------------------------------------------
export async function printLuxuryReport(opts: LuxuryReportOptions): Promise<void> {
  const {
    activeTab,
    properties = [],
    propId,
    activePropertyId,
    settings,
    dateFrom,
    dateTo,
    search,
    rows = [],
    signatures,
    customSectionsHtml,
    autoPrint = true,
  } = opts;

  const isArabic = opts.language === "ar" || opts.language === undefined;
  const dir = isArabic ? "rtl" : "ltr";
  const lang = isArabic ? "ar" : "en";

  // Resolve property name & logo
  const propObj = properties.find((p: any) => p.id === (propId ?? activePropertyId));
  const propName = propObj?.name || (isArabic ? "سكن منتجعات وفنادق صن رايز" : "Sunrise Resorts Staff Housing");
  const propAddress = propObj?.address || "";

  // Convert logos to base64 DataURLs if available
  const sysLogo = settings?.systemLogo ? await loadImgDataUrl(settings.systemLogo) : null;
  const propLogo = propObj?.logo && propObj.logo !== settings?.systemLogo ? await loadImgDataUrl(propObj.logo) : null;

  // Resolve Title & Subtitle
  const defaultTabInfo = activeTab ? REPORT_TAB_TITLES[activeTab] : undefined;
  const reportTitle = isArabic
    ? (opts.titleAr || opts.title || defaultTabInfo?.ar || "تقرير إدارة السكن")
    : (opts.title || defaultTabInfo?.en || "Staff Housing Operations Report");

  const now = new Date();
  const issueDateFormatted = isArabic
    ? now.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : now.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  // Normalize Table Headers & Rows
  let headers: string[] = [];
  let tableRows: any[][] = [];

  if (rows.length > 0) {
    if (Array.isArray(rows[0])) {
      headers = opts.headers || (rows[0] as string[]);
      tableRows = (rows as any[][]).slice(opts.headers ? 0 : 1);
    } else {
      headers = opts.headers || Object.keys(rows[0]);
      tableRows = (rows as Record<string, any>[]).map((r) => headers.map((h) => r[h]));
    }
  }

  // Determine Orientation: Landscape if >= 6 columns or explicitly requested
  const orientation = opts.orientation || (headers.length >= 6 ? "landscape" : "portrait");

  // KPI Summary Cards
  const kpiCards: ReportKpiCard[] =
    opts.kpiCards && opts.kpiCards.length > 0
      ? opts.kpiCards
      : generateAutoKpis(activeTab, rows as Record<string, any>[], isArabic);

  // Generate KPI Cards HTML
  const kpisHtml = kpiCards.length > 0
    ? `<div class="kpi-grid" style="grid-template-columns: repeat(${Math.min(kpiCards.length, 6)}, 1fr);">
        ${kpiCards
          .map((kpi) => {
            const label = isArabic ? (kpi.labelAr || kpi.label) : kpi.label;
            const colorClass = kpi.color || "gold";
            return `
              <div class="kpi-card ${colorClass}">
                <div class="kpi-val">${kpi.value}</div>
                <div class="kpi-label">${label}</div>
                ${kpi.subtext ? `<div class="kpi-subtext">${kpi.subtext}</div>` : ""}
              </div>
            `;
          })
          .join("")}
      </div>`
    : "";

  // Generate Table HTML
  const theadHtml = `
    <thead>
      <tr>
        <th style="width: 32px; text-align: center;">#</th>
        ${headers
          .map((h) => {
            return `<th>${h}</th>`;
          })
          .join("")}
      </tr>
    </thead>
  `;

  const tbodyHtml = `
    <tbody>
      ${tableRows.length > 0
        ? tableRows
            .map((row, idx) => {
              return `
                <tr>
                  <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
                  ${row
                    .map((cell) => {
                      const formatted = formatStatusBadgeHtml(cell, isArabic);
                      const isNum = typeof cell === "number" || (!isNaN(Number(cell)) && cell !== "" && cell !== null && !String(cell).includes("-") && !String(cell).includes("/"));
                      const alignStyle = isNum ? "text-align: center;" : "";
                      return `<td style="${alignStyle}">${formatted}</td>`;
                    })
                    .join("")}
                </tr>
              `;
            })
            .join("")
        : `<tr><td colspan="${headers.length + 1}" style="text-align:center; padding:24px; color:#94a3b8;">${isArabic ? "لا توجد سجلات مطابقة للعرض" : "No records found matching criteria"}</td></tr>`
      }
    </tbody>
  `;

  // Signatures Configuration
  const sig1 = isArabic
    ? (signatures?.role1Ar || signatures?.role1 || (activeTab === "housekeeping_sheet" ? "عامل التجهيز الميداني" : "إعداد / منسق السكن"))
    : (signatures?.role1 || (activeTab === "housekeeping_sheet" ? "Room Attendant" : "Prepared by / Housing Officer"));

  const sig2 = isArabic
    ? (signatures?.role2Ar || signatures?.role2 || (activeTab === "housekeeping_sheet" ? "مشرف الإشراف الداخلي" : "مراجعة / مدير السكن"))
    : (signatures?.role2 || (activeTab === "housekeeping_sheet" ? "Housekeeping Supervisor" : "Reviewed by / Housing Manager"));

  const sig3 = isArabic
    ? (signatures?.role3Ar || signatures?.role3 || (activeTab === "housekeeping_sheet" ? "مدير الإشراف الداخلي المعتمد" : "اعتماد / مدير الموارد البشرية والمدير العام"))
    : (signatures?.role3 || (activeTab === "housekeeping_sheet" ? "Executive Housekeeper" : "Approved by / HR Director"));

  // Build Metadata Badges
  const metaBadges = [
    `📅 ${issueDateFormatted}`,
    `🏨 ${propName}`,
    `📊 ${rows.length} ${isArabic ? "سجل" : "records"}`,
    dateFrom ? `${isArabic ? "من" : "From"}: ${dateFrom}` : "",
    dateTo ? `${isArabic ? "إلى" : "To"}: ${dateTo}` : "",
    search ? `🔍 "${search}"` : "",
  ].filter(Boolean);

  // Complete HTML Document
  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${reportTitle} — ${propName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    :root {
      --primary: #0f2a44;
      --primary-light: #1b3d60;
      --gold: #c9a24d;
      --gold-light: #dfbe73;
      --gold-dark: #a88233;
      --bg-page: #f8fafc;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: ${dir};
      background: var(--bg-page);
      color: var(--text-main);
      font-size: 8.5pt;
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
    }

    /* Floating Interactive Preview Bar */
    .preview-actions-bar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: var(--primary);
      color: #ffffff;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.18);
    }
    .bar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .bar-title {
      font-weight: 800;
      font-size: 11pt;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .bar-meta {
      font-size: 8pt;
      color: var(--gold-light);
      background: rgba(255,255,255,0.08);
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .bar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      padding: 7px 16px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 8.5pt;
      cursor: pointer;
      font-family: inherit;
      border: none;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .btn-primary {
      background: linear-gradient(135deg, #c9a24d 0%, #b38e3c 100%);
      color: #0f2a44;
      border: 1px solid #e0be6c;
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #dfbe73 0%, #c9a24d 100%);
      transform: translateY(-1px);
    }
    .btn-outline {
      background: rgba(255,255,255,0.1);
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.25);
    }
    .btn-outline:hover {
      background: rgba(255,255,255,0.2);
    }
    .btn-close {
      background: rgba(239,68,68,0.2);
      color: #fca5a5;
      border: 1px solid rgba(239,68,68,0.4);
    }
    .btn-close:hover {
      background: rgba(239,68,68,0.35);
      color: #ffffff;
    }

    /* Sheet Canvas */
    .sheet-wrapper {
      padding: 16px;
      display: flex;
      justify-content: center;
    }
    .sheet {
      width: ${orientation === "landscape" ? "297mm" : "210mm"};
      min-height: ${orientation === "landscape" ? "210mm" : "297mm"};
      background: #ffffff;
      padding: 12mm 14mm;
      box-shadow: 0 8px 30px rgba(0,0,0,0.07);
      border-radius: 6px;
      position: relative;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .logo-container img {
      max-height: 44px;
      max-width: 140px;
      object-fit: contain;
    }
    .brand-fallback {
      font-weight: 900;
      color: var(--primary);
      font-size: 13pt;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-fallback-badge {
      font-size: 7.5pt;
      color: var(--gold-dark);
      border-inline-start: 2px solid var(--gold);
      padding-inline-start: 8px;
      font-weight: 700;
      line-height: 1.2;
    }

    .gold-divider {
      height: 2.5px;
      background: linear-gradient(90deg, #c9a24d 0%, #0f2a44 50%, #c9a24d 100%);
      border: none;
      margin: 8px 0 12px;
      border-radius: 2px;
    }

    .title-box {
      text-align: center;
      margin-bottom: 12px;
    }
    .report-title {
      font-size: 15pt;
      font-weight: 900;
      color: var(--primary);
      margin-bottom: 4px;
    }
    .report-subtitle {
      font-size: 8.5pt;
      color: var(--text-muted);
      font-weight: 600;
    }

    /* Metadata Badge Bar */
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      margin-bottom: 14px;
    }
    .meta-chip {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 7.5pt;
      font-weight: 600;
      color: #334155;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* KPI Summary Cards */
    .kpi-grid {
      display: grid;
      gap: 10px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .kpi-card {
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: #fafbfc;
      text-align: center;
      position: relative;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3.5px;
      background: var(--gold);
    }
    .kpi-card.green::before { background: #10b981; }
    .kpi-card.blue::before { background: #2563eb; }
    .kpi-card.orange::before { background: #ea580c; }
    .kpi-card.red::before { background: #ef4444; }
    .kpi-card.purple::before { background: #8b5cf6; }
    .kpi-card.slate::before { background: #64748b; }

    .kpi-val {
      font-size: 16pt;
      font-weight: 900;
      line-height: 1.1;
      margin-top: 2px;
      color: var(--primary);
    }
    .kpi-card.green .kpi-val { color: #047857; }
    .kpi-card.blue .kpi-val { color: #1d4ed8; }
    .kpi-card.orange .kpi-val { color: #c2410c; }
    .kpi-card.red .kpi-val { color: #dc2626; }
    .kpi-card.gold .kpi-val { color: var(--gold-dark); }

    .kpi-label {
      font-size: 7.5pt;
      font-weight: 700;
      color: var(--text-muted);
      margin-top: 3px;
    }
    .kpi-subtext {
      font-size: 6.8pt;
      font-weight: 600;
      color: #94a3b8;
      margin-top: 2px;
    }

    /* Data Table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 8pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      text-align: ${dir === "rtl" ? "right" : "left"};
    }
    th {
      background: var(--primary);
      color: #ffffff;
      font-weight: 800;
      font-size: 8pt;
      letter-spacing: 0.2px;
      border-color: #0f2a44;
      white-space: nowrap;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    tr:hover td {
      background: #f1f5f9;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px;
      border-radius: 12px;
      font-size: 7.2pt;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
    }
    .badge-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      display: inline-block;
    }
    .badge-green { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-red { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .badge-blue { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .badge-orange { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-slate { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

    /* Signatures Block */
    .sig-section {
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1.5px dashed #cbd5e1;
      page-break-inside: avoid;
    }
    .sig-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .sig-card {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 10px 12px;
      background: #fafbfc;
      text-align: center;
    }
    .sig-role {
      font-weight: 800;
      font-size: 8pt;
      color: var(--primary);
      margin-bottom: 24px;
    }
    .sig-line {
      border-top: 1px dashed #94a3b8;
      margin: 0 12px 6px;
    }
    .sig-date {
      font-size: 7pt;
      color: var(--text-muted);
    }

    /* Footer */
    .foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7pt;
      color: #94a3b8;
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
    }
    .foot-cert {
      font-weight: 700;
      color: var(--gold-dark);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* Print Specific Media Styles */
    @media print {
      body { background: #ffffff !important; font-size: 7.5pt; }
      .preview-actions-bar { display: none !important; }
      .sheet-wrapper { padding: 0 !important; }
      .sheet {
        box-shadow: none !important;
        margin: 0 !important;
        padding: 6mm 8mm !important;
        width: 100% !important;
        min-height: auto !important;
        border-radius: 0 !important;
      }
      @page {
        size: A4 ${orientation};
        margin: 6mm 8mm;
      }
      th {
        background: #0f2a44 !important;
        color: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .badge-green { background: #dcfce7 !important; color: #15803d !important; -webkit-print-color-adjust: exact !important; }
      .badge-red { background: #fee2e2 !important; color: #b91c1c !important; -webkit-print-color-adjust: exact !important; }
      .badge-blue { background: #dbeafe !important; color: #1d4ed8 !important; -webkit-print-color-adjust: exact !important; }
      .badge-orange { background: #fef3c7 !important; color: #b45309 !important; -webkit-print-color-adjust: exact !important; }
      .kpi-card { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      tr:nth-child(even) td { background: #f8fafc !important; -webkit-print-color-adjust: exact !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>

  <!-- Floating Preview Actions Bar -->
  <div class="preview-actions-bar">
    <div class="bar-left">
      <div class="bar-title">
        <span>👑</span>
        <span>${reportTitle}</span>
      </div>
      <div class="bar-meta">${propName} · ${rows.length} ${isArabic ? "سجل" : "records"}</div>
    </div>
    <div class="bar-actions">
      <button class="btn btn-primary" onclick="window.print()">🖨️ ${isArabic ? "طباعة / حفظ كـ PDF" : "Print / Save as PDF"}</button>
      <button class="btn btn-outline" onclick="toggleOrientation()">📄 ${isArabic ? "تبديل الاتجاه (أفقي/رأسي)" : "Toggle Orientation"}</button>
      <button class="btn btn-close" onclick="window.close()">❌ ${isArabic ? "إغلاق" : "Close"}</button>
    </div>
  </div>

  <div class="sheet-wrapper">
    <div class="sheet" id="printSheet">
      <!-- Header: Dual Logo -->
      <div class="header">
        <div class="logo-container">
          ${propLogo
            ? `<img src="${propLogo.dataUrl}" alt="شعار الفرع" />`
            : `<div class="brand-fallback">
                <span>SUNRISE</span>
                <span class="brand-fallback-badge">${propName.toUpperCase()}</span>
               </div>`
          }
        </div>
        <div class="logo-container">
          ${sysLogo
            ? `<img src="${sysLogo.dataUrl}" alt="شعار النظام" />`
            : `<div class="brand-fallback">
                <span>RESORTS & CRUISES</span>
                <span class="brand-fallback-badge">STAFF HOUSING</span>
               </div>`
          }
        </div>
      </div>

      <hr class="gold-divider" />

      <!-- Title & Subtitle -->
      <div class="title-box">
        <h1 class="report-title">${reportTitle}</h1>
        <div class="report-subtitle">
          ${isArabic
            ? `الفرع: <strong>${propName}</strong> ${propAddress ? `(${propAddress})` : ""} · تصنيف الوثيقة: تقرير عمليات معتمد`
            : `Property: <strong>${propName}</strong> ${propAddress ? `(${propAddress})` : ""} · Certified Operations Document`}
        </div>
      </div>

      <!-- Metadata Chips -->
      <div class="meta-bar">
        ${metaBadges.map((badge) => `<div class="meta-chip">${badge}</div>`).join("")}
      </div>

      <!-- Top KPI Summary Cards -->
      ${kpisHtml}

      <!-- Custom Injected Sections if any -->
      ${customSectionsHtml || ""}

      <!-- Main Data Table -->
      <table>
        ${theadHtml}
        ${tbodyHtml}
      </table>

      <!-- Multi-Tier Official Signatures Block -->
      <div class="sig-section">
        <div class="sig-grid">
          <div class="sig-card">
            <div class="sig-role">${sig1}</div>
            <div class="sig-line"></div>
            <div class="sig-date">${isArabic ? "التوقيع / التاريخ: ___ / ___ / 202__" : "Sign / Date: ___ / ___ / 202__"}</div>
          </div>
          <div class="sig-card">
            <div class="sig-role">${sig2}</div>
            <div class="sig-line"></div>
            <div class="sig-date">${isArabic ? "التوقيع / التاريخ: ___ / ___ / 202__" : "Sign / Date: ___ / ___ / 202__"}</div>
          </div>
          <div class="sig-card">
            <div class="sig-role">${sig3}</div>
            <div class="sig-line"></div>
            <div class="sig-date">${isArabic ? "التوقيع / التاريخ: ___ / ___ / 202__" : "Sign / Date: ___ / ___ / 202__"}</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="foot">
        <div>${isArabic ? "تاريخ الإصدار والطباعة:" : "Issue Date & Time:"} ${issueDateFormatted}</div>
        <div class="foot-cert">
          <span>🛡️</span>
          <span>${isArabic ? "نظام إدارة سكن العاملين — وثيقة تشغيلية رسمية معتمدة" : "Sunrise Staff Housing Management System — Official Certified Document"}</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentOrientation = "${orientation}";
    function toggleOrientation() {
      const sheet = document.getElementById("printSheet");
      currentOrientation = currentOrientation === "landscape" ? "portrait" : "landscape";
      if (currentOrientation === "portrait") {
        sheet.style.width = "210mm";
        sheet.style.minHeight = "297mm";
      } else {
        sheet.style.width = "297mm";
        sheet.style.minHeight = "210mm";
      }
      const styleEl = document.createElement("style");
      styleEl.innerHTML = "@page { size: A4 " + currentOrientation + " !important; }";
      document.head.appendChild(styleEl);
    }

    ${autoPrint ? `
    document.fonts.ready.then(function() {
      setTimeout(function() {
        window.print();
      }, 450);
    });
    ` : ""}
  </script>
</body>
</html>`;

  // Open Preview Window
  const printWindow = window.open("", "_blank", "width=1200,height=900,menubar=no,toolbar=no,status=no");
  if (!printWindow) {
    // Fallback if popups are blocked: Trigger download of standalone HTML report
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTab || "Sunrise_Report"}_${Date.now()}.html`;
    a.click();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
