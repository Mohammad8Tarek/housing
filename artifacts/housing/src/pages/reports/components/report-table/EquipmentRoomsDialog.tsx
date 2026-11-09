// Drill-down dialog: every room holding a given inventory item (equipment_inventory report).
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PackageCheck } from "lucide-react";

export function EquipmentRoomsDialog({
  item,
  onClose,
  ar,
}: {
  item: any | null;
  onClose: () => void;
  ar: boolean;
}) {
  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
        dir={ar ? "rtl" : "ltr"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <PackageCheck className="w-5 h-5 text-cyan-600" />
            <span>{item?.itemName}</span>
            <Badge
              variant="secondary"
              className="capitalize text-xs font-semibold"
            >
              {item?.category}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {ar
              ? `إجمالي الكمية المسجلة: ${item?.totalQuantity || 0} قطعة موزعة على ${item?.roomsCount || 0} غرفة بالسكن`
              : `Total quantity: ${item?.totalQuantity || 0} units across ${item?.roomsCount || 0} rooms in housing`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* Condition Stats Banner */}
          <div className="grid grid-cols-4 gap-2 p-2.5 rounded-lg bg-muted/30 border text-center text-xs">
            <div>
              <div className="text-muted-foreground text-[10px]">
                {ar ? "إجمالي الكمية" : "Total"}
              </div>
              <div className="font-bold text-sm text-foreground">
                {item?.totalQuantity || 0}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">
                {ar ? "سليم / ممتاز" : "Good"}
              </div>
              <div className="font-bold text-sm text-emerald-600">
                {item?.goodCount || 0}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">
                {ar ? "بحاجة لصيانة" : "Needs Repair"}
              </div>
              <div className="font-bold text-sm text-amber-600">
                {item?.needsRepairCount || 0}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">
                {ar ? "تالف / مفقود" : "Damaged / Missing"}
              </div>
              <div className="font-bold text-sm text-rose-600">
                {(item?.damagedCount || 0) + (item?.missingCount || 0)}
              </div>
            </div>
          </div>

          {/* Rooms List Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-bold">
                    {ar ? "الغرفة" : "Room"}
                  </TableHead>
                  <TableHead className="text-xs font-bold">
                    {ar ? "المبنى والطابق" : "Building & Floor"}
                  </TableHead>
                  <TableHead className="text-xs font-bold text-center">
                    {ar ? "الكمية" : "Qty"}
                  </TableHead>
                  <TableHead className="text-xs font-bold">
                    {ar ? "الحالة" : "Condition"}
                  </TableHead>
                  <TableHead className="text-xs font-bold">
                    {ar ? "السيريال / الكود" : "Serial / Tag"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item?.roomsList?.map((rm: any, rmIdx: number) => (
                  <TableRow key={rmIdx} className="text-xs hover:bg-muted/30">
                    <TableCell className="font-semibold text-foreground">
                      {ar ? "غرفة" : "Room"} {rm.roomNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rm.buildingName} • {rm.floorName || rm.floorNumber}
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {rm.quantity || 1}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          rm.condition === "good"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold"
                            : rm.condition === "fair"
                              ? "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                              : rm.condition === "needs_repair"
                                ? "bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold"
                                : "bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold"
                        }
                      >
                        {ar
                          ? rm.condition === "good"
                            ? "ممتاز"
                            : rm.condition === "fair"
                              ? "مقبول"
                              : rm.condition === "needs_repair"
                                ? "صيانة"
                                : rm.condition === "damaged"
                                  ? "تالف"
                                  : "مفقود"
                          : rm.condition}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {rm.serialNumber || rm.barcode || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
