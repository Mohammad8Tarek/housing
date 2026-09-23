import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ShieldCheck,
  Building2,
  Users,
  Calendar,
  Home,
  QrCode,
  UtensilsCrossed,
  Bus,
  Clock,
  Sparkles,
  FileText,
  Wrench,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Phone,
  Mail,
  Key,
  Download,
  Loader2,
  Star,
  Smile,
  Meh,
  Frown,
  Lock,
  HeartHandshake,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { ResidentQRCode } from "./ResidentQRCode";
import PWAInstallBanner from "./PWAInstallBanner";
import { cn } from "../lib/utils";

interface Props {
  employee: any;
  portalData: any;
  onRequestTab: () => void;
  onActivitiesTab: () => void;
  onEvaluationsTab: () => void;
  onDocTab: () => void;
  onProfileTab: () => void;
  onRoommatesTab: () => void;
  onHR: () => void;
}

function getTimeGreeting(isRtl: boolean): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return isRtl ? "صباح الخير" : "Good Morning";
  }
  if (hour >= 12 && hour < 17) {
    return isRtl ? "مساء الخير" : "Good Afternoon";
  }
  return isRtl ? "مساء الخير" : "Good Evening";
}

export default function TabOverview({
  employee,
  portalData,
  onRequestTab,
  onActivitiesTab,
  onDocTab,
  onProfileTab,
  onRoommatesTab,
  onHR,
}: Props) {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const Chevron = isRtl ? ChevronLeft : ChevronRight;

  const room = portalData?.room as
    | { roomNumber?: string; building?: string; bedLabel?: string }
    | undefined;
  const assignments = portalData?.assignments || [];
  const firstName =
    employee?.fullName?.split(" ")[0] ||
    employee?.firstName ||
    (isRtl ? "موظف" : "Employee");

  const staffCode = String(
    employee?.profileId ||
    (employee as any)?.employeeId ||
    employee?.id ||
    ""
  );

  const [greeting, setGreeting] = useState(() => getTimeGreeting(isRtl));
  const [showQrModal, setShowQrModal] = useState(false);
  const [gatePass, setGatePass] = useState<any>(null);
  const [loadingPass, setLoadingPass] = useState(false);
  const hasFetchedPassRef = useRef(false);

  const fetchPass = useCallback(async () => {
    if (loadingPass) return;
    setLoadingPass(true);
    try {
      const empCode = employee?.id || employee?.profileId;
      const url = empCode ? `/api/gate/pass/${empCode}` : "/api/gate/pass/me";
      const res = await apiFetch(url, { credentials: "include" });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.gatePass) {
          setGatePass(json.gatePass);
        }
      }
    } catch (err) {
      console.error("Failed to load gate pass:", err);
    } finally {
      setLoadingPass(false);
    }
  }, [employee?.id, employee?.profileId, loadingPass]);

  useEffect(() => {
    if (!hasFetchedPassRef.current) {
      hasFetchedPassRef.current = true;
      fetchPass();
    }
  }, [fetchPass]);

  // When QR modal opens, if pass wasn't loaded yet, fetch once
  useEffect(() => {
    if (showQrModal && !gatePass && !loadingPass) {
      fetchPass();
    }
  }, [showQrModal, gatePass, loadingPass, fetchPass]);

  useEffect(() => {
    setGreeting(getTimeGreeting(isRtl));
    const timer = setInterval(() => {
      setGreeting(getTimeGreeting(isRtl));
    }, 30000);
    return () => clearInterval(timer);
  }, [isRtl]);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [docCount, setDocCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [roommates, setRoommates] = useState<any[]>([]);
  const [unratedRequest, setUnratedRequest] = useState<any>(null);
  const [supportContacts, setSupportContacts] = useState<any[]>([]);
  const [housingRatingStatus, setHousingRatingStatus] = useState<any>(null);
  const [selectedHousingRating, setSelectedHousingRating] = useState<string>("");
  const [selectedHousingScore, setSelectedHousingScore] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [housingRatingComment, setHousingRatingComment] = useState<string>("");
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);
  const [ratingSubmittedSuccess, setRatingSubmittedSuccess] = useState<boolean>(false);

  const handleHousingRatingSubmit = async () => {
    if (!selectedHousingRating) return;
    setIsSubmittingRating(true);
    try {
      const res = await apiFetch("/api/portal-data/housing-rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rating: selectedHousingRating,
          score: selectedHousingScore || undefined,
          comment: housingRatingComment.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        setRatingSubmittedSuccess(true);
        setHousingRatingStatus({ eligible: false });
      }
    } catch (err) {
      console.error("Failed to submit rating:", err);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  useEffect(() => {
    const loadOverviewData = async () => {
      try {
        const [notifRes, docRes, roomRes, mntRes, contactsRes, ratingStatusRes] = await Promise.all([
          apiFetch("/api/portal-notifications/my", { credentials: "include" }),
          apiFetch("/api/portal-data/documents", { credentials: "include" }),
          apiFetch("/api/portal-data/roommates", { credentials: "include" }),
          apiFetch("/api/portal-data/my-maintenance", { credentials: "include" }),
          apiFetch("/api/portal-data/support-contacts", { credentials: "include" }),
          apiFetch("/api/portal-data/housing-rating-status", { credentials: "include" }),
        ]);

        if (ratingStatusRes.ok) {
          const rStatus = await ratingStatusRes.json().catch(() => null);
          if (rStatus?.success) {
            setHousingRatingStatus(rStatus);
          }
        }

        if (contactsRes.ok) {
          const cData = await contactsRes.json().catch(() => null);
          if (cData?.contacts) {
            setSupportContacts(
              (cData.contacts || []).filter(
                (c: any) => c.name || c.phone || c.email
              )
            );
          }
        }

        if (notifRes.ok) {
          const notifData = await notifRes.json().catch(() => null);
          if (notifData?.success) {
            setNotifications((notifData.notifications || []).slice(0, 3));
          }
        }

        if (docRes.ok) {
          const docData = await docRes.json().catch(() => null);
          if (docData?.success) {
            setDocCount((docData.documents || []).length);
          }
        }

        if (roomRes.ok) {
          const roomData = await roomRes.json().catch(() => null);
          if (roomData?.roommates) {
            setRoommates(roomData.roommates);
          }
        }

        if (mntRes.ok) {
          const mntData = await mntRes.json().catch(() => null);
          const reqs = Array.isArray(mntData) ? mntData : mntData?.requests || [];
          const unrated = reqs.find(
            (r: any) =>
              ["resolved", "closed", "completed", "done"].includes((r.status || "").toLowerCase()) &&
              !r.rating,
          );
          setUnratedRequest(unrated || null);
        }

        const upcomingEvents =
          portalData?.events?.length ?? portalData?.upcomingEvents?.length ?? 0;
        setEventCount(typeof upcomingEvents === "number" ? upcomingEvents : 0);
      } catch {}
    };

    loadOverviewData();
  }, [portalData?.events, portalData?.upcomingEvents]);

  const pendingRequestsCount =
    assignments.filter(
      (a: any) => a.status === "ACTIVE" || a.status === "PENDING",
    ).length || 0;

  const isAssigned = Boolean(room?.roomNumber);

  return (
    <div className="px-4 pt-3 pb-6 space-y-4">
      {/* PWA Install Banner for Mobile & Web */}
      <PWAInstallBanner compact />

      {/* ── UNRATED COMPLETED SERVICE ATTENTION CARD ── */}
      {unratedRequest && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/5 border-2 border-amber-500/40 p-4 shadow-md flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 truncate">
                <span>{isRtl ? "خدمة مكتملة بانتظار تقييمك!" : "Completed Service Awaiting Rating!"}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono shrink-0">
                  #{unratedRequest.id}
                </span>
              </h4>
              <p className="text-[11px] text-muted2 mt-0.5 truncate">
                {unratedRequest.problemType || unratedRequest.description || (isRtl ? "طلب صيانة" : "Maintenance request")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLocation("/request-details?id=" + unratedRequest.id)}
            className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Star className="w-3.5 h-3.5 fill-white" />
            <span>{isRtl ? "قيّم الآن" : "Rate Now"}</span>
          </button>
        </div>
      )}

      {/* ── 7-DAY ANONYMOUS HOUSING QUALITY PULSE RATING ── */}
      {(housingRatingStatus?.eligible || ratingSubmittedSuccess) && (
        <div className="relative overflow-hidden rounded-2xl bg-card border border-primary/20 shadow-md p-4 transition-all">
          {ratingSubmittedSuccess ? (
            <div className="flex items-center gap-3 py-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-foreground">
                  {isRtl ? "تم استلام تقييمك بنجاح، شكراً لك!" : "Thank you! Your rating has been received."}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isRtl
                    ? "تقييمك سري ومجهول الهوية 100% ويساعدنا في تحسين جودة السكن."
                    : "Your feedback is 100% anonymous and helps improve housing quality."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <HeartHandshake className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span>
                        {isRtl
                          ? (housingRatingStatus?.config?.titleAr || "استطلاع جودة السكن الأسبوعي")
                          : (housingRatingStatus?.config?.titleEn || "Weekly Housing Quality Pulse")}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                        {isRtl ? "سري تماماً" : "100% Anonymous"}
                      </span>
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isRtl
                        ? (housingRatingStatus?.config?.questionAr || "ما مدى رضاك عن مستوى السكن ونظافته وخدماته هذا الأسبوع؟")
                        : (housingRatingStatus?.config?.questionEn || "How satisfied are you with housing conditions, cleanliness & services this week?")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Check ratingType: 'stars' vs 'faces' (default) */}
              {housingRatingStatus?.config?.ratingType === "stars" ? (
                <div className="pt-1 space-y-2">
                  <div className="flex items-center justify-center gap-2 p-3 bg-muted/30 rounded-xl border border-border/50">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isActive = (hoveredStar || selectedHousingScore) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoveredStar(star)}
                          onMouseLeave={() => setHoveredStar(0)}
                          onClick={() => {
                            setSelectedHousingScore(star);
                            if (star >= 4) setSelectedHousingRating("satisfied");
                            else if (star === 3) setSelectedHousingRating("neutral");
                            else setSelectedHousingRating("dissatisfied");
                          }}
                          className="p-1 transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                        >
                          <Star
                            className={cn(
                              "w-8 h-8 transition-colors",
                              isActive
                                ? "text-amber-400 fill-amber-400 filter drop-shadow-[0_2px_4px_rgba(245,158,11,0.4)]"
                                : "text-muted-foreground/40 hover:text-amber-300"
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>
                  {/* Star Rating Label Pill */}
                  <div className="text-center text-xs font-semibold">
                    {selectedHousingScore === 5 && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {isRtl ? "⭐⭐⭐⭐⭐ ممتاز جداً" : "⭐⭐⭐⭐⭐ Excellent"}
                      </span>
                    )}
                    {selectedHousingScore === 4 && (
                      <span className="text-emerald-500">
                        {isRtl ? "⭐⭐⭐⭐ جيد جداً" : "⭐⭐⭐⭐ Very Good"}
                      </span>
                    )}
                    {selectedHousingScore === 3 && (
                      <span className="text-amber-500">
                        {isRtl ? "⭐⭐⭐ مقبول / متوسط" : "⭐⭐⭐ Average / Fair"}
                      </span>
                    )}
                    {selectedHousingScore === 2 && (
                      <span className="text-rose-400">
                        {isRtl ? "⭐⭐ ضعيف" : "⭐⭐ Poor"}
                      </span>
                    )}
                    {selectedHousingScore === 1 && (
                      <span className="text-rose-600 dark:text-rose-400">
                        {isRtl ? "⭐ سيء جداً" : "⭐ Very Poor"}
                      </span>
                    )}
                    {!selectedHousingScore && (
                      <span className="text-muted-foreground text-[11px]">
                        {isRtl ? "اضغط على النجوم للتقييم من 1 إلى 5" : "Tap the stars to rate from 1 to 5"}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* 3 Rating Options (Faces) */
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedHousingRating("satisfied");
                      setSelectedHousingScore(5);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                      selectedHousingRating === "satisfied"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-xs"
                        : "border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 text-foreground"
                    )}
                  >
                    <Smile className={cn("w-6 h-6", selectedHousingRating === "satisfied" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
                    <span>{isRtl ? "راضي" : "Satisfied"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedHousingRating("neutral");
                      setSelectedHousingScore(3);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                      selectedHousingRating === "neutral"
                        ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-xs"
                        : "border-border hover:border-amber-500/50 hover:bg-amber-500/5 text-foreground"
                    )}
                  >
                    <Meh className={cn("w-6 h-6", selectedHousingRating === "neutral" ? "text-amber-500" : "text-muted-foreground")} />
                    <span>{isRtl ? "متوسط" : "Neutral"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedHousingRating("dissatisfied");
                      setSelectedHousingScore(1);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                      selectedHousingRating === "dissatisfied"
                        ? "border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300 shadow-xs"
                        : "border-border hover:border-rose-500/50 hover:bg-rose-500/5 text-foreground"
                    )}
                  >
                    <Frown className={cn("w-6 h-6", selectedHousingRating === "dissatisfied" ? "text-rose-500" : "text-muted-foreground")} />
                    <span>{isRtl ? "غير راضي" : "Dissatisfied"}</span>
                  </button>
                </div>
              )}

              {/* Optional / Required Comment (if allowed) */}
              {housingRatingStatus?.config?.allowComment !== false && (
                <div className="pt-1">
                  <textarea
                    value={housingRatingComment}
                    onChange={(e) => setHousingRatingComment(e.target.value)}
                    placeholder={
                      isRtl
                        ? (housingRatingStatus?.config?.commentRequired
                            ? "اكتب ملاحظاتك ومقترحاتك (مطلوب - الهوية سرية 100%)..."
                            : "اكتب أي ملاحظة أو مقترح (اختياري - لن تظهر هويتك لمدير السكن)...")
                        : (housingRatingStatus?.config?.commentRequired
                            ? "Write your feedback or suggestions (Required - anonymous)..."
                            : "Write your feedback or suggestions (optional - identity remains anonymous)...")
                    }
                    rows={2}
                    className="w-full text-xs rounded-xl border border-input bg-background/50 px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              )}

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Lock className="w-3 h-3 text-muted-foreground/70" />
                  {isRtl ? "بياناتك محمية وسرية 100%" : "100% Anonymous & Secure"}
                </span>

                <button
                  type="button"
                  disabled={
                    !selectedHousingRating ||
                    (housingRatingStatus?.config?.commentRequired && !housingRatingComment.trim()) ||
                    isSubmittingRating
                  }
                  onClick={handleHousingRatingSubmit}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs",
                    !selectedHousingRating ||
                    (housingRatingStatus?.config?.commentRequired && !housingRatingComment.trim()) ||
                    isSubmittingRating
                      ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                  )}
                >
                  {isSubmittingRating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isRtl ? "إرسال التقييم" : "Submit Rating"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 1. DIGITAL RESIDENT WALLET PASS (Apple Wallet / Luxury Fintech Style) ── */}
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#121E36] via-[#1A2B4C] to-[#20365D] text-white p-5 shadow-2xl border border-white/10">
        {/* Ambient background glows */}
        <div className="absolute -end-10 -top-10 w-44 h-44 bg-[#C9A24D] opacity-[0.12] blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -start-10 -bottom-10 w-36 h-36 bg-blue-500 opacity-[0.08] blur-[70px] rounded-full pointer-events-none" />

        {/* Pass Top Bar */}
        <div className="relative z-10 flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur-md">
              <ShieldCheck className="w-4 h-4 text-[#E0C070]" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-[#E0C070]">
                SUNRISE RESIDENT PASS
              </span>
              <div className="text-[11px] font-mono text-white/60">
                ID: {staffCode}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white backdrop-blur-md transition-all cursor-pointer shadow-xs active:scale-95"
            title={isRtl ? "إظهار رمز QR السكني" : "Show Resident QR"}
          >
            <QrCode className="w-3.5 h-3.5 text-[#E0C070]" />
            <span>{isRtl ? "رمز الدخول" : "Gate QR"}</span>
          </button>
        </div>

        {/* Resident Identity */}
        <div className="relative z-10 mb-4">
          <div className="text-xs text-white/70 font-medium">
            {greeting},{" "}
            <span className="text-white font-semibold">
              {employee?.department || "Hospitality"}
            </span>
          </div>
          <h2
            className="text-2xl font-black text-white tracking-tight mt-0.5"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {employee?.fullName || firstName}
          </h2>
          {employee?.jobTitle && (
            <p className="text-xs text-[#E0C070]/90 font-medium mt-0.5">
              {employee.jobTitle}
            </p>
          )}
        </div>

        {/* Room & Bed Allocation Pill Card */}
        <div className="relative z-10 rounded-2xl bg-black/25 border border-white/10 p-3.5 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                isAssigned
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30",
              )}
            >
              <Home className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                {isRtl ? "مقر السكن المخصص" : "Assigned Housing"}
              </div>
              <div className="text-sm font-bold text-white truncate">
                {isAssigned && room ? (
                  <>
                    <span>{isRtl ? "غرفة " : "Room "}</span>
                    <span className="text-[#E0C070] font-mono">
                      {room.roomNumber}
                    </span>
                    {room.building && (
                      <span className="text-white/75 font-normal text-xs">
                        {" "}
                        · {room.building}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-amber-300 font-medium">
                    {isRtl ? "قيد التسكين والاعتماد" : "Pending Bed Allocation"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 text-end">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono",
                isAssigned
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30",
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isAssigned ? "bg-emerald-400 animate-pulse" : "bg-amber-400",
                )}
              />
              {isAssigned
                ? isRtl
                  ? "مُسكّن نشط"
                  : "Active"
                : isRtl
                  ? "قيد الانتظار"
                  : "Pending"}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. DAILY PULSE WIDGET (Today's Meal, Shuttle Bus & Roommates) ── */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Dining Card */}
        <div className="bg-card/75 backdrop-blur-md border border-border/60 rounded-2xl p-3.5 flex flex-col justify-between gap-2 shadow-2xs hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              {isRtl ? "مطعم السكن" : "Dining"}
            </span>
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">
              {isRtl ? "وجبة اليوم القادمة" : "Upcoming Meal"}
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isRtl ? "بوفيه العاملين مفتوح الآن" : "Staff buffet active"}
            </p>
          </div>
        </div>

        {/* Shuttle Bus Card */}
        <div className="bg-card/75 backdrop-blur-md border border-border/60 rounded-2xl p-3.5 flex flex-col justify-between gap-2 shadow-2xs hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Bus className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
              {isRtl ? "باص الفندق" : "Shuttle"}
            </span>
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">
              {isRtl ? "مواعيد الأتوبيس" : "Next Departure"}
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isRtl ? "كل 30 دقيقة للفنادق" : "Every 30 mins to resort"}
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. EXECUTIVE STAT CARDS ── */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Documents */}
        <button
          type="button"
          onClick={onDocTab}
          className="bg-card/75 backdrop-blur-md border border-border/60 rounded-2xl p-3 text-start hover:border-cyan-500/40 hover:shadow-sm transition-all duration-200 cursor-pointer select-none flex flex-col justify-between"
        >
          <div className="w-8 h-8 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-xl flex items-center justify-center mb-2">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-foreground font-mono leading-none">
              {docCount}
            </div>
            <div className="text-[10px] text-muted-foreground font-semibold mt-1">
              {isRtl ? "المستندات" : "Documents"}
            </div>
          </div>
        </button>

        {/* Requests */}
        <button
          type="button"
          onClick={onRequestTab}
          className="bg-card/75 backdrop-blur-md border border-border/60 rounded-2xl p-3 text-start hover:border-amber-500/40 hover:shadow-sm transition-all duration-200 cursor-pointer select-none flex flex-col justify-between"
        >
          <div className="w-8 h-8 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center mb-2">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-foreground font-mono leading-none">
              {pendingRequestsCount}
            </div>
            <div className="text-[10px] text-muted-foreground font-semibold mt-1">
              {isRtl ? "الطلبات" : "Requests"}
            </div>
          </div>
        </button>

        {/* Roommates / Community */}
        <button
          type="button"
          onClick={onRoommatesTab}
          className="bg-card/75 backdrop-blur-md border border-border/60 rounded-2xl p-3 text-start hover:border-purple-500/40 hover:shadow-sm transition-all duration-200 cursor-pointer select-none flex flex-col justify-between"
        >
          <div className="w-8 h-8 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mb-2">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-foreground font-mono leading-none">
              {roommates.length}
            </div>
            <div className="text-[10px] text-muted-foreground font-semibold mt-1">
              {isRtl ? "زملاء السكن" : "Roommates"}
            </div>
          </div>
        </button>
      </div>

      {/* ── 4. HR SUPPORT CHAT BANNER ── */}
      <button
        type="button"
        onClick={onHR}
        className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-primary/10 to-amber-500/5 border border-amber-500/30 p-4 flex items-center justify-between gap-3 text-start transition-all hover:border-amber-500/50 hover:shadow-sm cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-foreground truncate">
              {isRtl ? "محادثة الموارد البشرية وإدارة السكن" : "HR & Housing Support Chat"}
            </h4>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {isRtl
                ? "تواصل مباشر وفوري مع فريق الإشراف والمتابعة"
                : "Instant direct assistance from the housing coordinators"}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
          <span>{isRtl ? "تواصل" : "Connect"}</span>
          <Chevron className="w-3.5 h-3.5" />
        </div>
      </button>

      {/* ── 4b. OFFICIAL HOUSING & HR CONTACTS (HR 1&2, HOUSING MANAGER 1&2) ── */}
      {supportContacts.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              {isRtl ? "مسؤولو الموارد البشرية وإدارة السكن" : "Official HR & Housing Contacts"}
            </h3>
            <span className="text-[10px] font-medium text-muted-foreground">
              {isRtl ? "تواصل مباشر" : "Direct Support"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {supportContacts.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-card/90 border border-border/70 shadow-2xs hover:border-primary/40 transition-all flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary mb-1">
                      {isRtl ? c.roleAr : c.roleEn}
                    </span>
                    <h4 className="text-xs font-bold text-foreground truncate">
                      {c.name || (isRtl ? "المسؤول المعتمد" : "Authorized Contact")}
                    </h4>
                    {c.title && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {c.title}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/40">
                  {c.phone && (
                    <>
                      <a
                        href={`tel:${c.phone}`}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                        title={isRtl ? "اتصال هاتفي" : "Call"}
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{isRtl ? "اتصال" : "Call"}</span>
                      </a>
                      <a
                        href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                        title="WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span className="text-[10px]">واتساب</span>
                      </a>
                    </>
                  )}
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="py-1.5 px-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                      title={c.email}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span className="text-[10px]">{isRtl ? "إيميل" : "Email"}</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. RECENT NOTIFICATIONS & ANNOUNCEMENTS ── */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            {isRtl ? "أحدث التنبيهات والفعاليات" : "Recent Alerts & Events"}
          </h3>
        </div>

        <div className="space-y-2">
          {notifications.length > 0 ? (
            notifications.map((notif, idx) => (
              <div
                key={notif.id || idx}
                className="p-3 rounded-2xl bg-card/75 border border-border/60 flex items-start gap-3 shadow-2xs"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-foreground truncate">
                    {notif.title || (isRtl ? "إشعار جديد" : "New Notice")}
                  </h4>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                    {notif.message || notif.body}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-2xl bg-card/50 border border-dashed border-border/60 text-center text-xs text-muted-foreground">
              {isRtl
                ? "لا توجد تنبيهات جديدة اليوم. يومك سعيد!"
                : "No new notifications today. Have a great day!"}
            </div>
          )}
        </div>
      </div>

      {/* ── QR CODE FULL MODAL DIALOG ── */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="w-full max-w-xs bg-card border border-border rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#1A2B4C] text-[#E0C070] flex items-center justify-center border border-white/10 shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
                {isRtl ? "تصريح السكن المعتمد" : "OFFICIAL RESIDENT PASS"}
              </div>
              <h3 className="text-base font-bold text-foreground">
                {gatePass?.fullName || employee?.fullName || firstName}
              </h3>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                ID: {gatePass?.employeeId || staffCode} · {gatePass?.roomNumber || room?.roomNumber ? `${isRtl ? "غرفة" : "Room"} ${gatePass?.roomNumber || room?.roomNumber}` : (isRtl ? "تصريح موظف" : "Staff Pass")}
              </p>
            </div>

            {/* Crisp Scannable QR Code */}
            <div className="relative">
              <ResidentQRCode
                data={
                  gatePass?.qrPayload ||
                  `SUNRISE:GATE:P${employee?.propertyId || 1}:E${staffCode}:PID${employee?.id || 0}:R${room?.roomNumber || "UNASSIGNED"}`
                }
                qrDataUrl={gatePass?.qrDataUrl}
                size={180}
                className="border-4 border-muted"
              />
              {loadingPass && !gatePass?.qrDataUrl && (
                <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center gap-1.5 pointer-events-none animate-in fade-in">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-[10px] font-bold text-foreground/80">
                    {isRtl ? "جاري التحديث..." : "Updating..."}
                  </span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[240px]">
              {isRtl
                ? "رمز مشفّر معتمد للمرور الفوري عبر البوابات الإلكترونية ومطاعم السكن"
                : "Cryptographically verified QR code for electronic gate & facility access"}
            </p>

            {/* Download pass button if QR image available */}
            {gatePass?.qrDataUrl && (
              <button
                type="button"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = gatePass.qrDataUrl;
                  a.download = `GatePass_QR_${gatePass.employeeId || staffCode}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isRtl ? "حفظ رمز الـ QR على الهاتف" : "Download Pass QR"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors cursor-pointer"
            >
              {isRtl ? "إغلاق" : "Done"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
