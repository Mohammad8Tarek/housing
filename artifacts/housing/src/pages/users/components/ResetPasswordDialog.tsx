import { useState } from "react";
import {
  useUpdateUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";

interface ResetPasswordDialogProps {
  user: any;
  onClose: () => void;
}

export function ResetPasswordDialog({
  user,
  onClose,
}: ResetPasswordDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  const [newPassword, setNewPassword] = useState("");

  const resetPasswordMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success(
          ar
            ? "تمت إعادة تعيين كلمة المرور بنجاح"
            : "Password reset successfully",
        );
        onClose();
      },
      onError: (e: any) =>
        toast.error(
          e.message ||
            (ar ? "فشل إعادة تعيين كلمة المرور" : "Failed to reset password"),
        ),
    },
  });

  const handleResetPassword = () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error(
        ar
          ? "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل"
          : "Password must be at least 6 characters",
      );
      return;
    }
    resetPasswordMutation.mutate({
      id: user.id,
      data: { password: newPassword } as any,
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-sm"
        srTitle={ar ? "إعادة تعيين كلمة المرور" : "Reset Password"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-500" />
            {ar ? "إعادة تعيين كلمة المرور" : "Reset Password"} —{" "}
            <span className="font-mono">{user.username}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>
              {ar ? "كلمة المرور الجديدة" : "New Password"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              type="password"
              placeholder={ar ? "الحد الأدنى 6 أحرف" : "Minimum 6 characters"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="off"
              onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
            />
            <p className="text-xs text-muted-foreground">
              {ar
                ? "سيحتاج المستخدم إلى استخدام كلمة المرور الجديدة لتسجيل الدخول."
                : "The user will need to use this new password to sign in."}
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetPasswordMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {resetPasswordMutation.isPending
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? "إعادة تعيين كلمة المرور"
                  : "Reset Password"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
