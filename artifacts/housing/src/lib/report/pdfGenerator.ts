// ════════════════════════════════════════════════════════════
// PDF Generator — jsPDF + AutoTable branded report template
// ════════════════════════════════════════════════════════════

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildColumnLayout } from './widthEngine';
import { STATUS_COLORS } from './columnTypes';
import type { ReportColumnDef } from './columnTypes';

export interface ReportMeta {
  title: string;           // e.g. "Occupancy Report"
  subtitle?: string;       // e.g. "White Hills Resort — Building A"
  filters?: Record<string, string>; // e.g. { "Period": "Jan–Mar 2025", "Building": "A" }
  generatedBy?: string;    // current user's name
  logoBase64?: string;     // resort logo as base64 PNG
}

// Brand colors (Sunrise Resorts)
const BRAND = {
  primary:   [15,  82, 186] as [number, number, number],  // deep blue
  secondary: [234, 179,  8 ] as [number, number, number],  // gold
  headerBg:  [15,  23,  42] as [number, number, number],  // dark navy
  headerText:[255, 255, 255] as [number, number, number],  // white
  rowAlt:    [248, 250, 252] as [number, number, number],  // very light grey
  border:    [226, 232, 240] as [number, number, number],  // slate-200
  text:      [30,  41,  59] as [number, number, number],  // slate-800
  subtext:   [100, 116, 139] as [number, number, number],  // slate-500
};

export function generateReportPDF(
  meta: ReportMeta,
  columns: ReportColumnDef[],
  data: Record<string, unknown>[],
  language?: 'en' | 'ar'
): void {
  // ── 1. Build layout (auto orientation + widths) ──
  const layout = buildColumnLayout(columns, data, language);

  // ── 2. Create PDF with correct orientation ──
  const doc = new jsPDF({
    orientation: layout.orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  let curY = margin;

  // ── 3. Header block ──
  // Resort logo (top-left)
  if (meta.logoBase64) {
    doc.addImage(meta.logoBase64, 'PNG', margin, curY, 30, 12);
  }

  // Report title (right of logo or top)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.primary);
  doc.text(meta.title, pageW - margin, curY + 4, { align: 'right' });

  if (meta.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.subtext);
    doc.text(meta.subtitle, pageW - margin, curY + 10, { align: 'right' });
  }

  curY += 18;

  // ── 4. Filter summary bar ──
  if (meta.filters && Object.keys(meta.filters).length > 0) {
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(margin, curY, pageW - margin * 2, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.subtext);

    const filterText = Object.entries(meta.filters)
      .map(([k, v]) => `${k}: ${v}`).join('   |   ');
    doc.text(filterText, margin + 3, curY + 5);
    curY += 12;
  }

  // ── 5. Generated info line ──
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND.subtext);
  const now = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const genLine = `Generated: ${now}${meta.generatedBy ? `  ·  By: ${meta.generatedBy}` : ''}  ·  Total records: ${data.length}`;
  doc.text(genLine, margin, curY);
  curY += 6;

  // ── 6. Table ──
  autoTable(doc, {
    head: layout.head,
    body: layout.body,
    startY: curY,
    margin: { left: margin, right: margin, top: margin, bottom: 20 },

    // ── Column widths + alignment from engine ──
    columnStyles: layout.columnStyles,

    // ── Header row style ──
    headStyles: {
      fillColor: BRAND.headerBg,
      textColor: BRAND.headerText,
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      lineColor: BRAND.headerBg,
      lineWidth: 0,
      overflow: 'linebreak',
      minCellHeight: 10,
    },

    // ── Body row style ──
    bodyStyles: {
      fontSize: 8,
      textColor: BRAND.text,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      lineColor: BRAND.border,
      lineWidth: 0.2,
      minCellHeight: 8,
    },

    // ── Alternating row color ──
    alternateRowStyles: {
      fillColor: BRAND.rowAlt,
    },

    // ── Status cell coloring ──
    didDrawCell: (cellData) => {
      if (cellData.section !== 'body') return;
      const col = columns.filter(c => !c.hiddenInPdf)[cellData.column.index];
      if (!col || col.type !== 'status') return;
      const raw = String(cellData.cell.raw ?? '').toLowerCase().replace(/\s+/g, '_');
      const color = STATUS_COLORS[raw];
      if (!color) return;
      // Draw colored dot before text
      const { x, y, height } = cellData.cell;
      doc.setFillColor(color.r, color.g, color.b);
      doc.circle(x + 4, y + height / 2, 1.5, 'F');
    },

    // ── Footer: page numbers ──
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const pageNum   = doc.getCurrentPageInfo().pageNumber;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.subtext);
      // Page number center-bottom
      doc.text(
        `Page ${pageNum} of ${pageCount}`,
        pageW / 2, pageH - 8, { align: 'center' }
      );
      // Report title repeated bottom-left
      doc.text(meta.title, margin, pageH - 8);
    },

    // ── Column wrap settings ──
    tableWidth: 'auto',
    showHead: 'everyPage',
  });

  // ── 7. Save ──
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${meta.title.toLowerCase().replace(/\s+/g, '-')}-${dateStr}.pdf`;
  doc.save(filename);
}
