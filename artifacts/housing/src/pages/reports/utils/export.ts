import * as XLSX from "xlsx";
import { getExportFileName } from "@/lib/date-utils";

export const exportExcel = (activeTab: string, rows: Record<string, any>[]) => {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    ws,
    activeTab.charAt(0).toUpperCase() + activeTab.slice(1),
  );
  XLSX.writeFile(
    wb,
    getExportFileName(`${activeTab}_Report`, "xlsx"),
  );
};

export const pdfTextSafe = (
  str: string | null | undefined,
  fallback?: string,
): string => {
  if (!str) return "—";
  if (!/[\u0600-\u06FF]/.test(str)) return str;
  const latin = str.replace(/[^\x20-\x7E]/g, "").trim();
  return latin.length >= 2 ? latin : (fallback ?? "[AR]");
};

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

export const drawPdfHeader = async (
  doc: any,
  pageW: number,
  title: string,
  subtitle: string,
  settings: any,
  properties: any[],
  propId: number | undefined,
  activePropertyId: number | undefined,
): Promise<number> => {
  const LOGO_H = 14;
  const MARGIN = 14;

  const systemLogoUrl = settings?.systemLogo;
  const activePropObj = properties.find(
    (p: any) => p.id === (propId ?? activePropertyId),
  );
  const propLogoUrl = activePropObj?.logo;

  let sysImg: { dataUrl: string; w: number; h: number } | null = null;
  let propImg: { dataUrl: string; w: number; h: number } | null = null;

  if (systemLogoUrl) sysImg = await loadImgDataUrl(systemLogoUrl);
  if (propLogoUrl && propLogoUrl !== systemLogoUrl)
    propImg = await loadImgDataUrl(propLogoUrl);

  if (sysImg) {
    const aspect = sysImg.w / (sysImg.h || 1);
    const w = (LOGO_H - 2) * (isFinite(aspect) ? aspect : 2.5);
    doc.addImage(sysImg.dataUrl, "PNG", MARGIN, 4, w, LOGO_H - 2);
  } else {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 42, 68);
    doc.text("Sunrise Resorts & Cruises", MARGIN, 13);
  }

  if (propImg) {
    const aspect = propImg.w / (propImg.h || 1);
    const w = (LOGO_H - 2) * (isFinite(aspect) ? aspect : 2.5);
    doc.addImage(propImg.dataUrl, "PNG", pageW - MARGIN - w, 4, w, LOGO_H - 2);
  }

  doc.setDrawColor(201, 162, 77);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, LOGO_H + 6, pageW - MARGIN, LOGO_H + 6);

  const titleY = LOGO_H + 15;
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 42, 68);
  doc.text(title, MARGIN, titleY);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(subtitle, MARGIN, titleY + 5.5);

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, titleY + 9, pageW - MARGIN, titleY + 9);

  doc.setTextColor(0, 0, 0);
  return titleY + 14;
};

export const exportPDF = async (
  activeTab: string,
  rows: Record<string, any>[],
  properties: any[],
  propId: number | undefined,
  activePropertyId: number | undefined,
  dateFrom: string,
  dateTo: string,
  search: string,
  settings: any,
) => {
  if (!rows.length) return;
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const headers = Object.keys(rows[0]);
  const body = rows.map((r) =>
    headers.map((h) => pdfTextSafe(String(r[h] ?? "—"))),
  );

  const propName =
    properties.find((p: any) => p.id === (propId ?? activePropertyId))?.name ??
    "";
  const title = `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report${propName ? ` — ${propName}` : ""}`;
  const subtitle = [
    `Generated: ${new Date().toLocaleString()}`,
    `Records: ${rows.length}`,
    dateFrom ? `From: ${dateFrom}` : "",
    dateTo ? `To: ${dateTo}` : "",
    search ? `Search: "${search}"` : "",
  ]
    .filter(Boolean)
    .join("  |  ");

  const startY = await drawPdfHeader(
    doc,
    pageW,
    title,
    subtitle,
    settings,
    properties,
    propId,
    activePropertyId,
  );

  autoTable(doc, {
    head: [headers],
    body,
    startY,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 42, 68], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    foot: [headers.map((h, i) => (i === 0 ? `Total: ${rows.length}` : ""))],
    footStyles: {
      fillColor: [15, 42, 68],
      textColor: [201, 162, 77],
      fontStyle: "bold",
    },
  });
  doc.save(getExportFileName(`${activeTab}_Report`, "pdf"));
};

const COMMON_ARABIC_TRANSLATIONS: Record<string, string> = {
  "المبنى الرئيسي": "Main Building",
  "مبنى رئيسي": "Main Building",
  "المبنى 1": "Building 1",
  "مبنى 1": "Building 1",
  "المبنى 2": "Building 2",
  "مبنى 2": "Building 2",
  "المبنى 3": "Building 3",
  "مبنى 3": "Building 3",
  "المبنى 4": "Building 4",
  "مبنى 4": "Building 4",
  "المبنى 5": "Building 5",
  "مبنى 5": "Building 5",
  "سكن العاملين": "Staff Housing",
  "سكن الموظفين": "Staff Accommodation",
  "سكن الأفراد": "Staff Quarters",
  "الموارد البشرية": "Human Resources (HR)",
  "الموارد البشريه": "Human Resources (HR)",
  "الأغذية والمشروبات": "Food & Beverage (F&B)",
  "الاغذية والمشروبات": "Food & Beverage (F&B)",
  "المكاتب الأمامية": "Front Office",
  "المكاتب الامامية": "Front Office",
  "الإشراف الداخلي": "Housekeeping",
  "الاشراف الداخلي": "Housekeeping",
  "الهندسة والصيانة": "Engineering & Maintenance",
  "الهندسة": "Engineering",
  "الصيانة": "Maintenance",
  "الأمن والحراسة": "Security",
  "الأمن": "Security",
  "الامن": "Security",
  "المطبخ": "Kitchen",
  "الحسابات والمالية": "Finance & Accounting",
  "الحسابات": "Accounting",
  "المالية": "Finance",
  "المبيعات والتسويق": "Sales & Marketing",
  "المبيعات": "Sales",
  "التسويق": "Marketing",
  "تقنية المعلومات": "IT",
  "الزراعة والحدائق": "Landscaping",
  "الزراعة": "Landscaping",
  "المغسلة": "Laundry",
  "النقل والحركة": "Transportation",
  "الحركة": "Transportation",
  "المشتريات": "Purchasing",
  "المخازن": "Warehouse",
  "الجودة": "Quality",
  "علاقات النزلاء": "Guest Relations",
  "النادي الصحي": "Health Club & Spa",
  "الترفيه": "Animation & Activities",
  "سكن": "Housing",
  "داخلي": "Internal",
  "طرف ثالث": "Third Party",
  "فردي": "Single",
  "ثنائي": "Double",
  "ثلاثي": "Triple",
  "رباعي": "Quad",
  "جناح": "Suite",
};

export const safePdfText = (str: string | null | undefined, fallback?: string): string => {
  if (!str) return "—";
  const trimmed = str.trim();
  if (!/[\u0600-\u06FF]/.test(trimmed)) return trimmed;
  if (COMMON_ARABIC_TRANSLATIONS[trimmed]) return COMMON_ARABIC_TRANSLATIONS[trimmed];
  for (const [arKey, enVal] of Object.entries(COMMON_ARABIC_TRANSLATIONS)) {
    if (trimmed.includes(arKey)) return enVal;
  }
  const latin = trimmed.replace(/[^\x20-\x7E]/g, "").trim();
  if (latin.length >= 2) return latin;
  if (fallback) return fallback;
  const cleaned = trimmed.replace(/[\u0600-\u06FF]/g, "").trim();
  return cleaned || "General";
};

export const exportAnalyticsPDF = async (
  analytics: any,
  rooms: any[],
  profiles: any[],
  evalStats: any,
  properties: any[],
  propId: number | undefined,
  activePropertyId: number | undefined,
  settings: any,
) => {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const MARGIN = 14;
  const GUTTER = 8;
  const usable = pageW - MARGIN * 2;
  const colW = (usable - GUTTER) / 2;
  const colL = MARGIN;
  const colR = MARGIN + colW + GUTTER;

  const tblStyle = { fontSize: 8, cellPadding: 2.2 };
  const tblHead = {
    fillColor: [15, 42, 68] as [number, number, number],
    textColor: 255 as number,
    fontStyle: "bold" as const,
    fontSize: 8,
  };
  const tblAlt = { fillColor: [248, 250, 252] as [number, number, number] };

  const propName =
    properties.find((p: any) => p.id === (propId ?? activePropertyId))?.name ??
    "";

  const sH = (text: string, x: number, sy: number) => {
    doc.setFillColor(201, 162, 77);
    doc.rect(x, sy - 3.5, 2.5, 5, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 42, 68);
    doc.text(text, x + 4.5, sy);
    doc.setTextColor(0, 0, 0);
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(201, 162, 77);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, pageH - 8, pageW - MARGIN, pageH - 8);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(
      "Sunrise Staff Housing Management  ·  Confidential",
      MARGIN,
      pageH - 4,
    );
    doc.text(
      `Page ${pageNum} of ${totalPages}`,
      pageW - MARGIN,
      pageH - 4,
      { align: "right" },
    );
  };

  const y = await drawPdfHeader(
    doc,
    pageW,
    `Staff Housing Analytics & Performance Report${propName ? ` — ${propName}` : ""}`,
    `Generated: ${new Date().toLocaleString()}  |  Property: ${propName || "All Properties"}`,
    settings,
    properties,
    propId,
    activePropertyId,
  );

  // ─── 6 TOP KPI CARDS ──────────────────────────────────────────
  const kpiY = y;
  const kpiCardW = (usable - 5 * 2.5) / 6;
  const kpiCardH = 18;

  const kpiCards = [
    { label: "Total Rooms", value: String(rooms.length), sub: `${analytics.totalCapacity ?? 0} Beds`, color: [15, 42, 68], accent: [201, 162, 77] },
    { label: "Available Rooms", value: String(analytics.availableRooms ?? 0), sub: `${analytics.availableBeds ?? 0} Beds`, color: [22, 163, 74], accent: [34, 197, 94] },
    { label: "Occupied Rooms", value: String(analytics.occupiedRooms ?? 0), sub: `${analytics.totalOccupied ?? 0} Pax`, color: [37, 99, 235], accent: [59, 130, 246] },
    { label: "Maintenance", value: String(analytics.maintRooms ?? 0), sub: `${analytics.openMaint ?? 0} Open`, color: [234, 88, 12], accent: [249, 115, 22] },
    { label: "Total Beds", value: String(analytics.totalCapacity ?? 0), sub: `${analytics.totalOccupied ?? 0} Occupied`, color: [15, 42, 68], accent: [15, 42, 68] },
    { label: "Occupancy Rate", value: `${analytics.occRate ?? 0}%`, sub: `${analytics.totalOccupied ?? 0}/${analytics.totalCapacity ?? 0}`, color: (analytics.occRate ?? 0) >= 90 ? [220, 38, 38] : (analytics.occRate ?? 0) >= 70 ? [234, 88, 12] : [22, 163, 74], accent: [201, 162, 77] },
  ];

  kpiCards.forEach((card, i) => {
    const cx = MARGIN + i * (kpiCardW + 2.5);
    doc.setFillColor(250, 252, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, kpiY, kpiCardW, kpiCardH, 1.5, 1.5, "FD");

    doc.setFillColor(card.accent[0], card.accent[1], card.accent[2]);
    doc.rect(cx, kpiY, kpiCardW, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.text(card.value, cx + kpiCardW / 2, kpiY + 8.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(15, 42, 68);
    doc.text(card.label, cx + kpiCardW / 2, kpiY + 13, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(120, 130, 145);
    doc.text(card.sub, cx + kpiCardW / 2, kpiY + 16.5, { align: "center" });
  });

  // ─── Occupancy Progress Gauge Bar ──────────────────────────────
  const gaugeY = kpiY + kpiCardH + 3;
  const barW = usable;
  const barH = 2.5;
  doc.setFillColor(240, 242, 245);
  doc.roundedRect(MARGIN, gaugeY, barW, barH, 1, 1, "F");

  const fillW = Math.max(2, Math.min(barW, (barW * (analytics.occRate ?? 0)) / 100));
  const occColor = (analytics.occRate ?? 0) >= 90 ? [220, 38, 38] : (analytics.occRate ?? 0) >= 70 ? [234, 88, 12] : [22, 163, 74];
  doc.setFillColor(occColor[0], occColor[1], occColor[2]);
  doc.roundedRect(MARGIN, gaugeY, fillW, barH, 1, 1, "F");

  const tablesStartY = gaugeY + barH + 5;

  // ─── Table 1: Building Occupancy ───────────────────────────────
  sH("Occupancy by Building", colL, tablesStartY);
  if (analytics.byBuilding && analytics.byBuilding.length > 0) {
    autoTable(doc, {
      head: [["Building", "Rooms", "Beds", "Occ.", "Avail.", "Rate %"]],
      body: analytics.byBuilding.map((b: any) => [
        safePdfText(b.name, `Building #${b.id}`),
        String(b.totalRooms ?? 0),
        String(b.capacity ?? 0),
        String(b.currentOccupancy ?? 0),
        String(b.availableBeds ?? Math.max(0, (b.capacity ?? 0) - (b.currentOccupancy ?? 0))),
        `${b.rate}%`,
      ]),
      startY: tablesStartY + 2,
      styles: tblStyle,
      headStyles: tblHead,
      alternateRowStyles: tblAlt,
      columnStyles: {
        0: { cellWidth: colW * 0.38 },
        1: { cellWidth: colW * 0.12, halign: "center" },
        2: { cellWidth: colW * 0.12, halign: "center" },
        3: { cellWidth: colW * 0.12, halign: "center" },
        4: { cellWidth: colW * 0.12, halign: "center" },
        5: { cellWidth: colW * 0.14, fontStyle: "bold", halign: "center" },
      },
      tableWidth: colW,
      margin: { left: colL, right: pageW - colL - colW },
    });
  } else {
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("No building data available", colL + 4, tablesStartY + 8);
  }
  const bldgEndY = (doc as any).lastAutoTable?.finalY ?? tablesStartY + 35;

  // ─── Table 2: Room Types ───────────────────────────────────────
  const typeStartY = bldgEndY + 6;
  sH("Occupancy by Room Type", colL, typeStartY);
  if (analytics.byType && analytics.byType.length > 0) {
    autoTable(doc, {
      head: [["Room Type", "Rooms", "Total Beds", "Occupied", "Rate %"]],
      body: analytics.byType.map((t: any) => [
        safePdfText(t.type, "Standard"),
        String(t.rooms ?? 0),
        String(t.capacity ?? 0),
        String(t.occupied ?? 0),
        `${t.rate}%`,
      ]),
      startY: typeStartY + 2,
      styles: tblStyle,
      headStyles: tblHead,
      alternateRowStyles: tblAlt,
      columnStyles: {
        0: { cellWidth: colW * 0.40 },
        1: { cellWidth: colW * 0.14, halign: "center" },
        2: { cellWidth: colW * 0.16, halign: "center" },
        3: { cellWidth: colW * 0.16, halign: "center" },
        4: { cellWidth: colW * 0.14, fontStyle: "bold", halign: "center" },
      },
      tableWidth: colW,
      margin: { left: colL, right: pageW - colL - colW },
    });
  }

  // ─── Table 3: Residents by Department (Right Column) ──────────
  sH("Residents by Department", colR, tablesStartY);
  if (analytics.byDept && analytics.byDept.length > 0) {
    const totalDeptCount = analytics.byDept.reduce((acc: number, d: any) => acc + (d.count || 0), 0) || 1;
    autoTable(doc, {
      head: [["Department", "Active Residents", "Share %"]],
      body: analytics.byDept.slice(0, 8).map((d: any) => [
        safePdfText(d.dept, "Department"),
        String(d.count ?? 0),
        `${Math.round(((d.count || 0) / totalDeptCount) * 100)}%`,
      ]),
      startY: tablesStartY + 2,
      styles: tblStyle,
      headStyles: tblHead,
      alternateRowStyles: tblAlt,
      columnStyles: {
        0: { cellWidth: colW * 0.54 },
        1: { cellWidth: colW * 0.24, fontStyle: "bold", halign: "center" },
        2: { cellWidth: colW * 0.22, halign: "center" },
      },
      tableWidth: colW,
      margin: { left: colR, right: MARGIN },
    });
  }
  const deptEndY = (doc as any).lastAutoTable?.finalY ?? tablesStartY + 35;

  // ─── Table 4: Maintenance Overview (Right Column) ──────────────
  const maintStartY = deptEndY + 6;
  sH("Maintenance & Requests Overview", colR, maintStartY);
  autoTable(doc, {
    head: [["Category / Status", "Count", "Status"]],
    body: [
      ["Open Work Orders", String(analytics.openMaint ?? 0), (analytics.openMaint ?? 0) > 0 ? "Pending Action" : "Normal"],
      ["In-Progress Work Orders", String(analytics.inProg ?? 0), "In Work"],
      ["General Maintenance", String(analytics.ticketsByCategory?.maintenance ?? 0), "Category"],
      ["Housekeeping Requests", String(analytics.ticketsByCategory?.housekeeping ?? 0), "Category"],
      ["Other General Requests", String(analytics.ticketsByCategory?.general ?? 0), "Category"],
    ],
    startY: maintStartY + 2,
    styles: tblStyle,
    headStyles: tblHead,
    alternateRowStyles: tblAlt,
    columnStyles: {
      0: { cellWidth: colW * 0.54 },
      1: { cellWidth: colW * 0.22, fontStyle: "bold", halign: "center" },
      2: { cellWidth: colW * 0.24, halign: "center" },
    },
    tableWidth: colW,
    margin: { left: colR, right: MARGIN },
  });

  drawFooter(1, 2);

  // ─── PAGE 2: Details & Quality Evaluations ─────────────────────
  doc.addPage();
  const y2 = await drawPdfHeader(
    doc,
    pageW,
    `Performance Metrics & Resident Satisfaction${propName ? ` — ${propName}` : ""}`,
    `Detailed breakdown of service quality, technician throughput and housing policies`,
    settings,
    properties,
    propId,
    activePropertyId,
  );

  const p2StartY = y2 + 2;

  // Evaluations
  sH("Resident Evaluations & Satisfaction", colL, p2StartY);
  autoTable(doc, {
    head: [["Evaluation Metric", "Result"]],
    body: [
      ["Total Survey Submissions", String(evalStats?.total || 0)],
      ["Average Satisfaction Rating", evalStats?.average ? `${evalStats.average} / 5.0  (Score)` : "No ratings yet"],
      ["Positive Feedback (4 - 5 Stars)", `${evalStats?.positive || 0} (${evalStats?.total ? Math.round(((evalStats?.positive || 0) / evalStats.total) * 100) : 0}%)`],
      ["Needs Attention (<= 2 Stars)", `${evalStats?.negative || 0} (${evalStats?.total ? Math.round(((evalStats?.negative || 0) / evalStats.total) * 100) : 0}%)`],
    ],
    startY: p2StartY + 2,
    styles: tblStyle,
    headStyles: tblHead,
    alternateRowStyles: tblAlt,
    columnStyles: {
      0: { cellWidth: colW * 0.62 },
      1: { cellWidth: colW * 0.38, fontStyle: "bold", halign: "center" },
    },
    tableWidth: colW,
    margin: { left: colL, right: pageW - colL - colW },
  });
  const p2EvalEndY = (doc as any).lastAutoTable?.finalY ?? p2StartY + 35;

  // Gender Policy
  if (analytics.byGender && analytics.byGender.length > 0) {
    const genderStartY = p2EvalEndY + 6;
    sH("Housing Allocation by Gender Policy", colL, genderStartY);
    autoTable(doc, {
      head: [["Policy Classification", "Rooms Count"]],
      body: analytics.byGender.map((g: any) => [
        g.gender === "male" ? "Male Housing" : g.gender === "female" ? "Female Housing" : "Mixed / Open",
        String(g.count),
      ]),
      startY: genderStartY + 2,
      styles: tblStyle,
      headStyles: tblHead,
      alternateRowStyles: tblAlt,
      columnStyles: {
        0: { cellWidth: colW * 0.65 },
        1: { cellWidth: colW * 0.35, fontStyle: "bold", halign: "center" },
      },
      tableWidth: colW,
      margin: { left: colL, right: pageW - colL - colW },
    });
  }

  // Top Technicians
  sH("Maintenance Technician Performance", colR, p2StartY);
  if (analytics.topProfiles && analytics.topProfiles.length > 0) {
    autoTable(doc, {
      head: [["Technician Name", "Total", "Open", "Resolved", "Rate %"]],
      body: analytics.topProfiles.slice(0, 7).map((e: any) => {
        const rate = e.total > 0 ? Math.round(((e.resolved || 0) / e.total) * 100) : 0;
        return [
          safePdfText(e.name, `Staff #${e.empId || e.id}`),
          String(e.total ?? 0),
          String(e.open ?? 0),
          String(e.resolved ?? 0),
          `${rate}%`,
        ];
      }),
      startY: p2StartY + 2,
      styles: tblStyle,
      headStyles: tblHead,
      alternateRowStyles: tblAlt,
      columnStyles: {
        0: { cellWidth: colW * 0.44 },
        1: { cellWidth: colW * 0.14, halign: "center" },
        2: { cellWidth: colW * 0.14, halign: "center" },
        3: { cellWidth: colW * 0.14, halign: "center" },
        4: { cellWidth: colW * 0.14, fontStyle: "bold", halign: "center" },
      },
      tableWidth: colW,
      margin: { left: colR, right: MARGIN },
    });
  } else {
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("No technician performance records", colR + 4, p2StartY + 8);
  }

  // Signatures on Page 2
  const sigY = pageH - 32;
  doc.setDrawColor(220, 225, 230);
  doc.line(MARGIN, sigY, pageW - MARGIN, sigY);

  const sigColW = usable / 3;
  const sigTitles = ["Prepared By / Housing Officer", "Housing Manager", "General Manager / HR Director"];
  sigTitles.forEach((st, i) => {
    const sx = MARGIN + i * sigColW;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 42, 68);
    doc.text(st, sx + sigColW / 2, sigY + 5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text("Signature: ______________________", sx + sigColW / 2, sigY + 14, { align: "center" });
    doc.text("Date: ____ / ____ / ________", sx + sigColW / 2, sigY + 19, { align: "center" });
  });

  drawFooter(2, 2);

  doc.save(getExportFileName("Analytics_Report", "pdf"));
};

export const printArabicAnalyticsReport = async (opts: {
  analytics: any;
  rooms: any[];
  profiles: any[];
  evalStats: any;
  properties: any[];
  propId: number | undefined;
  activePropertyId: number | undefined;
  settings: any;
}) => {
  const { analytics, rooms, profiles, evalStats, properties, propId, activePropertyId, settings } = opts;
  const propObj = properties.find((p: any) => p.id === (propId ?? activePropertyId));
  const propName = propObj?.name ?? "";
  const propAddress = propObj?.address || "";

  const sysLogo = settings?.systemLogo ? await loadImgDataUrl(settings.systemLogo) : null;
  const propLogo = propObj?.logo && propObj.logo !== settings?.systemLogo ? await loadImgDataUrl(propObj.logo) : null;
  const today = new Date().toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const occRate = analytics?.occRate ?? 0;
  const occColor = occRate >= 90 ? "#ef4444" : occRate >= 70 ? "#f59e0b" : "#10b981";

  // Build building rows HTML
  const bldgRows = (analytics?.byBuilding || []).map((b: any) => {
    const rate = b.rate ?? 0;
    const bColor = rate >= 90 ? "#ef4444" : rate >= 70 ? "#f59e0b" : "#10b981";
    const availBeds = b.availableBeds ?? Math.max(0, (b.capacity || 0) - (b.currentOccupancy || 0));
    return `<tr>
      <td style="font-weight:700;">${b.name || "مبنى"}</td>
      <td style="text-align:center;">${b.totalRooms ?? 0}</td>
      <td style="text-align:center;">${b.capacity ?? 0}</td>
      <td style="text-align:center; font-weight:700; color:#1d4ed8;">${b.currentOccupancy ?? 0}</td>
      <td style="text-align:center; color:#15803d; font-weight:600;">${availBeds}</td>
      <td style="text-align:center;">
        <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
          <div style="flex:1; max-width:55px; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
            <div style="width:${rate}%; height:100%; background:${bColor};"></div>
          </div>
          <span style="font-weight:700; font-size:8pt; color:${bColor};">${rate}%</span>
        </div>
      </td>
    </tr>`;
  }).join("");

  // Room types rows
  const typeRows = (analytics?.byType || []).map((t: any) => {
    const rate = t.rate ?? 0;
    const tColor = rate >= 90 ? "#ef4444" : rate >= 70 ? "#f59e0b" : "#10b981";
    return `<tr>
      <td style="font-weight:600;">${t.type || "قياسية"}</td>
      <td style="text-align:center;">${t.rooms ?? 0}</td>
      <td style="text-align:center;">${t.capacity ?? 0}</td>
      <td style="text-align:center; font-weight:700;">${t.occupied ?? 0}</td>
      <td style="text-align:center; font-weight:700; color:${tColor};">${rate}%</td>
    </tr>`;
  }).join("");

  // Department rows
  const totalDeptCount = (analytics?.byDept || []).reduce((acc: number, d: any) => acc + (d.count || 0), 0) || 1;
  const deptRows = (analytics?.byDept || []).slice(0, 10).map((d: any) => {
    const share = Math.round(((d.count || 0) / totalDeptCount) * 100);
    return `<tr>
      <td style="font-weight:600;">${d.dept || "عام"}</td>
      <td style="text-align:center; font-weight:700; color:#1d4ed8;">${d.count ?? 0}</td>
      <td style="text-align:center;">
        <span style="display:inline-block; padding:1px 6px; border-radius:10px; background:#f1f5f9; font-weight:700; font-size:7.5pt;">${share}%</span>
      </td>
    </tr>`;
  }).join("");

  // Technicians rows
  const techRows = (analytics?.topProfiles || []).slice(0, 6).map((tech: any) => {
    const rate = tech.total > 0 ? Math.round(((tech.resolved || 0) / tech.total) * 100) : 0;
    return `<tr>
      <td style="font-weight:600;">${tech.name || `فني #${tech.empId || tech.id}`}</td>
      <td style="text-align:center;">${tech.total ?? 0}</td>
      <td style="text-align:center; color:#ea580c;">${tech.open ?? 0}</td>
      <td style="text-align:center; color:#15803d; font-weight:700;">${tech.resolved ?? 0}</td>
      <td style="text-align:center; font-weight:700; color:#0f2a44;">${rate}%</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تقرير التحليلات والإحصائيات الشاملة - ${propName || "سكن العاملين"}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      background: #f1f5f9;
      color: #0f172a;
      font-size: 8.5pt;
      line-height: 1.4;
    }
    .print-actions-bar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #0f2a44;
      color: #ffffff;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .btn {
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 9pt;
      cursor: pointer;
      font-family: inherit;
      border: none;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-primary { background: #c9a24d; color: #0f2a44; }
    .btn-primary:hover { background: #e0be6c; }
    .btn-outline { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.25); }
    .btn-outline:hover { background: rgba(255,255,255,0.2); }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 15px auto;
      background: #ffffff;
      padding: 10mm 12mm;
      box-shadow: 0 4px 15px rgba(0,0,0,0.06);
      border-radius: 4px;
      page-break-after: always;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .header img { max-height: 38px; max-width: 130px; object-fit: contain; }
    .gold-line { border: none; border-top: 2px solid #c9a24d; margin: 5px 0 8px; }
    .rep-title {
      font-size: 14pt;
      font-weight: 800;
      color: #0f2a44;
      text-align: center;
      margin-bottom: 2px;
    }
    .rep-sub {
      font-size: 8pt;
      color: #64748b;
      text-align: center;
      margin-bottom: 10px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 10px;
    }
    .kpi-card {
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #fafbfc;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: #c9a24d;
    }
    .kpi-card.green::before { background: #16a34a; }
    .kpi-card.blue::before { background: #2563eb; }
    .kpi-card.orange::before { background: #ea580c; }
    .kpi-val { font-size: 15pt; font-weight: 900; line-height: 1.1; margin-top: 2px; }
    .kpi-label { font-size: 7.5pt; font-weight: 700; color: #64748b; margin-top: 2px; }
    .occ-gauge-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 12px;
    }
    .sec-head {
      font-size: 9.5pt;
      font-weight: 800;
      color: #0f2a44;
      margin: 8px 0 4px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .sec-head::before {
      content: '';
      display: inline-block;
      width: 3.5px;
      height: 13px;
      background: #c9a24d;
      border-radius: 2px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 7.5pt; }
    th, td { border: 1px solid #e2e8f0; padding: 4px 6px; text-align: right; }
    th { background: #0f2a44; color: #ffffff; font-weight: 700; }
    tr:nth-child(even) td { background: #f8fafc; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .sig-block {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      page-break-inside: avoid;
    }
    .sig-box {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px;
      text-align: center;
      background: #fafbfc;
    }
    .sig-name { font-weight: 700; font-size: 8pt; color: #0f2a44; margin-bottom: 16px; }
    .sig-line { border-top: 1px dashed #94a3b8; margin: 0 10px 4px; }
    .foot {
      display: flex;
      justify-content: space-between;
      font-size: 7pt;
      color: #94a3b8;
      margin-top: 10px;
      padding-top: 4px;
      border-top: 1px solid #e2e8f0;
    }
    @media print {
      body { background: #ffffff; }
      .print-actions-bar { display: none !important; }
      .sheet {
        box-shadow: none;
        margin: 0;
        padding: 6mm 10mm;
        width: 100%;
        min-height: auto;
      }
      @page {
        size: A4 portrait;
        margin: 6mm 8mm;
      }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  <div class="print-actions-bar">
    <div style="font-weight:800; font-size:10pt;">
      تقرير التحليلات والإحصائيات الشاملة · ${propName || "سكن العاملين"}
    </div>
    <div style="display:flex; gap:8px;">
      <button class="btn btn-primary" onclick="window.print()">🖨️ طباعة / حفظ كـ PDF</button>
      <button class="btn btn-outline" onclick="window.close()">❌ إغلاق</button>
    </div>
  </div>

  <div class="sheet">
    <div class="header">
      ${propLogo ? `<img src="${propLogo.dataUrl}" alt="شعار الفرع" />` : "<div></div>"}
      ${sysLogo ? `<img src="${sysLogo.dataUrl}" alt="شعار النظام" />` : `<div style="font-weight:800; color:#0f2a44; font-size:11pt;">Sunrise Resorts & Cruises</div>`}
    </div>
    <hr class="gold-line" />
    <h1 class="rep-title">تقرير التحليلات والإحصائيات الشاملة لسكن العاملين</h1>
    <div class="rep-sub">
      الفرع: <strong>${propName || "كافة الفروع"}</strong> ${propAddress ? `(${propAddress})` : ""} · تاريخ الإصدار: ${today} · حالة السكن: رسمي ومعتمد
    </div>

    <!-- 8 KPI CARDS -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-val" style="color:#0f2a44;">${rooms.length}</div>
        <div class="kpi-label">إجمالي الغرف</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-val" style="color:#16a34a;">${analytics?.availableRooms ?? 0}</div>
        <div class="kpi-label">غرف شاغرة</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-val" style="color:#2563eb;">${analytics?.occupiedRooms ?? 0}</div>
        <div class="kpi-label">غرف مشغولة</div>
      </div>
      <div class="kpi-card orange">
        <div class="kpi-val" style="color:#ea580c;">${analytics?.maintRooms ?? 0}</div>
        <div class="kpi-label">غرف صيانة</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val" style="color:#0f2a44;">${analytics?.totalCapacity ?? 0}</div>
        <div class="kpi-label">إجمالي الأسِرّة</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-val" style="color:#16a34a;">${analytics?.availableBeds ?? 0}</div>
        <div class="kpi-label">أسِرّة شاغرة</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-val" style="color:#2563eb;">${analytics?.totalOccupied ?? 0}</div>
        <div class="kpi-label">أسِرّة مشغولة</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-val" style="color:${occColor};">${occRate}%</div>
        <div class="kpi-label">نسبة الإشغال الكلية</div>
      </div>
    </div>

    <!-- Occupancy Progress Gauge -->
    <div class="occ-gauge-box">
      <div style="display:flex; justify-content:space-between; font-size:8pt; margin-bottom:4px;">
        <span style="font-weight:700; color:#0f2a44;">نسبة الإشغال الفعلية للأسِرّة: ${occRate}%</span>
        <span style="color:#64748b;">${analytics?.totalOccupied ?? 0} سرير مشغول من أصل ${analytics?.totalCapacity ?? 0} سرير</span>
      </div>
      <div style="width:100%; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
        <div style="width:${occRate}%; height:100%; background:${occColor}; border-radius:4px;"></div>
      </div>
    </div>

    <!-- TABLES: Building Occupancy & Room Types -->
    <div class="sec-head">إشغال المباني السكنية</div>
    <table>
      <thead>
        <tr>
          <th>المبنى</th>
          <th style="text-align:center; width:65px;">الغرف</th>
          <th style="text-align:center; width:70px;">الأسِرّة الكلية</th>
          <th style="text-align:center; width:75px;">المشغول</th>
          <th style="text-align:center; width:75px;">الشاغر</th>
          <th style="text-align:center; width:110px;">نسبة الإشغال</th>
        </tr>
      </thead>
      <tbody>
        ${bldgRows || '<tr><td colspan="6" style="text-align:center;">لا توجد بيانات مبانٍ</td></tr>'}
      </tbody>
    </table>

    <div class="grid-2">
      <div>
        <div class="sec-head">الإشغال بحسب نوع الغرفة</div>
        <table>
          <thead>
            <tr>
              <th>نوع الغرفة</th>
              <th style="text-align:center;">الغرف</th>
              <th style="text-align:center;">الأسِرّة</th>
              <th style="text-align:center;">المشغول</th>
              <th style="text-align:center;">النسبة</th>
            </tr>
          </thead>
          <tbody>
            ${typeRows || '<tr><td colspan="5" style="text-align:center;">لا توجد بيانات</td></tr>'}
          </tbody>
        </table>
      </div>

      <div>
        <div class="sec-head">توزيع النزلاء حسب الأقسام</div>
        <table>
          <thead>
            <tr>
              <th>القسم / الإدارة</th>
              <th style="text-align:center;">المقيمين</th>
              <th style="text-align:center;">الحصة</th>
            </tr>
          </thead>
          <tbody>
            ${deptRows || '<tr><td colspan="3" style="text-align:center;">لا توجد بيانات أقسام</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- MAINTENANCE & EVALUATION SUMMARY -->
    <div class="grid-2" style="margin-top:6px;">
      <div>
        <div class="sec-head">ملخص طلبات الصيانة والإشراف</div>
        <table>
          <thead>
            <tr>
              <th>البند</th>
              <th style="text-align:center; width:60px;">العدد</th>
              <th style="text-align:center;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>بلاغات الصيانة المفتوحة</td>
              <td style="text-align:center; font-weight:700; color:#ea580c;">${analytics?.openMaint ?? 0}</td>
              <td style="text-align:center; color:#ea580c;">قيد الانتظار</td>
            </tr>
            <tr>
              <td>بلاغات قيد التنفيذ</td>
              <td style="text-align:center; font-weight:700; color:#2563eb;">${analytics?.inProg ?? 0}</td>
              <td style="text-align:center; color:#2563eb;">جاري العمل</td>
            </tr>
            <tr>
              <td>طلبات صيانة عامة</td>
              <td style="text-align:center;">${analytics?.ticketsByCategory?.maintenance ?? 0}</td>
              <td style="text-align:center; color:#64748b;">تصنيف</td>
            </tr>
            <tr>
              <td>طلبات الإشراف الداخلي</td>
              <td style="text-align:center;">${analytics?.ticketsByCategory?.housekeeping ?? 0}</td>
              <td style="text-align:center; color:#64748b;">تصنيف</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <div class="sec-head">مستوى رضا النزلاء والتقييمات</div>
        <table>
          <thead>
            <tr>
              <th>مؤشر التقييم</th>
              <th style="text-align:center;">النتيجة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>إجمالي الاستبيانات المستلمة</td>
              <td style="text-align:center; font-weight:700;">${evalStats?.total || 0}</td>
            </tr>
            <tr>
              <td>متوسط التقييم العام</td>
              <td style="text-align:center; font-weight:700; color:#d97706;">
                ${evalStats?.average ? `⭐ ${evalStats.average} / 5.0` : "لا توجد تقييمات"}
              </td>
            </tr>
            <tr>
              <td>تقييمات إيجابية (4 - 5 نجوم)</td>
              <td style="text-align:center; color:#15803d; font-weight:700;">
                ${evalStats?.positive || 0} (${evalStats?.total ? Math.round(((evalStats?.positive || 0) / evalStats.total) * 100) : 0}%)
              </td>
            </tr>
            <tr>
              <td>ملاحظات تتطلب متابعة (&le; نجمتين)</td>
              <td style="text-align:center; color:#dc2626; font-weight:700;">
                ${evalStats?.negative || 0} (${evalStats?.total ? Math.round(((evalStats?.negative || 0) / evalStats.total) * 100) : 0}%)
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    ${techRows ? `
    <div class="sec-head" style="margin-top:6px;">أداء أبرز الفنيين</div>
    <table>
      <thead>
        <tr>
          <th>اسم الفني</th>
          <th style="text-align:center; width:70px;">الإجمالي</th>
          <th style="text-align:center; width:70px;">المفتوح</th>
          <th style="text-align:center; width:70px;">المكتمل</th>
          <th style="text-align:center; width:80px;">نسبة الإنجاز</th>
        </tr>
      </thead>
      <tbody>
        ${techRows}
      </tbody>
    </table>` : ""}

    <!-- Signatures -->
    <div class="sig-block">
      <div class="sig-box">
        <div class="sig-name">إعداد / منسق السكن</div>
        <div class="sig-line"></div>
        <div style="font-size:7pt; color:#64748b;">التاريخ: ___ / ___ / 202__</div>
      </div>
      <div class="sig-box">
        <div class="sig-name">مدير سكن العاملين</div>
        <div class="sig-line"></div>
        <div style="font-size:7pt; color:#64748b;">التاريخ: ___ / ___ / 202__</div>
      </div>
      <div class="sig-box">
        <div class="sig-name">مدير الموارد البشرية / المدير العام</div>
        <div class="sig-line"></div>
        <div style="font-size:7pt; color:#64748b;">التاريخ: ___ / ___ / 202__</div>
      </div>
    </div>

    <div class="foot">
      <span>تاريخ الطباعة: ${today}</span>
      <span>Sunrise Staff Housing Management System — وثيقة رسمية معتمدة</span>
    </div>
  </div>

  <script>
    document.fonts.ready.then(function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=1050,height=850");
  if (!printWindow) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Analytics_Report_${Date.now()}.html`;
    a.click();
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
