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
  Sparkles,
  Languages,
  Loader2,
  Search,
} from "lucide-react";
import { useProperty } from "@/context/PropertyContext";
import { transliterateToken } from "@/lib/bilingual-name-engine";
import { translateDepartment, translateJobTitle } from "@/lib/bilingual-hospitality-dict";
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
  propertyId?: number | "all";
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (data: ProfileForm, photo?: string, targetPropertyId?: number) => void;
  isSaving: boolean;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const { properties, activePropertyId: contextPropertyId } = useProperty();

  const [selectedPropertyId, setSelectedPropertyId] = useState<number>(() => {
    if (typeof propertyId === "number" && propertyId > 0) return propertyId;
    if (typeof contextPropertyId === "number" && contextPropertyId > 0) return contextPropertyId;
    const first = properties?.find((p) => p.id > 0);
    return first ? first.id : 1;
  });

  useEffect(() => {
    if (typeof propertyId === "number" && propertyId > 0) {
      setSelectedPropertyId(propertyId);
    } else if (typeof contextPropertyId === "number" && contextPropertyId > 0) {
      setSelectedPropertyId(contextPropertyId);
    }
  }, [propertyId, contextPropertyId]);

  const effectivePropertyId =
    typeof propertyId === "number" && propertyId > 0
      ? propertyId
      : selectedPropertyId;

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

  const [manuallyEditedAr, setManuallyEditedAr] = useState({
    firstName: false,
    lastName: false,
    thirdName: false,
    fourthName: false,
  });
  const [manuallyEditedEn, setManuallyEditedEn] = useState({
    firstName: false,
    lastName: false,
    thirdName: false,
    fourthName: false,
  });

  const [fullArabicInput, setFullArabicInput] = useState("");

  const handleFullArabicNameChange = (val: string) => {
    setFullArabicInput(val);
    const parts = val.trim().split(/\s+/).filter(Boolean);
    const p1 = parts[0] || "";
    const p2 = parts[1] || "";
    const p3 = parts[2] || "";
    const p4 = parts.slice(3).join(" ") || "";

    const fnEn = p1 ? transliterateToken(p1, "en") : "";
    const lnEn = p2 ? transliterateToken(p2, "en") : "";
    const tnEn = p3 ? transliterateToken(p3, "en") : "";
    const foEn = p4 ? transliterateToken(p4, "en") : "";

    setForm((prev) => ({
      ...prev,
      firstNameAr: p1,
      lastNameAr: p2,
      thirdNameAr: p3,
      fourthNameAr: p4,
      firstName: fnEn,
      lastName: lnEn,
      thirdName: tnEn,
      fourthName: foEn,
    }));
  };

  const handleNameChange = (
    field: "firstName" | "lastName" | "thirdName" | "fourthName",
    value: string,
    lang: "en" | "ar"
  ) => {
    const enKey = field;
    const arKey = `${field}Ar` as keyof ProfileForm;

    if (lang === "en") {
      set(field, value);
      setManuallyEditedEn((prev) => ({ ...prev, [field]: true }));
      if (!manuallyEditedAr[field]) {
        const transliterated = transliterateToken(value, "ar");
        set(arKey, transliterated);
      }
    } else {
      set(arKey, value);
      setManuallyEditedAr((prev) => ({ ...prev, [field]: true }));
      if (!manuallyEditedEn[field]) {
        const transliterated = transliterateToken(value, "en");
        set(enKey, transliterated);
      }
    }
  };

  const handleAutoTranslateNames = () => {
    const fnAr = form.firstName ? transliterateToken(form.firstName, "ar") : form.firstNameAr;
    const lnAr = form.lastName ? transliterateToken(form.lastName, "ar") : form.lastNameAr;
    const tnAr = form.thirdName ? transliterateToken(form.thirdName, "ar") : form.thirdNameAr;
    const foAr = form.fourthName ? transliterateToken(form.fourthName, "ar") : form.fourthNameAr;

    const fnEn = !form.firstName && form.firstNameAr ? transliterateToken(form.firstNameAr, "en") : form.firstName;
    const lnEn = !form.lastName && form.lastNameAr ? transliterateToken(form.lastNameAr, "en") : form.lastName;
    const tnEn = !form.thirdName && form.thirdNameAr ? transliterateToken(form.thirdNameAr, "en") : form.thirdName;
    const foEn = !form.fourthName && form.fourthNameAr ? transliterateToken(form.fourthNameAr, "en") : form.fourthName;

    setForm((p) => ({
      ...p,
      firstName: fnEn || p.firstName,
      lastName: lnEn || p.lastName,
      thirdName: tnEn || p.thirdName,
      fourthName: foEn || p.fourthName,
      firstNameAr: fnAr || p.firstNameAr,
      lastNameAr: lnAr || p.lastNameAr,
      thirdNameAr: tnAr || p.thirdNameAr,
      fourthNameAr: foAr || p.fourthNameAr,
    }));
    toast.success(ar ? "تمت الترجمة والتعريب الصوتي للأسماء تلقائياً" : "Names auto-transliterated successfully");
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
      setManuallyEditedAr({
        firstName: false,
        lastName: false,
        thirdName: false,
        fourthName: false,
      });
      setManuallyEditedEn({
        firstName: false,
        lastName: false,
        thirdName: false,
        fourthName: false,
      });
    }
  }, [isOpen]);

  const { data: departments = [] } = useLookupValues(
    effectivePropertyId,
    LOOKUP_CATEGORIES.DEPARTMENT,
  );
  const { data: allJobTitles = [] } = useLookupValues(
    effectivePropertyId,
    LOOKUP_CATEGORIES.JOB_TITLE,
  );
  const { data: nationalities = [] } = useLookupValues(
    effectivePropertyId,
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
    propertyId: effectivePropertyId,
    enabled: isOpen,
  });

  const [isLookingUpHr, setIsLookingUpHr] = useState(false);

  const handleLookupFromHr = async () => {
    const code = form.profileId?.trim();
    if (!code) {
      toast.error(
        ar
          ? "يرجى كتابة الرقم الوظيفي / كود الموظف أولاً"
          : "Please enter Employee Code / Clock Number first",
      );
      return;
    }

    setIsLookingUpHr(true);
    try {
      const resp = await fetch(
        `/api/hr-sync/esign/lookup?clockNo=${encodeURIComponent(code)}&propertyId=${effectivePropertyId}`,
        { credentials: "include" },
      );
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Failed to fetch from HR");
      }

      if (data.notFound || !data.employee) {
        toast.warning(
          ar
            ? `لم يتم العثور على أي موظف يحمل الكود (${code}) في نظام الـ HR الفندقي`
            : `No employee found with code (${code}) in HR system`,
        );
        return;
      }

      const emp = data.employee;
      setForm((prev) => ({
        ...prev,
        firstName: emp.firstName || prev.firstName,
        lastName: emp.lastName || prev.lastName,
        thirdName: emp.thirdName || prev.thirdName,
        fourthName: emp.fourthName || prev.fourthName,
        firstNameAr: emp.firstNameAr || prev.firstNameAr,
        lastNameAr: emp.lastNameAr || prev.lastNameAr,
        thirdNameAr: emp.thirdNameAr || prev.thirdNameAr,
        fourthNameAr: emp.fourthNameAr || prev.fourthNameAr,
        nationalId: emp.nationalId || prev.nationalId,
        nationality: emp.nationality || prev.nationality,
        phone: emp.phone || prev.phone,
        address: emp.address || prev.address,
        gender: emp.gender || prev.gender,
        department: emp.department || prev.department,
        departmentAr: emp.departmentAr || prev.departmentAr,
        jobTitle: emp.jobTitle || prev.jobTitle,
        jobTitleAr: emp.jobTitleAr || prev.jobTitleAr,
        level: emp.level || prev.level,
        hireDate: emp.hireDate || prev.hireDate,
        dateOfBirth: emp.dateOfBirth || prev.dateOfBirth,
        contractEndDate: emp.contractEndDate || prev.contractEndDate,
        companyName: emp.companyName || emp.hotelName || prev.companyName,
      }));

      // Mark names as populated
      setManuallyEditedAr({
        firstName: Boolean(emp.firstNameAr),
        lastName: Boolean(emp.lastNameAr),
        thirdName: Boolean(emp.thirdNameAr),
        fourthName: Boolean(emp.fourthNameAr),
      });
      setManuallyEditedEn({
        firstName: Boolean(emp.firstName),
        lastName: Boolean(emp.lastName),
        thirdName: Boolean(emp.thirdName),
        fourthName: Boolean(emp.fourthName),
      });

      toast.success(
        ar
          ? `تم جلب وتعبئة بيانات الموظف (${emp.firstName || ""} ${emp.lastName || ""}) بنجاح من نظام الـ HR!`
          : `Fetched employee data for (${emp.firstName || ""} ${emp.lastName || ""}) from HR!`,
      );
    } catch (err: any) {
      toast.error(
        err?.message ||
          (ar
            ? "فشل جلب بيانات الموظف من سيرفر الـ HR"
            : "Failed to fetch employee from HR"),
      );
    } finally {
      setIsLookingUpHr(false);
    }
  };

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
    const hasFirstName = Boolean(form.firstName?.trim() || form.firstNameAr?.trim());
    const hasLastName = Boolean(form.lastName?.trim() || form.lastNameAr?.trim());

    if (!hasFirstName) {
      errs.firstName = ar ? "الاسم الأول مطلوب" : "First name required";
    }
    if (!hasLastName) {
      errs.lastName = ar ? "الاسم الثاني مطلوب" : "Second name required";
    }
    if (!form.nationalId?.trim()) {
      errs.nationalId = ar ? "رقم الهوية مطلوب" : "National ID required";
    }

    if (form.employmentType === "THIRD_PARTY") {
      if (!form.companyName?.trim()) {
        errs.companyName = ar ? "اسم الشركة مطلوب" : "Company name required";
      }
      if (!form.jobTitle?.trim()) {
        errs.jobTitle = ar ? "الوظيفة / المهنة مطلوبة" : "Job/Occupation required";
      }
    } else {
      if (!form.department?.trim()) {
        errs.department = ar ? "القسم مطلوب" : "Department required";
      }
      if (!form.jobTitle?.trim()) {
        errs.jobTitle = ar ? "المسمى الوظيفي مطلوب" : "Job title required";
      }
      if (!form.hireDate) {
        errs.hireDate = ar ? "تاريخ التعيين مطلوب" : "Hire date required";
      }
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

          {/* Target Hotel / Property (Shown when propertyId is "all" or not a specific hotel) */}
          {(typeof propertyId !== "number" || propertyId <= 0) && (
            <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-1.5">
              <Label className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Building className="w-4 h-4" />
                {ar ? "الفندق / المنشأة التابع لها الموظف *" : "Target Hotel / Property *"}
              </Label>
              <Select
                value={String(effectivePropertyId)}
                onValueChange={(val) => setSelectedPropertyId(Number(val))}
              >
                <SelectTrigger className="h-9 bg-background">
                  <SelectValue placeholder={ar ? "اختر الفندق..." : "Select hotel/property..."} />
                </SelectTrigger>
                <SelectContent>
                  {properties
                    .filter((p) => p.id > 0)
                    .map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

            {/* ID & Identifiers Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormRow
                label={
                  ar
                    ? "الرقم الوظيفي / كود الموظف (Clock Number) *"
                    : "Employee / Clock No *"
                }
              >
                <div className="flex gap-2">
                  <Input
                    value={form.profileId}
                    onChange={(e) => set("profileId", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleLookupFromHr();
                      }
                    }}
                    placeholder={ar ? "مثال: 1042 أو EMP-001" : "e.g. 1042"}
                    className={
                      duplicates.profileId
                        ? "border-destructive focus-visible:ring-destructive bg-destructive/5"
                        : errors.profileId
                        ? "border-destructive"
                        : ""
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleLookupFromHr}
                    disabled={isLookingUpHr || !form.profileId?.trim()}
                    className="shrink-0 gap-1.5 h-9 px-3 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                    title={
                      ar
                        ? "جلب بيانات الموظف تلقائياً من سيرفر الموارد البشرية"
                        : "Fetch employee details from HR"
                    }
                  >
                    {isLookingUpHr ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>{ar ? "جلب من الـ HR" : "Fetch HR"}</span>
                  </Button>
                </div>
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
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {ar
                      ? "اكتب الرقم الوظيفي واضغط (Enter) أو زر (جلب من الـ HR) للتعبئة التلقائية للبيانات"
                      : "Type clock number & click fetch to auto-fill form"}
                  </p>
                )}
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

            {/* Bilingual Name Inputs with Realtime Auto-Translation */}
            <div className="p-3.5 bg-background border rounded-xl space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-primary" />
                  {ar ? "اسم الموظف باللغتين (English & العربية)" : "Employee Name (English & Arabic)"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoTranslateNames}
                  className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  {ar ? "تعريب وترجمة تلقائية" : "Auto-Transliterate"}
                </Button>
              </div>

              {/* Full Arabic Name Single-Field Entry with Auto Transliteration */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    {ar ? "إدخال الاسم الرباعي كاملاً بالعربية (ترجمة وتوزيع فوري للإنجليزية)" : "Full Arabic Name (Instant Auto-Translate to English)"}
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    {ar ? "اكتب أو الصق الاسم كاملاً وسيتم توزيعه وترجمته تلقائياً" : "Type or paste full Arabic name to auto-fill both languages"}
                  </span>
                </div>
                <Input
                  value={fullArabicInput}
                  onChange={(e) => handleFullArabicNameChange(e.target.value)}
                  placeholder={ar ? "اكتب الاسم الرباعي كاملاً هنا (مثال: محمد طارق أحمد محمود)..." : "Type full Arabic name here..."}
                  dir="rtl"
                  className="h-9 bg-background border-primary/30 font-medium"
                />
              </div>

              {/* English Names */}
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                  {ar ? "الاسم باللغة الإنجليزية (English Name)" : "English Name (Passport / System)"}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <FormRow label={ar ? "الاسم الأول *" : "First Name *"}>
                    <Input
                      value={form.firstName}
                      onChange={(e) => handleNameChange("firstName", e.target.value, "en")}
                      placeholder="e.g. Mohamed"
                      dir="ltr"
                      className={errors.firstName ? "border-destructive h-9" : "h-9"}
                    />
                    {errors.firstName && (
                      <p className="text-xs text-destructive">{errors.firstName}</p>
                    )}
                  </FormRow>
                  <FormRow label={ar ? "الاسم الثاني *" : "Second Name *"}>
                    <Input
                      value={form.lastName}
                      onChange={(e) => handleNameChange("lastName", e.target.value, "en")}
                      placeholder="e.g. Ahmed"
                      dir="ltr"
                      className={errors.lastName ? "border-destructive h-9" : "h-9"}
                    />
                    {errors.lastName && (
                      <p className="text-xs text-destructive">{errors.lastName}</p>
                    )}
                  </FormRow>
                  <FormRow label={ar ? "الاسم الثالث" : "Third Name"}>
                    <Input
                      value={form.thirdName}
                      onChange={(e) => handleNameChange("thirdName", e.target.value, "en")}
                      placeholder="e.g. Mahmoud"
                      dir="ltr"
                      className="h-9"
                    />
                  </FormRow>
                  <FormRow label={ar ? "الاسم الرابع" : "Fourth Name"}>
                    <Input
                      value={form.fourthName}
                      onChange={(e) => handleNameChange("fourthName", e.target.value, "en")}
                      placeholder="e.g. Ali"
                      dir="ltr"
                      className="h-9"
                    />
                  </FormRow>
                </div>
              </div>

              {/* Arabic Names */}
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  {ar ? "الاسم باللغة العربية (Arabic Name)" : "Arabic Name (Official ID)"}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <FormRow label={ar ? "الاسم الأول (عربي)" : "First Name (Ar)"}>
                    <Input
                      value={form.firstNameAr || ""}
                      onChange={(e) => handleNameChange("firstName", e.target.value, "ar")}
                      placeholder="مثال: محمد"
                      dir="rtl"
                      className="h-9"
                    />
                  </FormRow>
                  <FormRow label={ar ? "الاسم الثاني (عربي)" : "Second Name (Ar)"}>
                    <Input
                      value={form.lastNameAr || ""}
                      onChange={(e) => handleNameChange("lastName", e.target.value, "ar")}
                      placeholder="مثال: أحمد"
                      dir="rtl"
                      className="h-9"
                    />
                  </FormRow>
                  <FormRow label={ar ? "الاسم الثالث (عربي)" : "Third Name (Ar)"}>
                    <Input
                      value={form.thirdNameAr || ""}
                      onChange={(e) => handleNameChange("thirdName", e.target.value, "ar")}
                      placeholder="مثال: محمود"
                      dir="rtl"
                      className="h-9"
                    />
                  </FormRow>
                  <FormRow label={ar ? "الاسم الرابع (عربي)" : "Fourth Name (Ar)"}>
                    <Input
                      value={form.fourthNameAr || ""}
                      onChange={(e) => handleNameChange("fourthName", e.target.value, "ar")}
                      placeholder="مثال: علي"
                      dir="rtl"
                      className="h-9"
                    />
                  </FormRow>
                </div>
              </div>
            </div>

            {/* Nationality, Phone, Gender, DOB */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <FormRow label={ar ? "الجنسية" : "Nationality"}>
                <NationalitySelect
                  value={form.nationality}
                  onChange={(v) => set("nationality", v)}
                  propertyId={effectivePropertyId}
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
                  <FormRow label={ar ? "أين يعمل / الفندق" : "Works At / Hotel"}>
                    <Input
                      value={form.companyName}
                      onChange={(e) => set("companyName", e.target.value)}
                      placeholder={
                        ar
                          ? "اسم الفندق التابع له الموظف..."
                          : "Enter hotel or workplace..."
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

                {/* Department (EN & AR) + Level */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    <div className="sm:col-span-2">
                      <FormRow label={ar ? "القسم (إنجليزي)" : "Department (English)"}>
                        {departments.length > 0 ? (
                          <div className="flex gap-1.5">
                            <Select
                              value={form.department}
                              onValueChange={(v) => {
                                const matched = departments.find((d) => d.value === v);
                                const arDept = matched?.valueAr || translateDepartment(v, "ar");
                                setForm((p) => ({
                                  ...p,
                                  department: v,
                                  departmentAr: arDept || p.departmentAr || "",
                                  jobTitle: "",
                                  jobTitleAr: "",
                                  level: "",
                                }));
                              }}
                            >
                              <SelectTrigger className="h-9 flex-1">
                                <SelectValue
                                  placeholder={ar ? "اختر القسم..." : "Select dept..."}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {departments.map((d) => (
                                  <SelectItem key={d.id} value={d.value}>
                                    {ar && d.valueAr ? `${d.valueAr} (${d.value})` : d.value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              value={form.department}
                              onChange={(e) => {
                                const v = e.target.value;
                                set("department", v);
                                if (!form.departmentAr) {
                                  set("departmentAr", translateDepartment(v, "ar"));
                                }
                              }}
                              placeholder={ar ? "أو يدوي" : "Or type..."}
                              className="h-9 w-24 text-xs shrink-0"
                            />
                          </div>
                        ) : (
                          <Input
                            value={form.department}
                            onChange={(e) => {
                              const v = e.target.value;
                              set("department", v);
                              if (!form.departmentAr) {
                                set("departmentAr", translateDepartment(v, "ar"));
                              }
                            }}
                            placeholder={ar ? "القسم بالإنجليزي" : "Department (EN)"}
                            className="h-9"
                          />
                        )}
                      </FormRow>
                    </div>

                    <div className="sm:col-span-2">
                      <FormRow label={ar ? "القسم (عربي)" : "Department (Arabic)"}>
                        <Input
                          value={form.departmentAr || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            set("departmentAr", v);
                            if (!form.department) {
                              set("department", translateDepartment(v, "en"));
                            }
                          }}
                          placeholder={ar ? "مثال: المكاتب الأمامية" : "e.g. المكاتب الأمامية"}
                          dir="rtl"
                          className="h-9"
                        />
                      </FormRow>
                    </div>

                    <div className="sm:col-span-1">
                      <FormRow label={ar ? "الدرجة / المستوى" : "Level"}>
                        <div className="space-y-1 w-full">
                          <Input
                            value={form.level}
                            onChange={(e) => set("level", e.target.value)}
                            placeholder={ar ? "أول، ثاني..." : "Senior..."}
                            disabled={isLevelLocked}
                            className={`h-9 ${
                              isLevelLocked
                                ? "bg-muted/60 font-semibold text-primary cursor-not-allowed"
                                : ""
                            }`}
                          />
                          {isLevelLocked && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                              <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                              {ar ? "مقفل" : "Locked"}
                            </p>
                          )}
                        </div>
                      </FormRow>
                    </div>
                  </div>

                  {/* Job Title (EN & AR) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormRow label={ar ? "المسمى الوظيفي (إنجليزي)" : "Job Title (English)"}>
                      {allJobTitles.length > 0 ? (
                        <div className="flex gap-1.5">
                          <Select
                            value={form.jobTitle}
                            onValueChange={(v) => {
                              const jt = allJobTitles.find((t) => t.value === v);
                              const arTitle = jt?.valueAr || translateJobTitle(v, "ar");
                              setForm((p) => ({
                                ...p,
                                jobTitle: v,
                                jobTitleAr: arTitle || p.jobTitleAr || "",
                                level: jt?.extraValue || p.level,
                              }));
                            }}
                            disabled={!form.department && departments.length > 0}
                          >
                            <SelectTrigger className="h-9 flex-1">
                              <SelectValue
                                placeholder={
                                  !form.department && departments.length > 0
                                    ? ar
                                      ? "اختر القسم أولاً"
                                      : "Select dept first"
                                    : ar
                                      ? "اختر المسمى..."
                                      : "Select job title..."
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredJobTitles.map((j) => (
                                <SelectItem key={j.id} value={j.value}>
                                  {ar && j.valueAr ? `${j.valueAr} (${j.value})` : j.value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={form.jobTitle}
                            onChange={(e) => {
                              const v = e.target.value;
                              set("jobTitle", v);
                              if (!form.jobTitleAr) {
                                set("jobTitleAr", translateJobTitle(v, "ar"));
                              }
                            }}
                            placeholder={ar ? "أو يدوي" : "Or type..."}
                            className="h-9 w-24 text-xs shrink-0"
                          />
                        </div>
                      ) : (
                        <Input
                          value={form.jobTitle}
                          onChange={(e) => {
                            const v = e.target.value;
                            set("jobTitle", v);
                            if (!form.jobTitleAr) {
                              set("jobTitleAr", translateJobTitle(v, "ar"));
                            }
                          }}
                          placeholder={ar ? "المسمى بالإنجليزي" : "Job Title (EN)"}
                          className="h-9"
                        />
                      )}
                    </FormRow>

                    <FormRow label={ar ? "المسمى الوظيفي (عربي)" : "Job Title (Arabic)"}>
                      <Input
                        value={form.jobTitleAr || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          set("jobTitleAr", v);
                          if (!form.jobTitle) {
                            set("jobTitle", translateJobTitle(v, "en"));
                          }
                        }}
                        placeholder={ar ? "مثال: موظف استقبال" : "e.g. موظف استقبال"}
                        dir="rtl"
                        className="h-9"
                      />
                    </FormRow>
                  </div>
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
                const autoId =
                  form.profileId.trim() ||
                  `${form.employmentType === "THIRD_PARTY" ? "TP" : "EMP"}-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

                const fnEn =
                  form.firstName.trim() ||
                  (form.firstNameAr ? transliterateToken(form.firstNameAr, "en") : "");
                const lnEn =
                  form.lastName.trim() ||
                  (form.lastNameAr ? transliterateToken(form.lastNameAr, "en") : "");
                const tnEn =
                  form.thirdName?.trim() ||
                  (form.thirdNameAr ? transliterateToken(form.thirdNameAr, "en") : "");
                const foEn =
                  form.fourthName?.trim() ||
                  (form.fourthNameAr ? transliterateToken(form.fourthNameAr, "en") : "");

                const fnAr =
                  form.firstNameAr?.trim() ||
                  (form.firstName ? transliterateToken(form.firstName, "ar") : "");
                const lnAr =
                  form.lastNameAr?.trim() ||
                  (form.lastName ? transliterateToken(form.lastName, "ar") : "");
                const tnAr =
                  form.thirdNameAr?.trim() ||
                  (form.thirdName ? transliterateToken(form.thirdName, "ar") : "");
                const foAr =
                  form.fourthNameAr?.trim() ||
                  (form.fourthName ? transliterateToken(form.fourthName, "ar") : "");

                const cleanedForm: ProfileForm = {
                  ...form,
                  status: "UNASSIGNED",
                  profileId: autoId,
                  firstName: fnEn,
                  lastName: lnEn,
                  thirdName: tnEn,
                  fourthName: foEn,
                  firstNameAr: fnAr,
                  lastNameAr: lnAr,
                  thirdNameAr: tnAr,
                  fourthNameAr: foAr,
                  nationality: form.nationality.trim() || (ar ? "مصر" : "Egyptian"),
                  hireDate:
                    form.employmentType === "THIRD_PARTY"
                      ? (form.hireDate || new Date().toISOString().split("T")[0])
                      : form.hireDate,
                  department:
                    form.employmentType === "THIRD_PARTY"
                      ? "Third Party"
                      : (form.department?.trim() || translateDepartment(form.departmentAr || "", "en")),
                  departmentAr:
                    form.employmentType === "THIRD_PARTY"
                      ? "طرف ثالث"
                      : (form.departmentAr?.trim() || translateDepartment(form.department || "", "ar")),
                  jobTitle:
                    form.employmentType === "THIRD_PARTY"
                      ? (form.jobTitle?.trim() || "Third Party Staff")
                      : (form.jobTitle?.trim() || translateJobTitle(form.jobTitleAr || "", "en")),
                  jobTitleAr:
                    form.employmentType === "THIRD_PARTY"
                      ? (form.jobTitleAr?.trim() || "عمالة طرف ثالث")
                      : (form.jobTitleAr?.trim() || translateJobTitle(form.jobTitle || "", "ar")),
                  level:
                    form.employmentType === "THIRD_PARTY"
                      ? (form.level.trim() || "طرف ثالث")
                      : (form.level.trim() || "عامل"),
                  contractEndDate:
                    form.employmentType === "THIRD_PARTY"
                      ? ""
                      : (form.contractEndDate?.trim() || ""),
                  dateOfBirth: form.dateOfBirth?.trim() || "",
                };
                onSave(cleanedForm, photoData ?? undefined, effectivePropertyId);
              }
            }}
            disabled={isSaving}
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
