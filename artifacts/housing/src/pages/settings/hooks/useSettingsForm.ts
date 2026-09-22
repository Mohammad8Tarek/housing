import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export interface JobLevelPolicy {
  id: string;
  levelKey: string;
  name: string;
  nameAr: string;
  allowedCapacities: number[];
  allowEntire: boolean;
  description?: string;
}

export const DEFAULT_JOB_LEVEL_POLICIES: JobLevelPolicy[] = [
  {
    id: "level_0",
    levelKey: "0",
    name: "Level 0 (Top Executive / VIP)",
    nameAr: "الدرجة صفر (إدارة عليا / VIP)",
    allowedCapacities: [1],
    allowEntire: true,
    description: "غرفة فردية أو جناح مستقل للقيادات العليا والمدراء العموم",
  },
  {
    id: "level_1",
    levelKey: "1",
    name: "Level 1 (Department Heads / GMs)",
    nameAr: "الدرجة الأولى (مدراء العموم)",
    allowedCapacities: [1],
    allowEntire: true,
    description: "غرفة فردية مستقلة لمدراء الإدارات والقطاعات",
  },
  {
    id: "level_2",
    levelKey: "2",
    name: "Level 2 (Supervisory / Assistants)",
    nameAr: "الدرجة الثانية (المشرفون ورؤساء الأقسام)",
    allowedCapacities: [1, 2],
    allowEntire: false,
    description: "سكن إشرافي ثنائي أو أحادي",
  },
  {
    id: "level_3",
    levelKey: "3",
    name: "Level 3 (Staff / Technicians)",
    nameAr: "الدرجة الثالثة (الموظفون والفنيون)",
    allowedCapacities: [2, 3],
    allowEntire: false,
    description: "سكن مشترك ثنائي أو ثلاثي للموظفين",
  },
  {
    id: "level_4",
    levelKey: "4",
    name: "Level 4 (Workers / Line Staff)",
    nameAr: "الدرجة الرابعة (العمال والخدمات)",
    allowedCapacities: [3, 4],
    allowEntire: false,
    description: "سكن مشترك ثلاثي أو رباعي للعمال والخدمات",
  },
];

export const settingsSchema = z.object({
  systemName: z.string().min(1),
  defaultLanguage: z.string(),
  primaryColor: z.string(),
  buttonColor: z.string(),
  departureAlertThreshold: z.coerce.number().min(1).max(30),
  departureAlertsEnabled: z.boolean(),
  reportFooter: z.string(),
  passwordMinLength: z.coerce.number().min(4).max(32).default(8),
  passwordRequireUppercase: z.boolean().default(true),
  passwordRequireLowercase: z.boolean().default(true),
  passwordRequireNumber: z.boolean().default(true),
  passwordRequireSymbol: z.boolean().default(false),
  passwordExpiryDays: z.coerce.number().min(0).max(365).default(90),
  passwordHistoryCount: z.coerce.number().min(0).max(50).default(5),
  lockoutThreshold: z.coerce.number().min(1).max(20).default(5),
  lockoutDurationMinutes: z.coerce.number().min(1).max(1440).default(15),

  // ─── Housing Allocation Policy ──────────────────────────────────────
  policyLevel0Capacity: z.coerce.number().min(1).max(10).default(1),
  policyLevel1Capacity: z.coerce.number().min(1).max(10).default(1),
  policyLevel2Capacity: z.coerce.number().min(1).max(10).default(2),
  policyLevel3Capacity: z.coerce.number().min(1).max(10).default(3),
  policyLevel4Capacity: z.coerce.number().min(1).max(10).default(4),
  policyLevel5Capacity: z.coerce.number().min(1).max(20).default(5),
  policyLevel6Capacity: z.coerce.number().min(1).max(20).default(6),
  policyLevel0AllowEntire: z.boolean().default(true),
  policyLevel1AllowEntire: z.boolean().default(true),
  policyLevel2AllowEntire: z.boolean().default(false),
  policyLevel5AllowEntire: z.boolean().default(false),
  policyLevel6AllowEntire: z.boolean().default(false),
  customLevelRules: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        nameAr: z.string().optional(),
        capacity: z.coerce.number().min(1).max(20),
        allowEntire: z.boolean().default(false),
        description: z.string().optional(),
      })
    )
    .default([]),
  jobLevelPolicies: z
    .array(
      z.object({
        id: z.string(),
        levelKey: z.string(),
        name: z.string(),
        nameAr: z.string(),
        allowedCapacities: z.array(z.coerce.number()).min(1),
        allowEntire: z.boolean().default(false),
        description: z.string().optional(),
      })
    )
    .default(DEFAULT_JOB_LEVEL_POLICIES),
  policyDepartmentClustering: z.boolean().default(true),
  policyStrictDepartmentSegregation: z.boolean().default(false),
  policyStrictGenderSegregation: z.boolean().default(true),
  policyStrictFamilySegregation: z.boolean().default(true),
  policyAdaptiveLearning: z.boolean().default(true),
  policyRequireExceptionApproval: z.boolean().default(true),

  // ─── Family Visit Policy ──────────────────────────────────────────
  visitMaxNights: z.coerce.number().min(1).max(60).default(7),
  visitMaxVisitsPerYear: z.coerce.number().min(1).max(20).default(2),
  visitMinServiceMonths: z.coerce.number().min(0).max(60).default(6),
  visitCooldownDays: z.coerce.number().min(0).max(365).default(90),
  visitRequireNationalId: z.boolean().default(true),
  hostingRequestSignaturePolicy: z
    .array(
      z.object({
        stepOrder: z.coerce.number(),
        roleRequired: z.string(),
        labelAr: z.string(),
        labelEn: z.string(),
        isMandatory: z.boolean().default(true),
      })
    )
    .default([]),

  // ─── Housing Rules & Documentation ─────────────────────────────────
  curfewEnabled: z.boolean().default(false),
  curfewTime: z.string().default("23:00"),
  housingRulesText: z.string().default(""),
  familyVisitPolicyText: z.string().default(""),
  housingPolicyText: z.string().default(""),

  // ─── Key Contacts ──────────────────────────────────────────────────
  hrContact1Name: z.string().default(""),
  hrContact1Title: z.string().default("HR Manager"),
  hrContact1Phone: z.string().default(""),
  hrContact1Email: z.string().default(""),

  hrContact2Name: z.string().default(""),
  hrContact2Title: z.string().default("HR Coordinator"),
  hrContact2Phone: z.string().default(""),
  hrContact2Email: z.string().default(""),

  housingManager1Name: z.string().default(""),
  housingManager1Title: z.string().default("Housing Manager"),
  housingManager1Phone: z.string().default(""),
  housingManager1Email: z.string().default(""),

  housingManager2Name: z.string().default(""),
  housingManager2Title: z.string().default("Assistant Housing Manager"),
  housingManager2Phone: z.string().default(""),
  housingManager2Email: z.string().default(""),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;

export function useSettingsForm() {
  const { activePropertyId } = useProperty();
  const selectedPropertyId =
    typeof activePropertyId === "number" ? activePropertyId : undefined;
  const { language, setLanguage } = useLanguage();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetSettings(
    { propertyId: selectedPropertyId },
    { query: { enabled: !!selectedPropertyId } as any },
  );

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      systemName: "",
      defaultLanguage: "en",
      primaryColor: "#0F2A44",
      buttonColor: "#C9A24D",
      departureAlertThreshold: 3,
      departureAlertsEnabled: true,
      reportFooter: "",
      passwordMinLength: 8,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumber: true,
      passwordRequireSymbol: false,
      passwordExpiryDays: 90,
      passwordHistoryCount: 5,
      lockoutThreshold: 5,
      lockoutDurationMinutes: 15,
      policyLevel0Capacity: 1,
      policyLevel1Capacity: 1,
      policyLevel2Capacity: 2,
      policyLevel3Capacity: 3,
      policyLevel4Capacity: 4,
      policyLevel5Capacity: 5,
      policyLevel6Capacity: 6,
      policyLevel0AllowEntire: true,
      policyLevel1AllowEntire: true,
      policyLevel2AllowEntire: false,
      policyLevel5AllowEntire: false,
      policyLevel6AllowEntire: false,
      customLevelRules: [],
      jobLevelPolicies: DEFAULT_JOB_LEVEL_POLICIES,
      policyDepartmentClustering: true,
      policyStrictDepartmentSegregation: false,
      policyStrictGenderSegregation: true,
      policyStrictFamilySegregation: true,
      policyAdaptiveLearning: true,
      policyRequireExceptionApproval: true,
      visitMaxNights: 7,
      visitMaxVisitsPerYear: 2,
      visitMinServiceMonths: 6,
      visitCooldownDays: 90,
      visitRequireNationalId: true,
      curfewEnabled: false,
      curfewTime: "23:00",
      housingRulesText: "",
      familyVisitPolicyText: "",
      housingPolicyText: "",
      hrContact1Name: "",
      hrContact1Title: "HR Manager",
      hrContact1Phone: "",
      hrContact1Email: "",
      hrContact2Name: "",
      hrContact2Title: "HR Coordinator",
      hrContact2Phone: "",
      hrContact2Email: "",
      housingManager1Name: "",
      housingManager1Title: "Housing Manager",
      housingManager1Phone: "",
      housingManager1Email: "",
      housingManager2Name: "",
      housingManager2Title: "Assistant Housing Manager",
      housingManager2Phone: "",
      housingManager2Email: "",
    },
  });

  const updateMutation = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        toast.success(
          language === "ar"
            ? "تم حفظ الإعدادات"
            : "Settings saved successfully",
        );
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      },
      onError: () => toast.error("Error saving settings"),
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    if (!selectedPropertyId) {
      toast.error("Select one property first");
      return;
    }

    // Sync legacy level fields from jobLevelPolicies for backwards compatibility
    const jlps = data.jobLevelPolicies || [];
    const l0 = jlps.find((p) => p.levelKey === "0" || p.id === "level_0");
    const l1 = jlps.find((p) => p.levelKey === "1" || p.id === "level_1");
    const l2 = jlps.find((p) => p.levelKey === "2" || p.id === "level_2");
    const l3 = jlps.find((p) => p.levelKey === "3" || p.id === "level_3");
    const l4 = jlps.find((p) => p.levelKey === "4" || p.id === "level_4");

    const payload = {
      ...data,
      policyLevel0Capacity: l0?.allowedCapacities?.length ? Math.max(...l0.allowedCapacities) : data.policyLevel0Capacity,
      policyLevel0AllowEntire: l0 != null ? l0.allowEntire : data.policyLevel0AllowEntire,
      policyLevel1Capacity: l1?.allowedCapacities?.length ? Math.max(...l1.allowedCapacities) : data.policyLevel1Capacity,
      policyLevel1AllowEntire: l1 != null ? l1.allowEntire : data.policyLevel1AllowEntire,
      policyLevel2Capacity: l2?.allowedCapacities?.length ? Math.max(...l2.allowedCapacities) : data.policyLevel2Capacity,
      policyLevel2AllowEntire: l2 != null ? l2.allowEntire : data.policyLevel2AllowEntire,
      policyLevel3Capacity: l3?.allowedCapacities?.length ? Math.max(...l3.allowedCapacities) : data.policyLevel3Capacity,
      policyLevel4Capacity: l4?.allowedCapacities?.length ? Math.max(...l4.allowedCapacities) : data.policyLevel4Capacity,
      propertyId: selectedPropertyId,
    };

    updateMutation.mutate(
      { data: payload as any },
      {
        onSuccess: () => {
          if (data.defaultLanguage === "en" || data.defaultLanguage === "ar") {
            setLanguage(data.defaultLanguage);
          }
        },
      },
    );
  };

  return {
    settings,
    isLoading,
    form,
    onSubmit,
    updateMutation,
    activePropertyId: selectedPropertyId,
    language,
  };
}
