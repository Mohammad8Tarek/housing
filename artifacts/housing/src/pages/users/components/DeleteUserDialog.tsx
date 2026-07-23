import { useRef } from "react";
import {
  useDeleteUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { AnimatedConfirmModal } from "@/components/shared/AnimatedConfirmModal";
import { toast } from "sonner";

interface DeleteUserDialogProps {
  user: any;
  onClose: () => void;
}

export function DeleteUserDialog({ user, onClose }: DeleteUserDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const deleting = useRef(false);

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success(ar ? "تم حذف المستخدم" : "User deleted");
        onClose();
      },
      onError: (e: any) =>
        toast.error(e.message || (ar ? "فشل حذف المستخدم" : "Failed to delete user")),
    },
  });

  return (
    <AnimatedConfirmModal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={ar ? "حذف المستخدم" : "Delete User"}
      description={ar
        ? `هل أنت متأكد من حذف المستخدم "${user?.username}"؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Are you sure you want to delete "${user?.username}"? This cannot be undone.`
      }
      confirmLabel={deleteMutation.isPending ? (ar ? "جاري الحذف..." : "Deleting...") : (ar ? "حذف" : "Delete")}
      cancelLabel={ar ? "إلغاء" : "Cancel"}
      variant="destructive"
      isLoading={deleteMutation.isPending}
      onConfirm={() => {
        if (deleting.current) return;
        deleting.current = true;
        deleteMutation.mutate({ id: user.id });
      }}
    />
  );
}
