// ════════════════════════════════════════════════════════════
// Width Engine — Core algorithm for smart column sizing
// ════════════════════════════════════════════════════════════
// Distributes the page width intelligently so:
//   - Fixed-type columns get their exact mm from the width matrix
//   - 'text' columns share the remaining space equally
//   - If columns overflow the page → switch to landscape automatically
//   - If still overflowing → compress proportionally
// ════════════════════════════════════════════════════════════

import {
  ReportColumnDef, ColumnType,
  TYPE_WIDTH_MM, TYPE_ALIGN, TYPE_OVERFLOW, formatValue
} from './columnTypes';
import type { UserOptions } from 'jspdf-autotable';

// A4 dimensions in mm
const A4_PORTRAIT_USABLE  = 180; // 210mm - 15mm margins each side
const A4_LANDSCAPE_USABLE = 267; // 297mm - 15mm margins each side

export type PageOrientation = 'portrait' | 'landscape';

export interface ColumnLayout {
  columnStyles: UserOptions['columnStyles'];
  orientation: PageOrientation;
  head: string[][];
  body: string[][];
}

export function buildColumnLayout(
  columns: ReportColumnDef[],
  data: Record<string, unknown>[],
  language?: 'en' | 'ar'
): ColumnLayout {
  // 1. Filter out PDF-hidden columns
  const cols = columns.filter(c => !c.hiddenInPdf);

  // 2. Separate fixed and flexible columns
  const fixedCols  = cols.filter(c => c.type !== 'text');
  const flexCols   = cols.filter(c => c.type === 'text');

  // 3. Calculate total fixed width
  const totalFixed = fixedCols.reduce((sum, col) => {
    return sum + (col.widthOverride ?? TYPE_WIDTH_MM[col.type as Exclude<ColumnType, 'text'>] ?? 25);
  }, 0);

  // 4. Choose orientation
  let orientation: PageOrientation = 'portrait';
  let usableWidth = A4_PORTRAIT_USABLE;

  if (totalFixed > A4_PORTRAIT_USABLE * 0.85 || cols.length > 8) {
    orientation = 'landscape';
    usableWidth = A4_LANDSCAPE_USABLE;
  }

  // 5. Calculate flex column widths
  const remainingWidth = usableWidth - totalFixed;
  const flexWidth = flexCols.length > 0
    ? Math.max(25, remainingWidth / flexCols.length)  // min 25mm per flex col
    : 0;

  // 6. Build jsPDF-AutoTable columnStyles
  const columnStyles: UserOptions['columnStyles'] = {};
  cols.forEach((col, idx) => {
    const isFixed = col.type !== 'text';
    const width   = col.widthOverride
      ?? (isFixed ? TYPE_WIDTH_MM[col.type as Exclude<ColumnType, 'text'>] : flexWidth);
    columnStyles[idx] = {
      cellWidth:  width,
      halign:     TYPE_ALIGN[col.type] as 'left' | 'right' | 'center',
      overflow:   TYPE_OVERFLOW[col.type] as 'linebreak' | 'ellipsize' | 'hidden',
      font:       col.type === 'id' ? 'courier' : 'helvetica',
    };
  });

  // 7. Format data into string rows — use Arabic headers if language is 'ar'
  const useAr = language === 'ar';
  const head = [cols.map(c => (useAr && c.headerAr) ? c.headerAr : c.header)];
  const body = data.map((row, rowIdx) =>
    cols.map(col => {
      if (col.format) return col.format(getNestedValue(row, col.key), row);
      if (col.type === 'index') return String(rowIdx + 1);
      return formatValue(getNestedValue(row, col.key), col.type);
    })
  );

  return { columnStyles, orientation, head, body };
}

const COMMON_KEY_ALIASES: Record<string, string[]> = {
  occupantName: ['fullName', 'profileName', 'guestName', 'name', 'employeeName'],
  guestName: ['fullName', 'profileName', 'occupantName', 'name'],
  building: ['buildingName', 'buildingCode'],
  buildingName: ['building', 'buildingCode'],
  floor: ['floorName', 'floorNumber'],
  floorName: ['floor', 'floorNumber'],
  issueId: ['id', 'ticketId'],
  issueDescription: ['problemType', 'description', 'notes'],
  problemType: ['issueDescription', 'issue', 'description'],
  resolutionStatus: ['status', 'rawStatus'],
  reportedBy: ['reporter', 'reportedByName', 'createdBy'],
  assignedTo: ['workerName', 'assignedToName', 'technician'],
  occupancyStatus: ['status', 'statusCategory'],
  roomNumber: ['room_number', 'roomNo', 'room'],
  bedNumber: ['bed_number', 'bedNo'],
  checkInDate: ['check_in_date', 'arrivalDate'],
  checkOutDate: ['check_out_date', 'departureDate'],
  reportDate: ['date', 'created_at', 'createdAt'],
  property: ['propertyName', 'hotelName'],
  daysInHouse: ['nights', 'stayDays'],
  totalCapacity: ['capacity', 'beds'],
  currentOccupants: ['occupiedCount', 'occupiedBeds', 'currentOccupancy'],
  vacantBeds: ['availableBeds', 'vacantCount'],
  occupantsSummary: ['residentsSummary', 'occupantsList'],
};

// Resolve dot-path keys: 'employee.name' → row.employee.name, with smart fallback to common aliases
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (!obj) return undefined;

  // Direct lookup first
  const direct = path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj as unknown);

  if (direct !== undefined && direct !== null) return direct;

  // Check aliases if direct is undefined/null
  const aliases = COMMON_KEY_ALIASES[path];
  if (aliases) {
    for (const alias of aliases) {
      const val = (obj as Record<string, unknown>)[alias];
      if (val !== undefined && val !== null) return val;
    }
  }

  return undefined;
}

