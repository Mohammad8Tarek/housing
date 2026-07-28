// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEmployees,
  useCreateEmployee,
  useDeleteEmployee,
  useUpdateEmployee,
  getListEmployeesQueryKey,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Link } from "wouter";
import {
  Eye,
  Trash2,
  Plus,
  Search,
  Users,
  AlertCircle,
  FileSpreadsheet,
  Pencil,
  Download,
  Upload,
  X,
  CheckCircle2,
  Camera,
  Key,
  ArrowRightLeft,
} from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ColumnChooser,
  useColumnVisibility,
} from "@/components/ui/column-chooser";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import * as XLSX from "xlsx";
import { DataPagination } from "@/components/DataPagination";
import { PaginationBar } from "@/components/ui/PaginationBar";

const MAX_EMPLOYEE_IMPORT_FILE_SIZE = 1024 * 1024;
const EMPLOYEE_IMPORT_EXTENSIONS = [".xlsx", ".xls"];

/* ── Employee Photo Avatar ──────────────────────────────────────────────── */
function EmployeeAvatar({
  firstName,
  lastName,
  size = "sm",
  photoUrl,
}: {
  firstName: string;
  lastName: string;
  size?: "sm" | "md";
  photoUrl?: string | null;
}) {
  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const dim = size === "md" ? "w-12 h-12 text-base" : "w-8 h-8 text-xs";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={initials}
        className={`${dim} rounded-full object-cover border flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0`}
    >
      <span className="font-bold text-primary">{initials}</span>
    </div>
  );
}

/* ── Photo Upload Button ────────────────────────────────────────────────── */
function PhotoUploadBtn({
  empId,
  onUploaded,
}: {
  empId: number;
  onUploaded?: () => void;
}) {
  const { language } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(
        language === "ar"
          ? "المل�? كبير جداً (الحد 2MB)"
          : "File too large (max 2MB)",
      );
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await fetch(`/api/employees/${empId}/photo`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoUrl: reader.result }),
        });
        toast.success(language === "ar" ? "تم ر�?ع الصورة" : "Photo uploaded");
        onUploaded?.();
        window.location.reload();
      } catch {
        toast.error(language === "ar" ? "خطأ �?ي الر�?ع" : "Upload error");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        title={language === "ar" ? "ر�?ع صورة" : "Upload photo"}
      >
        <Camera className="w-4 h-4 text-muted-foreground" />
      </Button>
    </>
  );
}

/* ── Types ──────────────────────────────────────────────────────────────── */
type EmployeeForm = {
  employeeId: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  nationalId: string;
  nationality: string;
  hireDate: string;
  gender: string;
  department: string;
  jobTitle: string;
  level: string;
  status: string;
};

const EMPTY_FORM: EmployeeForm = {
  employeeId: "",
  firstName: "",
  lastName: "",
  phone: "",
  address: "",
  nationalId: "",
  nationality: "",
  hireDate: "",
  gender: "M",
  department: "",
  jobTitle: "",
  level: "",
  status: "ACTIVE",
};

/* ── Sub-components ─────────────────────────────────────────────────────── */
function FormRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    {
      label: string;
      variant: "default" | "secondary" | "destructive" | "outline";
    }
  > = {
    ACTIVE: { label: "Active", variant: "default" },
    LEFT: { label: "Left", variant: "secondary" },
    SUSPENDED: { label: "Suspended", variant: "destructive" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

/* ── Employee Add Dialog ─────────────────────────────────────────────────── */
function EmployeeDialog({
  propertyId,
  isOpen,
  onOpenChange,
  onSave,
  isSaving,
}: {
  propertyId: number;
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (data: EmployeeForm, photo?: string) => void;
  isSaving: boolean;
}) {
  const { language } = useLanguage();
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<
    Partial<Record<keyof EmployeeForm, string>>
  >({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

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

  const set = (field: keyof EmployeeForm, value: string) => {
    setForm((p) => {
      const n = { ...p, [field]: value };
      if (field === "department") n.jobTitle = "";
      return n;
    });
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const validate = () => {
    const e: Partial<Record<keyof EmployeeForm, string>> = {};
    if (!form.employeeId.trim()) e.employeeId = "Required";
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!form.nationalId.trim()) e.nationalId = "Required";
    if (!form.hireDate) e.hireDate = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const ar = language === "ar";
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) {
          setForm(EMPTY_FORM);
          setErrors({});
          clearPhoto();
        }
        onOpenChange(v);
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        srTitle={ar ? "إضافة موظف جديد" : "Add New Employee"}
      >
        <DialogHeader>
          <DialogTitle>
            {ar ? "إضافة موظف جديد" : "Add New Employee"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-1">
          {/* Photo picker */}
          <div className="flex justify-center">
            <div className="relative group">
              <div
                className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center overflow-hidden bg-muted cursor-pointer hover:border-primary transition-colors"
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
                    <Camera className="w-7 h-7" />
                    <span className="text-xs text-center leading-tight px-1">
                      {ar ? "إضافة\nصورة" : "Add\nPhoto"}
                    </span>
                  </div>
                )}
              </div>
              {photoPreview && (
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shadow"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormRow label={ar ? "كود الموظف *" : "Employee Code *"}>
              <Input
                value={form.employeeId}
                onChange={(e) => set("employeeId", e.target.value)}
                placeholder="EMP-001"
                className={errors.employeeId ? "border-destructive" : ""}
              />
              {errors.employeeId && (
                <p className="text-xs text-destructive">{errors.employeeId}</p>
              )}
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
            <FormRow label={ar ? "الاسم الأخير *" : "Last Name *"}>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormRow label={ar ? "رقم الهوية *" : "National ID *"}>
              <Input
                value={form.nationalId}
                onChange={(e) => set("nationalId", e.target.value)}
                className={errors.nationalId ? "border-destructive" : ""}
              />
              {errors.nationalId && (
                <p className="text-xs text-destructive">{errors.nationalId}</p>
              )}
            </FormRow>
            <FormRow label={ar ? "الجنسية" : "Nationality"}>
              {nationalities.length > 0 ? (
                <Select
                  value={form.nationality}
                  onValueChange={(v) => set("nationality", v)}
                >
                  <SelectTrigger>
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
                  placeholder={ar ? "مثال: مصرية" : "e.g. Egyptian"}
                />
              )}
            </FormRow>
            <FormRow label={ar ? "الهاتف" : "Phone"}>
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+201..."
                type="tel"
              />
            </FormRow>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormRow label={ar ? "الجنس" : "Gender"}>
              <Select
                value={form.gender}
                onValueChange={(v) => set("gender", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">{ar ? "ذكر" : "Male"}</SelectItem>
                  <SelectItem value="F">{ar ? "أنثى" : "Female"}</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label={ar ? "تاريخ التعيين *" : "Hire Date *"}>
              <Input
                type="date"
                value={form.hireDate}
                onChange={(e) => set("hireDate", e.target.value)}
                className={errors.hireDate ? "border-destructive" : ""}
              />
              {errors.hireDate && (
                <p className="text-xs text-destructive">{errors.hireDate}</p>
              )}
            </FormRow>
            <FormRow label={ar ? "الحالة" : "Status"}>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">
                    {ar ? "نشط" : "Active"}
                  </SelectItem>
                  <SelectItem value="LEFT">{ar ? "مغادر" : "Left"}</SelectItem>
                  <SelectItem value="SUSPENDED">
                    {ar ? "موقوف" : "Suspended"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormRow>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormRow label={ar ? "القسم" : "Department"}>
              {departments.length > 0 ? (
                <Select
                  value={form.department}
                  onValueChange={(v) => set("department", v)}
                >
                  <SelectTrigger>
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
                <div className="space-y-1">
                  <Input
                    value={form.department}
                    onChange={(e) => set("department", e.target.value)}
                    placeholder={ar ? "القسم" : "Department"}
                  />
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {ar ? "أضف الأقسام في الإعدادات" : "Add depts in Settings"}
                  </p>
                </div>
              )}
            </FormRow>
            <FormRow label={ar ? "المسمى الوظيفي" : "Job Title"}>
              {allJobTitles.length > 0 ? (
                <Select
                  value={form.jobTitle}
                  onValueChange={(v) => set("jobTitle", v)}
                  disabled={!form.department && departments.length > 0}
                >
                  <SelectTrigger>
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
                />
              )}
            </FormRow>
            <FormRow label={ar ? "الدرجة" : "Level"}>
              <Input
                value={form.level}
                onChange={(e) => set("level", e.target.value)}
                placeholder={ar ? "أول، ثاني..." : "Senior, Junior..."}
              />
            </FormRow>
          </div>
          <FormRow label={ar ? "العنوان" : "Address"}>
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder={ar ? "العنوان بالكامل..." : "Full address..."}
            />
          </FormRow>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={() => {
              if (validate()) onSave(form, photoData ?? undefined);
            }}
            disabled={isSaving}
          >
            {isSaving
              ? ar
                ? "جاري الحفظ..."
                : "Saving..."
              : ar
                ? "إضافة موظف"
                : "Add Employee"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Edit Employee Dialog ───────────────────────────────────────────────── */
type EditEmpForm = {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  nationalId: string;
  nationality: string;
  gender: string;
  department: string;
  jobTitle: string;
  level: string;
  status: string;
};

function EditEmployeeDialog({
  employee,
  propertyId,
  onClose,
}: {
  employee: any;
  propertyId: number;
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  const [form, setForm] = useState<EditEmpForm>({
    firstName: employee.firstName ?? "",
    lastName: employee.lastName ?? "",
    phone: employee.phone ?? "",
    address: employee.address ?? "",
    nationalId: employee.nationalId ?? "",
    nationality: employee.nationality ?? "",
    gender: employee.gender ?? "M",
    department: employee.department ?? "",
    jobTitle: employee.jobTitle ?? "",
    level: employee.level ?? "",
    status: employee.status ?? "ACTIVE",
  });

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

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListEmployeesQueryKey({ propertyId }),
    });
    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
  };

  const updateMutation = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم التحديث" : "Employee updated");
        onClose();
      },
      onError: (e: any) =>
        toast.error(ar ? "خطأ" : "Error", {
          description: e.message,
        }),
    },
  });

  const set = (field: keyof EditEmpForm, value: string) => {
    setForm((p) => {
      const n = { ...p, [field]: value };
      if (field === "department") n.jobTitle = "";
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
        await fetch(`/api/employees/${employee.id}/photo`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoUrl: reader.result }),
        });
        toast.success(ar ? "تم رفع الصورة" : "Photo uploaded");
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

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        srTitle={ar ? "تعديل الموظف" : "Edit Employee"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EmployeeAvatar
              firstName={employee.firstName}
              lastName={employee.lastName}
              photoUrl={employee.photoUrl}
              size="md"
            />
            <div>
              <p className="font-bold">
                {employee.firstName} {employee.lastName}
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                {employee.employeeId}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <div className="flex gap-2 border-b mb-4">
            {[
              { id: "info", label: ar ? "البيانات" : "Info" },
              { id: "photo", label: ar ? "الصورة" : "Photo" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "info" | "photo")}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "info" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormRow label={ar ? "الاسم الأول" : "First Name"}>
                  <Input
                    value={form.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                  />
                </FormRow>
                <FormRow label={ar ? "الاسم الأخير" : "Last Name"}>
                  <Input
                    value={form.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                  />
                </FormRow>
                <FormRow label={ar ? "رقم الهوية" : "National ID"}>
                  <Input
                    value={form.nationalId}
                    onChange={(e) => set("nationalId", e.target.value)}
                  />
                </FormRow>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormRow label={ar ? "الجنسية" : "Nationality"}>
                  {nationalities.length > 0 ? (
                    <Select
                      value={form.nationality}
                      onValueChange={(v) => set("nationality", v)}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={ar ? "اختر..." : "Select..."}
                        />
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
                    />
                  )}
                </FormRow>
                <FormRow label={ar ? "الهاتف" : "Phone"}>
                  <Input
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    type="tel"
                  />
                </FormRow>
                <FormRow label={ar ? "الجنس" : "Gender"}>
                  <Select
                    value={form.gender}
                    onValueChange={(v) => set("gender", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">{ar ? "ذكر" : "Male"}</SelectItem>
                      <SelectItem value="F">
                        {ar ? "أنثى" : "Female"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormRow>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormRow label={ar ? "القسم" : "Department"}>
                  {departments.length > 0 ? (
                    <Select
                      value={form.department}
                      onValueChange={(v) => set("department", v)}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={ar ? "اختر..." : "Select..."}
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
                    />
                  )}
                </FormRow>
                <FormRow label={ar ? "المسمى الوظيفي" : "Job Title"}>
                  {allJobTitles.length > 0 ? (
                    <Select
                      value={form.jobTitle}
                      onValueChange={(v) => set("jobTitle", v)}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={ar ? "اختر..." : "Select..."}
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
                    />
                  )}
                </FormRow>
                <FormRow label={ar ? "الدرجة" : "Level"}>
                  <Input
                    value={form.level}
                    onChange={(e) => set("level", e.target.value)}
                    placeholder="Senior, Junior..."
                  />
                </FormRow>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormRow label={ar ? "الحالة" : "Status"}>
                  <Select
                    value={form.status}
                    onValueChange={(v) => set("status", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">
                        {ar ? "نشط" : "Active"}
                      </SelectItem>
                      <SelectItem value="LEFT">
                        {ar ? "مغادر" : "Left"}
                      </SelectItem>
                      <SelectItem value="SUSPENDED">
                        {ar ? "موقوف" : "Suspended"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormRow>
                <FormRow label={ar ? "العنوان" : "Address"}>
                  <Input
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                  />
                </FormRow>
              </div>
            </div>
          )}

          {activeTab === "photo" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 py-4">
                <EmployeeAvatar
                  firstName={employee.firstName}
                  lastName={employee.lastName}
                  photoUrl={employee.photoUrl}
                  size="md"
                />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    {ar
                      ? "قم بتحميل صورة بحجم أقصاه 2MB (JPG/PNG)"
                      : "Upload a photo up to 2MB (JPG/PNG)"}
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoFile}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {uploading
                      ? ar
                        ? "جاري الرفع..."
                        : "Uploading..."
                      : ar
                        ? "رفع صورة جديدة"
                        : "Upload New Photo"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {activeTab === "info" && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() =>
                updateMutation.mutate({ id: employee.id, data: form as any })
              }
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? "حفظ التغييرات"
                  : "Save Changes"}
            </Button>
          </div>
        )}
        {activeTab === "photo" && (
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              {ar ? "إغلاق" : "Close"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Excel Import Types ─────────────────────────────────────────────────── */
type ImportRow = {
  Employee_Code: string;
  First_Name: string;
  Last_Name: string;
  Department: string;
  Job_Title: string;
  Nationality: string;
  Gender: string;
  National_ID: string;
  Phone?: string;
  Hire_Date?: string;
  Level?: string;
  Address?: string;
};

/* ── Excel Import Dialog ─────────────────────────────────────────────────── */
function ExcelImportDialog({
  propertyId,
  isOpen,
  onClose,
  onImport,
  isImporting,
}: {
  propertyId: number;
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: EmployeeForm[]) => void;
  isImporting: boolean;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "Employee_Code",
        "First_Name",
        "Last_Name",
        "Department",
        "Job_Title",
        "Nationality",
        "Gender",
        "National_ID",
        "Phone",
        "Hire_Date",
        "Level",
        "Address",
      ],
      [
        "EMP-001",
        "Ahmed",
        "Al-Said",
        "IT",
        "Developer",
        "Saudi",
        "M",
        "1234567890",
        "+966501234567",
        "2024-01-01",
        "Senior",
        "Riyadh",
      ],
      [
        "EMP-002",
        "Fatima",
        "Hassan",
        "HR",
        "HR Specialist",
        "Egyptian",
        "F",
        "0987654321",
        "+966507654321",
        "2024-03-15",
        "Junior",
        "Jeddah",
      ],
    ]);
    ws["!cols"] = Array(12).fill({ wch: 18 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "employee_import_template.xlsx");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!EMPLOYEE_IMPORT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      setParseError(ar ? "نوع الملف غير مدعوم" : "Unsupported file type");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_EMPLOYEE_IMPORT_FILE_SIZE) {
      setParseError(
        ar
          ? "الملف كبير جداً. الحد الأقصى 1 ميغابايت"
          : "File is too large. Maximum size is 1 MB",
      );
      e.target.value = "";
      return;
    }
    setFileName(file.name);
    setParseError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, {
          type: "binary",
          sheetRows: 101,
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: "" });
        if (rows.length === 0) {
          setParseError(ar ? "الملف فارغ" : "File is empty");
          return;
        }
        setPreview(rows.slice(0, 100));
      } catch {
        setParseError(ar ? "فشل في قراءة الملف" : "Failed to parse file");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleImport = () => {
    const rows: EmployeeForm[] = preview.map((r) => ({
      employeeId: String(r.Employee_Code || ""),
      firstName: String(r.First_Name || ""),
      lastName: String(r.Last_Name || ""),
      department: String(r.Department || ""),
      jobTitle: String(r.Job_Title || ""),
      nationality: String(r.Nationality || ""),
      gender: String(r.Gender || "M").toUpperCase() === "F" ? "F" : "M",
      nationalId: String(r.National_ID || ""),
      phone: String(r.Phone || ""),
      hireDate: String(r.Hire_Date || new Date().toISOString().split("T")[0]),
      level: String(r.Level || ""),
      address: String(r.Address || ""),
      status: "ACTIVE",
    }));
    onImport(rows);
  };

  const reset = () => {
    setPreview([]);
    setFileName("");
    setParseError("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && reset()}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-y-auto"
        srTitle={ar ? "استيراد موظفين من إكسل" : "Import Employees from Excel"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            {ar ? "استيراد موظفين من إكسل" : "Import Employees from Excel"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Download Template */}
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
              {ar ? "الخطوة 1: تحميل قالب Excel" : "Step 1: Download Template"}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
              {ar
                ? "قم بتحميل النموذج، واملأ بيانات الموظفين، ثم ارفعه مرة أخرى"
                : "Download the template, fill in employee data, then upload it back"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <Download className="w-4 h-4 mr-2" />
              {ar ? "تحميل قالب Excel" : "Download Excel Template"}
            </Button>
          </div>

          {/* Step 2: Upload */}
          <div className="p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors">
            <p className="text-sm font-semibold mb-2">
              {ar ? "الخطوة 2: رفع الملف" : "Step 2: Upload File"}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {ar ? "اختر ملف إكسل" : "Choose Excel File"}
              </Button>
              {fileName && (
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  {fileName}
                  <button
                    onClick={() => {
                      setPreview([]);
                      setFileName("");
                    }}
                    className="hover:text-destructive"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
            </div>
            {parseError && (
              <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {parseError}
              </p>
            )}
          </div>

          {/* Step 3: Preview */}
          {preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  {ar
                    ? `معاينة (${preview.length} موظ�?)`
                    : `Preview (${preview.length} employees)`}
                </p>
              </div>
              <div className="border rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {[
                          "Code",
                          "First Name",
                          "Last Name",
                          "Dept",
                          "Job Title",
                          "Nationality",
                          "Gender",
                          "National ID",
                        ].map((h) => (
                          <th
                            key={h}
                            className="p-2 text-left font-semibold text-muted-foreground whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="p-2 font-mono">
                            {String(row.Employee_Code)}
                          </td>
                          <td className="p-2">{String(row.First_Name)}</td>
                          <td className="p-2">{String(row.Last_Name)}</td>
                          <td className="p-2">{String(row.Department)}</td>
                          <td className="p-2">{String(row.Job_Title)}</td>
                          <td className="p-2">{String(row.Nationality)}</td>
                          <td className="p-2">{String(row.Gender)}</td>
                          <td className="p-2 font-mono">
                            {String(row.National_ID)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {ar
                  ? "سيتم ربط جميع الموظفين بالعقار النشط الحالي"
                  : "All employees will be linked to the current active property"}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={reset}>
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={handleImport}
            disabled={preview.length === 0 || isImporting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {isImporting
              ? ar
                ? "جاري الاستيراد..."
                : "Importing..."
              : ar
                ? `استيراد ${preview.length} موظ�?`
                : `Import ${preview.length} employees`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Employees Page ─────────────────────────────────────────────────── */
export default function Employees() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const ar = language === "ar";

  const [isOpen, setIsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const LIMIT = 25;
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [page, setPage] = useState(1);

  // Reset to page 1 when search or status changes
  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterDept]);
  const [resettingPasswordId, setResettingPasswordId] = useState<number | null>(
    null,
  );

  const { data: _eData, isLoading } = useListEmployees(
    { propertyId: activePropertyId ?? undefined },
    {
      query: {
        queryKey: getListEmployeesQueryKey({
          propertyId: activePropertyId ?? undefined,
          limit: 1000,
        }),
        enabled: !!activePropertyId,
      },
    },
  );
  const employees = _eData?.data || [];

  const { data: departments = [] } = useLookupValues(
    activePropertyId,
    LOOKUP_CATEGORIES.DEPARTMENT,
  );

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListEmployeesQueryKey({ propertyId: activePropertyId }),
    });
    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
  };

  const createMutation = useCreateEmployee({ mutation: {} });

  const deleteMutation = useDeleteEmployee({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم الحذف" : "Deleted");
        setDeleteTarget(null);
      },
    },
  });

  const handleSave = async (formData: EmployeeForm, photo?: string) => {
    try {
      const created = await createMutation.mutateAsync({
        data: { ...formData, propertyId: activePropertyId! } as any,
      });
      if (photo && created?.id) {
        await fetch(`/api/employees/${created.id}/photo`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoUrl: photo }),
        });
      }
      invalidate();
      toast.success(ar ? "تمت إضافة الموظف" : "Employee added");
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Error");
    }
  };

  const handleBulkImport = async (rows: EmployeeForm[]) => {
    setIsImporting(true);
    setImportProgress(0);
    let success = 0;
    let failed = 0;
    for (let i = 0; i < rows.length; i++) {
      try {
        await createMutation.mutateAsync({
          data: { ...rows[i], propertyId: activePropertyId! } as any,
        });
        success++;
        setImportProgress(Math.round(((i + 1) / rows.length) * 100));
      } catch {
        failed++;
      }
    }
    invalidate();
    setIsImporting(false);
    setImportOpen(false);
    const toastFn = failed > 0 ? toast.error : toast.success;
    toastFn(
      ar
        ? `?? ????????? ????? ${success} ????${failed > 0 ? ` (${failed} ???)` : ""}`
        : `Imported ${success} employees${failed > 0 ? ` (${failed} failed)` : ""}`,
    );
  };

  const handleResetPassword = async (employee: any) => {
    setResettingPasswordId(employee.id);
    try {
      const res = await fetch("/api/portal-auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.employeeId,
          propertyId: activePropertyId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          ar ? "تم إنشاء كلمة مرور مؤقتة" : "Temporary Password Generated",
          {
            description: data.temporaryPassword
              ? `${ar ? "كلمة المرور المؤقتة" : "Temporary password"}: ${data.temporaryPassword}`
              : data.message,
          },
        );
      } else {
        toast.error(ar ? "خطأ" : "Error", {
          description: data.message,
        });
      }
    } catch (err: any) {
      toast.error(ar ? "خطأ" : "Error", {
        description: err.message,
      });
    } finally {
      setResettingPasswordId(null);
    }
  };

  const filtered = employees;

  const EMP_COLS = [
    { key: "photo", label: "Photo", labelAr: "صورة", defaultVisible: true },
    { key: "code", label: "Code", labelAr: "الكود", defaultVisible: true },
    {
      key: "firstName",
      label: "First Name",
      labelAr: "الاسم الأول",
      defaultVisible: true,
    },
    {
      key: "lastName",
      label: "Last Name",
      labelAr: "الاسم الأخير",
      defaultVisible: true,
    },
    {
      key: "nid",
      label: "National ID",
      labelAr: "رقم الهوية",
      defaultVisible: true,
    },
    { key: "phone", label: "Phone", labelAr: "الهات�?", defaultVisible: true },
    {
      key: "nationality",
      label: "Nationality",
      labelAr: "الجنسية",
      defaultVisible: true,
    },
    { key: "gender", label: "Gender", labelAr: "الجنس", defaultVisible: true },
    {
      key: "dept",
      label: "Department",
      labelAr: "القسم",
      defaultVisible: true,
    },
    {
      key: "title",
      label: "Job Title",
      labelAr: "المسمى الوظي�?ي",
      defaultVisible: true,
    },
    { key: "level", label: "Level", labelAr: "الدرجة", defaultVisible: true },
    {
      key: "address",
      label: "Address",
      labelAr: "العنوان",
      defaultVisible: false,
    },
    {
      key: "hiredate",
      label: "Hire Date",
      labelAr: "تاريخ التعيين",
      defaultVisible: true,
    },
    { key: "status", label: "Status", labelAr: "الحالة", defaultVisible: true },
    {
      key: "actions",
      label: "Actions",
      labelAr: "إجراءات",
      defaultVisible: true,
      fixed: true,
    },
  ];
  const {
    visible: colVisible,
    toggle: colToggle,
    showAll: colShowAll,
    hideAll: colHideAll,
    isVisible: isColVisible,
  } = useColumnVisibility(EMP_COLS);

  const currentPageEmps = employees;
  const pagedEmpIds = currentPageEmps.map((e) => e.id);
  const allEmpPageSelected =
    pagedEmpIds.length > 0 && pagedEmpIds.every((id) => selectedRows.has(id));
  const toggleSelectAll = () => {
    if (allEmpPageSelected) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedEmpIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedEmpIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };
  const toggleEmpRow = (id: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exportSelectedExcel = () => {
    const target =
      selectedRows.size > 0
        ? employees.filter((e) => selectedRows.has(e.id))
        : employees;
    const rows = target.map((e) => ({
      Code: e.employeeId,
      "First Name": e.firstName,
      "Last Name": e.lastName,
      "National ID": e.nationalId ?? "",
      Phone: e.phone ?? "",
      Nationality: e.nationality ?? "",
      Gender: e.gender === "M" ? "Male" : e.gender === "F" ? "Female" : "",
      Department: e.department ?? "",
      "Job Title": e.jobTitle ?? "",
      Level: e.level ?? "",
      Address: e.address ?? "",
      "Hire Date": e.hireDate ? new Date(e.hireDate).toLocaleDateString() : "",
      Status: e.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(
      wb,
      `employees_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {ar ? "الموظفون" : "Employees"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {ar
              ? `إجمالي ${employees.length} موظ�?`
              : `${employees.length} total employees`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnChooser
            cols={EMP_COLS}
            visible={colVisible}
            onToggle={colToggle}
            onShowAll={colShowAll}
            onHideAll={colHideAll}
            ar={ar}
          />
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
            {ar ? "استيراد Excel" : "Import Excel"}
          </Button>
          <PermissionGate module="employees" action="create">
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {ar ? "إضافة موظف" : "Add Employee"}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Import progress */}
      {isImporting && (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-primary">
              {ar ? "جاري الاستيراد..." : "Importing..."}
            </span>
            <span className="text-sm font-bold text-primary">
              {importProgress}%
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${importProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={
                  ar
                    ? "بحث بالاسم أو الكود أو القسم..."
                    : "Search name, code, department..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue
                  placeholder={ar ? "كل الأقسام" : "All Departments"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {ar ? "كل الأقسام" : "All Departments"}
                </SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.value}>
                    {d.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder={ar ? "كل الحالات" : "All Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {ar ? "كل الحالات" : "All Status"}
                </SelectItem>
                <SelectItem value="ACTIVE">{ar ? "نشط" : "Active"}</SelectItem>
                <SelectItem value="LEFT">{ar ? "مغادر" : "Left"}</SelectItem>
                <SelectItem value="SUSPENDED">
                  {ar ? "موقوف" : "Suspended"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      <BulkActionBar
        count={selectedRows.size}
        onClear={() => setSelectedRows(new Set())}
        onExportExcel={exportSelectedExcel}
        ar={ar}
      />

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-md bg-card">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {ar ? "لم يتم العثور على موظفين" : "No employees found"}
          </p>
          <p className="text-sm mt-1">
            {search || filterDept !== "ALL" || filterStatus !== "ALL"
              ? ar
                ? "جرب تغيير معايير البحث"
                : "Try changing your search"
              : ar
                ? "إضافة موظف أو استيراد من إكسل"
                : "Add an employee or import from Excel"}
          </p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10 px-3">
                  <Checkbox
                    checked={allEmpPageSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                {isColVisible("photo") && (
                  <TableHead className="font-semibold w-12">
                    {ar ? "صورة" : "Photo"}
                  </TableHead>
                )}
                {isColVisible("code") && (
                  <TableHead className="font-semibold">
                    {ar ? "الكود" : "Code"}
                  </TableHead>
                )}
                {isColVisible("firstName") && (
                  <TableHead className="font-semibold">
                    {ar ? "الاسم الأول" : "First Name"}
                  </TableHead>
                )}
                {isColVisible("lastName") && (
                  <TableHead className="font-semibold">
                    {ar ? "الاسم الأخير" : "Last Name"}
                  </TableHead>
                )}
                {isColVisible("nid") && (
                  <TableHead className="font-semibold">
                    {ar ? "رقم الهوية" : "National ID"}
                  </TableHead>
                )}
                {isColVisible("phone") && (
                  <TableHead className="font-semibold">
                    {ar ? "الهاتف" : "Phone"}
                  </TableHead>
                )}
                {isColVisible("nationality") && (
                  <TableHead className="font-semibold">
                    {ar ? "الجنسية" : "Nationality"}
                  </TableHead>
                )}
                {isColVisible("gender") && (
                  <TableHead className="font-semibold">
                    {ar ? "الجنس" : "Gender"}
                  </TableHead>
                )}
                {isColVisible("dept") && (
                  <TableHead className="font-semibold">
                    {ar ? "القسم" : "Department"}
                  </TableHead>
                )}
                {isColVisible("title") && (
                  <TableHead className="font-semibold">
                    {ar ? "المسمى الوظيفي" : "Job Title"}
                  </TableHead>
                )}
                {isColVisible("level") && (
                  <TableHead className="font-semibold">
                    {ar ? "الدرجة" : "Level"}
                  </TableHead>
                )}
                {isColVisible("address") && (
                  <TableHead className="font-semibold">
                    {ar ? "العنوان" : "Address"}
                  </TableHead>
                )}
                {isColVisible("hiredate") && (
                  <TableHead className="font-semibold">
                    {ar ? "تاريخ التعيين" : "Hire Date"}
                  </TableHead>
                )}
                {isColVisible("status") && (
                  <TableHead className="font-semibold">
                    {ar ? "الحالة" : "Status"}
                  </TableHead>
                )}
                {isColVisible("actions") && (
                  <TableHead className="font-semibold text-center">
                    {ar ? "إجراءات" : "Actions"}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPageEmps.map((emp) => {
                const isSelected = selectedRows.has(emp.id);
                return (
                  <TableRow
                    key={emp.id}
                    className={
                      isSelected ? "bg-primary/5" : "hover:bg-muted/20"
                    }
                  >
                    <TableCell className="px-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleEmpRow(emp.id)}
                      />
                    </TableCell>
                    {isColVisible("photo") && (
                      <TableCell className="pr-0">
                        <EmployeeAvatar
                          firstName={emp.firstName}
                          lastName={emp.lastName}
                          photoUrl={(emp as any).photoUrl}
                        />
                      </TableCell>
                    )}
                    {isColVisible("code") && (
                      <TableCell className="font-mono text-sm font-medium text-primary">
                        {emp.employeeId}
                      </TableCell>
                    )}
                    {isColVisible("firstName") && (
                      <TableCell className="font-medium">
                        {emp.firstName}
                      </TableCell>
                    )}
                    {isColVisible("lastName") && (
                      <TableCell className="font-medium">
                        {emp.lastName}
                      </TableCell>
                    )}
                    {isColVisible("nid") && (
                      <TableCell className="font-mono text-sm">
                        {emp.nationalId}
                      </TableCell>
                    )}
                    {isColVisible("phone") && (
                      <TableCell className="text-sm">
                        {emp.phone || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {isColVisible("nationality") && (
                      <TableCell className="text-sm">
                        {emp.nationality || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {isColVisible("gender") && (
                      <TableCell className="text-sm">
                        {emp.gender === "M" ? (
                          "ذكر"
                        ) : emp.gender === "F" ? (
                          "أنثى"
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {isColVisible("dept") && (
                      <TableCell>
                        {emp.department ? (
                          <Badge variant="outline" className="font-normal">
                            {emp.department}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {isColVisible("title") && (
                      <TableCell className="text-sm">
                        {emp.jobTitle || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {isColVisible("level") && (
                      <TableCell className="text-sm">
                        {emp.level || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {isColVisible("address") && (
                      <TableCell className="text-sm">
                        {emp.address || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {isColVisible("hiredate") && (
                      <TableCell className="text-sm whitespace-nowrap">
                        {emp.hireDate
                          ? new Date(emp.hireDate).toLocaleDateString()
                          : "—"}
                      </TableCell>
                    )}
                    {isColVisible("status") && (
                      <TableCell>
                        <StatusBadge status={emp.status} />
                      </TableCell>
                    )}
                    {isColVisible("actions") && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              {ar ? "إجراءات" : "Actions"}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <PermissionGate module="employees" action="edit">
                              <DropdownMenuItem
                                onClick={() => setEditingEmployee(emp)}
                              >
                                <Pencil className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                {ar ? "تعديل" : "Edit"}
                              </DropdownMenuItem>
                            </PermissionGate>
                            <DropdownMenuItem
                              onClick={() =>
                                (window.location.href = `/employees/${emp.id}`)
                              }
                            >
                              <Eye className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                              {ar ? "عرض التفاصيل" : "View Details"}
                            </DropdownMenuItem>
                            <PermissionGate module="employees" action="edit">
                              <DropdownMenuItem
                                onClick={() => handleResetPassword(emp)}
                              >
                                <Key className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                {ar
                                  ? "إعادة تعيين كلمة المرور"
                                  : "Reset Password"}
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate module="employees" action="delete">
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(emp.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                {ar ? "حذف" : "Delete"}
                              </DropdownMenuItem>
                            </PermissionGate>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filtered.length > 0 && (
            <DataPagination
              total={filtered.length}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}

      {/* Add Dialog */}
      <EmployeeDialog
        propertyId={activePropertyId!}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSave={handleSave}
        isSaving={createMutation.isPending}
      />

      {/* Excel Import Dialog */}
      <ExcelImportDialog
        propertyId={activePropertyId!}
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleBulkImport}
        isImporting={isImporting}
      />

      {/* Edit Dialog */}
      {editingEmployee && (
        <EditEmployeeDialog
          employee={editingEmployee}
          propertyId={activePropertyId!}
          onClose={() => setEditingEmployee(null)}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "حذف الموظف" : "Delete Employee"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTarget && deleteMutation.mutate({ id: deleteTarget })
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {ar ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
