// @ts-nocheck
/** Shared PDF utility functions for jsPDF exports */

/** Detect Arabic/RTL characters */
export const hasArabic = (str: string | null | undefined): boolean =>
  /[\u0600-\u06FF\u0750-\u077F]/.test(str ?? "");

/**
 * Make text safe for jsPDF Helvetica (which has no Arabic glyph support).
 * - Returns string as-is if no Arabic.
 * - Extracts any Latin characters from mixed strings.
 * - Returns fallback or "[AR]" for all-Arabic strings.
 */
export const pdfTextSafe = (
  str: string | null | undefined,
  fallback?: string,
): string => {
  if (!str) return "—";
  if (!hasArabic(str)) return str;
  const latin = str.replace(/[^\x20-\x7E]/g, "").trim();
  if (latin.length >= 2) return latin;
  return fallback ?? "[AR]";
};

/** Load an image URL and return base64 dataURL with pixel dimensions */
export const loadImgDataUrl = async (
  url: string,
): Promise<{ dataUrl: string; w: number; h: number } | null> => {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width || 200;
    canvas.height = img.naturalHeight || img.height || 80;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL("image/png"),
      w: canvas.width,
      h: canvas.height,
    };
  } catch {
    return null;
  }
};

export interface PdfHeaderOptions {
  systemLogoUrl?: string | null;
  propLogoUrl?: string | null;
  title: string;
  subtitle?: string;
  pageW: number;
}

/** Draw dual-logo header on a jsPDF document. Returns Y position after header. */
export const drawPdfHeader = async (
  doc: any,
  opts: PdfHeaderOptions,
): Promise<number> => {
  const LOGO_H = 12;
  const MARGIN = 14;

  let sysImg: { dataUrl: string; w: number; h: number } | null = null;
  let propImg: { dataUrl: string; w: number; h: number } | null = null;

  if (opts.systemLogoUrl) sysImg = await loadImgDataUrl(opts.systemLogoUrl);
  if (opts.propLogoUrl && opts.propLogoUrl !== opts.systemLogoUrl)
    propImg = await loadImgDataUrl(opts.propLogoUrl);

  if (sysImg) {
    const aspect = sysImg.w / (sysImg.h || 1);
    const w = LOGO_H * (isFinite(aspect) ? aspect : 2.5);
    doc.addImage(sysImg.dataUrl, "PNG", MARGIN, MARGIN, w, LOGO_H);
  }
  if (propImg) {
    const aspect = propImg.w / (propImg.h || 1);
    const w = LOGO_H * (isFinite(aspect) ? aspect : 2.5);
    doc.addImage(
      propImg.dataUrl,
      "PNG",
      opts.pageW - MARGIN - w,
      MARGIN,
      w,
      LOGO_H,
    );
  }

  const textY = MARGIN + LOGO_H + 6;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 42, 68);
  doc.text(opts.title, MARGIN, textY);

  if (opts.subtitle) {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(opts.subtitle, MARGIN, textY + 5);
  }

  doc.setTextColor(0, 0, 0);
  return textY + 10;
};

/** Generate Housing Letter PDF — used from profile detail, check-in, and transfer */
export const generateHousingLetterPdf = async (opts: {
  isArabic?: boolean;
  profile: any;
  assignment: any;
  room: any;
  building: string | null;
  floorNum: string | number | null;
  propName: string;
  propAddress: string;
  systemLogoUrl?: string | null;
  propLogoUrl?: string | null;
}): Promise<void> => {
  const emp = opts.profile;
  const assignment = opts.assignment;
  const room = opts.room;
  const building = opts.building;
  const floorNum = opts.floorNum;
  const propName = opts.propName;
  const propAddress = opts.propAddress;
  const today = new Date().toLocaleDateString("en-CA");

  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF("portrait", "mm", "a4");

  if (opts.isArabic) {
    await generateArabicHousingLetterPdf(doc, opts, today);
    return;
  }

  // ── English PDF (jsPDF + autoTable) ──────────────────────────────────────
  const { default: autoTable } = await import("jspdf-autotable");
  const pw = 210;
  const ph = 297;
  const ml = 14;
  const bw = pw - ml * 2;

  let y = ml;

  if (opts.systemLogoUrl || opts.propLogoUrl) {
    const items: { url: string; side: string }[] = [];
    if (opts.systemLogoUrl)
      items.push({ url: opts.systemLogoUrl, side: "left" });
    if (opts.propLogoUrl && opts.propLogoUrl !== opts.systemLogoUrl)
      items.push({ url: opts.propLogoUrl, side: "right" });
    for (const item of items) {
      try {
        const img = await loadImgDataUrl(item.url);
        if (!img) continue;
        const maxH = 10;
        const s = Math.min(maxH / (img.h || 1), 30 / (img.w || 1));
        doc.addImage(
          img.dataUrl,
          "PNG",
          item.side === "right" ? pw - ml - img.w * s : ml,
          y,
          img.w * s,
          img.h * s,
        );
      } catch {
        /* skip */
      }
    }
    y += 13;
  }

  doc.setDrawColor(201, 162, 77);
  doc.setLineWidth(0.7);
  doc.line(ml, y, pw - ml, y);
  y += 6;

  doc.setFontSize(14);
  doc.setTextColor(15, 42, 68);
  doc.text("Housing Letter", pw / 2, y, { align: "center" });
  y += 6;

  if (propName) {
    doc.setFontSize(8);
    doc.text(
      `Property: ${propName}${propAddress ? ` — ${propAddress}` : ""}`,
      pw / 2,
      y,
      { align: "center" },
    );
    y += 4;
  }

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(ml, y, pw - ml, y);
  y += 4;

  const fmtDate = (d: string | Date) =>
    d ? new Date(d).toLocaleDateString("en-CA") : "—";

  const infoLabels = [
    "Profile Name",
    "Profile Code",
    "ID No",
    "Nationality",
    "Department",
    "Job Title",
    "Level",
    "Phone",
    "Building",
    "Floor",
    "Room",
    "Bed",
    "Check-in Date",
    "Expected Check-out",
  ];
  const infoValues = [
    `${emp.firstName || ""} ${emp.lastName || ""}`,
    emp.profileId || "—",
    emp.profileId || "—",
    emp.nationality || "—",
    emp.department || "—",
    emp.jobTitle || "—",
    emp.level || "—",
    emp.phone || "—",
    building || "—",
    floorNum ? `Floor ${floorNum}` : "—",
    room?.roomNumber || String(assignment.roomId),
    assignment.bedNumber ? String(assignment.bedNumber) : "—",
    fmtDate(assignment.checkInDate),
    fmtDate(assignment.expectedCheckOutDate),
  ];

  autoTable(doc, {
    startY: y,
    tableWidth: bw,
    margin: { left: ml, right: ml },
    head: [["Field", "Value"]],
    body: infoLabels.map((lbl, i) => [lbl, infoValues[i]]),
    headStyles: {
      fillColor: [15, 42, 68],
      textColor: 255,
      fontSize: 7,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 7, cellPadding: 1.2 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold", textColor: [80, 80, 80] },
      1: { cellWidth: bw - 48 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  doc.setDrawColor(201, 162, 77);
  doc.setLineWidth(0.7);
  doc.line(ml, y, pw - ml, y);
  y += 5;

  doc.setFontSize(12);
  doc.setTextColor(15, 42, 68);
  doc.text("Custody Receipt", pw / 2, y, { align: "center" });
  y += 5;

  doc.setFontSize(6);
  doc.setTextColor(100);
  doc.text(
    "I acknowledge receipt of the items below in good condition and undertake to return them upon check-out.",
    pw / 2,
    y,
    { align: "center" },
  );
  y += 3;

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(ml, y, pw - ml, y);
  y += 3;

  const citems: string[][] = [
    ["Room Keys", "1", ""],
    ["Key Card", "1", ""],
    ["Bed", "1", ""],
    ["Mattress", "1", ""],
    ["Pillow", "2", ""],
    ["Wardrobe", "1", ""],
    ["Desk", "1", ""],
    ["Chair", "1", ""],
    ["Curtains", "1", ""],
    ["Trash Can", "1", ""],
    ["AC Remote", "1", ""],
  ];

  autoTable(doc, {
    startY: y,
    tableWidth: bw,
    margin: { left: ml, right: ml },
    head: [["#", "Item", "Qty", "Condition", "Notes"]],
    body: citems.map((item, i) => [
      String(i + 1),
      item[0],
      item[1],
      "",
      item[2],
    ]),
    headStyles: {
      fillColor: [201, 162, 77],
      textColor: 255,
      fontSize: 7,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 6.5, cellPadding: 1 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: bw - 10 - 16 - 22 - 28 },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 22 },
      4: { cellWidth: 28 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  doc.setDrawColor(201, 162, 77);
  doc.setLineWidth(0.7);
  doc.line(ml, y, pw - ml, y);
  y += 5;

  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text("Signatures", ml, y);
  y += 7;

  const sc = (bw - 20) / 3;
  doc.setFontSize(7);
  doc.setTextColor(0);
  doc.text("Recipient (Profile):", ml, y);
  doc.text("HR Manager:", ml + sc + 10, y);
  doc.text("Housing Manager:", ml + sc * 2 + 20, y);
  y += 5;
  doc.setTextColor(130);
  doc.text("________________", ml, y);
  doc.text("________________", ml + sc + 10, y);
  doc.text("________________", ml + sc * 2 + 20, y);
  y += 4;
  doc.text("Date: ___ / ___ / _____", ml, y);
  doc.text("Date: ___ / ___ / _____", ml + sc + 10, y);
  doc.text("Date: ___ / ___ / _____", ml + sc * 2 + 20, y);

  doc.setFontSize(6.5);
  doc.setTextColor(130);
  doc.text(`Print Date: ${today}`, ml, ph - ml);
  doc.text(
    "Sunrise Staff Housing Management — Confidential",
    pw - ml,
    ph - ml,
    { align: "right" },
  );

  outputPdfBlob(doc, `housing-letter-${emp.profileId || emp.id}_${today}.pdf`);
};

/**
 * Arabic housing letter — opens a native browser print dialog.
 * This gives PERFECT Arabic text shaping since the browser renders natively.
 * The user clicks Print → Save as PDF in the browser dialog.
 */
async function generateArabicHousingLetterPdf(
  _doc: any,
  opts: any,
  today: string,
): Promise<void> {
  const emp = opts.profile;
  const assignment = opts.assignment;
  const room = opts.room;

  const sysLogo = opts.systemLogoUrl
    ? await loadImgDataUrl(opts.systemLogoUrl)
    : null;
  const propLogo =
    opts.propLogoUrl && opts.propLogoUrl !== opts.systemLogoUrl
      ? await loadImgDataUrl(opts.propLogoUrl)
      : null;

  const fmtDate = (d: string | Date) =>
    d ? new Date(d).toLocaleDateString("ar-EG") : "—";
  const floorNum = opts.floorNum;
  const bldg = opts.building;
  const propName = opts.propName;
  const propAddress = opts.propAddress;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title></title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      background: #fff;
      color: #111;
      font-size: 8.5pt;
      line-height: 1.35;
    }
    .page {
      width: 210mm;
      padding: 8mm 12mm;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }
    .header img { max-height: 32px; max-width: 110px; object-fit: contain; }
    .gold { border: none; border-top: 1.5px solid #c9a24d; margin: 3px 0; }
    .gray { border: none; border-top: 0.5px solid #ccc; margin: 2px 0; }
    h1 {
      text-align: center;
      font-size: 13pt;
      font-weight: 700;
      color: #0f2a44;
      margin: 3px 0;
    }
    .sub { text-align: center; font-size: 8pt; color: #555; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 2px 0; font-size: 8pt; }
    th, td { border: 1px solid #ccd; padding: 2.5px 7px; text-align: right; }
    th { background: #0f2a44; color: #fff; font-weight: 700; }
    tr:nth-child(even) td { background: #f4f6f9; }
    .gld th { background: #c9a24d; color: #fff; }
    .ack {
      font-size: 8pt;
      color: #555;
      text-align: center;
      margin: 2px 0;
      padding: 3px 10px;
      background: #f9f9f9;
      border-radius: 3px;
      border: 1px solid #e0e0e0;
    }
    .sig-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin: 4px 0 2px;
    }
    .sig-item {
      flex: 1;
      padding: 5px;
      border: 1px solid #eee;
      border-radius: 4px;
      text-align: center;
    }
    .sig-label { font-weight: 700; font-size: 8.5pt; display: block; margin-bottom: 14px; }
    .sig-line { border-top: 1px solid #555; margin-bottom: 3px; }
    .sig-date { font-size: 7.5pt; color: #666; }
    .foot {
      display: flex;
      justify-content: space-between;
      font-size: 7pt;
      color: #999;
      margin-top: 4px;
      border-top: 1px solid #eee;
      padding-top: 3px;
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 0;  /* removes browser name/date/time headers */
      }
      html, body {
        width: 210mm;
        height: 297mm;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        padding: 7mm 12mm;
      }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${propLogo ? `<img src="${propLogo.dataUrl}" alt="شعار الفرع" />` : "<div></div>"}
      ${sysLogo ? `<img src="${sysLogo.dataUrl}" alt="شعار النظام" />` : "<div></div>"}
    </div>
    <hr class="gold" />
    <h1>خطاب سكن</h1>
    ${propName ? `<div class="sub">الفرع: ${propName}${propAddress ? ` — ${propAddress}` : ""}</div>` : ""}
    <hr class="gray" />

    <table>
      <tr><th style="width:160px">البيان</th><th>القيمة</th></tr>
      <tr><td>اسم الموظف</td><td>${emp.firstName || ""} ${emp.lastName || ""}</td></tr>
      <tr><td>كود الموظف</td><td>${emp.profileId || "—"}</td></tr>
      <tr><td>رقم الهوية</td><td>${emp.nationalId || "—"}</td></tr>
      <tr><td>الجنسية</td><td>${emp.nationality || "—"}</td></tr>
      <tr><td>القسم</td><td>${emp.department || "—"}</td></tr>
      <tr><td>المسمى الوظيفي</td><td>${emp.jobTitle || "—"}</td></tr>
      <tr><td>الدرجة</td><td>${emp.level || "—"}</td></tr>
      <tr><td>الهاتف</td><td>${emp.phone || "—"}</td></tr>
      <tr><td>المبنى</td><td>${bldg || "—"}</td></tr>
      <tr><td>الدور</td><td>${floorNum ? `طابق ${floorNum}` : "—"}</td></tr>
      <tr><td>الغرفة</td><td>${room?.roomNumber || String(assignment.roomId)}</td></tr>
      <tr><td>السرير</td><td>${assignment.bedNumber ? String(assignment.bedNumber) : "—"}</td></tr>
      <tr><td>تاريخ الدخول</td><td>${fmtDate(assignment.checkInDate)}</td></tr>
      <tr><td>تاريخ المغادرة المتوقع</td><td>${fmtDate(assignment.expectedCheckOutDate)}</td></tr>
    </table>

    <hr class="gold" />
    <h1 style="font-size:15pt; margin:6px 0">إيصال استلام العهد</h1>
    <p class="ack">أقر باستلام العهد أدناه بحالة جيدة وأتعهد بإعادتها عند انتهاء الإقامة.</p>
    <hr class="gray" />

    <table>
      <tr class="gld">
        <th style="width:32px">#</th>
        <th>الصنف</th>
        <th style="width:46px">العدد</th>
        <th style="width:65px">الحالة</th>
        <th style="width:80px">ملاحظات</th>
      </tr>
      <tr><td style="text-align:center">1</td><td>مفاتيح الغرفة</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">2</td><td>كارت الدخول</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">3</td><td>السرير</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">4</td><td>المرتبة</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">5</td><td>الوسادة</td><td style="text-align:center">2</td><td></td><td></td></tr>
      <tr><td style="text-align:center">6</td><td>خزانة ملابس</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">7</td><td>المكتب</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">8</td><td>الكرسي</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">9</td><td>الستائر</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">10</td><td>سلة مهملات</td><td style="text-align:center">1</td><td></td><td></td></tr>
      <tr><td style="text-align:center">11</td><td>ريموت مكيف</td><td style="text-align:center">1</td><td></td><td></td></tr>
    </table>

    <hr class="gold" />
    <div style="margin-top:6px">
      <p style="font-weight:700; font-size:11pt; margin-bottom:8px">التوقيعات</p>
      <div class="sig-row">
        <div class="sig-item">
          <span class="sig-label">المستلم (الموظف)</span>
          <div class="sig-line"></div>
          <span class="sig-date">التاريخ: ___ / ___ / _____</span>
        </div>
        <div class="sig-item">
          <span class="sig-label">مدير الموارد البشرية</span>
          <div class="sig-line"></div>
          <span class="sig-date">التاريخ: ___ / ___ / _____</span>
        </div>
        <div class="sig-item">
          <span class="sig-label">مدير السكن</span>
          <div class="sig-line"></div>
          <span class="sig-date">التاريخ: ___ / ___ / _____</span>
        </div>
      </div>
    </div>

    <div class="foot">
      <span>تاريخ الطباعة: ${today}</span>
      <span>Sunrise Staff Housing Management — Confidential</span>
    </div>
  </div>

  <script>
    // Auto-trigger print after fonts load
    document.fonts.ready.then(function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

  // Open a new window with the fully rendered HTML — browser handles Arabic perfectly
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    // Popup blocked — fallback: download as .html
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `housing-letter-${emp.profileId || emp.id}_${today}.html`;
    a.click();
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/** Try to output a PDF blob, open in new window (falls back to download) */
function outputPdfBlob(doc: any, filename: string): void {
  if (typeof doc.output !== "function") {
    const a = document.createElement("a");
    a.href = "#";
    a.download = filename;
    a.click();
    return;
  }
  try {
    const b = doc.output("blob");
    if (!b || typeof b !== "object") throw new Error("no blob");
    const u = URL.createObjectURL(b);
    const w = window.open(u, "_blank");
    if (!w) {
      const a = document.createElement("a");
      a.href = u;
      a.download = filename;
      a.click();
    }
  } catch {
    try {
      const u2 = doc.output("datauristring");
      const a = document.createElement("a");
      a.href = u2;
      a.download = filename;
      a.click();
    } catch {
      /* give up */
    }
  }
}

/** Draw standard PDF footer */
export const drawPdfFooter = (doc: any, pageW: number, y?: number): void => {
  const footY = y ?? doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Sunrise Staff Housing Management  ·  Confidential",
    pageW / 2,
    footY,
    { align: "center" },
  );
  doc.setTextColor(0, 0, 0);
};
