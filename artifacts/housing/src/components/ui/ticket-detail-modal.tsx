// @ts-nocheck
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import {
  Play,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  AlertTriangle,
  MessageSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Handshake,
  ChevronDown,
  ChevronRight,
  X,
  Eye,
  FileText,
  Wrench,
  Loader2,
} from "lucide-react";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface TicketDetailModalProps {
  open: boolean;
  onClose: () => void;
  ticket: any;
  employees: any[];
  ar: boolean;
  onStatusChange: (id: number, data: any) => void;
  onAssignChange: (id: number, empId: number | null) => void;
  onCreateSubTicket?: (parentId: number, data: any) => void;
  subTickets?: any[];
  loadingSubTickets?: boolean;
}

const STATUS_AR: Record<string, string> = {
  open: "مفتوحة",
  in_progress: "قيد التنفيذ",
  resolved: "محلولة",
  closed: "مغلقة",
};
const PRIORITY_AR: Record<string, string> = {
  LOW: "منخفضة",
  MEDIUM: "متوسطة",
  HIGH: "عالية",
  URGENT: "عاجلة",
};
const CATEGORY_AR = {
  maintenance: "صيانة",
  housekeeping: "هاوس كيبنج",
  general: "عام",
};

function statusColor(s: string) {
  switch ((s || "").toLowerCase()) {
    case "open":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "in_progress":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
    case "resolved":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "closed":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function priorityColor(p: string) {
  switch ((p || "").toLowerCase()) {
    case "urgent":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function formatDuration(startedAt: any, resolvedAt: any, reportedAt: any) {
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

function timeColor(diff: number) {
  if (diff < 21) return "bg-gray-200 text-gray-700";
  if (diff < 31) return "bg-blue-100 text-blue-700";
  if (diff < 41) return "bg-yellow-100 text-yellow-700";
  if (diff < 51) return "bg-orange-100 text-orange-700";
  if (diff < 61) return "bg-red-100 text-red-700";
  return "bg-gray-800 text-white";
}

export default function TicketDetailModal({
  open,
  onClose,
  ticket,
  employees = [],
  ar,
  onStatusChange,
  onAssignChange,
  onCreateSubTicket,
  subTickets = [],
  loadingSubTickets = false,
}: TicketDetailModalProps) {
  const [activeTab, setActiveTab] = useState<
    "details" | "tasks" | "comments" | "attachments"
  >("details");
  const [commentText, setCommentText] = useState("");
  const [showSubTicketForm, setShowSubTicketForm] = useState(false);
  const [subTicketForm, setSubTicketForm] = useState({
    problemType: "",
    description: "",
    priority: "MEDIUM",
  });
  const [creatingSub, setCreatingSub] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  if (!ticket) return null;

  const empMap = Object.fromEntries(
    employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]),
  );

  const reportedDate = ticket.reportedAt
    ? format(new Date(ticket.reportedAt), "dd MMM yyyy")
    : "—";
  const reportedTime = ticket.reportedAt
    ? format(new Date(ticket.reportedAt), "HH:mm")
    : "—";
  const startedDate = ticket.startedAt
    ? format(new Date(ticket.startedAt), "dd MMM yyyy")
    : null;
  const startedTime = ticket.startedAt
    ? format(new Date(ticket.startedAt), "HH:mm")
    : null;
  const resolvedDate = ticket.resolvedAt
    ? format(new Date(ticket.resolvedAt), "dd MMM yyyy")
    : null;
  const resolvedTime = ticket.resolvedAt
    ? format(new Date(ticket.resolvedAt), "HH:mm")
    : null;

  const timeToAssign =
    ticket.startedAt && ticket.reportedAt
      ? formatDuration(ticket.reportedAt, ticket.startedAt, null)
      : "—";
  const workingTime = ticket.startedAt
    ? formatDuration(ticket.startedAt, ticket.resolvedAt, null)
    : "—";
  const totalTime = formatDuration(
    ticket.startedAt,
    ticket.resolvedAt,
    ticket.reportedAt,
  );

  const status = (ticket.status || "").toLowerCase();
  const canStart = status === "open";
  const canResolve = status === "in_progress";
  const canDone = status === "resolved";
  const canReopen = status !== "open" && status !== "closed";

  const tabs = [
    { key: "details" as const, label: ar ? "التفاصيل" : "Details", icon: Eye },
    { key: "tasks" as const, label: ar ? "المهام" : "Tasks", icon: Wrench },
    {
      key: "comments" as const,
      label: ar ? "التعليقات" : "Comments",
      icon: MessageSquare,
    },
    {
      key: "attachments" as const,
      label: ar ? "المرفقات" : "Attachments",
      icon: Paperclip,
    },
  ];

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) onClose();
        }}
      >
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto p-0"
          srTitle={ar ? "تفاصيل التذكرة" : "Ticket Details"}
        >
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl font-bold">
                  {ar ? "تذكرة #" : "Ticket #"}
                  {ticket.id}
                </DialogTitle>
                <Badge className={`${statusColor(ticket.status)} text-xs`}>
                  {ar
                    ? (STATUS_AR[ticket.status?.toLowerCase()] ?? ticket.status)
                    : ticket.status?.replace("_", " ")}
                </Badge>
                <Badge className={`${priorityColor(ticket.priority)} text-xs`}>
                  {ar
                    ? (PRIORITY_AR[ticket.priority?.toUpperCase()] ??
                      PRIORITY_AR[ticket.priority] ??
                      ticket.priority)
                    : ticket.priority
                      ? ticket.priority.charAt(0).toUpperCase() +
                        ticket.priority.slice(1).toLowerCase()
                      : ticket.priority}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Tabs */}
          <div className="px-6 border-b">
            <div className="flex gap-4">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as "details" | "comments" | "activity")}
                  className={`px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === tab.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <tab.icon />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {activeTab === "details" && (
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - Details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                    {ar ? "معلومات التذكرة" : "Ticket Information"}
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {ar ? "الاسم" : "Name"}
                        </p>
                        <p className="text-sm font-medium">
                          {ticket.problemType || ticket.category}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {ar ? "الوصف" : "Description"}
                        </p>
                        <p className="text-sm">{ticket.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {ar ? "تاريخ الإبلاغ" : "Reported"}
                        </p>
                        <p className="text-sm font-medium">
                          {reportedDate}{" "}
                          <span className="text-muted-foreground">
                            {reportedTime}
                          </span>
                        </p>
                      </div>
                    </div>
                    {startedDate && (
                      <div className="flex items-center gap-3">
                        <Play className="w-4 h-4 text-purple-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {ar ? "بدأ" : "Started"}
                          </p>
                          <p className="text-sm font-medium">
                            {startedDate}{" "}
                            <span className="text-muted-foreground">
                              {startedTime}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                    {resolvedDate && (
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {ar ? "تم الحل" : "Resolved"}
                          </p>
                          <p className="text-sm font-medium">
                            {resolvedDate}{" "}
                            <span className="text-muted-foreground">
                              {resolvedTime}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Actions & Time */}
                <div className="space-y-6">
                  {/* Actions */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                      {ar ? "الإجراءات" : "Actions"}
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">
                          {ar ? "تعيين إلى" : "Assign To"}
                        </Label>
                        <Select
                          value={
                            ticket.assignedTo ? String(ticket.assignedTo) : ""
                          }
                          onValueChange={(v) =>
                            onAssignChange(ticket.id, v ? parseInt(v) : null)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs mt-1">
                            <SelectValue
                              placeholder={ar ? "اختر..." : "Select..."}
                            />
                          </SelectTrigger>
                          <SelectContent className="max-h-48 overflow-y-auto">
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
                      <div className="flex flex-wrap gap-2">
                        {canStart && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              onStatusChange(ticket.id, {
                                status: "in_progress",
                                startedAt: new Date().toISOString(),
                              })
                            }
                          >
                            <Play className="w-3 h-3 mr-1" />
                            {ar ? "بدء" : "Start"}
                          </Button>
                        )}
                        {canResolve && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() =>
                              onStatusChange(ticket.id, {
                                status: "resolved",
                                resolvedAt: new Date().toISOString(),
                              })
                            }
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {ar ? "حل" : "Resolve"}
                          </Button>
                        )}
                        {canDone && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() =>
                              onStatusChange(ticket.id, { status: "closed" })
                            }
                          >
                            <Handshake className="w-3 h-3 mr-1" />
                            {ar ? "تم" : "Done"}
                          </Button>
                        )}
                        {canReopen && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                            onClick={() =>
                              onStatusChange(ticket.id, { status: "open" })
                            }
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            {ar ? "إعادة فتح" : "Re-open"}
                          </Button>
                        )}
                        {onCreateSubTicket && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setActiveTab("tasks");
                              setShowSubTicketForm(true);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {ar ? "تذكرة فرعية" : "Sub Ticket"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Time Sheet */}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                      {ar ? "الوقت" : "Time Sheet"}
                    </h3>
                    <div className="space-y-2 bg-muted/30 p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                          {ar ? "وقت الإبلاغ" : "Reported"}
                        </span>
                        <span className="text-sm font-medium">
                          {reportedDate} {reportedTime}
                        </span>
                      </div>
                      {startedDate && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            {ar ? "بدأ" : "Started"}
                          </span>
                          <span className="text-sm font-medium">
                            {startedDate} {startedTime}
                          </span>
                        </div>
                      )}
                      {resolvedDate && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            {ar ? "وقت الحل" : "Resolved"}
                          </span>
                          <span className="text-sm font-medium">
                            {resolvedDate} {resolvedTime}
                          </span>
                        </div>
                      )}
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            {ar ? "المدة الإجمالية" : "Total Duration"}
                          </span>
                          <span
                            className={`text-sm font-semibold px-2 py-0.5 rounded ${ticket.startedAt || ticket.reportedAt ? timeColor(differenceInMinutes(new Date(), new Date(ticket.startedAt || ticket.reportedAt))) : "bg-gray-200 text-gray-700"}`}
                          >
                            {totalTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tasks" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                    {ar ? "التذاكر الفرعية" : "Sub-Tickets"}
                    {subTickets.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {subTickets.length}
                      </Badge>
                    )}
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setShowSubTicketForm(!showSubTicketForm)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {ar ? "إضافة تذكرة فرعية" : "Add Sub-Ticket"}
                  </Button>
                </div>

                {showSubTicketForm && (
                  <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                    <h4 className="text-sm font-semibold">
                      {ar ? "تذكرة فرعية جديدة" : "New Sub-Ticket"}
                    </h4>
                    <div>
                      <Label className="text-xs">
                        {ar ? "نوع المشكلة" : "Problem Type"}
                      </Label>
                      <Input
                        value={subTicketForm.problemType}
                        onChange={(e) =>
                          setSubTicketForm((f) => ({
                            ...f,
                            problemType: e.target.value,
                          }))
                        }
                        placeholder={ar ? "مثال: سباكة" : "e.g. Plumbing"}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">
                        {ar ? "الوصف" : "Description"}
                      </Label>
                      <Textarea
                        value={subTicketForm.description}
                        onChange={(e) =>
                          setSubTicketForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        placeholder={
                          ar ? "صف المشكلة..." : "Describe the issue..."
                        }
                        rows={2}
                        className="text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">
                        {ar ? "الأولوية" : "Priority"}
                      </Label>
                      <Select
                        value={subTicketForm.priority}
                        onValueChange={(v) =>
                          setSubTicketForm((f) => ({ ...f, priority: v }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">
                            {ar ? "منخفضة" : "Low"}
                          </SelectItem>
                          <SelectItem value="MEDIUM">
                            {ar ? "متوسطة" : "Medium"}
                          </SelectItem>
                          <SelectItem value="HIGH">
                            {ar ? "عالية" : "High"}
                          </SelectItem>
                          <SelectItem value="URGENT">
                            {ar ? "عاجلة" : "Urgent"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setShowSubTicketForm(false)}
                      >
                        {ar ? "إلغاء" : "Cancel"}
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={
                          creatingSub ||
                          !subTicketForm.problemType ||
                          !subTicketForm.description
                        }
                        onClick={() => {
                          setCreatingSub(true);
                          onCreateSubTicket?.(ticket.id, subTicketForm);
                          setTimeout(() => {
                            setCreatingSub(false);
                            setShowSubTicketForm(false);
                            setSubTicketForm({
                              problemType: "",
                              description: "",
                              priority: "MEDIUM",
                            });
                          }, 1000);
                        }}
                      >
                        {creatingSub ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Plus className="w-3 h-3 mr-1" />
                        )}
                        {ar ? "إنشاء" : "Create"}
                      </Button>
                    </div>
                  </div>
                )}

                {loadingSubTickets ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  </div>
                ) : subTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      {ar ? "لا توجد تذاكر فرعية" : "No sub-tickets yet"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {subTickets.map((st) => (
                      <div
                        key={st.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{st.id}
                          </span>
                          <div>
                            <p className="text-sm font-medium">
                              {st.problemType}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {st.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`${statusColor(st.status)} text-[10px]`}
                          >
                            {ar
                              ? (STATUS_AR[st.status?.toLowerCase()] ??
                                st.status)
                              : st.status?.replace("_", " ")}
                          </Badge>
                          <Badge
                            className={`${priorityColor(st.priority)} text-[10px]`}
                          >
                            {ar
                              ? (PRIORITY_AR[st.priority] ?? st.priority)
                              : st.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "comments" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                  {ar ? "التعليقات" : "Comments"}
                </h3>
                <div className="space-y-3">
                  <Textarea
                    placeholder={ar ? "أضف تعليقاً..." : "Add a comment..."}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                  />
                  <Button size="sm" className="h-7 text-xs">
                    <MessageSquare className="w-3 h-3 mr-1" />
                    {ar ? "إرسال" : "Send"}
                  </Button>
                </div>
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {ar ? "لا توجد تعليقات بعد" : "No comments yet"}
                  </p>
                </div>
              </div>
            )}

            {activeTab === "attachments" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                  {ar ? "المرفقات" : "Attachments"}
                </h3>
                {ticket.photoUrl ? (
                  <div className="space-y-3">
                    
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      {ar ? "لا توجد مرفقات" : "No attachments"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
  );
}
