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
    },
  });

  const updateMutation = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        toast.success(language === "ar"
              ? "تم حفظ الإعدادات"
              : "Settings saved successfully");
        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      },
      onError: () =>
        toast.error("Error saving settings"),
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
