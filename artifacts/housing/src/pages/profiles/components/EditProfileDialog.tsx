import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateProfile,
  getListProfilesQueryKey,
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import { EditEmpForm } from "../types";
import { FormRow } from "./FormRow";
import { ProfileAvatar } from "./ProfileAvatar";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  X,
  FileText,
  Building,
  Users,
  ShieldCheck,
  Calendar,
  Lock,
  Pencil,
  Camera,
  Eye,
} from "lucide-react";
import {
  DocumentPreviewModal,
  type PreviewableDocument,
} from "@/components/ui/document-preview-modal";

export function EditProfileDialog({
  profile,
  propertyId,
  onClose,
}: {
  profile: any;
  propertyId: number;
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<PreviewableDocument | null>(null);

  const [form, setForm] = useState<EditEmpForm>({
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    thirdName: profile.thirdName ?? "",
    fourthName: profile.fourthName ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    nationalId: profile.nationalId ?? "",
    nationality: profile.nationality ?? "",
    gender: profile.gender ?? "M",
    dateOfBirth: profile.dateOfBirth ?? "",
    department: profile.department ?? "",
    jobTitle: profile.jobTitle ?? "",
    level: profile.level ?? "",
    status: profile.status ?? "ACTIVE",
    employmentType: profile.employmentType ?? "INTERNAL",
    companyName: profile.companyName ?? "",
    contractEndDate: profile.contractEndDate ?? "",
    idDocuments: profile.idDocuments || [],
  });

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(
          ar
            ? `${file.name} كبير جداً (الأقصى 5 ميجا)`
            : `${file.name} is too large (max 5MB)`,
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setForm((prev) => ({
          ...prev,
          idDocuments: [
            ...(prev.idDocuments || []),
            {
              fileName: file.name,
              fileType: file.type || "image/jpeg",
              fileData: reader.result as string,
            },
          ],
        }));
      };
      reader.readAsDataURL(file);
    });
    if (docsRef.current) docsRef.current.value = "";
  };

  const removeDoc = (index: number) => {
    setForm((prev) => {
      const newDocs = [...(prev.idDocuments || [])];
      newDocs.splice(index, 1);
      return { ...prev, idDocuments: newDocs };
    });
  };

  const downloadDoc = (doc: any) => {
    if (!doc.fileData) return;
    const link = document.createElement("a");
    link.href = doc.fileData;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { data: departments = [] } = useLookupValues(
    propertyId,
    LOOKUP_CATEGORIES.DEPARTMENT,
  );
  const { data: allJobTitles = [] } = useLookupValues(
    propertyId,
    LOOKUP_CATEGORIES.JOB_TITLE,
  );
  const { data: nationalities = [] } = useLookupValues(
    propertyId,
    LOOKUP_CATEGORIES.NATIONALITY,
  );

  const filteredJobTitles = form.department
    ? allJobTitles.filter(
        (jt) => !jt.parentValue || jt.parentValue === form.department,
      )
    : allJobTitles;

  const isLevelLocked = Boolean(
    allJobTitles.find((t) => t.value === form.jobTitle)?.extraValue,
  );

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListProfilesQueryKey({ propertyId }),
    });
    queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
  };

  const updateMutation = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم التحديث بنجاح" : "Profile updated successfully");
        onClose();
      },
      onError: (e: any) =>
        toast.error(ar ? "خطأ في التحديث" : "Update error", {
          description: e.message,
        }),
    },
  });

  const set = (field: keyof EditEmpForm, value: string) => {
    setForm((p) => {
      const n = { ...p, [field]: value };
      if (field === "department") {
        n.jobTitle = "";
        n.level = "";
      }
      return n;
    });
  };

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        await fetch(`/api/profiles/${profile.id}/photo`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoUrl: reader.result }),
        });
        toast.success(ar ? "تم تحديث الصورة" : "Photo updated");
        invalidate();
      } catch {
        toast.error(ar ? "خطأ في الرفع" : "Upload error");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName?.trim()) {
      toast.error(ar ? "الاسم الأول مطلوب" : "First name is required");
      return;
    }
    if (!form.lastName?.trim()) {
      toast.error(ar ? "الاسم الثاني مطلوب" : "Last name is required");
      return;
    }
    if (!form.nationalId?.trim()) {
      toast.error(ar ? "رقم الهوية مطلوب" : "National ID is required");
      return;
    }
    const { status: _omittedStatus, ...cleanData } = form;
    updateMutation.mutate({
      id: profile.id,
      data: {
        ...cleanData,
        department: form.employmentType === "THIRD_PARTY" ? "" : form.department,
        level: form.employmentType === "THIRD_PARTY" ? "" : form.level,
        contractEndDate:
          form.employmentType !== "THIRD_PARTY"
            ? form.contractEndDate || null
            : null,
      } as any,
    });
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Pencil className="w-5 h-5 text-amber-500" />
            {ar ? "تعديل البروفايل" : "Edit Profile"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {ar
              ? `تعديل بيانات الملف الشخصي (${profile.profileId})`
              : `Edit profile information (${profile.profileId})`}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Top Avatar Row */}
          <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-xl border">
            <div className="flex items-center gap-3.5">
              <ProfileAvatar
                firstName={profile.firstName}
                lastName={profile.lastName}
                photoUrl={profile.photoUrl}
                size="md"
              />
              <div>
                <p className="font-bold text-base leading-tight">
                  {profile.firstName} {profile.lastName}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {profile.profileId} • {profile.department || "—"}
                </p>
              </div>
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoFile}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="gap-2 text-xs h-9"
              >
                <Camera className="w-4 h-4 text-primary" />
                {uploading
                  ? ar
                    ? "جاري الرفع..."
                    : "Uploading..."
                  : ar
                    ? "تغيير الصورة"
                    : "Change Photo"}
              </Button>
            </div>
          </div>

          {/* Section 1: Employment Type */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {ar ? "نوع التوظيف" : "Employment Type"} <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    employmentType: "INTERNAL",
                    companyName: "",
                  }))
                }
                className={`flex items-center gap-2.5 p-3.5 border-2 rounded-xl text-sm transition-all ${
                  form.employmentType === "INTERNAL"
                    ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 ring-2 ring-blue-500/20"
                    : "border-border hover:border-muted-foreground bg-card"
                }`}
              >
                <Building className="w-4 h-4 text-blue-600" />
                <span className="font-semibold">
                  {ar ? "تعيين داخلي (موظف فندق)" : "Internal (Hotel Employee)"}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    employmentType: "THIRD_PARTY",
                    contractEndDate: "",
                  }))
                }
                className={`flex items-center gap-2.5 p-3.5 border-2 rounded-xl text-sm transition-all ${
                  form.employmentType === "THIRD_PARTY"
                    ? "border-purple-500 bg-purple-50/70 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 ring-2 ring-purple-500/20"
                    : "border-border hover:border-muted-foreground bg-card"
                }`}
              >
                <Users className="w-4 h-4 text-purple-600" />
                <span className="font-semibold">
                  {ar ? "طرف ثالث" : "Third-Party"}
                </span>
              </button>
            </div>
          </div>

          {/* Section 2: Personal Information */}
          <div className="rounded-xl border bg-muted/20 p-4 space-y-4 shadow-2xs">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              {ar ? "1. البيانات الشخصية الأساسية" : "1. Personal Information"}
            </p>

            {/* Names */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <FormRow label={ar ? "الاسم الأول *" : "First Name *"}>
                <Input
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  required
                />
              </FormRow>
              <FormRow label={ar ? "الاسم الثاني *" : "Second Name *"}>
                <Input
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  required
                />
              </FormRow>
              <FormRow label={ar ? "الاسم الثالث" : "Third Name"}>
                <Input
                  value={form.thirdName}
                  onChange={(e) => set("thirdName", e.target.value)}
                />
              </FormRow>
              <FormRow label={ar ? "الاسم الرابع" : "Fourth Name"}>
                <Input
                  value={form.fourthName}
                  onChange={(e) => set("fourthName", e.target.value)}
                />
              </FormRow>
            </div>

            {/* National ID, Nationality, Phone, Gender, DOB */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormRow label={ar ? "رقم الهوية / الإقامة *" : "National ID *"}>
                <Input
                  value={form.nationalId}
                  onChange={(e) => set("nationalId", e.target.value)}
                  required
                />
              </FormRow>
              <FormRow label={ar ? "الجنسية" : "Nationality"}>
                {nationalities.length > 0 ? (
                  <Select
                    value={form.nationality}
                    onValueChange={(v) => set("nationality", v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={ar ? "اختر..." : "Select..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {nationalities.map((n) => (
                        <SelectItem key={n.id} value={n.value}>
                          {n.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.nationality}
                    onChange={(e) => set("nationality", e.target.value)}
                    className="h-9"
                  />
                )}
              </FormRow>
              <FormRow label={ar ? "الهاتف" : "Phone"}>
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  type="tel"
                  className="h-9"
                />
              </FormRow>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormRow label={ar ? "الجنس" : "Gender"}>
                <Select
                  value={form.gender}
                  onValueChange={(v) => set("gender", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">{ar ? "ذكر" : "Male"}</SelectItem>
                    <SelectItem value="F">{ar ? "أنثى" : "Female"}</SelectItem>
                  </SelectContent>
                </Select>
              </FormRow>
              <FormRow label={ar ? "تاريخ الميلاد" : "Date of Birth"}>
                <DateInput
                  value={form.dateOfBirth}
                  onChange={(iso) => set("dateOfBirth", iso)}
                  className="h-9"
                />
              </FormRow>
            </div>

            {/* Address */}
            <FormRow label={ar ? "العنوان بالكامل" : "Full Address"}>
              <Input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder={ar ? "أدخل العنوان بالتفصيل..." : "Full address..."}
              />
            </FormRow>
          </div>

          {/* Section 3: Work & Job Information */}
          <div className="rounded-xl border bg-muted/20 p-4 space-y-4 shadow-2xs">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-primary" />
              {ar ? "2. بيانات العمل والوظيفة" : "2. Work & Job Information"}
            </p>

            {form.employmentType === "THIRD_PARTY" ? (
              /* Third-Party Simplified Work Information */
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormRow label={ar ? "اسم الشركة *" : "Company Name *"}>
                  <Input
                    value={form.companyName}
                    onChange={(e) => set("companyName", e.target.value)}
                    placeholder={ar ? "أدخل اسم شركة المقاول أو المورد..." : "Enter company name..."}
                    required
                  />
                </FormRow>

                <FormRow label={ar ? "الوظيفة / المهنة *" : "Job / Occupation *"}>
                  <Input
                    value={form.jobTitle}
                    onChange={(e) => set("jobTitle", e.target.value)}
                    placeholder={ar ? "مثال: أمن وحراسة، فني، نظافة، سائق..." : "e.g. Security, Tech, Cleaner..."}
                    required
                  />
                </FormRow>

                <FormRow label={ar ? "حالة التسكين" : "Housing Status"}>
                  <div className="h-9 flex items-center">
                    <StatusBadge status={form.status} />
                  </div>
                </FormRow>
              </div>
            ) : (
              /* Internal Employee Standard Work Information */
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormRow label={ar ? "يعمل لدى / الفندق" : "Works At"}>
                    <Input
                      value={form.companyName}
                      onChange={(e) => set("companyName", e.target.value)}
                      placeholder={ar ? "أدخل اسم الفندق/المكان..." : "Enter hotel/place name..."}
                    />
                  </FormRow>

                  <FormRow label={ar ? "حالة التسكين" : "Housing Status"}>
                    <div className="h-9 flex items-center">
                      <StatusBadge status={form.status} />
                    </div>
                  </FormRow>
                </div>

                {/* Contract End Date - Special Highlight Card for Internal Employees */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 rounded-lg">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      {ar
                        ? "تاريخ انتهاء العقد (خاص بالموظفين الداخليين)"
                        : "Contract End Date (Internal Employee)"}
                    </Label>
                    <DateInput
                      value={form.contractEndDate || ""}
                      onChange={(iso) => set("contractEndDate", iso)}
                      className="bg-background border-amber-300 dark:border-amber-700 h-9"
                    />
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground pt-3 sm:pt-0">
                    <p className="leading-relaxed">
                      ⚡{" "}
                      {ar
                        ? "يُستخدم تلقائياً كتاريخ مغادرة الغرفة وانتهاء صلاحية كارت المفتاح عند التسكين."
                        : "Auto-populates room check-out date & smart key card expiry date upon assignment."}
                    </p>
                  </div>
                </div>

                {/* Department, Job Title, Level */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormRow label={ar ? "القسم" : "Department"}>
                    {departments.length > 0 ? (
                      <Select
                        value={form.department}
                        onValueChange={(v) => set("department", v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={ar ? "اختر..." : "Select..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.value}>
                              {d.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={form.department}
                        onChange={(e) => set("department", e.target.value)}
                        className="h-9"
                      />
                    )}
                  </FormRow>

                  <FormRow label={ar ? "المسمى الوظيفي" : "Job Title"}>
                    {allJobTitles.length > 0 ? (
                      <Select
                        value={form.jobTitle}
                        onValueChange={(v) => {
                          const jt = allJobTitles.find((t) => t.value === v);
                          setForm((p) => ({
                            ...p,
                            jobTitle: v,
                            level: jt?.extraValue || p.level,
                          }));
                        }}
                        disabled={!form.department && departments.length > 0}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={ar ? "اختر..." : "Select..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredJobTitles.map((j) => (
                            <SelectItem key={j.id} value={j.value}>
                              {j.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={form.jobTitle}
                        onChange={(e) => set("jobTitle", e.target.value)}
                        className="h-9"
                      />
                    )}
                  </FormRow>

                  <FormRow label={ar ? "الدرجة / المستوى" : "Level"}>
                    <div className="space-y-1 w-full">
                      <Input
                        value={form.level}
                        onChange={(e) => set("level", e.target.value)}
                        placeholder="Senior, Junior..."
                        disabled={isLevelLocked}
                        className={`h-9 ${
                          isLevelLocked
                            ? "bg-muted/60 font-semibold text-primary cursor-not-allowed"
                            : ""
                        }`}
                      />
                      {isLevelLocked && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                          <Lock className="w-3 h-3 text-amber-500" />
                          {ar
                            ? "تم قفل الدرجة تلقائياً حسب المسمى الوظيفي"
                            : "Level locked from selected Job Title"}
                        </p>
                      )}
                    </div>
                  </FormRow>
                </div>
              </>
            )}
          </div>

          {/* Section 4: Documents & Attachments */}
          <div className="rounded-xl border bg-muted/20 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b pb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                {ar
                  ? "3. صور الهوية وجواز السفر والمستندات"
                  : "3. ID Documents & Passport Attachments"}
              </p>
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {(form.idDocuments || []).length} {ar ? "مرفقات" : "files"}
              </span>
            </div>

            <input
              ref={docsRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleDocSelect}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => docsRef.current?.click()}
              className="w-full border-dashed h-11 gap-2 bg-background hover:bg-muted font-medium"
            >
              <FileText className="w-4 h-4 text-primary" />
              {ar
                ? "+ إضافة صور البطاقة أو جواز السفر أو عقود العمل"
                : "+ Add ID Cards, Passports or Contract Documents"}
            </Button>

            {form.idDocuments && form.idDocuments.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                {form.idDocuments.map((doc, i) => (
                  <div
                    key={i}
                    className="relative group border rounded-lg overflow-hidden h-28 flex flex-col justify-between bg-card shadow-xs"
                  >
                    <div
                      className="relative h-20 w-full bg-muted/30 overflow-hidden flex items-center justify-center cursor-pointer group/thumb"
                      onClick={() =>
                        setPreviewDoc({
                          fileName: doc.fileName,
                          fileType: doc.fileType,
                          fileData: doc.fileData,
                          title: doc.fileName,
                        })
                      }
                      title={ar ? "انقر للمعاينة" : "Click to preview"}
                    >
                      {doc.fileData?.startsWith("data:image") ? (
                        <img
                          src={doc.fileData}
                          alt={doc.fileName}
                          className="absolute inset-0 w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground group-hover/thumb:text-primary transition-colors">
                          <span className="text-xs font-mono font-bold">PDF</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <Eye className="w-5 h-5 text-white drop-shadow" />
                      </div>
                      <div className="absolute top-1 right-1 flex items-center gap-1 z-20">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewDoc({
                              fileName: doc.fileName,
                              fileType: doc.fileType,
                              fileData: doc.fileData,
                              title: doc.fileName,
                            });
                          }}
                          className="w-6 h-6 bg-background/80 hover:bg-background text-foreground rounded-full flex items-center justify-center shadow text-xs"
                          title={ar ? "معاينة" : "Preview"}
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        {doc.fileData && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadDoc(doc);
                            }}
                            className="w-6 h-6 bg-background/80 hover:bg-background text-foreground rounded-full flex items-center justify-center shadow text-xs"
                            title={ar ? "تحميل" : "Download"}
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDoc(i);
                          }}
                          className="w-6 h-6 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full flex items-center justify-center shadow text-xs transition-transform active:scale-90"
                          title={ar ? "حذف" : "Remove"}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div
                      className="p-1.5 bg-background border-t cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setPreviewDoc({
                          fileName: doc.fileName,
                          fileType: doc.fileType,
                          fileData: doc.fileData,
                          title: doc.fileName,
                        })
                      }
                    >
                      <span
                        className="text-[11px] font-medium truncate block"
                        title={doc.fileName}
                      >
                        {doc.fileName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="font-semibold"
            >
              {updateMutation.isPending
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? "حفظ التعديلات"
                  : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <DocumentPreviewModal
      doc={previewDoc}
      isOpen={!!previewDoc}
      onClose={() => setPreviewDoc(null)}
    />
    </>
  );
}
