export const CHECKOUT_REASONS = [
  { value: "resignation", labelAr: "استقالة من العمل", labelEn: "Resignation" },
  {
    value: "contract_end",
    labelAr: "انتهاء عقد العمل",
    labelEn: "Contract Termination / End",
  },
  {
    value: "property_transfer",
    labelAr: "نقل لفندق أو فرع آخر",
    labelEn: "Transfer to Another Property",
  },
  {
    value: "external_housing",
    labelAr: "انتقال لسكن خارجي (بدل سكن)",
    labelEn: "Moved to External Housing",
  },
  {
    value: "extended_leave",
    labelAr: "إجازة مطولة مع إخلاء طرف",
    labelEn: "Extended Leave with Clearance",
  },
  {
    value: "disciplinary",
    labelAr: "إنهاء خدمة / فصل تأديبي",
    labelEn: "Disciplinary Dismissal",
  },
  { value: "other", labelAr: "أسباب أخرى", labelEn: "Other Reason" },
];

export const IH_COLS = [
  {
    key: "profile",
    label: "Resident",
    labelAr: "الموظف",
    defaultVisible: true,
    fixed: true,
  },
  {
    key: "building",
    label: "Building & Floor",
    labelAr: "المبنى والدور",
    defaultVisible: true,
  },
  {
    key: "room",
    label: "Room & Bed",
    labelAr: "الغرفة والسرير",
    defaultVisible: true,
    fixed: true,
  },
  {
    key: "checkin",
    label: "Check-in",
    labelAr: "تاريخ الدخول",
    defaultVisible: true,
  },
  {
    key: "expected",
    label: "Expected Out",
    labelAr: "المغادرة المتوقعة",
    defaultVisible: true,
  },
  {
    key: "personStatus",
    label: "Status",
    labelAr: "الحالة",
    defaultVisible: true,
  },
  {
    key: "actions",
    label: "Actions",
    labelAr: "إجراءات",
    defaultVisible: true,
    fixed: true,
  },
];
