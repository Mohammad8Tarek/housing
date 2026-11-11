// Module-level constants/types of PoliciesSection (moved verbatim).

export interface SignatureStepItem {
  id?: string;
  stepOrder: number;
  roleRequired: string;
  labelAr: string;
  labelEn: string;
  description?: string;
  isMandatory: boolean;
}

export const DEFAULT_SIGNATURE_POLICY: SignatureStepItem[] = [
  {
    id: "step_1",
    stepOrder: 1,
    roleRequired: "housing_manager",
    labelAr: "مدير السكن",
    labelEn: "Housing Manager",
    description: "مراجعة وتسكين الطلب وتحديد الغرفة الملائمة",
    isMandatory: true,
  },
  {
    id: "step_2",
    stepOrder: 2,
    roleRequired: "hr_manager",
    labelAr: "مدير الموارد البشرية",
    labelEn: "Human Resources Manager",
    description: "اعتماد الأهلية والتحقق من صلة القرابة ورصيد الزيارات",
    isMandatory: true,
  },
  {
    id: "step_3",
    stepOrder: 3,
    roleRequired: "accounts_manager",
    labelAr: "المدير المالي / الحسابات",
    labelEn: "Accounts / Finance Manager",
    description: "الاعتماد المالي واحتساب الرسوم إن وجدت",
    isMandatory: true,
  },
];

export const PREDEFINED_ROLES = [
  { key: "housing_manager", ar: "مدير السكن", en: "Housing Manager" },
  {
    key: "hr_manager",
    ar: "مدير الموارد البشرية",
    en: "Human Resources Manager",
  },
  {
    key: "accounts_manager",
    ar: "المدير المالي / الحسابات",
    en: "Accounts / Finance Manager",
  },
  { key: "general_manager", ar: "المدير العام", en: "General Manager" },
  { key: "security_manager", ar: "مدير الأمن", en: "Security Manager" },
  { key: "super_admin", ar: "مسؤول النظام", en: "System Administrator" },
  { key: "custom", ar: "وظيفة مخصصة...", en: "Custom Job Title..." },
];

export interface PoliciesSectionProps {
  propertyId?: number;
  language: string;
  isLoading: boolean;
  propertyName?: string;
}
