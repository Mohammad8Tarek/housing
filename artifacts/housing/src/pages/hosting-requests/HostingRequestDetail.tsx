import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import { AnimatedConfirmModal } from "@/components/shared/AnimatedConfirmModal";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { usePermission } from "@/hooks/use-permission";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Home,
  ExternalLink,
  Users,
  Edit,
  Trash2,
} from "lucide-react";

const stepRoles: Record<string, Record<string, string>> = {
  housing_manager: { en: "Housing Manager", ar: "مدير السكن" },
  hr_manager: { en: "HR Manager", ar: "مدير الموارد البشرية" },
  accounts_manager: { en: "Accounts Manager", ar: "مدير الحسابات" },
};

function approvalRoleKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function HostingRequestDetail() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const { user, isSystemAdmin } = useAuth();
  const { canView, canEdit, canDelete } = usePermission();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/hosting-requests/:id");
  const requestId = params?.id;

  // ── Page-level permission guard ──────────────────────────────────────────
  // If the user has no view permission, block access immediately
  if (!isSystemAdmin && !canView("hosting_requests")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5V9m0 0V7m0 2h2M12 9H10M4.93 4.93l14.14 14.14" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {ar ? "غير مصرح بالوصول" : "You don't have permission"}
          </h2>
          <p className="text-muted-foreground max-w-sm">
            {ar
              ? "ليس لديك صلاحية لعرض هذه الصفحة. تواصل مع المسؤول إذا كنت تعتقد أن هذا خطأ."
              : "You don't have permission to view this page. Contact your administrator if you believe this is an error."}
          </p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/")} className="rounded-full">
          {ar ? "العودة للرئيسية" : "Back to Home"}
        </Button>
      </div>
    );
  }

  const queryClient = useQueryClient();

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRebackDialog, setShowRebackDialog] = useState(false);
  const [rebackReason, setRebackReason] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["/api/hosting-requests", requestId],
    queryFn: async () => {
      const res = await fetch(`/api/hosting-requests/${requestId}`);
      const json = await res.json();
      if (!res.ok) {
        const err: any = new Error(json.message);
        err.status = res.status;
        throw err;
      }
      return json.data;
    },
    enabled: !!requestId,
  });

  const { data: mySignature } = useQuery({
    queryKey: ["/api/users/me/signature"],
    queryFn: async () => {
      const res = await fetch("/api/users/me/signature");
      return res.json();
    },
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/hosting-requests/${requestId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json.data;
    },
    onSuccess: async (signedData) => {
      toast.success(ar ? "تم الاعتماد بنجاح" : "Successfully approved");
      queryClient.setQueryData(
        ["/api/hosting-requests", requestId],
        signedData,
      );
      if (signedData?.status === "approved") {
        try {
          await fetch(
            `/api/hosting-requests/${requestId}/create-guest-hosting`,
            { method: "POST" },
          );
        } catch {}
        setLocation("/accommodation/guest-hosting");
      } else {
        refetch();
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const rebackMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/hosting-requests/${requestId}/reback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rebackReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json.data;
    },
    onSuccess: () => {
      toast.success(ar ? "تم إعادة الطلب بنجاح" : "Successfully returned");
      setRebackReason("");
      setShowRebackDialog(false);
      refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/hosting-requests/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json.data;
    },
    onSuccess: () => {
      toast.success(ar ? "تم الرفض بنجاح" : "Successfully rejected");
      setRejectReason("");
      setShowRejectDialog(false);
      refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createGuestHostingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/hosting-requests/${requestId}/create-guest-hosting`,
        {
          method: "POST",
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json.data;
    },
    onSuccess: (data) => {
      toast.success(ar ? "تم إنشاء طلب الاستضافة" : "Guest hosting created");
      setLocation(`/accommodation/guest-hosting`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/hosting-requests/${requestId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json.data;
    },
    onSuccess: () => {
      toast.success(ar ? "تم الحذف بنجاح" : "Successfully deleted");
      setLocation("/hosting-requests");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const guestHostingId = data?.guestHostingId;
  const dataPropertyId = data?.propertyId;
  const { data: guestHosting } = useQuery({
    queryKey: ["/api/hostings", guestHostingId],
    queryFn: async () => {
      if (!guestHostingId) return null;
      const res = await fetch(
        `/api/hostings/${guestHostingId}?propertyId=${dataPropertyId}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message);
      return json.data;
    },
    enabled: !!guestHostingId,
    refetchInterval: 30000,
  });

  const clockNumber = data?.clockNumber;
  const { data: hostingHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["hosting-history", clockNumber],
    queryFn: async () => {
      if (!clockNumber) return [];
      const res = await fetch(
        `/api/hosting-requests/history/${encodeURIComponent(clockNumber)}`,
      );
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!clockNumber,
  });

  // Fetch employee details (including photo) by clock number
  const { data: employeeData } = useQuery({
    queryKey: ["employee-photo", clockNumber, data?.propertyId],
    queryFn: async () => {
      if (!clockNumber) return null;
      const propId = data?.propertyId || "";
      const res = await fetch(
        `/api/employees/search?q=${encodeURIComponent(clockNumber)}&propertyId=${propId}`,
      );
      if (!res.ok) return null;
      const arr = await res.json();
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const exact = arr.find((e: any) => String(e.employeeId) === String(clockNumber));
      return exact || arr[0];
    },
    enabled: !!clockNumber && !!data?.propertyId,
    staleTime: 5 * 60 * 1000, // cache for 5 min
  });

  const employeePhotoUrl = employeeData?.photoUrl || employeeData?.photo_url || null;

  if (isLoading) {
    return (
      <div className="space-y-4 p-1 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (
    isError &&
    ((error as any)?.status === 403 ||
      (error as any)?.message?.toLowerCase().includes("not allowed"))
  ) {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full w-20 h-20 flex items-center justify-center mb-4">
          <svg
            className="w-10 h-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">
          {ar ? "غير مصرح بالوصول" : "Permission Denied"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {ar
            ? "عذراً، ليس لديك الصلاحية لعرض هذه الصفحة أو التعامل مع هذا الطلب."
            : "Sorry, you don't have permission to view this page or handle this request."}
        </p>
        <Button onClick={() => setLocation("/")} variant="default">
          {ar ? "العودة للرئيسية" : "Back to Home"}
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        {ar ? "الطلب غير موجود" : "Request not found"}
      </div>
    );
  }

  const request = data;
  const steps = request.approvalSteps || [];
  const currentStep = steps.find(
    (s: any) => s.stepOrder === request.currentStepOrder,
  );
  const userHasSignature = Boolean(mySignature?.signatureImageUrl);
  const currentUserJobTitle =
    (user as any)?.jobTitle || (user as any)?.job_title;

  const requiredRoleKey = approvalRoleKey(currentStep?.roleRequired);
  const userRoles = user?.roles || [];
  const isAuthorizedToSign =
    Boolean(requiredRoleKey) &&
    (approvalRoleKey(currentUserJobTitle) === requiredRoleKey ||
      userRoles.some((r: string) => approvalRoleKey(r) === requiredRoleKey));
  const userCanAct = currentStep?.status === "pending" && isAuthorizedToSign;

  const hostingStatusLabels: Record<string, { en: string; ar: string }> = {
    PENDING: { en: "Pending Approval", ar: "قيد الانتظار" },
    APPROVED: { en: "Approved", ar: "معتمد" },
    ACTIVE: { en: "Active", ar: "نشط" },
    COMPLETED: { en: "Completed", ar: "مكتمل" },
  };

  const hostingStatusVariants: Record<
    string,
    "warning" | "success" | "info" | "muted"
  > = {
    PENDING: "warning",
    APPROVED: "success",
    ACTIVE: "info",
    COMPLETED: "muted",
  };

  const hostingStatusVariant = request.guestHostingStatus
    ? (hostingStatusVariants[request.guestHostingStatus] ?? "muted")
    : "muted";
  const hostingStatusLabel = request.guestHostingStatus
    ? hostingStatusLabels[request.guestHostingStatus]
    : null;

  const statusBadgeVariant: Record<
    string,
    "success" | "warning" | "danger" | "info" | "muted"
  > = {
    in_signing: "warning",
    approved: "success",
    rejected: "danger",
  };

  const getStepState = (step: any) => {
    const status = String(step.status ?? "").toLowerCase();
    const rejected = status === "rejected";
    const returned = status === "returned";
    const signed =
      status === "signed" ||
      status === "approved" ||
      (Boolean(step.signedAt || step.signatureImageUrlSnapshot) &&
        !rejected &&
        !returned);
    const active =
      request.status === "in_signing" &&
      step.stepOrder === request.currentStepOrder &&
      !signed &&
      !rejected &&
      !returned;
    return { signed, rejected, returned, active };
  };

  const mainStatusVariant =
    request.status === "approved"
      ? "success"
      : request.status === "rejected"
        ? "danger"
        : "warning";
  const mainStatusLabel = {
    en:
      request.status === "approved"
        ? "Approved"
        : request.status === "rejected"
          ? "Rejected"
          : "In Signing",
    ar:
      request.status === "approved"
        ? "معتمد"
        : request.status === "rejected"
          ? "مرفوض"
          : "قيد التوقيع",
  };

  return (
    <div className="relative min-h-[calc(100vh-6rem)] p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Background Glow Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[100px] opacity-50 dark:opacity-30"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] opacity-50 dark:opacity-30"></div>
      </div>

      {/* Header section (Glassmorphism) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-background/60 backdrop-blur-xl border border-white/10 shadow-lg p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              {ar ? "تفاصيل طلب الاستضافة" : "Hosting Request Details"}
            </h1>
            <Badge
              variant="outline"
              className="text-xs px-2 py-0.5 rounded-full border-primary/30 bg-primary/10 text-primary"
            >
              #{requestId}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>{ar ? "تاريخ الإنشاء" : "Created Date"}:</span>
            <span className="text-foreground">
              {new Date(request.createdAt).toLocaleDateString(
                ar ? "ar-EG" : "en-US",
                { year: "numeric", month: "long", day: "numeric" },
              )}
            </span>
            <span className="text-foreground/50 mx-1">•</span>
            <span>{ar ? "المُنشئ" : "Creator"}:</span>
            <span className="text-foreground">
              {request.creatorName || request.user_id}
            </span>
          </div>
        </div>

        <div className="relative flex flex-col md:flex-row gap-3 items-end md:items-center">
          <div className="flex items-center gap-2 bg-background/50 p-1.5 pr-4 rounded-full border shadow-sm">
            <div
              className={`w-2 h-2 rounded-full ${request.status === "approved" ? "bg-emerald-500 animate-pulse" : request.status === "rejected" ? "bg-red-500" : "bg-amber-500 animate-pulse"}`}
            ></div>
            <StatusBadge
              label={ar ? mainStatusLabel.ar : mainStatusLabel.en}
              variant={mainStatusVariant}
            />
          </div>
          {canDelete("hosting_requests") && request.status === "in_signing" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-full shadow-lg hover:shadow-red-500/25 transition-all"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {ar ? "حذف الطلب" : "Delete"}
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Details */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden rounded-2xl">
            <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/50 to-transparent" />

            {/* ── Employee Profile Section ── */}
            <CardHeader className="pb-0">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                {ar ? "بيانات الموظف والضيوف" : "Employee & Guest Information"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              {/* Employee Profile Banner */}
              <div className="flex flex-col sm:flex-row items-start gap-5 p-5 rounded-2xl bg-gradient-to-br from-primary/5 via-muted/30 to-transparent border relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-[0.03]">
                  <Users className="w-40 h-40 -mt-6 -mr-6" />
                </div>
                {/* Avatar / Photo */}
                <div className="relative">
                  {employeePhotoUrl ? (
                    <img
                      src={employeePhotoUrl}
                      alt={request.employeeName || "Employee"}
                      className="w-16 h-16 rounded-2xl object-cover shadow-lg shadow-primary/20 border-2 border-primary/20"
                      onError={(e) => {
                        // Fall back to initials if image fails to load
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary/20"
                    style={{ display: employeePhotoUrl ? "none" : "flex" }}
                  >
                    {(request.employeeName ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                </div>
                {/* Name & Key Info */}
                <div className="flex-1 space-y-2 relative">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">
                      {request.employeeName || "N/A"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {request.position || request.department
                        ? `${request.position || ""}${request.position && request.department ? " • " : ""}${request.department || ""}`
                        : ar ? "لا توجد بيانات وظيفية" : "No job data available"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                      <Clock className="w-3 h-3" />
                      {ar ? "رقم البصمة" : "Clock"}: {request.clockNumber || "N/A"}
                    </span>
                    {request.requestNumber && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border">
                        {ar ? "طلب رقم" : "Request"} #{request.requestNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Employee Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1 p-4 rounded-xl bg-muted/30 border border-white/5 hover:bg-muted/50 transition-colors">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
                    {ar ? "الاسم الكامل" : "Full Name"}
                  </span>
                  <p className="font-semibold text-sm text-foreground">
                    {request.employeeName || "N/A"}
                  </p>
                </div>
                <div className="space-y-1 p-4 rounded-xl bg-muted/30 border border-white/5 hover:bg-muted/50 transition-colors">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
                    {ar ? "رقم البصمة" : "Clock Number"}
                  </span>
                  <p className="font-semibold text-sm font-mono text-foreground">
                    {request.clockNumber || "N/A"}
                  </p>
                </div>
                <div className="space-y-1 p-4 rounded-xl bg-muted/30 border border-white/5 hover:bg-muted/50 transition-colors">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
                    {ar ? "القسم" : "Department"}
                  </span>
                  <p className="font-semibold text-sm text-foreground">
                    {request.department || (ar ? "غير محدد" : "Not specified")}
                  </p>
                </div>
                <div className="space-y-1 p-4 rounded-xl bg-muted/30 border border-white/5 hover:bg-muted/50 transition-colors">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
                    {ar ? "المنصب" : "Position"}
                  </span>
                  <p className="font-semibold text-sm text-foreground">
                    {request.position || (ar ? "غير محدد" : "Not specified")}
                  </p>
                </div>
              </div>

              {/* ── Visit Details Section ── */}
              <div className="pt-2 border-t">
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {ar ? "تفاصيل الزيارة" : "Visit Details"}
                </h4>

                {/* Dates Row */}
                <div className="grid grid-cols-2 gap-4 p-5 rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 relative overflow-hidden mb-4">
                  <div className="absolute right-0 top-0 opacity-5">
                    <Clock className="w-32 h-32 -mt-4 -mr-4" />
                  </div>
                  <div className="relative">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                      {ar ? "تاريخ الوصول" : "Check-in Date"}
                    </span>
                    <p className="font-bold text-xl">
                      {request.fromDate
                        ? new Date(request.fromDate).toLocaleDateString(ar ? "ar-EG" : "en-US", { day: "numeric", month: "short", year: "numeric" })
                        : "N/A"}
                    </p>
                  </div>
                  <div className="relative">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                      {ar ? "تاريخ المغادرة" : "Check-out Date"}
                    </span>
                    <p className="font-bold text-xl">
                      {request.toDate
                        ? new Date(request.toDate).toLocaleDateString(ar ? "ar-EG" : "en-US", { day: "numeric", month: "short", year: "numeric" })
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Guest & Room Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1 p-4 rounded-xl bg-muted/30 border border-white/5 hover:bg-muted/50 transition-colors">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
                      {ar ? "عدد الضيوف" : "Guest Count"}
                    </span>
                    <p className="font-bold text-lg text-primary">
                      {request.familyMembersCount}
                    </p>
                  </div>
                  <div className="space-y-1 p-4 rounded-xl bg-muted/30 border border-white/5 hover:bg-muted/50 transition-colors">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
                      {ar ? "الصلة" : "Included"}
                    </span>
                    <p className="font-semibold text-sm">
                      {request.familyMembersIncluded || "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1 p-4 rounded-xl bg-muted/30 border border-white/5 hover:bg-muted/50 transition-colors">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
                      {ar ? "الأيام المستهلكة" : "Days"}
                    </span>
                    <p className="font-bold text-lg">
                      {request.consumedDays ?? "0"}
                    </p>
                  </div>
                  <div className="space-y-1 p-4 rounded-xl bg-muted/30 border border-white/5 hover:bg-muted/50 transition-colors">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold block">
                      {ar ? "الغرفة المعينة" : "Assigned Room"}
                    </span>
                    <p className="font-bold text-lg text-primary">
                      {request.assignedRoomNumber ||
                        (ar ? "لم يتم التعيين" : "Not Assigned")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              {request.remarks && (
                <div className="space-y-2 pt-2 border-t">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    {ar ? "ملاحظات / سبب الزيارة" : "Remarks / Reason"}
                  </span>
                  <div className="p-4 rounded-xl bg-muted/30 border border-white/5 leading-relaxed text-sm">
                    {request.remarks}
                  </div>
                </div>
              )}

              {/* Attachment */}
              {request.attachmentData && (
                <div className="pt-2 border-t">
                  <a
                    href={request.attachmentData}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium text-sm border border-primary/20"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {ar ? "عرض المرفق" : "View Attachment"}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hosting History Card */}
          <Card className="bg-background/60 backdrop-blur-xl border-blue-500/20 shadow-xl overflow-hidden rounded-2xl">
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-blue-500/50 to-transparent" />
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Clock className="w-5 h-5" />
                {ar ? "سجلات الاستضافات السابقة" : "Previous Hosting Records"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : hostingHistory && hostingHistory.length > 0 ? (
                <div className="rounded-md border bg-card overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>{ar ? "رقم الطلب" : "Request #"}</TableHead>
                        <TableHead>{ar ? "من" : "From"}</TableHead>
                        <TableHead>{ar ? "إلى" : "To"}</TableHead>
                        <TableHead>{ar ? "الأيام" : "Days"}</TableHead>
                        <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hostingHistory.map((h: any) => (
                        <TableRow key={h.id}>
                          <TableCell className="font-medium">
                            {h.requestNumber}
                          </TableCell>
                          <TableCell>
                            {new Date(h.fromDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {new Date(h.toDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{h.consumedDays}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                h.status === "approved" || h.status === "active"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {h.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {ar
                    ? "لا توجد استضافات سابقة لهذا الموظف"
                    : "No previous hosting records for this employee"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Housing Card */}
          {request.status === "approved" && (
            <Card className="bg-background/60 backdrop-blur-xl border-emerald-500/20 shadow-xl overflow-hidden rounded-2xl">
              <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-transparent" />
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Home className="w-5 h-5" />
                  {ar ? "حالة التسكين" : "Housing Status"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {request.guestHostingId ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            {ar
                              ? "طلب الاستضافة الفعلي"
                              : "Active Guest Hosting"}
                          </p>
                          {hostingStatusLabel && (
                            <div className="mt-1">
                              <StatusBadge
                                label={
                                  ar
                                    ? hostingStatusLabel.ar
                                    : hostingStatusLabel.en
                                }
                                variant={hostingStatusVariant}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full shadow-sm hover:shadow border-emerald-200 text-emerald-700"
                        onClick={() =>
                          setLocation(`/accommodation/guest-hosting`)
                        }
                      >
                        {ar ? "عرض السجل" : "View Record"}
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                    {guestHosting && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                        <div>
                          <span className="text-xs text-muted-foreground block mb-1">
                            {ar ? "رقم السجل" : "Record ID"}
                          </span>
                          <p className="font-bold">#{guestHosting.id}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block mb-1">
                            {ar ? "الغرفة" : "Room"}
                          </span>
                          <p className="font-bold">
                            {guestHosting.roomId || "-"}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block mb-1">
                            {ar ? "من" : "From"}
                          </span>
                          <p className="font-bold">
                            {new Date(
                              guestHosting.expectedFrom,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block mb-1">
                            {ar ? "إلى" : "To"}
                          </span>
                          <p className="font-bold">
                            {new Date(
                              guestHosting.expectedTo,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                    <div className="flex-1 space-y-1 text-center sm:text-start">
                      <p className="text-sm text-emerald-700 dark:text-emerald-400 font-bold">
                        {ar
                          ? "تم اعتماد الطلب وتم إنشاء سجل الاستضافة تلقائياً."
                          : "Request approved and Guest Hosting record created."}
                      </p>
                      <p className="text-xs text-emerald-600/70">
                        {ar
                          ? "يمكنك الآن متابعة إجراءات التسكين من قسم السكن."
                          : "You can proceed to housing management now."}
                      </p>
                    </div>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full whitespace-nowrap shadow-lg shadow-emerald-500/20"
                      onClick={() =>
                        setLocation("/accommodation/guest-hosting")
                      }
                    >
                      <Home className="w-4 h-4 mr-2" />
                      {ar ? "إدارة التسكين" : "Manage Housing"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Workflow (Stepper) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-background/60 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden rounded-2xl sticky top-6">
            <CardHeader className="pb-4 bg-muted/10 border-b border-white/5">
              <CardTitle className="text-lg font-bold">
                {ar ? "مسار الاعتماد" : "Approval Workflow"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative p-6">
                <div className="absolute left-[39px] top-8 bottom-8 w-0.5 bg-border z-0" />

                <div className="space-y-8 relative z-10">
                  {steps.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      {ar ? "لا توجد خطوات اعتماد" : "No approval steps"}
                    </p>
                  ) : (
                    steps.map((step: any, idx: number) => {
                      const roleName =
                        stepRoles[step.roleRequired]?.[language] ??
                        step.roleRequired;
                      const { signed, rejected, returned, active } =
                        getStepState(step);

                      return (
                        <div key={step.id} className="relative flex gap-4">
                          <div
                            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 bg-background ${signed ? "border-emerald-500 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : rejected ? "border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]" : returned ? "border-amber-500 text-amber-500" : active ? "border-primary text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)] animate-pulse" : "border-muted-foreground/30 text-muted-foreground"}`}
                          >
                            {signed ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : rejected ? (
                              <XCircle className="w-5 h-5" />
                            ) : active ? (
                              <Clock className="w-5 h-5" />
                            ) : (
                              <Users className="w-4 h-4" />
                            )}
                          </div>

                          <div
                            className={`flex-1 pt-1 space-y-2 ${active ? "" : "opacity-80"}`}
                          >
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                                {roleName}
                              </p>
                              <p
                                className={`text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}
                              >
                                {step.signerName ||
                                  step.signed_by_user_id ||
                                  (ar ? "في الانتظار" : "Pending")}
                              </p>
                            </div>

                            {step.signedAt && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(step.signedAt).toLocaleString(
                                  ar ? "ar-EG" : "en-GB",
                                )}
                              </p>
                            )}

                            {step.signatureImageUrlSnapshot && (
                              <div className="mt-2 w-[140px] h-[60px] bg-white rounded-lg border shadow-sm p-1">
                                <img
                                  src={step.signatureImageUrlSnapshot}
                                  alt="Signature"
                                  className="w-full h-full object-contain filter contrast-125"
                                />
                              </div>
                            )}

                            {active && userCanAct && (
                              <div className="mt-4 p-3 rounded-xl bg-background border border-primary/20 shadow-lg shadow-primary/5 space-y-3 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                                {!userHasSignature ? (
                                  <div className="text-center p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-100 dark:border-amber-900/50">
                                    <span className="text-xs text-amber-700 block mb-2 font-medium">
                                      {ar
                                        ? "يرجى إضافة توقيعك في الإعدادات لتتمكن من الاعتماد"
                                        : "Please add your signature in settings to approve"}
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="rounded-full h-7 text-xs bg-white dark:bg-background"
                                      onClick={() => setLocation("/settings")}
                                    >
                                      {ar
                                        ? "الذهاب للإعدادات"
                                        : "Go to Settings"}
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md border-0"
                                      onClick={() => signMutation.mutate()}
                                      disabled={signMutation.isPending}
                                    >
                                      {signMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      ) : (
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                      )}
                                      {ar ? "اعتماد الطلب" : "Approve"}
                                    </Button>
                                    <div className="flex gap-2">
                                      {currentStep?.stepOrder > 1 && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-1 rounded-full text-amber-600 border-amber-200 hover:bg-amber-50"
                                          onClick={() =>
                                            setShowRebackDialog(true)
                                          }
                                        >
                                          <ArrowLeft className="w-3 h-3 mr-1" />
                                          {ar ? "إرجاع" : "Return"}
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 rounded-full text-red-600 border-red-200 hover:bg-red-50"
                                        onClick={() =>
                                          setShowRejectDialog(true)
                                        }
                                      >
                                        <XCircle className="w-3 h-3 mr-1" />
                                        {ar ? "رفض" : "Reject"}
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Return/Reject Dialogs (Inline) */}
                            {active && showRebackDialog && (
                              <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-xl space-y-2">
                                <Textarea
                                  rows={2}
                                  className="text-xs resize-none rounded-lg bg-background"
                                  placeholder={
                                    ar ? "سبب الإرجاع..." : "Return reason..."
                                  }
                                  value={rebackReason}
                                  onChange={(e) =>
                                    setRebackReason(e.target.value)
                                  }
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="flex-1 rounded-full h-7 text-xs bg-amber-600 hover:bg-amber-700"
                                    onClick={() => rebackMutation.mutate()}
                                    disabled={
                                      !rebackReason.trim() ||
                                      rebackMutation.isPending
                                    }
                                  >
                                    {ar ? "تأكيد" : "Confirm"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flex-1 rounded-full h-7 text-xs"
                                    onClick={() => {
                                      setShowRebackDialog(false);
                                      setRebackReason("");
                                    }}
                                  >
                                    {ar ? "إلغاء" : "Cancel"}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {active && showRejectDialog && (
                              <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-xl space-y-2">
                                <Textarea
                                  rows={2}
                                  className="text-xs resize-none rounded-lg bg-background"
                                  placeholder={
                                    ar ? "سبب الرفض..." : "Rejection reason..."
                                  }
                                  value={rejectReason}
                                  onChange={(e) =>
                                    setRejectReason(e.target.value)
                                  }
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="flex-1 rounded-full h-7 text-xs"
                                    onClick={() => rejectMutation.mutate()}
                                    disabled={
                                      !rejectReason.trim() ||
                                      rejectMutation.isPending
                                    }
                                  >
                                    {ar ? "تأكيد" : "Confirm"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flex-1 rounded-full h-7 text-xs"
                                    onClick={() => {
                                      setShowRejectDialog(false);
                                      setRejectReason("");
                                    }}
                                  >
                                    {ar ? "إلغاء" : "Cancel"}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-start pt-4">
        <Button
          variant="ghost"
          className="rounded-full hover:bg-muted/50"
          onClick={() => setLocation("/hosting-requests")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {ar ? "العودة للقائمة" : "Back to List"}
        </Button>
      </div>

      <AnimatedConfirmModal
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={ar ? "حذف الطلب" : "Delete Request"}
        description={
          ar
            ? "هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء."
            : "Are you sure you want to delete this request? This action cannot be undone."
        }
        confirmLabel={ar ? "حذف نهائي" : "Delete Permanently"}
        cancelLabel={ar ? "إلغاء" : "Cancel"}
        variant="destructive"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          deleteMutation.mutate();
        }}
      />
    </div>
  );
}
