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
export const STATUS_COLORS: Record<string, { r: number; g: number; b: number }> = {
  active:       { r: 52,  g: 211, b: 153 },  // green
  approved:     { r: 52,  g: 211, b: 153 },
  pending:      { r: 251, g: 191, b: 36  },  // amber
  reviewing:    { r: 129, g: 140, b: 248 },  // indigo
  rejected:     { r: 248, g: 113, b: 133 },  // rose
  inactive:     { r: 100, g: 116, b: 139 },  // slate
  maintenance:  { r: 251, g: 191, b: 36  },
  available:    { r: 52,  g: 211, b: 153 },
  occupied:     { r: 248, g: 113, b: 133 },
  checked_in:   { r: 52,  g: 211, b: 153 },
  checked_out:  { r: 100, g: 116, b: 139 },
  dirty:        { r: 251, g: 191, b: 36  },
  clean:        { r: 52,  g: 211, b: 153 },
  out_of_order: { r: 248, g: 113, b: 133 },
  out_of_service: { r: 100, g: 116, b: 139 },
  open:         { r: 251, g: 191, b: 36  },
  closed:       { r: 100, g: 116, b: 139 },
  resolved:     { r: 52,  g: 211, b: 153 },
  in_progress:  { r: 129, g: 140, b: 248 },
  high:         { r: 248, g: 113, b: 133 },
  medium:       { r: 251, g: 191, b: 36  },
  low:          { r: 52,  g: 211, b: 153 },
  critical:     { r: 220, g: 38,  b: 38  },
  check_in:     { r: 52,  g: 211, b: 153 },
  check_out:    { r: 248, g: 113, b: 133 },
  transfer:     { r: 129, g: 140, b: 248 },
  vacation:     { r: 251, g: 191, b: 36  },
};

// ── Width matrix (in mm, A4 reference) ──
// 'text' type has no fixed width — it's flex (fills remaining space)
export const TYPE_WIDTH_MM: Record<Exclude<ColumnType, 'text'>, number> = {
  id:          22,
  'text-short': 30,
  number:      18,
  currency:    30,
  date:        24,
  datetime:    38,
  status:      24,
  boolean:     14,
  percentage:  18,
  phone:       30,
  index:       10,
};

export const TYPE_ALIGN: Record<ColumnType, string> = {
  id:          'left',
  text:        'left',
  'text-short': 'left',
  number:      'right',
  currency:    'right',
  date:        'center',
  datetime:    'center',
  status:      'center',
  boolean:     'center',
  percentage:  'right',
  phone:       'left',
  index:       'center',
};

export const TYPE_OVERFLOW: Record<ColumnType, string> = {
  id:          'ellipsize',
  text:        'linebreak',   // ← only type that wraps
  'text-short': 'ellipsize',
  number:      'ellipsize',
  currency:    'ellipsize',
  date:        'ellipsize',
  datetime:    'ellipsize',
  status:      'ellipsize',
  boolean:     'ellipsize',
  percentage:  'ellipsize',
  phone:       'ellipsize',
  index:       'ellipsize',
};

// ── Value formatters ──
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
