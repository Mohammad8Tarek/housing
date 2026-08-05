// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListReservations,
  useCreateReservation,
  useDeleteReservation,
  useCheckinReservation,
  useListRooms,
  useListEmployees,
  getListReservationsQueryKey,
  getListRoomsQueryKey,
  useListProperties,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trash,
  Plus,
  CheckCircle,
  CalendarDays,
  Search,
  BedDouble,
  User,
  Building2,
  Pencil,
  X,
} from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import { useAuth } from "@/context/AuthContext";
import { useUpdateReservation } from "@workspace/api-client-react";
import {
  ColumnChooser,
  useColumnVisibility,
} from "@/components/ui/column-chooser";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import { DataPagination } from "@/components/DataPagination";
import * as XLSX from "xlsx";

export default function Reservations() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();

  const queryClient = useQueryClient();
  const LIMIT = 25;
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [page, setPage] = useState(1);
  const { isSystemAdmin } = useAuth();
  const ar = language === "ar";

  const [isOpen, setIsOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    reservation: any | null;
  }>({ open: false, reservation: null });
  const [editForm, setEditForm] = useState({
    checkInDate: "",
    checkOutDate: "",
    notes: "",
    firstName: "",
    lastName: "",
    department: "",
    jobTitle: "",
    nationality: "",
    gender: "",
    employeeCode: "",
    level: "",
    guestIdCardNumber: "",
    guestPhone: "",
    roomType: "",
  });
  const [checkinDialog, setCheckinDialog] = useState<{
    open: boolean;
    id: number | null;
    guestName?: string;
  }>({ open: false, id: null });
  const [checkoutDialog, setCheckoutDialog] = useState<{
    open: boolean;
    id: number | null;
    guestName?: string;
  }>({ open: false, id: null });
  const [checkinRoomId, setCheckinRoomId] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const [empSearch, setEmpSearch] = useState("");
  const [showEmpSuggestions, setShowEmpSuggestions] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    roomType: "",
    checkInDate: "",
    checkOutDate: "",
    notes: "",
    guestIdCardNumber: "",
    guestPhone: "",
    jobTitle: "",
    department: "",
    nationality: "",
    gender: "",
    employeeCode: "",
    level: "",
  });

  const {
    data: _resWrapper,
    isLoading,
    isFetching,
  } = useListReservations(
    { propertyId: activePropertyId ?? undefined, page, limit: LIMIT },
    {
      query: {
        queryKey: getListReservationsQueryKey({
          propertyId: activePropertyId ?? undefined,
          page,
          limit: LIMIT,
        }),
        enabled: !!activePropertyId,
        staleTime: 0,
        placeholderData: (prev: any) => prev,
      },
    },
  );
  const reservations = _resWrapper?.data || _resWrapper || [];

  const { data: _rData } = useListRooms(
    { propertyId: activePropertyId },
    { query: { enabled: !!activePropertyId } },
  );
  const rooms = _rData?.data || [];
  const { data: _eDataWrapper } = useListEmployees(
    { propertyId: activePropertyId ?? undefined, limit: 1000 },
    { query: { enabled: !!activePropertyId } },
  );
  const employees = _eDataWrapper?.employees || _eDataWrapper?.data || [];
  const { data: properties = [] } = useListProperties({
    query: { enabled: true },
  });
  const { data: roomTypeValues = [] } = useLookupValues(
    activePropertyId,
    LOOKUP_CATEGORIES.ROOM_TYPE,
  );
  const { data: departmentValues = [] } = useLookupValues(
    activePropertyId,
    LOOKUP_CATEGORIES.DEPARTMENT,
  );
  const { data: jobTitleValues = [] } = useLookupValues(
    activePropertyId,
    LOOKUP_CATEGORIES.JOB_TITLE,
  );
  const { data: nationalityValues = [] } = useLookupValues(
    activePropertyId,
    LOOKUP_CATEGORIES.NATIONALITY,
  );

  const activeProperty = properties.find((p: any) => p.id === activePropertyId);

  // ✅ فلتر الـ Job Titles بناءً على القسم المختار
  const filteredJobTitles = useMemo(() => {
    if (!form.department || form.department === "none") return jobTitleValues;
    return jobTitleValues.filter(
      (t: any) => !t.parentValue || t.parentValue === form.department,
    );
  }, [jobTitleValues, form.department]);

  // ✅ فلتر الـ Job Titles في Edit dialog
  const filteredEditJobTitles = useMemo(() => {
    if (!editForm.department || editForm.department === "none")
      return jobTitleValues;
    return jobTitleValues.filter(
      (t: any) => !t.parentValue || t.parentValue === editForm.department,
    );
  }, [jobTitleValues, editForm.department]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListReservationsQueryKey({ propertyId: activePropertyId }),
    });
    queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
    // Rooms change occupancy after check-in/checkout
    queryClient.invalidateQueries({
      queryKey: getListRoomsQueryKey({ propertyId: activePropertyId }),
    });
    queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
  };

  const createMutation = useCreateReservation({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم إنشاء الحجز" : "Reservation created");
        setIsOpen(false);
        resetForm();
      },
      onError: (e: any) => toast.error(e.message || (ar ? "خطأ" : "Error")),
    },
  });

  const deleteMutation = useDeleteReservation({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم الحذف" : "Reservation deleted");
        setDeleteId(null);
      },
    },
  });

  const checkinMutation = useCheckinReservation({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم تسجيل الدخول" : "Checked in successfully");
        setCheckinDialog({ open: false, id: null });
        setCheckinRoomId("");
        setRoomSearch("");
      },
      onError: (e: any) => toast.error(e.message || (ar ? "خطأ" : "Error")),
    },
  });

  const updateMutation = useUpdateReservation({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم تحديث الحجز" : "Reservation updated");
        setEditDialog({ open: false, reservation: null });
      },
      onError: (e: any) => toast.error(e.message || (ar ? "خطأ" : "Error")),
    },
  });

  const checkoutMutation = {
    isPending: false,
    mutate: async (id: number) => {
      try {
        const resp = await fetch(`/api/reservations/${id}/checkout`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkOutDate: new Date().toISOString() }),
          credentials: "include",
        });
        if (!resp.ok) throw new Error("Checkout failed");
        invalidate();
        toast.success(
          ar ? "تم تسجيل المغادرة بنجاح" : "Checked out successfully",
        );
        setCheckoutDialog({ open: false, id: null });
      } catch (e: any) {
        toast.error(e.message || (ar ? "خطأ" : "Error"));
      }
    },
  };

  const openEdit = (res: any) => {
    setEditForm({
      checkInDate: res.checkInDate ? res.checkInDate.split("T")[0] : "",
      checkOutDate: res.checkOutDate ? res.checkOutDate.split("T")[0] : "",
      notes: res.notes || "",
      firstName: res.firstName || "",
      lastName: res.lastName || "",
      department: res.department || "",
      jobTitle: res.jobTitle || "",
      nationality: res.nationality || "",
      gender: res.gender || "",
      employeeCode: res.employeeCode || "",
      level: res.level || "",
      guestIdCardNumber: res.guestIdCardNumber || "",
      guestPhone: res.guestPhone || "",
      roomType: res.roomType || "",
    });
    setEditDialog({ open: true, reservation: res });
  };

  const handleUpdate = () => {
    if (!editDialog.reservation) return;
    updateMutation.mutate({
      id: editDialog.reservation.id,
      data: {
        checkInDate: editForm.checkInDate
          ? new Date(editForm.checkInDate).toISOString()
          : undefined,
        checkOutDate: editForm.checkOutDate
          ? new Date(editForm.checkOutDate).toISOString()
          : undefined,
        notes: editForm.notes,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        department: editForm.department,
        jobTitle: editForm.jobTitle,
        nationality: editForm.nationality,
        gender: editForm.gender,
        employeeCode: editForm.employeeCode,
        level: editForm.level,
        guestIdCardNumber: editForm.guestIdCardNumber,
        guestPhone: editForm.guestPhone,
        roomType: editForm.roomType,
      } as any,
    });
  };

  const resetForm = () => {
    setForm({
      firstName: "",
      lastName: "",
      roomType: "",
      checkInDate: "",
      checkOutDate: "",
      notes: "",
      guestIdCardNumber: "",
      guestPhone: "",
      jobTitle: "",
      department: "",
      nationality: "",
      gender: "",
      employeeCode: "",
      level: "",
    });
    setEmpSearch("");
    setShowEmpSuggestions(false);
  };

  const empSuggestions = useMemo(() => {
    if (!empSearch.trim() || empSearch.length < 2) return [];
    const q = empSearch.toLowerCase();
    return employees
      .filter(
        (e: any) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.employeeId?.toLowerCase().includes(q) ||
          e.nationalId?.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [empSearch, employees]);

  const applyEmployee = (emp: any) => {
    setForm((f) => ({
      ...f,
      firstName: emp.firstName || "",
      lastName: emp.lastName || "",
      guestIdCardNumber: emp.nationalId || emp.employeeId || "",
      guestPhone: emp.phone || "",
      department: emp.department || "",
      jobTitle: emp.jobTitle || "",
      nationality: emp.nationality || "",
      gender: emp.gender || "",
      employeeCode: emp.employeeId || "",
      level: emp.level || "",
    }));
    setEmpSearch(`${emp.firstName} ${emp.lastName}`);
    setShowEmpSuggestions(false);
  };

  const onSubmit = () => {
    if (
      !form.firstName ||
      !form.lastName ||
      !form.checkInDate ||
      !form.guestIdCardNumber ||
      !form.guestPhone
    ) {
      toast.error(
        ar
          ? "الرجاء ملء جميع الحقول المطلوبة"
          : "Please fill all required fields",
      );
      return;
    }
    createMutation.mutate({
      data: {
        propertyId: activePropertyId!,
        firstName: form.firstName,
        lastName: form.lastName,
        roomType: form.roomType || undefined,
        checkInDate: new Date(form.checkInDate).toISOString(),
        checkOutDate: form.checkOutDate
          ? new Date(form.checkOutDate).toISOString()
          : undefined,
        notes: form.notes || "",
        guestIdCardNumber: form.guestIdCardNumber,
        guestPhone: form.guestPhone,
        jobTitle: form.jobTitle || "",
        department: form.department || "",
        nationality: form.nationality || "",
        gender: form.gender || "",
        employeeCode: form.employeeCode || "",
        level: form.level || "",
      } as any,
    });
  };

  const handleCheckin = () => {
    if (!checkinDialog.id || !checkinRoomId) {
      toast.error(ar ? "الرجاء اختيار غرفة" : "Please select a room");
      return;
    }
    checkinMutation.mutate({
      id: checkinDialog.id,
      data: {
        roomId: parseInt(checkinRoomId),
        actualCheckInDate: new Date().toISOString(),
      },
    });
  };

  const statusLabel: Record<string, string> = {
    UPCOMING: ar ? "قادم" : "Upcoming",
    CHECKED_IN: ar ? "مقيم" : "Checked In",
    CANCELLED: ar ? "ملغي" : "Cancelled",
    COMPLETED: ar ? "منتهي" : "Completed",
  };

  const statusColor = (s: string) =>
    ({
      UPCOMING:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
      CHECKED_IN:
        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
      CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
      COMPLETED:
        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    })[s] || "bg-gray-100 text-gray-600";

  const checkinRooms = rooms.filter(
    (r) =>
      r.status?.toLowerCase() !== "maintenance" &&
      (r.currentOccupancy ?? 0) < (r.capacity ?? 1),
  );
  const filteredCheckinRooms = checkinRooms.filter((r) => {
    if (!roomSearch.trim()) return true;
    return r.roomNumber?.toLowerCase().includes(roomSearch.toLowerCase());
  });

  const filtered = useMemo(() => {
    const list = reservations || [];
    return list.filter((r) => {
      const matchSearch =
        !search.trim() ||
        `${r.firstName} ${r.lastName}`
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        r.guestIdCardNumber?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [reservations, search, statusFilter]);

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const paged = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const upcomingCount = (reservations || []).filter(
    (r) => r.status === "UPCOMING",
  ).length;

  const pagedResIds = paged.map((r) => r.id);
  const allResPageSelected =
    pagedResIds.length > 0 && pagedResIds.every((id) => selectedRows.has(id));
  const toggleSelectAllRes = () => {
    if (allResPageSelected) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedResIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedResIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };
  const toggleResRow = (id: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const exportResExcel = () => {
    const all: any[] = reservations || [];
    const target =
      selectedRows.size > 0 ? all.filter((r) => selectedRows.has(r.id)) : all;
    const rows = target.map((r) => ({
      Guest: `${r.firstName} ${r.lastName}`,
      "Room Type": r.roomType ?? "",
      "Check-in": r.checkInDate
        ? format(new Date(r.checkInDate), "yyyy-MM-dd")
        : "",
      "Check-out": r.checkOutDate
        ? format(new Date(r.checkOutDate), "yyyy-MM-dd")
        : "",
      Status: r.status,
      Department: r.department ?? "",
      "ID Card": r.guestIdCardNumber ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reservations");
    XLSX.writeFile(
      wb,
      `reservations_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const RES_COLS = [
    {
      key: "guest",
      label: "Guest",
      labelAr: "الاسم",
      defaultVisible: true,
      fixed: true,
    },
    { key: "phone", label: "Phone", labelAr: "الهاتف", defaultVisible: true },
    { key: "id", label: "ID", labelAr: "رقم الهوية", defaultVisible: true },
    {
      key: "roomtype",
      label: "Room Type",
      labelAr: "نوع الغرفة",
      defaultVisible: true,
    },
    {
      key: "checkin",
      label: "Check-in",
      labelAr: "الدخول",
      defaultVisible: true,
    },
    {
      key: "checkout",
      label: "Check-out",
      labelAr: "المغادرة",
      defaultVisible: true,
    },
    { key: "status", label: "Status", labelAr: "الحالة", defaultVisible: true },
    { key: "dept", label: "Dept", labelAr: "القسم", defaultVisible: true },
    {
      key: "actions",
      label: "Actions",
      labelAr: "إجراءات",
      defaultVisible: true,
      fixed: true,
    },
  ];
  const {
    visible: resVisible,
    toggle: resToggle,
    showAll: resShowAll,
    hideAll: resHideAll,
    isVisible: isResVisible,
  } = useColumnVisibility(RES_COLS);

  // ── مكوّن مشترك لقسم Work Info ──
  const WorkInfoSection = ({
    dept,
    jobTitle,
    level,
    onDeptChange,
    onJobTitleChange,
    onLevelChange,
    filteredTitles,
  }: {
    dept: string;
    jobTitle: string;
    level: string;
    onDeptChange: (v: string) => void;
    onJobTitleChange: (v: string) => void;
    onLevelChange: (v: string) => void;
    filteredTitles: any[];
  }) => (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {ar ? "بيانات العمل" : "Work Info"}
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>{ar ? "القسم" : "Department"}</Label>
          <Select
            value={dept || "none"}
            onValueChange={(v) => {
              onDeptChange(v === "none" ? "" : v);
              onJobTitleChange(""); // reset job title when dept changes
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {departmentValues.length > 0
                ? departmentValues.map((d: any) => (
                    <SelectItem key={d.id} value={d.value}>
                      {d.value}
                    </SelectItem>
                  ))
                : [
                    "F&B",
                    "Front Office",
                    "Housekeeping",
                    "Engineering",
                    "Security",
                  ].map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "المسمى الوظيفي" : "Job Title"}</Label>
          <Select
            value={jobTitle || "none"}
            onValueChange={(v) => onJobTitleChange(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {filteredTitles.length > 0 ? (
                filteredTitles.map((t: any) => (
                  <SelectItem key={t.id} value={t.value}>
                    {t.value}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="other">Other</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{ar ? "الدرجة / المستوى" : "Level"}</Label>
          <Input
            value={level}
            onChange={(e) => onLevelChange(e.target.value)}
            placeholder={ar ? "أول، ثاني..." : "Senior..."}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {ar ? "الحجوزات" : "Reservations"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {upcomingCount > 0 ? (
              <span className="text-blue-600 font-medium">
                {upcomingCount} {ar ? "حجز قادم" : "upcoming"}
              </span>
            ) : ar ? (
              "لا حجوزات قادمة"
            ) : (
              "No upcoming reservations"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 w-52"
              placeholder={ar ? "بحث بالاسم..." : "Search by name..."}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {ar ? "جميع الحالات" : "All Statuses"}
              </SelectItem>
              <SelectItem value="UPCOMING">
                {ar ? "قادم" : "Upcoming"}
              </SelectItem>
              <SelectItem value="CHECKED_IN">
                {ar ? "مقيم" : "Checked In"}
              </SelectItem>
              <SelectItem value="COMPLETED">
                {ar ? "منتهي" : "Completed"}
              </SelectItem>
              <SelectItem value="CANCELLED">
                {ar ? "ملغي" : "Cancelled"}
              </SelectItem>
            </SelectContent>
          </Select>
          <ColumnChooser
            cols={RES_COLS}
            visible={resVisible}
            onToggle={resToggle}
            onShowAll={resShowAll}
            onHideAll={resHideAll}
            ar={ar}
          />
          <PermissionGate module="reservations" action="create">
            <Button
              onClick={() => {
                resetForm();
                setIsOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              {ar ? "حجز جديد" : "New Reservation"}
            </Button>
          </PermissionGate>
        </div>
      </div>

      <BulkActionBar
        count={selectedRows.size}
        onClear={() => setSelectedRows(new Set())}
        onExportExcel={exportResExcel}
        ar={ar}
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="border rounded-lg bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-10 px-3">
                  <Checkbox
                    checked={allResPageSelected}
                    onCheckedChange={toggleSelectAllRes}
                  />
                </TableHead>
                {isResVisible("guest") && (
                  <TableHead className="font-semibold">
                    {ar ? "الاسم" : "Guest"}
                  </TableHead>
                )}
                {isResVisible("phone") && (
                  <TableHead className="font-semibold">
                    {ar ? "الهاتف" : "Phone"}
                  </TableHead>
                )}
                {isResVisible("id") && (
                  <TableHead className="font-semibold">
                    {ar ? "رقم الهوية" : "ID"}
                  </TableHead>
                )}
                {isResVisible("roomtype") && (
                  <TableHead className="font-semibold">
                    {ar ? "نوع الغرفة" : "Room Type"}
                  </TableHead>
                )}
                {isResVisible("checkin") && (
                  <TableHead className="font-semibold">
                    {ar ? "الدخول" : "Check-in"}
                  </TableHead>
                )}
                {isResVisible("checkout") && (
                  <TableHead className="font-semibold">
                    {ar ? "المغادرة" : "Check-out"}
                  </TableHead>
                )}
                {isResVisible("status") && (
                  <TableHead className="font-semibold">
                    {ar ? "الحالة" : "Status"}
                  </TableHead>
                )}
                {isResVisible("dept") && (
                  <TableHead className="font-semibold">
                    {ar ? "القسم" : "Dept"}
                  </TableHead>
                )}
                {isResVisible("actions") && (
                  <TableHead className="font-semibold">
                    {ar ? "إجراءات" : "Actions"}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((res) => {
                const isSelected = selectedRows.has(res.id);
                return (
                  <TableRow
                    key={res.id}
                    className={
                      isSelected ? "bg-primary/5" : "hover:bg-muted/20"
                    }
                  >
                    <TableCell className="px-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleResRow(res.id)}
                      />
                    </TableCell>
                    {isResVisible("guest") && (
                      <TableCell>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <p className="font-semibold text-sm">
                            {res.firstName} {res.lastName}
                          </p>
                        </div>
                      </TableCell>
                    )}
                    {isResVisible("phone") && (
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {res.guestPhone || "—"}
                      </TableCell>
                    )}
                    {isResVisible("id") && (
                      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {res.guestIdCardNumber || "—"}
                      </TableCell>
                    )}
                    {isResVisible("roomtype") && (
                      <TableCell className="text-sm whitespace-nowrap">
                        {res.roomType || "—"}
                      </TableCell>
                    )}
                    {isResVisible("checkin") && (
                      <TableCell className="text-sm whitespace-nowrap">
                        {res.checkInDate
                          ? format(new Date(res.checkInDate), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                    )}
                    {isResVisible("checkout") && (
                      <TableCell className="text-sm whitespace-nowrap">
                        {res.checkOutDate
                          ? format(new Date(res.checkOutDate), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                    )}
                    {isResVisible("status") && (
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(res.status)}`}
                        >
                          {statusLabel[res.status] || res.status}
                        </span>
                      </TableCell>
                    )}
                    {isResVisible("dept") && (
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {res.department || "—"}
                      </TableCell>
                    )}
                    {isResVisible("actions") && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {res.status === "UPCOMING" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setCheckinRoomId("");
                                setRoomSearch("");
                                setCheckinDialog({
                                  open: true,
                                  id: res.id,
                                  guestName: `${res.firstName} ${res.lastName}`,
                                });
                              }}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {ar ? "دخول" : "Check-in"}
                            </Button>
                          )}
                          {res.status === "CHECKED_IN" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                              onClick={() =>
                                setCheckoutDialog({
                                  open: true,
                                  id: res.id,
                                  guestName: `${res.firstName} ${res.lastName}`,
                                })
                              }
                            >
                              <X className="w-3 h-3 mr-1" />
                              {ar ? "مغادرة" : "Check-out"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(res)}
                            title={ar ? "تعديل" : "Edit"}
                          >
                            <Pencil className="w-3.5 h-3.5 text-blue-500" />
                          </Button>
                          {(res.status === "UPCOMING" || isSystemAdmin) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteId(res.id)}
                              title={ar ? "حذف" : "Delete"}
                            >
                              <Trash className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={resVisible.size + 1}
                    className="py-12 text-center"
                  >
                    <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-muted-foreground">
                      {ar ? "لا توجد حجوزات" : "No reservations found"}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {_resWrapper?.pagination && (
            <DataPagination
              total={_resWrapper.pagination.total}
              pageSize={LIMIT}
              currentPage={page}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* New Reservation Dialog */}
      <Dialog
        open={isOpen}
        onOpenChange={(v) => {
          setIsOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent
          className="max-w-xl"
          srTitle={ar ? "حجز جديد" : "New Reservation"}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              {ar ? "حجز جديد" : "New Reservation"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
            {/* Employee search pre-fill */}
            <div className="space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {ar
                    ? "بحث عن موظف (تعبئة تلقائية)"
                    : "Search Employee (auto-fill)"}
                </Label>
                {activeProperty && (
                  <span className="flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                    <Building2 className="w-3 h-3" />
                    {activeProperty.name}
                  </span>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder={
                    ar
                      ? "اسم الموظف أو كوده أو رقم هويته..."
                      : "Employee name, code, or ID..."
                  }
                  value={empSearch}
                  onChange={(e) => {
                    setEmpSearch(e.target.value);
                    setShowEmpSuggestions(true);
                  }}
                  onFocus={() => setShowEmpSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowEmpSuggestions(false), 150)
                  }
                />
              </div>
              {showEmpSuggestions && empSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 border rounded-lg bg-popover shadow-lg max-h-52 overflow-y-auto">
                  {empSuggestions.map((emp: any) => (
                    <button
                      key={emp.id}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left border-b last:border-0"
                      onMouseDown={() => applyEmployee(emp)}
                    >
                      {emp.photoUrl ? (
                        <img
                          src={emp.photoUrl}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0 border"
                          alt=""
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {emp.firstName?.[0]}
                            {emp.lastName?.[0]}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {emp.department || "—"} • {emp.employeeId} •{" "}
                          {emp.nationalId || "—"}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {emp.jobTitle || ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Section: Personal Info */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {ar ? "البيانات الشخصية" : "Personal Info"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    {ar ? "الاسم الأول" : "First Name"}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {ar ? "اسم العائلة" : "Last Name"}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    {ar ? "رقم الهوية" : "ID Card Number"}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.guestIdCardNumber}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        guestIdCardNumber: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {ar ? "الهاتف" : "Phone"}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.guestPhone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, guestPhone: e.target.value }))
                    }
                    type="tel"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{ar ? "الجنسية" : "Nationality"}</Label>
                  {nationalityValues.length > 0 ? (
                    <Select
                      value={form.nationality || "none"}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          nationality: v === "none" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={ar ? "اختر..." : "Select..."}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {nationalityValues.map((n: any) => (
                          <SelectItem key={n.id} value={n.value}>
                            {n.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.nationality}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, nationality: e.target.value }))
                      }
                      placeholder={ar ? "مصرية..." : "Egyptian..."}
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "الجنس" : "Gender"}</Label>
                  <Select
                    value={form.gender || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, gender: v === "none" ? "" : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="M">{ar ? "ذكر" : "Male"}</SelectItem>
                      <SelectItem value="F">
                        {ar ? "أنثى" : "Female"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "الكود الوظيفي" : "Employee Code"}</Label>
                  <Input
                    value={form.employeeCode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, employeeCode: e.target.value }))
                    }
                    placeholder="EMP-001"
                  />
                </div>
              </div>
            </div>

            {/* ✅ Work Info with filtered Job Titles */}
            <WorkInfoSection
              dept={form.department}
              jobTitle={form.jobTitle}
              level={form.level}
              filteredTitles={filteredJobTitles}
              onDeptChange={(v) =>
                setForm((f) => ({ ...f, department: v, jobTitle: "" }))
              }
              onJobTitleChange={(v) => setForm((f) => ({ ...f, jobTitle: v }))}
              onLevelChange={(v) => setForm((f) => ({ ...f, level: v }))}
            />

            {/* Section: Reservation Details */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {ar ? "تفاصيل الحجز" : "Reservation Details"}
              </p>
              <div className="space-y-1.5">
                <Label>{ar ? "نوع الغرفة" : "Room Type"}</Label>
                <Select
                  value={form.roomType || "any"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, roomType: v === "any" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={ar ? "أي نوع" : "Any room type"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{ar ? "أي نوع" : "Any"}</SelectItem>
                    {roomTypeValues.length > 0
                      ? roomTypeValues.map((t: any) => (
                          <SelectItem key={t.id} value={t.value}>
                            {t.value}
                          </SelectItem>
                        ))
                      : [
                          "SINGLE",
                          "DOUBLE",
                          "TRIPLE",
                          "QUAD",
                          "STUDIO",
                          "SHARED",
                        ].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    {ar ? "تاريخ الدخول" : "Check-in Date"}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date"
                    value={form.checkInDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, checkInDate: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "تاريخ المغادرة" : "Check-out Date"}</Label>
                  <Input
                    type="date"
                    value={form.checkOutDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, checkOutDate: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "ملاحظات" : "Notes"}</Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={onSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? ar
                    ? "جاري الإنشاء..."
                    : "Creating..."
                  : ar
                    ? "إنشاء الحجز"
                    : "Create Reservation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Check-in Dialog */}
      <Dialog
        open={checkinDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setCheckinDialog({ open: false, id: null });
            setRoomSearch("");
          }
        }}
      >
        <DialogContent
          className="max-w-md"
          srTitle={ar ? "تسجيل دخول" : "Check-in Guest"}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              {ar ? "تسجيل دخول" : "Check-in Guest"}
            </DialogTitle>
          </DialogHeader>
          {checkinDialog.guestName && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 -mt-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <p className="font-semibold">{checkinDialog.guestName}</p>
            </div>
          )}
          <div className="space-y-3 pt-1">
            <Label>
              {ar ? "اختيار غرفة" : "Assign Room"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder={ar ? "بحث عن غرفة..." : "Search room number..."}
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
              />
            </div>
            <div className="border rounded-lg max-h-52 overflow-y-auto">
              {filteredCheckinRooms.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground text-center">
                  {ar ? "لا توجد غرف متاحة" : "No available rooms"}
                </p>
              ) : (
                filteredCheckinRooms.map((r) => {
                  const avail = (r.capacity ?? 1) - (r.currentOccupancy ?? 0);
                  const isSelected = checkinRoomId === String(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => setCheckinRoomId(String(r.id))}
                      className={`w-full flex items-center justify-between px-3 py-2.5 border-b last:border-0 text-left transition-colors ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"}`}
                    >
                      <div>
                        <span className="font-mono font-semibold">
                          {r.roomNumber}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground capitalize">
                          {r.roomType}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        <BedDouble className="w-3 h-3 mr-1" />
                        {avail}/{r.capacity}
                      </Badge>
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setCheckinDialog({ open: false, id: null })}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleCheckin}
                disabled={checkinMutation.isPending || !checkinRoomId}
              >
                {checkinMutation.isPending
                  ? ar
                    ? "جاري..."
                    : "Processing..."
                  : ar
                    ? "تأكيد الدخول"
                    : "Confirm Check-in"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ Edit Reservation Dialog - كامل بكل الحقول */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => {
          if (!open) setEditDialog({ open: false, reservation: null });
        }}
      >
        <DialogContent
          className="max-w-xl"
          srTitle={ar ? "تعديل الحجز" : "Edit Reservation"}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              {ar ? "تعديل الحجز" : "Edit Reservation"}
            </DialogTitle>
          </DialogHeader>
          {editDialog.reservation && (
            <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1">
              {/* Personal Info */}
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {ar ? "البيانات الشخصية" : "Personal Info"}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{ar ? "الاسم الأول" : "First Name"}</Label>
                    <Input
                      value={editForm.firstName}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          firstName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{ar ? "اسم العائلة" : "Last Name"}</Label>
                    <Input
                      value={editForm.lastName}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, lastName: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{ar ? "رقم الهوية" : "ID Card"}</Label>
                    <Input
                      value={editForm.guestIdCardNumber}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          guestIdCardNumber: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{ar ? "الهاتف" : "Phone"}</Label>
                    <Input
                      value={editForm.guestPhone}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          guestPhone: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>{ar ? "الجنسية" : "Nationality"}</Label>
                    {nationalityValues.length > 0 ? (
                      <Select
                        value={editForm.nationality || "none"}
                        onValueChange={(v) =>
                          setEditForm((f) => ({
                            ...f,
                            nationality: v === "none" ? "" : v,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {nationalityValues.map((n: any) => (
                            <SelectItem key={n.id} value={n.value}>
                              {n.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={editForm.nationality}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            nationality: e.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>{ar ? "الجنس" : "Gender"}</Label>
                    <Select
                      value={editForm.gender || "none"}
                      onValueChange={(v) =>
                        setEditForm((f) => ({
                          ...f,
                          gender: v === "none" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="M">{ar ? "ذكر" : "Male"}</SelectItem>
                        <SelectItem value="F">
                          {ar ? "أنثى" : "Female"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{ar ? "الكود الوظيفي" : "Emp Code"}</Label>
                    <Input
                      value={editForm.employeeCode}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          employeeCode: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* ✅ Work Info with filtered Job Titles */}
              <WorkInfoSection
                dept={editForm.department}
                jobTitle={editForm.jobTitle}
                level={editForm.level}
                filteredTitles={filteredEditJobTitles}
                onDeptChange={(v) =>
                  setEditForm((f) => ({ ...f, department: v, jobTitle: "" }))
                }
                onJobTitleChange={(v) =>
                  setEditForm((f) => ({ ...f, jobTitle: v }))
                }
                onLevelChange={(v) => setEditForm((f) => ({ ...f, level: v }))}
              />

              {/* Reservation Details */}
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {ar ? "تفاصيل الحجز" : "Reservation Details"}
                </p>
                <div className="space-y-1.5">
                  <Label>{ar ? "نوع الغرفة" : "Room Type"}</Label>
                  <Select
                    value={editForm.roomType || "any"}
                    onValueChange={(v) =>
                      setEditForm((f) => ({
                        ...f,
                        roomType: v === "any" ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={ar ? "أي نوع" : "Any"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">
                        {ar ? "أي نوع" : "Any"}
                      </SelectItem>
                      {roomTypeValues.map((t: any) => (
                        <SelectItem key={t.id} value={t.value}>
                          {t.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{ar ? "تاريخ الدخول" : "Check-in Date"}</Label>
                    <Input
                      type="date"
                      value={editForm.checkInDate}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          checkInDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{ar ? "تاريخ المغادرة" : "Check-out Date"}</Label>
                    <Input
                      type="date"
                      value={editForm.checkOutDate}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          checkOutDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "ملاحظات" : "Notes"}</Label>
                  <Textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, notes: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() =>
                    setEditDialog({ open: false, reservation: null })
                  }
                >
                  {ar ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  onClick={handleUpdate}
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <AlertDialog
        open={checkoutDialog.open}
        onOpenChange={(open) => {
          if (!open) setCheckoutDialog({ open: false, id: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <X className="w-5 h-5 text-orange-500" />
              {ar ? "تسجيل المغادرة" : "Check-out Guest"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {checkoutDialog.guestName && (
                <span className="font-semibold text-foreground">
                  {checkoutDialog.guestName}
                </span>
              )}
              <br />
              {ar
                ? 'هل تريد تسجيل مغادرة هذا الضيف الآن؟ سيتم تحديث الحجز إلى "منتهي".'
                : "Check out this guest now? The reservation will be marked as Completed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-500 text-white hover:bg-orange-600"
              onClick={() =>
                checkoutDialog.id && checkoutMutation.mutate(checkoutDialog.id)
              }
            >
              {ar ? "تأكيد المغادرة" : "Confirm Check-out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "حذف الحجز؟" : "Delete Reservation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "لا يمكن التراجع عن هذا الإجراء."
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteId && deleteMutation.mutate({ id: deleteId })
              }
            >
              {ar ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
