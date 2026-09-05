import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import { ProfileForm, EMPTY_FORM } from "../types";
import { FormRow } from "./FormRow";
import { Button } from "@/components/ui/button";
import { NationalitySelect } from "@/components/ui/nationality-select";
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
  Camera,
  X,
  FileText,
  Building,
  Users,
  UserPlus,
  ShieldCheck,
  Calendar,
  Lock,
  Eye,
  AlertCircle,
} from "lucide-react";
import { useCheckDuplicates } from "@/hooks/use-check-duplicates";
import {
  DocumentPreviewModal,
  type PreviewableDocument,
} from "@/components/ui/document-preview-modal";

export function ProfileDialog({
  propertyId,
  isOpen,
  onOpenChange,
  onSave,
  isSaving,
}: {
  propertyId: number;
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (data: ProfileForm, photo?: string) => void;
  isSaving: boolean;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<
    Partial<Record<keyof ProfileForm, string>>
  >({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PreviewableDocument | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      setPhotoData(result);
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoPreview(null);
    setPhotoData(null);
    if (photoRef.current) photoRef.current.value = "";
  };

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

  const set = (key: keyof ProfileForm, val: any) => {
    setForm((p) => ({ ...p, [key]: val }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
  };

  useEffect(() => {
    if (isOpen) {
      setForm({
        ...EMPTY_FORM,
        profileId: "",
        hireDate: new Date().toISOString().split("T")[0],
      });
      setErrors({});
      setPhotoPreview(null);
      setPhotoData(null);
    }
  }, [isOpen]);

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

  const filteredJobTitles = useMemo(() => {
    if (!form.department) return allJobTitles;
    return allJobTitles.filter(
      (t) => !t.parentValue || t.parentValue === form.department,
    );
  }, [allJobTitles, form.department]);

  const currentJobTitleObj = useMemo(() => {
    return allJobTitles.find((t) => t.value === form.jobTitle);
  }, [allJobTitles, form.jobTitle]);

  const isLevelLocked = Boolean(currentJobTitleObj?.extraValue);

  const { duplicates, hasDuplicates } = useCheckDuplicates({
    profileId: form.profileId,
    nationalId: form.nationalId,
    phone: form.phone,
    enabled: isOpen,
  });

  const validate = () => {
    if (hasDuplicates) {
      toast.error(
        ar
          ? "يرجى تعديل البيانات المكررة المحددة باللون الأحمر قبل الحفظ"
          : "Please resolve duplicate fields before saving",
      );
      return false;
    }

    const errs: Partial<Record<keyof ProfileForm, string>> = {};
    if (!form.firstName.trim())
      errs.firstName = ar ? "الاسم الأول مطلوب" : "First name required";
    if (!form.lastName.trim())
      errs.lastName = ar ? "الاسم الثاني مطلوب" : "Second name required";
    if (!form.nationalId.trim())
      errs.nationalId = ar ? "رقم الهوية مطلوب" : "National ID required";
    if (form.employmentType !== "THIRD_PARTY") {
      if (!form.department?.trim())
        errs.department = ar ? "القسم مطلوب" : "Department required";
      if (!form.jobTitle?.trim())
        errs.jobTitle = ar ? "المسمى الوظيفي مطلوب" : "Job title required";
      if (!form.hireDate)
        errs.hireDate = ar ? "تاريخ التعيين مطلوب" : "Hire date required";
    } else {
      if (!form.companyName?.trim())
        errs.companyName = ar ? "اسم الشركة مطلوب" : "Company name required";
      if (!form.jobTitle?.trim())
        errs.jobTitle = ar ? "الوظيفة / المهنة مطلوبة" : "Job/Occupation required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <UserPlus className="w-5 h-5 text-primary" />
            {ar ? "نيو بروفايل" : "New Profile"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {ar
              ? "قم بإدخال البيانات الشخصية والوظيفية ورفع المستندات لإنشاء الملف الشخصي"
              : "Enter personal, work information, and upload ID documents"}
          </p>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Top: Avatar Upload */}
          <div className="flex justify-center">
            <div className="relative group">
              <div
                className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted cursor-pointer hover:border-primary transition-all shadow-xs hover:shadow"
                onClick={() => photoRef.current?.click()}
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Camera className="w-6 h-6 text-primary/70" />
                    <span className="text-[11px] text-center leading-tight font-medium">
                      {ar ? "إضافة\nصورة" : "Add\nPhoto"}
                    </span>
                  </div>
                )}
              </div>
              {photoPreview && (
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md transition-transform hover:scale-110"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
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
            <div className="flex items-center justify-between border-b pb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                {ar ? "1. البيانات الشخصية الأساسية" : "1. Personal Information"}
              </p>
              <span className="text-xs text-muted-foreground font-mono">
                {form.profileId}
              </span>
            </div>

            {/* Names & ID Code */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormRow label={ar ? "كود الموظف *" : "Profile Code *"}>
                <Input
                  value={form.profileId}
                  onChange={(e) => set("profileId", e.target.value)}
                  placeholder={ar ? "مثال: EMP-001" : "e.g. EMP-001"}
                  className={
                    duplicates.profileId
                      ? "border-destructive focus-visible:ring-destructive bg-destructive/5"
                      : errors.profileId
                      ? "border-destructive"
                      : ""
                  }
                />
                {duplicates.profileId ? (
                  <div className="flex items-center gap-1.5 text-xs text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {ar
                        ? `كود الموظف مسجل مسبقاً باسم: ${duplicates.profileId.name}`
                        : `Code already registered to: ${duplicates.profileId.name}`}
                    </span>
                  </div>
                ) : errors.profileId ? (
                  <p className="text-xs text-destructive">{errors.profileId}</p>
                ) : null}
              </FormRow>
              <FormRow label={ar ? "الاسم الأول *" : "First Name *"}>
                <Input
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  className={errors.firstName ? "border-destructive" : ""}
                />
                {errors.firstName && (
                  <p className="text-xs text-destructive">{errors.firstName}</p>
                )}
              </FormRow>
              <FormRow label={ar ? "الاسم الثاني *" : "Second Name *"}>
                <Input
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  className={errors.lastName ? "border-destructive" : ""}
                />
                {errors.lastName && (
                  <p className="text-xs text-destructive">{errors.lastName}</p>
                )}
              </FormRow>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <FormRow label={ar ? "رقم الهوية / الإقامة *" : "National ID *"}>
                <Input
                  value={form.nationalId}
                  onChange={(e) => set("nationalId", e.target.value)}
                  className={
                    duplicates.nationalId
                      ? "border-destructive focus-visible:ring-destructive bg-destructive/5"
                      : errors.nationalId
                      ? "border-destructive"
                      : ""
                  }
                />
                {duplicates.nationalId ? (
                  <div className="flex items-center gap-1.5 text-xs text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {ar
                        ? `رقم الهوية مسجل مسبقاً للموظف: ${duplicates.nationalId.name} (كود: ${duplicates.nationalId.profileId})`
                        : `ID already registered to: ${duplicates.nationalId.name} (Code: ${duplicates.nationalId.profileId})`}
                    </span>
                  </div>
                ) : errors.nationalId ? (
                  <p className="text-xs text-destructive">{errors.nationalId}</p>
                ) : null}
              </FormRow>
            </div>

            {/* Nationality, Phone, Gender, DOB */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <FormRow label={ar ? "الجنسية" : "Nationality"}>
                <NationalitySelect
                  value={form.nationality}
                  onChange={(v) => set("nationality", v)}
                  propertyId={propertyId}
                  placeholder={ar ? "اختر الجنسية..." : "Select nationality..."}
                />
              </FormRow>

              <FormRow label={ar ? "الهاتف *" : "Phone *"}>
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+201..."
                  type="tel"
                  className={`h-9 ${
                    duplicates.phone
                      ? "border-destructive focus-visible:ring-destructive bg-destructive/5"
                      : ""
                  }`}
                />
                {duplicates.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {ar
                        ? `رقم الهاتف مسجل مسبقاً للموظف: ${duplicates.phone.name} (كود: ${duplicates.phone.profileId})`
                        : `Phone already registered to: ${duplicates.phone.name} (Code: ${duplicates.phone.profileId})`}
                    </span>
                  </div>
                )}
              </FormRow>

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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormRow label={ar ? "اسم الشركة *" : "Company Name *"}>
                  <Input
                    value={form.companyName}
                    onChange={(e) => set("companyName", e.target.value)}
                    placeholder={
                      ar
                        ? "أدخل اسم شركة المقاول أو المورد..."
                        : "Enter contractor/vendor company..."
                    }
                    className={errors.companyName ? "border-destructive" : ""}
                  />
                  {errors.companyName && (
                    <p className="text-xs text-destructive">{errors.companyName}</p>
                  )}
                </FormRow>

                <FormRow label={ar ? "الوظيفة / المهنة *" : "Job / Occupation *"}>
                  <Input
                    value={form.jobTitle}
                    onChange={(e) => set("jobTitle", e.target.value)}
                    placeholder={
                      ar
                        ? "مثال: أمن وحراسة، فني، نظافة، سائق..."
                        : "e.g. Security, Tech, Cleaner..."
                    }
                    className={errors.jobTitle ? "border-destructive" : ""}
                  />
                  {errors.jobTitle && (
                    <p className="text-xs text-destructive">{errors.jobTitle}</p>
                  )}
                </FormRow>
              </div>
            ) : (
              /* Internal Employee Full Work Information */
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormRow label={ar ? "يعمل لدى / الفندق" : "Works At"}>
                    <Input
                      value={form.companyName}
                      onChange={(e) => set("companyName", e.target.value)}
                      placeholder={
                        ar
                          ? "أدخل اسم الفندق أو الفرع..."
                          : "Enter hotel or branch name..."
                      }
                      className={errors.companyName ? "border-destructive" : ""}
                    />
                    {errors.companyName && (
                      <p className="text-xs text-destructive">{errors.companyName}</p>
                    )}
                  </FormRow>

                  <FormRow label={ar ? "تاريخ التعيين *" : "Hire Date *"}>
                    <DateInput
                      value={form.hireDate}
                      onChange={(iso) => set("hireDate", iso)}
                      className={errors.hireDate ? "border-destructive" : ""}
                    />
                    {errors.hireDate && (
                      <p className="text-xs text-destructive">{errors.hireDate}</p>
                    )}
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
                        onValueChange={(v) => {
                          set("department", v);
                          set("jobTitle", "");
                          set("level", "");
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue
                            placeholder={ar ? "اختر القسم..." : "Select dept..."}
                          />
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
                        placeholder={ar ? "القسم" : "Department"}
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
                          <SelectValue
                            placeholder={
                              !form.department && departments.length > 0
                                ? ar
                                  ? "اختر القسم أولاً"
                                  : "Select dept first"
                                : ar
                                  ? "اختر..."
                                  : "Select..."
                            }
                          />
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
                        placeholder={ar ? "المسمى الوظيفي" : "Job Title"}
                        className="h-9"
                      />
                    )}
                  </FormRow>

                  <FormRow label={ar ? "الدرجة / المستوى" : "Level"}>
                    <div className="space-y-1 w-full">
                      <Input
                        value={form.level}
                        onChange={(e) => set("level", e.target.value)}
                        placeholder={ar ? "أول، ثاني..." : "Senior, Junior..."}
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
                      {doc.fileData.startsWith("data:image") ? (
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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDoc(i);
                        }}
                        className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full flex items-center justify-center shadow transition-transform active:scale-90 z-20"
                        title={ar ? "إلغاء هذا المستند" : "Remove document"}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
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
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={() => {
              if (validate()) {
                const autoId = form.profileId.trim() || `${form.employmentType === "THIRD_PARTY" ? "TP" : "EMP"}-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
                const cleanedForm: ProfileForm = {
                  ...form,
                  status: "UNASSIGNED",
                  profileId: autoId,
                  hireDate:
                    form.employmentType === "THIRD_PARTY"
                      ? form.hireDate || new Date().toISOString().split("T")[0]
                      : form.hireDate,
                  department:
                    form.employmentType === "THIRD_PARTY" ? (ar ? "طرف ثالث" : "Third Party") : form.department,
                  level:
                    form.employmentType === "THIRD_PARTY" ? "" : form.level,
                  contractEndDate:
                    form.employmentType === "THIRD_PARTY" ? "" : form.contractEndDate,
                };
                onSave(cleanedForm, photoData ?? undefined);
              }
            }}
            disabled={isSaving || hasDuplicates}
            className="font-semibold"
          >
            {isSaving
              ? ar
                ? "جاري الحفظ..."
                : "Saving..."
              : ar
                ? "حفظ البروفايل"
                : "Save Profile"}
          </Button>
        </div>
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
