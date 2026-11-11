import { Dialog, DialogContent } from "@/components/ui/dialog";

interface TicketPhotoLightboxProps {
  ar: boolean;
  photoUrl: string | null;
  onClose: () => void;
}

export function TicketPhotoLightbox({
  ar,
  photoUrl,
  onClose,
}: TicketPhotoLightboxProps) {
  return (
    <Dialog
      open={!!photoUrl}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-screen overflow-y-auto p-2"
        srTitle={ar ? "عرض الصورة" : "View Photo"}
      >
        {photoUrl && (
          <img
            src={photoUrl}
            alt=""
            className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
