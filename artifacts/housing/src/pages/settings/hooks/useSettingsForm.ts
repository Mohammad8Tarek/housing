import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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
  policyLevel0AllowEntire: z.boolean().default(true),
  policyLevel1AllowEntire: z.boolean().default(true),
  policyLevel2AllowEntire: z.boolean().default(false),
  policyDepartmentClustering: z.boolean().default(true),
  policyStrictDepartmentSegregation: z.boolean().default(false),

  // ─── Family Visit Policy ──────────────────────────────────────────
  visitMaxNights: z.coerce.number().min(1).max(60).default(7),
  visitMaxVisitsPerYear: z.coerce.number().min(1).max(20).default(2),
  visitMinServiceMonths: z.coerce.number().min(0).max(60).default(6),
  visitCooldownDays: z.coerce.number().min(0).max(365).default(90),
  visitRequireNationalId: z.boolean().default(true),

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
      policyLevel0AllowEntire: true,
      policyLevel1AllowEntire: true,
      policyLevel2AllowEntire: false,
      policyDepartmentClustering: true,
      policyStrictDepartmentSegregation: false,
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
    updateMutation.mutate(
      { data: { ...data, propertyId: selectedPropertyId } as any },
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
