import { useState, useMemo } from "react";
import {
  FileText,
  Search,
  Download,
  ExternalLink,
  X,
  Info,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import MaterialIcon from "./MaterialIcon";

interface Doc {
  id: number;
  titleAr: string;
  titleEn: string;
  fileName: string;
  fileType: string;
  fileData: string;
  category: string;
  createdAt: string;
}

interface Props {
  documents: Doc[];
}

function openDoc(doc: Doc) {
  const match = doc.fileData.match(/^data:(.+?);base64,(.+)$/);
  if (match) {
    const mime = match[1];
    const b64 = match[2];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } else {
    const a = document.createElement("a");
    a.href = doc.fileData;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }
}

const FILE_ICONS: Record<string, { icon: string; color: string }> = {
  "application/pdf": { icon: "picture_as_pdf", color: "text-red-400" },
  "image/": { icon: "image", color: "text-accent2" },
  "application/msword": { icon: "description", color: "text-blue-400" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    icon: "description",
    color: "text-blue-400",
  },
};

function getFileIcon(fileType: string) {
  if (!fileType) return { icon: "description", color: "text-accent2" };
  for (const [prefix, val] of Object.entries(FILE_ICONS)) {
    if (fileType.startsWith(prefix)) return val;
  }
  if (fileType.includes("sheet") || fileType.includes("excel"))
    return { icon: "contract", color: "text-green-400" };
  return { icon: "article", color: "text-accent2" };
}

export default function TabDocuments({ documents }: Props) {
  const { t, lang } = useTheme();
  const isRtl = lang === "ar";
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const getTitle = (doc: Doc) =>
    (isRtl ? doc.titleAr || doc.titleEn : doc.titleEn || doc.titleAr) ||
    doc.fileName;

  const categories = useMemo(() => {
    const cats = new Set(documents.map((d) => d.category).filter(Boolean));
    return ["all", ...Array.from(cats)];
  }, [documents]);

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        !search ||
        doc.titleAr?.toLowerCase().includes(search.toLowerCase()) ||
        doc.titleEn?.toLowerCase().includes(search.toLowerCase()) ||
        doc.fileName?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || doc.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [documents, search, categoryFilter]);

  const categoryLabels: Record<string, { ar: string; en: string }> = {
    all: { ar: "الكل", en: "All" },
    policy: { ar: "سياسات", en: "Policies" },
    payroll: { ar: "رواتب", en: "Payroll" },
    training: { ar: "تدريب", en: "Training" },
    contract: { ar: "عقود", en: "Contract" },
    form: { ar: "نماذج", en: "Forms" },
    announcement: { ar: "إعلانات", en: "Announcements" },
    other: { ar: "أخرى", en: "Other" },
  };

  const formatDate = (d: string) => {
    try {
      const date = new Date(d);
      return date.toLocaleDateString(isRtl ? "ar-SA" : "en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const recentDocs = search ? filtered.slice(0, 5) : documents.slice(0, 5);

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Search */}
      <div className="relative mb-4">
        <div className="relative flex items-center bg-card border border-border2 rounded-xl px-3">
          <MaterialIcon
            icon="search"
            size={18}
            className="text-muted2 flex-shrink-0"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isRtl ? "ابحث في مستنداتك..." : "Find Your Documents"}
            className="w-full bg-transparent py-2.5 px-2 text-sm text-foreground placeholder:text-muted2/70 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="p-1.5 text-muted2 hover:text-foreground transition-colors mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Tabs */}
      {categories.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide mb-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "bg-surface text-muted2 hover:bg-surface-hover hover:text-foreground border border-border/40"
              }`}
            >
              {cat === "All" ? (isRtl ? "الكل" : "All") : cat}
            </button>
          ))}
        </div>
      )}

      {documents.length > 0 ? (
        <div className="space-y-4">
          {/* Recent Documents */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">
                {isRtl ? "المستندات الحديثة" : "Recent Documents"}
              </h3>
              <button className="text-[10px] font-bold text-accent2 hover:text-accent2/80 transition-colors flex items-center gap-1">
                {isRtl ? "عرض الكل" : "View All History"}
                <MaterialIcon
                  icon={isRtl ? "chevron_left" : "chevron_right"}
                  size={14}
                />
              </button>
            </div>
            <div className="space-y-2.5">
              {recentDocs.map((doc) => {
                const fi = getFileIcon(doc.fileType);
                return (
                  <button
                    key={doc.id}
                    onClick={() => openDoc(doc)}
                    className="w-full text-start bg-card border border-border2 rounded-xl p-3.5 hover:border-accent2/30 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-surface border border-border2 flex items-center justify-center flex-shrink-0">
                          <MaterialIcon
                            icon={fi.icon}
                            size={20}
                            className={fi.color}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-foreground leading-snug">
                            {getTitle(doc)}
                          </div>
                          <div className="text-[10px] text-muted2 mt-0.5">
                            {isRtl ? "تم الرفع: " : "Uploaded: "}
                            {formatDate(doc.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-1 rounded-lg bg-accent2/10 text-accent2 font-semibold flex items-center gap-1">
                          <MaterialIcon icon="download" size={12} />
                          {isRtl ? "عرض" : "View"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* All Documents Table */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">
              {isRtl ? "جميع المستندات" : "All Documents"}
            </h3>
            <div className="bg-card border border-border2 rounded-xl overflow-hidden">
              <div className="hidden sm:grid grid-cols-4 gap-4 px-4 py-2.5 bg-surface border-b border-border2 text-[10px] font-bold uppercase tracking-wider text-muted2">
                <span>{isRtl ? "اسم المستند" : "Document Name"}</span>
                <span>{isRtl ? "تاريخ الرفع" : "Date Uploaded"}</span>
                <span>{isRtl ? "النوع" : "Type"}</span>
                <span className="text-center">
                  {isRtl ? "إجراءات" : "Actions"}
                </span>
              </div>
              {filtered.length > 0 ? (
                filtered.map((doc) => {
                  const fi = getFileIcon(doc.fileType);
                  return (
                    <div
                      key={doc.id}
                      className="sm:grid sm:grid-cols-4 sm:gap-4 px-4 py-3 border-b border-border2 last:border-b-0 hover:bg-accent2/5 transition-colors cursor-pointer items-center"
                      onClick={() => openDoc(doc)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface border border-border2 flex items-center justify-center flex-shrink-0">
                          <MaterialIcon
                            icon={fi.icon}
                            size={16}
                            className={fi.color}
                          />
                        </div>
                        <div className="text-[12px] font-semibold text-foreground truncate">
                          {getTitle(doc)}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted2 hidden sm:block">
                        {formatDate(doc.createdAt)}
                      </div>
                      <div className="hidden sm:block">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            doc.category === "policy"
                              ? "bg-blue-400/10 text-blue-400"
                              : doc.category === "payroll"
                                ? "bg-green-400/10 text-green-400"
                                : doc.category === "training"
                                  ? "bg-amber-400/10 text-amber-400"
                                  : doc.category === "contract"
                                    ? "bg-purple-400/10 text-purple-400"
                                    : "bg-accent2/10 text-accent2"
                          }`}
                        >
                          {isRtl
                            ? (
                                {
                                  policy: "سياسة",
                                  payroll: "راتب",
                                  training: "تدريب",
                                  contract: "عقد",
                                } as Record<string, string>
                              )[doc.category] || doc.category
                            : doc.category.charAt(0).toUpperCase() +
                              doc.category.slice(1)}
                        </span>
                      </div>
                      <div className="flex justify-end sm:justify-center mt-2 sm:mt-0">
                        <button className="w-8 h-8 rounded-lg hover:bg-surface transition-colors flex items-center justify-center">
                          <MaterialIcon
                            icon="more_vert"
                            size={16}
                            className="text-muted2"
                          />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-muted2 text-sm">
                  {isRtl
                    ? "لا توجد نتائج مطابقة"
                    : "No matching documents found"}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-6 bg-accent2/5 border border-accent2/20 rounded-2xl">
          <Info className="w-5 h-5 text-accent2 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted2">
            {isRtl
              ? "لا توجد مستندات مرفوعة حالياً."
              : "No documents uploaded yet."}
          </p>
        </div>
      )}
    </div>
  );
}
