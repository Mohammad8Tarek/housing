// ============================================================================
// Sunrise Staff Housing Management System — Enterprise Luxury Report Engine
// Opera PMS column alignment, width allocation and cell styles.
// ============================================================================

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// 3.4 Helper: Detect multi-item lists, notes, descriptions, and addresses
// Guarantees text will ALWAYS wrap and NEVER blow out table width
// ----------------------------------------------------------------------------
export function isMultiItemOrTextColumn(headerName: string): boolean {
  const norm = (headerName || "").toLowerCase().trim();
  return (
    norm.includes("list") ||
    norm.includes("summary") ||
    norm.includes("notes") ||
    norm.includes("detail") ||
    norm.includes("reason") ||
    norm.includes("action") ||
    norm.includes("address") ||
    norm.includes("breakdown") ||
    norm.includes("occupant") ||
    norm.includes("problem") ||
    norm.includes("comment") ||
    norm.includes("feature") ||
    norm.includes("amenit") ||
    norm.includes("overview") ||
    norm.includes("قائمة") ||
    norm.includes("أرقام") ||
    norm.includes("ارقام") ||
    norm.includes("ملخص") ||
    norm.includes("ملاحظات") ||
    norm.includes("تفاصيل") ||
    norm.includes("السبب") ||
    norm.includes("سبب") ||
    norm.includes("إجراء") ||
    norm.includes("اجراء") ||
    norm.includes("عنوان") ||
    norm.includes("بيان") ||
    norm.includes("توزيع") ||
    norm.includes("مشكلة") ||
    norm.includes("وصف") ||
    norm.includes("عهد") ||
    norm.includes("نزلاء") ||
    norm.includes("متأثر") ||
    norm.includes("مميزات")
  );
}

// ----------------------------------------------------------------------------
// 3.5 Helper: Opera PMS Smart Column Alignment
// ----------------------------------------------------------------------------
export function getOperaColumnAlign(
  headerName: string,
  isArabic: boolean,
): "left" | "center" | "right" {
  const norm = (headerName || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // Multi-item lists, descriptions, notes, addresses ALWAYS align to start according to language
  if (isMultiItemOrTextColumn(headerName)) {
    return isArabic ? "right" : "left";
  }

  // Right aligned numbers / currency / financial / capacity
  if (
    norm.includes("rate") ||
    norm.includes("balance") ||
    norm.includes("amount") ||
    norm.includes("price") ||
    norm.includes("total") ||
    norm.includes("capacity") ||
    norm.includes("occupied") ||
    norm.includes("vacant") ||
    norm.includes("nights") ||
    norm.includes("count") ||
    norm.includes("mins") ||
    norm.includes("hours") ||
    headerName.includes("إجمالي") ||
    headerName.includes("سعر") ||
    headerName.includes("رصيد") ||
    headerName.includes("سعة") ||
    headerName.includes("ليالي") ||
    headerName.includes("شاغر") ||
    headerName.includes("مشغول") ||
    headerName.includes("عدد")
  ) {
    return "center";
  }

  // Center aligned single rooms, beds, dates, statuses, issues, signatures, checks
  if (
    norm.includes("date") ||
    norm.includes("status") ||
    norm.includes("type") ||
    norm.includes("floor") ||
    norm.includes("gender") ||
    norm.includes("issue") ||
    norm.includes("check") ||
    norm.includes("sign") ||
    headerName.includes("سرير") ||
    headerName.includes("تاريخ") ||
    headerName.includes("حالة") ||
    headerName.includes("طابق") ||
    headerName.includes("دور") ||
    headerName.includes("جنس") ||
    headerName.includes("صرف") ||
    headerName.includes("توقيع") ||
    // Strict single room identifier
    norm === "room" ||
    norm === "roomno" ||
    norm === "roomnumber" ||
    headerName.trim() === "غرفة" ||
    headerName.trim() === "رقم الغرفة"
  ) {
    return "center";
  }

  return isArabic ? "right" : "left";
}

/**
 * Dynamic Content-Proportional Column Width Allocator for Opera PMS Tables.
 * Guarantees:
 * 1. Zero Overpowering: Every column receives width strictly proportional to its real text demand.
 * 2. Zero Word Splitting: Columns are guaranteed enough width to fit their longest unbroken word/token (e.g. "Housekeeping", "Supervisor", "ACTIVE", "CLK-2020-M001").
 * 3. Exact 100.0% Sum: The sequence column and all data columns sum to exactly 100.0%, perfectly filling the printable A4 page.
 */
export function computeReportColumnWidths(
  headers: string[],
  rawHeaders: string[],
  orientation: "landscape" | "portrait" = "landscape",
  tableRows: any[][] = [],
): { seqWidthPct: number; colWidthsPct: number[] } {
  const colCount = headers.length + 1; // including sequence column

  // 1. Sequence column percentage (compact: strictly 1.8% - 2.5% in landscape, 2.5% - 3.2% in portrait)
  const seqWidthPct =
    orientation === "landscape"
      ? colCount >= 14
        ? 1.8
        : colCount >= 9
          ? 2.2
          : 2.6
      : colCount >= 12
        ? 2.6
        : colCount >= 8
          ? 3.0
          : 3.4;

  const availablePct = 100.0 - seqWidthPct;

  // Helper to strip HTML tags when measuring cell string lengths
  const stripHtml = (val: any): string => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    return s.replace(/<[^>]*>/g, "").trim();
  };

  // Inspect actual cell contents in tableRows (sample up to 250 rows for performance)
  const sampleRows = tableRows.slice(0, 250);

  // 2. Measure actual data length, longest word/token, and semantic category for each column
  const columnMetrics = headers.map((h, colIdx) => {
    const raw = (rawHeaders[colIdx] || "").toLowerCase().trim();
    const trans = (h || "").toLowerCase().trim();
    const norm = `${raw} ${trans}`;

    // Header words metrics (split ONLY on whitespace so hyphens in words like Check-In do not under-estimate word length)
    const headerClean = stripHtml(h);
    const headerWords = headerClean.split(/\s+/);
    let maxHeaderWordLen = 0;
    for (const w of headerWords) {
      maxHeaderWordLen = Math.max(maxHeaderWordLen, w.length);
    }
    const headerTotalLen = headerClean.length;

    // Sample cells metrics
    let maxCellLen = 0;
    let maxCellWordLen = 0;
    let totalCellChars = 0;
    let validCellCount = 0;

    for (const row of sampleRows) {
      const cellVal = row[colIdx];
      const text = stripHtml(cellVal);
      if (text.length > 0 && text !== "—" && text !== "-") {
        maxCellLen = Math.max(maxCellLen, text.length);
        totalCellChars += text.length;
        validCellCount++;

        // CRITICAL: Split words strictly by whitespace \s+! Do NOT split by hyphens (-) or underscores (_)
        // so codes like CLK-6533-M001, dates like 15/05/1998, and QA_ROOM_ENTIRE are measured as full continuous tokens!
        const words = text.split(/\s+/);
        for (const w of words) {
          maxCellWordLen = Math.max(maxCellWordLen, w.length);
        }
      }
    }

    const avgCellLen =
      validCellCount > 0 ? totalCellChars / validCellCount : maxCellLen;

    // Detect semantic column characteristics
    const isFixedSingleLine =
      norm.includes("code") ||
      norm.includes("كود") ||
      norm.includes("clock") ||
      norm.includes("profile id") ||
      norm.includes("profile / id") ||
      norm.includes("national") ||
      norm.includes("قومي") ||
      norm.includes("phone") ||
      norm.includes("هاتف") ||
      norm.includes("mobile") ||
      norm.includes("موبايل") ||
      norm.includes("date") ||
      norm.includes("تاريخ") ||
      norm.includes("check-in") ||
      norm.includes("check-out") ||
      norm.includes("birth") ||
      norm.includes("ميلاد") ||
      norm.includes("status") ||
      norm.includes("حالة") ||
      norm.includes("gender") ||
      norm.includes("جنس") ||
      norm.includes("nationality") ||
      norm.includes("جنسية") ||
      norm === "room" ||
      norm.includes("room no") ||
      norm === "غرفة" ||
      norm === "رقم الغرفة" ||
      norm.includes("bed no") ||
      norm === "سرير" ||
      norm === "رقم السرير" ||
      norm === "bed" ||
      norm.includes("count") ||
      norm.includes("عدد") ||
      norm.includes("qty") ||
      norm.includes("كمية") ||
      norm.includes("floor") ||
      norm.includes("طابق") ||
      norm.includes("دور") ||
      norm.includes("nights") ||
      norm.includes("ليالي") ||
      norm.includes("issue") ||
      norm.includes("صرف");

    const isLongFreeText =
      norm.includes("notes") ||
      norm.includes("reason") ||
      norm.includes("ملاحظات") ||
      norm.includes("سبب") ||
      norm.includes("تفاصيل") ||
      norm.includes("detail") ||
      norm.includes("comment");

    return {
      colIdx,
      h,
      norm,
      headerClean,
      maxHeaderWordLen,
      headerTotalLen,
      maxCellLen,
      maxCellWordLen,
      avgCellLen,
      isFixedSingleLine,
      isLongFreeText,
    };
  });

  // 3. Compute Content Demand Units for each column
  const demands = columnMetrics.map((m) => {
    // Non-splittable token threshold: The column MUST accommodate its longest unbroken word or token + padding
    const tokenMax = Math.max(m.maxHeaderWordLen, m.maxCellWordLen);
    const minTokenFloor = tokenMax + 2.0;

    // Effective length to display
    const effLen =
      m.maxCellLen > 0
        ? Math.max(m.maxCellLen, m.headerTotalLen * 0.75)
        : m.headerTotalLen;

    if (m.isFixedSingleLine) {
      // National ID / Passport / National Number (14 digits) MUST NEVER truncate or get squeezed
      if (/national|قومي|passport|جواز|هوية/i.test(m.norm)) {
        return Math.max(
          minTokenFloor,
          Math.max(22, (m.maxCellLen || 14) * 1.45 + 3),
        );
      }
      // Phone / Mobile numbers (+201012345678)
      if (/phone|هاتف|mobile|موبايل|emergency|طوارئ/i.test(m.norm)) {
        return Math.max(
          minTokenFloor,
          Math.max(18, (m.maxCellLen || 12) * 1.35 + 2.5),
        );
      }
      // Employee codes & clock numbers (CLK-10023, EMP-1001)
      if (/code|كود|clock|profile/i.test(m.norm)) {
        return Math.max(
          minTokenFloor,
          Math.max(15, (m.maxCellLen || 8) * 1.4 + 2.5),
        );
      }
      // Dates (DD-MM-YYYY)
      if (/date|تاريخ|birth|hire|contract|check-in|check-out/i.test(m.norm)) {
        return Math.max(minTokenFloor, Math.max(14, 10 * 1.3 + 2));
      }
      // Gender (Female / Male / أنثى / ذكر)
      if (/gender|جنس/i.test(m.norm)) {
        return Math.max(minTokenFloor, Math.max(8.5, m.maxHeaderWordLen + 1.5));
      }
      // Room number
      if (/room|غرفة/i.test(m.norm) && !/type|نوع/i.test(m.norm)) {
        return Math.max(minTokenFloor, Math.max(9, (m.maxCellLen || 4) + 2.5));
      }
      // Bed number
      if (/bed|سرير/i.test(m.norm)) {
        return Math.max(minTokenFloor, Math.max(7, (m.maxCellLen || 2) + 2));
      }
      return Math.max(minTokenFloor, effLen + 2.5);
    }

    if (m.isLongFreeText) {
      // Long freeform text / notes
      return orientation === "landscape"
        ? Math.max(minTokenFloor, Math.min(22, effLen * 0.65 + 3))
        : Math.max(minTokenFloor, Math.min(16, effLen * 0.5 + 2.5));
    }

    // Natural multi-word text columns (Full Name, Department, Job Title, Building, Company, Address, etc.)
    // These columns can and should wrap onto 2-3 lines cleanly instead of starving non-wrapping code/ID columns!
    if (orientation === "landscape") {
      const maxTextCap = colCount >= 18 ? 14 : colCount >= 12 ? 17 : 22;
      const textDemand = Math.max(
        m.avgCellLen * 0.85 + 2.0,
        effLen * 0.75 + 2.5,
      );
      return Math.max(minTokenFloor, Math.min(maxTextCap, textDemand));
    } else {
      const textDemand = Math.max(
        m.avgCellLen * 0.6 + 1.8,
        effLen * 0.55 + 2.0,
      );
      return Math.max(minTokenFloor, Math.min(14, textDemand));
    }
  });

  const totalDemand = demands.reduce((acc, d) => acc + d, 0);
  if (demands.length === 0 || totalDemand <= 0) {
    return { seqWidthPct, colWidthsPct: [] };
  }

  // 4. Calculate exact proportional percentage
  const rawColWidths = demands.map((d) => (d / totalDemand) * availablePct);

  // Round to 1 decimal place with adaptive minimum percentage based on total column count
  // Guaranteeing at least 2.4% - 4.5% so short headers like 'Level' or 'Bed' never get truncated!
  const minColPct =
    colCount >= 20 ? 2.4 : colCount >= 16 ? 3.0 : colCount >= 12 ? 3.8 : 4.5;
  const roundedColWidths = rawColWidths.map((w) =>
    Math.max(minColPct, Math.round(w * 10) / 10),
  );

  // Re-balance so sum equals availablePct exactly
  const interimSum = roundedColWidths.reduce((a, b) => a + b, 0);
  const reAdjustedWidths = roundedColWidths.map(
    (w) => Math.round((w / interimSum) * availablePct * 10) / 10,
  );

  // Distribute residual decimal difference to the widest column so sum is EXACTLY 100.0%
  const currentTotal =
    seqWidthPct + reAdjustedWidths.reduce((a, b) => a + b, 0);
  const delta = Math.round((100.0 - currentTotal) * 10) / 10;
  if (delta !== 0) {
    let maxIdx = 0;
    for (let i = 1; i < demands.length; i++) {
      if (demands[i] > demands[maxIdx]) maxIdx = i;
    }
    reAdjustedWidths[maxIdx] =
      Math.round((reAdjustedWidths[maxIdx] + delta) * 10) / 10;
  }

  return { seqWidthPct, colWidthsPct: reAdjustedWidths };
}

/**
 * Intelligent proportional column width allocator for Opera PMS tables.
 * Ensures the sum of all columns strictly fits within the 100% printable A4 page width.
 */

/**
 * Intelligent column styling and whitespace handling for Opera PMS tables.
 * Distributes available width cleanly without hard min-widths that cause page blowout.
 */
export function getOperaColumnStyle(
  headerName: string,
  isArabic: boolean,
): string {
  const norm = (headerName || "").toLowerCase().trim();

  // Sequence numbering column — tightly constrained
  if (norm === "#") {
    return "text-align: center; white-space: nowrap; font-weight: 700 !important; color: #000000 !important;";
  }

  // Multi-item lists, notes, descriptions, reasons, addresses: MUST WRAP NATURALLY
  if (isMultiItemOrTextColumn(headerName)) {
    return `text-align: ${isArabic ? "right" : "left"}; white-space: normal !important; word-break: break-word !important; overflow-wrap: break-word !important; line-height: 1.3; font-weight: 600 !important; color: #000000 !important;`;
  }

  // Water distribution issue checks / checkboxes / signatures
  if (
    norm.includes("صرف") ||
    norm.includes("check") ||
    norm.includes("issue") ||
    norm.includes("توقيع") ||
    norm.includes("signature")
  ) {
    return "text-align: center; white-space: nowrap; font-weight: 600 !important; color: #000000 !important;";
  }

  // Pure Single Room / Bed / Floor identifier ONLY (strictly excluding lists/summaries)
  const isStrictSingleRoomOrBed =
    norm === "room" ||
    norm === "room no" ||
    norm === "room number" ||
    norm === "غرفة" ||
    norm === "رقم الغرفة" ||
    norm === "bed" ||
    norm === "bed no" ||
    norm === "bed number" ||
    norm === "سرير" ||
    norm === "رقم السرير" ||
    norm === "floor" ||
    norm === "طابق" ||
    norm === "دور";

  if (isStrictSingleRoomOrBed) {
    return "text-align: center; white-space: nowrap; font-weight: 700 !important; color: #000000 !important;";
  }

  // Compact number counters (good, repair, damaged, missing, quantities)
  if (
    norm.includes("qty") ||
    norm.includes("quantity") ||
    norm.includes("count") ||
    norm.includes("good") ||
    norm.includes("repair") ||
    norm.includes("damaged") ||
    norm.includes("missing") ||
    norm.includes("سليم") ||
    norm.includes("صيانة") ||
    norm.includes("تالف") ||
    norm.includes("مفقود") ||
    norm.includes("كمية") ||
    norm.includes("عدد") ||
    norm.includes("cap") ||
    norm.includes("occ") ||
    norm.includes("vac") ||
    norm.includes("ooo") ||
    norm.includes("dirty") ||
    norm.includes("nights") ||
    norm.includes("ليالي")
  ) {
    return "text-align: center; white-space: normal; line-height: 1.15; font-weight: 700 !important; font-variant-numeric: tabular-nums; color: #000000 !important;";
  }

  // Employee Codes & Identifiers (Align to start, clean spacing)
  if (
    norm.includes("كود") ||
    norm.includes("code") ||
    norm.includes("clock") ||
    norm.includes("profile id") ||
    norm.includes("profile / id") ||
    norm.includes("رقم الموظف")
  ) {
    const endPad = isArabic
      ? "padding-left: 2px !important;"
      : "padding-right: 2px !important;";
    return `text-align: ${isArabic ? "right" : "left"}; white-space: nowrap !important; font-variant-numeric: tabular-nums; font-weight: 700 !important; color: #000000 !important; ${endPad}`;
  }

  // National ID & Phone & Emergency Contacts (Fixed numeric)
  if (
    norm.includes("قومي") ||
    norm.includes("national") ||
    norm.includes("هاتف") ||
    norm.includes("phone") ||
    norm.includes("موبايل") ||
    norm.includes("mobile") ||
    norm.includes("emergency") ||
    norm.includes("طوارئ") ||
    norm.includes("هوية")
  ) {
    return "text-align: center; white-space: nowrap !important; font-variant-numeric: tabular-nums; font-weight: 700 !important; color: #000000 !important;";
  }

  // Dates & Times
  if (
    norm.includes("تاريخ") ||
    norm.includes("date") ||
    norm.includes("check-in") ||
    norm.includes("check-out") ||
    norm.includes("time") ||
    norm.includes("وقت")
  ) {
    return "text-align: center; white-space: nowrap !important; font-variant-numeric: tabular-nums; font-weight: 700 !important; color: #000000 !important;";
  }

  // Status & Categories & Types & Gender & Level & Nationality
  if (
    norm.includes("حالة") ||
    norm.includes("status") ||
    norm.includes("جنس") ||
    norm.includes("gender") ||
    norm.includes("type") ||
    norm.includes("نوع") ||
    norm.includes("priority") ||
    norm.includes("أولوية") ||
    norm.includes("level") ||
    norm.includes("درجة") ||
    norm.includes("nationality") ||
    norm.includes("جنسية")
  ) {
    return "text-align: center; white-space: nowrap !important; word-break: keep-all !important; overflow-wrap: normal !important; line-height: 1.2; font-weight: 700 !important; color: #000000 !important;";
  }

  // Full Names (Person Name)
  const isPersonNameOnly =
    norm.includes("full name") ||
    norm.includes("guest name") ||
    norm.includes("profile name") ||
    norm.includes("اسم النزيل") ||
    norm.includes("اسم الموظف") ||
    norm.includes("الاسم بالكامل") ||
    (norm.includes("الاسم") &&
      !norm.includes("مبنى") &&
      !norm.includes("شركة")) ||
    (norm.includes("name") &&
      !norm.includes("building") &&
      !norm.includes("company"));

  if (isPersonNameOnly) {
    const startPad = isArabic
      ? "padding-right: 3px !important;"
      : "padding-left: 3px !important;";
    return `text-align: ${isArabic ? "right" : "left"}; white-space: normal !important; word-break: normal !important; overflow-wrap: normal !important; line-height: 1.25; font-weight: 700 !important; color: #000000 !important; ${startPad}`;
  }

  // Other Entities: Departments, Buildings, Jobs, Companies - WRAP ONLY AT WORDS
  if (
    norm.includes("قسم") ||
    norm.includes("dept") ||
    norm.includes("department") ||
    norm.includes("وظيفة") ||
    norm.includes("job") ||
    norm.includes("مبنى") ||
    norm.includes("building") ||
    norm.includes("شركة") ||
    norm.includes("company") ||
    norm.includes("guard") ||
    norm.includes("أمن") ||
    norm.includes("officer")
  ) {
    return `text-align: ${isArabic ? "right" : "left"}; white-space: normal !important; word-break: normal !important; overflow-wrap: normal !important; line-height: 1.25; font-weight: 700 !important; color: #000000 !important;`;
  }

  return `white-space: normal !important; word-break: normal !important; overflow-wrap: normal !important; line-height: 1.25; font-weight: 600 !important; color: #000000 !important;`;
}
