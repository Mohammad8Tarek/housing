// ════════════════════════════════════════════════════════════
// Smart Report Column Definitions — Phase 1 (6 core reports)
// ════════════════════════════════════════════════════════════
// Each export maps a report to its typed column definitions.
// SMART_REPORT_TABS links report Tab names to their columns
// so ReportsPage can look up the right definition by tab key.
// ════════════════════════════════════════════════════════════

import type { ReportColumnDef } from '@/lib/report/columnTypes';
import type { Tab } from '@/pages/reports/types';

// ── 1. OCCUPANCY REPORT (housing tab) ──
export const OCCUPANCY_REPORT_COLUMNS: ReportColumnDef[] = [
  { key: 'index',         header: '#',              headerAr: '#',              type: 'index'      },
  { key: 'buildingName',  header: 'Building',       headerAr: 'المبنى',        type: 'text-short' },
  { key: 'floorName',     header: 'Floor',          headerAr: 'الطابق',        type: 'text-short' },
  { key: 'roomNumber',    header: 'Room',           headerAr: 'رقم الغرفة',    type: 'id'         },
  { key: 'capacity',      header: 'Capacity',       headerAr: 'السعة',         type: 'number'     },
  { key: 'currentOccupancy', header: 'Occupied',    headerAr: 'المشغول',       type: 'number'     },
  { key: 'vacantBeds',    header: 'Available',      headerAr: 'الشاغر',        type: 'number'     },
  { key: 'occupancyRate', header: 'Rate',           headerAr: 'نسبة الإشغال',  type: 'percentage' },
  { key: 'status',        header: 'Status',         headerAr: 'حالة الغرفة',   type: 'status'     },
];

// ── 2. EMPLOYEE ROSTER REPORT (assignments tab) ──
export const EMPLOYEE_REPORT_COLUMNS: ReportColumnDef[] = [
  { key: 'index',         header: '#',              headerAr: '#',              type: 'index'      },
  { key: 'profileCode',   header: 'Employee Code',  headerAr: 'كود الموظف',    type: 'id'         },
  { key: 'fullName',      header: 'Full Name',      headerAr: 'الاسم بالكامل', type: 'text'       },
  { key: 'department',    header: 'Department',     headerAr: 'القسم',         type: 'text-short' },
  { key: 'jobTitle',      header: 'Job Title',      headerAr: 'الوظيفة',       type: 'text-short' },
  { key: 'buildingName',  header: 'Building',       headerAr: 'المبنى',        type: 'text-short' },
  { key: 'roomNumber',    header: 'Room',           headerAr: 'رقم الغرفة',    type: 'id'         },
  { key: 'checkInDate',   header: 'Check-in',       headerAr: 'تاريخ التسكين', type: 'date'       },
  { key: 'status',        header: 'Status',         headerAr: 'الحالة',        type: 'status'     },
];

// ── 3. FAMILY VISIT / HOSTING REPORT (hostings tab) ──
export const VISIT_REPORT_COLUMNS: ReportColumnDef[] = [
  { key: 'index',         header: '#',              headerAr: '#',              type: 'index'      },
  { key: 'hostEmployee',  header: 'Host Employee',  headerAr: 'الموظف المستضيف', type: 'text'     },
  { key: 'hostDept',      header: 'Department',     headerAr: 'القسم',         type: 'text-short' },
  { key: 'guestName',     header: 'Guest Name',     headerAr: 'اسم الضيف',     type: 'text'       },
  { key: 'relation',      header: 'Relationship',   headerAr: 'صلة القرابة',   type: 'text-short' },
  { key: 'guestId',       header: 'ID Number',      headerAr: 'رقم الهوية',    type: 'id'         },
  { key: 'roomNumber',    header: 'Room No',        headerAr: 'رقم الغرفة',    type: 'id'         },
  { key: 'checkInDate',   header: 'Check-In',       headerAr: 'تاريخ الدخول',  type: 'date'       },
  { key: 'checkOutDate',  header: 'Check-Out',      headerAr: 'تاريخ المغادرة', type: 'date'      },
  { key: 'dailyRate',     header: 'Daily Rate',     headerAr: 'سعر اليوم',     type: 'currency'   },
  { key: 'totalAmount',   header: 'Total Fee',      headerAr: 'الإجمالي',      type: 'currency'   },
  { key: 'status',        header: 'Status',         headerAr: 'الحالة',        type: 'status'     },
];

// ── 4. DAILY MOVEMENT REPORT (daily_movement tab) ──
export const MOVEMENT_REPORT_COLUMNS: ReportColumnDef[] = [
  { key: 'index',         header: '#',              headerAr: '#',              type: 'index'      },
  { key: 'movementType',  header: 'Type',           headerAr: 'نوع الحركة',    type: 'status'     },
  { key: 'date',          header: 'Date / Time',    headerAr: 'التاريخ والوقت', type: 'datetime'  },
  { key: 'profileName',   header: 'Resident',       headerAr: 'المقيم / النزيل', type: 'text'     },
  { key: 'profileCode',   header: 'Code',           headerAr: 'كود الموظف',    type: 'id'         },
  { key: 'department',    header: 'Department',     headerAr: 'القسم',         type: 'text-short' },
  { key: 'roomNumber',    header: 'Room',           headerAr: 'الغرفة',        type: 'id'         },
  { key: 'bedNumber',     header: 'Bed',            headerAr: 'السرير',        type: 'id'         },
  { key: 'buildingName',  header: 'Building',       headerAr: 'المبنى',        type: 'text-short' },
  { key: 'notes',         header: 'Details',        headerAr: 'التفاصيل والملاحظات', type: 'text'  },
];

// ── 5. AUDIT LOG REPORT (standalone — not in ReportsPage tabs) ──
export const AUDIT_REPORT_COLUMNS: ReportColumnDef[] = [
  { key: 'index',         header: '#',              headerAr: '#',              type: 'index'      },
  { key: 'timestamp',     header: 'Timestamp',      headerAr: 'الوقت',         type: 'datetime'   },
  { key: 'user.name',     header: 'User',           headerAr: 'المستخدم',      type: 'text-short' },
  { key: 'user.role',     header: 'Role',           headerAr: 'الدور',         type: 'text-short' },
  { key: 'action',        header: 'Action',         headerAr: 'الإجراء',       type: 'status'     },
  { key: 'entity',        header: 'Entity',         headerAr: 'الكيان',        type: 'text-short' },
  { key: 'entityId',      header: 'Entity ID',      headerAr: 'رقم الكيان',    type: 'id'         },
  { key: 'description',   header: 'Details',        headerAr: 'التفاصيل',      type: 'text'       },
];

// ── 6. MAINTENANCE REPORT (maintenance tab) ──
export const MAINTENANCE_REPORT_COLUMNS: ReportColumnDef[] = [
  { key: 'index',         header: '#',              headerAr: '#',              type: 'index'      },
  { key: 'roomNumber',    header: 'Room',           headerAr: 'رقم الغرفة',    type: 'id'         },
  { key: 'buildingName',  header: 'Building',       headerAr: 'المبنى',        type: 'text-short' },
  { key: 'category',      header: 'Category',       headerAr: 'الفئة',         type: 'text-short' },
  { key: 'problemType',   header: 'Problem Details', headerAr: 'وصف المشكلة',  type: 'text'       },
  { key: 'priority',      header: 'Priority',       headerAr: 'الأولوية',      type: 'status'     },
  { key: 'assignedTo',    header: 'Assigned To',    headerAr: 'الفني المعين',  type: 'text-short' },
  { key: 'reportedAt',    header: 'Reported',       headerAr: 'تاريخ البلاغ',  type: 'date'       },
  { key: 'status',        header: 'Status',         headerAr: 'الحالة',        type: 'status'     },
];

// ════════════════════════════════════════════════════════════
// Tab → Column Definition lookup (used by ReportsPage)
// ════════════════════════════════════════════════════════════
// Only tabs with smart report definitions appear here.
// Adding a new report is trivial: define columns above,
// then add a single entry here.

export const SMART_REPORT_TABS: Partial<Record<Tab, {
  columns: ReportColumnDef[];
  title: string;
  titleAr: string;
}>> = {
  housing: {
    columns: OCCUPANCY_REPORT_COLUMNS,
    title: 'Occupancy Report',
    titleAr: 'تقرير الإشغال',
  },
  assignments: {
    columns: EMPLOYEE_REPORT_COLUMNS,
    title: 'Employee Roster Report',
    titleAr: 'تقرير سكن الموظفين',
  },
  hostings: {
    columns: VISIT_REPORT_COLUMNS,
    title: 'Family Visit Report',
    titleAr: 'تقرير الاستضافات والزيارات',
  },
  daily_movement: {
    columns: MOVEMENT_REPORT_COLUMNS,
    title: 'Daily Movement Report',
    titleAr: 'تقرير الحركة اليومية',
  },
  maintenance: {
    columns: MAINTENANCE_REPORT_COLUMNS,
    title: 'Maintenance Report',
    titleAr: 'تقرير الصيانة',
  },
};
