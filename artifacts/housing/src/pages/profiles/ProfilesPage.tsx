// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProfiles,
  useCreateProfile,
  useDeleteProfile,
  useUpdateProfile,
  getListProfilesQueryKey,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { formatDate, getExportFileName } from "@/lib/date-utils";
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
  LayoutGrid,
  List,
  MoreVertical,
  ChevronDown,
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

const MAX_PROFILE_IMPORT_FILE_SIZE = 1024 * 1024;
const PROFILE_IMPORT_EXTENSIONS = [".xlsx", ".xls"];

/* ── Profile Photo Avatar ──────────────────────────────────────────────── */
import { ProfileAvatar } from "./components/ProfileAvatar";
import { PhotoUploadBtn } from "./components/PhotoUploadBtn";
import { FormRow } from "./components/FormRow";
import { StatusBadge } from "./components/StatusBadge";
import { ProfileDialog } from "./components/ProfileDialog";
import { EditProfileDialog } from "./components/EditProfileDialog";
import { ExcelImportDialog } from "./components/ExcelImportDialog";
import { ProfileGrid } from "./components/ProfileGrid";
export function ProfilesPage() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const ar = language === "ar";

  const [isOpen, setIsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
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
  const [view, setView] = useState<"table" | "grid">("table");

  // Reset to page 1 when search or status changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus, filterDept]);
  const [resettingPasswordId, setResettingPasswordId] = useState<number | null>(
    null,
  );

  const debouncedSearch = useDebounce(search, 300);

  const queryParams = {
    propertyId: activePropertyId ?? undefined,
    page: currentPage,
    limit: pageSize,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(filterStatus !== "ALL" ? { status: filterStatus } : {}),
    ...(filterDept !== "ALL" ? { department: filterDept } : {}),
  };

  const { data: _eData, isLoading } = useListProfiles(
    queryParams as any,
    {
      query: {
        queryKey: getListProfilesQueryKey(queryParams as any),
        enabled: !!activePropertyId,
      },
    },
  );
  const profiles = _eData?.data || [];
  const totalRecords = _eData?.pagination?.total || 0;

  const { data: departments = [] } = useLookupValues(
    activePropertyId,
    LOOKUP_CATEGORIES.DEPARTMENT,
  );

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListProfilesQueryKey({ propertyId: activePropertyId }),
    });
    queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
  };

  const createMutation = useCreateProfile({ mutation: {} });

  const deleteMutation = useDeleteProfile({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم الحذف" : "Deleted");
        setDeleteTarget(null);
      },
    },
  });

  const handleSave = async (formData: ProfileForm, photo?: string) => {
    try {
      const created = await createMutation.mutateAsync({
        data: { ...formData, propertyId: activePropertyId! } as any,
      });
      if (photo && created?.id) {
        await fetch(`/api/profiles/${created.id}/photo`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoUrl: photo }),
        });
      }
      invalidate();
      toast.success(ar ? "تمت إضافة الملف الشخصي" : "Profile added");
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Error");
    }
  };

  const handleBulkImport = async (rows: ProfileForm[]) => {
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
        ? `تم استيراد ${success} ملف شخصي بنجاح${failed > 0 ? ` (فشل ${failed})` : ""}`
        : `Imported ${success} profiles${failed > 0 ? ` (${failed} failed)` : ""}`,
    );
  };

  const handleResetPassword = async (profile: any) => {
    setResettingPasswordId(profile.id);
    try {
      const res = await fetch("/api/portal-auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profile.profileId,
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

  const EMP_COLS = [
    { key: "photo", label: "Photo", labelAr: "صورة", defaultVisible: true },
    { key: "code", label: "Code", labelAr: "الكود", defaultVisible: true },
    { key: "firstName", label: "First Name", labelAr: "الاسم الأول", defaultVisible: true },
    { key: "secondName", label: "Second Name", labelAr: "الاسم الثاني", defaultVisible: true },
    { key: "thirdName", label: "Third Name", labelAr: "الاسم الثالث", defaultVisible: true },
    { key: "fourthName", label: "Fourth Name", labelAr: "الاسم الرابع", defaultVisible: true },
    { key: "nid", label: "National ID", labelAr: "رقم الهوية", defaultVisible: true },
    { key: "phone", label: "Phone", labelAr: "الهاتف", defaultVisible: true },
    { key: "nationality", label: "Nationality", labelAr: "الجنسية", defaultVisible: true },
    { key: "gender", label: "Gender", labelAr: "الجنس", defaultVisible: true },
    { key: "dept", label: "Department", labelAr: "القسم", defaultVisible: true },
    { key: "title", label: "Job Title", labelAr: "المسمى الوظيفي", defaultVisible: true },
    { key: "level", label: "Level", labelAr: "الدرجة", defaultVisible: true },
    { key: "employmentType", label: "Employment Type", labelAr: "نوع التوظيف", defaultVisible: true },
    { key: "companyName", label: "Works For / Company", labelAr: "يعمل لدى / الشركة", defaultVisible: true },
    { key: "dateOfBirth", label: "Date of Birth", labelAr: "تاريخ الميلاد", defaultVisible: false },
    { key: "address", label: "Address", labelAr: "العنوان", defaultVisible: false },
    { key: "hiredate", label: "Hire Date", labelAr: "تاريخ التعيين", defaultVisible: true },
    { key: "contractEndDate", label: "Contract End", labelAr: "انتهاء العقد", defaultVisible: true },
    { key: "status", label: "Status", labelAr: "الحالة", defaultVisible: true },
    { key: "actions", label: "Actions", labelAr: "إجراءات", defaultVisible: true, fixed: true },
  ];
  const {
    visible: colVisible,
    toggle: colToggle,
    showAll: colShowAll,
    hideAll: colHideAll,
    isVisible: isColVisible,
  } = useColumnVisibility(EMP_COLS);

  const currentPageEmps = profiles;
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
        ? profiles.filter((e) => selectedRows.has(e.id))
        : profiles;
    const rows = target.map((e) => ({
      Code: e.profileId,
      "First Name": e.firstName || "",
      "Second Name": e.lastName || "",
      "Third Name": e.thirdName || "",
      "Fourth Name": e.fourthName || "",
      "National ID": e.nationalId ?? "",
      Phone: e.phone ?? "",
      Nationality: e.nationality ?? "",
      Gender: e.gender === "M" ? "Male" : e.gender === "F" ? "Female" : "",
      Department: e.department ?? "",
      "Job Title": e.jobTitle ?? "",
      Level: e.level ?? "",
      "Date of Birth": formatDate(e.dateOfBirth, ""),
      Address: e.address ?? "",
      "Hire Date": formatDate(e.hireDate, ""),
      "Contract End Date": formatDate(e.contractEndDate, ""),
      Status: e.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Profiles");
    XLSX.writeFile(wb, getExportFileName("Profiles", "xlsx"));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {ar ? "بروفايل" : "Profiles"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {ar
              ? `إجمالي ${totalRecords} ملف شخصي`
              : `${totalRecords} total profiles`}
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
          <div className="flex bg-muted p-1 rounded-md">
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2"
              onClick={() => setView("table")}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2"
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
            {ar ? "استيراد Excel" : "Import Excel"}
          </Button>
          <PermissionGate module="profiles" action="create">
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {ar ? "نيو بروفايل" : "New Profile"}
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
                <SelectItem value="ACTIVE">{ar ? "مقيم بالسكن" : "In-House"}</SelectItem>
                <SelectItem value="LEFT">{ar ? "تمت المغادرة" : "Checked Out"}</SelectItem>
                <SelectItem value="VACATION">{ar ? "في إجازة" : "On Vacation"}</SelectItem>
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
        extraActions={
          <PermissionGate module="profiles" action="delete">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (window.confirm(ar ? `هل أنت متأكد من حذف ${selectedRows.size} ملف شخصي محدد؟` : `Are you sure you want to delete ${selectedRows.size} selected profiles?`)) {
                  selectedRows.forEach((id) => deleteMutation.mutate({ id }));
                  setSelectedRows(new Set());
                }
              }}
              className="gap-1.5 h-8 text-xs font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {ar ? "حذف المحدد" : "Delete Selected"}
            </Button>
          </PermissionGate>
        }
      />

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-md bg-card">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {ar ? "لا توجد ملفات شخصية" : "No profiles found"}
          </p>
          <p className="text-sm mt-1">
            {search || filterDept !== "ALL" || filterStatus !== "ALL"
              ? ar
                ? "جرب تغيير معايير البحث"
                : "Try changing your search"
              : ar
                ? "إضافة ملف شخصي أو استيراد من إكسل"
                : "Add a profile or import from Excel"}
          </p>
        </div>
      ) : (
        view === "grid" ? (
          <>
            <ProfileGrid
              profiles={currentPageEmps}
              ar={ar}
              onEdit={setEditingProfile}
              onResetPassword={handleResetPassword}
              onDelete={setDeleteTarget}
            />
            {totalRecords > 0 && (
              <DataPagination
                total={totalRecords}
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        ) : (
          <div className="border rounded-md overflow-x-auto bg-card relative scrollbar-thin max-w-full">
            <Table className="min-w-max w-full">
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="w-10 px-3 sticky rtl:right-0 ltr:left-0 z-20 bg-muted">
                    <Checkbox
                      checked={allEmpPageSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  {isColVisible("photo") && (
                    <TableHead className="font-semibold w-12 sticky rtl:right-10 ltr:left-10 z-20 bg-muted">
                      {ar ? "صورة" : "Photo"}
                    </TableHead>
                  )}
                  {isColVisible("code") && (
                    <TableHead className="font-semibold sticky rtl:right-[88px] ltr:left-[88px] z-20 bg-muted border-e border-border shadow-[3px_0_6px_-2px_rgba(0,0,0,0.06)] rtl:shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.06)]">
                      {ar ? "الكود" : "Code"}
                    </TableHead>
                  )}
                  {isColVisible("firstName") && (
                    <TableHead className="font-semibold">{ar ? "الاسم الأول" : "First Name"}</TableHead>
                  )}
                  {isColVisible("secondName") && (
                    <TableHead className="font-semibold">{ar ? "الاسم الثاني" : "Second Name"}</TableHead>
                  )}
                  {isColVisible("thirdName") && (
                    <TableHead className="font-semibold">{ar ? "الاسم الثالث" : "Third Name"}</TableHead>
                  )}
                  {isColVisible("fourthName") && (
                    <TableHead className="font-semibold">{ar ? "الاسم الرابع" : "Fourth Name"}</TableHead>
                  )}
                  {isColVisible("nid") && (
                    <TableHead className="font-semibold">{ar ? "رقم الهوية" : "National ID"}</TableHead>
                  )}
                  {isColVisible("phone") && (
                    <TableHead className="font-semibold">{ar ? "الهاتف" : "Phone"}</TableHead>
                  )}
                  {isColVisible("nationality") && (
                    <TableHead className="font-semibold">{ar ? "الجنسية" : "Nationality"}</TableHead>
                  )}
                  {isColVisible("gender") && (
                    <TableHead className="font-semibold">{ar ? "الجنس" : "Gender"}</TableHead>
                  )}
                  {isColVisible("dept") && (
                    <TableHead className="font-semibold">{ar ? "القسم" : "Department"}</TableHead>
                  )}
                  {isColVisible("title") && (
                    <TableHead className="font-semibold">{ar ? "المسمى الوظيفي" : "Job Title"}</TableHead>
                  )}
                  {isColVisible("level") && (
                    <TableHead className="font-semibold">{ar ? "الدرجة" : "Level"}</TableHead>
                  )}
                  {isColVisible("employmentType") && (
                    <TableHead className="font-semibold whitespace-nowrap">{ar ? "نوع التوظيف" : "Employment Type"}</TableHead>
                  )}
                  {isColVisible("companyName") && (
                    <TableHead className="font-semibold whitespace-nowrap">{ar ? "يعمل لدى / الشركة" : "Works For / Company"}</TableHead>
                  )}
                  {isColVisible("dateOfBirth") && (
                    <TableHead className="font-semibold">{ar ? "تاريخ الميلاد" : "Date of Birth"}</TableHead>
                  )}
                  {isColVisible("address") && (
                    <TableHead className="font-semibold">{ar ? "العنوان" : "Address"}</TableHead>
                  )}
                  {isColVisible("hiredate") && (
                    <TableHead className="font-semibold">{ar ? "تاريخ التعيين" : "Hire Date"}</TableHead>
                  )}
                  {isColVisible("contractEndDate") && (
                    <TableHead className="font-semibold whitespace-nowrap">{ar ? "انتهاء العقد" : "Contract End"}</TableHead>
                  )}
                  {isColVisible("status") && (
                    <TableHead className="font-semibold">{ar ? "الحالة" : "Status"}</TableHead>
                  )}
                  {isColVisible("actions") && (
                    <TableHead className="w-28 min-w-[110px] font-semibold text-center sticky rtl:left-0 ltr:right-0 z-20 bg-muted border-s border-border shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.06)] rtl:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.06)]">
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
                      className={`group ${isSelected ? "bg-primary/5" : "hover:bg-muted/20"}`}
                    >
                      <TableCell className="px-3 sticky rtl:right-0 ltr:left-0 z-10 bg-card group-hover:bg-accent">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleEmpRow(emp.id)}
                        />
                      </TableCell>
                      {isColVisible("photo") && (
                        <TableCell className="pr-0 sticky rtl:right-10 ltr:left-10 z-10 bg-card group-hover:bg-accent">
                          <ProfileAvatar
                            firstName={emp.firstName}
                            lastName={emp.lastName}
                            photoUrl={(emp as any).photoUrl}
                          />
                        </TableCell>
                      )}
                      {isColVisible("code") && (
                        <TableCell className="font-mono text-sm font-medium text-primary sticky rtl:right-[88px] ltr:left-[88px] z-10 bg-card group-hover:bg-accent border-e border-border shadow-[3px_0_6px_-2px_rgba(0,0,0,0.06)] rtl:shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.06)]">
                          {emp.profileId}
                        </TableCell>
                      )}
                      {isColVisible("firstName") && (
                        <TableCell className="font-medium whitespace-nowrap">{emp.firstName || "—"}</TableCell>
                      )}
                      {isColVisible("secondName") && (
                        <TableCell className="font-medium whitespace-nowrap">{emp.lastName || "—"}</TableCell>
                      )}
                      {isColVisible("thirdName") && (
                        <TableCell className="font-medium whitespace-nowrap">{emp.thirdName || "—"}</TableCell>
                      )}
                      {isColVisible("fourthName") && (
                        <TableCell className="font-medium whitespace-nowrap">{emp.fourthName || "—"}</TableCell>
                      )}
                      {isColVisible("nid") && (
                        <TableCell className="font-mono text-sm whitespace-nowrap">{emp.nationalId}</TableCell>
                      )}
                      {isColVisible("phone") && (
                        <TableCell className="text-sm whitespace-nowrap" dir="ltr">{emp.phone || "—"}</TableCell>
                      )}
                      {isColVisible("nationality") && (
                        <TableCell className="text-sm whitespace-nowrap">{emp.nationality || "—"}</TableCell>
                      )}
                      {isColVisible("gender") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {emp.gender === "M" ? (ar ? "ذكر" : "Male") : emp.gender === "F" ? (ar ? "أنثى" : "Female") : "—"}
                        </TableCell>
                      )}
                      {isColVisible("dept") && (
                        <TableCell className="whitespace-nowrap">
                          {emp.employmentType === "THIRD_PARTY" ? (
                            <span className="text-muted-foreground/60 italic text-xs">—</span>
                          ) : emp.department ? (
                            <Badge variant="outline" className="font-normal">{emp.department}</Badge>
                          ) : "—"}
                        </TableCell>
                      )}
                      {isColVisible("title") && (
                        <TableCell className="text-sm whitespace-nowrap">{emp.jobTitle || "—"}</TableCell>
                      )}
                      {isColVisible("level") && (
                        <TableCell className="text-xs whitespace-nowrap">
                          {emp.employmentType === "THIRD_PARTY" ? (
                            <span className="text-muted-foreground/60 italic text-xs">—</span>
                          ) : emp.level ? (
                            <Badge
                              variant="outline"
                              className="bg-primary/10 text-primary border-primary/25 font-bold px-2 py-0.5"
                            >
                              {emp.level}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/60 italic text-xs">—</span>
                          )}
                        </TableCell>
                      )}
                      {isColVisible("employmentType") && (
                        <TableCell className="text-xs whitespace-nowrap">
                          {emp.employmentType === "THIRD_PARTY" ? (
                            <Badge
                              variant="secondary"
                              className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 font-semibold"
                            >
                              {ar ? "طرف ثالث" : "Third Party"}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 font-semibold"
                            >
                              {ar ? "داخلي" : "Internal"}
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      {isColVisible("companyName") && (
                        <TableCell
                          className="text-xs whitespace-nowrap max-w-[160px] truncate"
                          title={emp.companyName || ""}
                        >
                          {emp.companyName ? (
                            <span className="font-medium text-foreground">{emp.companyName}</span>
                          ) : (
                            <span className="text-muted-foreground/60 italic text-xs">
                              {emp.employmentType === "INTERNAL" ? (ar ? "الفندق" : "Hotel") : "—"}
                            </span>
                          )}
                        </TableCell>
                      )}
                      {isColVisible("dateOfBirth") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDate(emp.dateOfBirth)}
                        </TableCell>
                      )}
                      {isColVisible("address") && (
                        <TableCell className="text-sm whitespace-nowrap max-w-[200px] truncate" title={emp.address}>{emp.address || "—"}</TableCell>
                      )}
                      {isColVisible("hiredate") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {emp.employmentType === "THIRD_PARTY" ? (
                            <span className="text-muted-foreground/60 italic text-xs">—</span>
                          ) : (
                            formatDate(emp.hireDate)
                          )}
                        </TableCell>
                      )}
                      {isColVisible("contractEndDate") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {emp.employmentType !== "THIRD_PARTY" && emp.contractEndDate ? (
                            <span className="font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 text-xs">
                              {formatDate(emp.contractEndDate)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      {isColVisible("status") && (
                        <TableCell className="whitespace-nowrap">
                          <StatusBadge status={emp.status} />
                        </TableCell>
                      )}
                      {isColVisible("actions") && (
                        <TableCell className="w-28 min-w-[110px] text-center sticky rtl:left-0 ltr:right-0 z-10 bg-card group-hover:bg-accent border-s border-border shadow-[-3px_0_6px_-2px_rgba(0,0,0,0.06)] rtl:shadow-[3px_0_6px_-2px_rgba(0,0,0,0.06)]">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2.5 text-xs gap-1.5 font-medium bg-background hover:bg-muted shadow-xs transition-colors"
                              >
                                {ar ? "إجراءات" : "Actions"}
                                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 shadow-lg">
                              <DropdownMenuItem asChild>
                                <Link href={`/profiles/${emp.id}`} className="cursor-pointer">
                                  <Eye className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-blue-500" />
                                  {ar ? "عرض التفاصيل" : "View Details"}
                                </Link>
                              </DropdownMenuItem>
                              <PermissionGate module="profiles" action="edit">
                                <DropdownMenuItem onClick={() => setEditingProfile(emp)} className="cursor-pointer">
                                  <Pencil className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-amber-500" />
                                  {ar ? "تعديل" : "Edit"}
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate module="profiles" action="edit">
                                <DropdownMenuItem onClick={() => handleResetPassword(emp)} className="cursor-pointer">
                                  <Key className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-indigo-500" />
                                  {ar ? "إعادة تعيين كلمة المرور" : "Reset Password"}
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate module="profiles" action="delete">
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget(emp.id)}
                                  className="text-destructive font-medium cursor-pointer focus:text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-destructive" />
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
            {totalRecords > 0 && (
              <DataPagination
                total={totalRecords}
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
        )
      )}

      {/* Add Dialog */}
      <ProfileDialog
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
      {editingProfile && (
        <EditProfileDialog
          profile={editingProfile}
          propertyId={activePropertyId!}
          onClose={() => setEditingProfile(null)}
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
              {ar ? "حذف الملف الشخصي" : "Delete Profile"}
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
