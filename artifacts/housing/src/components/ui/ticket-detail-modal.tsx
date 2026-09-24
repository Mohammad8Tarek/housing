import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format, differenceInMinutes, differenceInHours, formatDistanceToNow } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";
import { formatDate } from "@/lib/date-utils";
import {
  Play,
  CheckCircle2,
  Clock,
  MessageSquare,
  Paperclip,
  Plus,
  RotateCcw,
  Handshake,
  ChevronDown,
  X,
  Eye,
  FileText,
  Wrench,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Building2,
  Phone,
  Star,
  Layers,
} from "lucide-react";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface TicketDetailModalProps {
  open: boolean;
  onClose: () => void;
  ticket: any;
  occupantName?: string;
  profiles: any[];
  workers?: any[];
  ar: boolean;
  canEdit?: boolean;
  onStatusChange: (id: number, data: any) => void;
  onAssignChange: (id: number, empId: number | null) => void;
  onWorkerAssignChange?: (id: number, workerId: number | null) => void;
  onCreateSubTicket?: (parentId: number, data: any) => void;
  subTickets?: any[];
  loadingSubTickets?: boolean;
}

const STATUS_AR: Record<string, string> = {
  open: "لم تبدأ / مفتوحة",
  in_progress: "قيد التنفيذ",
  resolved: "تم الإنجاز",
  closed: "مغلقة",
};

const STATUS_EN: Record<string, string> = {
  open: "Not Started / Open",
  in_progress: "In Progress",
  resolved: "Order Completed",
  closed: "Closed",
};

const PRIORITY_AR: Record<string, string> = {
  LOW: "منخفضة",
  MEDIUM: "متوسطة",
  HIGH: "عالية",
  URGENT: "عاجلة",
};

const CATEGORIES_AR: Record<string, string> = {
  maintenance: "صيانة فنية",
  housekeeping: "هاوس كيبنج",
  general: "عام",
};

const CATEGORIES_EN: Record<string, string> = {
  maintenance: "Maintenance",
  housekeeping: "Housekeeping",
  general: "General",
};

const PROBLEM_TYPES_MAP: Record<string, { labelEn: string; labelAr: string }> = {
  Plumbing: { labelEn: "Plumbing", labelAr: "سباكة" },
  Electrical: { labelEn: "Electrical", labelAr: "كهرباء" },
  HVAC: { labelEn: "HVAC & AC", labelAr: "تكييف وتبريد" },
  Furniture: { labelEn: "Furniture & Woodwork", labelAr: "أثاث ونجارة" },
  Internet: { labelEn: "Internet & Network", labelAr: "إنترنت وشبكات" },
  Appliances: { labelEn: "Appliances", labelAr: "أجهزة كهربائية" },
  Cleaning: { labelEn: "Cleaning", labelAr: "نظافة" },
  Other: { labelEn: "Other", labelAr: "أعطال أخرى" },
  room_cleaning: { labelEn: "Room Cleaning", labelAr: "تنظيف الغرفة" },
  bed_sheets: { labelEn: "Bed Linen Change", labelAr: "تغيير المفارش" },
  towels: { labelEn: "Towels & Amenities", labelAr: "مستلزمات ومناشف" },
  deep_cleaning: { labelEn: "Deep Cleaning", labelAr: "تنظيف شامل" },
  waste_removal: { labelEn: "Trash Removal", labelAr: "تفريغ مهملات" },
  sanitization: { labelEn: "Sanitization", labelAr: "تعقيم وتطهير" },
  turnover: { labelEn: "Turnover Preparation", labelAr: "تجهيز لنزيل جديد" },
  general_inquiry: { labelEn: "General Inquiry", labelAr: "استفسار عام" },
  inspection: { labelEn: "Room Inspection", labelAr: "فحص ومعاينة" },
  pest_control: { labelEn: "Pest Control", labelAr: "مكافحة حشرات" },
};

function statusColor(s: string) {
  switch ((s || "").toLowerCase()) {
    case "open":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "in_progress":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    case "resolved":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    case "closed":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function priorityColor(p: string) {
  switch ((p || "").toLowerCase()) {
    case "urgent":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200";
  }
}

function formatDuration(startedAt: any, resolvedAt: any, reportedAt: any) {
  const start = reportedAt ?? startedAt;
  if (!start) return "—";
  const startDate = new Date(start);
  const endDate = resolvedAt ? new Date(resolvedAt) : new Date();
  const totalMins = differenceInMinutes(endDate, startDate);
  if (totalMins < 1) return "< 1 min";
  if (totalMins < 60) return `${totalMins} minutes`;
  const hrs = differenceInHours(endDate, startDate);
  const mins = totalMins % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs} hours`;
}

export default function TicketDetailModal({
  open,
  onClose,
  ticket,
  occupantName,
  profiles = [],
  workers = [],
  ar,
  canEdit = true,
  onStatusChange,
  onAssignChange,
  onWorkerAssignChange,
  onCreateSubTicket,
  subTickets = [],
  loadingSubTickets = false,
}: TicketDetailModalProps) {
  const [activeTab, setActiveTab] = useState<
    "master" | "tasks" | "comments" | "attachments"
  >("master");
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentsList, setCommentsList] = useState<Array<{ text: string; author: string; time: string }>>([]);
  const [showSubTicketForm, setShowSubTicketForm] = useState(false);
  const [subTicketForm, setSubTicketForm] = useState({
    problemType: "",
    description: "",
    priority: "MEDIUM",
  });
  const [creatingSub, setCreatingSub] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const filteredWorkers = useMemo(() => {
    if (!workers || !Array.isArray(workers)) return [];
    if (ticket?.category === "housekeeping") {
      return workers.filter((w: any) => w.specialty === "housekeeping");
    }
    if (ticket?.category === "maintenance") {
      return workers.filter((w: any) => w.specialty !== "housekeeping");
    }
    return workers;
  }, [workers, ticket?.category]);

  if (!ticket) return null;

  const safeSubTickets = Array.isArray(subTickets) ? subTickets : [];

  const reportedDate = formatDate(ticket.reportedAt);
  const reportedTime = ticket.reportedAt
    ? format(new Date(ticket.reportedAt), "dd-MM-yyyy hh:mm:ss a")
    : "—";

  const startedTime = ticket.startedAt
    ? format(new Date(ticket.startedAt), "dd-MM-yyyy hh:mm:ss a")
    : null;

  const resolvedTime = ticket.resolvedAt
    ? format(new Date(ticket.resolvedAt), "dd-MM-yyyy hh:mm:ss a")
    : null;

  const timeAgo = ticket.reportedAt
    ? formatDistanceToNow(new Date(ticket.reportedAt), {
        addSuffix: true,
        locale: ar ? arLocale : enUS,
      })
    : "";

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
  const canReopen = status !== "open";

  const serviceLabel =
    PROBLEM_TYPES_MAP[ticket.problemType]?.labelEn ||
    PROBLEM_TYPES_MAP[ticket.problemType]?.labelAr ||
    ticket.problemType ||
    (ticket.category === "housekeeping" ? "Room Cleaning" : "Maintenance Service");

  const serviceLabelAr =
    PROBLEM_TYPES_MAP[ticket.problemType]?.labelAr ||
    PROBLEM_TYPES_MAP[ticket.problemType]?.labelEn ||
    ticket.problemType ||
    (ticket.category === "housekeeping" ? "نظافة الغرفة" : "خدمة صيانة");

  const residentName = ticket.propertyName || (ar ? "Resident شروق" : "Sunrise Resident");

  const displayName = `Room - ${ticket.roomNumber || ticket.roomId || "—"} - ${
    occupantName || ticket.residentName ? (ar ? `النزيل: ${occupantName || ticket.residentName}` : `Guest: ${occupantName || ticket.residentName}`) : (ar ? "شاغرة" : "Vacant")
  }`;

  const currentWorker = ticket.workerName
    ? ticket.workerName
    : ticket.workerId
      ? workers.find((w: any) => w.id === ticket.workerId)?.name
      : null;

  const currentWorkerSpecialty =
    ticket.workerSpecialty ||
    workers.find((w: any) => w.id === ticket.workerId)?.specialty;

  const currentWorkerPhone =
    ticket.workerPhone ||
    workers.find((w: any) => w.id === ticket.workerId)?.phone;

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    setCommentsList((prev) => [
      ...prev,
      {
        text: commentText.trim(),
        author: ar ? "المشرف المناوب" : "Duty Supervisor",
        time: format(new Date(), "hh:mm a"),
      },
    ]);
    setCommentText("");
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) onClose();
        }}
      >
        <DialogContent
          className={`overflow-hidden p-0 flex flex-col transition-all duration-200 ${
            isFullscreen
              ? "max-w-[98vw] w-[98vw] h-[96vh] max-h-[96vh] rounded-xl"
              : "max-w-5xl w-full max-h-[90vh] rounded-2xl"
          }`}
          srTitle={ar ? "تفاصيل التذكرة" : "Ticket Details"}
        >
          {/* Header Bar - Opera / HotSOS Hotel PMS Standard */}
          <div className="bg-card border-b px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-foreground">
                  {ar ? "التفاصيل" : "Details"}
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                  #{ticket.id}
                </span>
              </div>

              {/* Master Ticket Tab Pill */}
              <div className="flex items-center gap-1.5 border rounded-lg p-1 bg-muted/40">
                <button
                  type="button"
                  onClick={() => setActiveTab("master")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors ${
                    activeTab === "master"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{ar ? "التذكرة الرئيسية" : "Master Ticket"}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-background/20 font-bold">
                    ✉ {commentsList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("tasks")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === "tasks"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{ar ? "المهام" : "Tasks"}</span>
                  {safeSubTickets.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-background/20 font-bold">
                      {safeSubTickets.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("comments")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === "comments"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{ar ? "التعليقات" : "Comments"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("attachments")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeTab === "attachments"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{ar ? "المرفقات" : "Attachments"}</span>
                  {ticket.photoUrl && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Header Right Action Buttons */}
            <div className="flex items-center gap-1.5">
              {!canEdit && (
                <Badge
                  variant="outline"
                  className="text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-xs flex items-center gap-1 font-semibold"
                >
                  <Lock className="w-3 h-3" />
                  {ar ? "للعرض فقط" : "Read-Only"}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? (ar ? "تصغير" : "Exit Fullscreen") : (ar ? "ملء الشاشة" : "Fullscreen")}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Modal Body Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-background/50">
            {activeTab === "master" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Side: DETAILS Card & TASK Card (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                  {/* DETAILS CARD */}
                  <div className="bg-card rounded-xl border shadow-xs overflow-hidden">
                    <div className="px-5 py-3 border-b bg-muted/20 flex items-center justify-between">
                      <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                        {ar ? "تفاصيل البلاغ" : "DETAILS"}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`${statusColor(ticket.status)} text-[11px] font-semibold`}
                        >
                          {ar ? (STATUS_AR[ticket.status] || ticket.status) : (STATUS_EN[ticket.status] || ticket.status)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`${priorityColor(ticket.priority)} text-[11px] font-semibold`}
                        >
                          {ar ? (PRIORITY_AR[ticket.priority] || ticket.priority) : ticket.priority}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-5 space-y-4 text-sm">
                      {/* Grid of Key-Values */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-6">
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "الاسم / الغرفة والنزيل" : "Name"}
                          </p>
                          <p className="font-semibold text-foreground text-sm">
                            {displayName}
                          </p>
                          {(ticket.buildingName || ticket.floorNumber) && (
                            <div className="flex items-center gap-1.5 mt-1 text-xs flex-wrap">
                              {ticket.buildingName && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/60 font-medium">
                                  <Building2 className="w-3 h-3 text-sky-600" />
                                  <span>{ar ? `المبنى: ${ticket.buildingName}` : `Building: ${ticket.buildingName}`}</span>
                                </span>
                              )}
                              {ticket.floorNumber && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 font-medium">
                                  <Layers className="w-3 h-3 text-amber-600" />
                                  <span>{ar ? `الدور ${ticket.floorNumber}` : `Floor ${ticket.floorNumber}`}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "Resident" : "Resident"}
                          </p>
                          <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-primary" />
                            <span>{residentName}</span>
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "القسم" : "Department"}
                          </p>
                          <p className="font-semibold text-foreground text-sm">
                            {ar
                              ? (CATEGORIES_AR[ticket.category] || ticket.category)
                              : (CATEGORIES_EN[ticket.category] || ticket.category)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "نوع الخدمة / المشكلة" : "Service"}
                          </p>
                          <p className="font-semibold text-foreground text-sm">
                            {ar ? serviceLabelAr : serviceLabel}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "الحالة" : "Status"}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              ticket.status === "open" ? "bg-blue-500" :
                              ticket.status === "in_progress" ? "bg-amber-500" :
                              ticket.status === "resolved" ? "bg-emerald-500" : "bg-slate-400"
                            }`} />
                            <span className="font-medium text-foreground text-xs">
                              {ar ? (STATUS_AR[ticket.status] || ticket.status) : (STATUS_EN[ticket.status] || ticket.status)}
                            </span>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "الأولوية" : "Priority"}
                          </p>
                          <p className="font-semibold text-foreground text-sm">
                            {ar ? (PRIORITY_AR[ticket.priority] || ticket.priority) : ticket.priority}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "تاريخ الإبلاغ" : "Date"}
                          </p>
                          <p className="font-medium text-foreground text-xs font-mono">
                            {reportedTime}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "تم الإنشاء بواسطة" : "Created By"}
                          </p>
                          <p className="font-medium text-foreground text-xs">
                            {ticket.createdByName || ticket.createdBy || (ar ? "النظام الإداري" : "Admin Staff")}
                          </p>
                        </div>
                      </div>

                      {/* Problem Description */}
                      {ticket.description && (
                        <div className="pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-1">
                            {ar ? "وصف العطل / الملاحظات" : "Description & Notes"}
                          </p>
                          <div className="p-3 bg-muted/40 rounded-lg text-xs leading-relaxed text-foreground border">
                            {ticket.description}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RESIDENT SERVICE RATING CARD */}
                  {(ticket.rating || ["resolved", "closed", "completed", "done"].includes((ticket.status || "").toLowerCase())) && (
                    <div className="bg-card rounded-xl border border-amber-500/20 shadow-xs overflow-hidden">
                      <div className="px-5 py-3 border-b bg-amber-500/10 dark:bg-amber-500/15 flex items-center justify-between">
                        <span className="text-xs font-bold tracking-wider text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1.5">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                          {ar ? "تقييم جودة الخدمة من النزيل" : "RESIDENT SERVICE RATING"}
                        </span>
                        {ticket.ratedAt && (
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {format(new Date(ticket.ratedAt), "dd-MM-yyyy hh:mm a")}
                          </span>
                        )}
                      </div>

                      <div className="p-5 space-y-3">
                        {ticket.rating ? (
                          <>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-5 h-5 ${
                                      star <= ticket.rating
                                        ? "fill-amber-400 text-amber-400 drop-shadow-xs"
                                        : "text-muted-foreground/30"
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-sm font-bold text-foreground">
                                {ticket.rating} / 5
                              </span>
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border-amber-500/30">
                                {ticket.rating === 5
                                  ? (ar ? "ممتاز ⭐⭐⭐⭐⭐" : "Excellent")
                                  : ticket.rating === 4
                                    ? (ar ? "جيد جداً ⭐⭐⭐⭐" : "Very Good")
                                    : ticket.rating === 3
                                      ? (ar ? "مقبول ⭐⭐⭐" : "Average")
                                      : ticket.rating === 2
                                        ? (ar ? "ضعيف ⭐⭐" : "Poor")
                                        : (ar ? "سيء جداً ⭐" : "Very Poor")}
                              </Badge>
                            </div>

                            {ticket.ratingComment && (
                              <div className="p-3.5 bg-amber-500/5 dark:bg-amber-950/20 rounded-xl text-xs leading-relaxed text-foreground border border-amber-500/20 flex items-start gap-2.5">
                                <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                                    {ar ? "تعليق وملاحظات النزيل:" : "Resident Feedback:"}
                                  </p>
                                  <p className="italic font-medium">"{ticket.ratingComment}"</p>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
                            <Clock className="w-4 h-4 shrink-0 text-amber-600 animate-pulse" />
                            <span>
                              {ar
                                ? "تم إنجاز التذكرة، وبانتظار قيام النزيل بتقييم مستوى الخدمة عبر بورتال الموظفين."
                                : "Ticket marked as completed. Awaiting resident service evaluation in Resident Portal."}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TASK CARD */}
                  <div className="bg-card rounded-xl border shadow-xs overflow-hidden">
                    <div className="px-5 py-3 border-b bg-muted/20 flex items-center justify-between">
                      <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                        {ar ? "أمر العمل والتنفيذ" : "TASK"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ar ? "مهمة رئيسية" : "Primary Task"}
                      </span>
                    </div>

                    <div className="p-5 space-y-3.5 text-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-6">
                        <div className="sm:col-span-2">
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "اسم المهمة" : "Name"}
                          </p>
                          <p className="font-semibold text-foreground text-sm">
                            {ar ? serviceLabelAr : serviceLabel} {ticket.roomNumber ? `(Room ${ticket.roomNumber})` : ""}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "الحالة" : "Status"}
                          </p>
                          <p className="font-semibold text-foreground text-xs">
                            {ar ? (STATUS_AR[ticket.status] || ticket.status) : (STATUS_EN[ticket.status] || ticket.status)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "الفني المعين" : "worker"}
                          </p>
                          {currentWorker ? (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground text-xs">
                                {currentWorker}
                              </span>
                              {currentWorkerSpecialty && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">
                                  {currentWorkerSpecialty}
                                </span>
                              )}
                              {currentWorkerPhone && (
                                <a
                                  href={`tel:${currentWorkerPhone}`}
                                  className="text-primary hover:text-primary/80"
                                  title={currentWorkerPhone}
                                >
                                  <Phone className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">
                              {ar ? "لم يتم تعيين فني بعد" : "Unassigned"}
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "القسم المسند" : "Department"}
                          </p>
                          <p className="font-medium text-foreground text-xs">
                            {ar
                              ? (CATEGORIES_AR[ticket.category] || ticket.category)
                              : (CATEGORIES_EN[ticket.category] || ticket.category)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "وقت البلاغ" : "Time"}
                          </p>
                          <p className="font-mono text-foreground text-xs">
                            {reportedTime} {timeAgo ? `(${timeAgo})` : ""}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "تاريخ بدء التنفيذ" : "Assigned At"}
                          </p>
                          <p className="font-mono text-foreground text-xs">
                            {startedTime || "—"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">
                            {ar ? "تاريخ الانتهاء" : "End At"}
                          </p>
                          <p className="font-mono text-foreground text-xs">
                            {resolvedTime || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: HotSOS / Opera Style Control Panel (4 cols) */}
                <div className="lg:col-span-4 space-y-4">
                  {/* Tasks Section with Pills */}
                  <div className="bg-card rounded-xl border p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                        {ar ? "المهام" : "Tasks"}
                      </span>
                      {safeSubTickets.length > 0 && (
                        <span className="text-xs font-mono text-primary font-bold">
                          1 + {safeSubTickets.length}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTaskIndex(0)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          selectedTaskIndex === 0
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {ar ? "المهمة 1" : "Task 1"}
                      </button>

                      {safeSubTickets.map((st, idx) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setSelectedTaskIndex(idx + 1);
                            setActiveTab("tasks");
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            selectedTaskIndex === idx + 1
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {ar ? `المهمة ${idx + 2}` : `Task ${idx + 2}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time To End Ticket Card */}
                  <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-muted/40 rounded-xl border border-primary/20 p-4 shadow-xs space-y-1 text-center">
                    <p className="text-xs font-medium text-muted-foreground flex items-center justify-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>{ar ? "الوقت المستغرق للإغلاق" : "Time To End Ticket"}</span>
                    </p>
                    <p className="text-xl font-bold text-foreground font-mono">
                      {totalTime}
                    </p>
                  </div>

                  {/* Ticket Action Section */}
                  <div className="bg-card rounded-xl border p-4 shadow-xs space-y-3">
                    <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase block">
                      {ar ? "إجراءات التذكرة" : "Ticket Action"}
                    </span>

                    {canEdit ? (
                      <div className="space-y-3">
                        {/* Status Action Dropdown */}
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            {ar ? "تغيير حالة التذكرة" : "Change Status"}
                          </Label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between h-9 text-xs font-semibold bg-background"
                              >
                                <span>{ar ? "الإجراءات المتاحة" : "Action"}</span>
                                <ChevronDown className="w-4 h-4 opacity-60" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 text-xs">
                              {canStart && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    onStatusChange(ticket.id, {
                                      status: "in_progress",
                                      startedAt: new Date().toISOString(),
                                    })
                                  }
                                  className="gap-2 cursor-pointer font-medium text-amber-700 dark:text-amber-300"
                                >
                                  <Play className="w-3.5 h-3.5 text-amber-500" />
                                  <span>{ar ? "بدء التنفيذ" : "Start Ticket"}</span>
                                </DropdownMenuItem>
                              )}
                              {canResolve && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    onStatusChange(ticket.id, {
                                      status: "resolved",
                                      resolvedAt: new Date().toISOString(),
                                    })
                                  }
                                  className="gap-2 cursor-pointer font-medium text-emerald-700 dark:text-emerald-300"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>{ar ? "تم الحل والإنجاز" : "Resolve Ticket"}</span>
                                </DropdownMenuItem>
                              )}
                              {canDone && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    onStatusChange(ticket.id, { status: "closed" })
                                  }
                                  className="gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300"
                                >
                                  <Handshake className="w-3.5 h-3.5 text-blue-500" />
                                  <span>{ar ? "إغلاق التذكرة" : "Close Ticket"}</span>
                                </DropdownMenuItem>
                              )}
                              {canReopen && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    onStatusChange(ticket.id, { status: "open" })
                                  }
                                  className="gap-2 cursor-pointer font-medium text-amber-600"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                                  <span>{ar ? "إعادة فتح التذكرة" : "Re-open Ticket"}</span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Assign Worker Select */}
                        {onWorkerAssignChange && (
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              {ar ? "تعيين الفني الميداني" : "Assign Worker"}
                            </Label>
                            <Select
                              value={ticket.workerId ? String(ticket.workerId) : "unassigned"}
                              onValueChange={(v) =>
                                onWorkerAssignChange(
                                  ticket.id,
                                  v === "unassigned" || !v ? null : parseInt(v),
                                )
                              }
                            >
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue
                                  placeholder={
                                    ticket?.category === "housekeeping"
                                      ? (ar ? "اختر موظف النظافة..." : "Select cleaner...")
                                      : (ar ? "اختر الفني المختص..." : "Select technician...")
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent className="max-h-52 overflow-y-auto">
                                <SelectItem value="unassigned">
                                  — {ticket?.category === "housekeeping" ? (ar ? "بدون موظف نظافة مسند" : "No Cleaner") : (ar ? "بدون فني مسند" : "No Worker")} —
                                </SelectItem>
                                {filteredWorkers.map((w: any) => (
                                  <SelectItem key={w.id} value={String(w.id)}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold">{w.name}</span>
                                      <span className="text-muted-foreground text-[10px]">
                                        ({w.specialty})
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-2 border">
                        <div className="flex justify-between items-center text-muted-foreground">
                          <span>{ar ? "الفني المعين:" : "Worker:"}</span>
                          <span className="font-semibold text-foreground">
                            {currentWorker || (ar ? "غير مسند" : "Unassigned")}
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-600 flex items-center gap-1.5 pt-1 border-t">
                          <Lock className="w-3 h-3 shrink-0" />
                          <span>{ar ? "للعرض فقط — لا تملك صلاحية التعديل" : "Read-only mode"}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Task Actions Section */}
                  <div className="bg-card rounded-xl border p-4 shadow-xs space-y-3">
                    <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase block">
                      {ar ? "إجراءات المهمة" : "Task Actions"}
                    </span>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center h-8 text-xs font-semibold gap-1.5"
                        onClick={() => setActiveTab("comments")}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-primary" />
                        <span>{ar ? "إضافة تعليق" : "Add Comment"}</span>
                      </Button>

                      {onCreateSubTicket && canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center h-8 text-xs font-semibold gap-1.5"
                          onClick={() => {
                            setActiveTab("tasks");
                            setShowSubTicketForm(true);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{ar ? "إضافة مهمة فرعية" : "Add Sub-Task"}</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Time Sheet Section */}
                  <div className="bg-card rounded-xl border p-4 shadow-xs space-y-2.5">
                    <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase block">
                      {ar ? "سجل الأوقات" : "Time Sheet"}
                    </span>

                    <div className="space-y-2 bg-muted/30 p-3 rounded-lg text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                          {ar ? "وقت الإسناد والبدء:" : "Time To assign :"}
                        </span>
                        <span className="font-semibold font-mono text-foreground">
                          {timeToAssign}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                          {ar ? "وقت العمل الفعلي:" : "Workin Time :"}
                        </span>
                        <span className="font-semibold font-mono text-foreground">
                          {workingTime}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attachment thumbnail preview */}
                  {ticket.photoUrl && (
                    <div className="bg-card rounded-xl border p-3 shadow-xs space-y-2">
                      <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase block">
                        {ar ? "مرفق الصورة" : "Attachment Preview"}
                      </span>
                      <div
                        onClick={() => setLightboxSrc(ticket.photoUrl)}
                        className="relative rounded-lg overflow-hidden h-28 border cursor-pointer group"
                      >
                        <img
                          src={ticket.photoUrl}
                          alt="Ticket preview"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TASKS TAB */}
            {activeTab === "tasks" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                    {ar ? "قائمة التذاكر والمهام الفرعية" : "Sub-Tickets & Checklist"}
                    {safeSubTickets.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {safeSubTickets.length}
                      </Badge>
                    )}
                  </h3>
                  {canEdit && (
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => setShowSubTicketForm(!showSubTicketForm)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{ar ? "إضافة مهمة فرعية" : "Add Sub-Task"}</span>
                    </Button>
                  )}
                </div>

                {showSubTicketForm && (
                  <div className="bg-muted/30 p-4 rounded-xl border space-y-3">
                    <h4 className="text-sm font-semibold">
                      {ar ? "مهمة فرعية جديدة" : "New Sub-Task"}
                    </h4>
                    <div>
                      <Label className="text-xs">
                        {ar ? "نوع المشكلة / الخدمة" : "Problem / Service Type"}
                      </Label>
                      <Input
                        value={subTicketForm.problemType}
                        onChange={(e) =>
                          setSubTicketForm((f) => ({
                            ...f,
                            problemType: e.target.value,
                          }))
                        }
                        placeholder={ar ? "مثال: تغيير خلاط المياه" : "e.g. Replace Water Mixer"}
                        className="h-8 text-xs mt-1 bg-background"
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
                        placeholder={ar ? "صف المهمة بدقة..." : "Describe the task..."}
                        rows={2}
                        className="text-xs mt-1 bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">{ar ? "الأولوية" : "Priority"}</Label>
                      <Select
                        value={subTicketForm.priority}
                        onValueChange={(v) =>
                          setSubTicketForm((f) => ({ ...f, priority: v }))
                        }
                      >
                        <SelectTrigger className="h-8 text-xs mt-1 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">{ar ? "منخفضة" : "Low"}</SelectItem>
                          <SelectItem value="MEDIUM">{ar ? "متوسطة" : "Medium"}</SelectItem>
                          <SelectItem value="HIGH">{ar ? "عالية" : "High"}</SelectItem>
                          <SelectItem value="URGENT">{ar ? "عاجلة" : "Urgent"}</SelectItem>
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
                          }, 800);
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
                ) : safeSubTickets.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border">
                    <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">
                      {ar ? "لا توجد مهام فرعية مسجلة لهذه التذكرة" : "No sub-tasks registered for this ticket"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {safeSubTickets.map((st, idx) => (
                      <div
                        key={st.id}
                        className="flex items-center justify-between p-3.5 bg-card rounded-xl border shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-bold">
                            Task {idx + 2}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {st.problemType}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {st.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`${statusColor(st.status)} text-[10px]`}>
                            {ar ? (STATUS_AR[st.status] || st.status) : st.status}
                          </Badge>
                          <Badge className={`${priorityColor(st.priority)} text-[10px]`}>
                            {ar ? (PRIORITY_AR[st.priority] || st.priority) : st.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* COMMENTS TAB */}
            {activeTab === "comments" && (
              <div className="space-y-4 max-w-2xl mx-auto">
                <div className="bg-card rounded-xl border p-4 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase">
                    {ar ? "إضافة تعليق وملاحظة تنفيذية" : "Add Note / Comment"}
                  </h3>
                  <Textarea
                    placeholder={ar ? "اكتب تعليقك هنا..." : "Type your comment here..."}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                    className="text-xs bg-background"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleAddComment}
                      disabled={!commentText.trim()}
                      className="h-8 text-xs gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{ar ? "إرسال التعليق" : "Send Comment"}</span>
                    </Button>
                  </div>
                </div>

                {commentsList.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      {ar ? "لا توجد تعليقات حتى الآن" : "No comments yet"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {commentsList.map((c, i) => (
                      <div key={i} className="bg-card p-3.5 rounded-xl border shadow-xs space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-foreground">{c.author}</span>
                          <span className="text-muted-foreground font-mono">{c.time}</span>
                        </div>
                        <p className="text-xs text-foreground/90">{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ATTACHMENTS TAB */}
            {activeTab === "attachments" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                  {ar ? "المرفقات والملفات" : "Attachments"}
                </h3>
                {ticket.photoUrl ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="group relative rounded-xl border bg-card overflow-hidden shadow-xs">
                      <div
                        className="aspect-video bg-muted/30 overflow-hidden relative cursor-pointer"
                        onClick={() => setLightboxSrc(ticket.photoUrl)}
                      >
                        <img
                          src={ticket.photoUrl}
                          alt="Ticket Attachment"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="bg-white/20 backdrop-blur-md p-2 rounded-full">
                            <Eye className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      </div>
                      <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Paperclip className="w-4 h-4 text-primary" />
                          <span className="text-xs font-semibold text-foreground">
                            {ar ? "صورة العطل المرفقة" : "Issue Photo"}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setLightboxSrc(ticket.photoUrl)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border">
                    <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      {ar ? "لا توجد مرفقات لهذه التذكرة" : "No attachments for this ticket"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="bg-card border-t px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                {ar ? "رقم التذكرة:" : "Ticket ID:"} <strong className="text-foreground">#{ticket.id}</strong>
              </span>
              <span>•</span>
              <span>
                {ar ? "تاريخ الإنشاء:" : "Created:"} <span className="font-mono">{reportedDate}</span>
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs font-medium px-4">
              {ar ? "إغلاق" : "Close"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
  );
}
