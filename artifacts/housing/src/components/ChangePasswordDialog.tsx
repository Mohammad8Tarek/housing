// @ts-nocheck
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { Lock } from "lucide-react";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleSubmit = async () => {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      toast.error(ar ? "يرجى ملء جميع الحقول" : "Please fill all fields");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error(ar ? "كلمات المرور غير متطابقة" : "Passwords do not match");
      return;
    }
    if (form.newPassword.length < 6) {
      toast.error(
        ar
          ? "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل"
          : "Password must be at least 6 characters",
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(
          error.error ||
            (ar ? "فشل تغيير كلمة المرور" : "Failed to change password"),
        );
        return;
      }

      toast.success(
        ar ? "تم تغيير كلمة المرور بنجاح!" : "Password changed successfully!",
      );
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Change password error:", err);
      toast.error(ar ? "خطأ في تغيير كلمة المرور" : "Error changing password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            {ar ? "تغيير كلمة المرور" : "Change Password"}
          </DialogTitle>
          <DialogDescription>
            {ar
              ? "أدخل كلمة المرور الحالية والجديدة"
              : "Enter your current and new password"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current">
              {ar ? "كلمة المرور الحالية" : "Current Password"}
            </Label>
            <Input
              id="current"
              type="password"
              placeholder="••••••••"
              value={form.currentPassword}
              onChange={(e) =>
                setForm((f) => ({ ...f, currentPassword: e.target.value }))
              }
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new">
              {ar ? "كلمة المرور الجديدة" : "New Password"}
            </Label>
            <Input
              id="new"
              type="password"
              placeholder="••••••••"
              value={form.newPassword}
              onChange={(e) =>
                setForm((f) => ({ ...f, newPassword: e.target.value }))
              }
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">
              {ar ? "تأكيد كلمة المرور" : "Confirm Password"}
            </Label>
            <Input
              id="confirm"
              type="password"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={(e) =>
                setForm((f) => ({ ...f, confirmPassword: e.target.value }))
              }
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading
                ? ar
                  ? "جاري التغيير..."
                  : "Changing..."
                : ar
                  ? "تغيير كلمة المرور"
                  : "Change Password"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
