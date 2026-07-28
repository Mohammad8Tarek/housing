import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCheck,
  Clock,
  CheckCircle2,
  X,
} from "lucide-react";
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
}

export default function RequestDetails() {
  const { t, lang } = useTheme();
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();

  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
        setRequest((d as { requests: Request[] }).requests[0]);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

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

  const si = statusInfo[request.status] ?? statusInfo.open;
  const sLabel =
    request.status === "open"
      ? t("status.open")
      : request.status === "in_progress"
        ? t("status.in_progress")
        : request.status === "resolved"
          ? t("status.resolved")
          : t("status.closed");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
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
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-4xl w-full">
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
