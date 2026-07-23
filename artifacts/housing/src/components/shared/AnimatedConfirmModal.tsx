import * as React from "react";
import {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

interface AnimatedConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  isLoading?: boolean;
}

export function AnimatedConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  isLoading = false,
}: AnimatedConfirmModalProps) {
  const reducedMotion = usePrefersReducedMotion();

  // Distinct color logic
  const actionColor = variant === "destructive" 
    ? "bg-red-600 hover:bg-red-700 text-white" 
    : "bg-[#2AB5B5] hover:bg-[#239999] text-white";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <AlertDialogPortal forceMount>
            <AlertDialogOverlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.15 }}
              />
            </AlertDialogOverlay>
            <AlertDialogContent asChild forceMount>
              <motion.div
                role="alertdialog"
                aria-modal="true"
                className="fixed left-[50%] top-[50%] z-50 flex flex-col w-full max-w-lg translate-x-[-50%] translate-y-[-50%] max-h-[90vh] overflow-hidden border bg-background shadow-2xl sm:rounded-xl p-6"
                initial={{ opacity: 0, scale: 0.96, y: "-48%" }}
                animate={{ opacity: 1, scale: 1, y: "-50%" }}
                exit={{ opacity: 0, scale: 0.96, y: "-48%" }}
                transition={{ duration: reducedMotion ? 0 : 0.18, ease: "easeOut" }}
              >
                <AlertDialogHeader className="text-center sm:text-left mb-4">
                  <AlertDialogTitle className="text-lg font-bold">
                    {title}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-muted-foreground mt-2">
                    {description}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t border-border mt-4">
                  <AlertDialogCancel
                    onClick={() => onOpenChange(false)}
                    disabled={isLoading}
                  >
                    {cancelLabel}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className={cn(actionColor, "ml-0 sm:ml-2 mt-2 sm:mt-0")}
                    onClick={(e) => {
                      e.preventDefault();
                      onConfirm();
                      onOpenChange(false);
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? "Loading..." : confirmLabel}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </motion.div>
            </AlertDialogContent>
          </AlertDialogPortal>
        )}
      </AnimatePresence>
    </AlertDialog>
  );
}
