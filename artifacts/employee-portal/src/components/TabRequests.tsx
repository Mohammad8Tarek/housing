import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Camera, X } from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "../lib/theme";
import { apiFetch } from "../lib/api";
import MaterialIcon from "./MaterialIcon";
import { toast } from "sonner";
import { hapticFeedback } from "../lib/haptics";
import { MotionCard, MotionButton, StaggerItem } from "./motion-primitives";

interface Request {
  id: number;
  category: string;
  problemType: string;
  description: string;
  status: string;
  priority: string;
  reportedAt: string;
  resolvedAt: string | null;
  notes: string | null;
  photoUrl?: string | null;
}

interface RequestForm {
  category: string;
  problemType: string;
  description: string;
  priority: string;
  photoUrl: string;
}

const categoryConfig: Record<
  string,
  { icon: string; types: [string, string][] }
> = {
  maintenance: {
    icon: "build",
    types: [
      ["", "Select Issue Type"],
      ["ac_issue", "AC Issue"],
      ["plumbing", "Plumbing"],
      ["electrical", "Electrical"],
      ["furniture", "Furniture"],
      ["cleaning", "Cleaning"],
      ["internet", "Internet"],
      ["other", "Other"],
    ],
  },
  housekeeping: {
    icon: "cleaning_services",
    types: [
      ["", "Select Issue Type"],
      ["room_cleaning", "Room Cleaning"],
      ["linen_change", "Linen Change"],
      ["deep_cleaning", "Deep Cleaning"],
      ["trash_removal", "Trash Removal"],
      ["restroom", "Restroom Cleaning"],
      ["other", "Other"],
    ],
  },
  complaint: {
    icon: "warning",
    types: [
      ["", "Select Issue Type"],
      ["harassment", "Harassment"],
      ["noise", "Noise Complaint"],
      ["cleanliness", "Cleanliness Issue"],
      ["maintenance_unresolved", "Unresolved Maintenance"],
      ["neighbor", "Neighbor Issue"],
      ["other", "Other"],
    ],
  },
};

const requestIcons: Record<string, string> = {
  ac_issue: "ac_unit",
  plumbing: "water_drop",
  electrical: "lightbulb",
  furniture: "chair",
  cleaning: "cleaning_services",
  internet: "wifi",
  room_cleaning: "cleaning_services",
  linen_change: "bed",
  deep_cleaning: "cleaning_services",
  trash_removal: "delete_outline",
  restroom: "water_drop",
  harassment: "gavel",
  noise: "volume_up",
  cleanliness: "cleaning_services",
  maintenance_unresolved: "build",
  neighbor: "people",
  other: "build",
};

const statusInfo: Record<
  string,
  { label: string; labelAr: string; icon: string; cls: string }
> = {
  open: {
    label: "Scheduled",
    labelAr: "مجدول",
    icon: "schedule",
    cls: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
  },
  in_progress: {
    label: "In Progress",
    labelAr: "قيد التنفيذ",
    icon: "hourglass_empty",
    cls: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  },
  resolved: {
    label: "Completed",
    labelAr: "مكتمل",
    icon: "check_circle",
    cls: "bg-green-400/10 text-green-400 border-green-400/20",
  },
  closed: {
    label: "Closed",
    labelAr: "مغلق",
    icon: "do_not_disturb",
    cls: "bg-muted2/10 text-muted2 border-border2",
  },
};

export default function TabRequests() {
  const { t, lang } = useTheme();
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<RequestForm>({
    category: "maintenance",
    problemType: "",
    description: "",
    priority: "medium",
    photoUrl: "",
  });
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [msg, setMsg] = useState("");
  const [requests, setRequests] = useState<Request[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fetchHistory = useCallback(() => {
    setLoadingHistory(true);
    apiFetch("/api/portal-data/my-maintenance", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d === "object" && "success" in d && d.success)
          setRequests((d as { requests?: Request[] }).requests || []);
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMsg("");
    try {
      const res = await apiFetch("/api/portal-data/my-maintenance", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      await hapticFeedback("medium");
      toast.success(isRtl ? "تم إرسال الطلب بنجاح" : "Request submitted successfully");
      setStatus("success");
      setForm({
        category: "maintenance",
        problemType: "",
        description: "",
        priority: "medium",
        photoUrl: "",
      });
      setShowForm(false);
      setTimeout(() => {
        setStatus("idle");
        fetchHistory();
      }, 2500);
    } catch (err: unknown) {
      toast.error(isRtl ? "فشل في إرسال الطلب" : "Failed to submit request");
      setStatus("error");
    }
  };

  const cats = [
    {
      id: "maintenance",
      icon: "build",
      title: isRtl ? "صيانة" : "Maintenance",
      desc: isRtl
        ? "إصلاحات المنشأة، الكهرباء، السباكة، أو أنظمة التكييف"
        : "Facility repairs, electrical, plumbing, or AC systems.",
      action: isRtl ? "الإبلاغ عن مشكلة" : "Report Issue",
    },
    {
      id: "housekeeping",
      icon: "cleaning_services",
      title: isRtl ? "نظافة الغرف" : "Housekeeping",
      desc: isRtl
        ? "طلبات التنظيف، تغيير الملاءات، أو إعادة التموين"
        : "Cleaning requests, linen exchange, or supply restock.",
      action: isRtl ? "جدولة خدمة" : "Schedule Service",
    },
    {
      id: "complaint",
      icon: "warning",
      title: isRtl ? "شكوى" : "Complaint",
      desc: isRtl
        ? "مشاكل الضوضاء، مخاوف السلامة، أو ملاحظات الموظفين"
        : "Noise issues, safety concerns, or staff feedback.",
      action: isRtl ? "تقديم شكوى" : "File Complaint",
    },
  ];

  const displayedRequests = showAll ? requests : requests.slice(0, 4);
  const pendingCount = requests.filter(
    (r) => r.status === "open" || r.status === "in_progress",
  ).length;

  return (
    <div className="px-4 pt-4 pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="text-xl font-bold text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {isRtl ? "طلبات الخدمة" : "Service Requests"}
          </h2>
          <p className="text-[11px] text-muted2 mt-0.5">
            {isRtl
              ? "تقديم طلبات الصيانة والخدمات مباشرة لفريق المرافق"
              : "Request maintenance, housekeeping, or report issues directly to the facilities team."}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border2 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent2/10 flex items-center justify-center flex-shrink-0">
            <MaterialIcon
              icon="pending_actions"
              size={22}
              className="text-accent2"
            />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">
              {pendingCount}
            </div>
            <div className="text-[10px] text-muted2 uppercase tracking-wider">
              {isRtl ? "قيد الانتظار" : "Pending"}
            </div>
          </div>
        </div>
        <div className="bg-card border border-border2 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-surface border border-border2 flex items-center justify-center flex-shrink-0">
            <MaterialIcon icon="history" size={22} className="text-muted2" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">
              {requests.length}
            </div>
            <div className="text-[10px] text-muted2 uppercase tracking-wider">
              {isRtl ? "الإجمالي" : "Total"}
            </div>
          </div>
        </div>
      </div>



      {/* Category Cards */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <MaterialIcon icon="add_circle" size={18} className="text-accent2" />
          {isRtl ? "طلب جديد" : "New Request"}
        </h3>
        <div className="grid gap-3">
          {cats.map((c) => (
            <MotionCard
              key={c.id}
              onClick={() => {
                setShowForm(true);
                setForm((f) => ({ ...f, category: c.id, problemType: "" }));
              }}
              className="group bg-card border border-border2 rounded-2xl p-4 text-left hover:border-accent2/30 hover:shadow-md transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-accent2/10 group-hover:bg-accent2/20 transition-colors flex items-center justify-center flex-shrink-0">
                  <MaterialIcon
                    icon={c.icon}
                    size={24}
                    className="text-accent2"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-foreground">
                    {c.title}
                  </div>
                  <div className="text-[11px] text-muted2 mt-0.5 leading-relaxed">
                    {c.desc}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-accent2 opacity-0 group-hover:opacity-100 transition-all">
                  {c.action} <MaterialIcon icon="arrow_forward" size={16} />
                </div>
              </div>
            </MotionCard>
          ))}
        </div>
      </div>

      {/* New Request Form (collapsible) */}
      {showForm && (
        <div className="bg-card border border-border2 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MaterialIcon
                icon="post_add"
                size={18}
                className="text-accent2"
              />
              {isRtl ? "تذكرة جديدة" : "New Ticket"}
            </h3>
            
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <StaggerItem index={0}>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted2 block mb-2">
                  {isRtl ? "نوع المشكلة" : "Problem Type"}
                </label>
                <select
                  value={form.problemType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, problemType: e.target.value }))
                  }
                  required
                  className="w-full bg-surface border border-border2 text-foreground rounded-xl py-3 px-4 text-[12px] outline-none focus:border-accent2/50 transition-colors appearance-none"
                >
                  {categoryConfig[form.category]?.types.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </StaggerItem>

            <StaggerItem index={1}>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted2 block mb-2">
                    {isRtl ? "مستوى الأولوية" : "Priority Level"}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: "low",
                        cls: "bg-green-500/10 text-green-400 border-green-500/20",
                      },
                      {
                        id: "medium",
                        cls: "bg-accent2/10 text-accent2 border-accent2/30",
                      },
                      {
                        id: "high",
                        cls: "bg-red-500/10 text-red-400 border-red-500/20",
                      },
                    ].map((p) => (
                      <MotionButton
                        type="button"
                        key={p.id}
                        onClick={() => setForm((f) => ({ ...f, priority: p.id }))}
                        className={`py-2.5 rounded-xl text-[12px] font-bold border transition-all ${
                          form.priority === p.id
                            ? p.cls
                            : "bg-surface border-border2 text-muted2 hover:border-accent2/30"
                        }`}
                      >
                        {p.id === "low"
                          ? isRtl
                            ? "منخفضة"
                            : "Low"
                          : p.id === "medium"
                            ? isRtl
                              ? "متوسطة"
                              : "Medium"
                            : isRtl
                              ? "عالية"
                              : "High"}
                      </MotionButton>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted2 block mb-2">
                    {isRtl ? "الوصف" : "Description"}
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    required
                    minLength={5}
                    rows={3}
                    className="w-full bg-surface border border-border2 text-foreground rounded-xl py-3 px-4 text-[12px] outline-none focus:border-accent2/50 transition-colors resize-none placeholder:text-muted2/50"
                  />
                </div>
              </div>
            </StaggerItem>

            <StaggerItem index={2}>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted2 block mb-2">
                  {isRtl ? "المرفقات" : "Attachments"}
                </label>
                <div className="flex items-center gap-3">
                  {form.photoUrl ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-border2 flex-shrink-0">
                      <img
                        src={form.photoUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <MotionButton
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, photoUrl: "" }))}
                        className="absolute top-1 end-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-white/30 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </MotionButton>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface border border-border2 cursor-pointer hover:border-accent2/40 transition-colors">
                      <MaterialIcon
                        icon="photo_camera"
                        size={18}
                        className="text-accent2"
                      />
                      <span className="text-[11px] text-muted2">
                        {isRtl ? "إرفاق صورة" : "Attach Photo"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const r = new FileReader();
                          r.onload = () =>
                            setForm((p) => ({
                              ...p,
                              photoUrl: r.result as string,
                            }));
                          r.readAsDataURL(f);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </StaggerItem>

            <StaggerItem index={3}>
              <MotionButton
                type="submit"
                disabled={status === "loading" || status === "success"}
                className="w-full py-3 rounded-xl bg-accent2 text-accent2-foreground text-[13px] font-bold hover:scale-[1.01] active:scale-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("request.submitting")}
                  </>
                ) : (
                  <>
                    <MaterialIcon icon="send" size={16} />
                    {isRtl ? "تقديم طلب" : "Submit Request"}
                  </>
                )}
              </MotionButton>
            </StaggerItem>
          </form>
        </div>
      )}

      {/* My Requests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <MaterialIcon icon="list_alt" size={18} className="text-accent2" />
            {isRtl ? "طلباتي" : "My Requests"}
          </h3>
          {requests.length > 4 && (
            <MotionButton
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-semibold text-accent2 hover:text-accent2/80 transition-colors bg-accent2/5 px-2 py-1 rounded-md"
            >
              {showAll
                ? isRtl
                  ? "عرض أقل"
                  : "View Less"
                : isRtl
                  ? "عرض الكل"
                  : "View All"}
            </MotionButton>
          )}
        </div>

        {loadingHistory ? (
          <div className="bg-card border border-border2 rounded-2xl p-10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-accent2 animate-spin" />
          </div>
        ) : displayedRequests.length === 0 ? (
          <div className="bg-card border border-border2 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-3">
              <MaterialIcon
                icon="inbox"
                size={24}
                className="text-muted2 opacity-40"
              />
            </div>
            <p className="text-[13px] text-muted2 font-medium">
              {isRtl ? "لا توجد طلبات" : "No requests yet"}
            </p>
            <p className="text-[11px] text-muted2/60 mt-1">
              {isRtl
                ? "أنشئ طلبك الأول من الأعلى"
                : "Create your first request above"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedRequests.map((req, idx) => {
              const si = statusInfo[req.status] ?? statusInfo.open;
              const sLabel = isRtl ? si.labelAr : si.label;
              const icon =
                requestIcons[req.problemType] ??
                categoryConfig[req.category]?.icon ??
                "build";
              const pb =
                req.priority === "high"
                  ? "text-red-400"
                  : req.priority === "low"
                    ? "text-green-400"
                    : "text-accent2";
              return (
                <StaggerItem key={req.id} index={idx}>
                  <MotionButton
                    onClick={() => setLocation("/request-details?id=" + req.id)}
                    className="w-full bg-surface border border-border2 hover:border-accent2/40 rounded-xl p-3 flex gap-3 text-left transition-all hover:bg-surface-hover hover:shadow-sm group text-start"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-surface border border-border2 group-hover:border-accent2/20 group-hover:bg-accent2/5 transition-colors ${pb}`}
                    >
                      <MaterialIcon icon={icon} size={20} />
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm text-foreground truncate">
                          {isRtl ? (req as any).problemTypeAr || req.problemType : req.problemType}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${si.cls || "text-gray-500"} bg-opacity-10 dark:bg-opacity-20`}
                        >
                          {sLabel}
                        </span>
                      </div>
                      <p className="text-xs text-muted2 truncate">
                        {req.description}
                      </p>
                    </div>
                  </MotionButton>
                </StaggerItem>
              );
            })}
          </div>
        )}

        {/* Request summary footer */}
        {requests.length > 0 && (
          <div className="flex items-center justify-center gap-4 mt-3 px-3 py-2 text-[10px] text-muted2/50">
            <span>
              {
                requests.filter(
                  (r) => r.status === "resolved" || r.status === "closed",
                ).length
              }{" "}
              {isRtl ? "مكتمل" : "Completed"}
            </span>
            <span className="w-1 h-1 rounded-full bg-muted2/30" />
            <span>
              {requests.filter((r) => r.status === "open").length}{" "}
              {isRtl ? "مفتوح" : "Open"}
            </span>
            <span className="w-1 h-1 rounded-full bg-muted2/30" />
            <span>
              {requests.filter((r) => r.status === "in_progress").length}{" "}
              {isRtl ? "قيد التنفيذ" : "In Progress"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
