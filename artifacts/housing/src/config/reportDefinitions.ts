// ════════════════════════════════════════════════════════════
// FILE: src/config/reportDefinitions.ts
// Complete column definitions for all 23 reports
// Generated for: Comprehensive Reports module
// ════════════════════════════════════════════════════════════

import type { ReportColumnDef } from '@/lib/report/columnTypes';
import { formatValue } from '@/lib/report/columnTypes';
import type { Tab } from '@/pages/reports/types';
import type { ReportMeta } from '@/lib/report/pdfGenerator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

// ══════════════════════════════════════════════════════════
// GROUP 1 — OPERATIONS
// ══════════════════════════════════════════════════════════

// 1. MORNING OPERATIONS REPORT
// Orientation: LANDSCAPE — 11 columns, wide summary
export const MORNING_OPERATIONS_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',           headerAr: '#',                  type: 'index'      },
  { key: 'reportDate',       header: 'Date',        headerAr: 'التاريخ',            type: 'date'       },
  { key: 'property',         header: 'Property',    headerAr: 'المنشأة / الفندق',   type: 'text-short' },
  { key: 'totalRooms',       header: 'Total Rooms', headerAr: 'إجمالي الغرف',      type: 'number'     },
  { key: 'occupied',         header: 'Occupied',    headerAr: 'المشغول',            type: 'number'     },
  { key: 'available',        header: 'Available',   headerAr: 'الشاغر المتاح',      type: 'number'     },
  { key: 'occupancyPct',     header: 'Occ. %',      headerAr: 'نسبة الإشغال',       type: 'percentage' },
  { key: 'arrivalsToday',    header: 'Arrivals',    headerAr: 'وصول اليوم',         type: 'number'     },
  { key: 'departuresToday',  header: 'Departures',  headerAr: 'مغادرات اليوم',      type: 'number'     },
  { key: 'inHouseCount',     header: 'In-House',    headerAr: 'النزلاء الفعليون',   type: 'number'     },
  { key: 'operationalNotes', header: 'Notes',       headerAr: 'ملاحظات تشغيلية',    type: 'text'       },
];

// 2. RESERVATIONS & ARRIVALS
// Orientation: LANDSCAPE — guest-facing, rich data
export const RESERVATIONS_ARRIVALS_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'reservationId',    header: 'Res. ID',      headerAr: 'رقم الحجز',         type: 'id'         },
  { key: 'guestName',        header: 'Guest Name',   headerAr: 'اسم النزيل',        type: 'text'       },
  { key: 'building',         header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'floor',            header: 'Floor',        headerAr: 'الدور',             type: 'text-short', widthOverride: 16 },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'الغرفة',            type: 'id'         },
  { key: 'roomType',         header: 'Room Type',    headerAr: 'نوع الغرفة',        type: 'text-short' },
  { key: 'checkInDate',      header: 'Check-in',     headerAr: 'تاريخ الوصول',      type: 'date'       },
  { key: 'checkOutDate',     header: 'Check-out',    headerAr: 'تاريخ المغادرة',    type: 'date'       },
  { key: 'nights',           header: 'Nights',       headerAr: 'الليالي',           type: 'number'     },
  { key: 'bookingSource',    header: 'Source',       headerAr: 'مصدر الحجز',        type: 'text-short' },
  { key: 'status',           header: 'Status',       headerAr: 'الحالة',            type: 'status'     },
  { key: 'specialRequests',  header: 'Special Req.', headerAr: 'طلبات خاصة',        type: 'text'       },
];

// 3. DUE OUT & DEPARTURES
// Orientation: LANDSCAPE — operational checkout list
export const DUE_OUT_DEPARTURES_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'guestName',        header: 'Guest Name',   headerAr: 'اسم النزيل',        type: 'text'       },
  { key: 'building',         header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'floor',            header: 'Floor',        headerAr: 'الدور',             type: 'text-short', widthOverride: 16 },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'الغرفة',            type: 'id'         },
  { key: 'checkInDate',      header: 'Checked In',   headerAr: 'تاريخ التسكين',     type: 'date'       },
  { key: 'checkOutDate',     header: 'Due Out',      headerAr: 'المغادرة المستحقة', type: 'date'       },
  { key: 'nightsStayed',     header: 'Nights',       headerAr: 'الليالي المقضاة',   type: 'number'     },
  { key: 'outstandingBal',   header: 'Balance',      headerAr: 'المستحقات',         type: 'currency'   },
  { key: 'departureStatus',  header: 'Status',       headerAr: 'حالة المغادرة',     type: 'status'     },
  { key: 'luggage',          header: 'Luggage',      headerAr: 'الأمتعة',           type: 'boolean'    },
  { key: 'notes',            header: 'Notes',        headerAr: 'ملاحظات',           type: 'text'       },
];

// 4. OCCUPANCY FORECAST
// Orientation: PORTRAIT — date-series table, few columns
export const OCCUPANCY_FORECAST_COLUMNS: ReportColumnDef[] = [
  { key: 'forecastDate',      header: 'Date',         headerAr: 'التاريخ',          type: 'date'       },
  { key: 'dayOfWeek',         header: 'Day',          headerAr: 'اليوم',            type: 'text-short', widthOverride: 20 },
  { key: 'expectedArrivals',  header: 'Arrivals',     headerAr: 'الوصول المتوقع',   type: 'number'     },
  { key: 'expectedDepartures',header: 'Departures',   headerAr: 'المغادرة المتوقعة',type: 'number'     },
  { key: 'netChange',         header: 'Net',          headerAr: 'صافي الحركة',      type: 'number'     },
  { key: 'projectedOccupied', header: 'Projected',    headerAr: 'الأسرة المشغولة',  type: 'number'     },
  { key: 'projectedPct',      header: 'Occ. %',       headerAr: 'نسبة الإشغال',     type: 'percentage' },
  { key: 'remainingRooms',    header: 'Available',    headerAr: 'الأسرة الشاغرة',   type: 'number'     },
];

// ══════════════════════════════════════════════════════════
// GROUP 2 — ROOMS
// ══════════════════════════════════════════════════════════

// 5. IN-HOUSE OCCUPANTS & ROOMS
// Orientation: LANDSCAPE — Building -> Floor -> Room -> Bed
export const IN_HOUSE_OCCUPANTS_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'building',         header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'floor',            header: 'Floor',        headerAr: 'الطابق',            type: 'text-short', widthOverride: 16 },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'رقم الغرفة',        type: 'id'         },
  { key: 'bedNumber',        header: 'Bed',          headerAr: 'السرير',            type: 'id'         },
  { key: 'occupantName',     header: 'Occupant',     headerAr: 'اسم النزيل',        type: 'text'       },
  { key: 'department',       header: 'Department',   headerAr: 'القسم',             type: 'text-short' },
  { key: 'checkInDate',      header: 'Check-in',     headerAr: 'تاريخ التسكين',     type: 'date'       },
  { key: 'daysInHouse',      header: 'Days',         headerAr: 'الأيام بالسكن',     type: 'number'     },
  { key: 'roomType',         header: 'Room Type',    headerAr: 'نوع الغرفة',        type: 'text-short' },
  { key: 'occupancyStatus',  header: 'Status',       headerAr: 'حالة التسكين',      type: 'status'     },
];

// 6. VACANT BEDS & OPERATIONAL CAPACITY
// Orientation: LANDSCAPE — Building -> Floor -> Room
export const VACANT_BEDS_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'building',         header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'floor',            header: 'Floor',        headerAr: 'الطابق',            type: 'text-short', widthOverride: 16 },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'رقم الغرفة',        type: 'id'         },
  { key: 'totalBeds',        header: 'Total Beds',   headerAr: 'إجمالي الأسرة',     type: 'number'     },
  { key: 'occupiedBeds',     header: 'Occupied',     headerAr: 'الأسرة المشغولة',   type: 'number'     },
  { key: 'vacantBeds',       header: 'Vacant',       headerAr: 'الأسرة الشاغرة',    type: 'number'     },
  { key: 'capacityPct',      header: 'Cap. %',       headerAr: 'نسبة الإشغال',      type: 'percentage' },
  { key: 'roomStatus',       header: 'Status',       headerAr: 'حالة الغرفة',       type: 'status'     },
];

// 7. COMPLETE ROOM INVENTORY
// Orientation: LANDSCAPE — Building -> Floor -> Room
export const ROOM_INVENTORY_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'building',         header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'floor',            header: 'Floor',        headerAr: 'الطابق',            type: 'text-short', widthOverride: 16 },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'رقم الغرفة',        type: 'id'         },
  { key: 'roomType',         header: 'Type',         headerAr: 'نوع الغرفة',        type: 'text-short' },
  { key: 'capacity',         header: 'Cap.',         headerAr: 'السعة',             type: 'number'     },
  { key: 'currentOccupants', header: 'Occupants',    headerAr: 'المقيمين الحاليين', type: 'number'     },
  { key: 'status',           header: 'Status',       headerAr: 'الحالة',            type: 'status'     },
  { key: 'lastMaintenance',  header: 'Last Maint.',  headerAr: 'آخر صيانة',         type: 'date'       },
  { key: 'features',         header: 'Features',     headerAr: 'المزايا والملحقات',  type: 'text'       },
];

// 8. HOUSEKEEPING & CLEANLINESS
// Orientation: LANDSCAPE — Building -> Floor -> Room
export const HOUSEKEEPING_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'building',         header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'floor',            header: 'Floor',        headerAr: 'الطابق',            type: 'text-short', widthOverride: 16 },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'رقم الغرفة',        type: 'id'         },
  { key: 'roomType',         header: 'Type',         headerAr: 'نوع الغرفة',        type: 'text-short' },
  { key: 'housekeeper',      header: 'Assigned To',  headerAr: 'المشرف المعين',     type: 'text'       },
  { key: 'lastCleaned',      header: 'Last Cleaned', headerAr: 'آخر نظافة',         type: 'datetime'   },
  { key: 'cleaningStatus',   header: 'Clean Status', headerAr: 'حالة النظافة',      type: 'status'     },
  { key: 'roomCondition',    header: 'Condition',    headerAr: 'حالة الغرفة',       type: 'status'     },
  { key: 'notes',            header: 'Notes',        headerAr: 'ملاحظات',           type: 'text'       },
];

// 9. ROOM DISCREPANCY & AUDIT
// Orientation: LANDSCAPE — Building -> Floor -> Room
export const ROOM_DISCREPANCY_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'building',         header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'floor',            header: 'Floor',        headerAr: 'الطابق',            type: 'text-short', widthOverride: 16 },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'رقم الغرفة',        type: 'id'         },
  { key: 'systemStatus',     header: 'System',       headerAr: 'حالة السيستم',      type: 'status'     },
  { key: 'physicalStatus',   header: 'Physical',     headerAr: 'الحالة الفعلية',    type: 'status'     },
  { key: 'discrepancyType',  header: 'Discrepancy',  headerAr: 'نوع التباين',       type: 'text-short' },
  { key: 'reportedBy',       header: 'Reported By',  headerAr: 'مقدم البلاغ',       type: 'text-short' },
  { key: 'reportedAt',       header: 'Reported At',  headerAr: 'تاريخ الإبلاغ',     type: 'datetime'   },
  { key: 'isResolved',       header: 'Resolved',     headerAr: 'تمت المعالجة',      type: 'boolean'    },
  { key: 'resolvedAt',       header: 'Resolved At',  headerAr: 'تاريخ المعالجة',    type: 'date'       },
  { key: 'notes',            header: 'Notes',        headerAr: 'ملاحظات',           type: 'text'       },
];

// ══════════════════════════════════════════════════════════
// GROUP 3 — STAFF
// ══════════════════════════════════════════════════════════

// 10. PROFILES DIRECTORY
// Orientation: LANDSCAPE — master staff list
export const PROFILES_DIRECTORY_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'staffId',          header: 'Staff ID',     headerAr: 'كود الموظف',        type: 'id'         },
  { key: 'fullName',         header: 'Full Name',    headerAr: 'الاسم بالكامل',     type: 'text'       },
  { key: 'nationality',      header: 'Nationality',  headerAr: 'الجنسية',           type: 'text-short' },
  { key: 'department',       header: 'Department',   headerAr: 'القسم',             type: 'text-short' },
  { key: 'position',         header: 'Position',     headerAr: 'المسمى الوظيفي',    type: 'text-short' },
  { key: 'phone',            header: 'Phone',        headerAr: 'الهاتف',            type: 'phone'      },
  { key: 'joinDate',         header: 'Join Date',    headerAr: 'تاريخ التعيين',     type: 'date'       },
  { key: 'status',           header: 'Status',       headerAr: 'الحالة',            type: 'status'     },
];

// 11. CONTRACT EXPIRATIONS
// Orientation: LANDSCAPE — upcoming contract renewals
// IMPORTANT: color-code daysRemaining column:
//   < 30 days → red cell  |  30–90 days → amber  |  > 90 days → green
export const CONTRACT_EXPIRATIONS_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'staffId',          header: 'Staff ID',     headerAr: 'كود الموظف',        type: 'id'         },
  { key: 'fullName',         header: 'Full Name',    headerAr: 'الاسم بالكامل',     type: 'text'       },
  { key: 'department',       header: 'Department',   headerAr: 'القسم',             type: 'text-short' },
  { key: 'contractType',     header: 'Contract',     headerAr: 'نوع العقد',         type: 'text-short' },
  { key: 'startDate',        header: 'Start',        headerAr: 'بداية العقد',       type: 'date'       },
  { key: 'endDate',          header: 'Expires',      headerAr: 'انتهاء العقد',      type: 'date'       },
  { key: 'daysRemaining',    header: 'Days Left',    headerAr: 'الأيام المتبقية',   type: 'number',
    format: (v) => (v !== null && v !== undefined && v !== '') ? String(v) : 'Expired'
  },
  { key: 'renewalStatus',    header: 'Status',       headerAr: 'حالة التجديد',      type: 'status'     },
];

// 12. STAFF VACATIONS & HISTORICAL ARCHIVE
// Orientation: LANDSCAPE — leave management
export const STAFF_VACATIONS_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'staffId',          header: 'Staff ID',     headerAr: 'كود الموظف',        type: 'id'         },
  { key: 'fullName',         header: 'Full Name',    headerAr: 'الاسم بالكامل',     type: 'text'       },
  { key: 'department',       header: 'Department',   headerAr: 'القسم',             type: 'text-short' },
  { key: 'buildingName',     header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'floorName',        header: 'Floor',        headerAr: 'الدور',             type: 'text-short', widthOverride: 16 },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'الغرفة',            type: 'id'         },
  { key: 'bedNumber',        header: 'Bed',          headerAr: 'السرير',            type: 'id'         },
  { key: 'vacationType',     header: 'Leave Type',   headerAr: 'نوع الإجازة',       type: 'text-short' },
  { key: 'startDate',        header: 'From',         headerAr: 'تاريخ البدء',       type: 'date'       },
  { key: 'endDate',          header: 'To',           headerAr: 'العودة المتوقعة',   type: 'date'       },
  { key: 'totalDays',        header: 'Days',         headerAr: 'المدة (أيام)',      type: 'number'     },
  { key: 'approvedBy',       header: 'Approved By',  headerAr: 'تمت الموافقة من',   type: 'text-short' },
  { key: 'status',           header: 'Status',       headerAr: 'حالة الإجازة',      type: 'status'     },
];

// 13. DEPARTMENT OCCUPANCY
// Orientation: PORTRAIT — summary by department, few columns
export const DEPARTMENT_OCCUPANCY_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'department',       header: 'Department',   headerAr: 'القسم',             type: 'text'       },
  { key: 'totalStaff',       header: 'Total Staff',  headerAr: 'إجمالي الموظفين',   type: 'number'     },
  { key: 'inHouse',          header: 'In-House',     headerAr: 'المقيمين بالسكن',   type: 'number'     },
  { key: 'assignedRooms',    header: 'Rooms Used',   headerAr: 'الغرف المشغولة',    type: 'number'     },
  { key: 'occupancyPct',     header: 'Occupancy %',  headerAr: 'نسبة الإشغال',      type: 'percentage' },
  { key: 'onLeave',          header: 'On Leave',     headerAr: 'في إجازة',          type: 'number'     },
  { key: 'available',        header: 'Available',    headerAr: 'المتاح',            type: 'number'     },
  { key: 'status',           header: 'Status',       headerAr: 'الحالة',            type: 'status'     },
];

// 14. DAILY MOVEMENT
// Orientation: LANDSCAPE — all check-ins, check-outs, transfers
export const DAILY_MOVEMENT_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'staffId',          header: 'Staff ID',     headerAr: 'كود الموظف',        type: 'id'         },
  { key: 'fullName',         header: 'Name',         headerAr: 'الاسم',             type: 'text'       },
  { key: 'building',         header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'movementType',     header: 'Action',       headerAr: 'نوع الحركة',        type: 'status'     },
  { key: 'fromRoom',         header: 'From Room',    headerAr: 'من غرفة',           type: 'id'         },
  { key: 'toRoom',           header: 'To Room',      headerAr: 'إلى غرفة',          type: 'id'         },
  { key: 'movedAt',          header: 'Date & Time',  headerAr: 'التاريخ والوقت',    type: 'datetime'   },
  { key: 'performedBy',      header: 'Done By',      headerAr: 'تم بواسطة',         type: 'text-short' },
  { key: 'notes',            header: 'Notes',        headerAr: 'ملاحظات',           type: 'text'       },
];

// ══════════════════════════════════════════════════════════
// GROUP 4 — SECURITY & COMPLIANCE
// ══════════════════════════════════════════════════════════

// 15. GATE SECURITY LOGS
// Orientation: LANDSCAPE — entry/exit records
export const GATE_SECURITY_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'logId',            header: 'Log ID',       headerAr: 'رقم السجل',         type: 'id'         },
  { key: 'timestamp',        header: 'Date & Time',  headerAr: 'التاريخ والوقت',    type: 'datetime'   },
  { key: 'personName',       header: 'Person',       headerAr: 'الاسم',             type: 'text'       },
  { key: 'idNumber',         header: 'ID / Passport',headerAr: 'الهوية / الجواز',   type: 'id'         },
  { key: 'direction',        header: 'In / Out',     headerAr: 'دخول / خروج',       type: 'status'     },
  { key: 'gateNumber',       header: 'Gate',         headerAr: 'البوابة',           type: 'text-short', widthOverride: 18 },
  { key: 'purpose',          header: 'Purpose',      headerAr: 'الغرض',             type: 'text-short' },
  { key: 'authorizedBy',     header: 'Authorized By',headerAr: 'المصرح',            type: 'text-short' },
  { key: 'vehiclePlate',     header: 'Plate No.',    headerAr: 'رقم المركبة',       type: 'id'         },
];

// 16. TOURISM POLICE MANIFEST
// ⚠ OFFICIAL GOVERNMENT DOCUMENT — Egyptian Tourism Police format
// Orientation: PORTRAIT — matches standard A4 form layout
// DO NOT change column order — this matches the official paper form sequence
// Print header must include: Property name, license number, date, report period
export const TOURISM_POLICE_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: 'م',            headerAr: 'م',                 type: 'index'      },
  { key: 'fullNameAr',       header: 'الاسم',        headerAr: 'الاسم بالعربية',    type: 'text'       },
  { key: 'fullNameEn',       header: 'Name',         headerAr: 'الاسم بالإنجليزية', type: 'text'       },
  { key: 'nationality',      header: 'Nationality',  headerAr: 'الجنسية',           type: 'text-short' },
  { key: 'passportNumber',   header: 'Passport No.', headerAr: 'الرقم القومي / جواز',type: 'id'        },
  { key: 'dateOfBirth',      header: 'Date of Birth',headerAr: 'تاريخ الميلاد',     type: 'date'       },
  { key: 'checkInDate',      header: 'Arrival',      headerAr: 'تاريخ التسكين',     type: 'date'       },
  { key: 'checkOutDate',     header: 'Departure',    headerAr: 'تاريخ المغادرة',    type: 'date'       },
  { key: 'buildingName',     header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'floorName',        header: 'Floor',        headerAr: 'الدور',             type: 'text-short', widthOverride: 16 },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'الغرفة',            type: 'id'         },
  { key: 'purpose',          header: 'Purpose',      headerAr: 'جهة العمل / الغرض', type: 'text-short' },
];

// 17. POLICY EXCEPTIONS & LEVEL AUDIT
// Orientation: LANDSCAPE — compliance violations and approvals
export const POLICY_EXCEPTIONS_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'profileName',      header: 'Resident Name',headerAr: 'اسم المقيم',        type: 'text'       },
  { key: 'profileCode',      header: 'Employee Code',headerAr: 'كود الموظف',        type: 'id'         },
  { key: 'nationalId',       header: 'National ID',  headerAr: 'الرقم القومي',      type: 'id'         },
  { key: 'jobLevel',         header: 'Job Level',    headerAr: 'الدرجة الوظيفية',   type: 'text-short' },
  { key: 'department',       header: 'Department',   headerAr: 'القسم',             type: 'text-short' },
  { key: 'buildingName',     header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'الغرفة',            type: 'id'         },
  { key: 'roomCapacity',     header: 'Capacity',     headerAr: 'سعة الغرفة',        type: 'number'     },
  { key: 'currentOccupancy', header: 'Occupancy',    headerAr: 'الإشغال الحالي',    type: 'number'     },
  { key: 'violationType',    header: 'Violation Type', headerAr: 'نوع المخالفة',    type: 'text-short' },
  { key: 'violationDetails', header: 'Policy Details', headerAr: 'تفاصيل المخالفة', type: 'text'       },
  { key: 'requestDate',      header: 'Exception Date', headerAr: 'تاريخ الاستثناء', type: 'date'       },
  { key: 'severity',         header: 'Severity',     headerAr: 'مستوى الأهمية',     type: 'status'     },
  { key: 'approvalStatus',   header: 'Status',       headerAr: 'حالة الاعتماد',     type: 'status'     },
  { key: 'approvedBy',       header: 'Approved By',  headerAr: 'المعتمد للطلب',     type: 'text-short' },
  { key: 'overrideReason',   header: 'Override Reason', headerAr: 'سبب الاستثناء',  type: 'text'       },
];

// ══════════════════════════════════════════════════════════
// GROUP 5 — FACILITIES
// ══════════════════════════════════════════════════════════

// 18. MAINTENANCE
// Orientation: LANDSCAPE — open and resolved issues with ratings and reporter
export const MAINTENANCE_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'buildingName',     header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'floorName',        header: 'Floor',        headerAr: 'الدور',             type: 'text-short', widthOverride: 16 },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'الغرفة',            type: 'id'         },
  { key: 'reportedBy',       header: 'Reported By',  headerAr: 'مقدم البلاغ',       type: 'text'       },
  { key: 'category',         header: 'Category',     headerAr: 'الفئة',             type: 'text-short' },
  { key: 'problemType',      header: 'Issue Details',headerAr: 'نوع ووصف المشكلة',  type: 'text'       },
  { key: 'priority',         header: 'Priority',     headerAr: 'الأولوية',          type: 'status'     },
  { key: 'assignedTo',       header: 'Assigned To',  headerAr: 'الفني المعين',      type: 'text-short' },
  { key: 'reportedAt',       header: 'Reported Date',headerAr: 'تاريخ البلاغ',      type: 'date'       },
  { key: 'rating',           header: 'Rating',       headerAr: 'التقييم',           type: 'text-short',
    format: (v) => (v ? (String(v).includes('★') ? String(v) : `${v}/5 ★`) : '—')
  },
  { key: 'status',           header: 'Status',       headerAr: 'الحالة',            type: 'status'     },
];


// 19. AMENITIES & EQUIPMENT INVENTORY
// Orientation: LANDSCAPE — asset register
export const AMENITIES_INVENTORY_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'itemName',         header: 'Item',         headerAr: 'اسم الصنف / العهدة',type: 'text'       },
  { key: 'category',         header: 'Category',     headerAr: 'التصنيف',           type: 'text-short' },
  { key: 'location',         header: 'Location',     headerAr: 'الموقع',            type: 'text-short' },
  { key: 'quantity',         header: 'Qty',          headerAr: 'الكمية',            type: 'number'     },
  { key: 'unitValue',        header: 'Unit Value',   headerAr: 'القيمة التقديرية',  type: 'currency'   },
  { key: 'condition',        header: 'Condition',    headerAr: 'الحالة الفنية',     type: 'status'     },
  { key: 'lastInspection',   header: 'Inspected',    headerAr: 'آخر فحص',           type: 'date'       },
  { key: 'status',           header: 'Status',       headerAr: 'الحالة',            type: 'status'     },
  { key: 'notes',            header: 'Notes',        headerAr: 'ملاحظات',           type: 'text'       },
];

// 20. WATER DISTRIBUTION SHEET
// Orientation: LANDSCAPE — utility consumption tracking
export const WATER_DISTRIBUTION_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'buildingName',     header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'floorName',        header: 'Floor',        headerAr: 'الدور',             type: 'text-short', widthOverride: 16 },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'الغرفة',            type: 'id'         },
  { key: 'locationUnit',     header: 'Location',     headerAr: 'الموقع / الغرفة',   type: 'text'       },
  { key: 'meterNumber',      header: 'Meter No.',    headerAr: 'رقم العداد / الوحدة',type: 'id'        },
  { key: 'prevReading',      header: 'Prev. Read.',  headerAr: 'القراءة السابقة',   type: 'number'     },
  { key: 'currReading',      header: 'Curr. Read.',  headerAr: 'القراءة الحالية',   type: 'number'     },
  { key: 'consumption',      header: 'Consumed (m³)',headerAr: 'الاستهلاك (م³)',    type: 'number'     },
  { key: 'unitPrice',        header: 'Unit Price',   headerAr: 'سعر الوحدة',        type: 'currency'   },
  { key: 'totalCost',        header: 'Total',        headerAr: 'إجمالي التكلفة',    type: 'currency'   },
  { key: 'readingDate',      header: 'Date',         headerAr: 'تاريخ القراءة',     type: 'date'       },
  { key: 'notes',            header: 'Notes',        headerAr: 'ملاحظات',           type: 'text'       },
];

// ══════════════════════════════════════════════════════════
// GROUP 6 — SERVICES
// ══════════════════════════════════════════════════════════

// 21. SERVICE QUALITY & RATINGS
// Orientation: PORTRAIT — summary ratings by department
export const SERVICE_QUALITY_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'department',       header: 'Department',   headerAr: 'القسم',             type: 'text'       },
  { key: 'totalRatings',     header: 'Responses',    headerAr: 'عدد التقييمات',     type: 'number'     },
  { key: 'avgRating',        header: 'Avg. Rating',  headerAr: 'متوسط التقييم',     type: 'number',
    format: (v) => Number(v || 0).toFixed(2)
  },
  { key: 'excellent',        header: '⭐⭐⭐⭐⭐ Exc.', headerAr: 'ممتاز',             type: 'number'     },
  { key: 'good',             header: '⭐⭐⭐⭐ Good',  headerAr: 'جيد جداً',          type: 'number'     },
  { key: 'fair',             header: '⭐⭐⭐ Fair',   headerAr: 'مقبول',             type: 'number'     },
  { key: 'poor',             header: '⭐⭐ Poor',    headerAr: 'ضعيف',              type: 'number'     },
  { key: 'satisfactionPct',  header: 'Satisfaction', headerAr: 'نسبة الرضا',        type: 'percentage' },
  { key: 'trend',            header: 'Trend',        headerAr: 'المسار',            type: 'text-short', widthOverride: 22,
    format: (v) => v === 'up' ? '▲ Up' : v === 'down' ? '▼ Down' : '— Flat'
  },
];

// 22. GUEST HOSTINGS
// Orientation: LANDSCAPE — visitor and guest hosting log
export const GUEST_HOSTINGS_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'hostingId',        header: 'Hosting ID',   headerAr: 'رقم الاستضافة',     type: 'id'         },
  { key: 'hostName',         header: 'Host',         headerAr: 'الموظف المضيف',     type: 'text'       },
  { key: 'guestName',        header: 'Guest',        headerAr: 'اسم الضيف',         type: 'text'       },
  { key: 'building',         header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'floor',            header: 'Floor',        headerAr: 'الدور',             type: 'text-short', widthOverride: 16 },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'الغرفة',            type: 'id'         },
  { key: 'checkInDate',      header: 'From',         headerAr: 'تاريخ الدخول',      type: 'date'       },
  { key: 'checkOutDate',     header: 'To',           headerAr: 'تاريخ الخروج',      type: 'date'       },
  { key: 'relationship',     header: 'Relationship', headerAr: 'صلة القرابة',       type: 'text-short' },
  { key: 'approvedBy',       header: 'Approved By',  headerAr: 'المعتمد',           type: 'text-short' },
  { key: 'status',           header: 'Status',       headerAr: 'الحالة',            type: 'status'     },
];

// 23. HOUSING MAP & STRUCTURE
// 23. HOUSING MAP & STRUCTURE
// ⚠ HYBRID EXPORT — visual map + tabular inventory with resident bed allocations
// Orientation: LANDSCAPE for the table section
// Use html2canvas to capture the visual map, then append this table below it in PDF
export const HOUSING_MAP_COLUMNS: ReportColumnDef[] = [
  { key: 'index',            header: '#',            headerAr: '#',                 type: 'index'      },
  { key: 'building',         header: 'Building',     headerAr: 'المبنى',            type: 'text-short' },
  { key: 'floor',            header: 'Floor',        headerAr: 'الطابق',            type: 'text-short', widthOverride: 16 },
  { key: 'roomNumber',       header: 'Room',         headerAr: 'رقم الغرفة',        type: 'id'         },
  { key: 'roomType',         header: 'Type',         headerAr: 'نوع الغرفة',        type: 'text-short' },
  { key: 'totalCapacity',    header: 'Capacity',     headerAr: 'سعة الأسرة',        type: 'number'     },
  { key: 'currentOccupants', header: 'Occupied',     headerAr: 'المشغول',           type: 'number'     },
  { key: 'vacantBeds',       header: 'Vacant',       headerAr: 'الشاغر',            type: 'number'     },
  { key: 'status',           header: 'Status',       headerAr: 'حالة الإشغال',      type: 'status'     },
  { key: 'occupantsSummary', header: 'Residents & Beds', headerAr: 'المقيمين والنزلاء بالأسرة', type: 'text' },
];

// 24. HOUSING RATINGS & QUALITY PULSE
export const HOUSING_RATINGS_COLUMNS: ReportColumnDef[] = [
  { key: 'index',        header: '#',           headerAr: '#',                       type: 'index'      },
  { key: 'propertyName', header: 'Property',    headerAr: 'السكن / الفندق',           type: 'text-short' },
  { key: 'rating',       header: 'Rating',      headerAr: 'التقييم',                 type: 'status'     },
  { key: 'score',        header: 'Score (1-5)', headerAr: 'الدرجة',                  type: 'number'     },
  { key: 'comment',      header: 'Comment',     headerAr: 'الملاحظة / المقترح المكتوب', type: 'text'       },
  { key: 'createdAt',    header: 'Date',        headerAr: 'تاريخ التقييم',           type: 'date'       },
];

// 25. ROOM MOVES & BED TRANSFERS
export const ROOM_MOVES_COLUMNS: ReportColumnDef[] = [
  { key: 'index',        header: '#',           headerAr: '#',                       type: 'index'      },
  { key: 'residentName', header: 'Resident',    headerAr: 'اسم الموظف',               type: 'text'       },
  { key: 'employeeId',   header: 'Staff ID',    headerAr: 'كود الموظف',              type: 'id'         },
  { key: 'department',   header: 'Department',  headerAr: 'القسم',                   type: 'text-short' },
  { key: 'oldRoom',      header: 'Old Room',    headerAr: 'الغرفة السابقة',          type: 'text-short' },
  { key: 'newRoom',      header: 'New Room',    headerAr: 'الغرفة الجديدة',          type: 'text-short' },
  { key: 'reason',       header: 'Reason',      headerAr: 'سبب النقل',               type: 'text-short' },
  { key: 'actionBy',     header: 'Action By',   headerAr: 'المنفذ',                  type: 'text-short' },
  { key: 'date',         header: 'Date & Time', headerAr: 'تاريخ ووقت النقل',        type: 'date'       },
];

// 26. CONFIGURATION REPORT
export const CONFIGURATION_COLUMNS: ReportColumnDef[] = [
  { key: 'index',        header: '#',           headerAr: '#',                       type: 'index'      },
  { key: 'settingGroup', header: 'Group',       headerAr: 'المجموعة / التصنيف',      type: 'text-short' },
  { key: 'key',          header: 'Setting Key', headerAr: 'المفتاح الإداري',         type: 'id'         },
  { key: 'value',        header: 'Value',       headerAr: 'القيمة الحالية',          type: 'text'       },
  { key: 'description',  header: 'Description', headerAr: 'الوصف والاستخدام',        type: 'text'       },
  { key: 'updatedAt',    header: 'Updated At',  headerAr: 'آخر تعديل',               type: 'date'       },
];


// ══════════════════════════════════════════════════════════
// SPECIAL HANDLING — 3 reports need extra care
// ══════════════════════════════════════════════════════════

// ── SPECIAL 1: ANALYTICS TAB ──
// This tab has KPI cards and charts — NOT a simple table.
// Export strategy: html2canvas the KPI section as image, then
// append any tabular data using autoTable below it.

export async function exportAnalyticsPDF(meta: ReportMeta): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 15;

  // 1. Capture KPI section as image
  const kpiEl = document.getElementById('analytics-kpi-section');
  if (kpiEl) {
    const canvas = await html2canvas(kpiEl, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const imgW = doc.internal.pageSize.getWidth() - margin * 2;
    const imgH = (canvas.height / canvas.width) * imgW;
    doc.addImage(imgData, 'PNG', margin, 20, imgW, imgH);
  }

  // 2. Capture chart section below it
  const chartEl = document.getElementById('analytics-charts-section');
  if (chartEl) {
    doc.addPage();
    const canvas = await html2canvas(chartEl, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const imgW = doc.internal.pageSize.getWidth() - margin * 2;
    const imgH = (canvas.height / canvas.width) * imgW;
    doc.addImage(imgData, 'PNG', margin, 20, imgW, imgH);
  }

  doc.save(`${meta.title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── SPECIAL 2: TOURISM POLICE MANIFEST ──
// Official Egyptian government document — strict format required.
// Must include: property name, license no., report date, reporting officer signature line.

export function generateTourismPolicePDF(
  data: Record<string, unknown>[],
  property: { name: string; licenseNumber: string; address: string },
  reportPeriod: { from: string; to: string }
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 15;
  let y = margin;

  // Official header block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TOURISM POLICE GUEST MANIFEST', 105, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y += 7;
  doc.text(`Property: ${property.name}`, margin, y);
  doc.text(`License No.: ${property.licenseNumber}`, 105, y, { align: 'center' });
  doc.text(`Period: ${reportPeriod.from} → ${reportPeriod.to}`, 195, y, { align: 'right' });
  y += 5;
  doc.text(property.address, margin, y);
  y += 5;
  doc.setLineWidth(0.5);
  doc.line(margin, y, 195, y);
  y += 5;

  // Table with official column order (matches paper form)
  autoTable(doc, {
    head: [['م', 'الاسم', 'Name', 'Nationality', 'Passport', 'DOB', 'Arrival', 'Departure', 'Room', 'Purpose']],
    body: data.map((row, i) => [
      String(i + 1),
      String(row.fullNameAr ?? ''),
      String(row.fullNameEn ?? ''),
      String(row.nationality ?? ''),
      String(row.passportNumber ?? ''),
      row.dateOfBirth ? new Date(row.dateOfBirth as string).toLocaleDateString('en-GB') : '',
      row.checkInDate  ? new Date(row.checkInDate  as string).toLocaleDateString('en-GB') : '',
      row.checkOutDate ? new Date(row.checkOutDate as string).toLocaleDateString('en-GB') : '',
      String(row.roomNumber ?? ''),
      String(row.purpose ?? ''),
    ]),
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center'  },  // م
      1: { cellWidth: 28, halign: 'right'   },  // Arabic name (RTL)
      2: { cellWidth: 28, halign: 'left'    },  // English name
      3: { cellWidth: 18, halign: 'center'  },  // Nationality
      4: { cellWidth: 20, halign: 'center'  },  // Passport
      5: { cellWidth: 18, halign: 'center'  },  // DOB
      6: { cellWidth: 18, halign: 'center'  },  // Arrival
      7: { cellWidth: 18, halign: 'center'  },  // Departure
      8: { cellWidth: 12, halign: 'center'  },  // Room
      9: { cellWidth: 'auto', halign: 'left' }, // Purpose
    },
    showHead: 'everyPage',
    // Signature lines at end
    didDrawPage: (pageData) => {
      const pageH = doc.internal.pageSize.getHeight();
      if (pageData.pageNumber === doc.getNumberOfPages()) {
        doc.setFontSize(8);
        doc.text('Reporting Officer: ___________________', margin, pageH - 18);
        doc.text('Signature: ___________________', margin, pageH - 12);
        doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 195, pageH - 12, { align: 'right' });
      }
    }
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`tourism-police-manifest-${dateStr}.pdf`);
}

// ── SPECIAL 3: HOUSING MAP & STRUCTURE ──
// Has a visual building map — use hybrid approach.

// ── SPECIAL 3: HOUSING MAP & STRUCTURE ──
// Has a visual building map — use hybrid approach.

export async function exportHousingMapPDF(
  mapData: Record<string, unknown>[],
  meta: ReportMeta & { language?: 'ar' | 'en' }
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 15;
  const isAr = meta?.language === 'ar';

  let hasPage1 = false;
  // Page 1: Visual map captured via html2canvas
  const mapEl = document.getElementById('housing-map-visual');
  if (mapEl) {
    try {
      const canvas = await html2canvas(mapEl, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const usableW = doc.internal.pageSize.getWidth() - margin * 2;
      const imgH = Math.min((canvas.height / canvas.width) * usableW, 170);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(isAr ? 'خريطة وتفصيل السكن والمباني المعمارية' : 'Housing Map & Architectural Structure', margin, 14);
      doc.addImage(imgData, 'PNG', margin, 20, usableW, imgH);
      hasPage1 = true;
    } catch {
      hasPage1 = false;
    }
  }

  // Tabular detailed room & occupants page
  if (hasPage1) {
    doc.addPage();
  }

  const headRow = HOUSING_MAP_COLUMNS.map(c => (isAr && c.headerAr ? c.headerAr : c.header));
  const bodyRows = mapData.map((row, rIdx) =>
    HOUSING_MAP_COLUMNS.map(col => {
      if (col.type === 'index') return String(rIdx + 1);
      let val = row[col.key];
      if (val === undefined && col.key === 'occupantsSummary') {
        val = row.residentsSummary;
        if (!val && Array.isArray(row.residents)) {
          val = (row.residents as any[])
            .map((res: any, idx: number) => {
              const bedNum = res.bedNumber || idx + 1;
              const name = res.name || res.fullName || (isAr ? 'مقيم' : 'Resident');
              const code = res.employeeNumber || res.profileCode ? ` [${res.employeeNumber || res.profileCode}]` : '';
              return `${name}${code} (${isAr ? 'سرير' : 'Bed'} #${bedNum})`;
            })
            .join(' | ');
        }
      }
      return formatValue(val ?? '—', col.type);
    })
  );

  autoTable(doc, {
    head: [headRow],
    body: bodyRows,
    startY: 20,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
    columnStyles: {
      9: { cellWidth: 70 }, // occupants column wider for readability
    },
  });

  doc.save(`housing-map-${new Date().toISOString().slice(0, 10)}.pdf`);
}


// ══════════════════════════════════════════════════════════
// CELL COLOR OVERRIDES — Hook helper for jsPDF-AutoTable
// ══════════════════════════════════════════════════════════

export function applyReportCellStyles(cellData: any, activeTab?: string): void {
  if (cellData.section !== 'body') return;

  // 1. Contract Expirations: color "Days Left" column
  if (activeTab === 'expiring_contracts' || cellData.column.dataKey === 'daysRemaining') {
    const days = Number(cellData.cell.raw);
    if (isNaN(days) || days < 0) {
      cellData.cell.styles.textColor = [220, 38, 38];   // red — expired
      cellData.cell.styles.fontStyle = 'bold';
    } else if (days < 30) {
      cellData.cell.styles.fillColor = [254, 226, 226]; // red-100
      cellData.cell.styles.textColor = [185, 28,  28];  // red-700
      cellData.cell.styles.fontStyle = 'bold';
    } else if (days < 90) {
      cellData.cell.styles.fillColor = [254, 243, 199]; // amber-100
      cellData.cell.styles.textColor = [146, 64,  14];  // amber-800
    } else {
      cellData.cell.styles.textColor = [21,  128, 61 ]; // green-700
    }
  }

  // 2. Maintenance & Policy: color "Priority" / "Risk Level" column
  if (activeTab === 'maintenance' || activeTab === 'policy_exceptions') {
    const val = String(cellData.cell.raw ?? '').toLowerCase();
    const COLOR_MAP: Record<string, [[number, number, number], [number, number, number]]> = {
      critical: [[254, 226, 226], [185, 28, 28]],
      high:     [[254, 226, 226], [185, 28, 28]],
      urgent:   [[254, 226, 226], [185, 28, 28]],
      medium:   [[254, 243, 199], [146, 64, 14]],
      normal:   [[240, 253, 244], [21, 128, 61]],
      low:      [[240, 253, 244], [21, 128, 61]],
    };
    const entry = COLOR_MAP[val];
    if (entry) {
      cellData.cell.styles.fillColor = entry[0];
      cellData.cell.styles.textColor = entry[1];
      cellData.cell.styles.fontStyle = val === 'critical' || val === 'urgent' ? 'bold' : 'normal';
    }
  }

  // 3. Service Quality: color avg rating column
  if (activeTab === 'service_ratings') {
    const rating = Number(cellData.cell.raw);
    if (!isNaN(rating)) {
      if (rating >= 4.5)      cellData.cell.styles.textColor = [21, 128, 61];  // green
      else if (rating >= 3.5) cellData.cell.styles.textColor = [146, 64, 14];  // amber
      else                    cellData.cell.styles.textColor = [185, 28, 28];  // red
      cellData.cell.styles.fontStyle = 'bold';
    }
  }
}

// ════════════════════════════════════════════════════════════
// Tab → Column Definition lookup (used by ReportsPage)
// ════════════════════════════════════════════════════════════

export const SMART_REPORT_TABS: Record<Tab, {
  columns: ReportColumnDef[];
  title: string;
  titleAr: string;
}> = {
  manager_flash: {
    columns: MORNING_OPERATIONS_COLUMNS,
    title: 'Morning Operations Report',
    titleAr: 'التقرير الصباحي الشامل',
  },
  arrivals_manifest: {
    columns: RESERVATIONS_ARRIVALS_COLUMNS,
    title: 'Reservations & Arrivals',
    titleAr: 'الحجوزات والمتوقع وصولهم',
  },
  departures_manifest: {
    columns: DUE_OUT_DEPARTURES_COLUMNS,
    title: 'Due Out & Departures',
    titleAr: 'كشف المغادرات والتصفيات',
  },
  housekeeping_sheet: {
    columns: HOUSEKEEPING_COLUMNS,
    title: 'Housekeeping Daily Task Sheet',
    titleAr: 'كشف مهام ونظافة الغرف',
  },
  room_discrepancy: {
    columns: ROOM_DISCREPANCY_COLUMNS,
    title: 'Room Discrepancy & Audit',
    titleAr: 'تدقيق ومطابقة الغرف',
  },
  occupancy_forecast: {
    columns: OCCUPANCY_FORECAST_COLUMNS,
    title: 'Occupancy Forecast',
    titleAr: 'توقعات الإشغال المستقبلية',
  },
  analytics: {
    columns: MORNING_OPERATIONS_COLUMNS,
    title: 'Analytics Overview',
    titleAr: 'تحليلات عامة',
  },
  assignments: {
    columns: IN_HOUSE_OCCUPANTS_COLUMNS,
    title: 'In-House Occupants & Rooms',
    titleAr: 'المقيمين والتسكين (بالغرف والنزلاء)',
  },
  vacant_rooms: {
    columns: VACANT_BEDS_COLUMNS,
    title: 'Vacant Beds & Operational Capacity',
    titleAr: 'مصفوفة السعة والأسرة الشاغرة',
  },
  housing: {
    columns: ROOM_INVENTORY_COLUMNS,
    title: 'Complete Room Inventory',
    titleAr: 'سجل وحالة كافة الغرف',
  },
  profiles: {
    columns: PROFILES_DIRECTORY_COLUMNS,
    title: 'Profiles Directory',
    titleAr: 'دليل البروفايلات',
  },
  expiring_contracts: {
    columns: CONTRACT_EXPIRATIONS_COLUMNS,
    title: 'Contract Expirations',
    titleAr: 'انتهاء العقود',
  },
  reservations: {
    columns: RESERVATIONS_ARRIVALS_COLUMNS,
    title: 'Reservations & Booking Manifest',
    titleAr: 'سجل الحجوزات والتسكين المستقبلي',
  },
  hostings: {
    columns: GUEST_HOSTINGS_COLUMNS,
    title: 'Guest Hostings',
    titleAr: 'الاستضافات والزوار',
  },
  maintenance: {
    columns: MAINTENANCE_COLUMNS,
    title: 'Maintenance Work Orders',
    titleAr: 'طلبات الصيانة',
  },
  housekeeping: {
    columns: HOUSEKEEPING_COLUMNS,
    title: 'Housekeeping & Cleanliness',
    titleAr: 'سجل جاهزية ونظافة الغرف',
  },
  equipment_inventory: {
    columns: AMENITIES_INVENTORY_COLUMNS,
    title: 'Amenities & Equipment Inventory',
    titleAr: 'جرد المحتويات والمعدات',
  },
  daily_movement: {
    columns: DAILY_MOVEMENT_COLUMNS,
    title: 'Daily Movement',
    titleAr: 'الحركة اليومية',
  },
  department_occupancy: {
    columns: DEPARTMENT_OCCUPANCY_COLUMNS,
    title: 'Department Occupancy',
    titleAr: 'إشغال الأقسام',
  },
  gate_logs: {
    columns: GATE_SECURITY_COLUMNS,
    title: 'Gate Security Logs',
    titleAr: 'سجل البوابة والأمن',
  },
  service_ratings: {
    columns: SERVICE_QUALITY_COLUMNS,
    title: 'Service Quality & Ratings',
    titleAr: 'تقييمات جودة الصيانة والنظافة',
  },
  housing_map: {
    columns: HOUSING_MAP_COLUMNS,
    title: 'Housing Map & Structure',
    titleAr: 'خريطة وتفصيل السكن والمباني',
  },
  water_distribution: {
    columns: WATER_DISTRIBUTION_COLUMNS,
    title: 'Water Distribution Sheet',
    titleAr: 'كشف صرف مياه الشرب الشهري',
  },
  police_report: {
    columns: TOURISM_POLICE_COLUMNS,
    title: 'Tourism Police Manifest',
    titleAr: 'كشف شرطة ووزارة السياحة',
  },
  vacations: {
    columns: STAFF_VACATIONS_COLUMNS,
    title: 'Staff Vacations & Historical Archive',
    titleAr: 'سجل وأرشيف إجازات الموظفين',
  },
  policy_exceptions: {
    columns: POLICY_EXCEPTIONS_COLUMNS,
    title: 'Policy Exceptions & Level Audit',
    titleAr: 'تقرير استثناءات ومخالفات السياسة',
  },
  housing_ratings: {
    columns: HOUSING_RATINGS_COLUMNS,
    title: 'Housing Quality Pulse Ratings',
    titleAr: 'استطلاع تقييم جودة السكن الأسبوعي',
  },
  room_moves: {
    columns: ROOM_MOVES_COLUMNS,
    title: 'Room Moves & Bed Transfers',
    titleAr: 'حركات نقل وتغيير الغرف والأسرة',
  },
  configuration: {
    columns: CONFIGURATION_COLUMNS,
    title: 'System & Policy Configuration',
    titleAr: 'إعدادات وسياسات النظام الشاملة',
  },
};
