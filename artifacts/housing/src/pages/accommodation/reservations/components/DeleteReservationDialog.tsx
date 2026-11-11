import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Setter } from "../types";

interface DeleteReservationDialogProps {
  ar: boolean;
  deleteId: number | null;
  setDeleteId: Setter<number | null>;
  deleteMutation: { mutate: (vars: { id: number }) => void };
}

export function DeleteReservationDialog({
  ar,
  deleteId,
  setDeleteId,
  deleteMutation,
}: DeleteReservationDialogProps) {
  return (
    <AlertDialog
      open={deleteId !== null}
      onOpenChange={(o) => !o && setDeleteId(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{ar ? "حذف الحجز؟" : "Delete?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {ar ? "لا يمكن التراجع عن هذا الإجراء." : "This cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
          >
            {ar ? "حذف" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
