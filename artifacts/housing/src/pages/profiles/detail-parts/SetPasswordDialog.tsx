// Set a new resident portal password.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ProfileDetailState, ProfileDetailView } from "./useProfileDetailState";

export function renderSetPasswordDialog(s: ProfileDetailState, v: ProfileDetailView) {
  const { ar, setPwOpen, setSetPwOpen, pwSaving, pwForm, setPwForm } = s;
  const { setPortalPassword } = v;
  return (
<Dialog
        open={setPwOpen}
        onOpenChange={(o) => {
          setSetPwOpen(o);
          if (!o) setPwForm({ password: "", confirm: "" });
        }}
      >
        <DialogContent
          className="max-w-md"
          srTitle={ar ? "تعيين كلمة مرور جديدة" : "Set New Password"}
        >
          <DialogHeader>
            <DialogTitle>
              {ar ? "تعيين كلمة مرور جديدة" : "Set New Password"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{ar ? "كلمة المرور الجديدة" : "New password"}</Label>
              <Input
                type="password"
                value={pwForm.password}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, password: e.target.value }))
                }
                placeholder={ar ? "6 أحرف على الأقل" : "At least 6 characters"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "تأكيد كلمة المرور" : "Confirm password"}</Label>
              <Input
                type="password"
                value={pwForm.confirm}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, confirm: e.target.value }))
                }
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {ar
                ? "سيتم تعيين كلمة المرور مباشرة دون إجبار تغييرها."
                : "This sets the password directly (no forced change)."}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSetPwOpen(false)}
              disabled={pwSaving}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={setPortalPassword} disabled={pwSaving}>
              {pwSaving
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? "حفظ"
                  : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
