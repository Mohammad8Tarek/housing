// State, effects and handlers of ProfileDetail (moved verbatim).
import { useRef, useState } from "react";
import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useListAssignments,
  useListBuildings,
  useListFloors,
  useGetSettings,
  useListProperties,
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { useProperty } from "@/context/PropertyContext";
import {
  User,
  Briefcase,
  Building2,
  Phone,
  Calendar,
  MapPin,
  Globe2,
  Shield,
  Clock,
} from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { generateHousingLetterPdf } from "@/lib/pdf-utils";
import { usePrintLanguage } from "@/lib/PrintLanguageDialog";
import {
  getProfileDisplayJobTitle,
  getProfileDisplayDepartment,
} from "@/lib/profile-display-utils";
import { useAllRows } from "@/lib/use-all-rows";

export function useProfileDetailState() {
  const { id } = useParams();
  const profileId = Number(id);
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const { activePropertyId } = useProperty();
  const ar = language === "ar";
  const { langDialogOpen, openDialog, handleSelect, handleCancel } =
    usePrintLanguage();

  const numericPropertyId =
    typeof activePropertyId === "number" ? activePropertyId : undefined;
  const { data: settings } = useGetSettings(
    { propertyId: numericPropertyId },
    { query: { enabled: !!numericPropertyId } as any },
  );

  const {
    data: profile,
    isLoading: empLoading,
    refetch,
  } = useQuery({
    queryKey: ["profile", profileId, activePropertyId],
    queryFn: async () => {
      const url =
        activePropertyId && activePropertyId !== "all"
          ? `/api/profiles/${profileId}?propertyId=${activePropertyId}`
          : `/api/profiles/${profileId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!profileId,
  });

  const effectivePropId = (profile?.propertyId ||
    (activePropertyId !== "all" ? activePropertyId : undefined)) as
    | number
    | undefined;
  const [vacationModalOpen, setVacationModalOpen] = useState(false);
  const [vacationStartDate, setVacationStartDate] = useState(
    new Date().toISOString().split("T")[0],
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
      toast.error(
        ar
          ? "يرجى تحديد تاريخ البدء وتاريخ الانتهاء"
          : "Please select start and end dates",
      );
      return;
    }
    setVacationSubmitting(true);
    try {
      let res = await fetch(`/api/profiles/${id}/vacation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: effectivePropId,
          startDate: vacationStartDate,
          endDate: vacationEndDate,
          notes: vacationNotes,
        }),
      });
      if (res.status === 404) {
        const patchUrl = effectivePropId
          ? `/api/profiles/${id}?propertyId=${effectivePropId}`
          : `/api/profiles/${id}`;
        res = await fetch(patchUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: effectivePropId,
            status: "VACATION",
            vacationStartDate,
            vacationEndDate,
            vacationNotes,
          }),
        });
      }
      if (!res.ok) throw new Error();
      toast.success(
        ar
          ? "تم تسجيل خروج الموظف في إجازة بنجاح"
          : "Vacation recorded successfully",
      );
      setVacationModalOpen(false);
      queryClient.invalidateQueries({
        queryKey: ["profile", profileId, activePropertyId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
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
        body: JSON.stringify({ propertyId: effectivePropId }),
      });
      if (res.status === 404) {
        const patchUrl = effectivePropId
          ? `/api/profiles/${id}?propertyId=${effectivePropId}`
          : `/api/profiles/${id}`;
        res = await fetch(patchUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: effectivePropId,
            status: "ACTIVE",
            vacationStartDate: null,
            vacationEndDate: null,
            vacationNotes: "",
          }),
        });
      }
      if (!res.ok) throw new Error();
      toast.success(
        ar
          ? "تم تسجيل عودة الموظف من الإجازة بنجاح (مقيم بالسكن)"
          : "Returned from vacation",
      );
      queryClient.invalidateQueries({
        queryKey: ["profile", profileId, activePropertyId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
    } catch {
      toast.error(ar ? "فشل تسجيل العودة" : "Failed to record return");
    }
  };

  const { data: _pData } = useListProperties();
  const properties: any[] = Array.isArray(_pData)
    ? _pData
    : ((_pData as any)?.data as any[]) || [];
  const activeProp = properties.find((p: any) => p.id === activePropertyId);

  const fileRef = useRef<HTMLInputElement>(null);
  const idFileRef = useRef<HTMLInputElement>(null);

  const [deletingDocIndex, setDeletingDocIndex] = useState<number | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    fileName: string;
    fileType: string;
    fileData: string;
  } | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const handleIdImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);

    const newDocs: any[] = [];
    let processedCount = 0;

    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(
          ar
            ? `${file.name} كبير جداً (الأقصى 5 ميجا)`
            : `${file.name} is too large (max 5MB)`,
        );
        processedCount++;
        if (processedCount === files.length) finishUpload(newDocs);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        newDocs.push({
          fileName: file.name,
          fileType: file.type || "image/jpeg",
          fileData: reader.result as string,
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
          propertyId: effectivePropId,
          idDocuments: [...currentDocs, ...addedDocs].map((d) => ({
            fileName: d.fileName,
            fileType: d.fileType,
            fileData: d.fileData,
          })),
        };
        const url = effectivePropId
          ? `/api/profiles/${profileId}?propertyId=${effectivePropId}`
          : `/api/profiles/${profileId}`;
        const res = await fetch(url, {
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

    const updatedDocs = currentDocs.filter(
      (_: any, idx: number) => idx !== docIndex,
    );
    setDeletingDocIndex(docIndex);
    try {
      const payload = {
        propertyId: effectivePropId,
        idDocuments: updatedDocs.map((d: any) => ({
          fileName: d.fileName,
          fileType: d.fileType,
          fileData: d.fileData,
        })),
      };
      const url = effectivePropId
        ? `/api/profiles/${profileId}?propertyId=${effectivePropId}`
        : `/api/profiles/${profileId}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(
        ar ? "تم حذف المستند بنجاح" : "Document deleted successfully",
      );
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

  const portalProfileIdForQuery = String((profile as any)?.profileId ?? "");

  const { data: portalAccount, refetch: refetchPortalAccount } = useQuery({
    queryKey: ["portal-account", portalProfileIdForQuery, effectivePropId],
    queryFn: async () => {
      if (!effectivePropId) return null;
      const res = await fetch(
        `/api/portal-auth/accounts?propertyId=${effectivePropId}`,
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
    enabled: !!effectivePropId && !!portalProfileIdForQuery,
  });

  const { data: allAssignments, isLoading: assignmentsLoading } =
    useListAssignments(
      { propertyId: effectivePropId, profileId: Number(profileId) } as any,
      { query: { enabled: !!profileId && !!effectivePropId } as any },
    );

  const { data: _rData } = useAllRows(
    "/api/rooms",
    { propertyId: effectivePropId },
    { enabled: !!effectivePropId },
  );
  const rooms: any[] = Array.isArray(_rData)
    ? _rData
    : ((_rData as any)?.data as any[]) || [];
  const { data: _bData } = useListBuildings(
    { propertyId: effectivePropId } as any,
    { query: { enabled: !!effectivePropId } as any },
  );
  const buildings: any[] = Array.isArray(_bData)
    ? _bData
    : ((_bData as any)?.data as any[]) || [];
  const { data: _fData } = useListFloors(
    { propertyId: effectivePropId } as any,
    { query: { enabled: !!effectivePropId } as any },
  );
  const floors: any[] = Array.isArray(_fData)
    ? _fData
    : ((_fData as any)?.data as any[]) || [];

  const roomMap = Object.fromEntries(rooms.map((r: any) => [r.id, r]));
  const buildingMap = Object.fromEntries(
    buildings.map((b: any) => [b.id, b.name]),
  );
  const floorMap = Object.fromEntries(
    floors.map((f: any) => [f.id, f.floorNumber]),
  );

  const rawAssignments: any[] = Array.isArray(allAssignments)
    ? allAssignments
    : (allAssignments as any)?.data || [];

  const profileAssignments = rawAssignments
    .filter((a: any) => Number(a.profileId) === Number(profileId))
    .sort(
      (a: any, b: any) =>
        new Date(b.checkInDate || b.createdAt || 0).getTime() -
        new Date(a.checkInDate || a.createdAt || 0).getTime(),
    );

  // Active current housing is an ACTIVE assignment without a checkout date, or the latest active one
  const currentAssignment =
    profileAssignments.find(
      (a: any) => a.status === "ACTIVE" && !a.checkOutDate,
    ) || profileAssignments.find((a: any) => a.status === "ACTIVE");

  // All other assignments for this profile constitute their housing history
  const pastAssignments = profileAssignments.filter(
    (a: any) => a.id !== currentAssignment?.id,
  );

  const printHousingLetter = async () => {
    const chosenAr = ar;
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
      propNameAr: (activeProp as any)?.displayName || activeProp?.name || "",
      propAddress: (activeProp as any)?.address || "",
      systemLogoUrl: (settings as any)?.systemLogo,
      propLogoUrl: (activeProp as any)?.logo,
    });
  };

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
        const photoUrl = effectivePropId
          ? `/api/profiles/${profileId}/photo?propertyId=${effectivePropId}`
          : `/api/profiles/${profileId}/photo`;
        await fetch(photoUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoUrl: reader.result,
            propertyId: effectivePropId,
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
  return {
    id,
    profileId,
    queryClient,
    language,
    activePropertyId,
    ar,
    langDialogOpen,
    openDialog,
    handleSelect,
    handleCancel,
    numericPropertyId,
    settings,
    profile,
    empLoading,
    refetch,
    effectivePropId,
    vacationModalOpen,
    setVacationModalOpen,
    vacationStartDate,
    setVacationStartDate,
    vacationEndDate,
    setVacationEndDate,
    vacationNotes,
    setVacationNotes,
    vacationSubmitting,
    setVacationSubmitting,
    vacationDurationDays,
    handleConfirmVacationFromDetail,
    handleReturnFromVacationDetail,
    _pData,
    properties,
    activeProp,
    fileRef,
    idFileRef,
    deletingDocIndex,
    setDeletingDocIndex,
    previewDoc,
    setPreviewDoc,
    editProfileOpen,
    setEditProfileOpen,
    handleIdImageUpload,
    handleDeleteDoc,
    handleDownloadDoc,
    uploading,
    setUploading,
    resetOpen,
    setResetOpen,
    setPwOpen,
    setSetPwOpen,
    pwSaving,
    setPwSaving,
    accessSaving,
    setAccessSaving,
    pwForm,
    setPwForm,
    portalProfileIdForQuery,
    portalAccount,
    refetchPortalAccount,
    allAssignments,
    assignmentsLoading,
    _rData,
    rooms,
    _bData,
    buildings,
    _fData,
    floors,
    roomMap,
    buildingMap,
    floorMap,
    rawAssignments,
    profileAssignments,
    currentAssignment,
    pastAssignments,
    printHousingLetter,
    extendModalOpen,
    setExtendModalOpen,
    extendNewDate,
    setExtendNewDate,
    extendNotes,
    setExtendNotes,
    extendLoading,
    setExtendLoading,
    openExtendFromDetail,
    applyExtendPresetDetail,
    handleConfirmExtendFromDetail,
    handlePhotoUpload,
  };
}

export type ProfileDetailState = ReturnType<typeof useProfileDetailState>;

// Values derived after ProfileDetail's loading/empty early returns (moved verbatim); the
// narrowed inputs (profileId, profile) are passed in non-null.
export function buildProfileDetailView(
  s: ProfileDetailState,
  profileId: NonNullable<ProfileDetailState["profileId"]>,
  profile: NonNullable<ProfileDetailState["profile"]>,
) {
  const {
    activePropertyId,
    ar,
    setResetOpen,
    setSetPwOpen,
    setPwSaving,
    setAccessSaving,
    pwForm,
    setPwForm,
    refetchPortalAccount,
  } = s;

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
        ar
          ? "تمت إعادة تعيين كلمة المرور بنجاح"
          : "Password Reset Successfully",
        {
          description: `${ar ? "كلمة المرور الجديدة" : "New password"}: ${data.temporaryPassword || "1234"}`,
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
      icon: <Calendar className="w-4 h-4 text-purple-500" />,
      label: ar ? "تاريخ الميلاد" : "Date of Birth",
      value: emp.dateOfBirth ? formatDate(emp.dateOfBirth) : null,
    },
    {
      icon: <Briefcase className="w-4 h-4" />,
      label: ar ? "القسم" : "Department",
      value:
        emp.employmentType === "THIRD_PARTY"
          ? null
          : getProfileDisplayDepartment(emp, ar),
    },
    {
      icon: <Briefcase className="w-4 h-4" />,
      label:
        emp.employmentType === "THIRD_PARTY"
          ? ar
            ? "الوظيفة / المهنة"
            : "Job / Role"
          : ar
            ? "المسمى الوظيفي"
            : "Job Title",
      value: getProfileDisplayJobTitle(emp, ar),
    },
    {
      icon: <Briefcase className="w-4 h-4" />,
      label: ar ? "الدرجة" : "Level",
      value: emp.employmentType === "THIRD_PARTY" ? null : emp.level,
    },
    {
      icon: <Briefcase className="w-4 h-4" />,
      label: ar ? "نوع التوظيف" : "Employment Type",
      value:
        emp.employmentType === "THIRD_PARTY"
          ? ar
            ? "طرف ثالث"
            : "Third Party"
          : ar
            ? "داخلي"
            : "Internal",
    },
    {
      icon: <Building2 className="w-4 h-4" />,
      label:
        emp.employmentType === "THIRD_PARTY"
          ? ar
            ? "اسم الشركة"
            : "Company Name"
          : ar
            ? "أين يعمل / الفندق"
            : "Works At / Hotel",
      value:
        emp.companyName ||
        (emp.employmentType === "INTERNAL" ? (ar ? "الفندق" : "Hotel") : null),
    },
    {
      icon: <Calendar className="w-4 h-4" />,
      label: ar ? "تاريخ التعيين" : "Hire Date",
      value:
        emp.employmentType === "THIRD_PARTY"
          ? null
          : emp.hireDate
            ? formatDate(emp.hireDate)
            : null,
    },
    {
      icon: <Clock className="w-4 h-4 text-amber-500" />,
      label: ar ? "تاريخ انتهاء العقد" : "Contract End Date",
      value:
        emp.employmentType !== "THIRD_PARTY" && emp.contractEndDate
          ? formatDate(emp.contractEndDate)
          : null,
    },
    {
      icon: <MapPin className="w-4 h-4" />,
      label: ar ? "العنوان" : "Address",
      value: emp.address,
    },
  ].filter((i) => i.value);
  return {
    profileId,
    profile,
    emp,
    portalPropertyId,
    portalProfileId,
    resetPortalPassword,
    setPortalPassword,
    togglePortalAccess,
    infoItems,
  };
}

export type ProfileDetailView = ReturnType<typeof buildProfileDetailView>;
