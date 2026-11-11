import { recommendBestRooms } from "@/lib/room-recommender";
import { matchesSearch } from "@/lib/search-utils";
import { PolicyExceptionApprovalModal } from "@/components/PolicyExceptionApprovalModal";
import { useState, useEffect, useMemo } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useListReservations,
  useCreateReservation,
  useDeleteReservation,
  useUpdateReservation,
  useListRooms,
  useListBuildings,
  useListFloors,
  useListProperties,
  useListAssignments,
  useCreateAssignment,
  useListProfiles,
  useGetSettings,
  getListReservationsQueryKey,
  getListRoomsQueryKey,
  getListAssignmentsQueryKey,
  getListProfilesQueryKey,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/ui/permission-gate";
import { useColumnVisibility } from "@/components/ui/column-chooser";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { DataPagination } from "@/components/DataPagination";
import { generateHousingLetterPdf } from "@/lib/pdf-utils";
import {
  usePrintLanguage,
  PrintLanguageDialog,
} from "@/lib/PrintLanguageDialog";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import { formatDate } from "@/lib/date-utils";
import { exportExcel } from "@/pages/reports/utils/export";
import { Plus, CalendarDays } from "lucide-react";
import { usePermission } from "@/hooks/use-permission";
import { useCheckDuplicates } from "@/hooks/use-check-duplicates";
import { getBedOptions } from "../shared/profile-search";
import type {
  CancelDialogState,
  EditDialogState,
  EditFormState,
  WhatsAppDialogState,
} from "./types";
import {
  RES_COLS,
  getStatusLabel,
  statusColor,
  isRoomBookable,
  makeEmptyNewForm,
} from "./utils";
import { useNewProfileForm } from "./hooks/useNewProfileForm";
import { useProfileSearch } from "./hooks/useProfileSearch";
import { useRoomOccupancy } from "./hooks/useRoomOccupancy";
import { useReservationCheckin } from "./hooks/useReservationCheckin";
import { ReservationsToolbar } from "./components/ReservationsToolbar";
import { ReservationsTable } from "./components/ReservationsTable";
import { NewReservationDialog } from "./components/NewReservationDialog";
import { WizardStepMode } from "./components/WizardStepMode";
import { WizardStepExistingProfile } from "./components/WizardStepExistingProfile";
import { WizardStepNewProfile } from "./components/WizardStepNewProfile";
import { WizardStepRoomSelection } from "./components/WizardStepRoomSelection";
import { CheckinDialog } from "./components/CheckinDialog";
import { WhatsAppConfirmationDialog } from "./components/WhatsAppConfirmationDialog";
import { EditReservationDialog } from "./components/EditReservationDialog";
import { CancelReservationDialog } from "./components/CancelReservationDialog";
import { DeleteReservationDialog } from "./components/DeleteReservationDialog";
import { KeyPromptDialog } from "./components/KeyPromptDialog";
import { CrossPropertyConfirmDialog } from "./components/CrossPropertyConfirmDialog";

export default function ReservationsPage() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const { isSystemAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const ar = language === "ar";

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("UPCOMING");
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(h);
  }, [search]);
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    reservation: null,
  });
  const [editForm, setEditForm] = useState<EditFormState>({
    checkInDate: "",
    checkOutDate: "",
    notes: "",
    firstName: "",
    lastName: "",
    department: "",
    jobTitle: "",
    nationality: "",
    gender: "",
    profileCode: "",
    level: "",
    guestIdCardNumber: "",
    guestPhone: "",
    roomType: "",
    employmentType: "INTERNAL",
    companyName: "",
    roomId: "",
    bedNumber: "",
  });
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState>({
    open: false,
    reservation: null,
    reason: "",
  });
  const [editBuildingId, setEditBuildingId] = useState<string>("all");
  const [editRoomSearch, setEditRoomSearch] = useState<string>("");
  const [showEditRoomPicker, setShowEditRoomPicker] = useState<boolean>(false);
  const [keyPromptOpen, setKeyPromptOpen] = useState(false);
  const [lastAssignment, setLastAssignment] = useState<any>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // WhatsApp reservation confirmation dialog state
  const [whatsAppDialog, setWhatsAppDialog] = useState<WhatsAppDialogState>({
    open: false,
    reservation: null,
  });
  const [whatsAppPhone, setWhatsAppPhone] = useState("");
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  const handleOpenWhatsAppDialog = (res: any) => {
    setWhatsAppPhone(res.guestPhone || "");
    setWhatsAppDialog({
      open: true,
      reservation: res,
    });
  };

  const handleSendWhatsAppConfirmation = async () => {
    if (!whatsAppDialog.reservation?.id) return;
    if (!whatsAppPhone.trim()) {
      toast.error(
        ar
          ? "يرجى إدخال رقم هاتف الواتساب للنزيل"
          : "Please enter a valid WhatsApp phone number",
      );
      return;
    }
    setIsSendingWhatsApp(true);
    try {
      const res = await fetch(
        `/api/reservations/${whatsAppDialog.reservation.id}/send-whatsapp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            propertyId: activePropertyId,
            phone: whatsAppPhone.trim(),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(
          data.error ||
            (ar
              ? "فشل إرسال رسالة الواتساب"
              : "Failed to send WhatsApp message"),
        );
      }
      toast.success(
        ar
          ? `تم إرسال تأكيد الحجز عبر الواتساب بنجاح إلى الرقم (${whatsAppPhone.trim()})`
          : `Reservation confirmation sent successfully to (${whatsAppPhone.trim()})`,
      );
      setWhatsAppDialog({ open: false, reservation: null });
      queryClient.invalidateQueries({
        queryKey: getListReservationsQueryKey(),
      });
    } catch (err: any) {
      toast.error(
        err.message || (ar ? "حدث خطأ أثناء الإرسال" : "Error sending message"),
      );
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [personMode, setPersonMode] = useState<"existing" | "new" | null>(null);
  const [expectedCheckOut, setExpectedCheckOut] = useState("");
  const {
    selectedProfile,
    setSelectedProfile,
    empSearch,
    setEmpSearch,
    empResults,
    isSearching,
    showDropdown,
    searchPropertyId,
    setSearchPropertyId,
    searchRef,
    selectProfile,
    clearProfile,
  } = useProfileSearch({
    activePropertyId,
    onProfileSelected: (emp) => {
      // Auto-populate expected checkout date from contract end date for internal employee
      if (emp.employmentType !== "THIRD_PARTY" && emp.contractEndDate) {
        setExpectedCheckOut(emp.contractEndDate.split("T")[0]);
      }
    },
  });

  const [transferType, setTransferType] = useState<"PERMANENT" | "TASK_FORCE">(
    "PERMANENT",
  );
  const [archiveSourceProfile, setArchiveSourceProfile] =
    useState<boolean>(true);
  const [crossPropertyModalOpen, setCrossPropertyModalOpen] =
    useState<boolean>(false);

  const {
    newForm,
    setNewForm,
    photoPreview,
    photoData,
    photoRef,
    docsRef,
    handlePhotoSelect,
    clearPhoto,
    handleDocSelect,
    removeDoc,
  } = useNewProfileForm(ar);

  const [bookingType, setBookingType] = useState<"direct" | "upcoming">(
    "direct",
  );
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedBed, setSelectedBed] = useState("");
  const [checkInDate, setCheckInDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");
  const [searchBuilding, setSearchBuilding] = useState("all");
  const [searchFloor, setSearchFloor] = useState("all");
  const [searchRoomNumber, setSearchRoomNumber] = useState("");

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const qRoom = sp.get("roomId");
      const qBed = sp.get("bed");
      const qBooking = sp.get("bookingType");
      const qPerson = sp.get("personMode");
      if (qRoom || qBooking || qPerson) {
        if (qRoom) setSelectedRoomId(qRoom);
        if (qBed) setSelectedBed(qBed);
        if (qBooking === "upcoming") {
          setBookingType("upcoming");
        } else {
          setBookingType("direct");
        }
        if (qPerson === "new") {
          setPersonMode("new");
          setNewForm((f) => ({ ...f, employmentType: "THIRD_PARTY" }));
          setStep(2);
        } else if (qPerson === "existing") {
          setPersonMode("existing");
          setStep(2);
        } else {
          setStep(1);
        }
        setNewDialogOpen(true);
      }
    } catch {}
  }, []);

  const { langDialogOpen, openDialog, handleSelect, handleCancel } =
    usePrintLanguage();
  const currentPropId =
    typeof activePropertyId === "number" ? activePropertyId : undefined;

  const { data: _resWrapper, isLoading } = useListReservations(
    {
      propertyId: currentPropId,
      page: currentPage,
      limit: pageSize,
      search: debouncedSearch,
      status: statusFilter === "all" ? undefined : statusFilter,
    } as any,
    {
      query: {
        queryKey: [
          "listReservations",
          currentPropId,
          currentPage,
          pageSize,
          debouncedSearch,
          statusFilter,
        ],
        enabled: !!currentPropId,
        staleTime: 0,
        placeholderData: (prev: any) => prev,
      },
    },
  );
  const reservations: any[] =
    (_resWrapper as any)?.data ||
    (Array.isArray(_resWrapper) ? _resWrapper : []);
  const paginationTotal = (_resWrapper as any)?.pagination?.total || 0;

  const { data: _rData } = useListRooms(
    { propertyId: currentPropId, limit: 1000 } as any,
    {
      query: {
        queryKey: ["/api/rooms", currentPropId],
        enabled: !!currentPropId,
        staleTime: 30000,
      } as any,
    },
  );
  const rooms: any[] = Array.isArray(_rData)
    ? _rData
    : (_rData as any)?.data || [];

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const qRoom = sp.get("roomId");
      if (qRoom && rooms.length > 0) {
        const rm = rooms.find((r: any) => String(r.id) === String(qRoom));
        if (rm) {
          const bId = rm.buildingId ?? (rm as any).building_id;
          const fId = rm.floorId ?? (rm as any).floor_id;
          const rNum = rm.roomNumber ?? (rm as any).room_number;
          if (bId != null) setSearchBuilding(String(bId));
          if (fId != null) setSearchFloor(String(fId));
          if (rNum != null) setSearchRoomNumber(String(rNum));
        }
      }
    } catch {}
  }, [rooms]);
  const { data: _bData } = useListBuildings(
    { propertyId: currentPropId } as any,
    {
      query: {
        queryKey: ["/api/buildings", currentPropId],
        enabled: !!currentPropId,
        staleTime: 300000,
      } as any,
    },
  );
  const buildings: any[] = Array.isArray(_bData)
    ? _bData
    : (_bData as any)?.data || [];
  const { data: _fData } = useListFloors({ propertyId: currentPropId } as any, {
    query: {
      queryKey: ["/api/floors", currentPropId],
      enabled: !!currentPropId,
      staleTime: 300000,
    } as any,
  });
  const floors = Array.isArray(_fData)
    ? _fData
    : ((_fData as any)?.data as any[]) || [];

  const roomMap = useMemo(() => {
    const map = new Map<number, any>();
    for (const r of rooms) map.set(Number(r.id), r);
    return map;
  }, [rooms]);

  const { data: _profData } = useListProfiles(
    { propertyId: currentPropId, limit: 1000 } as any,
    {
      query: {
        queryKey: ["/api/profiles", currentPropId],
        enabled: !!currentPropId,
        staleTime: 60000,
      } as any,
    },
  );
  const profilesList =
    (_profData as any)?.profiles || (_profData as any)?.data || [];

  const { data: settings } = useGetSettings(undefined, {
    query: {
      queryKey: ["/api/settings"],
      enabled: !!activePropertyId,
    },
  });

  const { isSuperAdmin, isAdmin, hasRole, can } = usePermission();
  const canOverrideSingleOccupancy = Boolean(
    isSuperAdmin ||
    isAdmin ||
    (typeof hasRole === "function" &&
      (hasRole("super_admin") ||
        hasRole("admin") ||
        hasRole("housing_manager") ||
        hasRole("manager"))) ||
    (typeof can === "function" &&
      (can("reservations", "override_single_occupancy") ||
        can("accommodation", "override_single_occupancy"))),
  );

  const { data: _aData } = useListAssignments(
    { propertyId: currentPropId, limit: 5000 } as any,
    {
      query: {
        queryKey: ["/api/assignments", currentPropId],
        enabled: !!currentPropId,
        staleTime: 30000,
      } as any,
    },
  );
  const allAssignments = Array.isArray(_aData)
    ? _aData
    : ((_aData as any)?.data as any[]) || [];

  const { data: _pData } = useListProperties();
  const allProperties: any[] = Array.isArray(_pData)
    ? _pData
    : (_pData as any)?.data || [];

  const activeProp = allProperties.find((p: any) => p.id === activePropertyId);

  const isCrossProperty = Boolean(
    personMode === "existing" &&
    selectedProfile &&
    activePropertyId &&
    ((selectedProfile.propertyId &&
      Number(selectedProfile.propertyId) !== Number(activePropertyId)) ||
      (selectedProfile.propertyName &&
        activeProp?.name &&
        selectedProfile.propertyName.trim().toLowerCase() !==
          activeProp?.name.trim().toLowerCase())),
  );
  const { data: departmentValues = [] } = useLookupValues(
    currentPropId,
    LOOKUP_CATEGORIES.DEPARTMENT,
  );
  const { data: jobTitleValues = [] } = useLookupValues(
    currentPropId,
    LOOKUP_CATEGORIES.JOB_TITLE,
  );
  const { data: nationalityValues = [] } = useLookupValues(
    currentPropId,
    LOOKUP_CATEGORIES.NATIONALITY,
  );

  const buildingMap = Object.fromEntries(
    buildings.map((b: any) => [b.id, b.name]),
  );
  const floorMap = Object.fromEntries(
    floors.map((f) => [f.id, { name: f.name, number: f.floorNumber }]),
  );

  const filteredJobTitles = useMemo(() => {
    if (!newForm.department || newForm.department === "none")
      return jobTitleValues;
    return jobTitleValues.filter(
      (t: any) => !t.parentValue || t.parentValue === newForm.department,
    );
  }, [jobTitleValues, newForm.department]);

  const filteredEditJobTitles = useMemo(() => {
    if (!editForm.department || editForm.department === "none")
      return jobTitleValues;
    return jobTitleValues.filter(
      (t: any) => !t.parentValue || t.parentValue === editForm.department,
    );
  }, [jobTitleValues, editForm.department]);

  const {
    entireRoomOccupiedSet,
    singleOccupantRoomsMap,
    selectedRoomBedMap,
    occupiedBeds,
  } = useRoomOccupancy({ rooms, allAssignments, selectedRoomId, ar });

  const availableRooms = rooms.filter((r: any) => isRoomBookable(r));

  const filteredRooms = availableRooms.filter((r: any) => {
    const bId = r.buildingId ?? r.building_id;
    const fId = r.floorId ?? r.floor_id;
    if (searchBuilding !== "all" && String(bId) !== String(searchBuilding))
      return false;
    if (searchFloor !== "all" && String(fId) !== String(searchFloor))
      return false;
    if (searchRoomNumber.trim()) {
      if (
        !matchesSearch(
          [r.roomNumber, r.roomType, r.bedType, r.features],
          searchRoomNumber,
        )
      ) {
        return false;
      }
    }
    return true;
  });

  const profileForRecommend =
    selectedProfile ||
    (personMode === "new" && newForm.firstName
      ? {
          level: newForm.level,
          gender: newForm.gender,
          department: newForm.department,
          employmentType: newForm.employmentType,
          jobTitle: newForm.jobTitle,
        }
      : null);
  const recommendation = useMemo(() => {
    if (!profileForRecommend || !rooms.length) return null;
    return recommendBestRooms({
      profile: profileForRecommend,
      rooms,
      assignments: allAssignments,
      profiles: profilesList,
      policySettings: settings,
    });
  }, [profileForRecommend, rooms, allAssignments, profilesList, settings]);

  // Auto-Select best compliant room based on level and department
  useEffect(() => {
    if (profileForRecommend && recommendation?.bestRoom && !selectedRoomId) {
      setSelectedRoomId(String(recommendation.bestRoom.id));
      const r = recommendation.bestRoom;
      const opts = getBedOptions(r.roomType, r.capacity);
      if (opts.length > 0) {
        setSelectedBed(String(opts[0]));
      }
    }
  }, [profileForRecommend, recommendation?.bestRoom?.id, selectedRoomId]);

  const sortedFilteredRooms = useMemo(() => {
    return [...filteredRooms].sort((a: any, b: any) => {
      const aOcc = a.currentOccupancy ?? 0;
      const aCap = a.capacity ?? 1;
      const aFull = aOcc >= aCap || entireRoomOccupiedSet.has(a.id);

      const bOcc = b.currentOccupancy ?? 0;
      const bCap = b.capacity ?? 1;
      const bFull = bOcc >= bCap || entireRoomOccupiedSet.has(b.id);

      // Available (non-full) rooms first, full rooms at the end
      if (aFull !== bFull) return aFull ? 1 : -1;

      // If recommendation exists and both rooms have open spots, sort by score
      if (recommendation && !aFull && !bFull) {
        const scoreA = recommendation.recommendedMap[a.id]?.score ?? 0;
        const scoreB = recommendation.recommendedMap[b.id]?.score ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
      }

      // Default room number numeric sort
      return String(a.roomNumber || "").localeCompare(
        String(b.roomNumber || ""),
        undefined,
        { numeric: true },
      );
    });
  }, [filteredRooms, recommendation, entireRoomOccupiedSet]);

  const selectedRoom = rooms.find(
    (r: any) => r.id === parseInt(selectedRoomId),
  );
  const bedOptions = selectedRoom
    ? getBedOptions(selectedRoom.roomType, selectedRoom.capacity)
    : [];
  const isMultiBed = bedOptions.length > 1;

  const invalidate = () => {
    const numPropId =
      typeof activePropertyId === "number" ? activePropertyId : undefined;
    queryClient.invalidateQueries({ queryKey: ["listReservations"] });
    queryClient.invalidateQueries({
      queryKey: getListReservationsQueryKey({ propertyId: numPropId }),
    });
    queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
    queryClient.invalidateQueries({
      queryKey: getListRoomsQueryKey({ propertyId: numPropId }),
    });
    queryClient.invalidateQueries({
      queryKey: getListAssignmentsQueryKey({ propertyId: numPropId }),
    });
    queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/assignments/in-house"] });
    queryClient.invalidateQueries({
      queryKey: getListProfilesQueryKey({ propertyId: numPropId }),
    });
    queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  };

  const createReservationMutation = useCreateReservation({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(
          ar ? "تم إنشاء الحجز بنجاح" : "Reservation created successfully",
        );
        closeNewDialog();
      },
      onError: (e: any) =>
        toast.error(e?.data?.error || e?.message || (ar ? "خطأ" : "Error")),
    },
  });

  const createAssignmentMutation = useCreateAssignment({
    mutation: {
      onSuccess: (data: any) => {
        invalidate();
        toast.success(
          ar ? "تم التسكين بنجاح" : "Assignment created successfully",
        );
        setLastAssignment(data);
        setKeyPromptOpen(true);
        closeNewDialog();
      },
      onError: async (err: any) => {
        let msg = err.message;
        try {
          const b =
            err?.data ||
            (await err?.response
              ?.clone?.()
              ?.json?.()
              .catch(() => null)) ||
            {};
          if (b?.code === "BED_TAKEN")
            msg = ar ? "هذا السرير مشغول بالفعل." : "Bed is taken.";
          else if (b?.code === "PROFILE_ALREADY_ASSIGNED")
            msg = ar
              ? "الموظف مسكّن بالفعل في غرفة أخرى."
              : "Already assigned.";
          else if (b?.code === "ROOM_FULL")
            msg = ar ? "الغرفة ممتلئة بالكامل." : "Room is full.";
          else if (b?.error) msg = b.error;
        } catch {}
        toast.error(msg || (ar ? "خطأ" : "Error"));
      },
    },
  });

  const deleteMutation = useDeleteReservation({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم الحذف بنجاح" : "Deleted successfully");
        setDeleteId(null);
      },
      onError: (e: any) => {
        toast.error(
          e?.data?.error ||
            e?.message ||
            (ar ? "فشل الحذف" : "Failed to delete"),
        );
      },
    },
  });

  const {
    checkinDialog,
    setCheckinDialog,
    checkinRoomId,
    setCheckinRoomId,
    checkinRoomSearch,
    setCheckinRoomSearch,
    resPolicyModal,
    setResPolicyModal,
    checkinRecommendations,
    filteredCheckinRooms,
    checkinMutation,
    handleStartCheckin,
    handleCheckin,
  } = useReservationCheckin({
    ar,
    activePropertyId,
    rooms,
    allAssignments,
    profilesList,
    settings,
    invalidate,
    setSelectedProfile,
    setLastAssignment,
    setKeyPromptOpen,
    setSelectedRows,
  });

  const updateMutation = useUpdateReservation({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم التحديث بنجاح" : "Updated successfully");
        setEditDialog({ open: false, reservation: null });
      },
      onError: (e: any) => toast.error(e.message || (ar ? "خطأ" : "Error")),
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => {
      const url =
        activePropertyId && activePropertyId !== "all"
          ? `/api/reservations/${id}/cancel?propertyId=${activePropertyId}`
          : `/api/reservations/${id}/cancel`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          d.error || (ar ? "فشل إلغاء الحجز" : "Failed to cancel reservation"),
        );
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.success(
        ar ? "تم إلغاء الحجز بنجاح" : "Reservation cancelled successfully",
      );
      setCancelDialog({ open: false, reservation: null, reason: "" });
      setEditDialog({ open: false, reservation: null });
    },
    onError: (err: any) => {
      toast.error(
        err.message ||
          (ar ? "فشل إلغاء الحجز" : "Failed to cancel reservation"),
      );
    },
  });

  const openNewDialog = () => {
    setStep(1);
    setPersonMode(null);
    setSelectedProfile(null);
    setEmpSearch("");
    setNewForm(makeEmptyNewForm());
    clearPhoto();
    setBookingType("direct");
    setSelectedRoomId("");
    setSelectedBed("");
    setCheckInDate(new Date().toISOString().split("T")[0]);
    setExpectedCheckOut("");
    setNotes("");
    setSearchBuilding("all");
    setSearchFloor("all");
    setSearchRoomNumber("");
    setNewDialogOpen(true);
  };
  const closeNewDialog = () => {
    setNewDialogOpen(false);
    try {
      if (window.location.search) {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }
    } catch {}
  };

  const { duplicates: resDuplicates, hasDuplicates: resHasDuplicates } =
    useCheckDuplicates({
      profileId: newForm.profileId,
      nationalId: newForm.nationalId,
      phone: newForm.phone,
      enabled: newDialogOpen && personMode === "new" && step === 2,
    });

  const handleSubmit = async () => {
    if (personMode === "new" && resHasDuplicates) {
      toast.error(
        ar
          ? "يرجى تعديل البيانات المكررة قبل المتابعة"
          : "Please resolve duplicate fields before proceeding",
      );
      return;
    }
    if (!selectedRoomId) {
      toast.error(ar ? "الرجاء اختيار غرفة أولاً" : "Please select a room");
      return;
    }
    if (isMultiBed && !selectedBed) {
      toast.error(
        ar
          ? "الرجاء تحديد رقم السرير أو اختيار (الغرفة كاملة)"
          : "Please select bed number or choose Entire Room",
      );
      return;
    }
    if (
      isMultiBed &&
      selectedBed !== "ALL" &&
      occupiedBeds.has(parseInt(selectedBed))
    ) {
      toast.error(
        ar
          ? "السرير المحدد مشغول حالياً بنزيل آخر. لا يمكن اختياره."
          : "The selected bed is currently occupied. Cannot select.",
      );
      return;
    }
    if (
      selectedRoomId &&
      singleOccupantRoomsMap.has(parseInt(selectedRoomId)) &&
      !canOverrideSingleOccupancy
    ) {
      toast.error(
        ar
          ? "هذه الغرفة يشغلها شخص بمفرده وبها أسِرّة شاغرة. تسكين نزيل إضافي مع النزيل يتطلب صلاحية إدارية."
          : "This room is occupied by a single resident. Assigning an additional occupant requires administrative permission.",
      );
      return;
    }
    if (selectedBed === "ALL" && isMultiBed && !canOverrideSingleOccupancy) {
      toast.error(
        ar
          ? "حجز الغرفة متعددة الأسِرّة بالكامل لشخص واحد يتطلب صلاحية إدارية استثنائية."
          : "Reserving an entire multi-bed room requires administrative permission.",
      );
      return;
    }
    if (
      bookingType === "direct" &&
      personMode === "existing" &&
      selectedProfile?.accommodationRoom &&
      !isCrossProperty
    ) {
      toast.error(
        ar
          ? `الموظف (${selectedProfile.firstName} ${selectedProfile.lastName}) مقيم بالفعل بالسكن في غرفة #${selectedProfile.accommodationRoom}. لا يمكن تسكينه مرتين؛ استخدم خيار (نقل الغرفة) لنقله.`
          : `Employee is already residing in Room #${selectedProfile.accommodationRoom}. Use Room Move instead.`,
      );
      return;
    }

    // If cross-property: OPEN THE EXPLICIT CONFIRMATION MODAL TO ASK THE USER DIRECTLY!
    if (isCrossProperty) {
      setCrossPropertyModalOpen(true);
      return;
    }

    executeSubmission();
  };

  const executeSubmission = async (archiveOverride?: boolean) => {
    const finalArchive =
      archiveOverride !== undefined ? archiveOverride : archiveSourceProfile;
    const finalTransferType = finalArchive ? "PERMANENT" : "TASK_FORCE";

    // Effective Checkout: if not entered, pull contractEndDate for internal employees
    const effectiveCheckOut =
      expectedCheckOut ||
      (personMode === "existing" &&
      selectedProfile?.employmentType !== "THIRD_PARTY"
        ? selectedProfile?.contractEndDate
        : newForm.employmentType !== "THIRD_PARTY"
          ? newForm.contractEndDate
          : undefined) ||
      undefined;

    const reservationNotes =
      selectedBed === "ALL"
        ? `[حجز الغرفة بالكامل] ${notes || ""}`.trim()
        : selectedBed
          ? `[سرير رقم: ${selectedBed}] ${notes || ""}`.trim()
          : notes || "";

    const reservationRoomType =
      selectedBed === "ALL"
        ? ar
          ? `الغرفة بالكامل (${selectedRoom?.roomType || ""})`
          : `Entire Room (${selectedRoom?.roomType || ""})`
        : selectedRoom?.roomType || undefined;

    if (personMode === "existing" && selectedProfile) {
      if (bookingType === "direct") {
        createAssignmentMutation.mutate({
          data: {
            propertyId: activePropertyId!,
            profileId: selectedProfile.id,
            roomId: parseInt(selectedRoomId),
            checkInDate: new Date(checkInDate).toISOString(),
            expectedCheckOutDate: effectiveCheckOut
              ? new Date(effectiveCheckOut).toISOString()
              : undefined,
            bedNumber:
              selectedBed === "ALL"
                ? 1
                : selectedBed
                  ? parseInt(selectedBed)
                  : 1,
            isEntireRoom: selectedBed === "ALL",
            notes:
              selectedBed === "ALL"
                ? `[حجز الغرفة بالكامل] ${notes || ""}`.trim()
                : notes || undefined,
            sourcePropertyId: isCrossProperty
              ? selectedProfile.propertyId
              : undefined,
            transferType: isCrossProperty ? finalTransferType : undefined,
            archiveSourceProfile: isCrossProperty ? finalArchive : undefined,
            checkoutPreviousAssignment:
              isCrossProperty && Boolean(selectedProfile.accommodationRoom),
          } as any,
        });
      } else {
        createReservationMutation.mutate({
          data: {
            propertyId: activePropertyId!,
            firstName: selectedProfile.firstName,
            lastName: selectedProfile.lastName,
            guestIdCardNumber:
              selectedProfile.nationalId || selectedProfile.profileId,
            guestPhone: selectedProfile.phone || "",
            department: selectedProfile.department || "",
            jobTitle: selectedProfile.jobTitle || "",
            nationality: selectedProfile.nationality || "",
            gender: selectedProfile.gender || "",
            profileCode: selectedProfile.profileId || "",
            level: selectedProfile.level || "",
            employmentType: selectedProfile.employmentType || "INTERNAL",
            companyName: (selectedProfile as any).companyName || "",
            checkInDate: new Date(checkInDate).toISOString(),
            checkOutDate: effectiveCheckOut
              ? new Date(effectiveCheckOut).toISOString()
              : undefined,
            roomId: parseInt(selectedRoomId),
            bedNumber: selectedBed,
            roomType: reservationRoomType,
            notes: reservationNotes,
          } as any,
        });
      }
    } else if (personMode === "new") {
      try {
        const generatedId =
          newForm.profileId?.trim() ||
          `${newForm.employmentType === "THIRD_PARTY" ? "TP" : "EMP"}-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
        const fullPayload = {
          propertyId: activePropertyId,
          profileId: generatedId,
          firstName: newForm.firstName.trim(),
          lastName: newForm.lastName.trim(),
          thirdName: newForm.thirdName.trim() || "",
          fourthName: newForm.fourthName.trim() || "",
          nationalId: newForm.nationalId.trim(),
          nationality: newForm.nationality || "",
          gender: newForm.gender || "M",
          phone: newForm.phone.trim(),
          dateOfBirth: newForm.dateOfBirth || "",
          address: newForm.address || "",
          hireDate: newForm.hireDate || new Date().toISOString().split("T")[0],
          contractEndDate:
            newForm.employmentType !== "THIRD_PARTY"
              ? newForm.contractEndDate || null
              : null,
          department:
            newForm.department ||
            (newForm.employmentType === "THIRD_PARTY"
              ? ar
                ? "طرف ثالث"
                : "Third Party"
              : ""),
          jobTitle: newForm.jobTitle || "",
          level: newForm.level || "",
          employmentType: newForm.employmentType,
          companyName: newForm.companyName || "",
          status: "UNASSIGNED",
          idDocuments: newForm.idDocuments || [],
        };

        const r = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(fullPayload),
        });

        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || "Failed to create profile");
        }
        const np = await r.json();

        // Switch personMode to existing so if assignment mutation fails, retrying won't duplicate the profile
        setPersonMode("existing");
        setSelectedProfile(np);
        setEmpSearch(`${np.firstName} ${np.lastName}`);

        // Upload photo if selected
        if (photoData && np.id) {
          try {
            await fetch(`/api/profiles/${np.id}/photo`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ photoUrl: photoData }),
            });
          } catch (_) {}
        }

        // Invalidate profiles list so the new profile immediately appears in /profiles
        queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });

        if (bookingType === "direct") {
          createAssignmentMutation.mutate({
            data: {
              propertyId: activePropertyId!,
              profileId: np.id,
              roomId: parseInt(selectedRoomId),
              checkInDate: new Date(checkInDate).toISOString(),
              expectedCheckOutDate: effectiveCheckOut
                ? new Date(effectiveCheckOut).toISOString()
                : undefined,
              bedNumber:
                selectedBed === "ALL"
                  ? 1
                  : selectedBed
                    ? parseInt(selectedBed)
                    : 1,
              isEntireRoom: selectedBed === "ALL",
              notes:
                selectedBed === "ALL"
                  ? `[حجز الغرفة بالكامل] ${notes || ""}`.trim()
                  : notes || undefined,
            } as any,
          });
        } else {
          createReservationMutation.mutate({
            data: {
              propertyId: activePropertyId!,
              firstName: np.firstName,
              lastName: np.lastName,
              guestIdCardNumber: np.nationalId,
              guestPhone: np.phone,
              department: np.department,
              jobTitle: np.jobTitle,
              nationality: np.nationality,
              gender: np.gender,
              profileCode: np.profileId,
              level: np.level,
              employmentType:
                np.employmentType || newForm.employmentType || "THIRD_PARTY",
              companyName: np.companyName || newForm.companyName || "",
              checkInDate: new Date(checkInDate).toISOString(),
              checkOutDate: effectiveCheckOut
                ? new Date(effectiveCheckOut).toISOString()
                : undefined,
              roomId: parseInt(selectedRoomId),
              bedNumber: selectedBed,
              roomType: reservationRoomType,
              notes: reservationNotes,
            } as any,
          });
        }
      } catch (e: any) {
        toast.error(
          e.message ||
            (ar ? "خطأ في إنشاء الملف الشخصي" : "Error creating profile"),
        );
      }
    }
    setCrossPropertyModalOpen(false);
  };

  const filteredEditRooms = useMemo(() => {
    return rooms.filter((r: any) => {
      if (!isRoomBookable(r)) return false;
      if (editBuildingId !== "all" && String(r.buildingId) !== editBuildingId)
        return false;
      if (editRoomSearch.trim()) {
        const q = editRoomSearch.trim().toLowerCase();
        const rNum = String(r.roomNumber || "").toLowerCase();
        const bName = String(buildingMap[r.buildingId] || "").toLowerCase();
        const rType = String(r.roomType || "").toLowerCase();
        if (!rNum.includes(q) && !bName.includes(q) && !rType.includes(q))
          return false;
      }
      return true;
    });
  }, [rooms, editBuildingId, editRoomSearch, buildingMap]);

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
      profileCode: res.profileCode || "",
      level: res.level || "",
      guestIdCardNumber: res.guestIdCardNumber || "",
      guestPhone: res.guestPhone || "",
      roomType: res.roomType || "",
      employmentType: res.employmentType || "INTERNAL",
      companyName: res.companyName || "",
      roomId: res.roomId ? String(res.roomId) : "",
      bedNumber: res.bedNumber ? String(res.bedNumber) : "",
    });
    setEditBuildingId("all");
    setEditRoomSearch("");
    setShowEditRoomPicker(false);
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
        profileCode: editForm.profileCode,
        level: editForm.level,
        guestIdCardNumber: editForm.guestIdCardNumber,
        guestPhone: editForm.guestPhone,
        roomType: editForm.roomType,
        employmentType: editForm.employmentType,
        companyName: editForm.companyName,
        roomId: editForm.roomId ? Number(editForm.roomId) : null,
        bedNumber: editForm.bedNumber || "",
      } as any,
    });
  };

  const statusLabel = getStatusLabel(ar);

  const pagedResIds = (reservations || []).map((r: any) => r.id);
  const allResPageSelected =
    pagedResIds.length > 0 &&
    pagedResIds.every((id: number) => selectedRows.has(id));
  const toggleSelectAllRes = () => {
    if (allResPageSelected) {
      setSelectedRows((p) => {
        const n = new Set(p);
        pagedResIds.forEach((id: number) => n.delete(id));
        return n;
      });
    } else {
      setSelectedRows((p) => {
        const n = new Set(p);
        pagedResIds.forEach((id: number) => n.add(id));
        return n;
      });
    }
  };
  const toggleResRow = (id: number) =>
    setSelectedRows((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const exportResExcel = () => {
    const all = reservations || [];
    const target =
      selectedRows.size > 0
        ? all.filter((r: any) => selectedRows.has(r.id))
        : all;
    const rows = target.map((r: any) => ({
      Guest: `${r.firstName} ${r.lastName}`,
      "Check-in": formatDate(r.checkInDate, ""),
      "Check-out": formatDate(r.checkOutDate, ""),
      Status: r.status,
      Department: r.department ?? "",
      "ID Card": r.guestIdCardNumber ?? "",
    }));
    exportExcel("Reservations", rows, {
      sheetName: ar ? "الحجوزات" : "Reservations",
      orientation: "landscape",
    });
  };

  const printHousingLetter = async (profile: any, assignment: any) => {
    const chosenAr = ar;
    const room = rooms.find(
      (r: any) => r.id === (assignment.roomId || assignment.data?.roomId),
    );
    const building = room ? buildingMap[room.buildingId] : null;
    const floorNum = room ? floorMap[room.floorId]?.number : null;
    await generateHousingLetterPdf({
      isArabic: chosenAr,
      profile,
      assignment,
      room,
      building,
      floorNum,
      propName: activeProp?.name || "",
      propNameAr: (activeProp as any)?.displayName || activeProp?.name || "",
      propAddress: (activeProp as any)?.address || "",
      systemLogoUrl: (settings as any)?.systemLogo,
      propLogoUrl: (activeProp as any)?.logo,
    });
  };

  const {
    visible: resVisible,
    toggle: resToggle,
    showAll: resShowAll,
    hideAll: resHideAll,
    isVisible: isResVisible,
  } = useColumnVisibility(RES_COLS);
  const upcomingCount = (reservations || []).filter(
    (r: any) => r.status === "UPCOMING",
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {ar ? "الحجوزات والتسكين" : "Reservations & Housing"}
          </h1>
        </div>
        <PermissionGate module="accommodation" action="create">
          <Button
            onClick={openNewDialog}
            className="gap-2 self-start sm:self-auto shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {ar ? "حجز / تسكين جديد" : "New Reservation / Assignment"}
          </Button>
        </PermissionGate>
      </div>

      {(statusFilter === "UPCOMING"
        ? paginationTotal > 0
        : upcomingCount > 0) && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
          <CalendarDays className="w-4 h-4 flex-shrink-0" />
          <span>
            {ar
              ? `${statusFilter === "UPCOMING" ? paginationTotal : upcomingCount} حجز مستقبلي ينتظر التسكين`
              : `${statusFilter === "UPCOMING" ? paginationTotal : upcomingCount} future reservation(s) awaiting check-in`}
          </span>
        </div>
      )}

      <ReservationsToolbar
        ar={ar}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        resVisible={resVisible}
        resToggle={resToggle}
        resShowAll={resShowAll}
        resHideAll={resHideAll}
        exportResExcel={exportResExcel}
      />

      <BulkActionBar
        count={selectedRows.size}
        onClear={() => setSelectedRows(new Set())}
        onExportExcel={exportResExcel}
        actions={[
          {
            label: ar ? "حذف المحدد" : "Delete Selected",
            variant: "destructive",
            onClick: () => {
              if (
                window.confirm(
                  ar
                    ? `هل أنت متأكد من حذف ${selectedRows.size} حجز محدد؟`
                    : `Are you sure you want to delete ${selectedRows.size} selected reservations?`,
                )
              ) {
                selectedRows.forEach((id) => deleteMutation.mutate({ id }));
                setSelectedRows(new Set());
              }
            },
          },
        ]}
        ar={ar}
      />

      <ReservationsTable
        ar={ar}
        reservations={reservations}
        isLoading={isLoading}
        selectedRows={selectedRows}
        allResPageSelected={allResPageSelected}
        toggleSelectAllRes={toggleSelectAllRes}
        toggleResRow={toggleResRow}
        isResVisible={isResVisible}
        roomMap={roomMap}
        buildingMap={buildingMap}
        statusLabel={statusLabel}
        statusColor={statusColor}
        handleStartCheckin={handleStartCheckin}
        handleOpenWhatsAppDialog={handleOpenWhatsAppDialog}
        openEdit={openEdit}
        setCancelDialog={setCancelDialog}
        setDeleteId={setDeleteId}
      />

      {paginationTotal > 0 && (
        <DataPagination
          total={paginationTotal}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setCurrentPage(1);
          }}
        />
      )}

      {/* NEW RESERVATION / ASSIGNMENT DIALOG */}
      <NewReservationDialog
        ar={ar}
        newDialogOpen={newDialogOpen}
        setNewDialogOpen={setNewDialogOpen}
        step={step}
        personMode={personMode}
      >
        {/* STEP 1: CHOOSE MODE */}
        {step === 1 && (
          <WizardStepMode
            ar={ar}
            personMode={personMode}
            setPersonMode={setPersonMode}
            setNewForm={setNewForm}
            bookingType={bookingType}
            setBookingType={setBookingType}
            setStep={setStep}
          />
        )}

        {/* STEP 2A: EXISTING PROFILE SEARCH */}
        {step === 2 && personMode === "existing" && (
          <WizardStepExistingProfile
            ar={ar}
            allProperties={allProperties}
            activeProp={activeProp}
            searchPropertyId={searchPropertyId}
            setSearchPropertyId={setSearchPropertyId}
            searchRef={searchRef}
            empSearch={empSearch}
            setEmpSearch={setEmpSearch}
            empResults={empResults}
            isSearching={isSearching}
            showDropdown={showDropdown}
            selectedProfile={selectedProfile}
            selectProfile={selectProfile}
            clearProfile={clearProfile}
            isCrossProperty={isCrossProperty}
            archiveSourceProfile={archiveSourceProfile}
            setArchiveSourceProfile={setArchiveSourceProfile}
            setTransferType={setTransferType}
            setStep={setStep}
          />
        )}

        {/* STEP 2B: FULL NEW PROFILE FORM (EXACTLY LIKE ADD PROFILE) */}
        {step === 2 && personMode === "new" && (
          <WizardStepNewProfile
            ar={ar}
            activePropertyId={activePropertyId}
            newForm={newForm}
            setNewForm={setNewForm}
            photoPreview={photoPreview}
            photoRef={photoRef}
            docsRef={docsRef}
            handlePhotoSelect={handlePhotoSelect}
            clearPhoto={clearPhoto}
            handleDocSelect={handleDocSelect}
            removeDoc={removeDoc}
            resDuplicates={resDuplicates}
            resHasDuplicates={resHasDuplicates}
            setStep={setStep}
          />
        )}

        {/* STEP 3: ROOM & BED SELECTION */}
        {step === 3 && (
          <WizardStepRoomSelection
            ar={ar}
            bookingType={bookingType}
            checkInDate={checkInDate}
            setCheckInDate={setCheckInDate}
            expectedCheckOut={expectedCheckOut}
            setExpectedCheckOut={setExpectedCheckOut}
            selectedProfile={selectedProfile}
            newForm={newForm}
            searchBuilding={searchBuilding}
            setSearchBuilding={setSearchBuilding}
            searchFloor={searchFloor}
            setSearchFloor={setSearchFloor}
            searchRoomNumber={searchRoomNumber}
            setSearchRoomNumber={setSearchRoomNumber}
            buildings={buildings}
            floors={floors}
            buildingMap={buildingMap}
            floorMap={floorMap}
            sortedFilteredRooms={sortedFilteredRooms}
            entireRoomOccupiedSet={entireRoomOccupiedSet}
            singleOccupantRoomsMap={singleOccupantRoomsMap}
            selectedRoomBedMap={selectedRoomBedMap}
            occupiedBeds={occupiedBeds}
            canOverrideSingleOccupancy={canOverrideSingleOccupancy}
            selectedRoomId={selectedRoomId}
            setSelectedRoomId={setSelectedRoomId}
            selectedBed={selectedBed}
            setSelectedBed={setSelectedBed}
            isMultiBed={isMultiBed}
            bedOptions={bedOptions}
            notes={notes}
            setNotes={setNotes}
            setStep={setStep}
            handleSubmit={handleSubmit}
            createAssignmentMutation={createAssignmentMutation}
            createReservationMutation={createReservationMutation}
          />
        )}
      </NewReservationDialog>

      {/* CHECK-IN DIALOG */}
      <CheckinDialog
        ar={ar}
        checkinDialog={checkinDialog}
        setCheckinDialog={setCheckinDialog}
        checkinRoomSearch={checkinRoomSearch}
        setCheckinRoomSearch={setCheckinRoomSearch}
        filteredCheckinRooms={filteredCheckinRooms}
        entireRoomOccupiedSet={entireRoomOccupiedSet}
        checkinRecommendations={checkinRecommendations}
        checkinRoomId={checkinRoomId}
        setCheckinRoomId={setCheckinRoomId}
        buildingMap={buildingMap}
        handleCheckin={handleCheckin}
        checkinMutation={checkinMutation}
      />

      {/* Reservation Policy Exception Approval Modal */}
      <PolicyExceptionApprovalModal
        open={resPolicyModal.open}
        onOpenChange={(open) =>
          setResPolicyModal((prev) => ({ ...prev, open }))
        }
        titleAr="اعتماد استثناء لتسكين الحجز خارج السياسات"
        titleEn="Approve Policy Exception for Reservation Check-In"
        violations={resPolicyModal.violations}
        isLoading={checkinMutation.isPending}
        onConfirm={(approval) => {
          const action = resPolicyModal.pendingAction;
          setResPolicyModal({ open: false, violations: [] });
          if (action) action(approval);
        }}
      />

      {/* WHATSAPP RESERVATION CONFIRMATION DIALOG */}
      <WhatsAppConfirmationDialog
        ar={ar}
        whatsAppDialog={whatsAppDialog}
        setWhatsAppDialog={setWhatsAppDialog}
        whatsAppPhone={whatsAppPhone}
        setWhatsAppPhone={setWhatsAppPhone}
        isSendingWhatsApp={isSendingWhatsApp}
        handleSendWhatsAppConfirmation={handleSendWhatsAppConfirmation}
      />

      {/* EDIT DIALOG */}
      <EditReservationDialog
        ar={ar}
        activePropertyId={activePropertyId}
        editDialog={editDialog}
        setEditDialog={setEditDialog}
        editForm={editForm}
        setEditForm={setEditForm}
        departmentValues={departmentValues}
        filteredEditJobTitles={filteredEditJobTitles}
        rooms={rooms}
        buildings={buildings}
        buildingMap={buildingMap}
        showEditRoomPicker={showEditRoomPicker}
        setShowEditRoomPicker={setShowEditRoomPicker}
        editBuildingId={editBuildingId}
        setEditBuildingId={setEditBuildingId}
        editRoomSearch={editRoomSearch}
        setEditRoomSearch={setEditRoomSearch}
        filteredEditRooms={filteredEditRooms}
        entireRoomOccupiedSet={entireRoomOccupiedSet}
        setCancelDialog={setCancelDialog}
        handleUpdate={handleUpdate}
        updateMutation={updateMutation}
      />

      {/* CANCEL RESERVATION CONFIRMATION */}
      <CancelReservationDialog
        ar={ar}
        cancelDialog={cancelDialog}
        setCancelDialog={setCancelDialog}
        cancelMutation={cancelMutation}
      />

      {/* DELETE CONFIRM */}
      <DeleteReservationDialog
        ar={ar}
        deleteId={deleteId}
        setDeleteId={setDeleteId}
        deleteMutation={deleteMutation}
      />

      {/* KEY PROMPT */}
      <KeyPromptDialog
        ar={ar}
        keyPromptOpen={keyPromptOpen}
        setKeyPromptOpen={setKeyPromptOpen}
        lastAssignment={lastAssignment}
        activePropertyId={activePropertyId}
        checkInDate={checkInDate}
        expectedCheckOut={expectedCheckOut}
        selectedProfile={selectedProfile}
        newForm={newForm}
        printHousingLetter={printHousingLetter}
        setLocation={setLocation}
      />

      {/* ── نافذة تأكيد النقل والتسكين العابر للفنادق (Explicit Confirmation Modal) ── */}
      <CrossPropertyConfirmDialog
        ar={ar}
        crossPropertyModalOpen={crossPropertyModalOpen}
        setCrossPropertyModalOpen={setCrossPropertyModalOpen}
        selectedProfile={selectedProfile}
        activeProp={activeProp}
        archiveSourceProfile={archiveSourceProfile}
        setArchiveSourceProfile={setArchiveSourceProfile}
        setTransferType={setTransferType}
        executeSubmission={executeSubmission}
        createAssignmentMutation={createAssignmentMutation}
        createReservationMutation={createReservationMutation}
      />

      <PrintLanguageDialog
        open={langDialogOpen}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />
    </div>
  );
}
