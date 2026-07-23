import { useRef } from "react";
import { getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { AnimatedConfirmModal } from "@/components/shared/AnimatedConfirmModal";
import { toast } from "sonner";

interface UnlockUserDialogProps {
  user: any;
  onClose: () => void;
}

export function UnlockUserDialog({ user, onClose }: UnlockUserDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const unlocking = useRef(false);

  const handleUnlock = async () => {
    if (unlocking.current) return;
    unlocking.current = true;
    try {
      const res = await fetch("/api/users/" + user.id + "/unlock", {
        method: "POST",
      });
      if (!res.ok)
        throw new Error((await res.json()).error || "Failed to unlock");
      toast.success(ar ? "تم فتح قفل الحساب بنجاح" : "Account unlocked successfully");
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      onClose();
    } catch (e: any) {
      toast.error(e.message || (ar ? "فشل فتح القفل" : "Failed to unlock"));
    }
  };

  return (
    <AnimatedConfirmModal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={ar ? "فتح قفل الحساب" : "Unlock Account"}
      description={ar
        ? `هل أنت متأكد من فتح قفل حساب "${user.username}"؟ سيتم مسح محاولات تسجيل الدخول الفاشلة وفتح الحساب فوراً.`
        : `Are you sure you want to unlock "${user.username}"? Failed login attempts will be cleared and the account will be unlocked immediately.`
      }
      confirmLabel={ar ? "فتح القفل" : "Unlock"}
      cancelLabel={ar ? "إلغاء" : "Cancel"}
      variant="default"
      onConfirm={handleUnlock}
    />
  );
}
