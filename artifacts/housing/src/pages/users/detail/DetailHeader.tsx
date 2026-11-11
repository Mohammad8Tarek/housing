// User detail: page header and actions.
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Unlock,
  Trash2,
  RefreshCw,
} from "lucide-react";
import type { UserDetailPageState } from "./useUserDetailPageState";

export function renderDetailHeader(s: UserDetailPageState) {
  const {
    setLocation,
    ar,
    currentUser,
    can,
    buildNavHref,
    user,
    isUnlocking,
    setDeleteConfirmOpen,
    isLocked,
    handleInstantUnlock,
    updateMutation,
    handleSaveAll,
  } = s;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation(buildNavHref("/users"))}
        className="text-muted-foreground hover:text-foreground -ms-2"
      >
        {ar ? (
          <ArrowRight className="w-4 h-4 ms-1" />
        ) : (
          <ArrowLeft className="w-4 h-4 me-1" />
        )}
        <span>{ar ? "العودة لقائمة المستخدمين" : "Back to Users"}</span>
      </Button>

      <div className="flex items-center gap-2">
        {isLocked && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleInstantUnlock}
            disabled={isUnlocking}
            className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
          >
            {isUnlocking ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin me-1.5" />
            ) : (
              <Unlock className="w-3.5 h-3.5 me-1.5" />
            )}
            {ar ? "فتح قفل الحساب" : "Unlock Account"}
          </Button>
        )}

        {can("users", "delete") && user.username !== currentUser?.username && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteConfirmOpen(true)}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-900/40 dark:hover:bg-red-950/30"
          >
            <Trash2 className="w-3.5 h-3.5 me-1.5" />
            {ar ? "حذف الحساب" : "Delete"}
          </Button>
        )}

        <Button
          size="sm"
          onClick={handleSaveAll}
          disabled={updateMutation.isPending}
          className="bg-[#0F2A44] hover:bg-[#18426a] text-white shadow-sm"
        >
          {updateMutation.isPending ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin me-1.5" />
          ) : (
            <Save className="w-3.5 h-3.5 me-1.5" />
          )}
          {ar ? "حفظ التغييرات" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
