// ════════════════════════════════════════════════════════════
// Public API — barrel exports for src/lib/report
// ════════════════════════════════════════════════════════════

export { type ColumnType, type ReportColumnDef, STATUS_COLORS, TYPE_WIDTH_MM, TYPE_ALIGN, TYPE_OVERFLOW, formatValue } from './columnTypes';
export { type PageOrientation, type ColumnLayout, buildColumnLayout, getNestedValue } from './widthEngine';
export { type ReportMeta, generateReportPDF } from './pdfGenerator';
