// Legend / summary footer.
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { PermissionMatrixCenterState, PermissionMatrixCenterView } from "./usePermissionMatrixCenterState";

export function renderMatrixLegend(s: PermissionMatrixCenterState, v: PermissionMatrixCenterView) {
  const { ar, perms, hasChanges, updateMutation, resetToStored, save, totalPossible, diffStats } = s;
  const { activeUser } = v;
  return (
<div className="sticky bottom-4 z-20 p-4 rounded-3xl bg-card/95 backdrop-blur-md border shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C9A24D]/10 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-[#C9A24D]" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>
                  {ar
                    ? `حفظ مصفوفة صلاحيات: ${activeUser.username}`
                    : `Save Permissions for ${activeUser.username}`}
                </span>
                {diffStats.customGranted > 0 && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] py-0 px-1.5 font-bold">
                    +{diffStats.customGranted} {ar ? "مخصص" : "custom"}
                  </Badge>
                )}
                {diffStats.revoked > 0 && (
                  <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] py-0 px-1.5 font-bold">
                    -{diffStats.revoked} {ar ? "ملغي" : "revoked"}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {perms.size} {ar ? "صلاحية نشطة من أصل" : "active permissions out of"} {totalPossible} (
                {Math.round((perms.size / totalPossible) * 100)}%)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {hasChanges && (
              <Button variant="ghost" size="sm" onClick={resetToStored}>
                {ar ? "تراجع" : "Cancel"}
              </Button>
            )}
            <Button
              onClick={save}
              disabled={updateMutation.isPending}
              className="bg-gradient-to-r from-[#0F2A44] via-slate-900 to-[#0F2A44] hover:opacity-95 text-white font-bold gap-2 shadow-lg min-w-[200px] h-11 rounded-2xl"
            >
              <ShieldCheck className="w-4 h-4 text-[#C9A24D]" />
              {updateMutation.isPending
                ? ar
                  ? "جاري حفظ الصلاحيات..."
                  : "Saving..."
                : ar
                ? "تأكيد وحفظ الصلاحيات"
                : "Confirm & Save Permissions"}
            </Button>
          </div>
        </div>
  );
}
