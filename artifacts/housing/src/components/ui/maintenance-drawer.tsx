import { X, MessageSquare, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface MaintenanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ticket?: any;
  employees?: any[];
  ar?: boolean;
  onStatusChange?: (status: string) => void;
  onAssignChange?: (empId: number | null) => void;
}

export default function MaintenanceDrawer({
  isOpen,
  onClose,
  ticket,
  employees = [],
  ar = false,
  onStatusChange,
  onAssignChange,
}: MaintenanceDrawerProps) {
  if (!isOpen || !ticket) return null;

  const empMap = Object.fromEntries(
    employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]),
  );

  const formatDuration = (startedAt: any, resolvedAt: any, reportedAt: any) => {
    const start = reportedAt ?? startedAt;
    if (!start) return "—";
    const startDate = new Date(start);
    const endDate = resolvedAt ? new Date(resolvedAt) : new Date();
    const totalMins = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60),
    );
    if (totalMins < 1) return "<1m";
    if (totalMins < 60) return `${totalMins}m`;
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity z-40 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 z-50 flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">
            {ar ? "تفاصيل الطلب" : "Request Details"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Details Section */}
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                {ar ? "التفاصيل" : "Details"}
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "رقم الطلب" : "Request ID"}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {ticket.id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "الحالة" : "Status"}
                  </p>
                  <div className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                    {ticket.status?.replace("_", " ")}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "الأولوية" : "Priority"}
                  </p>
                  <div className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                    {ticket.priority}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "الغرفة" : "Room"}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    Room {ticket.roomId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "النوع" : "Type"}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {ticket.category}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "الوصف" : "Description"}
                  </p>
                  <p className="text-sm text-gray-700">{ticket.description}</p>
                </div>
              </div>
            </div>

            {/* Tasks/Actions Section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                {ar ? "الإجراءات" : "Actions"}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    {ar ? "التعيين إلى" : "Assign To"}
                  </label>
                  <Select
                    value={ticket.assignedTo ? String(ticket.assignedTo) : ""}
                    onValueChange={(v) => {
                      const empId = v ? parseInt(v) : null;
                      onAssignChange?.(empId);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={ar ? "اختر..." : "Select..."} />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className="max-h-48 overflow-y-auto"
                    >
                      <SelectItem value="unassigned">
                        — {ar ? "غير مسند" : "Unassigned"} —
                      </SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.firstName} {e.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    {ar ? "تغيير الحالة" : "Change Status"}
                  </label>
                  <Select
                    value={ticket.status || ""}
                    onValueChange={(status) => onStatusChange?.(status)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">
                        {ar ? "مفتوح" : "Open"}
                      </SelectItem>
                      <SelectItem value="in_progress">
                        {ar ? "قيد التنفيذ" : "In Progress"}
                      </SelectItem>
                      <SelectItem value="resolved">
                        {ar ? "محلول" : "Resolved"}
                      </SelectItem>
                      <SelectItem value="closed">
                        {ar ? "مغلق" : "Closed"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full h-8 text-xs gap-2" variant="outline">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {ar ? "إضافة تعليق" : "Add Comment"}
                </Button>
              </div>
            </div>

            {/* Time Sheet Section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                {ar ? "الوقت" : "Time"}
              </h3>
              <div className="space-y-3 bg-gray-50 p-3 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "تاريخ الإبلاغ" : "Reported"}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {ticket.reportedAt
                      ? format(
                          new Date(ticket.reportedAt),
                          "dd MMM yyyy - HH:mm",
                        )
                      : "—"}
                  </p>
                </div>
                {ticket.startedAt && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      {ar ? "بدأ" : "Started"}
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {format(
                        new Date(ticket.startedAt),
                        "dd MMM yyyy - HH:mm",
                      )}
                    </p>
                  </div>
                )}
                {ticket.resolvedAt && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      {ar ? "تم الحل" : "Resolved"}
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {format(
                        new Date(ticket.resolvedAt),
                        "dd MMM yyyy - HH:mm",
                      )}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "المدة الإجمالية" : "Total Duration"}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDuration(
                      ticket.startedAt,
                      ticket.resolvedAt,
                      ticket.reportedAt,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={onClose}
          >
            {ar ? "إغلاق" : "Close"}
          </Button>
        </div>
      </div>
    </>
  );
}
