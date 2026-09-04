import { useEffect, useRef, useState } from "react";
import { FormProvider } from "react-hook-form";
import { applyBrandColors } from "@/lib/brand-colors";
import { useLanguage } from "@/context/LanguageContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Briefcase,
  BedDouble,
  Shield,
  RefreshCw,
  KeyRound,
  Image,
  Pen,
  Sparkles,
} from "lucide-react";
import { LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";

import { useSettingsForm } from "./hooks/useSettingsForm";
import { GeneralSettings } from "./components/GeneralSettings";
import { SecuritySettings } from "./components/SecuritySettings";
import { LookupSection } from "./components/LookupSection";
import { HrSyncSection } from "./components/HrSyncSection";
import { DoorLocksSection } from "./components/DoorLocksSection";

export default function Settings() {
  const {
    settings,
    isLoading,
    form,
    onSubmit,
    updateMutation,
    activePropertyId,
    language,
  } = useSettingsForm();
  const { setLanguage } = useLanguage();

  const initRef = useRef(false);
  useEffect(() => {
    if (settings && !initRef.current) {
      initRef.current = true;
      form.reset({
        systemName: settings.systemName ?? "",
        defaultLanguage: settings.defaultLanguage ?? "en",
        primaryColor: settings.primaryColor ?? "#0F2A44",
        buttonColor: (settings as any).buttonColor ?? "#C9A24D",
        departureAlertThreshold: settings.departureAlertThreshold ?? 3,
        departureAlertsEnabled: settings.departureAlertsEnabled ?? true,
        reportFooter: settings.reportFooter ?? "",
        passwordMinLength: (settings as any).passwordMinLength ?? 8,
        passwordRequireUppercase:
          (settings as any).passwordRequireUppercase ?? true,
        passwordRequireLowercase:
          (settings as any).passwordRequireLowercase ?? true,
        passwordRequireNumber: (settings as any).passwordRequireNumber ?? true,
        passwordRequireSymbol: (settings as any).passwordRequireSymbol ?? false,
        passwordExpiryDays: (settings as any).passwordExpiryDays ?? 90,
        passwordHistoryCount: (settings as any).passwordHistoryCount ?? 5,
        lockoutThreshold: (settings as any).lockoutThreshold ?? 5,
        lockoutDurationMinutes: (settings as any).lockoutDurationMinutes ?? 15,
      });
      applyBrandColors(settings.primaryColor, (settings as any).buttonColor);
    }
  }, [settings, form]);

  const handleSubmit = form.handleSubmit((data) => {
    updateMutation.mutate(
      { data: { ...data, propertyId: activePropertyId! } as any },
      {
        onSuccess: () => {
          applyBrandColors(data.primaryColor, data.buttonColor);
          if (data.defaultLanguage === "en" || data.defaultLanguage === "ar") {
            setLanguage(data.defaultLanguage);
          }
        },
      },
    );
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const ar = language === "ar";
  const selectedPropertyId =
    typeof activePropertyId === "number" ? activePropertyId : null;

  return (
    <FormProvider {...form}>
      <div className="space-y-6 w-full pb-6 px-1">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {ar ? "الإعدادات" : "Settings"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {ar
              ? "إدارة إعدادات النظام والقوائم المنسدلة"
              : "Manage system configuration and dropdown lists"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-8 mb-6">
              <TabsTrigger value="general">
                <Image className="w-3.5 h-3.5 mr-1.5" />
                {ar ? "عام" : "General"}
              </TabsTrigger>
              <TabsTrigger value="departments">
                <Building2 className="w-3.5 h-3.5 mr-1.5" />
                {ar ? "الأقسام" : "Depts"}
              </TabsTrigger>
              <TabsTrigger value="job-titles">
                <Briefcase className="w-3.5 h-3.5 mr-1.5" />
                {ar ? "المسميات" : "Jobs"}
              </TabsTrigger>
              <TabsTrigger value="room-types">
                <BedDouble className="w-3.5 h-3.5 mr-1.5" />
                {ar ? "الغرف والتصنيفات" : "Rooms & Class"}
              </TabsTrigger>
              <TabsTrigger value="security">
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                {ar ? "الأمان" : "Security"}
              </TabsTrigger>
              <TabsTrigger value="hr-sync">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                {ar ? "HR" : "HR Sync"}
              </TabsTrigger>
              <TabsTrigger value="door-locks">
                <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                {ar ? "الأقفال" : "Locks"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <GeneralSettings
                activePropertyId={selectedPropertyId}
                language={language}
                settings={settings}
                isLoading={isLoading}
              />
              <div className="flex justify-end">
                <PermissionGate module="settings" action="edit">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending
                      ? (ar ? "جاري الحفظ..." : "Saving...")
                      : (ar ? "حفظ الإعدادات" : "Save Settings")}
                  </Button>
                </PermissionGate>
              </div>
            </TabsContent>

            <TabsContent value="departments">
              <Card>
                <CardContent className="pt-6">
                  {selectedPropertyId && (
                    <LookupSection
                      propertyId={selectedPropertyId}
                      category={LOOKUP_CATEGORIES.DEPARTMENT}
                      label="Department"
                      description={ar ? "إدارة قائمة الأقسام" : "Manage departments list"}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="job-titles">
              <Card>
                <CardContent className="pt-6">
                  {selectedPropertyId && (
                    <LookupSection
                      propertyId={selectedPropertyId}
                      category={LOOKUP_CATEGORIES.JOB_TITLE}
                      label="Job Title"
                      description={ar ? "إدارة المسميات الوظيفية وربطها بالدرجة" : "Manage job titles"}
                      parentCategory={LOOKUP_CATEGORIES.DEPARTMENT}
                      parentLabel="Department"
                      extraLabel="Level"
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="room-types">
              <div className="space-y-4">
                <Tabs defaultValue="classifications" className="w-full">
                  <TabsList className="grid w-full max-w-md grid-cols-2 mb-4 bg-muted/60 p-1">
                    <TabsTrigger value="classifications" className="text-xs font-semibold gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      {ar ? "تصنيفات الغرف (Classifications)" : "Room Classifications"}
                    </TabsTrigger>
                    <TabsTrigger value="types" className="text-xs font-semibold gap-1.5">
                      <BedDouble className="w-3.5 h-3.5 text-primary" />
                      {ar ? "أنواع الغرف والسعة (Types)" : "Room Types & Capacity"}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="classifications">
                    <Card>
                      <CardContent className="pt-6">
                        {selectedPropertyId && (
                          <LookupSection
                            propertyId={selectedPropertyId}
                            category={LOOKUP_CATEGORIES.ROOM_CLASSIFICATION}
                            label="Room Classification"
                            description={
                              ar
                                ? "إدارة تصنيفات الغرف (مثل Deluxe room, Family suite, Superior room, Standard room) المستخدمة في الترشيح الذكي حسب المنصب وسكن العائلات"
                                : "Manage room classifications (e.g. Deluxe room, Family suite, Superior room) used for smart recommendation"
                            }
                            parentCategory={LOOKUP_CATEGORIES.ROOM_TYPE}
                            parentLabel={ar ? "النوع المقترح" : "Suggested Type"}
                            extraLabel={ar ? "المستوى / الفئة المستهدفة" : "Target Level / Audience"}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="types">
                    <Card>
                      <CardContent className="pt-6">
                        {selectedPropertyId && (
                          <LookupSection
                            propertyId={selectedPropertyId}
                            category={LOOKUP_CATEGORIES.ROOM_TYPE}
                            label="Room Type"
                            description={ar ? "إدارة أنواع الغرف وسعة استيعاب كل نوع" : "Manage room types"}
                            showCapacity
                          />
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <SecuritySettings language={language} isLoading={isLoading} />
              <div className="flex justify-end">
                <PermissionGate module="settings" action="edit">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending
                      ? (ar ? "جاري الحفظ..." : "Saving...")
                      : (ar ? "حفظ إعدادات الأمان" : "Save Security Settings")}
                  </Button>
                </PermissionGate>
              </div>
            </TabsContent>

            <TabsContent value="hr-sync" className="space-y-4">
              <HrSyncSection
                propertyId={selectedPropertyId}
                language={language}
              />
            </TabsContent>

            <TabsContent value="door-locks" className="space-y-4">
              <DoorLocksSection
                propertyId={selectedPropertyId}
                language={language}
              />
            </TabsContent>
          </Tabs>
        </form>
      </div>
    </FormProvider>
  );
}
