import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function PrintLanguageDialog({
  open,
  onSelect,
  onCancel,
}: {
  open: boolean;
  onSelect: (isArabic: boolean) => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent
        className="max-w-xs"
        srTitle="Choose language / اختر اللغة"
      >
        <DialogHeader>
          <DialogTitle className="text-base">
            Choose Language / اختر اللغة
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">
          Choose the PDF language / اختر لغة التقرير
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => onSelect(false)}>
            English
          </Button>
          <Button onClick={() => onSelect(true)}>العربية</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function usePrintLanguage() {
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((ar: boolean) => void) | null>(null);

  const openDialog = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOpen(true);
    });
  }, []);

  const handleSelect = useCallback((isArabic: boolean) => {
    resolveRef.current?.(isArabic);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  return { langDialogOpen: open, openDialog, handleSelect, handleCancel };
}
