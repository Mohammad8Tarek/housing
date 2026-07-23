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
import { ArrowLeft, CheckCircle, XCircle, Clock, Loader2, Home, ExternalLink, Users, Edit, Trash2 } from "lucide-react";

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
  const { canEdit, canDelete } = usePermission();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/hosting-requests/:id");
  const requestId = params?.id;

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
      queryClient.setQueryData(["/api/hosting-requests", requestId], signedData);
      if (signedData?.status === "approved") {
        try {
          await fetch(`/api/hosting-requests/${requestId}/create-guest-hosting`, { method: "POST" });
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
      const res = await fetch(`/api/hosting-requests/${requestId}/create-guest-hosting`, {
        method: "POST",
      });
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
      const res = await fetch(`/api/hostings/${guestHostingId}?propertyId=${dataPropertyId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message);
      return json.data;
    },
    enabled: !!guestHostingId,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-1 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError && ((error as any)?.status === 403 || (error as any)?.message?.toLowerCase().includes("not allowed"))) {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full w-20 h-20 flex items-center justify-center mb-4">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">
          {ar ? "غير مصرح بالوصول" : "Permission Denied"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {ar ? "عذراً، ليس لديك الصلاحية لعرض هذه الصفحة أو التعامل مع هذا الطلب." : "Sorry, you don't have permission to view this page or handle this request."}
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
  const currentStep = steps.find((s: any) => s.stepOrder === request.currentStepOrder);
  const userHasSignature = Boolean(mySignature?.signatureImageUrl);
  const currentUserJobTitle = (user as any)?.jobTitle || (user as any)?.job_title;
    
    const requiredRoleKey = approvalRoleKey(currentStep?.roleRequired);
    const userRoles = user?.roles || [];
    const isAuthorizedToSign = isSystemAdmin || (Boolean(requiredRoleKey) && (
      approvalRoleKey(currentUserJobTitle) === requiredRoleKey ||
      userRoles.some((r: string) => approvalRoleKey(r) === requiredRoleKey)
    ));
    const userCanAct = currentStep?.status === "pending" && isAuthorizedToSign;


  const hostingStatusLabels: Record<string, { en: string; ar: string }> = {
    PENDING: { en: "Pending Approval", ar: "قيد الانتظار" },
    APPROVED: { en: "Approved", ar: "معتمد" },
    ACTIVE: { en: "Active", ar: "نشط" },
    COMPLETED: { en: "Completed", ar: "مكتمل" },
  };

  const hostingStatusVariants: Record<string, "warning" | "success" | "info" | "muted"> = {
    PENDING: "warning",
    APPROVED: "success",
    ACTIVE: "info",
    COMPLETED: "muted",
  };

  const hostingStatusVariant =
    request.guestHostingStatus ? hostingStatusVariants[request.guestHostingStatus] ?? "muted" : "muted";
  const hostingStatusLabel =
    request.guestHostingStatus ? hostingStatusLabels[request.guestHostingStatus] : null;

  const statusBadgeVariant: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
    in_signing: "warning",
    approved: "success",
    rejected: "danger",
  };

    const getStepState = (step: any) => {
      const status = String(step.status ?? "").toLowerCase();
      const rejected = status === "rejected";
      const returned = status === "returned";
      const signed = status === "signed" || status === "approved" || (Boolean(step.signedAt || step.signatureImageUrlSnapshot) && !rejected && !returned);
      const active = request.status === "in_signing" && step.stepOrder === request.currentStepOrder && !signed && !rejected && !returned;
      return { signed, rejected, returned, active };
    };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/hosting-requests")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {request.requestNumber}
            </h1>
            <StatusBadge
              label={
                request.status === "approved" ? (ar ? "معتمد" : "Approved") :
                request.status === "rejected" ? (ar ? "مرفوض" : "Rejected") :
                request.status === "in_signing" ? (ar ? "قيد التوقيع" : "In Signing") :
                request.status
              }
              variant={statusBadgeVariant[request.status] ?? "muted"}
            />
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {request.employeeName} — {request.department}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit("hosting_requests") && (
            <Button variant="outline" onClick={() => setLocation(`/hosting-requests/${request.id}/edit`)}>
              <Edit className="w-4 h-4 mr-2" />
              {ar ? "تعديل" : "Edit"}
            </Button>
          )}
          {canDelete("hosting_requests") && (
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              {ar ? "حذف" : "Delete"}
            </Button>
          )}
        </div>
      </div>

      {/* Request Details */}
      <div className="flex flex-col gap-6">
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-6">
            {ar ? "بيانات طلب الاستضافة" : "Hosting Request Data"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "الموظف" : "NAME"}</span>
              <span className="font-medium">{request.employeeName}</span>
            </div>
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "الوظيفة" : "POSITION"}</span>
              <span className="font-medium">{request.position || "-"}</span>
            </div>
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "القسم" : "DEPARTMENT"}</span>
              <span className="font-medium">{request.department || "-"}</span>
            </div>
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "الرقم الوظيفي" : "CLOCK NUMBER"}</span>
              <span className="font-medium">{request.clockNumber || "-"}</span>
            </div>
                        <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "عدد الغرف" : "ROOMS"}</span>
              <div className="flex items-center">
                <Badge variant="secondary" className="bg-muted text-foreground hover:bg-muted font-bold rounded-full">{request.numberOfRooms || "-"}</Badge>
              </div>
            </div>
            {request.assignedRoomNumber && (
              <div className="flex flex-col border-b pb-3">
                <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "غرفة الاستضافة المعينة" : "ASSIGNED HOSTING ROOM"}</span>
                <span className="font-medium text-primary">{request.assignedRoomNumber}</span>
              </div>
            )}

            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "أفراد العائلة" : "FAMILY MEMBERS"}</span>
              <div className="flex items-center">
                <Badge variant="secondary" className="bg-muted text-foreground hover:bg-muted font-bold rounded-full">{request.familyMembersCount}</Badge>
                {request.familyMembersIncluded && <span className="text-sm text-muted-foreground ml-2">({request.familyMembersIncluded})</span>}
              </div>
            </div>
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "تاريخ الوصول" : "CHECK-IN DATE"}</span>
              <span className="font-medium">{request.fromDate ? new Date(request.fromDate).toLocaleDateString('en-GB') : "-"}</span>
            </div>
            <div className="flex flex-col border-b pb-3">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "تاريخ المغادرة" : "CHECK-OUT DATE"}</span>
              <span className="font-medium">{request.toDate ? new Date(request.toDate).toLocaleDateString('en-GB') : "-"}</span>
            </div>
            {request.remarks && (
              <div className="flex flex-col md:col-span-2 border-b pb-3">
                <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "ملاحظات" : "REMARKS"}</span>
                <span className="font-medium">{request.remarks}</span>
              </div>
            )}
            {request.attachmentData && (
              <div className="flex flex-col md:col-span-2 border-b pb-3">
                <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{ar ? "المرفقات" : "ATTACHMENT"}</span>
                <a href={request.attachmentData} download="attachment" target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-2 font-medium">
                  <ExternalLink className="w-4 h-4" />
                  {ar ? "عرض المرفق" : "View Attachment"}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Approval Chain */}
        <div className="bg-card text-card-foreground shadow-sm rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-6">
            {ar ? "مسار الاعتماد" : "Approval Workflow"}
          </h2>
          <div className="flex flex-wrap gap-4">
            {steps.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {ar ? "لا توجد خطوات اعتماد" : "No approval steps"}
              </p>
            ) : (
              steps.map((step: any, idx: number) => {
                const roleName = stepRoles[step.roleRequired]?.[language] ?? step.roleRequired;
                const { signed: isSigned, rejected: isRejected, returned: isReturned, active: isActive } = getStepState(step);

                let cardClasses = "flex flex-col items-center justify-center p-4 rounded-lg border w-48 text-center bg-card";
                let iconClasses = "w-10 h-10 rounded-lg flex items-center justify-center mb-3";
                
                if (isSigned) {
                  cardClasses += " border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20";
                  iconClasses += " text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50";
                } else if (isRejected) {
                  cardClasses += " border-red-500 bg-red-50/50 dark:bg-red-950/20";
                  iconClasses += " text-red-600 bg-red-100 dark:bg-red-900/50";
                } else if (isReturned) {
                  cardClasses += " border-amber-500 bg-amber-50/50 dark:bg-amber-950/20";
                  iconClasses += " text-amber-600 bg-amber-100 dark:bg-amber-900/50";
                } else if (isActive) {
                  cardClasses += " border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm";
                  iconClasses += " text-amber-600 bg-amber-100 dark:bg-amber-900/50";
                } else {
                  cardClasses += " border-border";
                  iconClasses += " text-muted-foreground bg-muted";
                }

                return (
                  <div key={step.id} className={cardClasses}>
                    <div className={iconClasses}>
                      {isSigned ? <CheckCircle className="w-5 h-5" /> :
                       isRejected ? <XCircle className="w-5 h-5" /> :
                       isReturned ? <ArrowLeft className="w-5 h-5" /> :
                       isActive ? <Clock className="w-5 h-5" /> :
                       <Users className="w-5 h-5" />}
                    </div>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                      {roleName}
                    </span>
                    <span className="text-sm font-bold mt-1 text-foreground line-clamp-1">
                      {step.signerName || step.signed_by_user_id || "-"}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-1 min-h-[16px]">
                      {step.signedAt ? new Date(step.signedAt).toLocaleString('en-GB') : ""}
                    </span>
                    <div className="mt-4 w-full px-2 text-center">
                      {step.signatureImageUrlSnapshot ? (
                        <div className="mb-3 flex justify-center">
                          <div className="w-[180px] h-[84px] bg-white rounded border shadow-sm flex items-center justify-center p-2">
                            <img src={step.signatureImageUrlSnapshot} alt="Signature" className="max-h-full max-w-full object-contain" />
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3 flex justify-center">
                          <div className="w-[180px] h-[84px] bg-muted/20 rounded border border-dashed text-muted-foreground flex items-center justify-center">
                            <span className="text-xs">{ar ? "لا يوجد توقيع" : "No signature"}</span>
                          </div>
                        </div>
                      )}
                      {isSigned ? (
                        <div className="bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded mx-auto w-fit">
                          APPROVED
                        </div>
                      ) : isRejected ? (
                        <div className="bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded mx-auto w-fit">
                          REJECTED
                        </div>
                      ) : isReturned ? (
                        <div className="bg-amber-600 text-white text-[10px] font-bold px-3 py-1 rounded mx-auto w-fit">
                          RETURNED
                        </div>
                      ) : (isActive && userCanAct) ? (
                        <div className="pt-3 border-t border-amber-200 dark:border-amber-900/30 flex flex-col gap-2 w-full">
                          {!userHasSignature ? (
                            <div className="text-center">
                              <span className="text-[10px] text-amber-700 leading-tight block mb-1">
                                {ar ? "يرجى رفع توقيعك في الإعدادات قبل الاعتماد" : "Please upload your signature in Settings before signing"}
                              </span>
                              <Button variant="link" size="sm" className="px-1 h-6 text-[10px] underline" onClick={() => setLocation("/settings")}>
                                {ar ? "الإعدادات" : "Settings"}
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Button size="sm" className="w-full text-xs h-8" onClick={() => signMutation.mutate()} disabled={signMutation.isPending}>
                                {signMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                                {ar ? "اعتماد" : "Approve"}
                              </Button>
                              <Button size="sm" variant="outline" className="w-full text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => setShowRejectDialog(true)}>
                                <XCircle className="w-3 h-3 mr-1 text-red-500" />
                                {ar ? "رفض" : "Reject"}
                              </Button>
                              {currentStep?.stepOrder > 1 && (
                                <Button size="sm" variant="outline" className="w-full text-xs h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30" onClick={() => setShowRebackDialog(true)}>
                                  <ArrowLeft className="w-3 h-3 mr-1" />
                                  {ar ? "إرجاع" : "Return"}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      ) : isActive ? (
                        <div className="bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded mx-auto w-fit">
                          PENDING
                        </div>
                      ) : (
                        <div className="bg-muted text-muted-foreground text-[10px] font-bold px-3 py-1 rounded mx-auto w-fit">
                          PENDING
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6">
            {request.status === "in_signing" && currentStep && (
              <div className="space-y-3">
                    {/* Reback dialog */}
                    {showRebackDialog && (
                      <div className="p-3 border rounded-lg space-y-3 bg-amber-50/50 border-amber-200">
                        <p className="text-sm font-medium text-amber-800">
                          {ar ? "سبب الإرجاع" : "Return Reason"}
                        </p>
                        <Textarea
                          rows={3}
                          value={rebackReason}
                          onChange={(e) => setRebackReason(e.target.value)}
                          placeholder={ar ? "اكتب سبب إرجاع الطلب..." : "Enter reason for returning..."}
                          className="border-amber-200 focus-visible:ring-amber-500"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700"
                            onClick={() => rebackMutation.mutate()}
                            disabled={!rebackReason.trim() || rebackMutation.isPending}
                          >
                            {rebackMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <ArrowLeft className="w-4 h-4 mr-2" />
                            )}
                            {ar ? "تأكيد الإرجاع" : "Confirm Return"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setShowRebackDialog(false); setRebackReason(""); }}
                          >
                            {ar ? "إلغاء" : "Cancel"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Reject dialog */}
                    {showRejectDialog && (
                      <div className="p-3 border rounded-lg space-y-3 bg-muted/30">
                        <p className="text-sm font-medium">
                          {ar ? "سبب الرفض" : "Rejection Reason"}
                        </p>
                        <Textarea
                          rows={3}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={ar ? "اكتب سبب الرفض..." : "Enter rejection reason..."}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectMutation.mutate()}
                            disabled={!rejectReason.trim() || rejectMutation.isPending}
                          >
                            {rejectMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-2" />
                            )}
                            {ar ? "تأكيد الرفض" : "Confirm Reject"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setShowRejectDialog(false); setRejectReason(""); }}
                          >
                            {ar ? "إلغاء" : "Cancel"}
                          </Button>
                        </div>
                      </div>
                    )}
              </div>
            )}
            </div>
          </div>
        </div>

      {/* Housing Card — الحالة السكنية */}
      {request.status === "approved" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Home className="w-5 h-5" />
              {ar ? "السكن" : "Housing"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {request.guestHostingId ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {ar ? "طلب الاستضافة" : "Guest Hosting"}
                    </p>
                    {hostingStatusLabel && (
                      <StatusBadge
                        label={ar ? hostingStatusLabel.ar : hostingStatusLabel.en}
                        variant={hostingStatusVariant}
                      />
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/accommodation/guest-hosting`)}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    {ar ? "عرض" : "View"}
                  </Button>
                </div>
                {guestHosting && (
                  <div className="grid grid-cols-2 gap-3 text-sm p-3 bg-muted/30 rounded-lg">
                    <div>
                      <span className="text-muted-foreground">{ar ? "رقم الطلب" : "ID"}</span>
                      <p className="font-medium">#{guestHosting.id}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{ar ? "عدد الضيوف" : "Guests"}</span>
                      <p className="font-medium">{guestHosting.guestsCount}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{ar ? "من" : "From"}</span>
                      <p className="font-medium">{new Date(guestHosting.expectedFrom).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{ar ? "إلى" : "To"}</span>
                      <p className="font-medium">{new Date(guestHosting.expectedTo).toLocaleDateString()}</p>
                    </div>
                    {guestHosting.roomId && (
                      <div>
                        <span className="text-muted-foreground">{ar ? "الغرفة" : "Room"}</span>
                        <p className="font-medium">{guestHosting.roomId}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-emerald-600 font-medium">
                  {ar
                    ? "تم اعتماد الطلب وتم إنشاء سجل الاستضافة تلقائياً. يمكنك الانتقال إلى قسم السكن."
                    : "Request approved and Guest Hosting record has been created automatically. You can proceed to the housing section."}
                </p>
                <Button
                  variant="outline"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setLocation("/accommodation/guest-hosting")}
                >
                  <Home className="w-4 h-4 mr-2" />
                  {ar ? "الذهاب إلى الاستضافات" : "Go to Guest Hosting"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Previous Requests Link */}
      <div className="flex justify-start pt-2">
        <Button variant="link" onClick={() => setLocation("/hosting-requests")}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          {ar ? "العودة إلى الطلبات" : "Back to Requests"}
        </Button>
      </div>
      <AnimatedConfirmModal
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={ar ? "حذف الطلب" : "Delete Request"}
        description={ar ? "هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء." : "Are you sure you want to delete this request? This action cannot be undone."}
        confirmLabel={ar ? "حذف" : "Delete"}
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
