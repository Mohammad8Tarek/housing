import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, FileText, UserCheck, Building, Printer, HeartHandshake, FileSpreadsheet, Upload } from "lucide-react";
import { usePoliciesSectionState } from "./policies/usePoliciesSectionState";
import { renderAllocationTab } from "./policies/AllocationTab";
import { renderFamilyVisitsTab } from "./policies/FamilyVisitsTab";
import { renderRulesTab } from "./policies/RulesTab";
import { renderContactsTab } from "./policies/ContactsTab";
import { renderSignatureStepDialog } from "./policies/SignatureStepDialog";
import { renderImportPoliciesDialog } from "./policies/ImportPoliciesDialog";
import { renderAddLevelDialog } from "./policies/AddLevelDialog";
export { DEFAULT_SIGNATURE_POLICY, PREDEFINED_ROLES } from "./policies/PoliciesSection.constants";
export type { SignatureStepItem } from "./policies/PoliciesSection.constants";
import { PoliciesSectionProps } from "./policies/PoliciesSection.constants";

export function PoliciesSection(props: PoliciesSectionProps) {
  const s = usePoliciesSectionState(props);
  const { ar, setIsImportModalOpen, handleExportExcelTemplate, handleExportPolicyPdf } = s;


  return (
    <div className="space-y-6">
      {/* Header with Export & Import Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl border">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {ar ? "سياسات ولوائح السكن والمحددات الإدارية" : "Housing Policies, Regulations & Allocation Rules"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ar
              ? "يتبع النظام هذه القواعد تلقائياً في التسكين والبحث عن الغرف المناسبة واحتساب المخالفات لكل عقار"
              : "The system enforces these rules automatically during room allocations, matching, and violation audits"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            onClick={handleExportExcelTemplate}
            variant="outline"
            className="gap-1.5 border-emerald-600/40 hover:bg-emerald-50 text-emerald-700 dark:text-emerald-300 font-semibold text-xs shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            {ar ? "تصدير نموذج إكسيل" : "Export Excel Template"}
          </Button>

          <Button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            variant="outline"
            className="gap-1.5 border-blue-600/40 hover:bg-blue-50 text-blue-700 dark:text-blue-300 font-semibold text-xs shadow-xs"
          >
            <Upload className="w-4 h-4 text-blue-600" />
            {ar ? "استيراد من إكسيل" : "Import from Excel"}
          </Button>

          <Button
            type="button"
            onClick={handleExportPolicyPdf}
            variant="outline"
            className="gap-1.5 border-primary/30 hover:bg-primary/5 text-primary font-semibold text-xs shadow-xs"
          >
            <Printer className="w-4 h-4" />
            {ar ? "وثيقة السياسات (PDF)" : "Export Policy PDF"}
          </Button>
        </div>
      </div>

      {/* Policies Internal Tabs */}
      <Tabs defaultValue="allocation" className="w-full space-y-4">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 h-auto p-1.5 bg-muted/60 border rounded-xl gap-1.5 shadow-xs">
          <TabsTrigger
            value="allocation"
            className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs rounded-lg transition-all"
          >
            <Building className="w-4 h-4 text-primary" />
            <span>{ar ? "استحقاق الغرف والدرجات" : "Room & Level Allocation"}</span>
          </TabsTrigger>

          <TabsTrigger
            value="family_visits"
            className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-pink-600 data-[state=active]:shadow-xs rounded-lg transition-all"
          >
            <HeartHandshake className="w-4 h-4 text-pink-500" />
            <span>{ar ? "الزيارات العائلية" : "Family Visits"}</span>
          </TabsTrigger>

          <TabsTrigger
            value="rules"
            className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-amber-600 data-[state=active]:shadow-xs rounded-lg transition-all"
          >
            <Clock className="w-4 h-4 text-amber-500" />
            <span>{ar ? "المواعيد واللوائح" : "Rules & Curfew"}</span>
          </TabsTrigger>

          <TabsTrigger
            value="contacts"
            className="flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-indigo-600 data-[state=active]:shadow-xs rounded-lg transition-all"
          >
            <UserCheck className="w-4 h-4 text-indigo-500" />
            <span>{ar ? "مسؤولو السكن والـ HR" : "Key Contacts & Admin"}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Allocation Rules & Level Entitlements */}
        {renderAllocationTab(s)}

    {/* Tab 2: Family Visit Policy */}
    {renderFamilyVisitsTab(s)}

    {/* Tab 3: Housing Rules & Curfew */}
    {renderRulesTab(s)}

    {/* Tab 4: Key Contacts & Housing Management */}
    {renderContactsTab(s)}
  </Tabs>

    {/* Signature Step Edit/Add Modal */}
    {renderSignatureStepDialog(s)}

    {/* Import Policies from Excel Dialog */}
    {renderImportPoliciesDialog(s)}

    {/* Add New Level Policy Modal */}
    {renderAddLevelDialog(s)}
  </div>
  );
}
