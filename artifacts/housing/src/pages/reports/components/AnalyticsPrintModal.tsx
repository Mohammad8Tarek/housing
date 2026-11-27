import { useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

export interface AnalyticsPrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full standalone HTML document for the report (built with `embed: true`). */
  html: string;
  ar?: boolean;
}

/**
 * In-app print preview for the Analytics dashboard report.
 *
 * The Analytics report is a rich dashboard (KPIs, charts, cross-tables) and
 * does not fit the tabular ReportPrintStudioModal. Instead of opening a new
 * browser window that auto-prints (which popup blockers can silently block),
 * this renders the exact report document inside an isolated iframe and prints
 * that iframe — the same "preview then print" experience as the other reports,
 * with no new window.
 */
export function AnalyticsPrintModal({
  open,
  onOpenChange,
  html,
  ar = true,
}: AnalyticsPrintModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        srTitle={ar ? "معاينة تقرير التحليلات" : "Analytics report preview"}
        className="max-w-5xl w-[95vw]"
        dir={ar ? "rtl" : "ltr"}
      >
        <div className="flex flex-col gap-3">
          {/* Toolbar (pe-8 keeps the dialog's built-in close X from overlapping) */}
          <div className="flex items-center justify-between gap-3 pe-8">
            <span className="text-sm font-bold text-foreground">
              {ar ? "معاينة التقرير قبل الطباعة" : "Report Print Preview"}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handlePrint} className="h-8 gap-1.5">
                <Printer className="w-4 h-4" />
                {ar ? "طباعة / حفظ PDF" : "Print / Save PDF"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-8 gap-1.5"
              >
                <X className="w-4 h-4" />
                {ar ? "إغلاق" : "Close"}
              </Button>
            </div>
          </div>

          {/* Isolated report preview — explicit height (the dialog wraps
              children in a non-flex container, so flex-1 would collapse). */}
          <iframe
            ref={iframeRef}
            title={ar ? "معاينة التقرير" : "Report preview"}
            srcDoc={html}
            className="w-full h-[74vh] rounded-lg border bg-white"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
