import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Info,
  Loader2,
  Check,
  Heart,
  Star,
  X,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { apiFetch } from "../lib/api";

interface Activity {
  id: number;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  category?: string;
  locationAr?: string;
  locationEn?: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  maxParticipants?: number;
  status?: string;
  coverImage?: string;
  registrationStatus?: string;
}

export default function TabActivities() {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const [activities, setActivities] = useState<Activity[]>([]);
  const [registrations, setRegistrations] = useState<Record<number, string>>(
    {},
  );
  const [categoryMap, setCategoryMap] = useState<
    Record<string, { ar: string; en: string }>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [submittingRating, setSubmittingRating] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/portal-data/my-activities", {
        credentials: "include",
      }).then((r) => r.json()),
      apiFetch("/api/portal-data/catalog", { credentials: "include" })
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([data, catalog]) => {
        if (catalog?.activityCategories) {
          const map: Record<string, { ar: string; en: string }> = {};
          catalog.activityCategories.forEach((c: any) => {
            map[c.key] = { ar: c.nameAr, en: c.name };
          });
          setCategoryMap(map);
        }
        if (Array.isArray(data)) {
          setActivities(data);
          const regs: Record<number, string> = {};
          data.forEach((a: Activity) => {
            if (a.registrationStatus) regs[a.id] = a.registrationStatus;
          });
          setRegistrations(regs);
        } else if (data && data.success && Array.isArray(data.activities)) {
          setActivities(data.activities);
          const regs: Record<number, string> = {};
          data.activities.forEach((a: Activity) => {
            if (a.registrationStatus) regs[a.id] = a.registrationStatus;
          });
          setRegistrations(regs);
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const getTitle = (a: Activity) =>
    isRtl ? a.titleAr || a.titleEn : a.titleEn || a.titleAr;
  const getDescription = (a: Activity) =>
    isRtl
      ? a.descriptionAr || a.descriptionEn
      : a.descriptionEn || a.descriptionAr;
  const getLocation = (a: Activity) =>
    isRtl ? a.locationAr || a.locationEn : a.locationEn || a.locationAr;

  const getCategoryLabel = (key?: string) => {
    if (!key) return "";
    const m = categoryMap[key];
    return m ? (isRtl ? m.ar : m.en) : key;
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(isRtl ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return d;
    }
  };

  const statusColor = (s?: string) => {
    const map: Record<string, string> = {
      planned: "bg-accent2/10 text-accent2",
      ongoing: "bg-green-400/10 text-green-400",
      completed: "bg-blue-400/10 text-blue-400",
      cancelled: "bg-red-400/10 text-red-400",
    };
    return map[s ?? ""] ?? "bg-surface text-muted2";
  };

  const statusLabel = (s?: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      planned: { ar: "مخطط", en: "Planned" },
      ongoing: { ar: "جاري", en: "Ongoing" },
      completed: { ar: "مكتمل", en: "Completed" },
      cancelled: { ar: "ملغي", en: "Cancelled" },
    };
    const m = map[s ?? ""];
    return m ? (isRtl ? m.ar : m.en) : (s ?? "-");
  };

  const handleRegister = async (activityId: number, status: string) => {
    setRegisteringId(activityId);
    try {
      const res = await apiFetch(`/api/portal-data/activity-registration`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId, status }),
      });
      if (res.ok) {
        setRegistrations((prev) => ({ ...prev, [activityId]: status }));
      }
    } catch {
      // silent
    } finally {
      setRegisteringId(null);
    }
  };

  const handleCancelRegistration = async (activityId: number) => {
    setRegisteringId(activityId);
    try {
      const res = await apiFetch("/api/portal-data/activity-registration", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId }),
      });
      if (res.ok) {
        setRegistrations((prev) => {
          const next = { ...prev };
          delete next[activityId];
          return next;
        });
      }
    } catch {
      // silent
    } finally {
      setRegisteringId(null);
    }
  };

  const handleRate = async (activityId: number, rating: number) => {
    setSubmittingRating(activityId);
    try {
      await apiFetch("/api/portal-feedback/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: "activity",
          contentId: activityId,
          rating,
        }),
      });
      setRatings((prev) => ({ ...prev, [activityId]: rating }));
    } catch {
      /* silent */
    } finally {
      setSubmittingRating(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-accent2 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-foreground">
          {isRtl ? "الفعاليات والأنشطة" : "Activities & Events"}
        </h2>
        <p className="text-muted2 text-sm mt-1">
          {isRtl
            ? "تعرف على الفعاليات والأنشطة القادمة"
            : "Discover upcoming activities and events"}
        </p>
      </div>

      {activities.length === 0 ? (
        <div className="flex items-start gap-3 p-6 bg-accent2/5 border border-accent2/20 rounded-2xl">
          <Info className="w-5 h-5 text-accent2 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted2">
            {isRtl
              ? "لا توجد فعاليات حالياً. سيتم عرض الفعاليات هنا عند إضافتها من قبل الإدارة."
              : "No activities yet. Activities will appear here once added by management."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((a) => {
            const regStatus = registrations[a.id] || a.registrationStatus;
            return (
              <div
                key={a.id}
                className="bg-card border border-border2 rounded-2xl overflow-hidden"
              >
                {/* Cover Image */}
                {a.coverImage && (
                  <div className="relative h-40 md:h-48 overflow-hidden">
                    <img
                      src={a.coverImage}
                      alt={getTitle(a)}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                    <span
                      className={`absolute bottom-3 start-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(a.status)}`}
                    >
                      {statusLabel(a.status)}
                    </span>
                  </div>
                )}

                <div className="p-6 space-y-4">
                  {!a.coverImage && (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-foreground">
                          {getTitle(a)}
                        </h3>
                        <span
                          className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(a.status)}`}
                        >
                          {statusLabel(a.status)}
                        </span>
                      </div>
                    </div>
                  )}

                  {a.coverImage && (
                    <h3 className="text-lg font-bold text-foreground -mt-2">
                      {getTitle(a)}
                    </h3>
                  )}

                  {a.category && (
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent2/10 text-accent2">
                      {getCategoryLabel(a.category)}
                    </span>
                  )}

                  {getDescription(a) && (
                    <p className="text-sm text-muted2 leading-relaxed">
                      {getDescription(a)}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-4 text-xs text-muted2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-accent2" />
                      {formatDate(a.startDate)}
                      {a.endDate && ` — ${formatDate(a.endDate)}`}
                    </div>
                    {a.startTime && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-accent2" />
                        {a.startTime}
                      </div>
                    )}
                    {getLocation(a) && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-accent2" />
                        {getLocation(a)}
                      </div>
                    )}
                    {a.maxParticipants && (
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-accent2" />
                        {isRtl
                          ? `الحد الأقصى: ${a.maxParticipants}`
                          : `Max: ${a.maxParticipants}`}
                      </div>
                    )}
                  </div>

                  {/* Registration Buttons */}
                  {a.status !== "cancelled" && a.status !== "completed" && (
                    <div className="space-y-2 pt-2 border-t border-border2">
                      <div className="flex gap-2">
                        {regStatus === "joined" ? (
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500/10 text-green-400 text-xs font-bold">
                              <Check className="w-3.5 h-3.5" />
                              {isRtl ? "تم الانضمام" : "Joined"}
                            </span>
                            <button
                              onClick={() => handleCancelRegistration(a.id)}
                              disabled={registeringId === a.id}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all disabled:opacity-50"
                            >
                              {registeringId === a.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <X className="w-3.5 h-3.5" />
                              )}
                              {isRtl ? "إلغاء" : "Cancel"}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleRegister(a.id, "joined")}
                            disabled={registeringId === a.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent2 text-accent2-foreground text-xs font-bold hover:scale-[1.02] active:scale-100 transition-all disabled:opacity-50"
                          >
                            {registeringId === a.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            {isRtl ? "انضمام" : "Join"}
                          </button>
                        )}
                        {regStatus === "interested" ? (
                          <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent2/10 text-accent2 text-xs font-bold">
                            <Heart className="w-3.5 h-3.5 fill-accent2" />
                            {isRtl ? "مهتم" : "Interested"}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRegister(a.id, "interested")}
                            disabled={registeringId === a.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface border border-border2 text-muted2 hover:text-foreground text-xs font-bold hover:border-accent2/30 transition-all disabled:opacity-50"
                          >
                            <Heart className="w-3.5 h-3.5" />
                            {isRtl ? "مهتم" : "Interested"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Feedback Stars */}
                  {a.status !== "planned" && (
                    <div className="mt-4 pt-4 border-t border-border2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted2 font-medium">
                          {isRtl ? "تقييمك للفعالية" : "Rate this activity"}
                        </span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => handleRate(a.id, star)}
                              disabled={submittingRating === a.id}
                              className={`p-1 transition-transform hover:scale-110 active:scale-90 ${submittingRating === a.id ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <Star
                                className={`w-5 h-5 ${
                                  (ratings[a.id] || 0) >= star
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted2/30 hover:text-amber-400/50"
                                } transition-colors`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
