// @ts-nocheck
import { useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useListAssignments,
  useListRooms,
  useListBuildings,
  useListFloors,
  useGetSettings,
  useListProperties,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { useProperty } from "@/context/PropertyContext";
import {
  User,
  Briefcase,
  Building2,
  Phone,
  Camera,
  Calendar,
  MapPin,
  Globe2,
  Shield,
  ArrowLeft,
  BedDouble,
  History,
  Home,
  Printer,
  Download,
  Trash2,
  Eye,
  ExternalLink,
  FileText,
  Clock,
  CalendarPlus,
  X,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { formatDate } from "@/lib/date-utils";
import { generateHousingLetterPdf } from "@/lib/pdf-utils";
import {
  usePrintLanguage,
  PrintLanguageDialog,
} from "@/lib/PrintLanguageDialog";

function ProfileAvatar({
  firstName,
  lastName,
  photoUrl,
  size = "lg",
}: {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: "md" | "lg";
}) {
  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const dim = size === "lg" ? "w-24 h-24 text-3xl" : "w-12 h-12 text-base";
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={initials}
        className={`${dim} rounded-full object-cover border-4 border-background shadow-lg flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full bg-primary/10 border-4 border-background shadow-lg flex items-center justify-center flex-shrink-0`}
    >
      <span className="font-bold text-primary">{initials}</span>
    </div>
  );
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ENDED: "bg-gray-100 text-gray-700",
    TRANSFERRED: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-green-100 text-green-700",
    CHECKED_OUT: "bg-orange-100 text-orange-700",
    CANCELLED: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
};

export default function ProfileDetail() {
  const { id } = useParams();
  const profileId = Number(id);
  const { language } = useLanguage();
  const { activePropertyId } = useProperty();
  const ar = language === "ar";
  const { langDialogOpen, openDialog, handleSelect, handleCancel } =
    usePrintLanguage();

  const { data: settings } = useGetSettings({
    query: { enabled: !!activePropertyId },
  });
  const [vacationModalOpen, setVacationModalOpen] = useState(false);
  const [vacationStartDate, setVacationStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [vacationEndDate, setVacationEndDate] = useState("");
  const [vacationNotes, setVacationNotes] = useState("");
  const [vacationSubmitting, setVacationSubmitting] = useState(false);

  const vacationDurationDays = () => {
    if (!vacationStartDate || !vacationEndDate) return null;
    const s = new Date(vacationStartDate);
    const e = new Date(vacationEndDate);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : null;
  };

  const handleConfirmVacationFromDetail = async () => {
    if (!vacationStartDate || !vacationEndDate) {
      toast.error(ar ? "يرجى تحديد تاريخ البدء وتاريخ الانتهاء" : "Please select start and end dates");
      return;
    }
    setVacationSubmitting(true);
    try {
      let res = await fetch(`/api/profiles/${id}/vacation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          startDate: vacationStartDate,
          endDate: vacationEndDate,
          notes: vacationNotes,
        }),
      });
      if (res.status === 404) {
        res = await fetch(`/api/profiles/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId,
            status: "VACATION",
            vacationStartDate,
            vacationEndDate,
            vacationNotes,
          }),
        });
      }
      if (!res.ok) throw new Error();
      toast.success(ar ? "تم تسجيل خروج الموظف في إجازة بنجاح" : "Vacation recorded successfully");
      setVacationModalOpen(false);
      qc.invalidateQueries({ queryKey: getGetProfileQueryKey(id, { propertyId: propertyId as any }) });
      qc.invalidateQueries({ queryKey: ["/api/rooms"] });
    } catch {
      toast.error(ar ? "فشل تسجيل الإجازة" : "Failed to record vacation");
    } finally {
      setVacationSubmitting(false);
    }
  };

  const handleReturnFromVacationDetail = async () => {
    try {
      let res = await fetch(`/api/profiles/${id}/return-vacation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
      if (res.status === 404) {
        res = await fetch(`/api/profiles/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId,
            status: "ACTIVE",
            vacationStartDate: null,
            vacationEndDate: null,
            vacationNotes: "",
          }),
        });
      }
      if (!res.ok) throw new Error();
      toast.success(ar ? "تم تسجيل عودة الموظف من الإجازة بنجاح (مقيم بالسكن)" : "Returned from vacation");
      qc.invalidateQueries({ queryKey: getGetProfileQueryKey(id, { propertyId: propertyId as any }) });
      qc.invalidateQueries({ queryKey: ["/api/rooms"] });
    } catch {
      toast.error(ar ? "فشل تسجيل العودة" : "Failed to record return");
    }
  };

  const { data: _pData } = useListProperties();
  const properties = _pData?.data || _pData || [];
  const activeProp = properties.find((p: any) => p.id === activePropertyId);
  
  const fileRef = useRef<HTMLInputElement>(null);
  const idFileRef = useRef<HTMLInputElement>(null);
  
  const [deletingDocIndex, setDeletingDocIndex] = useState<number | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileType: string; fileData: string } | null>(null);

  const handleIdImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    setUploading(true);
    
    const newDocs: any[] = [];
    let processedCount = 0;
    
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(ar ? `${file.name} كبير جداً (الأقصى 5 ميجا)` : `${file.name} is too large (max 5MB)`);
        processedCount++;
        if (processedCount === files.length) finishUpload(newDocs);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        newDocs.push({
          fileName: file.name,
          fileType: file.type || "image/jpeg",
          fileData: reader.result as string
        });
        processedCount++;
        if (processedCount === files.length) finishUpload(newDocs);
      };
      reader.readAsDataURL(file);
    });
    
    const finishUpload = async (addedDocs: any[]) => {
      if (!addedDocs.length) {
        setUploading(false);
        return;
      }
      try {
        const currentDocs = (profile as any)?.idDocuments || [];
        const payload = {
          propertyId: activePropertyId,
          idDocuments: [...currentDocs, ...addedDocs].map(d => ({
            fileName: d.fileName,
            fileType: d.fileType,
            fileData: d.fileData
          }))
        };
        const res = await fetch(`/api/profiles/${profileId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed");
        toast.success(ar ? "تم إضافة المستندات بنجاح" : "Documents added");
        refetch();
      } catch {
        toast.error(ar ? "فشل رفع المستندات" : "Failed to upload documents");
      } finally {
        setUploading(false);
        if (idFileRef.current) idFileRef.current.value = "";
      }
    };
  };

  const handleDeleteDoc = async (docIndex: number) => {
    const currentDocs = (profile as any)?.idDocuments || [];
    const docToDelete = currentDocs[docIndex];
    const confirmMsg = ar
      ? `هل أنت متأكد من حذف المستند "${docToDelete?.fileName || ""}"؟`
      : `Are you sure you want to delete "${docToDelete?.fileName || "this document"}"?`;
    if (!window.confirm(confirmMsg)) return;

    const updatedDocs = currentDocs.filter((_: any, idx: number) => idx !== docIndex);
    setDeletingDocIndex(docIndex);
    try {
      const payload = {
        propertyId: activePropertyId,
        idDocuments: updatedDocs.map((d: any) => ({
          fileName: d.fileName,
          fileType: d.fileType,
          fileData: d.fileData,
        })),
      };
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(ar ? "تم حذف المستند بنجاح" : "Document deleted successfully");
      refetch();
    } catch {
      toast.error(ar ? "فشل حذف المستند" : "Failed to delete document");
    } finally {
      setDeletingDocIndex(null);
    }
  };



  const handleDownloadDoc = (doc: any) => {
    if (!doc.fileData) return;
    const link = document.createElement("a");
    link.href = doc.fileData;
    link.download = doc.fileName || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [uploading, setUploading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [setPwOpen, setSetPwOpen] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ password: "", confirm: "" });

  const {
    data: profile,
    isLoading: empLoading,
    refetch,
  } = useQuery({
    queryKey: ["profile", profileId, activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/profiles/${profileId}?propertyId=${activePropertyId}`,
      );
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!profileId && !!activePropertyId,
  });

  const portalProfileIdForQuery = String((profile as any)?.profileId ?? "");
  const { data: portalAccount, refetch: refetchPortalAccount } = useQuery({
    queryKey: ["portal-account", portalProfileIdForQuery, activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-auth/accounts?propertyId=${activePropertyId}`,
      );
      if (!res.ok) return null;
      const data = await res.json().catch(() => []);
      const accounts = Array.isArray(data) ? data : (data.accounts ?? []);
      return (
        accounts.find(
          (account: any) => account.profileId === portalProfileIdForQuery,
        ) ?? null
      );
    },
    enabled: !!activePropertyId && !!portalProfileIdForQuery,
  });

  const effectivePropId = profile?.propertyId || activePropertyId;

  const { data: allAssignments, isLoading: assignmentsLoading } = useListAssignments(
    { propertyId: effectivePropId } as any,
    { query: { enabled: !!profileId && !!effectivePropId } },
  );

  const { data: _rData } = useListRooms(
    { propertyId: effectivePropId, limit: 1000 },
    { query: { enabled: !!effectivePropId } },
  );
  const rooms = Array.isArray(_rData) ? _rData : (_rData?.data || []);
  const { data: _bData } = useListBuildings(
    { propertyId: effectivePropId },
    { query: { enabled: !!effectivePropId } },
  );
  const buildings = Array.isArray(_bData) ? _bData : (_bData?.data || []);
  const { data: _fData } = useListFloors(
    { propertyId: effectivePropId },
    { query: { enabled: !!effectivePropId } },
  );
  const floors = Array.isArray(_fData) ? _fData : (_fData?.data || []);

  const roomMap = Object.fromEntries(rooms.map((r: any) => [r.id, r]));
  const buildingMap = Object.fromEntries(buildings.map((b: any) => [b.id, b.name]));
  const floorMap = Object.fromEntries(floors.map((f: any) => [f.id, f.floorNumber]));

  const rawAssignments: any[] = Array.isArray(allAssignments)
    ? allAssignments
    : ((allAssignments as any)?.data || []);

  const profileAssignments = rawAssignments
    .filter((a: any) => Number(a.profileId) === Number(profileId))
    .sort(
      (a: any, b: any) =>
        new Date(b.checkInDate || b.createdAt || 0).getTime() -
        new Date(a.checkInDate || a.createdAt || 0).getTime(),
    );

  // Active current housing is an ACTIVE assignment without a checkout date, or the latest active one
  const currentAssignment =
    profileAssignments.find((a: any) => a.status === "ACTIVE" && !a.checkOutDate) ||
    profileAssignments.find((a: any) => a.status === "ACTIVE");

  // All other assignments for this profile constitute their housing history
  const pastAssignments = profileAssignments.filter(
    (a: any) => a.id !== currentAssignment?.id,
  );

  const printHousingLetter = async () => {
    const chosenAr = await openDialog();
    const emp = profile as any;
    const assignment = currentAssignment;
    if (!emp || !assignment) return;
    const room = roomMap[assignment.roomId];
    const building = room ? buildingMap[room.buildingId] : null;
    const floorNum = room ? floorMap[room.floorId] : null;
    await generateHousingLetterPdf({
      isArabic: chosenAr,
      profile: emp,
      assignment,
      room,
      building,
      floorNum,
      propName: activeProp?.name || "",
      propAddress: (activeProp as any)?.address || "",
      systemLogoUrl: (settings as any)?.systemLogo,
      propLogoUrl: (activeProp as any)?.logo,
    });
  };

  const queryClient = useQueryClient();
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendNewDate, setExtendNewDate] = useState("");
  const [extendNotes, setExtendNotes] = useState("");
  const [extendLoading, setExtendLoading] = useState(false);

  const openExtendFromDetail = () => {
    if (!currentAssignment) return;
    let baseDate = new Date();
    if (currentAssignment.expectedCheckOutDate) {
      const exp = new Date(currentAssignment.expectedCheckOutDate);
      if (!isNaN(exp.getTime()) && exp > baseDate) {
        baseDate = exp;
      }
    }
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + 7);
    setExtendNewDate(nextDate.toISOString().split("T")[0]);
    setExtendNotes(currentAssignment.notes || "");
    setExtendModalOpen(true);
  };

  const applyExtendPresetDetail = (days: number) => {
    let baseDate = new Date();
    if (currentAssignment?.expectedCheckOutDate) {
      const exp = new Date(currentAssignment.expectedCheckOutDate);
      if (!isNaN(exp.getTime()) && exp > baseDate) {
        baseDate = exp;
      }
    }
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + days);
    setExtendNewDate(nextDate.toISOString().split("T")[0]);
  };

  const handleConfirmExtendFromDetail = async () => {
    if (!currentAssignment) return;
    if (!extendNewDate) {
      toast.error(
        ar
          ? "يرجى تحديد تاريخ المغادرة الجديد"
          : "Please select new departure date",
      );
      return;
    }
    setExtendLoading(true);
    try {
      const res = await fetch(`/api/assignments/${currentAssignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedCheckOutDate: extendNewDate,
          notes: extendNotes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      toast.success(
        ar ? "تم تمديد فترة الإقامة بنجاح" : "Stay extended successfully",
      );
      setExtendModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/assignments/in-house"],
      });
    } catch (err: any) {
      toast.error(err.message || (ar ? "فشل التمديد" : "Failed to extend"));
    } finally {
      setExtendLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(
        ar
          ? "الملف كبير جداً (الحد الأقصى 2 ميغابايت)"
          : "File too large (max 2MB)",
      );
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await fetch(`/api/profiles/${profileId}/photo`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoUrl: reader.result,
            propertyId: activePropertyId,
          }),
        });
        toast.success(ar ? "تم رفع الصورة" : "Photo uploaded");
        refetch();
      } catch {
        toast.error(ar ? "خطأ في الرفع" : "Upload error");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  if (empLoading || !profileId)
    return (
      <div className="p-8">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (!profile)
    return (
      <div className="p-8 text-muted-foreground">
        {ar ? "الموظف غير موجود" : "Profile not found"}
      </div>
    );

  const emp = profile as any;

  const portalPropertyId = Number(emp.propertyId ?? activePropertyId);
  const portalProfileId = String(emp.profileId ?? "");

  const resetPortalPassword = async () => {
    if (!portalProfileId || !portalPropertyId) {
      toast.error(ar ? "بيانات الموظف مفقودة" : "Profile data missing");
      return;
    }
    try {
      setPwSaving(true);
      const res = await fetch("/api/portal-auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: portalProfileId,
          propertyId: portalPropertyId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Request failed");
      toast.success(
        ar ? "تم إنشاء كلمة مرور مؤقتة" : "Temporary password generated",
        {
          description: data.temporaryPassword
            ? `${ar ? "كلمة المرور المؤقتة" : "Temporary password"}: ${data.temporaryPassword}`
            : data.message,
        },
      );
      refetchPortalAccount();
      setResetOpen(false);
    } catch (e: any) {
      toast.error(ar ? "خطأ" : "Error", {
        description: e?.message ?? String(e),
      });
    } finally {
      setPwSaving(false);
    }
  };

  const setPortalPassword = async () => {
    if (!portalProfileId || !portalPropertyId) {
      toast.error(ar ? "بيانات الموظف مفقودة" : "Profile data missing");
      return;
    }
    if (pwForm.password.length < 6) {
      toast.error(ar ? "كلمة المرور قصيرة" : "Password too short", {
        description: ar ? "الحد الأدنى 6 أحرف" : "Minimum 6 characters",
      });
      return;
    }
    if (pwForm.password !== pwForm.confirm) {
      toast.error(ar ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    try {
      setPwSaving(true);
      const res = await fetch("/api/portal-auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: portalProfileId,
          propertyId: portalPropertyId,
          newPassword: pwForm.password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Request failed");
      toast.success(ar ? "تم تعيين كلمة مرور جديدة" : "Password set");
      refetchPortalAccount();
      setSetPwOpen(false);
      setPwForm({ password: "", confirm: "" });
    } catch (e: any) {
      toast.error(ar ? "خطأ" : "Error", {
        description: e?.message ?? String(e),
      });
    } finally {
      setPwSaving(false);
    }
  };

  const togglePortalAccess = async (isActive: boolean) => {
    if (!portalProfileId || !portalPropertyId) {
      toast.error(ar ? "بيانات الموظف مفقودة" : "Profile data missing");
      return;
    }
    try {
      setAccessSaving(true);
      const res = await fetch("/api/portal-auth/toggle-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: portalProfileId,
          propertyId: portalPropertyId,
          isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Request failed");
      toast.success(
        isActive
          ? ar
            ? "تم تفعيل حساب البوابة"
            : "Portal account enabled"
          : ar
            ? "تم تعطيل حساب البوابة"
            : "Portal account disabled",
      );
      refetchPortalAccount();
    } catch (e: any) {
      toast.error(ar ? "خطأ" : "Error", {
        description: e?.message ?? String(e),
      });
    } finally {
      setAccessSaving(false);
    }
  };

  const infoItems = [
    {
      icon: <Shield className="w-4 h-4" />,
      label: ar ? "رقم الهوية" : "National ID",
      value: emp.nationalId,
    },
    {
      icon: <Globe2 className="w-4 h-4" />,
      label: ar ? "الجنسية" : "Nationality",
      value: emp.nationality,
    },
    {
      icon: <Phone className="w-4 h-4" />,
      label: ar ? "الهاتف" : "Phone",
      value: emp.phone || emp.phoneNumber,
    },
    {
      icon: <User className="w-4 h-4" />,
      label: ar ? "الجنس" : "Gender",
      value:
        emp.gender === "M"
          ? ar
            ? "ذكر"
            : "Male"
          : emp.gender === "F"
            ? ar
              ? "أنثى"
              : "Female"
            : emp.gender,
    },
    {
      icon: <Briefcase className="w-4 h-4" />,
      label: ar ? "القسم" : "Department",
      value: emp.employmentType === "THIRD_PARTY" ? null : emp.department,
    },
    {
      icon: <Briefcase className="w-4 h-4" />,
      label: emp.employmentType === "THIRD_PARTY" ? (ar ? "الوظيفة / المهنة" : "Job / Role") : (ar ? "المسمى الوظيفي" : "Job Title"),
      value: emp.jobTitle,
    },
    {
      icon: <Briefcase className="w-4 h-4" />,
      label: ar ? "الدرجة" : "Level",
      value: emp.employmentType === "THIRD_PARTY" ? null : emp.level,
    },
    {
      icon: <Briefcase className="w-4 h-4" />,
      label: ar ? "نوع التوظيف" : "Employment Type",
      value: emp.employmentType === "THIRD_PARTY" ? (ar ? "طرف ثالث" : "Third Party") : (ar ? "داخلي" : "Internal"),
    },
    {
      icon: <Building2 className="w-4 h-4" />,
      label: emp.employmentType === "THIRD_PARTY" ? (ar ? "اسم الشركة" : "Company Name") : (ar ? "يعمل لدى" : "Works For"),
      value: emp.companyName || (emp.employmentType === "INTERNAL" ? (ar ? "الفندق" : "Hotel") : null),
    },
    {
      icon: <Calendar className="w-4 h-4" />,
      label: ar ? "تاريخ التعيين" : "Hire Date",
      value: emp.employmentType === "THIRD_PARTY" ? null : (emp.hireDate
        ? formatDate(emp.hireDate)
        : null),
    },
    {
      icon: <Clock className="w-4 h-4 text-amber-500" />,
      label: ar ? "تاريخ انتهاء العقد" : "Contract End Date",
      value: emp.employmentType !== "THIRD_PARTY" && emp.contractEndDate
        ? formatDate(emp.contractEndDate)
        : null,
    },
    {
      icon: <MapPin className="w-4 h-4" />,
      label: ar ? "العنوان" : "Address",
      value: emp.address,
    },
  ].filter((i) => i.value);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/profiles">
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1 rtl:rotate-180" />
          {ar ? "العودة للموظفين" : "Back to Profiles"}
        </Button>
      </Link>

      {/* Profile card */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="pt-0 pb-6">
          <div className="flex flex-col sm:flex-row gap-4 -mt-12">
            <div className="relative flex-shrink-0">
              <ProfileAvatar
                firstName={emp.firstName}
                lastName={emp.lastName}
                photoUrl={emp.photoUrl}
                size="lg"
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:bg-primary/90 transition-colors"
                title={ar ? "تغيير الصورة" : "Change photo"}
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="pt-12 sm:pt-14 flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <h1 className="text-2xl font-bold">
                    {`${emp.firstName} ${emp.thirdName || ""} ${emp.fourthName || ""} ${emp.lastName}`.replace(/\s+/g, ' ').trim()}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-muted-foreground font-mono text-sm">
                      {emp.profileId || emp.profileCode}
                    </span>
                    {emp.employmentType === "THIRD_PARTY" ? (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 font-semibold text-xs">
                        {ar ? "طرف ثالث" : "Third Party"}{emp.companyName ? ` • ${emp.companyName}` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 font-semibold text-xs">
                        {ar ? "موظف داخلي" : "Internal Employee"}{emp.companyName ? ` • ${emp.companyName}` : ""}
                      </Badge>
                    )}
                  </div>
                  {emp.jobTitle && (
                    <div className="flex items-center gap-2 text-sm text-primary font-medium mt-1.5">
                      <span>{emp.jobTitle}</span>
                      {emp.employmentType !== "THIRD_PARTY" && emp.department && (
                        <span className="text-muted-foreground text-xs">• {emp.department}</span>
                      )}
                      {emp.employmentType !== "THIRD_PARTY" && emp.level && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/25 font-bold px-2 py-0.5 text-xs shadow-2xs">
                          {emp.level}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 self-start">
                  <div
                    className={`h-8 font-semibold text-xs rounded-full px-3 flex items-center gap-2 border shadow-xs ${
                      emp.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                        : emp.status === "VACATION"
                        ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                        : emp.status === "LEFT"
                        ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        emp.status === "ACTIVE"
                          ? "bg-emerald-500 animate-pulse"
                          : emp.status === "VACATION"
                          ? "bg-amber-500"
                          : emp.status === "LEFT"
                          ? "bg-slate-400"
                          : "bg-blue-500"
                      }`}
                    />
                    <span>
                      {emp.status === "ACTIVE"
                        ? (ar ? "مقيم بالسكن" : "In-House")
                        : emp.status === "VACATION"
                        ? (ar ? "في إجازة" : "On Vacation")
                        : emp.status === "LEFT"
                        ? (ar ? "مغادر" : "Checked Out")
                        : (ar ? "غير مسكّن" : "Unassigned")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-6">
            {infoItems.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-3 rounded-lg bg-muted/30"
              >
                <span className="text-muted-foreground mt-0.5 flex-shrink-0">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    {item.label}
                  </p>
                  <p className="text-sm font-medium truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      
      {/* Passport / ID Documents */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              {ar ? "مستندات الهوية / جواز السفر" : "ID / Passport Documents"}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => idFileRef.current?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              {ar ? "إضافة مستند" : "Add Document"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <input
            ref={idFileRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleIdImageUpload}
          />
          {emp.idDocuments && emp.idDocuments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-2">
              {emp.idDocuments.map((doc: any, i: number) => {
                const isImage = doc.fileData && doc.fileData.startsWith("data:image");
                const isDeleting = deletingDocIndex === i;
                return (
                  <div
                    key={i}
                    className="relative group border rounded-xl overflow-hidden flex flex-col justify-between bg-card hover:shadow-md transition-all duration-200 border-border"
                  >
                    {/* Thumbnail & Preview Trigger */}
                    <div
                      className="relative h-32 w-full bg-muted/30 cursor-pointer overflow-hidden flex items-center justify-center border-b border-border/40"
                      onClick={() => setPreviewDoc(doc)}
                      title={ar ? "انقر للمعاينة" : "Click to preview"}
                    >
                      {isImage ? (
                        <img
                          src={doc.fileData}
                          alt={doc.fileName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground p-3 text-center">
                          <FileText className="w-9 h-9 text-primary/70" />
                          <span className="text-[11px] font-mono font-medium">PDF / Doc</span>
                        </div>
                      )}
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium">
                        <Eye className="w-4 h-4" />
                        <span>{ar ? "معاينة" : "Preview"}</span>
                      </div>
                    </div>

                    {/* Bottom Info & Action Buttons */}
                    <div className="p-2.5 bg-background flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold truncate flex-1" title={doc.fileName}>
                          {doc.fileName}
                        </span>
                        {doc.uploadedAt && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatDate(doc.uploadedAt)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/60">
                        {/* Download button */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1 h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10 font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadDoc(doc);
                          }}
                        >
                          <Download className="w-3.5 h-3.5" />
                          {ar ? "تحميل" : "Download"}
                        </Button>

                        {/* Delete button */}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 gap-1 font-medium"
                          disabled={isDeleting}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDoc(i);
                          }}
                          title={ar ? "حذف هذا المستند" : "Delete this document"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isDeleting ? (ar ? "..." : "...") : (ar ? "حذف" : "Delete")}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 py-8 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/20">
              <Shield className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">{ar ? "لا توجد مستندات هوية مرفوعة" : "No ID documents uploaded yet"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current assignment */}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="w-4 h-4 text-primary" />
              {ar ? "السكن الحالي" : "Current Housing"}
            </CardTitle>
            {currentAssignment && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openExtendFromDetail}
                  className="gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  {ar ? "تمديد الإقامة" : "Extend Stay"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={printHousingLetter}
                  className="gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {ar ? "طباعة خطاب السكن" : "Print Housing Letter"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {currentAssignment ? (
            (() => {
              const room = roomMap[currentAssignment.roomId];
              const roomNum = room?.roomNumber ?? currentAssignment.roomNumber ?? currentAssignment.roomId;
              const building = room ? buildingMap[room.buildingId] : (currentAssignment.buildingName ?? null);
              const floorNum = room ? floorMap[room.floorId] : (currentAssignment.floorNumber ?? null);
              const daysStayed = differenceInDays(
                new Date(),
                new Date(currentAssignment.checkInDate),
              );
              const daysRemaining = currentAssignment.expectedCheckOutDate
                ? differenceInDays(
                    new Date(currentAssignment.expectedCheckOutDate),
                    new Date(),
                  )
                : null;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: ar ? "المبنى" : "Building",
                      value: building ?? (room?.buildingId ? `#${room.buildingId}` : "—"),
                      icon: <Building2 className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "الدور" : "Floor",
                      value: floorNum
                        ? `${ar ? "الطابق" : "Floor"} ${floorNum}`
                        : "—",
                      icon: null,
                    },
                    {
                      label: ar ? "الغرفة" : "Room",
                      value: roomNum ?? "—",
                      icon: <Home className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "السرير" : "Bed",
                      value: currentAssignment.bedNumber ?? "—",
                      icon: <BedDouble className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "تاريخ الدخول" : "Check-in",
                      value: formatDate(currentAssignment.checkInDate),
                      icon: <Calendar className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "المغادرة المتوقعة" : "Expected Out",
                      value: formatDate(currentAssignment.expectedCheckOutDate),
                      icon: <Calendar className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "مدة الإقامة" : "Days Stayed",
                      value: `${daysStayed} ${ar ? "يوم" : "days"}`,
                      icon: null,
                    },
                    {
                      label: ar ? "الأيام المتبقية" : "Days Remaining",
                      value:
                        daysRemaining !== null
                          ? `${daysRemaining} ${ar ? "يوم" : "days"}`
                          : "—",
                      icon: null,
                    },
                  ].map((row, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/30">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">
                        {row.label}
                      </p>
                      <p className="font-semibold text-sm">
                        {String(row.value)}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })()
          ) : (
            <div className="py-8 text-center text-muted-foreground space-y-3">
              <Home className="w-8 h-8 mx-auto opacity-30" />
              <p>
                {ar
                  ? "لا يوجد تسكين نشط حالياً لهذا الموظف"
                  : "No active housing assignment for this employee"}
              </p>
              <Link href={`/accommodation/room-assignment?profileId=${profileId}`}>
                <Button size="sm" className="gap-1.5 mt-1 bg-primary text-primary-foreground hover:bg-primary/90">
                  <BedDouble className="w-4 h-4" />
                  {ar ? "تسكين الموظف الآن" : "Assign Room Now"}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Portal Access */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            {ar ? "بوابة الموظفين" : "Profile Portal"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {ar
                ? "يمكن للمسؤولين تعديل صلاحيات البوابة وإدارة كلمة مرور الموظف من هنا."
                : "Admins can edit portal access and manage the profile password from here."}
            </div>
            <Badge
              variant={portalAccount?.isActive ? "default" : "secondary"}
              className="self-start"
            >
              {portalAccount
                ? portalAccount.isActive
                  ? ar
                    ? "نشط"
                    : "Active"
                  : ar
                    ? "معطل"
                    : "Disabled"
                : ar
                  ? "لم يتم تحميل الحساب"
                  : "Account loading"}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">
                {ar ? "صلاحية الدخول" : "Portal access"}
              </p>
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "تفعيل أو تعطيل دخول هذا الموظف للبوابة."
                  : "Enable or disable this profile's portal login."}
              </p>
            </div>
            <Switch
              checked={Boolean(portalAccount?.isActive)}
              disabled={!portalAccount || accessSaving}
              onCheckedChange={togglePortalAccess}
              aria-label={ar ? "تفعيل/تعطيل البوابة" : "Toggle portal access"}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setSetPwOpen(true)}
              disabled={pwSaving}
            >
              {ar ? "تعيين كلمة مرور جديدة" : "Set New Password"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setResetOpen(true)}
              disabled={pwSaving}
            >
              {ar ? "إنشاء كلمة مرور مؤقتة" : "Generate Temporary Password"}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {ar
              ? `معرّ�? الدخول: ${portalProfileId || "—"}`
              : `Login ID: ${portalProfileId || "—"}`}
          </div>
        </CardContent>
      </Card>

      {/* Assignment history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            {ar ? "سجل الإقامة" : "Housing History"}
            {pastAssignments.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pastAssignments.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>{ar ? "المبنى" : "Building"}</TableHead>
                <TableHead>{ar ? "الدور" : "Floor"}</TableHead>
                <TableHead>{ar ? "الغرفة" : "Room"}</TableHead>
                <TableHead>{ar ? "السرير" : "Bed"}</TableHead>
                <TableHead>{ar ? "الدخول" : "Check-in"}</TableHead>
                <TableHead>{ar ? "الخروج" : "Check-out"}</TableHead>
                <TableHead>{ar ? "المدة" : "Days"}</TableHead>
                <TableHead>{ar ? "ملاحظات" : "Notes"}</TableHead>
                <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pastAssignments.map((a: any) => {
                const room = roomMap[a.roomId];
                const roomNum = room?.roomNumber ?? a.roomNumber ?? a.roomId;
                const building = room ? buildingMap[room.buildingId] : (a.buildingName ?? null);
                const floorNum = room ? floorMap[room.floorId] : (a.floorNumber ?? null);
                const checkOutDate =
                  a.checkOutDate || (a as any).actualCheckOutDate;
                const days =
                  a.checkInDate && checkOutDate
                    ? Math.max(
                        0,
                        Math.round(
                          (new Date(checkOutDate).getTime() -
                            new Date(a.checkInDate).getTime()) /
                            86400000,
                        ),
                      )
                    : null;
                return (
                  <TableRow key={a.id} className="hover:bg-muted/20">
                    <TableCell className="text-sm whitespace-nowrap">
                      {building ? (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          {building}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {floorNum ? `${ar ? "طابق" : "Floor"} ${floorNum}` : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-semibold text-primary">
                        {roomNum}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.bedNumber ? (
                        <Badge variant="outline" className="text-xs">
                          <BedDouble className="w-3 h-3 mr-1" />
                          {a.bedNumber}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(a.checkInDate)}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(checkOutDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {days !== null ? (
                        <Badge variant="outline" className="text-xs">
                          {days} {ar ? "يوم" : "d"}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate" title={a.notes || ""}>
                      {a.notes || "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(a.status)}`}
                      >
                        {a.status === "CHECKED_OUT"
                          ? (ar ? "تمت المغادرة" : "Checked Out")
                          : a.status === "TRANSFERRED"
                          ? (ar ? "تم النقل" : "Transferred")
                          : a.status === "ENDED"
                          ? (ar ? "منتهي" : "Ended")
                          : a.status === "ACTIVE"
                          ? (ar ? "نشط" : "Active")
                          : a.status}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pastAssignments.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {ar
                      ? "لا يوجد سجل إقامة سابق"
                      : "No previous housing history"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reset confirm */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "إعادة تعيين كلمة المرور" : "Reset Password"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "سيؤدي هذا إلى إنشاء كلمة مرور مؤقتة جديدة وإجبار الموظف على تغييرها عند تسجيل الدخول التالي."
                : "This will generate a new temporary password and force the profile to change it on next login."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pwSaving}>
              {ar ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={resetPortalPassword}
              disabled={pwSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pwSaving
                ? ar
                  ? "جاري العمل..."
                  : "Working..."
                : ar
                  ? "تأكيد"
                  : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set password dialog */}
      <Dialog
        open={setPwOpen}
        onOpenChange={(o) => {
          setSetPwOpen(o);
          if (!o) setPwForm({ password: "", confirm: "" });
        }}
      >
        <DialogContent
          className="max-w-md"
          srTitle={ar ? "تعيين كلمة مرور جديدة" : "Set New Password"}
        >
          <DialogHeader>
            <DialogTitle>
              {ar ? "تعيين كلمة مرور جديدة" : "Set New Password"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{ar ? "كلمة المرور الجديدة" : "New password"}</Label>
              <Input
                type="password"
                value={pwForm.password}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, password: e.target.value }))
                }
                placeholder={ar ? "6 أحرف على الأقل" : "At least 6 characters"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "تأكيد كلمة المرور" : "Confirm password"}</Label>
              <Input
                type="password"
                value={pwForm.confirm}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, confirm: e.target.value }))
                }
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {ar
                ? "سيتم تعيين كلمة المرور مباشرة دون إجبار تغييرها."
                : "This sets the password directly (no forced change)."}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSetPwOpen(false)}
              disabled={pwSaving}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={setPortalPassword} disabled={pwSaving}>
              {pwSaving
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? "حفظ"
                  : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Lightbox Modal */}
      <DocumentPreviewModal
        doc={previewDoc}
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      {/* Extend Stay Dialog */}
      <Dialog
        open={extendModalOpen}
        onOpenChange={setExtendModalOpen}
      >
        <DialogContent
          className="max-w-md"
          srTitle={ar ? "تمديد فترة الإقامة" : "Extend Stay Period"}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <CalendarPlus className="w-5 h-5 text-primary" />
              {ar ? "تمديد فترة الإقامة" : "Extend Stay Period"}
            </DialogTitle>
          </DialogHeader>

          {currentAssignment && (
            <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div>
                <span className="text-muted-foreground block mb-0.5">
                  {ar ? "تاريخ التسكين:" : "Check-in Date:"}
                </span>
                <span className="font-semibold">
                  {formatDate(currentAssignment.checkInDate)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">
                  {ar ? "تاريخ المغادرة الحالي:" : "Current Departure:"}
                </span>
                <span className="font-semibold">
                  {formatDate(currentAssignment.expectedCheckOutDate, ar ? "غير محدد" : "Not set")}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">
                {ar ? "تاريخ المغادرة الجديد المتوقع" : "New Expected Departure Date"} *
              </Label>
              <DateInput
                value={extendNewDate}
                onChange={(iso) => setExtendNewDate(iso)}
                min={new Date().toISOString().split("T")[0]}
                className="font-mono text-sm"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                <span className="text-xs text-muted-foreground mr-1 rtl:ml-1 rtl:mr-0">
                  {ar ? "إضافة سريعة:" : "Quick add:"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyExtendPresetDetail(3)}
                >
                  +3 {ar ? "أيام" : "days"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyExtendPresetDetail(7)}
                >
                  + {ar ? "أسبوع" : "1 week"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyExtendPresetDetail(14)}
                >
                  + {ar ? "أسبوعين" : "2 weeks"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyExtendPresetDetail(30)}
                >
                  + {ar ? "شهر" : "1 month"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyExtendPresetDetail(90)}
                >
                  + 3 {ar ? "أشهر" : "months"}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                {ar ? "سبب التمديد / ملاحظات" : "Extension Reason / Notes"}
              </Label>
              <Textarea
                placeholder={
                  ar
                    ? "أدخل سبب تمديد الإقامة أو أي تفاصيل إضافية..."
                    : "Enter reason for extending stay or additional notes..."
                }
                value={extendNotes}
                onChange={(e) => setExtendNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExtendModalOpen(false)}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleConfirmExtendFromDetail}
                disabled={extendLoading || !extendNewDate}
                className="gap-1.5 bg-primary font-semibold"
              >
                <CalendarPlus className="w-4 h-4" />
                {extendLoading
                  ? ar
                    ? "جاري التمديد..."
                    : "Extending..."
                  : ar
                    ? "تأكيد تمديد الإقامة"
                    : "Confirm Extension"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PrintLanguageDialog
        open={langDialogOpen}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />
    </div>
  );
}
