import { format } from "date-fns";
import { History } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  room: any | null;
  onClose: () => void;
  assignments: any[];
  employees: any[];
};

export function RoomLogDialog({ room, onClose, assignments, employees }: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  if (!room) return null;

  const empMap = Object.fromEntries((employees ?? []).map((e) => [e.id, e]));
  const roomHistory = (assignments ?? [])
    .filter((a) => a.roomId === room.id)
    .sort(
      (a, b) =>
        new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime(),
    );

  return (
    <Dialog open={!!room} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        srTitle={ar ? "سجل الغرفة" : "Room Log"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            {ar ? "سجل الغرفة" : "Room Log"} — {room.roomNumber}
          </DialogTitle>
        </DialogHeader>
        {!roomHistory.length ? (
          <p className="text-center py-8 text-muted-foreground">
            {ar ? "لا يوجد سجل" : "No history yet"}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>{ar ? "الموظف" : "Employee"}</TableHead>
                <TableHead>{ar ? "الكود" : "Code"}</TableHead>
                <TableHead>{ar ? "السرير" : "Bed"}</TableHead>
                <TableHead>{ar ? "الدخول" : "Check-in"}</TableHead>
                <TableHead>{ar ? "الخروج" : "Check-out"}</TableHead>
                <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                <TableHead>{ar ? "ملاحظات" : "Notes"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomHistory.map((a) => {
                const emp = empMap[a.employeeId];
                const checkOut =
                  a.checkOutDate || (a as any).actualCheckOutDate;
                const statusColors: Record<string, string> = {
                  ACTIVE: "bg-green-100 text-green-700",
                  ENDED: "bg-gray-100 text-gray-600",
                  TRANSFERRED: "bg-blue-100 text-blue-700",
                };
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {emp
                        ? `${emp.firstName} ${emp.lastName}`
                        : `#${a.employeeId}`}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {emp?.employeeId ?? "—"}
                    </TableCell>
                    <TableCell>{a.bedNumber ?? "—"}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(a.checkInDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {checkOut
                        ? format(new Date(checkOut), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[a.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {a.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">
                      {a.notes || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
