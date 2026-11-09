export type ColumnType =
  | 'id'           // EMP-001, B-12 — fixed narrow, monospace
  | 'text'         // names, descriptions — FLEXIBLE, fills remaining space, wraps
  | 'text-short'   // department, position, building — medium fixed, ellipsized
  | 'number'       // counts, quantities — narrow, right-aligned, comma-formatted
  | 'currency'     // EGP 1,500.00 — medium, right-aligned
  | 'date'         // 15 Mar 2025 — fixed, centered
  | 'datetime'     // 15 Mar 2025 14:30 — fixed wider, centered
  | 'status'       // Active / Pending / Rejected — narrow, centered, color-mapped
  | 'boolean'      // Yes / No — very narrow, centered
  | 'percentage'   // 85.5% — narrow, right-aligned
  | 'phone'        // +20 100 000 0000 — medium, left-aligned
  | 'index';       // Row number — very narrow, centered

export interface ReportColumnDef {
  key: string;            // dot-path to field in data object (e.g. 'employee.name')
  header: string;         // column header label shown in table and PDF (English)
  headerAr?: string;      // Arabic column header label
  type: ColumnType;       // determines width + alignment + formatting
  widthOverride?: number; // override auto width in mm (use sparingly)
  hiddenInPdf?: boolean;  // exclude this column from PDF/print
  hiddenInTable?: boolean;// exclude from web table (PDF only)
  format?: (value: unknown, row: Record<string, unknown>) => string; // custom renderer
}

// ── Status color mapping (PDF uses text labels, web uses badges) ──
export function formatValue(value: unknown, type: ColumnType): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (type) {
    case 'date': {
      const d = new Date(value as string);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    }
    case 'datetime': {
      const d = new Date(value as string);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    }
    case 'number':
      return Number(value).toLocaleString('en-US');
    case 'currency':
      return `EGP ${Number(value).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
      })}`;
    case 'percentage':
      return `${Number(value).toFixed(1)}%`;
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'status':
      return String(value).replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    case 'index':
      return `#${value}`;
    default:
      return String(value);
  }
}

/** Header metadata for a report export (title + optional subtitle/filters). */
export interface ReportMeta {
  title: string;
  subtitle?: string;
  filters?: Record<string, string>;
  generatedBy?: string;
}
