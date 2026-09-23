import { useEffect, useRef, useState, useMemo } from "react";
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
  ShieldAlert,
} from "lucide-react";
import { LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import { useProperty } from "@/context/PropertyContext";
import { useAuth } from "@/context/AuthContext";

import { useSettingsForm, DEFAULT_JOB_LEVEL_POLICIES } from "./hooks/useSettingsForm";
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
  const { can, canView } = usePermission();

  const canGeneral = can("settings", "view");
  const canPolicies = can("settings", "manage_policies") || can("settings", "edit");
  const canOrganization = can("settings", "manage_organization") || can("settings", "edit");
  const canRoomTypes = can("settings", "manage_room_types") || can("settings", "edit");
  const canWorkers = canView("workers");
  const canSecurity = can("settings", "manage_security") || can("settings", "edit");
  const canHrSync = canView("hr_sync");
  const canDoorLocks = canView("smart_locks");
  const canWhatsApp = canView("whatsapp");
  const canManageEmail = Boolean(
    can("settings", "manage_email") ||
    can("settings", "edit") ||
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
        jobLevelPolicies: Array.isArray((settings as any).jobLevelPolicies) && (settings as any).jobLevelPolicies.length > 0
          ? (settings as any).jobLevelPolicies
          : DEFAULT_JOB_LEVEL_POLICIES,
        policyDepartmentClustering: (settings as any).policyDepartmentClustering ?? true,
        policyStrictDepartmentSegregation: (settings as any).policyStrictDepartmentSegregation ?? false,
        policyStrictGenderSegregation: (settings as any).policyStrictGenderSegregation ?? true,
        policyStrictFamilySegregation: (settings as any).policyStrictFamilySegregation ?? true,
        policyAdaptiveLearning: (settings as any).policyAdaptiveLearning ?? true,
        policyRequireExceptionApproval: (settings as any).policyRequireExceptionApproval ?? true,
        visitMaxNights: (settings as any).visitMaxNights ?? 7,
        visitMaxVisitsPerYear: (settings as any).visitMaxVisitsPerYear ?? 2,
        visitMinServiceMonths: (settings as any).visitMinServiceMonths ?? 6,
        visitCooldownDays: (settings as any).visitCooldownDays ?? 90,
        visitRequireNationalId: (settings as any).visitRequireNationalId ?? true,
        hostingRequestSignaturePolicy: Array.isArray((settings as any).hostingRequestSignaturePolicy) ? (settings as any).hostingRequestSignaturePolicy : [],
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

  const tabsList = useMemo(() => [
    { id: "general", labelAr: "عام", labelEn: "General", icon: Image, allowed: canGeneral },
    { id: "policies", labelAr: "السياسات واللوائح", labelEn: "Policies", icon: Scale, colorClass: "text-amber-600", allowed: canPolicies },
    { id: "organization", labelAr: "الأقسام والمسميات", labelEn: "Depts & Jobs", icon: Building2, colorClass: "text-blue-500", allowed: canOrganization },
    { id: "room-types", labelAr: "الغرف والتصنيفات", labelEn: "Rooms & Class", icon: BedDouble, allowed: canRoomTypes },
    { id: "workers", labelAr: "الفنيين والعمال", labelEn: "Workers", icon: HardHat, colorClass: "text-amber-500", allowed: canWorkers },
    { id: "security", labelAr: "الأمان", labelEn: "Security", icon: Shield, allowed: canSecurity },
    { id: "hr-sync", labelAr: "HR", labelEn: "HR Sync", icon: RefreshCw, allowed: canHrSync },
    { id: "door-locks", labelAr: "الأقفال", labelEn: "Locks", icon: KeyRound, allowed: canDoorLocks },
    { id: "whatsapp", labelAr: "الواتساب", labelEn: "WhatsApp", icon: MessageSquare, colorClass: "text-emerald-500", allowed: canWhatsApp },
    { id: "email", labelAr: "البريد الإلكتروني", labelEn: "Email", icon: Mail, colorClass: "text-indigo-500", allowed: canManageEmail },
  ].filter((t) => t.allowed), [
    canGeneral,
    canPolicies,
    canOrganization,
    canRoomTypes,
    canWorkers,
    canSecurity,
    canHrSync,
    canDoorLocks,
    canWhatsApp,
    canManageEmail,
  ]);

  const [activeTab, setActiveTab] = useState<string>(() => tabsList[0]?.id || "general");

  useEffect(() => {
    if (tabsList.length > 0 && !tabsList.some((t) => t.id === activeTab)) {
      setActiveTab(tabsList[0].id);
    }
  }, [tabsList, activeTab]);

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

  if (tabsList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-card border rounded-xl my-6">
        <ShieldAlert className="w-12 h-12 text-destructive mb-3" />
        <h2 className="text-lg font-bold text-foreground">
          {ar ? "لا توجد صلاحية للوصول إلى أقسام الإعدادات" : "No Accessible Settings Modules"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {ar
            ? "حسابك لا يمتلك صلاحية عرض أي قسم من أقسام الإعدادات. يرجى مراجعة مسؤول النظام."
            : "Your account does not have permission to view any settings tabs. Contact your administrator."}
        </p>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <div className="space-y-6 w-full pb-6 px-1">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {ar ? "الإعدادات" : "Settings"}
          </h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 md:grid-cols-10 mb-6">
            {tabsList.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.id} value={t.id}>
                  <Icon className={`w-3.5 h-3.5 mr-1.5 ${t.colorClass || ""}`} />
                  {ar ? t.labelAr : t.labelEn}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {canGeneral && (
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
          )}

          {canPolicies && (
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
                  <PermissionGate anyPermission={[["settings", "manage_policies"], ["settings", "edit"]]}>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending
                        ? (ar ? "جاري الحفظ..." : "Saving...")
                        : (ar ? "حفظ السياسات واللوائح" : "Save Policies & Rules")}
                    </Button>
                  </PermissionGate>
                </div>
              </form>
            </TabsContent>
          )}

          {canOrganization && (
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
                          jobLevelPolicies={form.watch("jobLevelPolicies") || (settings as any)?.jobLevelPolicies || []}
                        />
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>
        )}

        {canRoomTypes && (
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
        )}

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

          {canSecurity && (
            <TabsContent value="security">
              <form onSubmit={handleSubmit} className="space-y-4">
                <SecuritySettings language={language} isLoading={isLoading} />
                <div className="flex justify-end">
                  <PermissionGate anyPermission={[["settings", "manage_security"], ["settings", "edit"]]}>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending
                        ? (ar ? "جاري الحفظ..." : "Saving...")
                        : (ar ? "حفظ إعدادات الأمان" : "Save Security Settings")}
                    </Button>
                  </PermissionGate>
                </div>
              </form>
            </TabsContent>
          )}

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
