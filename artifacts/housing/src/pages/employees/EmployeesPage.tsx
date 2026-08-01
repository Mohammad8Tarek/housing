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
import { EmployeeAvatar } from './components/EmployeeAvatar';
import { PhotoUploadBtn } from './components/PhotoUploadBtn';
import { FormRow } from './components/FormRow';
import { StatusBadge } from './components/StatusBadge';
import { EmployeeDialog } from './components/EmployeeDialog';
import { EditEmployeeDialog } from './components/EditEmployeeDialog';
import { ExcelImportDialog } from './components/ExcelImportDialog';
export function EmployeesPage() {
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
