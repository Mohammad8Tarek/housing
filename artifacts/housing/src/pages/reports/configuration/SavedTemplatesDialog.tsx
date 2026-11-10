// Load or delete saved templates.
import { BookmarkPlus, FolderOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DATA_SOURCES } from "../config/customReportConfig";
import { PermissionGate } from "@/components/ui/permission-gate";
import type { ReportConfigurationPageState } from "./useReportConfigurationPageState";

export function renderSavedTemplatesDialog(s: ReportConfigurationPageState) {
  const { ar, isLoadModalOpen, setIsLoadModalOpen, templates, deleteTemplateMutation, handleApplyTemplate } = s;
  return (
<Dialog open={isLoadModalOpen} onOpenChange={setIsLoadModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FolderOpen className="w-5 h-5 text-amber-600" />
              {ar ? "النماذج المحفوظة المسبقة" : "Saved Report Templates"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs max-h-[60vh] overflow-y-auto">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookmarkPlus className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p>{ar ? "لا توجد نماذج محفوظة حتى الآن." : "No saved templates found yet."}</p>
                <p className="text-[11px] mt-1">
                  {ar ? "قم بتهيئة تقريرك ثم اضغط 'حفظ كنموذج' للاسترجاع لاحقاً." : "Configure a report and click 'Save as Template'."}
                </p>
              </div>
            ) : (
              templates.map((tmpl) => {
                const src = DATA_SOURCES.find((s) => s.id === tmpl.dataSource) || DATA_SOURCES[0];
                const Icon = src.icon;
                return (
                  <div
                    key={tmpl.id}
                    className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/30 transition-all gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${src.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{tmpl.name}</h4>
                        {tmpl.nameEn && <p className="text-[11px] text-muted-foreground">{tmpl.nameEn}</p>}
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="text-[9px] py-0">
                            {ar ? src.labelAr : src.label}
                          </Badge>
                          <span>• {Array.isArray(tmpl.columns) ? tmpl.columns.length : 0} {ar ? "عمود" : "cols"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleApplyTemplate(tmpl)}
                        className="h-8 text-xs font-bold rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border-primary/20"
                      >
                        {ar ? "تطبيق" : "Apply"}
                      </Button>
                      <PermissionGate module="reports" action="delete">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTemplateMutation.mutate(tmpl.id)}
                          className="h-8 w-8 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                          title={ar ? "حذف النموذج" : "Delete"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsLoadModalOpen(false)}>
              {ar ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
