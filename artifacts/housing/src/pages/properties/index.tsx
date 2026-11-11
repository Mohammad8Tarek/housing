import { RoomImportWizard } from "@/pages/housing/components/import/RoomImportWizard";
import { FileSpreadsheet } from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import { AnimatedConfirmModal } from "@/components/shared/AnimatedConfirmModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, Globe, Palette, Shield, Users } from "lucide-react";
import { ColumnChooser } from "@/components/ui/column-chooser";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { usePropertiesState } from "./components/usePropertiesState";
import { renderPropertiesTable } from "./components/PropertiesTable";
import { renderGeneralTab } from "./components/GeneralTab";
import { renderBrandingTab } from "./components/BrandingTab";
import { renderAdminTab } from "./components/AdminTab";
import { renderContactsTab } from "./components/ContactsTab";
import { renderHousingConfigTab } from "./components/HousingConfigTab";
import { renderPropertyDetailsDialog } from "./components/PropertyDetailsDialog";

export default function Properties() {
  const s = usePropertiesState();
  const {
    queryClient,
    ar,
    isOpen,
    editingId,
    activeTab,
    setActiveTab,
    deleteDialog,
    setDeleteDialog,
    importWizardOpen,
    setImportWizardOpen,
    selectedPropForImport,
    properties,
    isLoading,
    invalidate,
    deleteMutation,
    closeDialog,
    openCreate,
    onSubmit,
    isPending,
    PROP_COLS,
    propVisible,
    propToggle,
    propShowAll,
    propHideAll,
    selectedRows,
    setSelectedRows,
    exportPropExcel,
  } = s;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">
            {ar ? "العقارات" : "Properties"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ColumnChooser
            cols={PROP_COLS}
            visible={propVisible}
            onToggle={propToggle}
            onShowAll={propShowAll}
            onHideAll={propHideAll}
          />
          <PermissionGate module="properties" action="create">
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              {ar ? "إضافة عقار" : "Add Property"}
            </Button>
          </PermissionGate>
        </div>
      </div>

      <BulkActionBar
        count={selectedRows.size}
        onClear={() => setSelectedRows(new Set())}
        onExportExcel={exportPropExcel}
        ar={ar}
      />

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        renderPropertiesTable(s)
      )}

      {/* Dialog */}
      <Dialog
        open={isOpen}
        onOpenChange={(v) => {
          if (!v) closeDialog();
        }}
      >
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          srTitle={
            editingId
              ? ar
                ? "تعديل العقار"
                : "Edit Property"
              : ar
                ? "عقار جديد"
                : "New Property"
          }
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold uppercase tracking-wide">
              <Building2 className="w-5 h-5" />
              {editingId
                ? ar
                  ? "تعديل العقار"
                  : "EDIT PROPERTY"
                : ar
                  ? "عقار جديد"
                  : "NEW PROPERTY"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger
                value="general"
                className="gap-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                <Globe className="w-3.5 h-3.5" />
                {ar ? "عام" : "GENERAL"}
              </TabsTrigger>
              <TabsTrigger
                value="branding"
                className="gap-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                <Palette className="w-3.5 h-3.5" />
                {ar ? "الهوية" : "BRANDING"}
              </TabsTrigger>
              <TabsTrigger
                value="admin"
                className="gap-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                <Shield className="w-3.5 h-3.5" />
                {ar ? "المستخدمين" : "USERS"}
              </TabsTrigger>
              <TabsTrigger
                value="contacts"
                className="gap-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                <Users className="w-3.5 h-3.5" />
                {ar ? "التواصل" : "CONTACTS"}
              </TabsTrigger>
              <TabsTrigger
                value="housing_config"
                className="gap-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                {ar ? "تكوين السكن" : "HOUSING"}
              </TabsTrigger>
            </TabsList>

            {/* ── GENERAL TAB ── */}
            {renderGeneralTab(s)}

            {/* ── BRANDING TAB ── */}
            {renderBrandingTab(s)}

            {/* ── ADMIN TAB ── */}
            {renderAdminTab(s)}

            {/* ── CONTACTS TAB (KEY HR & HOUSING MANAGERS) ── */}
            {renderContactsTab(s)}

            {/* ── HOUSING CONFIG TAB ── */}
            {renderHousingConfigTab(s)}
          </Tabs>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-4 border-t mt-4">
            <Button variant="outline" onClick={closeDialog}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={onSubmit} disabled={isPending}>
              {isPending
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? "حفظ العقار"
                  : "Save Property"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RoomImportWizard
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        properties={properties || []}
        currentPropertyId={selectedPropForImport?.id}
        buildings={[]}
        existingRooms={[]}
        onImportSuccess={() => {
          invalidate();
          queryClient.invalidateQueries();
        }}
      />
      <AnimatedConfirmModal
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title={ar ? "حذف العقار؟" : "Delete Property?"}
        description={
          ar
            ? "هل أنت متأكد أنك تريد حذف هذا العقار؟"
            : "Are you sure you want to delete this property?"
        }
        variant="destructive"
        onConfirm={() => deleteMutation.mutate({ id: deleteDialog.id })}
      />

      {/* Property Details Modal */}
      {renderPropertyDetailsDialog(s)}
    </div>
  );
}
