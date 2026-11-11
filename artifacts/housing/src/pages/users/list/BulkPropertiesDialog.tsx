// Bulk assign properties to selected users.
import { Button } from "@/components/ui/button";
import { Building2, Check, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { UsersPageState } from "./useUsersPageState";

export function renderBulkPropertiesDialog(s: UsersPageState) {
  const {
    ar,
    selectedRows,
    bulkPropModalOpen,
    setBulkPropModalOpen,
    selectedBulkProps,
    setSelectedBulkProps,
    isBulkExecuting,
    properties,
    handleBulkPropertiesChange,
  } = s;
  return (
    <Dialog open={bulkPropModalOpen} onOpenChange={setBulkPropModalOpen}>
      <DialogContent className="max-w-md" dir={ar ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Building2 className="w-5 h-5 text-blue-500" />
            {ar
              ? `تخصيص الفروع الفندقية لـ (${selectedRows.size}) مستخدم`
              : `Assign Properties for (${selectedRows.size}) Users`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {ar
              ? "حدد الفنادق والفروع المسموح للمستخدمين المحددين الوصول إليها وإدارتها:"
              : "Select the hotel properties these selected users will have access to:"}
          </p>
          <div className="space-y-2 max-h-56 overflow-y-auto border rounded-lg p-2.5 bg-muted/20">
            {(properties ?? []).map((p: any) => {
              const checked = selectedBulkProps.includes(p.id);
              return (
                <label
                  key={p.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(val) => {
                      if (val) {
                        setSelectedBulkProps((prev) => [...prev, p.id]);
                      } else {
                        setSelectedBulkProps((prev) =>
                          prev.filter((id) => id !== p.id),
                        );
                      }
                    }}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold">{p.name}</span>
                    <span className="text-xs text-muted-foreground font-mono ms-2">
                      ({p.code})
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setBulkPropModalOpen(false)}
            disabled={isBulkExecuting}
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={handleBulkPropertiesChange}
            disabled={isBulkExecuting}
            className="bg-[#0F2A44] hover:bg-[#143555] text-white"
          >
            {isBulkExecuting ? (
              <RefreshCw className="w-4 h-4 animate-spin me-1.5" />
            ) : (
              <Check className="w-4 h-4 me-1.5" />
            )}
            {ar ? "تطبيق الفروع" : "Apply Properties"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
