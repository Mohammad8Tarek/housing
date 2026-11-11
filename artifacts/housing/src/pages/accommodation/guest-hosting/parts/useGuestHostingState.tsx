// State, effects and handlers of GuestHosting (moved verbatim).
import { escapeHtml } from "@/lib/html-escape";
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
  getListHostingsQueryKey,
  useGetSettings,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/date-utils";
import { useQueryClient } from "@tanstack/react-query";
import { useColumnVisibility } from "@/components/ui/column-chooser";
import { printLuxuryReport } from "@/lib/pdf-utils";
import { exportExcel } from "@/pages/reports/utils/export";
import { usePermission } from "@/hooks/use-permission";
import {
  ProfileResult,
  Companion,
  defaultCompanion,
  MAX_DOCUMENT_IMAGE_SIZE,
  ALLOWED_DOCUMENT_IMAGE_TYPES,
} from "./GuestHostingPage.constants";
import { useAllRows } from "@/lib/use-all-rows";

export function useGuestHostingState() {
  const { activePropertyId, properties, setActivePropertyId } = useProperty();
  const { language } = useLanguage();

  const queryClient = useQueryClient();
  const { user, isSystemAdmin } = useAuth();
  const { can } = usePermission();
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

  /* Profile search */
  const [empSearch, setEmpSearch] = useState("");
  const [empResults, setEmpResults] = useState<ProfileResult[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileResult | null>(
    null,
  );
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
    data: _hWrapper,
    isLoading,
    isError,
    refetch,
  } = useListHostings(
    {
      propertyId: activePropertyId,
      page: currentPage,
      limit: pageSize,
      excludeStatus: "PENDING",
    } as any,
    {
      query: {
        queryKey: ["listHostings", activePropertyId, currentPage, pageSize],
        enabled: !!activePropertyId,
      },
    },
  );

  const numericPropertyId =
    typeof activePropertyId === "number" ? activePropertyId : undefined;
  const hostings: any[] = Array.isArray(_hWrapper)
    ? _hWrapper
    : ((_hWrapper as any)?.data as any[]) || [];
  const paginationTotal: number = Array.isArray(_hWrapper)
    ? _hWrapper.length
    : (((_hWrapper as any)?.pagination?.total as number) ?? hostings.length);

  useEffect(() => {
    if (!numericPropertyId || !(hostings as any[])?.length) return;
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
            `/api/hostings/${h.id}/companions?propertyId=${numericPropertyId}`,
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
          next[id] = list as any[];
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [numericPropertyId, hostings]);

  const requestPropertyId = Number(searchPropertyId) || numericPropertyId;
  const { data: _rData } = useListRooms(
    { propertyId: numericPropertyId },
    {
      query: {
        queryKey: ["listRooms", numericPropertyId],
        enabled: !!numericPropertyId,
      } as any,
    },
  );
  const rooms: any[] = Array.isArray(_rData)
    ? _rData
    : ((_rData as any)?.data as any[]) || [];
  const { data: _requestRoomsWrapper } = useListRooms(
    { propertyId: requestPropertyId },
    {
      query: {
        queryKey: ["listRooms", requestPropertyId],
        enabled: !!requestPropertyId && requestPropertyId !== numericPropertyId,
      } as any,
    },
  );
  const requestRooms: any[] = Array.isArray(_requestRoomsWrapper)
    ? _requestRoomsWrapper
    : ((_requestRoomsWrapper as any)?.data as any[]) || [];
  const { data: _eDataWrapper } = useAllRows(
    "/api/profiles",
    { propertyId: numericPropertyId ?? undefined },
    { enabled: !!numericPropertyId },
  );
  const profiles: any[] = Array.isArray(_eDataWrapper)
    ? _eDataWrapper
    : ((_eDataWrapper as any)?.profiles as any[]) ||
      ((_eDataWrapper as any)?.data as any[]) ||
      [];
  const { data: settings } = useGetSettings(
    { propertyId: numericPropertyId },
    {
      query: {
        queryKey: ["getSettings", numericPropertyId],
        enabled: !!numericPropertyId,
      } as any,
    },
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["listHostings"] });
    queryClient.invalidateQueries({
      queryKey: getListHostingsQueryKey({ propertyId: numericPropertyId }),
    });
  };

  const createMutation = useCreateHosting({
    mutation: {
      onSuccess: (_data, variables: any) => {
        const createdPropertyId =
          Number(variables?.data?.propertyId) || numericPropertyId;
        queryClient.invalidateQueries({ queryKey: ["listHostings"] });
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

  /* Cross-property profile search */
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
          `/api/profiles/search?q=${encodeURIComponent(empSearch.trim())}&propertyId=${requestPropertyId}`,
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

  const selectProfile = (emp: ProfileResult) => {
    setSelectedProfile(emp);
    setEmpSearch(`${emp.firstName} ${emp.lastName} (${emp.profileId})`);
    setShowDropdown(false);
  };

  const clearProfile = () => {
    setSelectedProfile(null);
    setEmpSearch("");
    setEmpResults([]);
  };

  const resetAndClose = () => {
    setIsOpen(false);
    setSelectedProfile(null);
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
    if (!selectedProfile) {
      toast.error(ar ? "الرجاء اختيار موظف" : "Please select an profile");
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

    if (
      new Date(form.expectedTo).getTime() <
      new Date(form.expectedFrom).getTime()
    ) {
      toast.error(
        ar
          ? "تاريخ نهاية الاستضافة يجب أن يكون بعد تاريخ البداية"
          : "Expected end date must be on or after expected start date",
      );
      return;
    }

    if (form.hostingType === "SEPARATE_ROOM" && !formRoomId) {
      toast.error(
        ar
          ? "الرجاء اختيار غرفة للاستضافة المنفصلة"
          : "Please select a room for separate room hosting",
      );
      return;
    }

    if (formRoomId) {
      const selectedRoom = (rooms as any[]).find(
        (r) => r.id === parseInt(formRoomId),
      );
      if (selectedRoom) {
        const totalGuests = Math.max(1, validCompanions.length || 1);
        if (totalGuests > (selectedRoom.capacity || 1)) {
          toast.error(
            ar
              ? `عدد الضيوف والمرافقين (${totalGuests}) يتجاوز سعة الغرفة (${selectedRoom.capacity} أفراد)`
              : `Total guests (${totalGuests}) exceeds room capacity (${selectedRoom.capacity})`,
          );
          return;
        }
      }
    }

    const fromTime = new Date(form.expectedFrom).getTime();
    const toTime = new Date(form.expectedTo).getTime();
    const existingActive = (hostings as any[]).find(
      (h) =>
        h.profileId === selectedProfile.id &&
        ["PENDING", "APPROVED", "CHECKED_IN"].includes(h.status) &&
        new Date(h.expectedFrom).getTime() <= toTime &&
        new Date(h.expectedTo).getTime() >= fromTime,
    );
    if (existingActive) {
      toast.error(
        ar
          ? `يوجد طلب استضافة نشط لهذا الموظف في نفس الفترة (طلب #${existingActive.id})`
          : `Active hosting already exists for this profile in the same period (Hosting #${existingActive.id})`,
      );
      return;
    }

    createMutation.mutate({
      data: {
        propertyId: requestPropertyId!,
        profileId: selectedProfile.id,
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

  // We already excluded PENDING in the API call
  const pagedHostings = hostings;
  const roomMap = Object.fromEntries((rooms as any[]).map((r) => [r.id, r]));
  const profileMap = Object.fromEntries(
    (profiles as any[]).map((e) => [e.id, e]),
  );

  const pagedHostIds = pagedHostings.map((h: any) => h.id);
  const allHostPageSelected =
    pagedHostIds.length > 0 &&
    pagedHostIds.every((id: any) => selectedRows.has(id));
  const toggleSelectAllHost = () => {
    if (allHostPageSelected) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedHostIds.forEach((id: any) => next.delete(id));
        return next;
      });
    } else {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedHostIds.forEach((id: any) => next.add(id));
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

  const dateText = (value: string | null | undefined) => formatDate(value);

  const getHostProfile = (h: any) =>
    h.profile ?? profileMap[h.profileId] ?? null;
  const getHostName = (h: any) => {
    const emp = getHostProfile(h);
    const name = emp
      ? `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim()
      : "";
    return name || `#${h.profileId}`;
  };
  const getHostCode = (h: any) =>
    getHostProfile(h)?.profileId ?? `#${h.profileId}`;
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
        "Profile Code": getHostCode(h),
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
        From: formatDate(h.expectedFrom, ""),
        To: formatDate(h.expectedTo, ""),
        Status: h.status,
      };
    });
    exportExcel("Guest_Hosting", rows, {
      sheetName: ar ? "الاستضافات" : "GuestHosting",
      orientation: "landscape",
    });
  };

  const HOSTING_COLS = [
    {
      key: "host",
      label: "Host Profile",
      labelAr: "الموظف المستضيف",
      defaultVisible: true,
    },
    {
      key: "profileCode",
      label: "Profile Code",
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
    hostProfile: any,
    room: any,
    companions: any[],
  ) => {
    const activeProp = properties.find((p) => p.id === activePropertyId);
    const propName = activeProp?.name ?? "";

    const empName = ar
      ? hostProfile
        ? `${hostProfile.firstNameAr || hostProfile.firstName} ${hostProfile.lastNameAr || hostProfile.lastName}`
        : "—"
      : hostProfile
        ? `${hostProfile.firstName} ${hostProfile.lastName}`
        : "—";

    const hostDept = ar
      ? hostProfile?.departmentAr || hostProfile?.department || "—"
      : hostProfile?.department || "—";

    const hostJob = ar
      ? hostProfile?.jobTitleAr || hostProfile?.jobTitle || "—"
      : hostProfile?.jobTitle || "—";

    const roomText = [
      room?.buildingName,
      room?.floorNumber != null
        ? ar
          ? `الطابق ${room.floorNumber}`
          : `Floor ${room.floorNumber}`
        : "",
    ]
      .filter(Boolean)
      .join(" — ");

    const infoGridHtml = `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; background: #fafbfc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
        <div>
          <div style="font-size: 7.5pt; color: #64748b; font-weight: 700;">${ar ? "الموظف المستضيف" : "Host Employee"}</div>
          <div style="font-size: 9pt; font-weight: 800; color: #0f2a44;">${escapeHtml(empName)} (${escapeHtml(hostProfile?.profileId || "—")})</div>
        </div>
        <div>
          <div style="font-size: 7.5pt; color: #64748b; font-weight: 700;">${ar ? "القسم / الوظيفة" : "Department / Job"}</div>
          <div style="font-size: 9pt; font-weight: 700; color: #0f2a44;">${escapeHtml(hostDept)} / ${escapeHtml(hostJob)}</div>
        </div>
        <div>
          <div style="font-size: 7.5pt; color: #64748b; font-weight: 700;">${ar ? "الغرفة المخصصة" : "Assigned Room"}</div>
          <div style="font-size: 9pt; font-weight: 700; color: #0f2a44;">${escapeHtml(room?.roomNumber || "—")} (${escapeHtml(roomText || "—")})</div>
        </div>
        <div>
          <div style="font-size: 7.5pt; color: #64748b; font-weight: 700;">${ar ? "نوع الاستضافة" : "Hosting Type"}</div>
          <div style="font-size: 9pt; font-weight: 700; color: #0f2a44;">${escapeHtml(hosting.hostingType || (ar ? "زيارة عائلية" : "Family Visit"))}</div>
        </div>
        <div>
          <div style="font-size: 7.5pt; color: #64748b; font-weight: 700;">${ar ? "تاريخ الدخول" : "Check-In"}</div>
          <div style="font-size: 9pt; font-weight: 700; color: #0f2a44;">${escapeHtml(formatDate(hosting.expectedFrom))}</div>
        </div>
        <div>
          <div style="font-size: 7.5pt; color: #64748b; font-weight: 700;">${ar ? "تاريخ المغادرة" : "Check-Out"}</div>
          <div style="font-size: 9pt; font-weight: 700; color: #0f2a44;">${escapeHtml(formatDate(hosting.expectedTo))}</div>
        </div>
      </div>
      ${
        hosting.notes
          ? `
        <div style="margin-bottom: 14px; padding: 10px 14px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; font-size: 8pt;">
          <strong style="color: #b45309;">${ar ? "ملاحظات الاستضافة:" : "Hosting Notes:"}</strong> ${escapeHtml(hosting.notes)}
        </div>
      `
          : ""
      }
    `;

    const compRows = (companions || []).map((c, i) => ({
      "#": i + 1,
      [ar ? "الاسم" : "Name"]: c.name || "—",
      [ar ? "الفئة" : "Type"]:
        c.isChild === 1 ? (ar ? "طفل" : "Child") : ar ? "بالغ" : "Adult",
      [ar ? "صلة القرابة" : "Relationship"]: c.relation || "—",
      [ar ? "رقم الهوية / الجواز" : "ID / Passport"]: c.idNumber || "—",
      [ar ? "نوع الوثيقة" : "Doc Type"]: c.documentType || "—",
      [ar ? "العمر" : "Age"]: c.isChild === 1 && c.age ? String(c.age) : "—",
    }));

    await printLuxuryReport({
      activeTab: "hostings",
      title: ar
        ? "ملف استضافة الضيوف والمرافقين المعتمد"
        : "Certified Guest & Companion Hosting Dossier",
      language: ar ? "ar" : "en",
      properties,
      activePropertyId,
      settings,
      customSectionsHtml: infoGridHtml,
      rows:
        compRows.length > 0
          ? compRows
          : [
              {
                "#": 1,
                [ar ? "الاسم" : "Name"]: hosting.guestName || "—",
                [ar ? "الفئة" : "Type"]: ar ? "الضيف الرئيسي" : "Primary Guest",
                [ar ? "صلة القرابة" : "Relationship"]: hosting.relation || "—",
                [ar ? "رقم الهوية / الجواز" : "ID / Passport"]:
                  hosting.guestId || "—",
                [ar ? "نوع الوثيقة" : "Doc Type"]: hosting.idType || "—",
                [ar ? "العمر" : "Age"]: "—",
              },
            ],
      kpiCards: [
        {
          label: "Total Guests",
          labelAr: "إجمالي الضيوف",
          value: hosting.guestsCount || (companions?.length || 0) + 1,
          color: "gold",
        },
        {
          label: "Daily Rate",
          labelAr: "سعر الليلة",
          value: `${hosting.dailyRate || 0} EGP`,
          color: "blue",
        },
        {
          label: "Total Fee",
          labelAr: "الإجمالي المستحق",
          value: `${hosting.totalAmount || 0} EGP`,
          color: "green",
        },
        {
          label: "Status",
          labelAr: "حالة الطلب",
          value: hosting.status || (ar ? "معتمد" : "Approved"),
          color: "purple",
        },
      ],
      orientation: "portrait",
    });
  };
  return {
    activePropertyId,
    properties,
    setActivePropertyId,
    language,
    queryClient,
    user,
    isSystemAdmin,
    can,
    ar,
    isOpen,
    setIsOpen,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    companions,
    setCompanions,
    profileEmpId,
    setProfileEmpId,
    editDialog,
    setEditDialog,
    editForm,
    setEditForm,
    roomSearch,
    setRoomSearch,
    formRoomId,
    setFormRoomId,
    companionsDetailHostingId,
    setCompanionsDetailHostingId,
    companionCache,
    setCompanionCache,
    lightboxSrc,
    setLightboxSrc,
    lightboxName,
    setLightboxName,
    keyPromptOpen,
    setKeyPromptOpen,
    selectedHostingKey,
    setSelectedHostingKey,
    keyPromptRoomId,
    setKeyPromptRoomId,
    keyIssuing,
    setKeyIssuing,
    empSearch,
    setEmpSearch,
    empResults,
    setEmpResults,
    selectedProfile,
    setSelectedProfile,
    isSearching,
    setIsSearching,
    showDropdown,
    setShowDropdown,
    searchPropertyId,
    setSearchPropertyId,
    searchRef,
    debounceRef,
    form,
    setForm,
    _hWrapper,
    isLoading,
    isError,
    refetch,
    numericPropertyId,
    hostings,
    paginationTotal,
    requestPropertyId,
    _rData,
    rooms,
    _requestRoomsWrapper,
    requestRooms,
    _eDataWrapper,
    profiles,
    settings,
    modalRooms,
    availableFormRooms,
    filteredFormRooms,
    availableEditRooms,
    filteredEditRooms,
    invalidate,
    createMutation,
    approveMutation,
    checkinMutation,
    checkoutMutation,
    deleteMutation,
    updateMutation,
    openEdit,
    handleUpdate,
    selectProfile,
    clearProfile,
    resetAndClose,
    addCompanion,
    removeCompanion,
    updateCompanion,
    uploadCompanionDocument,
    onSubmit,
    selectedRows,
    setSelectedRows,
    pagedHostings,
    roomMap,
    profileMap,
    pagedHostIds,
    allHostPageSelected,
    toggleSelectAllHost,
    toggleHostRow,
    dateText,
    getHostProfile,
    getHostName,
    getHostCode,
    getCompanions,
    getAdultsCount,
    getChildrenCount,
    getGuestNames,
    getGuestRelations,
    getGuestDocs,
    getRoom,
    getRoomNumber,
    guestProfileLines,
    exportHostExcel,
    HOSTING_COLS,
    hVisible,
    hToggle,
    hShowAll,
    hHideAll,
    isHVisible,
    exportGuestProfilePdf,
  };
}

export type GuestHostingState = ReturnType<typeof useGuestHostingState>;
