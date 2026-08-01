// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import {
  useListHostings,
  useCreateHosting,
  useApproveHosting,
  useCheckinHosting,
  useCheckoutHosting,
  useDeleteHosting,
  useUpdateHosting,
  useListRooms,
  useListEmployees,
  getListHostingsQueryKey,
  useGetSettings,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { EmployeeProfilePopup } from "@/components/ui/employee-profile-popup";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  LogIn,
  Users,
  Baby,
  Pencil,
  Image as ImageIcon,
  FileText,
  Key,
  ArrowRightLeft,
} from "lucide-react";
import {
  ColumnChooser,
  useColumnVisibility,
} from "@/components/ui/column-chooser";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { drawPdfHeader, pdfTextSafe, loadImgDataUrl } from "@/lib/pdf-utils";
import KeyManagementPanel from "@/components/KeyManagementPanel";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";
import { DataPagination } from "@/components/DataPagination";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  ErrorState,
  EmptyState,
  TableSkeleton,
} from "@/components/ui/page-states";

type EmployeeResult = {
  id: number;
  propertyId: number;
  propertyName: string | null;
  employeeId: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  department: string | null;
};

type Companion = {
  name: string;
  idNumber: string;
  documentType: string;
  documentImage: string;
  documentFileName: string;
  relation: string;
  isChild: number;
  age: string;
};

const defaultCompanion = (): Companion => ({
  name: "",
  idNumber: "",
  documentType: "ID",
  documentImage: "",
  documentFileName: "",
  relation: "",
  isChild: 0,
  age: "",
});
const MAX_DOCUMENT_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_DOCUMENT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const DOCUMENT_IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif";

const statusColor = (s: string) => {
  switch (s) {
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "APPROVED":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "ACTIVE":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "COMPLETED":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    case "CANCELLED":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

export default function GuestHosting() {
  const { activePropertyId, properties, setActivePropertyId } = useProperty();
  const { language } = useLanguage();

  const queryClient = useQueryClient();
  const { user, isSystemAdmin } = useAuth();
  const ar = language === "ar";

  const [isOpen, setIsOpen] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [profileEmpId, setProfileEmpId] = useState<number | null>(null);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    hosting: any | null;
  }>({ open: false, hosting: null });
  const [editForm, setEditForm] = useState({
    expectedFrom: "",
    expectedTo: "",
    notes: "",
    roomId: "",
  });
  const [roomSearch, setRoomSearch] = useState("");
  const [formRoomId, setFormRoomId] = useState("");
  const [companionsDetailHostingId, setCompanionsDetailHostingId] = useState<
    number | null
  >(null);
  const [companionCache, setCompanionCache] = useState<Record<number, any[]>>(
    {},
  );
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string | undefined>(
    undefined,
  );

  /* Key Issuance state */
  const [keyPromptOpen, setKeyPromptOpen] = useState(false);
  const [selectedHostingKey, setSelectedHostingKey] = useState<any>(null);
  const [keyPromptRoomId, setKeyPromptRoomId] = useState<string>("");
  const [keyIssuing, setKeyIssuing] = useState(false);

  /* Employee search */
  const [empSearch, setEmpSearch] = useState("");
  const [empResults, setEmpResults] = useState<EmployeeResult[]>([]);
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchPropertyId, setSearchPropertyId] = useState(() =>
    activePropertyId ? String(activePropertyId) : "",
  );
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    hostingType: "SAME_ROOM",
    expectedFrom: "",
    expectedTo: "",
    notes: "",
  });

  const {
    data: hostings,
    isLoading,
    isError,
    refetch,
  } = useListHostings(
    { propertyId: activePropertyId },
    {
      query: {
        queryKey: getListHostingsQueryKey({ propertyId: activePropertyId }),
        enabled: !!activePropertyId,
      },
    },
  );

  useEffect(() => {
    if (!activePropertyId || !(hostings as any[])?.length) return;
    const missing = (hostings as any[]).filter(
      (h) =>
        Number(h.guestsCount ?? 0) > 0 &&
        (!Array.isArray(h.companions) || h.companions.length === 0) &&
        companionCache[h.id] === undefined,
    );
    if (!missing.length) return;

    let cancelled = false;
    Promise.all(
      missing.map(async (h) => {
        try {
          const resp = await fetch(
            `/api/hostings/${h.id}/companions?propertyId=${activePropertyId}`,
          );
          if (!resp.ok) return [h.id, []] as const;
          const list = await resp.json();
          return [h.id, Array.isArray(list) ? list : []] as const;
        } catch {
          return [h.id, []] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setCompanionCache((prev) => {
        const next = { ...prev };
        entries.forEach(([id, list]) => {
          next[id] = list;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [activePropertyId, hostings]);

  const requestPropertyId = Number(searchPropertyId) || activePropertyId;
  const { data: _rData } = useListRooms(
    { propertyId: activePropertyId },
    { query: { enabled: !!activePropertyId } },
  );
  const rooms = _rData?.data || [];
  const { data: _requestRoomsWrapper } = useListRooms(
    { propertyId: requestPropertyId },
    {
      query: {
        enabled: !!requestPropertyId && requestPropertyId !== activePropertyId,
      },
    },
  );
  const requestRooms = _requestRoomsWrapper?.data || [];
  const { data: _eDataWrapper } = useListEmployees(
    { propertyId: activePropertyId ?? undefined, limit: 1000 },
    { query: { enabled: !!activePropertyId } },
  );
  const employees = _eDataWrapper?.employees || _eDataWrapper?.data || [];
  const { data: settings } = useGetSettings(
    { propertyId: activePropertyId },
    { query: { enabled: !!activePropertyId } },
  );
  const modalRooms =
    requestPropertyId === activePropertyId ? rooms : requestRooms;
  const availableFormRooms = (modalRooms as any[]).filter(
    (r) => r.status?.toLowerCase() !== "maintenance",
  );
  const filteredFormRooms = availableFormRooms.filter(
    (r) =>
      !roomSearch.trim() ||
      r.roomNumber?.toLowerCase().includes(roomSearch.toLowerCase()),
  );
  const availableEditRooms = (rooms as any[]).filter(
    (r) => r.status?.toLowerCase() !== "maintenance",
  );
  const filteredEditRooms = availableEditRooms.filter(
    (r) =>
      !roomSearch.trim() ||
      r.roomNumber?.toLowerCase().includes(roomSearch.toLowerCase()),
  );

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListHostingsQueryKey({ propertyId: activePropertyId }),
    });

  const createMutation = useCreateHosting({
    mutation: {
      onSuccess: (_data, variables: any) => {
        const createdPropertyId =
          Number(variables?.data?.propertyId) || activePropertyId;
        queryClient.invalidateQueries({
          queryKey: getListHostingsQueryKey({ propertyId: createdPropertyId }),
        });
        if (createdPropertyId && createdPropertyId !== activePropertyId)
          setActivePropertyId(createdPropertyId);
        toast.success(
          ar ? "تم إنشاء طلب الاستضافة" : "Hosting request created",
        );
        resetAndClose();
      },
      onError: (e: any) => toast.error(e.message || (ar ? "خطأ" : "Error")),
    },
  });

  const approveMutation = useApproveHosting({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تمت الموافقة" : "Request approved");
      },
    },
  });

  const checkinMutation = useCheckinHosting({
    mutation: {
      onSuccess: (data: any) => {
        invalidate();
        toast.success(ar ? "تم تسجيل الدخول" : "Guests checked in");

        // Show key issuance prompt
        if (data) {
          setSelectedHostingKey(data);
          setKeyPromptRoomId(data.roomId ? String(data.roomId) : "");
          setKeyPromptOpen(true);
        }
      },
    },
  });

  const checkoutMutation = useCheckoutHosting({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم تسجيل الخروج" : "Guests checked out");
      },
    },
  });

  const deleteMutation = useDeleteHosting({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم الحذف" : "Deleted");
      },
    },
  });

  const updateMutation = useUpdateHosting({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم تحديث الاستضافة" : "Hosting updated");
        setEditDialog({ open: false, hosting: null });
      },
      onError: (e: any) => toast.error(e.message || (ar ? "خطأ" : "Error")),
    },
  });

  const openEdit = (h: any) => {
    setEditForm({
      expectedFrom: h.expectedFrom ? h.expectedFrom.split("T")[0] : "",
      expectedTo: h.expectedTo ? h.expectedTo.split("T")[0] : "",
      notes: h.notes || "",
      roomId: h.roomId ? String(h.roomId) : "",
    });
    setRoomSearch("");
    setEditDialog({ open: true, hosting: h });
  };

  const handleUpdate = () => {
    if (!editDialog.hosting) return;
    updateMutation.mutate({
      id: editDialog.hosting.id,
      data: {
        expectedFrom: editForm.expectedFrom
          ? new Date(editForm.expectedFrom).toISOString()
          : undefined,
        expectedTo: editForm.expectedTo
          ? new Date(editForm.expectedTo).toISOString()
          : undefined,
        notes: editForm.notes,
        roomId: editForm.roomId ? parseInt(editForm.roomId) : null,
      },
    });
  };

  useEffect(() => {
    if (activePropertyId && !isOpen)
      setSearchPropertyId(String(activePropertyId));
  }, [activePropertyId, isOpen]);

  /* Cross-property employee search */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!empSearch.trim() || empSearch.trim().length < 2) {
      setEmpResults([]);
      setShowDropdown(false);
      return;
    }
    if (!requestPropertyId) {
      setEmpResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const resp = await fetch(
          `/api/employees/search?q=${encodeURIComponent(empSearch.trim())}&propertyId=${requestPropertyId}`,
        );
        if (!resp.ok) {
          setEmpResults([]);
          setShowDropdown(false);
          return;
        }
        setEmpResults(await resp.json());
        setShowDropdown(true);
      } catch {
        setEmpResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [empSearch, requestPropertyId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectEmployee = (emp: EmployeeResult) => {
    setSelectedEmployee(emp);
    setEmpSearch(`${emp.firstName} ${emp.lastName} (${emp.employeeId})`);
    setShowDropdown(false);
  };

  const clearEmployee = () => {
    setSelectedEmployee(null);
    setEmpSearch("");
    setEmpResults([]);
  };

  const resetAndClose = () => {
    setIsOpen(false);
    setSelectedEmployee(null);
    setEmpSearch("");
    setEmpResults([]);
    setCompanions([]);
    setFormRoomId("");
    setForm({
      hostingType: "SAME_ROOM",
      expectedFrom: "",
      expectedTo: "",
      notes: "",
    });
  };

  const addCompanion = (isChild = false) => {
    setCompanions((c) => [
      ...c,
      { ...defaultCompanion(), isChild: isChild ? 1 : 0 },
    ]);
  };

  const removeCompanion = (idx: number) => {
    setCompanions((c) => c.filter((_, i) => i !== idx));
  };

  const updateCompanion = (
    idx: number,
    field: keyof Companion,
    val: string | number,
  ) => {
    setCompanions((c) =>
      c.map((comp, i) => (i === idx ? { ...comp, [field]: val } : comp)),
    );
  };

  const uploadCompanionDocument = (idx: number, file?: File | null) => {
    if (!file) return;
    if (!ALLOWED_DOCUMENT_IMAGE_TYPES.has(file.type)) {
      toast.error(
        ar
          ? "الملف يجب أن يكون صورة JPG أو PNG أو WEBP أو GIF"
          : "File must be a JPG, PNG, WEBP, or GIF image",
      );
      return;
    }
    if (file.size > MAX_DOCUMENT_IMAGE_SIZE) {
      toast.error(ar ? "الحد الأقصى 5 ميجابايت" : "Maximum size is 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCompanions((c) =>
        c.map((comp, i) =>
          i === idx
            ? {
                ...comp,
                documentImage: String(reader.result ?? ""),
                documentFileName: file.name,
              }
            : comp,
        ),
      );
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = () => {
    if (!selectedEmployee) {
      toast.error(ar ? "الرجاء اختيار موظف" : "Please select an employee");
      return;
    }
    if (!form.expectedFrom || !form.expectedTo) {
      toast.error(
        ar
          ? "الرجاء ملء جميع الحقول المطلوبة"
          : "Please fill all required fields",
      );
      return;
    }
    const invalidCompanion = companions.find((c) => !c.name.trim());
    if (invalidCompanion) {
      toast.error(
        ar
          ? "الرجاء إدخال اسم لكل المرافقين"
          : "Please enter name for all companions",
      );
      return;
    }

    const validCompanions = companions
      .filter((c) => c.name.trim())
      .map((c) => ({
        name: c.name,
        idNumber: c.idNumber || null,
        documentType: c.documentType || null,
        documentImage: c.documentImage || null,
        documentFileName: c.documentFileName || null,
        relation: c.relation || null,
        isChild: c.isChild,
        age: c.isChild && c.age ? parseInt(c.age) : null,
      }));

    if (form.hostingType === "SEPARATE_ROOM" && !formRoomId) {
      toast.error(
        ar
          ? "الرجاء اختيار غرفة للاستضافة المنفصلة"
          : "Please select a room for separate room hosting",
      );
      return;
    }
    createMutation.mutate({
      data: {
        propertyId: requestPropertyId!,
        employeeId: selectedEmployee.id,
        hostingType: form.hostingType,
        guestsCount: Math.max(1, validCompanions.length || 1),
        expectedFrom: new Date(form.expectedFrom).toISOString(),
        expectedTo: new Date(form.expectedTo).toISOString(),
        notes: form.notes || "",
        createdBy: user?.username ?? "system",
        roomId: formRoomId ? parseInt(formRoomId) : undefined,
        companions: validCompanions,
      } as any,
    });
  };

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Only show APPROVED, ACTIVE, COMPLETED, CANCELLED in operations page
  const operationalHostings = (hostings || []).filter(
    (h) => h.status !== "PENDING",
  );
  const pagedHostings = operationalHostings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const roomMap = Object.fromEntries((rooms as any[]).map((r) => [r.id, r]));
  const employeeMap = Object.fromEntries(
    (employees as any[]).map((e) => [e.id, e]),
  );

  const pagedHostIds = pagedHostings.map((h) => h.id);
  const allHostPageSelected =
    pagedHostIds.length > 0 && pagedHostIds.every((id) => selectedRows.has(id));
  const toggleSelectAllHost = () => {
    if (allHostPageSelected) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedHostIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedHostIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };
  const toggleHostRow = (id: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const dateText = (
    value: string | null | undefined,
    pattern = "MMM d, yyyy",
  ) => (value ? format(new Date(value), pattern) : "—");

  const getHostEmployee = (h: any) =>
    h.employee ?? employeeMap[h.employeeId] ?? null;
  const getHostName = (h: any) => {
    const emp = getHostEmployee(h);
    const name = emp
      ? `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim()
      : "";
    return name || `#${h.employeeId}`;
  };
  const getHostCode = (h: any) =>
    getHostEmployee(h)?.employeeId ?? `#${h.employeeId}`;
  const getCompanions = (h: any) =>
    Array.isArray(h.companions) && h.companions.length > 0
      ? h.companions
      : (companionCache[h.id] ?? []);
  const getAdultsCount = (h: any) =>
    getCompanions(h).filter((c: any) => Number(c.isChild) !== 1).length;
  const getChildrenCount = (h: any) =>
    getCompanions(h).filter((c: any) => Number(c.isChild) === 1).length;
  const getGuestNames = (h: any) => {
    const names = getCompanions(h)
      .map((c: any) => c.name)
      .filter(Boolean);
    return names.length
      ? names.join(", ")
      : `${h.guestsCount ?? 0} ${ar ? "ضيف" : "guest(s)"}`;
  };
  const getGuestRelations = (h: any) =>
    getCompanions(h)
      .map((c: any) => c.relation)
      .filter(Boolean)
      .join(", ") || "—";
  const getGuestDocs = (h: any) =>
    getCompanions(h)
      .map((c: any) => c.idNumber)
      .filter(Boolean)
      .join(", ") || "—";
  const getRoom = (h: any) => h.room ?? (h.roomId ? roomMap[h.roomId] : null);
  const getRoomNumber = (h: any) => {
    const room = getRoom(h);
    return room?.roomNumber ?? (h.roomId ? `#${h.roomId}` : "—");
  };

  const guestProfileLines = (h: any) => {
    const companions = getCompanions(h);
    if (!companions.length) return [];
    return companions.map((c: any) => {
      const parts = [
        Number(c.isChild) === 1
          ? ar
            ? "طفل"
            : "Child"
          : ar
            ? "بالغ"
            : "Adult",
        c.relation,
        c.idNumber ? `${ar ? "وثيقة" : "Doc"} ${c.idNumber}` : "",
        c.documentImage ? (ar ? "صورة مرفقة" : "image attached") : "",
        Number(c.isChild) === 1 && c.age != null
          ? `${c.age}${ar ? " سنة" : "y"}`
          : "",
      ].filter(Boolean);
      return { name: c.name, meta: parts.join(" • ") };
    });
  };

  const exportHostExcel = () => {
    const all: any[] = hostings || [];
    const target =
      selectedRows.size > 0 ? all.filter((h) => selectedRows.has(h.id)) : all;
    const rows = target.map((h) => {
      const room = getRoom(h);
      return {
        "Host Name": getHostName(h),
        "Employee Code": getHostCode(h),
        "Guest Names": getGuestNames(h),
        "Guest Details": guestProfileLines(h)
          .map(
            (guest: any) =>
              `${guest.name}${guest.meta ? ` (${guest.meta})` : ""}`,
          )
          .join("; "),
        "Guests Count": h.guestsCount,
        Adults: getAdultsCount(h),
        Children: getChildrenCount(h),
        Type: h.hostingType?.replace("_", " ") ?? "",
        Room: getRoomNumber(h),
        Building: room?.buildingName ?? "",
        Floor: room?.floorNumber ?? "",
        From: h.expectedFrom
          ? format(new Date(h.expectedFrom), "yyyy-MM-dd")
          : "",
        To: h.expectedTo ? format(new Date(h.expectedTo), "yyyy-MM-dd") : "",
        Status: h.status,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GuestHosting");
    XLSX.writeFile(
      wb,
      `guest_hosting_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const HOSTING_COLS = [
    {
      key: "host",
      label: "Host Employee",
      labelAr: "الموظف المستضيف",
      defaultVisible: true,
    },
    {
      key: "employeeCode",
      label: "Employee Code",
      labelAr: "كود الموظف",
      defaultVisible: false,
    },
    {
      key: "department",
      label: "Department",
      labelAr: "القسم",
      defaultVisible: false,
    },
    {
      key: "jobTitle",
      label: "Job Title",
      labelAr: "الوظيفة",
      defaultVisible: false,
    },
    {
      key: "guestProfiles",
      label: "Guest Profiles",
      labelAr: "بيانات الضيوف",
      defaultVisible: true,
    },
    {
      key: "guestDocs",
      label: "Guest IDs",
      labelAr: "هويات الضيوف",
      defaultVisible: false,
    },
    {
      key: "relations",
      label: "Relations",
      labelAr: "صلة القرابة",
      defaultVisible: false,
    },
    {
      key: "guestCounts",
      label: "Guest Counts",
      labelAr: "أعداد الضيوف",
      defaultVisible: true,
    },
    {
      key: "type",
      label: "Type",
      labelAr: "نوع الاستضافة",
      defaultVisible: true,
    },
    { key: "room", label: "Room", labelAr: "الغرفة", defaultVisible: true },
    {
      key: "building",
      label: "Building",
      labelAr: "المبنى",
      defaultVisible: false,
    },
    { key: "floor", label: "Floor", labelAr: "الدور", defaultVisible: false },
    {
      key: "roomType",
      label: "Room Type",
      labelAr: "نوع الغرفة",
      defaultVisible: false,
    },
    {
      key: "capacity",
      label: "Capacity",
      labelAr: "السعة",
      defaultVisible: false,
    },
    {
      key: "occupancy",
      label: "Occupancy",
      labelAr: "الإشغال",
      defaultVisible: false,
    },
    {
      key: "roomStatus",
      label: "Room Status",
      labelAr: "حالة الغرفة",
      defaultVisible: false,
    },
    {
      key: "roomGender",
      label: "Room Gender",
      labelAr: "نوع الغرفة",
      defaultVisible: false,
    },
    { key: "from", label: "From", labelAr: "من", defaultVisible: true },
    { key: "to", label: "To", labelAr: "إلى", defaultVisible: true },
    {
      key: "actualIn",
      label: "Actual In",
      labelAr: "دخول فعلي",
      defaultVisible: false,
    },
    {
      key: "actualOut",
      label: "Actual Out",
      labelAr: "خروج فعلي",
      defaultVisible: false,
    },
    { key: "status", label: "Status", labelAr: "الحالة", defaultVisible: true },
    { key: "notes", label: "Notes", labelAr: "ملاحظات", defaultVisible: false },
    {
      key: "createdBy",
      label: "Created By",
      labelAr: "أنشئ بواسطة",
      defaultVisible: false,
    },
    {
      key: "createdAt",
      label: "Created At",
      labelAr: "تاريخ الإنشاء",
      defaultVisible: false,
    },
    {
      key: "actions",
      label: "Actions",
      labelAr: "إجراءات",
      defaultVisible: true,
      fixed: true,
    },
  ];
  const {
    visible: hVisible,
    toggle: hToggle,
    showAll: hShowAll,
    hideAll: hHideAll,
    isVisible: isHVisible,
  } = useColumnVisibility(HOSTING_COLS);

  const exportGuestProfilePdf = async (
    hosting: any,
    hostEmployee: any,
    room: any,
    companions: any[],
  ) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "portrait" });
    const pageW = doc.internal.pageSize.getWidth();

    const activeProp = properties.find((p) => p.id === activePropertyId);
    const propName = activeProp?.name ?? "";

    const startY = await drawPdfHeader(doc, {
      systemLogoUrl: (settings as any)?.systemLogo,
      propLogoUrl: (activeProp as any)?.logo,
      title: ar ? "بيانات الضيوف الكاملة" : "Complete Guest Details",
      subtitle: `${propName}  |  Generated: ${new Date().toLocaleString()}`,
      pageW,
    });

    let currentY = startY;

    // Guest details
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(ar ? "معلومات الاستضافة" : "Hosting Information", 14, currentY);
    currentY += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const empName = pdfTextSafe(
      hostEmployee ? `${hostEmployee.firstName} ${hostEmployee.lastName}` : "—",
    );
    doc.text(
      `Host Employee: ${empName} (${hostEmployee?.employeeId || "—"})`,
      14,
      currentY,
    );
    currentY += 5;
    doc.text(
      `Department / Job: ${pdfTextSafe(hostEmployee?.department || "—")} / ${pdfTextSafe(hostEmployee?.jobTitle || "—")}`,
      14,
      currentY,
    );
    currentY += 5;
    const roomText = pdfTextSafe(
      [
        room?.buildingName,
        room?.floorNumber != null ? `Floor ${room.floorNumber}` : "",
      ]
        .filter(Boolean)
        .join(" - ") || "—",
    );
    doc.text(`Room: ${room?.roomNumber || "—"} (${roomText})`, 14, currentY);
    currentY += 5;
    const typeText = (hosting.hostingType || "").replace("_", " ");
    doc.text(
      `Profile: ${typeText} | Guests: ${hosting.guestsCount || 0}`,
      14,
      currentY,
    );
    currentY += 5;
    doc.text(
      `From: ${hosting.expectedFrom ? format(new Date(hosting.expectedFrom), "MMM d, yyyy") : "—"}`,
      14,
      currentY,
    );
    doc.text(
      `To: ${hosting.expectedTo ? format(new Date(hosting.expectedTo), "MMM d, yyyy") : "—"}`,
      100,
      currentY,
    );
    currentY += 8;

    if (companions && companions.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(ar ? "المرافقون" : "Companions", 14, currentY);
      currentY += 4;

      const rows = companions.map((c, i) => [
        String(i + 1),
        pdfTextSafe(c.name || "—"),
        c.isChild === 1 ? "Child" : "Adult",
        pdfTextSafe(c.relation || "—"),
        c.idNumber || "—",
        c.documentType || "—",
        c.isChild === 1 && c.age ? String(c.age) : "—",
      ]);

      autoTable(doc, {
        head: [
          ["#", "Name", "Type", "Relation", "ID/Passport", "Doc Type", "Age"],
        ],
        body: rows,
        startY: currentY,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: {
          fillColor: [15, 42, 68],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
      currentY = (doc as any).lastAutoTable?.finalY ?? currentY + 10;
    } else {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text("No companions detailed for this record.", 14, currentY);
      currentY += 8;
    }

    if (hosting.notes) {
      currentY += 5;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Notes", 14, currentY);
      currentY += 5;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      const splitNotes = doc.splitTextToSize(
        pdfTextSafe(hosting.notes),
        pageW - 28,
      );
      doc.text(splitNotes, 14, currentY);
      currentY += splitNotes.length * 5 + 5;
    }

    // Attached Documents
    const docs = companions.filter((c) => c.documentImage);
    if (docs.length > 0) {
      if (currentY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        currentY = 20;
      } else {
        currentY += 10;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(ar ? "المستندات المرفقة" : "Attached Documents", 14, currentY);
      currentY += 10;

      for (let i = 0; i < docs.length; i++) {
        const c = docs[i];
        try {
          const img = await loadImgDataUrl(c.documentImage);
          if (img) {
            const maxWidth = pageW - 28;
            const maxHeight = 100;
            let finalW = img.w;
            let finalH = img.h;
            if (finalW > maxWidth) {
              const ratio = maxWidth / finalW;
              finalW = maxWidth;
              finalH = finalH * ratio;
            }
            if (finalH > maxHeight) {
              const ratio = maxHeight / finalH;
              finalH = maxHeight;
              finalW = finalW * ratio;
            }

            if (
              currentY + finalH + 15 >
              doc.internal.pageSize.getHeight() - 20
            ) {
              doc.addPage();
              currentY = 20;
            }

            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(
              `${ar ? "المرافق" : "Companion"}: ${pdfTextSafe(c.name)} - ${c.documentType === "PASSPORT" ? (ar ? "جواز سفر" : "Passport") : ar ? "بطاقة هوية" : "ID Card"}`,
              14,
              currentY,
            );
            currentY += 5;

            doc.addImage(img.dataUrl, "PNG", 14, currentY, finalW, finalH);
            currentY += finalH + 15;
          }
        } catch (e) {
          console.error("Failed to load companion document image", e);
        }
      }
    }

    doc.save(
      `guest_profile_${hosting.id}_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">
            {ar ? "استضافة الضيوف" : "Guest Hosting"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ar
              ? "إدارة طلبات استضافة الضيوف والمرافقين"
              : "Manage guest hosting requests with companion details"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnChooser
            cols={HOSTING_COLS}
            visible={hVisible}
            onToggle={hToggle}
            onShowAll={hShowAll}
            onHideAll={hHideAll}
            ar={ar}
          />
        </div>
      </div>

      <BulkActionBar
        count={selectedRows.size}
        onClear={() => setSelectedRows(new Set())}
        onExportExcel={exportHostExcel}
        ar={ar}
      />

      {/* Table */}
      {isError ? (
        <ErrorState
          onRetry={() => refetch()}
          className="border rounded-lg bg-card my-4"
        />
      ) : isLoading ? (
        <TableSkeleton rows={5} columns={8} className="my-4" />
      ) : pagedHostings.length === 0 ? (
        <EmptyState
          title={ar ? "لا توجد استضافات" : "No Hostings Found"}
          description={
            ar
              ? "لم يتم العثور على أي بيانات استضافة مطابقة للبحث."
              : "No hosting data matches the search criteria."
          }
          className="border rounded-lg bg-card my-4"
        />
      ) : (
        <div className="border rounded-lg bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10 px-3">
                    <Checkbox
                      checked={allHostPageSelected}
                      onCheckedChange={toggleSelectAllHost}
                    />
                  </TableHead>
                  {HOSTING_COLS.map(
                    (col) =>
                      isHVisible(col.key) &&
                      col.key !== "actions" && (
                        <TableHead
                          key={col.key}
                          className="font-semibold"
                          style={
                            col.key === "guestProfiles" ||
                            col.key === "guestNames"
                              ? { minWidth: "160px" }
                              : {}
                          }
                        >
                          {ar ? col.labelAr : col.label}
                        </TableHead>
                      ),
                  )}
                  {isHVisible("actions") && (
                    <TableHead className="font-semibold">
                      {ar ? "إجراءات" : "Actions"}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedHostings.map((h) => {
                  const isSelected = selectedRows.has(h.id);
                  const emp = getHostEmployee(h);
                  const room = getRoom(h);
                  const guestProfiles = guestProfileLines(h);
                  return (
                    <TableRow
                      key={h.id}
                      className={
                        isSelected ? "bg-primary/5" : "hover:bg-muted/20"
                      }
                    >
                      <TableCell className="px-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleHostRow(h.id)}
                        />
                      </TableCell>
                      {isHVisible("host") && (
                        <TableCell className="font-medium">
                          <button
                            className="flex items-center gap-2 text-left text-sm font-semibold text-primary hover:underline"
                            onClick={() =>
                              h.employeeId != null &&
                              setProfileEmpId(Number(h.employeeId))
                            }
                          >
                            {emp?.photoUrl ? (
                              <img
                                src={emp.photoUrl}
                                alt=""
                                className="h-8 w-8 rounded-full border object-cover"
                              />
                            ) : (
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {getHostName(h)
                                  .split(" ")
                                  .map((part: string) => part[0])
                                  .join("")
                                  .slice(0, 2)}
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block whitespace-nowrap">
                                {getHostName(h)}
                              </span>
                              <span className="block text-xs font-normal text-muted-foreground">
                                {getHostCode(h)}
                              </span>
                            </span>
                          </button>
                        </TableCell>
                      )}
                      {isHVisible("employeeCode") && (
                        <TableCell className="font-mono text-xs">
                          {getHostCode(h)}
                        </TableCell>
                      )}
                      {isHVisible("department") && (
                        <TableCell className="text-sm">
                          {emp?.department || "—"}
                        </TableCell>
                      )}
                      {isHVisible("jobTitle") && (
                        <TableCell className="text-sm">
                          {emp?.jobTitle || "—"}
                        </TableCell>
                      )}
                      {isHVisible("guestProfiles") && (
                        <TableCell className="max-w-[160px]">
                          {guestProfiles.length > 0 ||
                          Number(h.guestsCount ?? 0) > 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-full text-xs justify-center"
                              onClick={() => setCompanionsDetailHostingId(h.id)}
                            >
                              {guestProfiles.length > 0
                                ? ar
                                  ? "فيو بروفايل"
                                  : "View Profile"
                                : ar
                                  ? "استكمال البيانات"
                                  : "Complete Data"}
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      )}
                      {isHVisible("guestDocs") && (
                        <TableCell className="max-w-[180px] truncate font-mono text-xs">
                          {getGuestDocs(h)}
                        </TableCell>
                      )}
                      {isHVisible("relations") && (
                        <TableCell className="text-sm">
                          {getGuestRelations(h)}
                        </TableCell>
                      )}
                      {isHVisible("guestCounts") && (
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-1 whitespace-nowrap">
                            <span className="font-semibold">
                              {h.guestsCount} {ar ? "إجمالي" : "total"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {getAdultsCount(h)} {ar ? "بالغ" : "adult"} •{" "}
                              {getChildrenCount(h)} {ar ? "طفل" : "child"}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      {isHVisible("type") && (
                        <TableCell className="text-sm">
                          <Badge
                            variant="outline"
                            className="text-xs capitalize"
                          >
                            {h.hostingType?.replace("_", " ") ?? "—"}
                          </Badge>
                        </TableCell>
                      )}
                      {isHVisible("room") && (
                        <TableCell className="font-mono text-sm font-semibold">
                          {getRoomNumber(h)}
                        </TableCell>
                      )}
                      {isHVisible("building") && (
                        <TableCell className="text-sm">
                          {room?.buildingName ?? "—"}
                        </TableCell>
                      )}
                      {isHVisible("floor") && (
                        <TableCell className="text-sm">
                          {room?.floorNumber ?? "—"}
                        </TableCell>
                      )}
                      {isHVisible("roomType") && (
                        <TableCell className="text-sm capitalize">
                          {room?.roomType ?? h.roomType ?? "—"}
                        </TableCell>
                      )}
                      {isHVisible("capacity") && (
                        <TableCell className="text-sm">
                          {room?.capacity ?? "—"}
                        </TableCell>
                      )}
                      {isHVisible("occupancy") && (
                        <TableCell className="text-sm">
                          {room
                            ? `${room.currentOccupancy ?? 0}/${room.capacity ?? "—"}`
                            : "—"}
                        </TableCell>
                      )}
                      {isHVisible("roomStatus") && (
                        <TableCell className="text-sm capitalize">
                          {room?.status ?? "—"}
                        </TableCell>
                      )}
                      {isHVisible("roomGender") && (
                        <TableCell className="text-sm capitalize">
                          {room?.gender ?? "—"}
                        </TableCell>
                      )}
                      {isHVisible("from") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {dateText(h.expectedFrom)}
                        </TableCell>
                      )}
                      {isHVisible("to") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {dateText(h.expectedTo)}
                        </TableCell>
                      )}
                      {isHVisible("actualIn") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {dateText(h.actualCheckIn)}
                        </TableCell>
                      )}
                      {isHVisible("actualOut") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {dateText(h.actualCheckOut)}
                        </TableCell>
                      )}
                      {isHVisible("status") && (
                        <TableCell>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(h.status)}`}
                          >
                            {h.status}
                          </span>
                        </TableCell>
                      )}
                      {isHVisible("notes") && (
                        <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                          {h.notes || "—"}
                        </TableCell>
                      )}
                      {isHVisible("createdBy") && (
                        <TableCell className="text-sm">
                          {h.createdBy || "—"}
                        </TableCell>
                      )}
                      {isHVisible("createdAt") && (
                        <TableCell className="text-sm whitespace-nowrap">
                          {dateText(h.createdAt, "MMM d, yyyy HH:mm")}
                        </TableCell>
                      )}
                      {isHVisible("actions") && (
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
                            <DropdownMenuContent align="end" className="w-44">
                              {h.status === "APPROVED" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      checkinMutation.mutate({
                                        id: h.id,
                                        data: {
                                          actualCheckIn: new Date()
                                            .toISOString()
                                            .split("T")[0],
                                        } as any,
                                      })
                                    }
                                  >
                                    <LogIn className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                    {ar ? "تسجيل الوصول" : "Check-in"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedHostingKey(h);
                                      setKeyPromptRoomId(
                                        h.roomId ? String(h.roomId) : "",
                                      );
                                      setKeyPromptOpen(true);
                                    }}
                                  >
                                    <Key className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                    {ar ? "إصدار مفتاح" : "Issue Key"}
                                  </DropdownMenuItem>
                                </>
                              )}
                              {h.status === "ACTIVE" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedHostingKey(h);
                                      setKeyPromptRoomId(
                                        h.roomId ? String(h.roomId) : "",
                                      );
                                      setKeyPromptOpen(true);
                                    }}
                                  >
                                    <Key className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                    {ar ? "إصدار مفتاح" : "Issue Key"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      checkoutMutation.mutate({ id: h.id })
                                    }
                                  >
                                    <LogIn className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 rotate-180" />
                                    {ar ? "تسجيل المغادرة" : "Check-out"}
                                  </DropdownMenuItem>
                                </>
                              )}
                              {(h.status === "PENDING" ||
                                h.status === "APPROVED" ||
                                isSystemAdmin) && (
                                <DropdownMenuItem onClick={() => openEdit(h)}>
                                  <Pencil className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                  {ar ? "تعديل" : "Edit"}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {operationalHostings.length > 0 && (
            <DataPagination
              total={operationalHostings.length}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      )}

      {/* Employee Profile Popup */}
      <EmployeeProfilePopup
        employeeId={profileEmpId}
        propertyId={activePropertyId}
        onClose={() => setProfileEmpId(null)}
      />

      {/* Edit Hosting Dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => {
          if (!open) setEditDialog({ open: false, hosting: null });
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{ar ? "تعديل الاستضافة" : "Edit Hosting"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label className="text-xs mb-1 block">
                {ar ? "تاريخ البداية" : "Expected From"}
              </Label>
              <Input
                type="date"
                value={editForm.expectedFrom}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    expectedFrom: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">
                {ar ? "تاريخ النهاية" : "Expected To"}
              </Label>
              <Input
                type="date"
                value={editForm.expectedTo}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    expectedTo: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">
                {ar ? "الغرفة" : "Room"}
              </Label>
              <Select
                value={editForm.roomId}
                onValueChange={(val) =>
                  setEditForm((prev) => ({ ...prev, roomId: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={ar ? "اختر الغرفة" : "Select room"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredEditRooms.map((r: any) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.roomNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">
                {ar ? "ملاحظات" : "Notes"}
              </Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, hosting: null })}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleUpdate}>{ar ? "حفظ" : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Guest Companions Detail Modal */}
      {companionsDetailHostingId &&
        (() => {
          const hosting = hostings?.find(
            (h) => h.id === companionsDetailHostingId,
          );
          if (!hosting) return null;
          const companions = getCompanions(hosting);
          const hostEmployee = getHostEmployee(hosting);
          const room = getRoom(hosting);
          return (
            <Dialog
              open={!!companionsDetailHostingId}
              onOpenChange={(open) => {
                if (!open) setCompanionsDetailHostingId(null);
              }}
            >
              <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
                <DialogHeader className="flex flex-row items-center justify-between pr-8">
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {ar ? "بيانات الضيوف الكاملة" : "Complete Guest Details"}
                  </DialogTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      exportGuestProfilePdf(
                        hosting,
                        hostEmployee,
                        room,
                        companions,
                      )
                    }
                    className="gap-2 text-red-700 border-red-200 hover:bg-red-50"
                  >
                    <FileText className="w-4 h-4" />
                    {ar ? "تصدير PDF" : "Export PDF"}
                  </Button>
                </DialogHeader>

                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "الموظف المستضيف" : "Host Employee"}
                      </p>
                      <p className="text-sm font-bold">
                        {getHostName(hosting)}
                      </p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {getHostCode(hosting)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "بروفايل التسكين" : "Hosting Profile"}
                      </p>
                      <p className="text-sm font-bold">
                        {hosting.hostingType?.replace("_", " ") ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {hosting.status} • {hosting.guestsCount}{" "}
                        {ar ? "ضيف" : "guest(s)"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "الغرفة" : "Room"}
                      </p>
                      <p className="text-sm font-bold">
                        {getRoomNumber(hosting)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          room?.buildingName,
                          room?.floorNumber != null
                            ? `${ar ? "الدور" : "Floor"} ${room.floorNumber}`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" • ") || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "من" : "From"}
                      </p>
                      <p className="text-sm font-medium">
                        {dateText(hosting.expectedFrom)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "إلى" : "To"}
                      </p>
                      <p className="text-sm font-medium">
                        {dateText(hosting.expectedTo)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "القسم/الوظيفة" : "Department / Job"}
                      </p>
                      <p className="text-sm font-medium">
                        {[hostEmployee?.department, hostEmployee?.jobTitle]
                          .filter(Boolean)
                          .join(" • ") || "—"}
                      </p>
                    </div>
                  </div>
                  {hosting.notes && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        {ar ? "ملاحظات" : "Notes"}
                      </p>
                      <p className="text-sm">{hosting.notes}</p>
                    </div>
                  )}
                </div>

                {companions.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-muted-foreground">
                      {ar
                        ? "السجل محفوظ بعدد ضيوف فقط، ولا توجد أسماء أو بيانات مرافقين مسجلة"
                        : "This record only has a guest count. No guest names or companion details are saved."}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ar
                        ? "أي حجز جديد يتم إضافة الضيوف فيه سيظهر هنا تلقائياً."
                        : "New requests with added companions will show their details here automatically."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {companions.map((companion: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-5 rounded-lg border-2 ${
                          companion.isChild === 1
                            ? "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-blue-300 dark:border-blue-700"
                            : "bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/30 dark:to-orange-900/30 border-amber-300 dark:border-amber-700"
                        }`}
                      >
                        {/* Header with Name and Type */}
                        <div className="flex items-start justify-between mb-4 pb-4 border-b-2 border-current border-opacity-10">
                          <div>
                            <h3 className="text-xl font-bold">
                              {companion.name}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {companion.isChild === 1 ? (
                                <Badge className="bg-blue-500 text-white text-xs py-1 px-2.5">
                                  <Baby className="w-3 h-3 mr-1" />
                                  {ar ? "طفل" : "Child"}
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-600 text-white text-xs py-1 px-2.5">
                                  <Users className="w-3 h-3 mr-1" />
                                  {ar ? "بالغ" : "Adult"}
                                </Badge>
                              )}
                              {companion.relation && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs py-1 px-2.5"
                                >
                                  {companion.relation}
                                </Badge>
                              )}
                              {companion.isChild === 1 && companion.age && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs py-1 px-2.5"
                                >
                                  {companion.age} {ar ? "سنة" : "year old"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            {ar ? "الضيف #" : "Guest #"}
                            {idx + 1}
                          </div>
                        </div>

                        {/* Personal Information Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {companion.idNumber && (
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-current border-opacity-20">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">
                                {ar ? "رقم الهوية" : "ID/Passport Number"}
                              </p>
                              <p className="font-mono text-sm font-bold text-foreground mt-1">
                                {companion.idNumber}
                              </p>
                            </div>
                          )}

                          {companion.documentType && (
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-current border-opacity-20">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">
                                {ar ? "نوع المستند" : "Document Type"}
                              </p>
                              <p className="text-sm font-medium text-foreground mt-1">
                                {companion.documentType === "ID"
                                  ? ar
                                    ? "بطاقة هوية"
                                    : "ID Card"
                                  : companion.documentType === "PASSPORT"
                                    ? ar
                                      ? "جواز سفر"
                                      : "Passport"
                                    : companion.documentType}
                              </p>
                            </div>
                          )}

                          {companion.relation && (
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-current border-opacity-20">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">
                                {ar ? "صلة القرابة" : "Relation"}
                              </p>
                              <p className="text-sm font-medium text-foreground mt-1">
                                {companion.relation}
                              </p>
                            </div>
                          )}

                          {companion.isChild === 1 && companion.age && (
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-current border-opacity-20">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">
                                {ar ? "العمر" : "Age"}
                              </p>
                              <p className="text-sm font-medium text-foreground mt-1">
                                {companion.age} {ar ? "سنة" : "years"}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Documents Section */}
                        {companion.documentImage && (
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-green-300 dark:border-green-700">
                            <p className="text-sm font-bold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                              <ImageIcon className="w-4 h-4" />
                              {ar ? "المستندات المرفوعة" : "Uploaded Documents"}
                            </p>

                            <div className="space-y-3">
                              {companion.documentImage &&
                                (companion.documentImage.startsWith(
                                  "data:image/",
                                ) ||
                                  companion.documentImage.startsWith("http") ||
                                  /\.(png|jpg|jpeg|gif|webp)$/i.test(
                                    companion.documentImage,
                                  )) && (
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setLightboxSrc(companion.documentImage);
                                        setLightboxName(
                                          companion.documentFileName,
                                        );
                                      }}
                                      className="w-full block text-left"
                                    >
                                      <img
                                        src={companion.documentImage}
                                        alt={
                                          companion.documentFileName ||
                                          (ar
                                            ? "صورة المستند"
                                            : "Document Image")
                                        }
                                        className="w-full max-h-96 object-contain rounded-lg border-2 border-green-200 dark:border-green-800 p-2 bg-gray-50 dark:bg-gray-700 hover:brightness-95 transition-all"
                                      />
                                    </button>
                                  </div>
                                )}

                              {companion.documentFileName && (
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  <span className="font-semibold">
                                    {ar ? "اسم الملف:" : "File Name:"}
                                  </span>{" "}
                                  {companion.documentFileName}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {!companion.documentImage && (
                          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-center">
                            <ImageIcon className="w-8 h-8 mx-auto opacity-30 mb-2" />
                            <p className="text-sm text-muted-foreground italic">
                              {ar
                                ? "لا توجد مستندات مرفوعة"
                                : "No documents uploaded"}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Summary */}
                    <div className="bg-muted/50 p-4 rounded-lg border border-muted-foreground/20">
                      <p className="text-sm font-semibold text-muted-foreground">
                        {ar
                          ? `إجمالي الضيوف: ${companions.length}`
                          : `Total Guests: ${companions.length}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ar
                          ? `${companions.filter((c: any) => c.isChild !== 1).length} بالغ • ${companions.filter((c: any) => c.isChild === 1).length} طفل`
                          : `${companions.filter((c: any) => c.isChild !== 1).length} adult • ${companions.filter((c: any) => c.isChild === 1).length} child`}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t gap-2">
                  <Button
                    onClick={() => setCompanionsDetailHostingId(null)}
                    className="px-6"
                  >
                    {ar ? "إغلاق" : "Close"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
      <ImageLightbox
        isOpen={lightboxSrc !== null}
        src={lightboxSrc || ""}
        name={lightboxName}
        onClose={() => setLightboxSrc(null)}
      />

      {/* ── Key Issuance Popup ── */}
      <Dialog
        open={keyPromptOpen}
        onOpenChange={(open) => {
          if (!open && keyIssuing) return;
          setKeyPromptOpen(open);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {ar ? "إصدار بطاقات الوصول للضيوف" : "Issue Guest Access Cards"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-4">
              {ar
                ? "يمكنك إصدار مفاتيح الغرفة أو الكروت للمرافقين لهذه الاستضافة."
                : "You can issue room keys or cards for companions for this hosting."}
            </p>

            {!selectedHostingKey?.roomId && (
              <div className="mb-4">
                <Label className="text-xs mb-1 block">
                  {ar
                    ? "اختر الغرفة المخصصة (غرفة الموظف)"
                    : "Select assigned room (Employee's Room)"}
                </Label>
                <Select
                  value={keyPromptRoomId}
                  onValueChange={setKeyPromptRoomId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={ar ? "اختر الغرفة..." : "Select room..."}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {modalRooms.map((r: any) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.roomNumber} - {r.buildingName}{" "}
                        {r.floorNumber ? `(Floor ${r.floorNumber})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(selectedHostingKey?.roomId || keyPromptRoomId) &&
            activePropertyId ? (
              <KeyManagementPanel
                propertyId={activePropertyId}
                roomId={selectedHostingKey?.roomId || parseInt(keyPromptRoomId)}
                checkInDate={(() => {
                  const d =
                    selectedHostingKey?.actualCheckIn ||
                    selectedHostingKey?.expectedFrom;
                  if (!d) return undefined;
                  return new Date(d) < new Date()
                    ? new Date().toISOString()
                    : d;
                })()}
                checkOutDate={selectedHostingKey?.expectedTo}
                onIssuingChange={setKeyIssuing}
                onIssueComplete={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
                  toast.success(
                    ar ? "تم إصدار المفاتيح بنجاح" : "Keys issued successfully",
                  );
                }}
              />
            ) : (
              <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>
                  {ar
                    ? "الرجاء تحديد غرفة لإصدار المفتاح."
                    : "Please select a room to issue a key."}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
