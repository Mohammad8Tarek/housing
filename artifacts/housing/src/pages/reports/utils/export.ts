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

  const tblStyle = { fontSize: 8.5, cellPadding: 2.5 };
  const tblHead = {
    fillColor: [15, 42, 68] as [number, number, number],
    textColor: 255 as number,
    fontStyle: "bold" as const,
    fontSize: 8.5,
  };
  const tblAlt = { fillColor: [245, 247, 250] as [number, number, number] };

  const propName =
    properties.find((p: any) => p.id === (propId ?? activePropertyId))?.name ??
    "";

  const sH = (text: string, x: number, sy: number) => {
    doc.setFillColor(201, 162, 77);
    doc.rect(x, sy - 4, 2.5, 5.5, "F");
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 42, 68);
    doc.text(text, x + 4.5, sy);
    doc.setTextColor(0, 0, 0);
  };

  const drawFooter = () => {
    doc.setDrawColor(201, 162, 77);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, pageH - 8, pageW - MARGIN, pageH - 8);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(
      "Sunrise Staff Housing Management  ·  Confidential",
      pageW / 2,
      pageH - 4,
      { align: "center" },
    );
  };

  let y = await drawPdfHeader(
    doc,
    pageW,
    `Analytics Report${propName ? ` — ${propName}` : ""}`,
    `Generated: ${new Date().toLocaleString()}  |  Properties: ${propName || "All"}`,
    settings,
    properties,
    propId,
    activePropertyId,
  );

  const row1Y = y;

  sH("Key Performance Indicators", colL, row1Y);
  autoTable(doc, {
    head: [["Metric", "Value"]],
    body: [
      ["Total Rooms", String(rooms.length)],
      ["Available Rooms", String(analytics.availableRooms)],
      ["Occupied Rooms", String(analytics.occupiedRooms)],
      ["Maintenance Rooms", String(analytics.maintRooms)],
      ["Total Beds", String(analytics.totalCapacity)],
      ["Occupied Beds", String(analytics.totalOccupied)],
      ["Available Beds", String(analytics.availableBeds)],
      ["Occupancy Rate", `${analytics.occRate}%`],
      ["Total Profiles", String(profiles.length)],
      ["Active Residents", String(analytics.totalOccupied)],
      ["Open Maintenance", String(analytics.openMaint)],
      ["In-Progress Maint.", String(analytics.inProg)],
    ],
    startY: row1Y + 2,
    styles: tblStyle,
    headStyles: tblHead,
    alternateRowStyles: tblAlt,
    columnStyles: {
      0: { cellWidth: colW * 0.64 },
      1: {
        cellWidth: colW * 0.36,
        fontStyle: "bold",
        halign: "center" as const,
      },
    },
    tableWidth: colW,
    margin: { left: colL, right: pageW - colL - colW },
  });
  const kpiEndY = (doc as any).lastAutoTable?.finalY ?? row1Y + 80;

  sH("Occupancy by Building", colR, row1Y);
  if (analytics.byBuilding.length > 0) {
    autoTable(doc, {
      head: [["Building", "Rooms", "Beds", "Occupied", "Rate %"]],
      body: analytics.byBuilding.map((b: any) => [
        pdfTextSafe(b.name, `Bldg #${b.id}`),
        String(b.totalRooms),
        String(b.capacity),
        String(b.currentOccupancy),
        `${b.rate}%`,
      ]),
      startY: row1Y + 2,
      styles: tblStyle,
      headStyles: tblHead,
      alternateRowStyles: tblAlt,
      columnStyles: {
        0: { cellWidth: colW * 0.44 },
        1: { cellWidth: colW * 0.13, halign: "center" as const },
        2: { cellWidth: colW * 0.13, halign: "center" as const },
        3: { cellWidth: colW * 0.16, halign: "center" as const },
        4: {
          cellWidth: colW * 0.14,
          fontStyle: "bold",
          halign: "center" as const,
        },
      },
      tableWidth: colW,
      margin: { left: colR, right: MARGIN },
    });
  } else {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("No building data available", colR + 4, row1Y + 12);
    doc.setTextColor(0, 0, 0);
  }
  const bldgEndY = (doc as any).lastAutoTable?.finalY ?? row1Y + 80;

  const row2Y = Math.max(kpiEndY, bldgEndY) + 8;

  sH("Occupancy by Room Type", colL, row2Y);
  if (analytics.byType.length > 0) {
    autoTable(doc, {
      head: [["Room Type", "Rooms", "Total Beds", "Occupied", "Rate %"]],
      body: analytics.byType.map((t: any) => [
        pdfTextSafe(t.type),
        String(t.rooms),
        String(t.capacity),
        String(t.occupied),
        `${t.rate}%`,
      ]),
      startY: row2Y + 2,
      styles: tblStyle,
      headStyles: tblHead,
      alternateRowStyles: tblAlt,
      columnStyles: {
        0: { cellWidth: colW * 0.4 },
        1: { cellWidth: colW * 0.13, halign: "center" as const },
        2: { cellWidth: colW * 0.16, halign: "center" as const },
        3: { cellWidth: colW * 0.16, halign: "center" as const },
        4: {
          cellWidth: colW * 0.15,
          fontStyle: "bold",
          halign: "center" as const,
        },
      },
      tableWidth: colW,
      margin: { left: colL, right: pageW - colL - colW },
    });
  } else {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("No room type data available", colL + 4, row2Y + 12);
    doc.setTextColor(0, 0, 0);
  }

  sH("Residents by Department", colR, row2Y);
  if (analytics.byDept.length > 0) {
    autoTable(doc, {
      head: [["Department", "Active Residents"]],
      body: analytics.byDept.map((d: any) => [
        pdfTextSafe(d.dept),
        String(d.count),
      ]),
      startY: row2Y + 2,
      styles: tblStyle,
      headStyles: tblHead,
      alternateRowStyles: tblAlt,
      columnStyles: {
        0: { cellWidth: colW * 0.66 },
        1: {
          cellWidth: colW * 0.34,
          fontStyle: "bold",
          halign: "center" as const,
        },
      },
      tableWidth: colW,
      margin: { left: colR, right: MARGIN },
    });
  } else {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("No department data available", colR + 4, row2Y + 12);
    doc.setTextColor(0, 0, 0);
  }

  drawFooter();

  const hasPage2Data =
    analytics.openMaint > 0 ||
    analytics.inProg > 0 ||
    analytics.topProfiles.length > 0 ||
    evalStats.total > 0 ||
    analytics.byGender.length > 0;

  if (hasPage2Data) {
    doc.addPage();
    let y2 = await drawPdfHeader(
      doc,
      pageW,
      `Analytics Report${propName ? ` — ${propName}` : ""}  ·  Details`,
      `Generated: ${new Date().toLocaleString()}  |  Properties: ${propName || "All"}`,
      settings,
      properties,
      propId,
      activePropertyId,
    );

    const p2row1Y = y2;

    sH("Maintenance Summary", colL, p2row1Y);
    autoTable(doc, {
      head: [["Category", "Count"]],
      body: [
        ["Open Tickets", String(analytics.openMaint)],
        ["In-Progress Tickets", String(analytics.inProg)],
        [
          "Maintenance Requests",
          String(analytics.ticketsByCategory.maintenance),
        ],
        [
          "Housekeeping Requests",
          String(analytics.ticketsByCategory.housekeeping),
        ],
        ["General Requests", String(analytics.ticketsByCategory.general)],
      ],
      startY: p2row1Y + 2,
      styles: tblStyle,
      headStyles: tblHead,
      alternateRowStyles: tblAlt,
      columnStyles: {
        0: { cellWidth: colW * 0.66 },
        1: {
          cellWidth: colW * 0.34,
          fontStyle: "bold",
          halign: "center" as const,
        },
      },
      tableWidth: colW,
      margin: { left: colL, right: pageW - colL - colW },
    });
    const maintEndY = (doc as any).lastAutoTable?.finalY ?? p2row1Y + 45;

    sH("Resident Evaluations", colR, p2row1Y);
    autoTable(doc, {
      head: [["Metric", "Value"]],
      body: [
        ["Total Evaluations", String(evalStats.total || 0)],
        ["Average Rating", String(evalStats.average || "—")],
        ["Positive (4+ stars)", String(evalStats.positive || 0)],
        ["Negative (≤2 stars)", String(evalStats.negative || 0)],
      ],
      startY: p2row1Y + 2,
      styles: tblStyle,
      headStyles: tblHead,
      alternateRowStyles: tblAlt,
      columnStyles: {
        0: { cellWidth: colW * 0.64 },
        1: {
          cellWidth: colW * 0.36,
          fontStyle: "bold",
          halign: "center" as const,
        },
      },
      tableWidth: colW,
      margin: { left: colR, right: MARGIN },
    });
    const evalEndY = (doc as any).lastAutoTable?.finalY ?? p2row1Y + 45;

    const p2row2Y = Math.max(maintEndY, evalEndY) + 8;

    if (analytics.byGender.length > 0) {
      sH("Gender Policy Distribution", colL, p2row2Y);
      autoTable(doc, {
        head: [["Gender Policy", "Rooms"]],
        body: analytics.byGender.map((g: any) => [
          g.gender === "male"
            ? "Male Only"
            : g.gender === "female"
              ? "Female Only"
              : "Mixed / Any",
          String(g.count),
        ]),
        startY: p2row2Y + 2,
        styles: tblStyle,
        headStyles: tblHead,
        alternateRowStyles: tblAlt,
        columnStyles: {
          0: { cellWidth: colW * 0.66 },
          1: {
            cellWidth: colW * 0.34,
            fontStyle: "bold",
            halign: "center" as const,
          },
        },
        tableWidth: colW,
        margin: { left: colL, right: pageW - colL - colW },
      });
    }

    if (analytics.topProfiles.length > 0) {
      sH("Top Technician Performance", colR, p2row2Y);
      autoTable(doc, {
        head: [["Technician", "Total", "Open", "Resolved"]],
        body: analytics.topProfiles.map((e: any) => [
          pdfTextSafe(e.name, `Emp #${e.empId}`),
          String(e.total),
          String(e.open),
          String(e.resolved),
        ]),
        startY: p2row2Y + 2,
        styles: tblStyle,
        headStyles: tblHead,
        alternateRowStyles: tblAlt,
        columnStyles: {
          0: { cellWidth: colW * 0.46 },
          1: { cellWidth: colW * 0.18, halign: "center" as const },
          2: { cellWidth: colW * 0.18, halign: "center" as const },
          3: {
            cellWidth: colW * 0.18,
            fontStyle: "bold",
            halign: "center" as const,
          },
        },
        tableWidth: colW,
        margin: { left: colR, right: MARGIN },
      });
    }

    drawFooter();
  }

  doc.save(getExportFileName("Analytics_Report", "pdf"));
};
