// ============================================================================
// Sunrise Staff Housing Management System — Enterprise Luxury Report Engine
// Main entry: printLuxuryReport. Helpers live in report-*.ts and are re-exported here for backward compatibility.
// ============================================================================

import { loadImgDataUrl } from "./export";
import type { LuxuryReportOptions, ReportKpiCard } from "./report-types";
import { REPORT_OPERA_CODES, REPORT_TAB_CONFIG, REPORT_TAB_TITLES, formatStatusBadgeHtml, translateReportHeader } from "./report-i18n";
import { generateAutoKpis } from "./report-kpis";
import { computeReportColumnWidths, getOperaColumnAlign, getOperaColumnStyle, isMultiItemOrTextColumn } from "./report-columns";

export * from "./report-types";
export * from "./report-i18n";
export * from "./report-kpis";
export * from "./report-columns";

// ----------------------------------------------------------------------------
// 4. Main Engine Function: printLuxuryReport (Opera PMS Edition)
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
    customBottomSectionsHtml,
    autoPrint = true,
    singlePage,
  } = opts;

  const isArabic = opts.language === "ar" || opts.language === undefined;
  const dir = isArabic ? "rtl" : "ltr";
  const lang = isArabic ? "ar" : "en";

  // Open window SYNCHRONOUSLY at the top before any await to avoid browser popup blockers!
  let printWindow: Window | null = null;
  if (typeof window !== "undefined") {
    try {
      printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(`<!DOCTYPE html>
<html class="notranslate" dir="${dir}" lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="google" content="notranslate">
  <title>${isArabic ? "جاري تجهيز التقرير الفاخر..." : "Preparing Luxury Report..."}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", "Tajawal", sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0f172a;
      color: #f8fafc;
      text-align: center;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 4px solid rgba(255,255,255,0.15);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 {
      margin: 18px 0 8px 0;
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
    }
    p {
      margin: 0;
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h2>${isArabic ? "جاري تجهيز التقرير ومعالجة التنسيق..." : "Preparing Luxury Report..."}</h2>
  <p>${isArabic ? "لحظات وسيتم فتح نافذة المعاينة والطباعة وحفظ PDF تلقائياً..." : "Opening print preview and PDF dialog shortly..."}</p>
</body>
</html>`);
        printWindow.document.close();
      }
    } catch (e) {
      printWindow = null;
    }
  }

  // Resolve showKpis & showSignatures with smart defaults from REPORT_TAB_CONFIG
  const tabConfig = activeTab ? REPORT_TAB_CONFIG[activeTab] : undefined;
  const initialShowKpis = opts.showKpis !== undefined ? opts.showKpis : (tabConfig ? tabConfig.showKpis : false);
  const initialShowSigs = opts.showSignatures !== undefined ? opts.showSignatures : (tabConfig ? tabConfig.showSignatures : false);

  // 1. Resolve target property id robustly (supporting number or numeric string)
  const rawPropId = propId ?? activePropertyId;
  let targetPropId: number | undefined =
    rawPropId && rawPropId !== "all" && !isNaN(Number(rawPropId))
      ? Number(rawPropId)
      : undefined;

  // 2. Resolve Property object from passed array
  let propObj = Array.isArray(properties)
    ? properties.find((p: any) =>
        (targetPropId && Number(p.id) === targetPropId) ||
        (rawPropId && String(p.id) === String(rawPropId)) ||
        (rawPropId && p.code && String(p.code).toLowerCase() === String(rawPropId).toLowerCase())
      )
    : undefined;

  // If still not resolved or properties was empty or propObj has no logo, fetch from /api/properties
  if (!propObj || !propObj.logo) {
    try {
      const pRes = await fetch("/api/properties", { credentials: "include" });
      if (pRes.ok) {
        const pList = await pRes.json();
        if (Array.isArray(pList) && pList.length > 0) {
          const match = pList.find((p: any) =>
            (targetPropId && Number(p.id) === targetPropId) ||
            (rawPropId && String(p.id) === String(rawPropId)) ||
            (rawPropId && p.code && String(p.code).toLowerCase() === String(rawPropId).toLowerCase())
          ) || pList[0];
          if (match) {
            propObj = { ...match, ...propObj };
            if (!targetPropId && match.id) {
              targetPropId = Number(match.id);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch /api/properties fallback in luxury report:", e);
    }
  }

  // If still no targetPropId, use propObj.id or default to 1
  if (!targetPropId && propObj?.id) {
    targetPropId = Number(propObj.id);
  }
  if (!targetPropId) {
    targetPropId = 1;
  }

  // Resolve Property Display Name
  const propName = (isArabic ? (opts.subtitleAr || opts.subtitle) : (opts.subtitle || opts.subtitleAr))
    || propObj?.displayName
    || propObj?.name
    || "";

  // 3. Resolve System Logo (Corporate Brand)
  let resolvedSysLogoUrl = settings?.systemLogo;
  if (!resolvedSysLogoUrl) {
    try {
      const sUrl = `/api/settings?propertyId=${targetPropId}`;
      const sRes = await fetch(sUrl, { credentials: "include" });
      if (sRes.ok) {
        const sData = await sRes.json();
        resolvedSysLogoUrl = sData?.systemLogo;
      }
    } catch (e) {
      console.warn("Failed to fetch /api/settings fallback in luxury report:", e);
    }
  }

  // 4. Convert both property and system logos to base64 DataURLs if available
  const sysLogo = resolvedSysLogoUrl ? await loadImgDataUrl(resolvedSysLogoUrl) : null;
  const propLogo = propObj?.logo ? await loadImgDataUrl(propObj.logo) : null;

  // Resolve Title & Opera Code
  const defaultTabInfo = activeTab ? REPORT_TAB_TITLES[activeTab] : undefined;
  const reportTitle = isArabic
    ? (opts.titleAr || opts.title || defaultTabInfo?.ar || "تقرير إدارة السكن")
    : (opts.title || defaultTabInfo?.en || "Staff Housing Operations Report");
  const operaCode = REPORT_OPERA_CODES[activeTab || ""] || (activeTab ? activeTab.replace(/[^a-z0-9_]/gi, "").toLowerCase() : "gibyroom");

  // Opera standard date & time (e.g. 24-09-2026, 14:39) — strict DD-MM-YYYY format per Rule 7
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const operaDateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
  const operaTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const issueDateFormatted = isArabic
    ? now.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : now.toLocaleString("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  // Normalize Table Headers & Rows
  let rawHeaders: string[] = [];
  let tableRows: any[][] = [];

  if (rows.length > 0) {
    if (Array.isArray(rows[0])) {
      rawHeaders = opts.headers || (rows[0] as string[]);
      tableRows = (rows as any[][]).slice(opts.headers ? 0 : 1);
    } else {
      rawHeaders = opts.headers || Object.keys(rows[0]);
      tableRows = (rows as Record<string, any>[]).map((r) => rawHeaders.map((h) => r[h]));
    }
  }

  // Strictly translate all table headers to Arabic in Arabic mode or English in English mode
  const headers = rawHeaders.map((h) => translateReportHeader(h, isArabic));
  const colCount = headers.length + 1; // including '#' sequence column

  // Determine Orientation: Automatically enforce Landscape if >= 7 columns (including # seq) or explicitly requested/configured
  const autoOrientation = tabConfig?.orientation || (colCount >= 7 ? "landscape" : "portrait");
  const orientation = opts.orientation || autoOrientation;
  const isSinglePage = singlePage ?? (tableRows.length === 0 && Boolean(customSectionsHtml));

  // Check if dataset is a small single-page batch (e.g. <= 14 rows) where generous executive row spacing is desirable
  const isShortSingleDataset = tableRows.length <= 14 && tableRows.length > 0;

  // High-legibility, bold typography scaled by orientation and column density
  let baseFontSizePt = 9.8;
  let printFontSizePt = 9.2;
  let cellPadding = "3.2px 5px";
  let printPadding = "2.8px 4.5px";
  let tableLetterSpacing = "normal";

  if (orientation === "landscape") {
    if (colCount >= 20) {
      // Ultra-dense reports (e.g. Tourism Police Manifest with 20-25 columns)
      baseFontSizePt = 5.6;
      printFontSizePt = 5.3;
      cellPadding = "1.2px 1.8px";
      printPadding = "1.0px 1.5px";
      tableLetterSpacing = "-0.25px";
    } else if (colCount >= 16) {
      baseFontSizePt = 6.4;
      printFontSizePt = 6.0;
      cellPadding = "1.6px 2.2px";
      printPadding = "1.4px 1.8px";
      tableLetterSpacing = "-0.2px";
    } else if (colCount >= 13) {
      baseFontSizePt = 7.1;
      printFontSizePt = 6.7;
      cellPadding = "2.2px 3.0px";
      printPadding = "1.8px 2.5px";
      tableLetterSpacing = "-0.1px";
    } else if (colCount >= 10) {
      baseFontSizePt = 7.8;
      printFontSizePt = 7.4;
      cellPadding = "2.8px 4.0px";
      printPadding = "2.4px 3.5px";
      tableLetterSpacing = "normal";
    }
  } else {
    // Portrait mode (190mm printable width)
    if (colCount >= 20) {
      // Extreme density on portrait: micro font to prevent collision
      baseFontSizePt = 5.2;
      printFontSizePt = 4.9;
      cellPadding = "1px 1.5px";
      printPadding = "0.8px 1.2px";
      tableLetterSpacing = "-0.35px";
    } else if (colCount >= 16) {
      baseFontSizePt = 5.8;
      printFontSizePt = 5.5;
      cellPadding = "1.4px 2.0px";
      printPadding = "1.2px 1.6px";
      tableLetterSpacing = "-0.25px";
    } else if (colCount >= 13) {
      baseFontSizePt = 6.6;
      printFontSizePt = 6.2;
      cellPadding = "2.0px 2.6px";
      printPadding = "1.6px 2.2px";
      tableLetterSpacing = "-0.15px";
    } else if (colCount >= 10) {
      baseFontSizePt = 7.2;
      printFontSizePt = 6.8;
      cellPadding = "2.4px 3.2px";
      printPadding = "2.0px 2.8px";
      tableLetterSpacing = "normal";
    } else if (colCount >= 7) {
      baseFontSizePt = 8.2;
      printFontSizePt = 7.8;
      cellPadding = "3.2px 4.5px";
      printPadding = "2.8px 4.0px";
      tableLetterSpacing = "normal";
    }
  }

  if (isShortSingleDataset) {
    if (tableRows.length <= 10) {
      cellPadding = orientation === "landscape" ? "5.5px 7px" : "6.5px 8px";
      printPadding = orientation === "landscape" ? "4.5px 6px" : "5.5px 7px";
      baseFontSizePt = Math.min(10.2, baseFontSizePt + 0.8);
      printFontSizePt = Math.min(9.8, printFontSizePt + 0.8);
    } else {
      cellPadding = orientation === "landscape" ? "4.0px 5.5px" : "4.8px 6.5px";
      printPadding = orientation === "landscape" ? "3.5px 5.0px" : "4.2px 5.8px";
      baseFontSizePt = Math.min(9.8, baseFontSizePt + 0.4);
      printFontSizePt = Math.min(9.4, printFontSizePt + 0.4);
    }
  }

  const tableLineHeight = isShortSingleDataset ? "1.30" : "1.18";

  // Readability bump: body text one notch larger. The estimator below derives
  // from baseFontSizePt, so estimates stay consistent; measured reflow is the net.
  baseFontSizePt += 1.0;
  printFontSizePt += 1.0;

  // Helper: Strictly determine if a column is a legitimate quantifiable metric that can be summed
  const isQuantifiableHeader = (headerName: string, rawHeaderName: string): boolean => {
    const combined = `${headerName || ""} ${rawHeaderName || ""}`.toLowerCase();

    // STRICT BLACKLIST: Identifiers, codes, phones, national IDs, room numbers, bed numbers, floors, rates, percentages
    if (
      combined.includes("قومي") ||
      combined.includes("national") ||
      combined.includes("هاتف") ||
      combined.includes("phone") ||
      combined.includes("موبايل") ||
      combined.includes("mobile") ||
      combined.includes("كود") ||
      combined.includes("code") ||
      combined.includes("هوية") ||
      combined.includes("id") ||
      combined.includes("رقم السرير") ||
      combined.includes("bed no") ||
      combined.includes("bed number") ||
      combined.includes("رقم الغرفة") ||
      combined.includes("room no") ||
      combined.includes("room number") ||
      combined.includes("طابق") ||
      combined.includes("floor") ||
      combined.includes("دور") ||
      combined.includes("تسلسلي") ||
      combined.includes("serial") ||
      combined.includes("باركود") ||
      combined.includes("barcode") ||
      combined.includes("نسبة") ||
      combined.includes("percent") ||
      combined.includes("%") ||
      combined.includes("تقييم") ||
      combined.includes("rating") ||
      combined.includes("stars") ||
      combined.includes("نجوم") ||
      combined.includes("تاريخ") ||
      combined.includes("date") ||
      combined.includes("ترتيب") ||
      combined.includes("rank") ||
      combined.includes("درجة") ||
      combined.includes("level") ||
      combined.includes("عمر") ||
      combined.includes("age") ||
      combined.includes("سنة") ||
      combined.includes("year")
    ) {
      return false;
    }

    // WHITELIST: Only legitimate capacity, occupancy, inventory quantities, financial amounts
    if (
      combined.includes("إجمالي الغرف") ||
      combined.includes("total rooms") ||
      combined.includes("rooms count") ||
      combined.includes("عدد الغرف") ||
      combined.includes("إجمالي الأسرة") ||
      combined.includes("total beds") ||
      combined.includes("beds count") ||
      combined.includes("عدد الأسرة") ||
      combined.includes("مشغول") ||
      combined.includes("occupied") ||
      combined.includes("شاغر") ||
      combined.includes("vacant") ||
      combined.includes("متسخ") ||
      combined.includes("dirty") ||
      combined.includes("صيانة") ||
      combined.includes("ooo") ||
      combined.includes("سعة") ||
      combined.includes("capacity") ||
      combined.includes("كمية") ||
      combined.includes("quantity") ||
      combined.includes("مبلغ") ||
      combined.includes("amount") ||
      combined.includes("رسوم") ||
      combined.includes("fee") ||
      combined.includes("سعر") ||
      combined.includes("price") ||
      combined.includes("ليالي") ||
      combined.includes("nights") ||
      combined.includes("ساعات") ||
      combined.includes("hours") ||
      combined.includes("الوقت التقديري") ||
      combined.includes("est time") ||
      combined.includes("دقائق") ||
      combined.includes("mins") ||
      combined.includes("ذكور") ||
      combined.includes("males") ||
      combined.includes("إناث") ||
      combined.includes("females") ||
      combined.includes("عدد المقيمين") ||
      combined.includes("residents count")
    ) {
      return true;
    }

    return false;
  };

  // Calculate Column Totals for Opera Totals Row (strictly filtered for quantifiable columns only)
  const colTotals: (number | null)[] = headers.map((h, colIdx) => {
    const rawH = rawHeaders[colIdx] || "";
    if (!isQuantifiableHeader(h, rawH)) {
      return null;
    }

    let isNumeric = true;
    let sum = 0;
    let countValid = 0;
    for (const row of tableRows) {
      const val = row[colIdx];
      if (val === null || val === undefined || val === "" || val === "—") continue;
      const cleanVal = String(val).replace(/,/g, "").trim();
      const num = Number(cleanVal);
      if (typeof val === "number" || (!isNaN(num) && !cleanVal.includes("-") && !cleanVal.includes("/"))) {
        sum += num;
        countValid++;
      } else {
        isNumeric = false;
        break;
      }
    }
    return isNumeric && countValid > 0 ? sum : null;
  });

  const hasAnyColTotal = colTotals.some((t) => t !== null);

  // KPI Summary Cards - Only rendered if explicitly requested (never by default)
  const kpiCards: ReportKpiCard[] =
    initialShowKpis && opts.kpiCards && opts.kpiCards.length > 0
      ? opts.kpiCards
      : (initialShowKpis ? generateAutoKpis(activeTab, rows as Record<string, any>[], isArabic) : []);

  // Generate KPI Cards HTML
  const kpisHtml = initialShowKpis && kpiCards.length > 0
    ? `<div class="kpi-grid" id="kpiGrid" style="grid-template-columns: repeat(${Math.min(kpiCards.length, 6)}, 1fr);">
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

  // Determine exact proportional column widths guaranteeing 100.0% sum (Content-Aware Auto-Fit)
  const { seqWidthPct, colWidthsPct } = computeReportColumnWidths(headers, rawHeaders, orientation, tableRows);

  // Generate Opera Table Header HTML with strict colgroup summing to 100.0%
  const theadHtml = `
    <colgroup>
      <col class="opera-col-seq" style="width: ${seqWidthPct}%;" />
      ${headers
        .map((_, i) => `<col style="width: ${colWidthsPct[i]}%;" />`)
        .join("")}
    </colgroup>
    <thead>
      <tr class="opera-thead-row">
        <th class="opera-seq-col" style="width: ${seqWidthPct}%; text-align: center;">#</th>
        ${headers
          .map((h, i) => {
            const raw = rawHeaders[i] || h;
            const align = getOperaColumnAlign(raw, isArabic);
            const colStyle = getOperaColumnStyle(raw, isArabic);
            const thStyle = `${colStyle.replace(/white-space:\s*nowrap;?/gi, "").trim()} white-space: normal; line-height: 1.15;`;
            return `<th style="width: ${colWidthsPct[i]}%; text-align: ${align}; ${thStyle}">${h}</th>`;
          })
          .join("")}
      </tr>
    </thead>
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

  // ── Greedy Fill-to-Capacity Page Allocation ──
  // ── Dynamic Available Page Height Calculation ──
  const isLandscape = orientation === "landscape";
  const hasKpis = Boolean(initialShowKpis && kpiCards.length > 0);
  const hasSigs = Boolean(initialShowSigs);
  const hasBottom = Boolean(customBottomSectionsHtml);

  // Exact printable A4 heights in millimeters (matching print CSS: 208mm landscape, 295mm portrait)
  const pageHeightMm = isLandscape ? 208.0 : 295.0;
  const topMarginMm = 3.5; // sheet padding top
  const bottomMarginMm = 3.5; // sheet padding bottom
  const footerHeightMm = 6.0; // .opera-footer layout + border
  const safetyBufferMm = 2.0; // rendering subpixel tolerance

  // Net usable height inside sheet container
  const usableHeightMm = pageHeightMm - topMarginMm - bottomMarginMm - footerHeightMm - safetyBufferMm;

  // Header, Components, and Table Header Heights in mm:
  const p1HeaderHeightMm = (dateFrom || dateTo) ? 21.0 : 18.5; // Branded Letterhead Header on Page 1
  const subsequentHeaderHeightMm = 7.5; // Compact Sub-Header on Page 2+
  const theadHeightMm = 6.5; // Repeated table header row
  const kpisHeightMm = hasKpis ? 22.0 : 0.0; // KPI Cards Grid
  const customSectionHeightMm = customSectionsHtml ? 32.0 : 0.0; // Custom top sections (if any)
  const customBottomSectionHeightMm = customBottomSectionsHtml ? 38.0 : 0.0; // Demographics / bottom section
  const sigsHeightMm = hasSigs ? 24.0 : 0.0; // Signatures Section on final page
  const totalsRowHeightMm = hasAnyColTotal ? 5.5 : 0.0; // Final totals row

  // Function to calculate available table height dynamically for ANY page
  const getAvailableTableHeightMm = (pageNum: number, isFinal: boolean): number => {
    const isFirst = pageNum === 1;
    const headerH = isFirst ? (p1HeaderHeightMm + kpisHeightMm + customSectionHeightMm) : subsequentHeaderHeaderHeight(isFirst);
    const bottomH = isFinal ? (sigsHeightMm + totalsRowHeightMm + customBottomSectionHeightMm) : 0;
    return Math.max(25.0, usableHeightMm - headerH - theadHeightMm - bottomH);
  };

  function subsequentHeaderHeaderHeight(isFirst: boolean): number {
    return isFirst ? p1HeaderHeightMm : subsequentHeaderHeightMm;
  }

  // ── Dynamic Row Height Calculation ──
  const printableWidthMm = isLandscape ? 285.0 : 198.0;
  // In Cairo / Arial fonts at 8pt, average character width is ~1.15mm
  const avgCharWidthMm = (baseFontSizePt * 0.3528) * (isArabic ? 0.42 : 0.38);
  const colCharsCapacity = colWidthsPct.map((pct) => {
    const colWidthMm = printableWidthMm * (pct / 100);
    return Math.max(4, Math.floor((colWidthMm - 2.0) / avgCharWidthMm));
  });

  // Base row height in mm corresponding to CSS line-height + padding + border:
  const baseRowHeightMm = isShortSingleDataset
    ? (isLandscape ? 5.6 : 6.0)
    : isLandscape
      ? (colCount >= 14 ? 4.4 : colCount >= 10 ? 4.7 : 4.9)
      : (colCount >= 14 ? 4.7 : colCount >= 10 ? 4.9 : 5.1);

  const extraLineHeightMm = 2.4;

  const calculateCellLines = (val: any, cpl: number): number => {
    if (val === null || val === undefined) return 1;
    const rawStr = String(val).trim();
    if (!rawStr || rawStr === "—") return 1;

    const paragraphs = rawStr.split(/\r?\n/);
    let totalLines = 0;

    for (const p of paragraphs) {
      const text = p.trim();
      if (!text) {
        totalLines += 1;
        continue;
      }
      if (text.length <= cpl) {
        totalLines += 1;
        continue;
      }

      // Word wrapping
      const words = text.split(/\s+/);
      let lines = 1;
      let curLineLen = 0;

      for (const w of words) {
        if (w.length > cpl) {
          if (curLineLen > 0) {
            lines++;
            curLineLen = 0;
          }
          lines += Math.floor(w.length / cpl);
          curLineLen = w.length % cpl;
        } else if (curLineLen === 0) {
          curLineLen = w.length;
        } else if (curLineLen + 1 + w.length <= cpl) {
          curLineLen += 1 + w.length;
        } else {
          lines++;
          curLineLen = w.length;
        }
      }
      totalLines += lines;
    }
    return Math.max(1, Math.min(3, totalLines));
  };

  // Only truly freeform multiline columns (notes, comments, reasons, addresses) expand row height
  const isWrappableHeader = (h: string): boolean => {
    return isMultiItemOrTextColumn(h);
  };

  const estimateRowHeightMm = (row: any[]): number => {
    let maxLines = 1;
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val === null || val === undefined) continue;
      const normH = rawHeaders[c] || headers[c] || "";
      if (!isWrappableHeader(normH)) continue;

      const cpl = colCharsCapacity[c] || 15;
      const lines = calculateCellLines(val, cpl);
      if (lines > maxLines) {
        maxLines = lines;
      }
    }

    return baseRowHeightMm + (maxLines - 1) * extraLineHeightMm;
  };

  // Maximum rows physically permissible on a single page allowing full-page utilization
  const maxRowsAllowedOnPage = (pageNum: number, isFinal: boolean): number => {
    if (orientation === "landscape") {
      if (pageNum === 1) {
        if (hasKpis) return isFinal ? 26 : 30;
        return isFinal ? 33 : 37;
      }
      return isFinal ? 33 : 38;
    } else {
      if (pageNum === 1) {
        if (hasKpis) return isFinal ? 38 : 44;
        return isFinal ? 46 : 52;
      }
      return isFinal ? 48 : 56;
    }
  };

  // ── Unified Continuous Document Allocation ──
  const pageChunks: any[][][] = [tableRows];
  const pageStartIndexes: number[] = [0];
  const totalPages = 1;

  // Render a Single Formal Opera PMS Page (Header, optional KPIs, Table Chunk, optional Signatures, and Pinned Footer)
  function renderSinglePageHtml(
    pageRows: any[][],
    pageIdx: number,
    totalPagesCount: number,
    startSeq: number
  ): string {
    const isFirstPage = pageIdx === 0;
    const isLastPage = pageIdx === totalPagesCount - 1;
    const pageNumber = pageIdx + 1;

    // Header HTML: Branded Logos Letterhead on Page 1 ONLY; Compact Sub-Header on Page 2+
    // strictly direction: ltr so System logo stays LEFT and Property logo stays RIGHT in Arabic and English alike
    const pageHeaderHtml = isFirstPage
      ? `
        <div class="opera-header">
          <!-- Left: System Logo (SUNRISE) - strictly left in all languages -->
          <div class="opera-header-left">
            ${sysLogo
              ? `<img src="${sysLogo.dataUrl}" alt="شعار النظام" class="opera-logo opera-syslogo" />`
              : `<div class="opera-fallback-brand">
                  <span style="font-weight: 900; font-size: 9.5pt; letter-spacing: 0.5px; color: #0F2A44;">SUNRISE</span>
                 </div>`
            }
          </div>

          <!-- Center: Hotel Name & Report Title -->
          <div class="opera-header-center">
            ${propName ? `<div class="opera-hotel-name">${propName}</div>` : ""}
            <div class="opera-report-title">${reportTitle}</div>
            ${dateFrom || dateTo ? `
            <div class="opera-report-submeta">
              ${dateFrom ? `${isArabic ? "من" : "From"}: ${dateFrom} ` : ""}
              ${dateTo ? `${isArabic ? "إلى" : "To"}: ${dateTo}` : ""}
            </div>` : ""}
          </div>

          <!-- Right: Property Logo & Opera Date/Time - strictly right in all languages -->
          <div class="opera-header-right">
            ${propLogo
              ? `<img src="${propLogo.dataUrl}" alt="شعار الفرع" class="opera-logo opera-proplogo" />`
              : propName ? `<div class="opera-fallback-brand right-brand">
                  <span style="font-weight: 800; font-size: 8.5pt; color: #0F2A44;">${propName}</span>
                 </div>` : ""
            }
            <div class="opera-meta-datetime">
              <span class="opera-meta-date">${operaDateStr}</span>
              <span class="opera-meta-sep">-</span>
              <span class="opera-meta-time">${operaTimeStr}</span>
            </div>
          </div>
        </div>
        <div class="opera-divider"></div>
      `
      : `
        <div class="opera-sub-header">
          <div class="opera-sub-header-left">
            <span class="sub-prop-title">${propName}</span>
            <span class="sub-sep">—</span>
            <span class="sub-rep-title">${reportTitle}</span>
          </div>
          <div class="opera-sub-header-right">
            <span class="opera-meta-date">${operaDateStr}</span>
            <span class="opera-meta-sep">-</span>
            <span class="opera-meta-time">${operaTimeStr}</span>
          </div>
        </div>
        <div class="opera-divider"></div>
      `;

    // Data rows for this page chunk with continuous sequence indexing
    let rowsHtml = "";
    if (pageRows.length > 0) {
      rowsHtml = pageRows
        .map((row, rIdx) => {
          const seq = startSeq + rIdx + 1;
          return `
            <tr class="opera-row">
              <td class="opera-seq-col" style="width: ${seqWidthPct}%; text-align: center; color: #000000; font-weight: 700; font-size: ${printFontSizePt}pt;">${seq}</td>
              ${row
                .map((cell, colIdx) => {
                  const raw = rawHeaders[colIdx] || "";
                  const align = getOperaColumnAlign(raw, isArabic);
                  const colStyle = getOperaColumnStyle(raw, isArabic);
                  const formatted = formatStatusBadgeHtml(cell, isArabic);
                  const isNum = typeof cell === "number" || (!isNaN(Number(cell)) && cell !== "" && cell !== null && !String(cell).includes("-") && !String(cell).includes("/"));
                  const displayVal = (isNum && typeof cell === "number") ? cell.toLocaleString() : formatted;
                  return `<td style="width: ${colWidthsPct[colIdx]}%; text-align: ${align}; ${colStyle}">${displayVal}</td>`;
                })
                .join("")}
            </tr>
          `;
        })
        .join("");
    } else if (tableRows.length === 0 && headers.length > 0) {
      rowsHtml = `<tr><td colspan="${headers.length + 1}" style="text-align:center; padding:20px; color:#000000; font-weight: 700;">${isArabic ? "لا توجد سجلات مطابقة للعرض" : "No records found matching criteria"}</td></tr>`;
    }

    // Totals Row (Appears strictly on the final page of data rows)
    let totalsRowHtml = "";
    if (isLastPage && tableRows.length > 0) {
      totalsRowHtml = `
        <tr class="opera-totals-row">
          <td class="opera-seq-col" style="width: ${seqWidthPct}%; text-align: center; font-weight: 800; color: #000000;">—</td>
          <td style="font-weight: bold;" ${!hasAnyColTotal ? `colspan="${headers.length}"` : ""}>
            ${isArabic ? `إجمالي السجلات: ${tableRows.length} سجل` : `Total Records: ${tableRows.length}`}
          </td>
          ${hasAnyColTotal ? colTotals.map((tot, i) => {
            if (i === 0) return "";
            if (tot === null) return `<td></td>`;
            const align = getOperaColumnAlign(rawHeaders[i] || "", isArabic);
            return `<td style="text-align: ${align}; font-weight: bold;">${tot.toLocaleString()}</td>`;
          }).join("") : ""}
        </tr>
      `;
    }

    // Signatures Block (Rendered in tfoot)
    const sigsHtml = initialShowSigs ? `
      <div class="sig-section" id="sigSection" style="margin-top: 8px; padding-top: 6px; page-break-inside: avoid; break-inside: avoid;">
        <div class="sig-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;">
          <div class="sig-card" style="text-align: center; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 6px 8px; background: #fdfdfd;">
            <div class="sig-role" style="font-size: 7.2pt; font-weight: 800; color: #0f2a44; margin-bottom: 22px;">${sig1}</div>
            <div class="sig-line" style="border-top: 1px solid #94a3b8; width: 80%; margin: 0 auto 3px auto;"></div>
            <div class="sig-date" style="font-size: 6.5pt; color: #64748b;">${isArabic ? "التوقيع / التاريخ: ___ / ___ / 202__" : "Sign / Date: ___ / ___ / 202__"}</div>
          </div>
          <div class="sig-card" style="text-align: center; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 6px 8px; background: #fdfdfd;">
            <div class="sig-role" style="font-size: 7.2pt; font-weight: 800; color: #0f2a44; margin-bottom: 22px;">${sig2}</div>
            <div class="sig-line" style="border-top: 1px solid #94a3b8; width: 80%; margin: 0 auto 3px auto;"></div>
            <div class="sig-date" style="font-size: 6.5pt; color: #64748b;">${isArabic ? "التوقيع / التاريخ: ___ / ___ / 202__" : "Sign / Date: ___ / ___ / 202__"}</div>
          </div>
          <div class="sig-card" style="text-align: center; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 6px 8px; background: #fdfdfd;">
            <div class="sig-role" style="font-size: 7.2pt; font-weight: 800; color: #0f2a44; margin-bottom: 22px;">${sig3}</div>
            <div class="sig-line" style="border-top: 1px solid #94a3b8; width: 80%; margin: 0 auto 3px auto;"></div>
            <div class="sig-date" style="font-size: 6.5pt; color: #64748b;">${isArabic ? "التوقيع / التاريخ: ___ / ___ / 202__" : "Sign / Date: ___ / ___ / 202__"}</div>
          </div>
        </div>
      </div>
    ` : "";

    // Footer Layout pinned in tfoot
    const pageFooterHtml = `
      <div class="opera-footer" style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px; border-top: 1px solid #cbd5e1; font-size: 6.8pt; color: #64748b; direction: ltr; margin-top: 6px;">
        <div class="opera-footer-left" style="display: flex; align-items: center; gap: 4px; font-size: 6.8pt; max-width: 65%; overflow: hidden; white-space: nowrap;">
          <span class="opera-filter-tag" style="font-weight: 700; color: #0f2a44;">${isArabic ? "عوامل التصفية:" : "Filter:"}</span>
          <span class="opera-filter-desc-inline">
            <span>${propName}</span>
            <span class="opera-meta-sep">·</span>
            <span>${dateFrom || dateTo ? `${dateFrom || "All"} — ${dateTo || "All"}` : operaDateStr}</span>
            <span class="opera-meta-sep">·</span>
            <span>${search ? `"${search}"` : (isArabic ? "الحالة: الكل" : "Status: All")}</span>
          </span>
        </div>
        <div class="opera-footer-right" style="direction: ${dir}; font-weight: 600;">
          <span>Sunrise Staff Housing Management System</span>
        </div>
      </div>
    `;

    let pageContentHtml = "";
    if (tableRows.length > 0 || headers.length > 0) {
      pageContentHtml = `
        <div class="opera-first-page-header" style="margin-bottom: 6px; page-break-after: avoid; break-after: avoid;">
          ${pageHeaderHtml}
          ${kpisHtml}
          ${customSectionsHtml ? `<div style="margin-bottom: 6px;">${customSectionsHtml}</div>` : ""}
        </div>
        <table class="opera-table sunrise-report-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <colgroup>
            <col class="opera-col-seq" style="width: ${seqWidthPct}%;" />
            ${headers.map((_, i) => `<col style="width: ${colWidthsPct[i]}%;" />`).join("")}
          </colgroup>
          <thead style="display: table-header-group !important;">
            <tr class="opera-thead-row" style="background: #0f2a44; color: #ffffff;">
              <th class="opera-seq-col" style="width: ${seqWidthPct}%; text-align: center; background: #0f2a44 !important; color: #ffffff !important; padding: ${printPadding}; font-size: ${Math.max(6.5, printFontSizePt - 0.2)}pt; font-weight: 800; border: 1px solid #0f2a44;">#</th>
              ${headers
                .map((h, i) => {
                  const raw = rawHeaders[i] || h;
                  const align = getOperaColumnAlign(raw, isArabic);
                  return `<th style="width: ${colWidthsPct[i]}%; text-align: ${align}; background: #0f2a44 !important; color: #ffffff !important; padding: ${printPadding}; font-size: ${Math.max(6.5, printFontSizePt - 0.2)}pt; font-weight: 800; border: 1px solid #1e3a5a; white-space: normal; line-height: 1.15;">${h}</th>`;
                })
                .join("")}
            </tr>
          </thead>
          <tbody style="display: table-row-group;">
            ${rowsHtml}
            ${totalsRowHtml}
          </tbody>
          <tfoot style="display: table-footer-group !important;">
            <tr>
              <td colspan="${headers.length + 1}" style="padding: 6px 0 0 0; background: transparent; border: none;">
                ${customBottomSectionsHtml ? `<div style="margin-top: 8px;">${customBottomSectionsHtml}</div>` : ""}
                ${sigsHtml}
                ${pageFooterHtml}
              </td>
            </tr>
          </tfoot>
        </table>
      `;
    } else if (customSectionsHtml) {
      pageContentHtml = `
        <div class="opera-document-container" style="display: flex; flex-direction: column; width: 100%; min-height: 100%; justify-content: space-between;">
          <div class="opera-document-top" style="width: 100%;">
            ${pageHeaderHtml}
            ${kpisHtml}
            <div class="opera-custom-sections" style="margin: 6px 0; width: 100%;">
              ${customSectionsHtml}
            </div>
          </div>
          <div class="opera-document-bottom" style="margin-top: 8px; width: 100%; page-break-inside: avoid;">
            ${customBottomSectionsHtml ? `<div style="margin-top: 8px;">${customBottomSectionsHtml}</div>` : ""}
            ${sigsHtml}
            ${pageFooterHtml}
          </div>
        </div>
      `;
    } else {
      pageContentHtml = `
        <div class="opera-document-container" style="display: flex; flex-direction: column; width: 100%; min-height: 100%; justify-content: space-between;">
          <div class="opera-document-top" style="width: 100%;">
            ${pageHeaderHtml}
            <div style="text-align: center; padding: 40px 20px; font-weight: 700; color: #64748b;">
              ${isArabic ? "لا توجد سجلات مطابقة للعرض" : "No records found matching criteria"}
            </div>
          </div>
          <div class="opera-document-bottom" style="margin-top: 8px; width: 100%;">
            ${pageFooterHtml}
          </div>
        </div>
      `;
    }

    return `
      <div class="sheet opera-page sunrise-sheet" data-page="${pageNumber}">
        <div class="opera-page-main" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
          ${pageContentHtml}
        </div>
      </div>
    `;
  }

  // Pre-generate HTML for all discrete pages
  const allPagesHtml = pageChunks
    .map((chunk, idx) => renderSinglePageHtml(chunk, idx, totalPages, pageStartIndexes[idx]))
    .join("\n");

  // Complete Opera PMS HTML Document
  const html = `<!DOCTYPE html>
<html class="notranslate" lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="google" content="notranslate" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${reportTitle} — ${propName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: A4 ${orientation};
      margin: 8mm 10mm;
      marks: none;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: ${isArabic ? "'Cairo', Tahoma, Arial, sans-serif" : "Arial, Helvetica, 'Nimbus Sans L', sans-serif"};
      direction: ${dir};
      background: #f1f5f9;
      color: #000000;
      font-size: ${baseFontSizePt}pt;
      line-height: 1.35;
      -webkit-font-smoothing: antialiased;
    }

    /* Floating Interactive Preview Bar */
    .preview-actions-bar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #0f172a;
      color: #ffffff;
      padding: 8px 24px;
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
      gap: 8px;
    }
    .bar-meta {
      font-size: 8pt;
      color: #94a3b8;
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
      padding: 6px 14px;
      font-size: 8.5pt;
      font-weight: 700;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .btn-primary {
      background: #0284c7;
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(2,132,199,0.35);
    }
    .btn-primary:hover {
      background: #0369a1;
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

    /* Sheet Canvas & Multi-page Preview */
    .sheet-wrapper {
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      background: #475569;
      width: 100%;
      box-sizing: border-box;
      overflow-x: auto;
    }
    .sheet.opera-page {
      width: ${orientation === "landscape" ? "297mm" : "210mm"};
      max-width: ${orientation === "landscape" ? "297mm" : "210mm"};
      min-height: ${orientation === "landscape" ? "210mm" : "297mm"};
      height: ${tableRows.length === 0 && customSectionsHtml ? "auto" : (orientation === "landscape" ? "210mm" : "297mm")};
      max-height: ${tableRows.length === 0 && customSectionsHtml ? "none" : (orientation === "landscape" ? "210mm" : "297mm")};
      background: #ffffff;
      padding: 4mm 6mm;
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      position: relative;
      box-sizing: border-box;
      overflow: ${tableRows.length === 0 && customSectionsHtml ? "visible" : "hidden"};
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .opera-page-main {
      width: 100%;
      display: flex;
      flex-direction: column;
      flex: 0 0 auto;
      overflow: visible;
    }
    .opera-page-bottom {
      width: 100%;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      margin-top: auto;
    }

    /* Formal PDF Header: system logo left, property logo right (strictly direction: ltr so never flips in Arabic RTL) */
    .opera-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
      min-height: 28px;
      direction: ltr !important;
    }
    .opera-header-left {
      width: 25%;
      min-width: 100px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      direction: ltr !important;
      text-align: left !important;
    }
    .opera-header-center {
      width: 50%;
      text-align: center !important;
      padding: 0 10px;
      align-self: center;
    }
    .opera-hotel-name {
      font-size: 8.5pt;
      font-weight: 700;
      color: #334155;
      margin-bottom: 1px;
      letter-spacing: 0.2px;
      line-height: 1.1;
    }
    .opera-report-title {
      font-size: 11pt !important;
      font-weight: 800 !important;
      color: #0f2a44 !important;
      letter-spacing: 0.2px;
      line-height: 1.15;
    }
    .opera-report-submeta {
      font-size: 7pt;
      color: #475569;
      margin-top: 1px;
    }
    .opera-header-right {
      width: 25%;
      min-width: 100px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      direction: ltr !important;
      text-align: right !important;
    }
    .opera-sub-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3px;
      min-height: 20px;
      direction: ltr !important;
      padding: 0 2px;
    }
    .opera-sub-header-left {
      font-size: 9pt;
      font-weight: 800;
      color: #000000;
      display: flex;
      align-items: center;
      gap: 8px;
      direction: ltr !important;
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .sub-prop-title {
      font-family: Georgia, "Times New Roman", serif;
      font-style: italic;
    }
    .sub-sep {
      color: #64748b;
    }
    .sub-rep-title {
      font-weight: 800;
    }
    .opera-sub-header-right {
      font-size: 7pt;
      font-family: "Courier New", monospace;
      font-weight: 700;
      color: #000000;
      direction: ltr !important;
      text-align: right !important;
      flex-shrink: 0;
      white-space: nowrap;
      padding-left: 8px;
    }
    .opera-logo {
      max-height: 26px;
      max-width: 110px;
      object-fit: contain;
    }
    .opera-syslogo {
      max-width: 110px;
      max-height: 26px;
    }
    .opera-proplogo {
      max-width: 90px;
      max-height: 26px;
    }
    .opera-meta-datetime {
      font-size: 6.8pt;
      font-weight: 800;
      color: #000000;
      font-family: "Courier New", monospace;
      margin-top: 1px;
      letter-spacing: 0.2px;
    }
    .opera-meta-sep {
      margin: 0 8px;
      color: #000000;
    }
    .opera-fallback-brand {
      font-weight: 900;
      color: #000000;
      font-size: 11pt;
      letter-spacing: 0.5px;
      line-height: 1.15;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    .opera-fallback-brand.right-brand {
      align-items: flex-end;
      text-align: right;
    }
    .opera-fallback-badge {
      font-size: 6.8pt;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.8px;
    }

    .opera-divider {
      height: 0;
      background: transparent;
      margin: 2px 0 8px 0;
    }

    /* Opera Data Table: Strict fixed layout guarantees zero page blowout */
    table.opera-table {
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse !important;
      border-spacing: 0 !important;
      margin-bottom: 0 !important;
      height: auto !important;
      font-size: ${baseFontSizePt}pt;
      table-layout: fixed !important;
      word-wrap: break-word !important;
    }
    col.opera-col-seq,
    table.opera-table th.opera-seq-col,
    table.opera-table td.opera-seq-col,
    table.opera-table th:first-child,
    table.opera-table td:first-child {
      width: ${seqWidthPct}% !important;
      max-width: 32px !important;
      min-width: 18px !important;
      text-align: center !important;
      padding-left: 2px !important;
      padding-right: 2px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
    }
    table.opera-table th {
      background: #f8fafc !important;
      color: #000000 !important;
      font-weight: 800 !important;
      font-size: ${Math.max(5.0, baseFontSizePt - 0.2)}pt !important;
      border-top: 1.5px solid #000000 !important;
      border-bottom: 1.5px solid #000000 !important;
      border-left: none !important;
      border-right: none !important;
      border-inline-end: 1px solid #e2e8f0 !important;
      padding: ${cellPadding} !important;
      line-height: 1.15;
      vertical-align: bottom;
      overflow: visible !important;
      text-overflow: clip !important;
      white-space: normal !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      box-sizing: border-box !important;
      letter-spacing: ${tableLetterSpacing};
      hyphens: auto !important;
    }
    table.opera-table th:last-child {
      border-inline-end: none !important;
    }
    table.opera-table td {
      background: #ffffff !important;
      color: #000000 !important;
      font-weight: 800 !important;
      overflow: hidden !important;
      overflow-wrap: anywhere !important;
      word-break: normal;
      border-top: none !important;
      border-left: none !important;
      border-right: none !important;
      border-inline-end: 1px solid #f1f5f9 !important;
      border-bottom: 1px solid #cbd5e1 !important;
      padding: ${cellPadding} !important;
      line-height: ${tableLineHeight} !important;
      vertical-align: middle;
      overflow: hidden !important;
      text-overflow: clip !important;
      word-break: normal;
      overflow-wrap: anywhere !important;
      box-sizing: border-box !important;
      letter-spacing: ${tableLetterSpacing};
      hyphens: none !important;
      -webkit-font-smoothing: antialiased;
    }
    table.opera-table td:last-child {
      border-inline-end: none !important;
    }
    tr.opera-totals-row td {
      border-top: 1.5px solid #000000 !important;
      border-bottom: 2px solid #000000 !important;
      font-weight: 800 !important;
      font-size: ${baseFontSizePt}pt !important;
      background: #f8fafc !important;
      color: #000000 !important;
      padding: 5px 6px !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }

    /* KPI Summary Cards */
    .kpi-grid {
      display: grid;
      gap: 10px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .kpi-card {
      padding: 8px 10px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: #0f172a;
    }
    .kpi-card.green::before { background: #16a34a; }
    .kpi-card.blue::before { background: #2563eb; }
    .kpi-card.orange::before { background: #ea580c; }
    .kpi-card.red::before { background: #dc2626; }
    .kpi-val {
      font-size: 14pt;
      font-weight: 800;
      color: #000000;
      margin-top: 2px;
    }
    .kpi-label {
      font-size: 7.5pt;
      font-weight: 600;
      color: #475569;
    }
    .kpi-subtext {
      font-size: 6.8pt;
      color: #64748b;
    }

    /* Signatures Block */
    /* Signatures Block */
    .sig-section {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1.5px dashed #cbd5e1;
      page-break-inside: avoid;
    }
    .sig-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
    }
    .sig-card {
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      background: #f8fafc;
      text-align: center;
      min-height: 80px;
    }
    .sig-role {
      font-weight: 800;
      font-size: 8.5pt;
      color: #0F2A44;
      margin-bottom: 30px;
    }
    .sig-line {
      border-top: 1.5px dashed #94a3b8;
      margin: 0 10px 4px;
    }
    .sig-date {
      font-size: 7.2pt;
      font-weight: 600;
      color: #64748b;
    }

    /* Opera Footer Layout - Clean single line */
    .opera-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.2pt;
      color: #334155;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid #cbd5e1;
      line-height: 1.2;
      direction: ltr !important;
    }
    .opera-footer-left {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      color: #000000;
      font-size: 7.2pt;
      max-width: 65%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .opera-filter-tag {
      font-weight: 700;
      color: #000000;
      font-size: 7.2pt;
      white-space: nowrap;
    }
    .opera-filter-desc-inline {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #334155;
      font-weight: 600;
      font-size: 7pt;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .opera-meta-sep {
      color: #94a3b8;
      font-weight: 800;
      padding: 0 1px;
    }
    .opera-footer-center {
      text-align: center;
      font-weight: 800;
      color: #000000;
      font-size: 7.5pt;
    }
    .opera-footer-right {
      display: flex;
      align-items: center;
      font-family: "Courier New", monospace;
      font-weight: 700;
      color: #334155;
      font-size: 7pt;
    }

    /* Print Media Styles */
    @media print {
      @page {
        size: A4 ${orientation};
        margin: 8mm 10mm !important;
        marks: none;
      }
      html, body {
        width: 100% !important;
        height: auto !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-size: ${printFontSizePt}pt !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .preview-actions-bar { display: none !important; }
      .sheet-wrapper {
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        background: transparent !important;
        display: block !important;
        gap: 0 !important;
      }
      .sheet.opera-page {
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        max-height: none !important;
        min-height: 0 !important;
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        border-radius: 0 !important;
        display: block !important;
        page-break-after: auto !important;
        break-after: auto !important;
        page-break-inside: auto !important;
        break-inside: auto !important;
        box-sizing: border-box !important;
      }
      .sheet.opera-page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      .opera-page-main {
        width: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        flex: 0 0 auto !important;
      }
      .opera-page-bottom {
        width: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        flex-shrink: 0 !important;
        margin-top: auto !important;
      }
      table.opera-table {
        width: 100% !important;
        max-width: 100% !important;
        table-layout: fixed !important;
        height: auto !important;
        font-size: ${printFontSizePt}pt !important;
        border-collapse: collapse !important;
        margin-bottom: 0 !important;
      }
      col.opera-col-seq,
      table.opera-table th.opera-seq-col,
      table.opera-table td.opera-seq-col,
      table.opera-table th:first-child,
      table.opera-table td:first-child {
        width: ${seqWidthPct}% !important;
        max-width: 28px !important;
        min-width: 16px !important;
        text-align: center !important;
        padding-left: 1px !important;
        padding-right: 1px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
      }
    table.opera-table tr.opera-row {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    table.opera-table th {
        font-size: ${Math.max(5.0, printFontSizePt - 0.2)}pt !important;
        font-weight: 800 !important;
        padding: ${printPadding} !important;
        border-top: 1.5px solid #000000 !important;
        border-bottom: 1.5px solid #000000 !important;
        background: #f1f5f9 !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
        white-space: normal !important;
        overflow: visible !important;
        hyphens: auto !important;
      }
      table.opera-table td {
        font-size: ${printFontSizePt}pt !important;
        font-weight: 700 !important;
        padding: ${printPadding} !important;
        line-height: ${tableLineHeight} !important;
        color: #000000 !important;
        border-bottom: 1px solid #cbd5e1 !important;
        word-break: normal !important;
        overflow-wrap: break-word !important;
        overflow: visible !important;
        text-overflow: clip !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Prevent internal breaks inside rows */
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      tbody tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      thead {
        display: table-header-group !important;
        break-inside: avoid !important;
      }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      /* Display dynamic Opera page indicator */
      .opera-page-indicator {
        display: inline-block !important;
        font-weight: 600 !important;
      }
      /* Keep signatures and footer intact */
      .sig-section {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin-top: 8px !important;
        padding-top: 6px !important;
      }
      .sig-role {
        margin-bottom: 24px !important;
      }
      .opera-footer {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin-top: auto !important;
        padding-top: 4px !important;
        border-top: 1px solid #cbd5e1 !important;
        direction: ltr !important;
        width: 100% !important;
      }
      .opera-footer-left {
        max-width: 65% !important;
        white-space: nowrap !important;
        overflow: hidden !important;
      }
      .opera-filter-desc-inline {
        white-space: nowrap !important;
        overflow: hidden !important;
      }
      .kpi-grid {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .opera-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        direction: ltr !important;
      }
      .opera-header-left {
        width: 25% !important;
        min-width: 140px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        direction: ltr !important;
        text-align: left !important;
      }
      .opera-header-right {
        width: 25% !important;
        min-width: 140px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-end !important;
        justify-content: flex-start !important;
        direction: ltr !important;
        text-align: right !important;
      }
      .opera-sub-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        direction: ltr !important;
        padding: 0 2px !important;
        min-height: 22px !important;
      }
      .opera-sub-header-left {
        display: flex !important;
        align-items: center !important;
        font-size: 9.5pt !important;
        font-weight: 800 !important;
        color: #000000 !important;
        direction: ltr !important;
      }
      .opera-sub-header-right {
        font-size: 7.2pt !important;
        font-family: "Courier New", monospace !important;
        font-weight: 700 !important;
        color: #000000 !important;
        direction: ltr !important;
      }
      .opera-logo {
        object-fit: contain !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        display: block !important;
      }
      .opera-syslogo {
        max-width: 160px !important;
        max-height: 48px !important;
      }
      .opera-proplogo {
        max-width: 130px !important;
        max-height: 44px !important;
      }
    }
  </style>
</head>
<body>

  <!-- Floating Preview Actions Bar -->
  <div class="preview-actions-bar">
    <div class="bar-left">
      <div class="bar-title">
        <span>🏨</span>
        <span>${reportTitle}</span>
      </div>
      <div class="bar-meta">${propName} · ${tableRows.length} ${isArabic ? "سجل" : "records"} · ${totalPages} ${isArabic ? (totalPages === 1 ? "صفحة" : "صفحات") : (totalPages === 1 ? "page" : "pages")} · <span id="metaOrient">${orientation === "landscape" ? (isArabic ? "أفقي (Landscape)" : "Landscape") : (isArabic ? "رأسي (Portrait)" : "Portrait")}</span> · <span style="font-family: monospace;">[${operaCode}]</span></div>
    </div>
    <div class="bar-actions">
      <button class="btn btn-primary" onclick="window.print()">🖨️ ${isArabic ? "طباعة / حفظ كـ PDF" : "Print / Save as PDF"}</button>
      <button class="btn btn-outline" id="orientBtn" onclick="toggleOrientation()">📄 ${isArabic ? (orientation === "landscape" ? "أفقي (انقر للرأسي)" : "رأسي (انقر للأفقي)") : (orientation === "landscape" ? "Landscape (Click for Portrait)" : "Portrait (Click for Landscape)")}</button>
      ${kpiCards.length > 0 ? `
      <button class="btn btn-outline" id="kpiToggleBtn" onclick="toggleKpis()">
        📊 ${isArabic ? (initialShowKpis ? "الإحصائيات: ظاهرة" : "الإحصائيات: مخفية") : (initialShowKpis ? "KPIs: Shown" : "KPIs: Hidden")}
      </button>` : ""}
      <button class="btn btn-outline" id="sigToggleBtn" onclick="toggleSignatures()">
        ✍️ ${isArabic ? (initialShowSigs ? "التوقيعات: ظاهرة" : "التوقيعات: مخفية") : (initialShowSigs ? "Signatures: Shown" : "Signatures: Hidden")}
      </button>
      <button class="btn btn-close" onclick="window.close()">❌ ${isArabic ? "إغلاق" : "Close"}</button>
    </div>
  </div>

  <div class="sheet-wrapper" id="sheetWrapper">
    ${allPagesHtml}
  </div>

  <script>
    let currentOrientation = "${orientation}";
    function toggleOrientation() {
      const sheets = document.querySelectorAll(".sheet.opera-page");
      const orientBtn = document.getElementById("orientBtn");
      const metaOrient = document.getElementById("metaOrient");
      currentOrientation = currentOrientation === "landscape" ? "portrait" : "landscape";
      sheets.forEach(function(sheet) {
        if (currentOrientation === "portrait") {
          sheet.style.width = "210mm";
          sheet.style.maxWidth = "210mm";
          sheet.style.height = "297mm";
          sheet.style.maxHeight = "297mm";
        } else {
          sheet.style.width = "297mm";
          sheet.style.maxWidth = "297mm";
          sheet.style.height = "210mm";
          sheet.style.maxHeight = "210mm";
        }
      });
      if (orientBtn) {
        orientBtn.innerHTML = currentOrientation === "portrait"
          ? "📄 ${isArabic ? 'رأسي (انقر للأفقي)' : 'Portrait (Click for Landscape)'}"
          : "📄 ${isArabic ? 'أفقي (انقر للرأسي)' : 'Landscape (Click for Portrait)'}";
      }
      if (metaOrient) {
        metaOrient.innerHTML = currentOrientation === "portrait"
          ? "${isArabic ? 'رأسي (Portrait)' : 'Portrait'}"
          : "${isArabic ? 'أفقي (Landscape)' : 'Landscape'}";
      }
      const existingStyle = document.getElementById("dynamicPageOrientation");
      if (existingStyle) existingStyle.remove();
      const styleEl = document.createElement("style");
      styleEl.id = "dynamicPageOrientation";
      styleEl.innerHTML = "@page { size: A4 " + currentOrientation + " !important; margin: 8mm 10mm !important; marks: none; }";
      document.head.appendChild(styleEl);
    }

    let kpisVisible = ${initialShowKpis ? "true" : "false"};
    function toggleKpis() {
      const grid = document.getElementById("kpiGrid");
      const btn = document.getElementById("kpiToggleBtn");
      if (!grid) return;
      kpisVisible = !kpisVisible;
      if (kpisVisible) {
        grid.style.removeProperty("display");
        if (btn) btn.innerHTML = "📊 ${isArabic ? 'الإحصائيات: ظاهرة' : 'KPIs: Shown'}";
      } else {
        grid.style.setProperty("display", "none", "important");
        if (btn) btn.innerHTML = "📊 ${isArabic ? 'الإحصائيات: مخفية' : 'KPIs: Hidden'}";
      }
    }

    let sigsVisible = ${initialShowSigs ? "true" : "false"};
    function toggleSignatures() {
      const sec = document.getElementById("sigSection");
      const btn = document.getElementById("sigToggleBtn");
      if (!sec) return;
      sigsVisible = !sigsVisible;
      if (sigsVisible) {
        sec.style.removeProperty("display");
        if (btn) btn.innerHTML = "✍️ ${isArabic ? 'التوقيعات: ظاهرة' : 'Signatures: Shown'}";
      } else {
        sec.style.setProperty("display", "none", "important");
        if (btn) btn.innerHTML = "✍️ ${isArabic ? 'التوقيعات: مخفية' : 'Signatures: Hidden'}";
      }
    }

    const reportFullDocTitle = document.title;
    window.onbeforeprint = function() {
      document.title = "";
    };
    window.onafterprint = function() {
      document.title = reportFullDocTitle;
    };

    ${autoPrint ? `
    function triggerPrintWhenReady() {
      const imgs = Array.from(document.images);
      const imgPromises = imgs.map(function(img) {
        if (img.complete) return Promise.resolve();
        return new Promise(function(resolve) {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      Promise.all([document.fonts.ready, ...imgPromises]).then(function() {
        setTimeout(function() {
          window.print();
        }, 350);
      });
    }
    if (document.readyState === "complete") {
      triggerPrintWhenReady();
    } else {
      window.addEventListener("load", triggerPrintWhenReady);
    }
    ` : ""}
  </script>
</body>
</html>`;

  // 1. If popup window opened successfully synchronously, write the full report into it
  if (printWindow && !printWindow.closed) {
    try {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    } catch (err) {
      console.warn("Writing to popup window failed, using iframe fallback", err);
    }
  }

  // 2. Bulletproof Fallback: If popup was blocked or prevented, use invisible iframe on current document
  if (typeof document !== "undefined") {
    try {
      let printFrame = document.getElementById("__sunrise_luxury_print_frame") as HTMLIFrameElement | null;
      if (!printFrame) {
        printFrame = document.createElement("iframe");
        printFrame.id = "__sunrise_luxury_print_frame";
        printFrame.style.position = "fixed";
        printFrame.style.left = "-9999px";
        printFrame.style.top = "-9999px";
        printFrame.style.width = "1024px";
        printFrame.style.height = "768px";
        printFrame.style.border = "0";
        printFrame.style.opacity = "0";
        printFrame.style.pointerEvents = "none";
        printFrame.setAttribute("aria-hidden", "true");
        document.body.appendChild(printFrame);
      }

      const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(html);
        frameDoc.close();
        if (autoPrint) {
          const triggerPrint = () => {
            try {
              printFrame?.contentWindow?.focus();
              printFrame?.contentWindow?.print();
            } catch (err) {
              console.error("Iframe print execution failed:", err);
            }
          };
          printFrame.onload = triggerPrint;
          setTimeout(triggerPrint, 500);
        }
        return;
      }
    } catch (iframeErr) {
      console.warn("Iframe print injection failed, falling back to download", iframeErr);
    }
  }

  // 3. Ultimate Fallback: Download self-contained HTML report
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${activeTab || "Sunrise_Report"}_${Date.now()}.html`;
  a.click();
}
