// Users list: bulk action bar.
import { Button } from "@/components/ui/button";
import { Trash, Shield, KeyRound, Building2 } from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import type { UsersPageState } from "./useUsersPageState";

export function renderUsersBulkBar(s: UsersPageState) {
  const { isSuperAdmin, ar, selectedRows, setSelectedRows, setBulkRoleModalOpen, setBulkPropModalOpen, setSelectedBulkProps, isBulkExecuting, exportUserExcel, handleBulkUnlock, bulkDeleteUserMutation } = s;
  return (
<BulkActionBar
        count={selectedRows.size}
        onClear={() => setSelectedRows(new Set())}
        onExportExcel={exportUserExcel}
        ar={ar}
        extraActions={
          <div className="flex items-center gap-2 flex-wrap">
            <PermissionGate module="users" action="edit">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkRoleModalOpen(true)}
                className="gap-1.5 h-8 text-xs font-semibold bg-background border-border/80 hover:bg-muted"
              >
                <Shield className="w-3.5 h-3.5 text-[#C9A24D]" />
                {ar ? "تغيير الدور" : "Change Role"}
              </Button>
            </PermissionGate>

            {isSuperAdmin && (
              <PermissionGate module="users" action="edit">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedBulkProps([]);
                    setBulkPropModalOpen(true);
                  }}
                  className="gap-1.5 h-8 text-xs font-semibold bg-background border-border/80 hover:bg-muted"
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  {ar ? "تخصيص الفروع" : "Assign Hotels"}
                </Button>
              </PermissionGate>
            )}

            <PermissionGate module="users" action="edit">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkUnlock}
                disabled={isBulkExecuting}
                className="gap-1.5 h-8 text-xs font-semibold bg-background border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
                {ar ? "فك القفل" : "Unlock"}
              </Button>
            </PermissionGate>

            <PermissionGate module="settings" action="delete">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      ar
                        ? `هل أنت متأكد من حذف ${selectedRows.size} مستخدم محدد؟`
                        : `Are you sure you want to delete ${selectedRows.size} selected users?`
                    )
                  ) {
                    selectedRows.forEach((id) =>
                      bulkDeleteUserMutation.mutate({ id })
                    );
                    setSelectedRows(new Set());
                  }
                }}
                className="gap-1.5 h-8 text-xs font-semibold"
              >
                <Trash className="w-3.5 h-3.5" />
                {ar ? "حذف المحدد" : "Delete Selected"}
              </Button>
            </PermissionGate>
          </div>
        }
      />
  );
}
