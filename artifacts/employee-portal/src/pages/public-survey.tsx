// Public, anonymous survey page opened from a shareable link / QR code.
// No login. Pick your department, answer the sectioned questions on a 5-point
// scale (with an optional "Not applicable"), and submit. Works standalone.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";

type Item = {
  id: number;
  titleAr: string;
  titleEn: string;
  type: "rating" | "text" | "yes_no";
  required: boolean;
  allowNa: boolean;
  sectionAr: string | null;
  sectionEn: string | null;
  orderIndex: number;
};
type Survey = {
  id: number;
  titleAr: string | null;
  titleEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  opensAt: string | null;
  expiresAt: string | null;
  items: Item[];
};

const SCALE = [
  { v: 5, ar: "ممتاز", en: "Excellent" },
  { v: 4, ar: "جيد جداً", en: "Very good" },
  { v: 3, ar: "جيد", en: "Good" },
  { v: 2, ar: "مقبول", en: "Acceptable" },
  { v: 1, ar: "سيء", en: "Poor" },
];

function getRespondentKey(token: string): string {
  const k = `survey_resp_${token}`;
  try {
    const existing = localStorage.getItem(k);
    if (existing) return existing;
    const v: string =
      (crypto as any)?.randomUUID?.() ??
      Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(k, v);
    return v;
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

// Branded page wrapper. Declared at module scope (not inside PublicSurvey) so
// it keeps a stable identity across renders — satisfies
// react-hooks/static-components and avoids remounting its subtree.
function Shell({
  ar,
  onToggleLang,
  children,
}: {
  ar: boolean;
  onToggleLang: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      className="min-h-[100dvh] bg-gradient-to-br from-[#0F2A44] via-[#1a365d] to-[#0d2238] text-white px-4 py-6"
    >
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[#C9A24D] font-extrabold text-xl tracking-wide">
            SUNRISE
          </div>
          <button
            onClick={onToggleLang}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/10 border border-white/15"
          >
            {ar ? "English" : "العربية"}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function PublicSurvey() {
  const params = useParams();
  const token = String((params as any).token || "");
  const [ar, setAr] = useState(true);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<
    "open" | "not_started" | "closed" | "not_found" | "error"
  >("open");
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [department, setDepartment] = useState("");
  const [answers, setAnswers] = useState<
    Record<number, { rating?: number; text?: string; na?: boolean }>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/public/surveys/${encodeURIComponent(token)}`,
        );
        const data = await res.json();
        if (!alive) return;
        if (!res.ok || !data.success) {
          setState("not_found");
        } else {
          setState(data.state);
          setSurvey(data.survey);
          setDepartments(data.departments || []);
        }
      } catch {
        if (alive) setState("error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  // Group items by section, preserving order.
  const sections = useMemo(() => {
    const out: { key: string; ar: string; en: string; items: Item[] }[] = [];
    const idx = new Map<string, number>();
    for (const it of survey?.items ?? []) {
      const key = (it.sectionEn || it.sectionAr || "").trim() || "__none__";
      if (!idx.has(key)) {
        idx.set(key, out.length);
        out.push({
          key,
          ar: it.sectionAr || it.sectionEn || "",
          en: it.sectionEn || it.sectionAr || "",
          items: [],
        });
      }
      out[idx.get(key)!].items.push(it);
    }
    return out;
  }, [survey]);

  const setAns = (
    id: number,
    patch: { rating?: number; text?: string; na?: boolean },
  ) => setAnswers((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  const firstMissing = (): Item | null => {
    for (const it of survey?.items ?? []) {
      if (!it.required) continue;
      const a = answers[it.id];
      if (it.type === "rating" && !(a?.rating || a?.na)) return it;
      if (it.type === "yes_no" && a?.rating == null && !a?.na) return it;
      if (it.type === "text" && !(a?.text && a.text.trim())) return it;
    }
    return null;
  };

  const submit = async () => {
    setError("");
    if (departments.length > 0 && !department) {
      setError(ar ? "اختر القسم أولاً" : "Select your department first");
      return;
    }
    const miss = firstMissing();
    if (miss) {
      setError(
        ar
          ? "فضلاً أجب على كل الأسئلة المطلوبة"
          : "Please answer all required questions",
      );
      const el = document.getElementById(`q-${miss.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        department: department || undefined,
        respondentKey: getRespondentKey(token),
        answers: Object.entries(answers).map(([id, a]) => ({
          itemId: Number(id),
          rating: a.rating,
          text: a.text,
          na: a.na,
        })),
      };
      const res = await fetch(
        `/api/public/surveys/${encodeURIComponent(token)}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setDone(true);
      } else if (data.code === "ALREADY_SUBMITTED") {
        setError(
          ar
            ? "لقد أرسلت هذا الاستبيان من قبل"
            : "You already submitted this survey",
        );
      } else if (data.code === "SURVEY_CLOSED") {
        setState("closed");
      } else {
        setError(data.message || (ar ? "تعذّر الإرسال" : "Could not submit"));
      }
    } catch {
      setError(ar ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLang = () => setAr((v) => !v);

  if (loading)
    return (
      <Shell ar={ar} onToggleLang={toggleLang}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-[#C9A24D]" />
        </div>
      </Shell>
    );

  if (done)
    return (
      <Shell ar={ar} onToggleLang={toggleLang}>
        <div className="bg-white/10 border border-white/15 rounded-3xl p-8 text-center mt-10">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">
            {ar ? "شكراً لمشاركتك! 🎉" : "Thank you for your feedback! 🎉"}
          </h2>
          <p className="text-white/70 text-sm">
            {ar
              ? "تم استلام إجابتك بسرية تامة."
              : "Your response has been recorded confidentially."}
          </p>
        </div>
      </Shell>
    );

  if (state === "not_found" || state === "error")
    return (
      <Shell ar={ar} onToggleLang={toggleLang}>
        <div className="bg-white/10 border border-white/15 rounded-3xl p-8 text-center mt-10">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-3" />
          <p className="text-white/80">
            {ar ? "هذا الاستبيان غير متاح." : "This survey is not available."}
          </p>
        </div>
      </Shell>
    );

  if (state === "not_started" || state === "closed")
    return (
      <Shell ar={ar} onToggleLang={toggleLang}>
        <div className="bg-white/10 border border-white/15 rounded-3xl p-8 text-center mt-10">
          <Clock className="w-14 h-14 text-amber-400 mx-auto mb-3" />
          <p className="text-white/85 font-semibold">
            {state === "not_started"
              ? ar
                ? "لم يبدأ الاستبيان بعد."
                : "This survey hasn't started yet."
              : ar
                ? "انتهت فترة هذا الاستبيان."
                : "This survey is now closed."}
          </p>
        </div>
      </Shell>
    );

  const title =
    (ar ? survey?.titleAr : survey?.titleEn) ||
    survey?.titleEn ||
    survey?.titleAr ||
    "";
  const desc = (ar ? survey?.descriptionAr : survey?.descriptionEn) || "";

  return (
    <Shell ar={ar} onToggleLang={toggleLang}>
      <div className="bg-white/10 border border-white/15 rounded-3xl p-5 mb-4">
        <h1 className="text-lg font-bold mb-1">{title}</h1>
        {desc && (
          <p className="text-white/70 text-[13px] leading-relaxed">{desc}</p>
        )}
        <p className="text-[11px] text-white/50 mt-2">
          {ar
            ? "إجاباتك سرية تماماً — لا نطلب أي بيانات تعريفية."
            : "Your answers are completely confidential — no personal data requested."}
        </p>
      </div>

      {/* Department selection */}
      {departments.length > 0 && (
        <div className="bg-white/10 border border-white/15 rounded-2xl p-4 mb-4">
          <label className="text-sm font-semibold block mb-2">
            {ar ? "القسم التابع له" : "Your department"}{" "}
            <span className="text-red-300">*</span>
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full bg-[#0F2A44] border border-white/20 rounded-xl py-3 px-3 text-white outline-none"
          >
            <option value="">{ar ? "— اختر —" : "— Select —"}</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Questions grouped by section */}
      {sections.map((sec) => (
        <div key={sec.key} className="mb-5">
          {sec.key !== "__none__" && (
            <div className="text-[#E2C37A] font-bold text-sm mb-2 px-1">
              {ar ? sec.ar : sec.en}
            </div>
          )}
          <div className="space-y-3">
            {sec.items.map((it, i) => {
              const a = answers[it.id] || {};
              const qText =
                (ar ? it.titleAr : it.titleEn) || it.titleEn || it.titleAr;
              return (
                <div
                  key={it.id}
                  id={`q-${it.id}`}
                  className="bg-white/10 border border-white/15 rounded-2xl p-4"
                >
                  <div className="text-[13px] font-medium mb-3 leading-relaxed">
                    <span className="text-white/50">{i + 1}.</span> {qText}
                    {it.required && <span className="text-red-300"> *</span>}
                  </div>

                  {it.type === "rating" && (
                    <div className="flex flex-wrap gap-1.5">
                      {SCALE.map((s) => (
                        <button
                          key={s.v}
                          onClick={() =>
                            setAns(it.id, { rating: s.v, na: false })
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                            a.rating === s.v && !a.na
                              ? "bg-[#C9A24D] text-[#0F2A44]"
                              : "bg-white/10 border border-white/15 text-white/80"
                          }`}
                        >
                          {ar ? s.ar : s.en}
                        </button>
                      ))}
                      {it.allowNa && (
                        <button
                          onClick={() =>
                            setAns(it.id, { na: true, rating: undefined })
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                            a.na
                              ? "bg-white/80 text-[#0F2A44]"
                              : "bg-white/10 border border-white/15 text-white/60"
                          }`}
                        >
                          {ar ? "لا ينطبق" : "N/A"}
                        </button>
                      )}
                    </div>
                  )}

                  {it.type === "yes_no" && (
                    <div className="flex gap-2">
                      {[
                        { v: 1, ar: "نعم", en: "Yes" },
                        { v: 0, ar: "لا", en: "No" },
                      ].map((o) => (
                        <button
                          key={o.v}
                          onClick={() =>
                            setAns(it.id, { rating: o.v, na: false })
                          }
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold ${
                            a.rating === o.v
                              ? "bg-[#C9A24D] text-[#0F2A44]"
                              : "bg-white/10 border border-white/15"
                          }`}
                        >
                          {ar ? o.ar : o.en}
                        </button>
                      ))}
                    </div>
                  )}

                  {it.type === "text" && (
                    <textarea
                      value={a.text || ""}
                      onChange={(e) => setAns(it.id, { text: e.target.value })}
                      rows={3}
                      placeholder={
                        ar ? "اكتب إجابتك..." : "Type your answer..."
                      }
                      className="w-full bg-[#0F2A44] border border-white/20 rounded-xl py-2.5 px-3 text-white text-sm outline-none placeholder:text-white/30"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {error && (
        <div className="bg-red-500/15 border border-red-500/30 text-red-200 text-[13px] rounded-xl p-3 mb-3">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full bg-[#C9A24D] hover:bg-[#E2C37A] text-[#0F2A44] font-bold rounded-2xl py-4 flex items-center justify-center gap-2 disabled:opacity-60 mb-10"
      >
        {submitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>{ar ? "إرسال" : "Submit"}</>
        )}
      </button>
    </Shell>
  );
}
