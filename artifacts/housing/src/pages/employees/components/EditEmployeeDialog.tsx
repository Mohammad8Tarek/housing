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
import { EmployeeForm, EMPTY_FORM, EditEmpForm } from "../types";
import { FormRow } from "./FormRow";
import { EmployeeAvatar } from "./EmployeeAvatar";
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
export function EditEmployeeDialog({
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
    thirdName: employee.thirdName ?? "",
    fourthName: employee.fourthName ?? "",
    phone: employee.phone ?? "",
    address: employee.address ?? "",
    nationalId: employee.nationalId ?? "",
    nationality: employee.nationality ?? "",
    gender: employee.gender ?? "M",
    dateOfBirth: employee.dateOfBirth ?? "",
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
                <FormRow label={ar ? "تاريخ الميلاد" : "Date of Birth"}>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => set("dateOfBirth", e.target.value)}
                  />
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
