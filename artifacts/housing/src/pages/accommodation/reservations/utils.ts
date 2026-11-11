import type { NewFormState } from "./types";

export const RES_COLS = [
  {
    key: "guest",
    label: "Guest & Type",
    labelAr: "النزيل والتصنيف",
    defaultVisible: true,
    fixed: true,
  },
  {
    key: "contact",
    label: "Contact & ID",
    labelAr: "التواصل والهوية",
    defaultVisible: true,
  },
  {
    key: "stay",
    label: "Stay Period",
    labelAr: "فترة الإقامة",
    defaultVisible: true,
  },
  {
    key: "room",
    label: "Building & Housing",
    labelAr: "المبنى والتسكين",
    defaultVisible: true,
  },
  { key: "status", label: "Status", labelAr: "الحالة", defaultVisible: true },
  {
    key: "actions",
    label: "Actions",
    labelAr: "إجراءات",
    defaultVisible: true,
    fixed: true,
  },
  // Granular columns for power users via ColumnChooser:
  {
    key: "emptype",
    label: "Type only",
    labelAr: "النوع فقط",
    defaultVisible: false,
  },
  {
    key: "phone",
    label: "Phone only",
    labelAr: "الهاتف فقط",
    defaultVisible: false,
  },
  { key: "id", label: "ID only", labelAr: "الهوية فقط", defaultVisible: false },
  {
    key: "dept",
    label: "Dept only",
    labelAr: "القسم فقط",
    defaultVisible: false,
  },
  {
    key: "roomtype",
    label: "Room Type only",
    labelAr: "نوع الغرفة فقط",
    defaultVisible: false,
  },
  {
    key: "checkin",
    label: "Check-in only",
    labelAr: "الدخول فقط",
    defaultVisible: false,
  },
  {
    key: "checkout",
    label: "Check-out only",
    labelAr: "المغادرة فقط",
    defaultVisible: false,
  },
];

export const getStatusLabel = (ar: boolean): Record<string, string> => ({
  UPCOMING: ar ? "حجز مستقبلي" : "Future",
  CHECKED_IN: ar ? "مقيم" : "Checked In",
  CANCELLED: ar ? "ملغي" : "Cancelled",
  COMPLETED: ar ? "منتهي" : "Completed",
});

export const statusColor = (s: string) =>
  ({
    UPCOMING:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    CHECKED_IN:
      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    COMPLETED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  })[s] || "bg-gray-100 text-gray-600";

/** Room statuses that can never receive a reservation / assignment. */
export const NON_BOOKABLE_ROOM_STATUSES = [
  "maintenance",
  "out_of_service",
  "oos",
  "out_of_order",
  "ooo",
];

export const isRoomBookable = (r: any) =>
  !NON_BOOKABLE_ROOM_STATUSES.includes(r.status?.toLowerCase());

/** Fresh, empty "new profile" wizard form (hire date defaults to today). */
export const makeEmptyNewForm = (): NewFormState => ({
  profileId: "",
  firstName: "",
  lastName: "",
  thirdName: "",
  fourthName: "",
  nationalId: "",
  nationality: "",
  gender: "M",
  phone: "",
  dateOfBirth: "",
  address: "",
  hireDate: new Date().toISOString().split("T")[0],
  contractEndDate: "",
  department: "",
  jobTitle: "",
  level: "",
  employmentType: "THIRD_PARTY",
  companyName: "",
  idDocuments: [],
});
