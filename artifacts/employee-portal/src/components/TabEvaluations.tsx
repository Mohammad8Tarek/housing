import { useState, useMemo } from "react";
import { Star, Send, Loader2, Info, BadgeCheck, Search, X } from "lucide-react";
import { useTheme } from "../lib/theme";
import { apiFetch } from "../lib/api";

interface SurveyItem {
  id: number;
  templateId: number;
  titleAr: string;
  titleEn: string;
  type: "rating" | "text" | "yes_no";
  required: boolean;
  orderIndex: number;
}

interface Evaluation {
  id: number;
  employeeId: number | null;
  rating: number | null;
  comment?: string;
  employeeResponse?: string;
  employeeRating?: number;
  category: string;
  titleAr?: string;
  titleEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  department?: string;
  submittedAt: string;
  createdAt: string;
  _hasResponded?: boolean;
  items?: SurveyItem[];
}

interface Props {
  evaluations: Evaluation[];
  onCommentAdded?: () => void;
}

function getCategoryColor(category: string): {
  bg: string;
  text: string;
  label: string;
  labelAr: string;
} {
  const map: Record<
    string,
    { bg: string; text: string; label: string; labelAr: string }
  > = {
    performance: {
      bg: "bg-blue-400/10",
      text: "text-blue-400",
      label: "Performance",
      labelAr: "الأداء",
    },
    behavior: {
      bg: "bg-green-400/10",
      text: "text-green-400",
      label: "Behavior",
      labelAr: "السلوك",
    },
    attendance: {
      bg: "bg-blue-400/10",
      text: "text-blue-400",
      label: "Attendance",
      labelAr: "الحضور",
    },
    communication: {
      bg: "bg-accent2/10",
      text: "text-accent2",
      label: "Communication",
      labelAr: "التواصل",
    },
    teamwork: {
      bg: "bg-purple-400/10",
      text: "text-purple-400",
      label: "Teamwork",
      labelAr: "العمل الجماعي",
    },
    general: {
      bg: "bg-surface",
      text: "text-muted2",
      label: "General",
      labelAr: "عام",
    },
  };
  return map[category] ?? map.general;
}

function ClickableStars({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={`transition-all ${disabled ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
        >
          <Star
            className={`w-6 h-6 ${
              star <= value ? "fill-accent2 text-accent2" : "text-border2"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function TabEvaluations({ evaluations, onCommentAdded }: Props) {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
  const [itemTexts, setItemTexts] = useState<Record<string, string>>({});
  const [itemYesNo, setItemYesNo] = useState<Record<string, string>>({});
  const [globalComment, setGlobalComment] = useState<Record<number, string>>(
    {},
  );
  const [globalRatings, setGlobalRatings] = useState<Record<number, number>>(
    {},
  );
  const [submitted, setSubmitted] = useState<Set<number>>(new Set());
  const [loadingIds, setLoadingIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "completed"
  >("all");

  const filteredEvaluations = useMemo(() => {
    return evaluations.filter((ev) => {
      const matchesSearch =
        !search ||
        ev.titleAr?.toLowerCase().includes(search.toLowerCase()) ||
        ev.titleEn?.toLowerCase().includes(search.toLowerCase()) ||
        ev.descriptionAr?.toLowerCase().includes(search.toLowerCase()) ||
        ev.descriptionEn?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "completed" &&
          (ev._hasResponded || submitted.has(ev.id))) ||
        (statusFilter === "pending" &&
          !ev._hasResponded &&
          !submitted.has(ev.id));
      return matchesSearch && matchesStatus;
    });
  }, [evaluations, search, statusFilter, submitted]);

  const handleSubmit = async (evaluationId: number, items: SurveyItem[]) => {
    const itemResponses = items.map((item) => {
      if (item.type === "rating") {
        return {
          itemId: item.id,
          ratingValue: itemRatings[`${evaluationId}-${item.id}`] || null,
        };
      } else {
        const val =
          item.type === "yes_no"
            ? itemYesNo[`${evaluationId}-${item.id}`] || null
            : itemTexts[`${evaluationId}-${item.id}`] || null;
        return { itemId: item.id, textValue: val };
      }
    });

    const body: Record<string, unknown> = {
      itemResponses,
      employeeRating: globalRatings[evaluationId] || undefined,
      employeeResponse: globalComment[evaluationId]?.trim() || undefined,
    };

    // Require at least a rating or a comment
    if (
      !body.employeeRating &&
      !body.employeeResponse &&
      itemResponses.length === 0
    )
      return;

    setLoadingIds((prev) => [...prev, evaluationId]);
    try {
      const res = await apiFetch(
        `/api/portal-data/my-evaluations/${evaluationId}/respond`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to submit");
      }

      setGlobalComment((prev) => ({ ...prev, [evaluationId]: "" }));
      setSubmitted((prev) => new Set(prev).add(evaluationId));
      onCommentAdded?.();
    } catch {
      // silent
    } finally {
      setLoadingIds((prev) => prev.filter((id) => id !== evaluationId));
    }
  };

  if (evaluations.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-foreground">
            {isRtl ? "الاستبيانات والتقييمات" : "Surveys & Evaluations"}
          </h2>
          <p className="text-muted2 text-sm mt-1">
            {isRtl
              ? "شارك برأيك في الاستبيانات المتاحة"
              : "Share your feedback in available surveys"}
          </p>
        </div>

        <div className="flex items-start gap-3 p-6 bg-accent2/5 border border-accent2/20 rounded-2xl">
          <Info className="w-5 h-5 text-accent2 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted2">
            {isRtl
              ? "لا توجد استبيانات موجهة لك في الوقت الحالي."
              : "There are no surveys assigned to you at the moment."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-foreground">
          {isRtl ? "الاستبيانات والتقييمات" : "Surveys & Evaluations"}
        </h2>
        <p className="text-muted2 text-sm mt-1">
          {isRtl
            ? "شارك برأيك في الاستبيانات المتاحة"
            : "Share your feedback in available surveys"}
        </p>
      </div>

      {/* Search & Filter */}
      <div className="space-y-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isRtl ? "بحث في التقييمات..." : "Search evaluations..."
            }
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface border border-border2 text-sm text-foreground placeholder:text-muted2 focus:outline-none focus:border-accent2/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted2 hover:text-foreground transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {(["all", "pending", "completed"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === status
                  ? "bg-accent2 text-white shadow-sm shadow-accent2/20"
                  : "bg-surface border border-border2 text-muted2 hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              {status === "all"
                ? isRtl
                  ? "الكل"
                  : "All"
                : status === "pending"
                  ? isRtl ? "قيد الانتظار" : "Pending"
                  : isRtl ? "مكتمل" : "Completed"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredEvaluations.length === 0 && evaluations.length > 0 ? (
          <div className="flex items-start gap-3 p-6 bg-surface border border-border2 rounded-2xl">
            <Search className="w-5 h-5 text-muted2 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted2">
              {isRtl ? "لا توجد نتائج مطابقة" : "No matching evaluations found"}
            </p>
          </div>
        ) : null}
        {filteredEvaluations.map((evaluation) => {
          const category = getCategoryColor(evaluation.category);
          const isLoading = loadingIds.includes(evaluation.id);
          const hasResponded = evaluation._hasResponded ?? false;
          const title = isRtl
            ? evaluation.titleAr || evaluation.titleEn
            : evaluation.titleEn || evaluation.titleAr;
          const description = isRtl
            ? evaluation.descriptionAr || evaluation.descriptionEn
            : evaluation.descriptionEn || evaluation.descriptionAr;
          const items = evaluation.items || [];

          return (
            <div
              key={evaluation.id}
              className="bg-card border border-border2 rounded-2xl p-6 space-y-4"
            >
              {/* Title & Description */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-foreground">
                    {title || evaluation.category}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${category.bg} ${category.text}`}
                  >
                    {isRtl ? category.labelAr : category.label}
                  </span>
                  {evaluation.department && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">
                      {evaluation.department}
                    </span>
                  )}
                </div>
                {description && (
                  <p className="text-sm text-muted2">{description}</p>
                )}
                <p className="text-xs text-muted2 mt-1">
                  {new Date(evaluation.createdAt).toLocaleDateString(
                    isRtl ? "ar-SA" : "en-US",
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    },
                  )}
                </p>
              </div>

              {hasResponded || submitted.has(evaluation.id) ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-green-950/10 rounded-xl border border-green-800/30">
                    <BadgeCheck className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-xs font-bold text-green-400">
                      {isRtl ? "تم التقييم بنجاح ✓" : "Evaluation submitted ✓"}
                    </span>
                  </div>
                  {evaluation.employeeRating || globalRatings[evaluation.id] ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted2">
                        {isRtl ? "تقييمك:" : "Your rating:"}
                      </span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${s <= (evaluation.employeeRating || globalRatings[evaluation.id] || 0) ? "fill-accent2 text-accent2" : "text-border2"}`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Survey Items */}
                  {items.length > 0 &&
                    items.map((item) => {
                      const itemKey = `${evaluation.id}-${item.id}`;
                      const itemTitle = isRtl ? item.titleAr : item.titleEn;

                      if (item.type === "rating") {
                        return (
                          <div key={item.id}>
                            <span className="text-xs font-bold text-muted2 uppercase tracking-widest block mb-2">
                              {itemTitle}{" "}
                              {item.required && (
                                <span className="text-red-400">*</span>
                              )}
                            </span>
                            <ClickableStars
                              value={itemRatings[itemKey] || 0}
                              onChange={(v) =>
                                setItemRatings((prev) => ({
                                  ...prev,
                                  [itemKey]: v,
                                }))
                              }
                            />
                          </div>
                        );
                      }

                      if (item.type === "yes_no") {
                        return (
                          <div key={item.id}>
                            <span className="text-xs font-bold text-muted2 uppercase tracking-widest block mb-2">
                              {itemTitle}{" "}
                              {item.required && (
                                <span className="text-red-400">*</span>
                              )}
                            </span>
                            <div className="flex gap-2">
                              {["yes", "no"].map((val) => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() =>
                                    setItemYesNo((prev) => ({
                                      ...prev,
                                      [itemKey]: val,
                                    }))
                                  }
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    itemYesNo[itemKey] === val
                                      ? val === "yes"
                                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                                      : "bg-surface border border-border2 text-muted2 hover:text-foreground"
                                  }`}
                                >
                                  {val === "yes"
                                    ? isRtl
                                      ? "نعم"
                                      : "Yes"
                                    : isRtl
                                      ? "لا"
                                      : "No"}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      // text type
                      return (
                        <div key={item.id}>
                          <span className="text-xs font-bold text-muted2 uppercase tracking-widest block mb-2">
                            {itemTitle}{" "}
                            {item.required && (
                              <span className="text-red-400">*</span>
                            )}
                          </span>
                          <textarea
                            value={itemTexts[itemKey] || ""}
                            onChange={(e) =>
                              setItemTexts((prev) => ({
                                ...prev,
                                [itemKey]: e.target.value,
                              }))
                            }
                            placeholder={
                              isRtl
                                ? "اكتب إجابتك هنا..."
                                : "Write your answer here..."
                            }
                            rows={3}
                            className="w-full bg-surface border border-border2 text-foreground rounded-xl py-3 px-4 outline-none focus:border-accent2 transition-colors placeholder:opacity-30 resize-none"
                          />
                        </div>
                      );
                    })}

                  {/* Overall star rating — shown for all evaluations */}
                  <div>
                    <span className="text-xs font-bold text-muted2 uppercase tracking-widest block mb-2">
                      {isRtl ? "تقييمك العام *" : "Overall Rating *"}
                    </span>
                    <ClickableStars
                      value={
                        globalRatings[evaluation.id] ||
                        evaluation.employeeRating ||
                        0
                      }
                      onChange={(v) =>
                        setGlobalRatings((prev) => ({
                          ...prev,
                          [evaluation.id]: v,
                        }))
                      }
                    />
                  </div>

                  {/* Global comment */}
                  <div>
                    <span className="text-xs font-bold text-muted2 uppercase tracking-widest block mb-2">
                      {isRtl ? "تعليقك (اختياري)" : "Your Comment (optional)"}
                    </span>
                    <div className="flex gap-3 items-end">
                      <textarea
                        value={globalComment[evaluation.id] || ""}
                        onChange={(e) =>
                          setGlobalComment((prev) => ({
                            ...prev,
                            [evaluation.id]: e.target.value,
                          }))
                        }
                        placeholder={
                          isRtl
                            ? "اكتب تعليقك هنا..."
                            : "Write your comment here..."
                        }
                        rows={3}
                        className="flex-1 bg-surface border border-border2 text-foreground rounded-xl py-3 px-4 outline-none focus:border-accent2 transition-colors placeholder:opacity-30 resize-none"
                      />
                      <button
                        onClick={() => handleSubmit(evaluation.id, items)}
                        disabled={
                          isLoading ||
                          (!globalRatings[evaluation.id] &&
                            !globalComment[evaluation.id]?.trim())
                        }
                        className="px-4 py-3 rounded-xl bg-accent2 text-accent2-foreground font-bold hover:scale-[1.01] active:scale-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2 flex-shrink-0"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
