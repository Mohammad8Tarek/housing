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
  Bed,
  Compass,
  Shield,
  RefreshCw,
  KeyRound,
  Image,
  Pen,
  Sparkles,
  MessageSquare,
  HardHat,
  Mail,
  Scale,
} from "lucide-react";
import { LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import { useProperty } from "@/context/PropertyContext";
import { useAuth } from "@/context/AuthContext";

import { useSettingsForm } from "./hooks/useSettingsForm";
import { GeneralSettings } from "./components/GeneralSettings";
import { SecuritySettings } from "./components/SecuritySettings";
import { PoliciesSection } from "./components/PoliciesSection";
import { LookupSection } from "./components/LookupSection";
import { HrSyncSection } from "./components/HrSyncSection";
import { DoorLocksSection } from "./components/DoorLocksSection";
import { WhatsAppSettingsSection } from "./components/WhatsAppSettingsSection";
import { EmailSettingsSection } from "./components/EmailSettingsSection";
import { WorkersTab } from "@/pages/maintenance/components/WorkersTab";
import { usePermission } from "@/hooks/use-permission";

export default function Settings() {
  const { properties } = useProperty();
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
  const { user, isSystemAdmin } = useAuth();
  const { canView } = usePermission();
  const canManageEmail = Boolean(
    isSystemAdmin ||
    user?.roles?.includes("admin") ||
    user?.roles?.includes("super_admin") ||
    (user as any)?.isSystemAdmin
  );

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
        policyLevel0Capacity: (settings as any).policyLevel0Capacity ?? 1,
        policyLevel1Capacity: (settings as any).policyLevel1Capacity ?? 1,
        policyLevel2Capacity: (settings as any).policyLevel2Capacity ?? 2,
        policyLevel3Capacity: (settings as any).policyLevel3Capacity ?? 3,
        policyLevel4Capacity: (settings as any).policyLevel4Capacity ?? 4,
        policyLevel5Capacity: (settings as any).policyLevel5Capacity ?? 5,
        policyLevel6Capacity: (settings as any).policyLevel6Capacity ?? 6,
        policyLevel0AllowEntire: (settings as any).policyLevel0AllowEntire ?? true,
        policyLevel1AllowEntire: (settings as any).policyLevel1AllowEntire ?? true,
        policyLevel2AllowEntire: (settings as any).policyLevel2AllowEntire ?? false,
        policyLevel5AllowEntire: (settings as any).policyLevel5AllowEntire ?? false,
        policyLevel6AllowEntire: (settings as any).policyLevel6AllowEntire ?? false,
        customLevelRules: Array.isArray((settings as any).customLevelRules) ? (settings as any).customLevelRules : [],
        policyDepartmentClustering: (settings as any).policyDepartmentClustering ?? true,
        policyStrictDepartmentSegregation: (settings as any).policyStrictDepartmentSegregation ?? false,
        visitMaxNights: (settings as any).visitMaxNights ?? 7,
        visitMaxVisitsPerYear: (settings as any).visitMaxVisitsPerYear ?? 2,
        visitMinServiceMonths: (settings as any).visitMinServiceMonths ?? 6,
        visitCooldownDays: (settings as any).visitCooldownDays ?? 90,
        visitRequireNationalId: (settings as any).visitRequireNationalId ?? true,
        curfewEnabled: (settings as any).curfewEnabled ?? false,
        curfewTime: (settings as any).curfewTime ?? "23:00",
        housingRulesText: (settings as any).housingRulesText ?? "",
        familyVisitPolicyText: (settings as any).familyVisitPolicyText ?? "",
        housingPolicyText: (settings as any).housingPolicyText ?? "",
        hrContact1Name: (settings as any).hrContact1Name ?? "",
        hrContact1Title: (settings as any).hrContact1Title ?? "HR Manager",
        hrContact1Phone: (settings as any).hrContact1Phone ?? "",
        hrContact1Email: (settings as any).hrContact1Email ?? "",
        hrContact2Name: (settings as any).hrContact2Name ?? "",
        hrContact2Title: (settings as any).hrContact2Title ?? "HR Coordinator",
        hrContact2Phone: (settings as any).hrContact2Phone ?? "",
        hrContact2Email: (settings as any).hrContact2Email ?? "",
        housingManager1Name: (settings as any).housingManager1Name ?? "",
        housingManager1Title: (settings as any).housingManager1Title ?? "Housing Manager",
        housingManager1Phone: (settings as any).housingManager1Phone ?? "",
        housingManager1Email: (settings as any).housingManager1Email ?? "",
        housingManager2Name: (settings as any).housingManager2Name ?? "",
        housingManager2Title: (settings as any).housingManager2Title ?? "Assistant Housing Manager",
        housingManager2Phone: (settings as any).housingManager2Phone ?? "",
        housingManager2Email: (settings as any).housingManager2Email ?? "",
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
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 md:grid-cols-10 mb-6">
            <TabsTrigger value="general">
              <Image className="w-3.5 h-3.5 mr-1.5" />
              {ar ? "عام" : "General"}
            </TabsTrigger>
            <TabsTrigger value="policies">
              <Scale className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              {ar ? "السياسات واللوائح" : "Policies"}
            </TabsTrigger>
            <TabsTrigger value="organization">
              <Building2 className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
              {ar ? "الأقسام والمسميات" : "Depts & Jobs"}
            </TabsTrigger>
            <TabsTrigger value="room-types">
              <BedDouble className="w-3.5 h-3.5 mr-1.5" />
              {ar ? "الغرف والتصنيفات" : "Rooms & Class"}
            </TabsTrigger>
            {canView("workers") && (
              <TabsTrigger value="workers">
                <HardHat className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                {ar ? "الفنيين والعمال" : "Workers"}
              </TabsTrigger>
            )}
            <TabsTrigger value="security">
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              {ar ? "الأمان" : "Security"}
            </TabsTrigger>
            {canView("hr_sync") && (
              <TabsTrigger value="hr-sync">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                {ar ? "HR" : "HR Sync"}
              </TabsTrigger>
            )}
            {canView("smart_locks") && (
              <TabsTrigger value="door-locks">
                <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                {ar ? "الأقفال" : "Locks"}
              </TabsTrigger>
            )}
            {canView("whatsapp") && (
              <TabsTrigger value="whatsapp">
                <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                {ar ? "الواتساب" : "WhatsApp"}
              </TabsTrigger>
            )}
            {canManageEmail && (
              <TabsTrigger value="email">
                <Mail className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                {ar ? "البريد الإلكتروني" : "Email"}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="general">
            <form onSubmit={handleSubmit} className="space-y-4">
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
            </form>
          </TabsContent>

          <TabsContent value="policies">
            <form onSubmit={handleSubmit} className="space-y-4">
              <PoliciesSection
                propertyId={selectedPropertyId ?? undefined}
                language={language}
                isLoading={isLoading}
                propertyName={
                  properties?.find((p: any) => p.id === selectedPropertyId)?.displayName ||
                  properties?.find((p: any) => p.id === selectedPropertyId)?.name
                }
              />
              <div className="flex justify-end">
                <PermissionGate module="settings" action="edit">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending
                      ? (ar ? "جاري الحفظ..." : "Saving...")
                      : (ar ? "حفظ السياسات واللوائح" : "Save Policies & Rules")}
                  </Button>
                </PermissionGate>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="organization">
            <div className="space-y-4">
              <Tabs defaultValue="departments" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-4 bg-muted/60 p-1">
                  <TabsTrigger value="departments" className="text-xs font-semibold gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    {ar ? "الأقسام والإدارات" : "Departments"}
                  </TabsTrigger>
                  <TabsTrigger value="job-titles" className="text-xs font-semibold gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-primary" />
                    {ar ? "المسميات والدرجات" : "Job Titles & Levels"}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="departments">
                  <Card>
                    <CardContent className="pt-6">
                      {selectedPropertyId && (
                        <LookupSection
                          propertyId={selectedPropertyId}
                          category={LOOKUP_CATEGORIES.DEPARTMENT}
                          label="Department"
                          description={ar ? "إدارة قائمة الأقسام والإدارات" : "Manage departments list"}
                          enablePagination={true}
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
                          description={ar ? "إدارة المسميات الوظيفية وتحديد الأقسام والدرجات" : "Manage job titles"}
                          parentCategory={LOOKUP_CATEGORIES.DEPARTMENT}
                          parentLabel="Department"
                          extraLabel="Level"
                          enablePagination={true}
                          customLevelRules={form.watch("customLevelRules") || (settings as any)?.customLevelRules || []}
                        />
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          <TabsContent value="room-types">
            <div className="space-y-4">
              <Tabs defaultValue="classifications" className="w-full">
                <TabsList className="grid w-full max-w-3xl grid-cols-4 mb-4 bg-muted/60 p-1">
                  <TabsTrigger value="classifications" className="text-xs font-semibold gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    {ar ? "تصنيفات الغرف" : "Room Classifications"}
                  </TabsTrigger>
                  <TabsTrigger value="types" className="text-xs font-semibold gap-1.5">
                    <BedDouble className="w-3.5 h-3.5 text-primary" />
                    {ar ? "أنواع الغرف والسعة" : "Room Types & Capacity"}
                  </TabsTrigger>
                  <TabsTrigger value="beds" className="text-xs font-semibold gap-1.5">
                    <Bed className="w-3.5 h-3.5 text-indigo-500" />
                    {ar ? "أنواع الأسرة" : "Bed Types"}
                  </TabsTrigger>
                  <TabsTrigger value="views" className="text-xs font-semibold gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-teal-500" />
                    {ar ? "إطلالات الغرف" : "Room Views"}
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
                              ? "إدارة تصنيفات الغرف (مثل غرفة ديلوكس، جناح عائلي، غرفة سوبيريور، غرفة قياسية) المستخدمة في الترشيح الذكي حسب المنصب وسكن العائلات"
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
                          description={ar ? "إدارة أنواع الغرف وسعة استيعاب كل نوع" : "Manage room types and capacity"}
                          showCapacity
                        />
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="beds">
                  <Card>
                    <CardContent className="pt-6">
                      {selectedPropertyId && (
                        <LookupSection
                          propertyId={selectedPropertyId}
                          category={LOOKUP_CATEGORIES.BED_TYPE}
                          label="Bed Type"
                          description={ar ? "إدارة أنواع الأسرة الفندقية (مثل سرير فردي، سرير مزدوج، سرير طابقين...)" : "Manage hotel bed types (e.g. Single Bed, Double Bed, Bunk Bed...)"}
                        />
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="views">
                  <Card>
                    <CardContent className="pt-6">
                      {selectedPropertyId && (
                        <LookupSection
                          propertyId={selectedPropertyId}
                          category={LOOKUP_CATEGORIES.ROOM_VIEW}
                          label="Room View"
                          description={ar ? "إدارة إطلالات الغرف (مثل إطلالة بحرية، إطلالة على الحديقة، حمام سباحة، إطلالة خلفية...)" : "Manage room views (e.g. Sea view, Garden view, Pool view, Back view...)"}
                        />
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          {canView("workers") && (
            <TabsContent value="workers" className="space-y-4">
              {selectedPropertyId ? (
                <WorkersTab
                  propertyId={selectedPropertyId}
                  propertyName={
                    properties?.find((p: any) => p.id === selectedPropertyId)?.displayName ||
                    properties?.find((p: any) => p.id === selectedPropertyId)?.name
                  }
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm bg-card border rounded-xl p-8">
                  {ar ? "يرجى اختيار الفندق / العقار أولاً لعرض وإدارة الفنيين" : "Please select a hotel/property first to manage workers"}
                </div>
              )}
            </TabsContent>
          )}

          <TabsContent value="security">
            <form onSubmit={handleSubmit} className="space-y-4">
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
            </form>
          </TabsContent>

          {canView("hr_sync") && (
            <TabsContent value="hr-sync" className="space-y-4">
              <HrSyncSection
                propertyId={selectedPropertyId}
                language={language}
              />
            </TabsContent>
          )}

          {canView("smart_locks") && (
            <TabsContent value="door-locks" className="space-y-4">
              <DoorLocksSection
                propertyId={selectedPropertyId}
                language={language}
              />
            </TabsContent>
          )}

          {canView("whatsapp") && (
            <TabsContent value="whatsapp" className="space-y-4">
              <WhatsAppSettingsSection
                propertyId={selectedPropertyId}
                language={language}
              />
            </TabsContent>
          )}

          {canManageEmail && (
            <TabsContent value="email" className="space-y-4">
              <EmailSettingsSection
                propertyId={selectedPropertyId}
                language={language}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </FormProvider>
  );
}
