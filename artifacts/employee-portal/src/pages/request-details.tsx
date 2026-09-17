import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCheck,
  Clock,
  CheckCircle2,
  X,
  Star,
  MessageSquare,
  Check,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "../lib/theme";
import { useLocation } from "wouter";
import { apiFetch } from "../lib/api";

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
  rating?: number | null;
  ratingComment?: string | null;
  ratedAt?: string | null;
}

export default function RequestDetails() {
  const { t, lang } = useTheme();
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();

  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Rating state
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState<string>("");
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);
  const [isEditingRating, setIsEditingRating] = useState<boolean>(false);

  const requestId = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  ).get("id");

  const fetchRequest = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const r = await apiFetch(
        `/api/portal-data/my-maintenance?id=${requestId}`,
        { credentials: "include" },
      );
      const d = await r.json();
      if (
        d &&
        typeof d === "object" &&
        "success" in d &&
        d.success &&
        Array.isArray((d as { requests: Request[] }).requests) &&
        (d as { requests: Request[] }).requests.length > 0
      ) {
        const allReqs = (d as { requests: Request[] }).requests;
        const target = allReqs.find((r) => r.id === Number(requestId)) || allReqs[0];
        setRequest(target);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  useEffect(() => {
    if (request?.rating) {
      setRatingScore(Number(request.rating));
      setRatingComment(request.ratingComment || "");
    }
  }, [request]);

  const handleRateSubmit = async () => {
    if (!request) return;
    setIsSubmittingRating(true);
    try {
      const res = await apiFetch("/api/portal-data/rate-maintenance", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenanceId: request.id,
          rating: ratingScore,
          ratingComment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit rating");
      toast.success(
        isRtl
          ? "شكراً لك! تم إرسال تقييمك بنجاح"
          : "Thank you! Your rating has been submitted successfully",
      );
      setRequest((prev) =>
        prev
          ? {
              ...prev,
              rating: ratingScore,
              ratingComment,
              ratedAt: new Date().toISOString(),
            }
          : null,
      );
      setIsEditingRating(false);
    } catch (err: any) {
      toast.error(
        err?.message || (isRtl ? "تعذر إرسال التقييم" : "Could not submit rating"),
      );
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const statusInfo: Record<
    string,
    { label: string; labelAr: string; icon: React.ReactNode; cls: string }
  > = {
    open: {
      label: "Open",
      labelAr: "مفتوح",
      icon: <Clock className="w-3 h-3" />,
      cls: "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20",
    },
    in_progress: {
      label: "In Progress",
      labelAr: "قيد التنفيذ",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      cls: "bg-blue-400/10 text-blue-400 border border-blue-400/20",
    },
    resolved: {
      label: "Resolved",
      labelAr: "تم الحل",
      icon: <CheckCheck className="w-3 h-3" />,
      cls: "bg-green-400/10 text-green-400 border border-green-400/20",
    },
    completed: {
      label: "Completed",
      labelAr: "تم الإنجاز",
      icon: <CheckCheck className="w-3 h-3" />,
      cls: "bg-green-400/10 text-green-400 border border-green-400/20",
    },
    done: {
      label: "Done",
      labelAr: "منجز",
      icon: <CheckCheck className="w-3 h-3" />,
      cls: "bg-green-400/10 text-green-400 border border-green-400/20",
    },
    closed: {
      label: "Closed",
      labelAr: "مغلق",
      icon: <CheckCircle2 className="w-3 h-3" />,
      cls: "bg-muted2/10 text-muted2 border border-border2",
    },
  };

  const priorityBadge: Record<string, string> = {
    low: "text-green-400",
    medium: "text-accent2",
    high: "text-red-400",
  };

  if (!requestId) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="flex items-center gap-3 mb-6"></div>
        <div className="bg-card border border-border2 rounded-3xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3 opacity-50" />
          <p className="text-muted2">
            {isRtl ? "لم يتم العثور على الطلب" : "Request not found"}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="flex items-center gap-3 mb-6"></div>
        <div className="bg-card border border-border2 rounded-3xl p-10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-accent2 animate-spin" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="flex items-center gap-3 mb-6"></div>
        <div className="bg-card border border-border2 rounded-3xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3 opacity-50" />
          <p className="text-muted2">
            {isRtl ? "لم يتم العثور على الطلب" : "Request not found"}
          </p>
        </div>
      </div>
    );
  }

  const normStatus = (request.status || "").toLowerCase();
  const isCompletedOrClosed = ["resolved", "closed", "completed", "done"].includes(normStatus);
  const isInProgress = normStatus === "in_progress";
  const isOpen = normStatus === "open";

  const si = statusInfo[normStatus] ?? statusInfo.open;
  const sLabel =
    isOpen
      ? t("status.open")
      : isInProgress
        ? t("status.in_progress")
        : isCompletedOrClosed
          ? t("status.resolved")
          : t("status.closed");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/dashboard")}
            className="p-2 rounded-full bg-card border border-border2 hover:bg-muted2/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-2xl font-bold text-foreground capitalize">
            {request.problemType.replace(/_/g, " ")}
          </h1>
        </div>
        <span
          className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${si.cls}`}
        >
          {si.icon}
          {sLabel}
        </span>
      </div>

      {/* Interactive Request Status Stepper */}
      <div className="bg-card border border-border2 rounded-3xl p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted2 mb-5">
          {isRtl ? "مراحل تنفيذ وتتبع الطلب" : "Request Progress Timeline"}
        </h3>
        <div className="relative flex items-center justify-between px-2">
          {/* Base Track */}
          <div className="absolute top-4 start-6 end-6 h-1 bg-muted rounded-full" />
          
          {/* Active Fill Track */}
          <div
            className="absolute top-4 start-6 h-1 bg-accent2 rounded-full transition-all duration-500"
            style={{
              width:
                isOpen
                  ? "25%"
                  : isInProgress
                    ? "60%"
                    : isCompletedOrClosed
                      ? "calc(100% - 48px)"
                      : "0%",
            }}
          />

          {/* Step 1: Reported */}
          <div className="relative z-10 flex flex-col items-center text-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-accent2 text-accent2-foreground flex items-center justify-center font-bold text-xs shadow-sm">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-foreground">
              {isRtl ? "تم الإبلاغ" : "Reported"}
            </span>
            <span className="text-[9px] text-muted2 font-mono">
              {new Date(request.reportedAt).toLocaleDateString(isRtl ? "ar-EG" : "en-US", { month: "numeric", day: "numeric" })}
            </span>
          </div>

          {/* Step 2: Under Review / Scheduled */}
          <div className="relative z-10 flex flex-col items-center text-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors shadow-sm ${
                !isOpen
                  ? "bg-accent2 text-accent2-foreground"
                  : "bg-muted text-muted2"
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-foreground">
              {isRtl ? "تمت الجدولة" : "Scheduled"}
            </span>
            <span className="text-[9px] text-muted2">
              {isRtl ? "فريق المرافق" : "Facilities"}
            </span>
          </div>

          {/* Step 3: In Progress */}
          <div className="relative z-10 flex flex-col items-center text-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors shadow-sm ${
                isInProgress || isCompletedOrClosed
                  ? "bg-accent2 text-accent2-foreground animate-pulse"
                  : "bg-muted text-muted2"
              }`}
            >
              <Loader2 className={`w-4 h-4 ${isInProgress ? "animate-spin" : ""}`} />
            </div>
            <span className="text-[11px] font-bold text-foreground">
              {isRtl ? "جاري الإصلاح" : "In Progress"}
            </span>
            <span className="text-[9px] text-muted2">
              {isInProgress ? (isRtl ? "الآن" : "Active") : (isRtl ? "ميداني" : "Field")}
            </span>
          </div>

          {/* Step 4: Resolved */}
          <div className="relative z-10 flex flex-col items-center text-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors shadow-sm ${
                isCompletedOrClosed
                  ? "bg-emerald-500 text-white"
                  : "bg-muted text-muted2"
              }`}
            >
              <CheckCheck className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-foreground">
              {isRtl ? "تم الإنجاز" : "Resolved"}
            </span>
            <span className="text-[9px] text-muted2">
              {request.resolvedAt ? (isRtl ? "مكتمل" : "Done") : (isRtl ? "معلق" : "Pending")}
            </span>
          </div>
        </div>
      </div>

      {/* Service Quality Rating Section (Mandatory on Resolved/Closed) */}
      {isCompletedOrClosed && (
        <div className="bg-card border border-border2 rounded-3xl p-6 shadow-xs overflow-hidden relative">
          {request.rating && !isEditingRating ? (
            /* Already Rated View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Star className="w-5 h-5 fill-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {isRtl ? "تقييم جودة الخدمة" : "Service Quality Evaluation"}
                    </h3>
                    <p className="text-[11px] text-muted2">
                      {isRtl ? "شكراً لمشاركتنا رأيك في هذه الخدمة" : "Thank you for sharing your feedback"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditingRating(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-muted2/10 hover:bg-muted2/20 text-muted2 hover:text-foreground transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isRtl ? "تعديل التقييم" : "Edit Rating"}
                </button>
              </div>

              <div className="bg-surface/50 border border-border2 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-6 h-6 ${
                          star <= (request.rating || 0)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted stroke-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    {request.rating}/5
                  </span>
                  <span className="text-xs text-muted2">
                    {request.rating === 5
                      ? isRtl ? "ممتاز" : "Excellent"
                      : request.rating === 4
                        ? isRtl ? "جيد جداً" : "Very Good"
                        : request.rating === 3
                          ? isRtl ? "مقبول" : "Average"
                          : request.rating === 2
                            ? isRtl ? "ضعيف" : "Poor"
                            : isRtl ? "سيء جداً" : "Very Poor"}
                  </span>
                </div>

                {request.ratedAt && (
                  <span className="text-[11px] text-muted2 font-mono">
                    {new Date(request.ratedAt).toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>

              {request.ratingComment && (
                <div className="bg-surface border border-border2 rounded-2xl p-3.5 text-sm text-foreground leading-relaxed flex items-start gap-2.5">
                  <MessageSquare className="w-4 h-4 text-muted2 shrink-0 mt-0.5" />
                  <p className="italic text-muted2 font-normal">
                    "{request.ratingComment}"
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Interactive Rating Form */
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Star className="w-5 h-5 fill-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {isRtl ? "تقييم جودة الخدمة المكتملة" : "Rate Completed Service Quality"}
                    </h3>
                    <p className="text-[11px] text-muted2">
                      {isRtl
                        ? "تقييمك إلزامي لمساعدتنا في تحسين الأداء ومتابعة الفنيين"
                        : "Your feedback is essential to monitor performance and improve services"}
                    </p>
                  </div>
                </div>

                {isEditingRating && (
                  <button
                    onClick={() => setIsEditingRating(false)}
                    className="text-xs text-muted2 hover:text-foreground underline transition-colors"
                  >
                    {isRtl ? "إلغاء التعديل" : "Cancel"}
                  </button>
                )}
              </div>

              {/* Star Rating Selector */}
              <div className="bg-surface/60 border border-border2 rounded-2xl p-5 text-center space-y-3">
                <p className="text-xs font-semibold text-muted2">
                  {isRtl ? "كيف كانت تجربتك مع تنفيذ هذا الطلب؟" : "How was your experience with this service?"}
                </p>

                <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const activeScore = hoverRating || ratingScore;
                    const isFilled = star <= activeScore;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingScore(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1.5 transition-transform hover:scale-125 focus:outline-hidden"
                      >
                        <Star
                          className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors ${
                            isFilled
                              ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                              : "text-muted-foreground/30 hover:text-amber-300"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="text-sm font-bold text-foreground">
                  {ratingScore === 5 && (isRtl ? "⭐⭐⭐⭐⭐ ممتاز ومثالي" : "⭐⭐⭐⭐⭐ Excellent Service")}
                  {ratingScore === 4 && (isRtl ? "⭐⭐⭐⭐ جيد جداً ومحترف" : "⭐⭐⭐⭐ Very Good")}
                  {ratingScore === 3 && (isRtl ? "⭐⭐⭐ مقبول وبحاجة لبعض التحسين" : "⭐⭐⭐ Average")}
                  {ratingScore === 2 && (isRtl ? "⭐⭐ ضعيف وتأخر في الحل" : "⭐⭐ Poor / Delayed")}
                  {ratingScore === 1 && (isRtl ? "⭐ غير مرضٍ تماماً" : "⭐ Very Unsatisfactory")}
                </div>
              </div>

              {/* Quick Feedback Chips */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted2 uppercase tracking-wider block">
                  {isRtl ? "عبارات سريعة (انقر للإضافة)" : "Quick Tags (Tap to add)"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {(ratingScore >= 4
                    ? isRtl
                      ? ["سرعة في الاستجابة", "فني محترف وخلوق", "نظافة ممتازة وإتقان", "حل جذري للمشكلة", "خدمة متميزة"]
                      : ["Fast Response", "Professional Technician", "Clean & Tidy Work", "Problem Solved", "Excellent Service"]
                    : isRtl
                      ? ["تأخر في الحضور", "عمل غير مكتمل", "حاجة لمتابعة إضافية", "سوء تعامل", "لم يتم حل المشكلة بالكامل"]
                      : ["Delayed Arrival", "Incomplete Work", "Follow-up Needed", "Poor Communication", "Issue Not Fully Solved"]
                  ).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setRatingComment((prev) =>
                          prev ? `${prev}، ${tag}` : tag,
                        );
                      }}
                      className="px-2.5 py-1 text-xs rounded-full bg-surface border border-border2 hover:border-accent2/50 text-muted2 hover:text-foreground transition-all active:scale-95"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment Textarea */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted2 uppercase tracking-wider block">
                  {isRtl ? "ملاحظات إضافية (اختياري)" : "Additional Comments (Optional)"}
                </label>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder={
                    isRtl
                      ? "اكتب تفاصيل إضافية حول جودة الخدمة، سرعة الفني، أو أي ملاحظات ترغب في إيصالها للإدارة..."
                      : "Write any feedback regarding service quality, technician speed, or suggestions for management..."
                  }
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-surface border border-border2 focus:border-accent2 focus:outline-hidden text-sm text-foreground placeholder:text-muted2/60 resize-none transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleRateSubmit}
                disabled={isSubmittingRating}
                className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-900 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
              >
                {isSubmittingRating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isRtl ? "جاري إرسال التقييم..." : "Submitting Rating..."}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {isRtl ? "إرسال التقييم واعتماد الجودة" : "Submit Rating & Confirm"}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {request.photoUrl && (
            <div className="bg-card border border-border2 rounded-3xl overflow-hidden">
              <div className="relative">
                <img
                  src={request.photoUrl}
                  alt=""
                  className="w-full h-96 object-cover"
                />
              </div>
            </div>
          )}

          <div className="bg-card border border-border2 rounded-3xl p-6">
            <h3 className="text-sm font-bold uppercase text-muted2 mb-3">
              {t("request.description")}
            </h3>
            <p className="text-foreground text-sm leading-relaxed">
              {request.description}
            </p>
          </div>

          {request.notes && (
            <div className="bg-card border border-border2 rounded-3xl p-6">
              <h3 className="text-sm font-bold uppercase text-muted2 mb-3">
                {t("status.note")}
              </h3>
              <p className="text-foreground text-sm leading-relaxed">
                {request.notes}
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border2 rounded-3xl p-6">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted2 mb-2">
              {t("request.priority")}
            </h3>
            <span
              className={`text-sm font-bold uppercase ${priorityBadge[request.priority] ?? "text-muted2"}`}
            >
              {request.priority}
            </span>
          </div>

          <div className="bg-card border border-border2 rounded-3xl p-6 space-y-3">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted2 mb-1">
                {isRtl ? "تاريخ الإبلاغ" : "Reported Date"}
              </h3>
              <p className="text-foreground text-sm">
                {new Date(request.reportedAt).toLocaleDateString(
                  isRtl ? "ar-EG" : "en-US",
                )}
              </p>
            </div>
            {request.resolvedAt && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted2 mb-1">
                  {isRtl ? "تاريخ الحل" : "Resolved Date"}
                </h3>
                <p className="text-foreground text-sm">
                  {new Date(request.resolvedAt).toLocaleDateString(
                    isRtl ? "ar-EG" : "en-US",
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="bg-card border border-border2 rounded-3xl p-6">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted2 mb-2">
              {t("request.type")}
            </h3>
            <span className="text-sm font-bold text-foreground capitalize">
              {request.category}
            </span>
          </div>
        </div>
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage}
              alt=""
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
