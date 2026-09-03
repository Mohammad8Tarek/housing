// @ts-nocheck
import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import {
  useListMaintenance,
  useUpdateMaintenance,
  useListProfiles,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  MessageSquare,
  CheckCircle2,
  Play,
  Trash,
} from "lucide-react";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import { ImageLightbox } from "@/components/ui/image-lightbox";

const PROBLEM_TYPES_AR = {
  Plumbing: "سباكة",
  Electrical: "كهرباء",
  HVAC: "تكيي�?",
  Furniture: "أثاث",
  Cleaning: "نظا�?ة",
  Internet: "إنترنت",
  Other: "أخرى",
};
const CATEGORIES_AR = {
  maintenance: "صيانة",
  housekeeping: "هاوس كيبنج",
  general: "عام",
};
const PRIORITY_AR = {
  LOW: "منخ�?ضة",
  MEDIUM: "متوسطة",
  HIGH: "عالية",
  URGENT: "عاجلة",
};
const STATUS_AR = {
  open: "م�?توحة",
  in_progress: "قيد التن�?يذ",
  resolved: "محلولة",
  closed: "مغلقة",
};

function formatDuration(startedAt, resolvedAt, reportedAt) {
  const start = reportedAt ?? startedAt;
  if (!start) return "—";
  const startDate = new Date(start);
  const endDate = resolvedAt ? new Date(resolvedAt) : new Date();
  const totalMins = differenceInMinutes(endDate, startDate);
  if (totalMins < 1) return "<1m";
  if (totalMins < 60) return `${totalMins}m`;
  const hrs = differenceInHours(endDate, startDate);
  const mins = totalMins % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export default function MaintenanceDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const goBack = () => window.history.back();
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";

  const [ticket, setTicket] = useState(null);
  const [comment, setComment] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const { data: _allTicketsWrapper } = useListMaintenance({
    query: { enabled: !!activePropertyId },
  });
  const allTickets = _allTicketsWrapper?.data || [];

  const { data: _eDataWrapper } = useListProfiles(
    { propertyId: activePropertyId ?? undefined, limit: 1000 },
    { query: { enabled: !!activePropertyId } },
  );
  const profiles = _eDataWrapper?.profiles || _eDataWrapper?.data || [];

  const updateMutation = useUpdateMaintenance({
    mutation: {
      onSuccess: () => {
        toast.success(ar ? "تم التحديث" : "Updated successfully");
      },
      onError: (e) =>
        toast.error(ar ? "خطأ" : "Error", {
          description: e.message,
        }),
    },
  });

  useEffect(() => {
    if (allTickets) {
      const found = allTickets.find((t) => t.id === parseInt(id));
      setTicket(found);
    }
  }, [allTickets, id]);

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" onClick={() => goBack()} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {ar ? "عودة" : "Back"}
          </Button>
          <div className="text-center text-gray-500">
            {ar ? "جاري التحميل..." : "Loading..."}
          </div>
        </div>
      </div>
    );
  }

  const empOptions = profiles.filter((e) => e.status === "active");
  const priorityColor = (p) => {
    switch ((p || "").toLowerCase()) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const statusColor = (s) => {
    switch ((s || "").toLowerCase()) {
      case "open":
        return "bg-blue-100 text-blue-800";
      case "in_progress":
        return "bg-purple-100 text-purple-800";
      case "resolved":
        return "bg-green-100 text-green-800";
      case "closed":
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => goBack()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {ar ? "عودة" : "Back"}
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">
              {ar ? "تفاصيل الطلب" : "Request Details"} #{ticket.id}
            </h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Photo Section */}
          <div className="col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {ticket.photoUrl ? (
                <img
                  src={ticket.photoUrl}
                  alt="Ticket"
                  className="w-full h-80 object-cover"
                />
              ) : (
                <div className="w-full h-80 bg-gray-100 flex items-center justify-center">
                  <span className="text-gray-400">
                    {ar ? "لا توجد صورة" : "No photo"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Details and Actions */}
          <div className="col-span-2 space-y-6">
            {/* Details Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">
                {ar ? "التفاصيل" : "Details"}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "الحالة" : "Status"}
                  </p>
                  <div
                    className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${statusColor(ticket.status)}`}
                  >
                    {ticket.status?.replace("_", " ")}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "الأولوية" : "Priority"}
                  </p>
                  <div
                    className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${priorityColor(ticket.priority)}`}
                  >
                    {ticket.priority}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "النوع" : "Type"}
                  </p>
                  <p className="text-sm font-medium">
                    {ar ? CATEGORIES_AR[ticket.category] : ticket.category}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "نوع المشكلة" : "Problem Type"}
                  </p>
                  <p className="text-sm font-medium">
                    {ar
                      ? (PROBLEM_TYPES_AR[ticket.problemType] ??
                        ticket.problemType)
                      : ticket.problemType}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "الوصف" : "Description"}
                  </p>
                  <p className="text-sm text-gray-700">{ticket.description}</p>
                </div>
              </div>
            </div>

            {/* Time Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">
                {ar ? "الوقت" : "Time Information"}
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    {ar ? "الإبلاغ عن" : "Reported"}
                  </p>
                  <p className="text-sm font-medium">
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
                    <p className="text-sm font-medium">
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
                    <p className="text-sm font-medium">
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
                  <p className="text-sm font-medium">
                    {formatDuration(
                      ticket.startedAt,
                      ticket.resolvedAt,
                      ticket.reportedAt,
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">
                {ar ? "الإجراءات" : "Actions"}
              </h2>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">
                    {ar ? "التعيين إلى" : "Assign To"}
                  </Label>
                  <Select
                    value={ticket.assignedTo ? String(ticket.assignedTo) : ""}
                    onValueChange={(v) => {
                      const empId = v ? parseInt(v) : null;
                      updateMutation.mutate({
                        id: ticket.id,
                        data: { assignedTo: empId },
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={ar ? "اختر..." : "Select..."} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">
                        — {ar ? "غير مسند" : "Unassigned"} —
                      </SelectItem>
                      {empOptions.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.firstName} {e.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">
                    {ar ? "تغيير الحالة" : "Change Status"}
                  </Label>
                  <Select
                    value={ticket.status || ""}
                    onValueChange={(status) =>
                      updateMutation.mutate({ id: ticket.id, data: { status } })
                    }
                  >
                    <SelectTrigger>
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

                <div>
                  <Label className="text-xs">
                    {ar ? "إضافة ملاحظة" : "Add Note"}
                  </Label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={ar ? "إضافة ملاحظة..." : "Add a note..."}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  {ticket.status?.toLowerCase() === "open" && (
                    <Button
                      onClick={() =>
                        updateMutation.mutate({
                          id: ticket.id,
                          data: {
                            status: "in_progress",
                            startedAt: new Date().toISOString(),
                          },
                        })
                      }
                      className="flex-1"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {ar ? "بدء" : "Start"}
                    </Button>
                  )}
                  {ticket.status?.toLowerCase() === "in_progress" && (
                    <Button
                      onClick={() =>
                        updateMutation.mutate({
                          id: ticket.id,
                          data: {
                            status: "resolved",
                            resolvedAt: new Date().toISOString(),
                          },
                        })
                      }
                      className="flex-1"
                      variant="outline"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {ar ? "حل" : "Resolve"}
                    </Button>
                  )}
                  <Button onClick={() => setComment("")} variant="outline">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    {ar ? "تعليق" : "Comment"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
}
