//@ts-nocheck
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
import { EmployeeForm, EMPTY_FORM } from "../types";
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
export function EmployeeDialog({
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
