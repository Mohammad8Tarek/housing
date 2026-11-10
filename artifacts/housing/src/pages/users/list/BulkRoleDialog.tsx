// Bulk change role for selected users.
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Check, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { roleColor } from "../utils";
import { ALL_ROLES } from "./index.constants";
import type { UsersPageState } from "./useUsersPageState";

export function renderBulkRoleDialog(s: UsersPageState) {
  const { ar, selectedRows, bulkRoleModalOpen, setBulkRoleModalOpen, selectedBulkRole, setSelectedBulkRole, isBulkExecuting, handleBulkRoleChange } = s;
  return (
<Dialog open={bulkRoleModalOpen} onOpenChange={setBulkRoleModalOpen}>
        <DialogContent className="max-w-md" dir={ar ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Shield className="w-5 h-5 text-[#C9A24D]" />
              {ar ? `تغيير الدور لـ (${selectedRows.size}) مستخدم محدد` : `Change Role for (${selectedRows.size}) Users`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {ar
                ? "حدد الدور الوظيفي الجديد ليتم تطبيقه على جميع الحسابات المحددة فوراً:"
                : "Select the new primary role to apply immediately to all selected accounts:"}
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                {ar ? "الدور الجديد" : "Target Role"}
              </label>
              <Select value={selectedBulkRole} onValueChange={setSelectedBulkRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${roleColor(role.value)}`} />
                        {ar ? role.labelAr : role.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBulkRoleModalOpen(false)}
              disabled={isBulkExecuting}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleBulkRoleChange}
              disabled={isBulkExecuting}
              className="bg-[#0F2A44] hover:bg-[#143555] text-white"
            >
              {isBulkExecuting ? (
                <RefreshCw className="w-4 h-4 animate-spin me-1.5" />
              ) : (
                <Check className="w-4 h-4 me-1.5" />
              )}
              {ar ? "تطبيق الدور الجماعي" : "Apply Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
