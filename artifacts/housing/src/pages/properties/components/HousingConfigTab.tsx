// Property dialog > Housing configuration import/export tab.
import { downloadRoomImportTemplate } from "@/lib/room-importer-engine";
import { FileSpreadsheet, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Upload, X } from "lucide-react";
import type { PropertiesState } from "./usePropertiesState";

export function renderHousingConfigTab(s: PropertiesState) {
  const {
    ar,
    editingId,
    form,
    setImportWizardOpen,
    setSelectedPropForImport,
    housingConfigFile,
    setHousingConfigFile,
    setHousingConfigParsedRows,
    housingConfigStats,
    setHousingConfigStats,
    housingFileInputRef,
    handleHousingConfigFile,
  } = s;
  return (
    <TabsContent value="housing_config" className="space-y-4 mt-4">
      <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          <span>
            {ar
              ? "استيراد وتكوين المباني والغرف والأدوار"
              : "Housing, Buildings, Floors & Rooms Config"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {ar
            ? "يمكنك إرفاق ملف Excel (.xlsx / .xls) أو CSV بتكوين الغرف والمباني ليقوم النظام تلقائياً بإنشاء الطوابق والمباني والغرف والأسرة الفيزيائية فور حفظ هذا العقار!"
            : "Upload an Excel (.xlsx / .xls) or CSV room configuration file to automatically set up buildings, floors, rooms, and beds when this property is created!"}
        </p>
      </div>

      {!editingId ? (
        <div className="space-y-4">
          <input
            ref={housingFileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleHousingConfigFile}
            className="hidden"
          />

          {/* Template Download Option */}
          <div className="p-3.5 rounded-xl border bg-blue-500/5 border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-start w-full sm:w-auto">
              <div className="p-2 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">
                  {ar
                    ? "تحميل نموذج ملف تكوين الغرف (Template)"
                    : "Download Room Configuration Template"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {ar
                    ? "يحتوي على كافة الأعمدة القياسية وأمثلة توضيحية لتسهيل التعبئة"
                    : "Includes all standard columns, examples & filling guide"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadRoomImportTemplate("xlsx")}
                className="h-8 text-xs gap-1.5 font-bold border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300"
              >
                <Download className="w-3.5 h-3.5" />
                {ar ? "قالب Excel (.xlsx)" : "Excel (.xlsx)"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => downloadRoomImportTemplate("csv")}
                className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <Download className="w-3 h-3" />
                CSV
              </Button>
            </div>
          </div>

          {!housingConfigFile ? (
            <div
              onClick={() => housingFileInputRef.current?.click()}
              className="p-6 border-2 border-dashed rounded-xl bg-muted/10 hover:bg-muted/20 border-primary/30 hover:border-primary transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-2 group"
            >
              <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-xs text-foreground">
                  {ar
                    ? "اضغط لاختيار ملف تكوين السكن (Excel / CSV)"
                    : "Click to select Housing Configuration file"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {ar
                    ? "يدعم أعمدة: رقم الغرفة، النوع، السرير، أقصى إشغال، الدور، الإطلالة، الباب، المميزات، المساحة"
                    : "Supports Room Number, Type, Beds, Capacity, Floor, View, Door, Features, Size"}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-foreground">
                      {housingConfigFile.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {(housingConfigFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => {
                    setHousingConfigFile(null);
                    setHousingConfigParsedRows([]);
                    setHousingConfigStats(null);
                  }}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  {ar ? "إلغاء الملف" : "Remove"}
                </Button>
              </div>

              {housingConfigStats && (
                <div className="grid grid-cols-4 gap-2 pt-2 border-t text-center">
                  <div className="p-2 rounded-lg bg-muted/40">
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {ar ? "المباني" : "Buildings"}
                    </span>
                    <p className="text-base font-black text-foreground">
                      {housingConfigStats.buildingsCount}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40">
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {ar ? "الأدوار" : "Floors"}
                    </span>
                    <p className="text-base font-black text-foreground">
                      {housingConfigStats.floorsCount}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold">
                      {ar ? "الغرف" : "Rooms"}
                    </span>
                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {housingConfigStats.roomsCount}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <span className="text-[10px] text-blue-800 dark:text-blue-300 font-semibold">
                      {ar ? "الأسرة" : "Beds"}
                    </span>
                    <p className="text-base font-black text-blue-600 dark:text-blue-400">
                      {housingConfigStats.bedsCount}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 rounded-xl border bg-muted/10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h5 className="font-bold text-sm text-foreground">
              {ar
                ? "استيراد وتحديث غرف هذا العقار"
                : "Import & Update Rooms for this Property"}
            </h5>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              {ar
                ? "يمكنك استخدام معالج الاستيراد الشامل لرفع ملف Excel وتدقيق ومطابقة الغرف والأسرة مباشرة."
                : "Use the universal import wizard to upload an Excel file and configure rooms for this property."}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setSelectedPropForImport({ id: editingId, name: form.name });
              setImportWizardOpen(true);
            }}
            className="gap-2 text-xs font-bold bg-gradient-to-r from-primary to-indigo-600 text-white shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {ar
              ? "فتح معالج استيراد الغرف لهذا العقار"
              : "Open Room Importer for this Property"}
          </Button>
        </div>
      )}
    </TabsContent>
  );
}
