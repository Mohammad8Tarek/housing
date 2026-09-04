// @ts-nocheck
import { recommendBestRooms } from "@/lib/room-recommender";
import { Sparkles } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListReservations,
  useCreateReservation,
  useDeleteReservation,
  useCheckinReservation,
  useUpdateReservation,
  useListRooms,
  useListBuildings,
  useListFloors,
  useListProperties,
  useListAssignments,
  useCreateAssignment,
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionGate } from "@/components/ui/permission-gate";
import { ColumnChooser, useColumnVisibility } from "@/components/ui/column-chooser";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { DataPagination } from "@/components/DataPagination";
import KeyManagementPanel from "@/components/KeyManagementPanel";
import { generateHousingLetterPdf } from "@/lib/pdf-utils";
import { usePrintLanguage, PrintLanguageDialog } from "@/lib/PrintLanguageDialog";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import { format } from "date-fns";
import { formatDate, getExportFileName } from "@/lib/date-utils";
import * as XLSX from "xlsx";
import {
  Plus, Trash, Search, BedDouble, UserCheck, Users,
  CalendarDays, CheckCircle, Pencil, X, ChevronRight, ChevronLeft,
  Building, Key, Printer, UserPlus, ChevronDown, Camera, FileText,
  Phone, CreditCard,
} from "lucide-react";

type ProfileResult = {
  id: number;
  propertyId: number;
  propertyName: string | null;
  profileId: string;
  firstName: string;
  lastName: string;
  thirdName?: string;
  fourthName?: string;
  nationalId: string;
  jobTitle: string | null;
  department: string | null;
  nationality: string | null;
  phone: string | null;
  level: string | null;
  status: string;
  gender: string | null;
  employmentType?: string | null;
  companyName?: string | null;
  contractEndDate?: string | null;
  accommodationRoom?: string | null;
  accommodationRoomType?: string | null;
  accommodationBuilding?: string | null;
};

const roomTypeCapacity: Record<string, number> = { single: 1, double: 2, triple: 3, quad: 4 };
function getBedOptions(roomType?: string, capacity?: number): number[] {
  const max = roomTypeCapacity[roomType?.toLowerCase() || ""] ?? (capacity || 1);
  return Array.from({ length: max }, (_, i) => i + 1);
}

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
  useEffect(() => { const h = setTimeout(() => setDebouncedSearch(search), 500); return () => clearTimeout(h); }, [search]);
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, statusFilter]);

  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editDialog, setEditDialog] = useState<{ open: boolean; reservation: any | null }>({ open: false, reservation: null });
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
    profileCode: "",
    level: "",
    guestIdCardNumber: "",
    guestPhone: "",
    roomType: "",
    employmentType: "INTERNAL",
    companyName: "",
  });
  const [checkinDialog, setCheckinDialog] = useState<{ open: boolean; id: number | null; guestName?: string; reservation?: any }>({ open: false, id: null });
  const [checkinRoomId, setCheckinRoomId] = useState("");
  const [checkinRoomSearch, setCheckinRoomSearch] = useState("");
  const [keyPromptOpen, setKeyPromptOpen] = useState(false);
  const [lastAssignment, setLastAssignment] = useState<any>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Step 1: Mode, Step 2: Details, Step 3: Room & Dates
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [personMode, setPersonMode] = useState<"existing" | "new" | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ProfileResult | null>(null);
  const [empSearch, setEmpSearch] = useState("");
  const [empResults, setEmpResults] = useState<ProfileResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchPropertyId, setSearchPropertyId] = useState<string>("all");
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Full New Person Profile State
  const [newForm, setNewForm] = useState({
    profileId: "",
    firstName: "",
    lastName: "",
    thirdName: "",
    fourthName: "",
    nationalId: "",
    nationality: "",
    gender: "M",
    phone: "",
    dateOfBirth: "",
    address: "",
    hireDate: new Date().toISOString().split("T")[0],
    contractEndDate: "",
    department: "",
    jobTitle: "",
    level: "",
    employmentType: "THIRD_PARTY" as "INTERNAL" | "THIRD_PARTY",
    companyName: "",
    idDocuments: [] as { fileName: string; fileType: string; fileData: string }[],
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
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
        toast.error(ar ? `${file.name} كبير جداً (الأقصى 5 ميجا)` : `${file.name} is too large (max 5MB)`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setNewForm((prev) => ({
          ...prev,
          idDocuments: [
            ...(prev.idDocuments || []),
            { fileName: file.name, fileType: file.type || "image/jpeg", fileData: reader.result as string },
          ],
        }));
      };
      reader.readAsDataURL(file);
    });
    if (docsRef.current) docsRef.current.value = "";
  };

  const removeDoc = (index: number) => {
    setNewForm((prev) => {
      const newDocs = [...(prev.idDocuments || [])];
      newDocs.splice(index, 1);
      return { ...prev, idDocuments: newDocs };
    });
  };

  const [bookingType, setBookingType] = useState<"direct" | "upcoming">("direct");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedBed, setSelectedBed] = useState("");
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedCheckOut, setExpectedCheckOut] = useState("");
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

  const { langDialogOpen, openDialog, handleSelect, handleCancel } = usePrintLanguage();

  const { data: _resWrapper, isLoading } = useListReservations(
    { propertyId: activePropertyId ?? undefined, page: currentPage, limit: pageSize, search: debouncedSearch, status: statusFilter === "all" ? undefined : statusFilter } as any,
    { query: { queryKey: ["listReservations", activePropertyId, currentPage, pageSize, debouncedSearch, statusFilter], enabled: !!activePropertyId, staleTime: 0, placeholderData: (prev: any) => prev } },
  );
  const reservations = _resWrapper?.data || _resWrapper || [];
  const paginationTotal = _resWrapper?.pagination?.total || 0;

  const { data: _rData } = useListRooms({ propertyId: activePropertyId, limit: 1000 }, { query: { enabled: !!activePropertyId, staleTime: 30000 } });
  const rooms = _rData?.data || [];
  const { data: _bData } = useListBuildings({ propertyId: activePropertyId }, { query: { enabled: !!activePropertyId, staleTime: 300000 } });
  const buildings = _bData?.data || [];
  const { data: _fData } = useListFloors({ propertyId: activePropertyId }, { query: { enabled: !!activePropertyId, staleTime: 300000 } });
  const floors = _fData?.data || [];
  const { data: _aData } = useListAssignments({ propertyId: activePropertyId } as any, { query: { enabled: !!activePropertyId, staleTime: 30000 } });
  const allAssignments = _aData?.data || [];
  const { data: _pData } = useListProperties();
  const allProperties = _pData?.data || _pData || [];
  const { data: settings } = useGetSettings({ query: { enabled: !!activePropertyId } });
  const activeProp = allProperties.find((p: any) => p.id === activePropertyId);
  const { data: departmentValues = [] } = useLookupValues(activePropertyId, LOOKUP_CATEGORIES.DEPARTMENT);
  const { data: jobTitleValues = [] } = useLookupValues(activePropertyId, LOOKUP_CATEGORIES.JOB_TITLE);
  const { data: nationalityValues = [] } = useLookupValues(activePropertyId, LOOKUP_CATEGORIES.NATIONALITY);

  const buildingMap = Object.fromEntries(buildings.map((b) => [b.id, b.name]));
  const floorMap = Object.fromEntries(floors.map((f) => [f.id, { name: f.name, number: f.floorNumber }]));

  const filteredJobTitles = useMemo(() => {
    if (!newForm.department || newForm.department === "none") return jobTitleValues;
    return jobTitleValues.filter((t: any) => !t.parentValue || t.parentValue === newForm.department);
  }, [jobTitleValues, newForm.department]);

  const filteredEditJobTitles = useMemo(() => {
    if (!editForm.department || editForm.department === "none") return jobTitleValues;
    return jobTitleValues.filter((t: any) => !t.parentValue || t.parentValue === editForm.department);
  }, [jobTitleValues, editForm.department]);

  const occupiedBeds = new Set(
    allAssignments.filter((a: any) => a.status === "ACTIVE" && a.roomId === parseInt(selectedRoomId) && a.bedNumber != null).map((a: any) => a.bedNumber),
  );

  const availableRooms = rooms
    .filter((r: any) => !["maintenance", "out_of_service", "oos", "out_of_order", "ooo"].includes(r.status?.toLowerCase()))
    .sort((a: any, b: any) => {
      const af = a.currentOccupancy >= a.capacity;
      const bf = b.currentOccupancy >= b.capacity;
      return af === bf ? 0 : af ? 1 : -1;
    });

  const filteredRooms = availableRooms.filter((r: any) => {
    if (searchBuilding !== "all" && r.buildingId !== parseInt(searchBuilding)) return false;
    if (searchFloor !== "all" && r.floorId !== parseInt(searchFloor)) return false;
    if (searchRoomNumber.trim() && !r.roomNumber?.toString().toLowerCase().includes(searchRoomNumber.trim().toLowerCase())) return false;
    return true;
  });

  const profileForRecommend = selectedProfile || (personMode === "new" && newForm.firstName ? { level: newForm.level, gender: newForm.gender, department: newForm.department, employmentType: newForm.employmentType, jobTitle: newForm.jobTitle } : null);
  const recommendation = useMemo(() => {
    if (!profileForRecommend || !rooms.length) return null;
    return recommendBestRooms({ profile: profileForRecommend, rooms, assignments: allAssignments, profiles: [] });
  }, [profileForRecommend, rooms, allAssignments]);

  const sortedFilteredRooms = useMemo(() => {
    if (!recommendation) return filteredRooms;
    return [...filteredRooms].sort((a: any, b: any) => (recommendation.recommendedMap[b.id]?.score ?? 0) - (recommendation.recommendedMap[a.id]?.score ?? 0));
  }, [filteredRooms, recommendation]);

  const selectedRoom = rooms.find((r: any) => r.id === parseInt(selectedRoomId));
  const bedOptions = selectedRoom ? getBedOptions(selectedRoom.roomType, selectedRoom.capacity) : [];
  const isMultiBed = bedOptions.length > 1;

  const checkinRooms = rooms.filter((r: any) => r.status?.toLowerCase() !== "maintenance" && (r.currentOccupancy ?? 0) < (r.capacity ?? 1));
  const filteredCheckinRooms = checkinRooms.filter((r: any) => !checkinRoomSearch.trim() || r.roomNumber?.toLowerCase().includes(checkinRoomSearch.toLowerCase()));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["listReservations"] });
    queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey({ propertyId: activePropertyId }) });
    queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey({ propertyId: activePropertyId }) });
    queryClient.invalidateQueries({ queryKey: getListAssignmentsQueryKey({ propertyId: activePropertyId }) });
    queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/assignments/in-house"] });
    queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey({ propertyId: activePropertyId }) });
    queryClient.invalidateQueries({ queryKey: getListProfilesQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  };

  const createReservationMutation = useCreateReservation({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم إنشاء الحجز بنجاح" : "Reservation created successfully");
        closeNewDialog();
      },
      onError: (e: any) => toast.error(e?.data?.error || e?.message || (ar ? "خطأ" : "Error")),
    },
  });

  const createAssignmentMutation = useCreateAssignment({
    mutation: {
      onSuccess: (data: any) => {
        invalidate();
        toast.success(ar ? "تم التسكين بنجاح" : "Assignment created successfully");
        setLastAssignment(data);
        setKeyPromptOpen(true);
        closeNewDialog();
      },
      onError: async (err: any) => {
        let msg = err.message;
        try {
          const b = err?.data || (await err?.response?.clone?.()?.json?.().catch(() => null)) || {};
          if (b?.code === "BED_TAKEN") msg = ar ? "هذا السرير مشغول بالفعل." : "Bed is taken.";
          else if (b?.code === "PROFILE_ALREADY_ASSIGNED") msg = ar ? "الموظف مسكّن بالفعل في غرفة أخرى." : "Already assigned.";
          else if (b?.code === "ROOM_FULL") msg = ar ? "الغرفة ممتلئة بالكامل." : "Room is full.";
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
        toast.error(e?.data?.error || e?.message || (ar ? "فشل الحذف" : "Failed to delete"));
      },
    },
  });

  const checkinMutation = useCheckinReservation({
    mutation: {
      onSuccess: (data: any) => {
        invalidate();
        toast.success(
          ar
            ? "تم التسكين بنجاح وانتقل الحجز إلى قائمة المقيمين (In-House)"
            : "Checked in successfully and moved to In-House",
        );
        setSelectedRows((prev) => {
          const next = new Set(prev);
          if (checkinDialog.id) next.delete(checkinDialog.id);
          return next;
        });
        setCheckinDialog({ open: false, id: null });
        setCheckinRoomId("");

        const asgn = data?.assignment || {
          id: data?.assignmentId || data?.id,
          roomId: data?.roomId,
          checkInDate: data?.checkInDate,
          expectedCheckOutDate: data?.checkOutDate,
        };
        setLastAssignment(asgn);
        if (data?.profile) {
          setSelectedProfile(data.profile);
        }
        setKeyPromptOpen(true);
      },
      onError: (e: any) => {
        const msg = e?.data?.error || e?.message || (ar ? "خطأ في التسكين" : "Check-in error");
        toast.error(msg);
      },
    },
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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!empSearch.trim() || empSearch.trim().length < 2) {
      setEmpResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const pp = searchPropertyId !== "all" ? `&propertyId=${searchPropertyId}` : "";
        const resp = await fetch(`/api/profiles/search?q=${encodeURIComponent(empSearch.trim())}${pp}`, { credentials: "include" });
        setEmpResults(await resp.json());
        setShowDropdown(true);
      } catch {
        setEmpResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [empSearch, searchPropertyId]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selectProfile = (emp: ProfileResult) => {
    setSelectedProfile(emp);
    setEmpSearch(`${emp.firstName} ${emp.lastName} (${emp.profileId})`);
    setShowDropdown(false);
    // Auto-populate expected checkout date from contract end date for internal employee
    if (emp.employmentType !== "THIRD_PARTY" && emp.contractEndDate) {
      setExpectedCheckOut(emp.contractEndDate.split("T")[0]);
    }
  };

  const clearProfile = () => {
    setSelectedProfile(null);
    setEmpSearch("");
    setEmpResults([]);
  };

  const openNewDialog = () => {
    setStep(1);
    setPersonMode(null);
    setSelectedProfile(null);
    setEmpSearch("");
    setNewForm({
      profileId: "",
      firstName: "",
      lastName: "",
      thirdName: "",
      fourthName: "",
      nationalId: "",
      nationality: "",
      gender: "M",
      phone: "",
      dateOfBirth: "",
      address: "",
      hireDate: new Date().toISOString().split("T")[0],
      contractEndDate: "",
      department: "",
      jobTitle: "",
      level: "",
      employmentType: "THIRD_PARTY",
      companyName: "",
      idDocuments: [],
    });
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
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {}
  };

  const handleSubmit = async () => {
    if (!selectedRoomId) {
      toast.error(ar ? "الرجاء اختيار غرفة أولاً" : "Please select a room");
      return;
    }
    if (isMultiBed && !selectedBed) {
      toast.error(ar ? "الرجاء تحديد رقم السرير أو اختيار (الغرفة كاملة)" : "Please select bed number or choose Entire Room");
      return;
    }
    if (bookingType === "direct" && personMode === "existing" && selectedProfile?.accommodationRoom) {
      toast.error(
        ar
          ? `الموظف (${selectedProfile.firstName} ${selectedProfile.lastName}) مقيم بالفعل بالسكن في غرفة #${selectedProfile.accommodationRoom}. لا يمكن تسكينه مرتين؛ استخدم خيار (نقل الغرفة) لنقله.`
          : `Employee is already residing in Room #${selectedProfile.accommodationRoom}. Use Room Move instead.`
      );
      return;
    }

    // Effective Checkout: if not entered, pull contractEndDate for internal employees
    const effectiveCheckOut =
      expectedCheckOut ||
      (personMode === "existing" && selectedProfile?.employmentType !== "THIRD_PARTY"
        ? selectedProfile?.contractEndDate
        : newForm.employmentType !== "THIRD_PARTY"
        ? newForm.contractEndDate
        : undefined) ||
      undefined;

    const reservationNotes = selectedBed === "ALL"
      ? `[حجز الغرفة بالكامل] ${notes || ""}`.trim()
      : selectedBed
      ? `[سرير رقم: ${selectedBed}] ${notes || ""}`.trim()
      : notes || "";

    const reservationRoomType = selectedBed === "ALL"
      ? (ar ? `الغرفة بالكامل (${selectedRoom?.roomType || ""})` : `Entire Room (${selectedRoom?.roomType || ""})`)
      : selectedRoom?.roomType || undefined;

    if (personMode === "existing" && selectedProfile) {
      if (bookingType === "direct") {
        createAssignmentMutation.mutate({
          data: {
            propertyId: activePropertyId!,
            profileId: selectedProfile.id,
            roomId: parseInt(selectedRoomId),
            checkInDate: new Date(checkInDate).toISOString(),
            expectedCheckOutDate: effectiveCheckOut ? new Date(effectiveCheckOut).toISOString() : undefined,
            bedNumber: selectedBed && selectedBed !== "ALL" ? parseInt(selectedBed) : undefined,
            notes: selectedBed === "ALL" ? `[حجز الغرفة بالكامل] ${notes || ""}`.trim() : (notes || undefined),
          } as any,
        });
      } else {
        createReservationMutation.mutate({
          data: {
            propertyId: activePropertyId!,
            firstName: selectedProfile.firstName,
            lastName: selectedProfile.lastName,
            guestIdCardNumber: selectedProfile.nationalId || selectedProfile.profileId,
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
            checkOutDate: effectiveCheckOut ? new Date(effectiveCheckOut).toISOString() : undefined,
            roomId: parseInt(selectedRoomId),
            bedNumber: selectedBed,
            roomType: reservationRoomType,
            notes: reservationNotes,
          } as any,
        });
      }
    } else if (personMode === "new") {
      try {
        const generatedId = (newForm.profileId?.trim()) || `${newForm.employmentType === "THIRD_PARTY" ? "TP" : "EMP"}-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
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
          contractEndDate: newForm.employmentType !== "THIRD_PARTY" ? (newForm.contractEndDate || null) : null,
          department: newForm.department || (newForm.employmentType === "THIRD_PARTY" ? (ar ? "طرف ثالث" : "Third Party") : ""),
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
        setSelectedProfileId(np.id);
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
              expectedCheckOutDate: effectiveCheckOut ? new Date(effectiveCheckOut).toISOString() : undefined,
              bedNumber: selectedBed && selectedBed !== "ALL" ? parseInt(selectedBed) : undefined,
              notes: selectedBed === "ALL" ? `[حجز الغرفة بالكامل] ${notes || ""}`.trim() : (notes || undefined),
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
              employmentType: np.employmentType || newForm.employmentType || "THIRD_PARTY",
              companyName: np.companyName || newForm.companyName || "",
              checkInDate: new Date(checkInDate).toISOString(),
              checkOutDate: effectiveCheckOut ? new Date(effectiveCheckOut).toISOString() : undefined,
              roomId: parseInt(selectedRoomId),
              bedNumber: selectedBed,
              roomType: reservationRoomType,
              notes: reservationNotes,
            } as any,
          });
        }
      } catch (e: any) {
        toast.error(e.message || (ar ? "خطأ في إنشاء الملف الشخصي" : "Error creating profile"));
      }
    }
  };

  const handleStartCheckin = (res: any) => {
    if (res.roomId) {
      // Room was already chosen during reservation creation: Check-in immediately!
      setSelectedProfile({
        id: res.profileId || 0,
        propertyId: activePropertyId!,
        propertyName: null,
        profileId: res.profileCode || `RES-${res.id}`,
        firstName: res.firstName,
        lastName: res.lastName,
        nationalId: res.guestIdCardNumber || "",
        jobTitle: res.jobTitle || null,
        department: res.department || null,
        nationality: res.nationality || null,
        phone: res.guestPhone || null,
        level: res.level || null,
        status: "ACTIVE",
        gender: res.gender || null,
      });

      checkinMutation.mutate({
        id: res.id,
        data: {
          roomId: Number(res.roomId),
          actualCheckInDate: new Date().toISOString(),
        },
      });
    } else {
      // No room was assigned yet: open room picker dialog
      setCheckinRoomId("");
      setCheckinDialog({
        open: true,
        id: res.id,
        guestName: `${res.firstName} ${res.lastName}`,
        reservation: res,
      });
    }
  };

  const handleCheckin = () => {
    if (!checkinDialog.id || !checkinRoomId) {
      toast.error(ar ? "الرجاء اختيار غرفة" : "Please select a room");
      return;
    }
    if (checkinDialog.reservation) {
      const res = checkinDialog.reservation;
      setSelectedProfile({
        id: res.profileId || 0,
        propertyId: activePropertyId!,
        propertyName: null,
        profileId: res.profileCode || `RES-${res.id}`,
        firstName: res.firstName,
        lastName: res.lastName,
        nationalId: res.guestIdCardNumber || "",
        jobTitle: res.jobTitle || null,
        department: res.department || null,
        nationality: res.nationality || null,
        phone: res.guestPhone || null,
        level: res.level || null,
        status: "ACTIVE",
        gender: res.gender || null,
      });
    }
    checkinMutation.mutate({
      id: checkinDialog.id,
      data: { roomId: parseInt(checkinRoomId), actualCheckInDate: new Date().toISOString() },
    });
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
      profileCode: res.profileCode || "",
      level: res.level || "",
      guestIdCardNumber: res.guestIdCardNumber || "",
      guestPhone: res.guestPhone || "",
      roomType: res.roomType || "",
      employmentType: res.employmentType || "INTERNAL",
      companyName: res.companyName || "",
    });
    setEditDialog({ open: true, reservation: res });
  };

  const handleUpdate = () => {
    if (!editDialog.reservation) return;
    updateMutation.mutate({
      id: editDialog.reservation.id,
      data: {
        checkInDate: editForm.checkInDate ? new Date(editForm.checkInDate).toISOString() : undefined,
        checkOutDate: editForm.checkOutDate ? new Date(editForm.checkOutDate).toISOString() : undefined,
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
      } as any,
    });
  };

  const statusLabel: Record<string, string> = {
    UPCOMING: ar ? "وصول" : "Arrival",
    CHECKED_IN: ar ? "مقيم" : "Checked In",
    CANCELLED: ar ? "ملغي" : "Cancelled",
    COMPLETED: ar ? "منتهي" : "Completed",
  };
  const statusColor = (s: string) =>
    ({
      UPCOMING: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
      CHECKED_IN: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
      CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
      COMPLETED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    })[s] || "bg-gray-100 text-gray-600";

  const pagedResIds = (reservations || []).map((r: any) => r.id);
  const allResPageSelected = pagedResIds.length > 0 && pagedResIds.every((id: number) => selectedRows.has(id));
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
    const target = selectedRows.size > 0 ? all.filter((r: any) => selectedRows.has(r.id)) : all;
    const rows = target.map((r: any) => ({
      Guest: `${r.firstName} ${r.lastName}`,
      "Check-in": formatDate(r.checkInDate, ""),
      "Check-out": formatDate(r.checkOutDate, ""),
      Status: r.status,
      Department: r.department ?? "",
      "ID Card": r.guestIdCardNumber ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reservations");
    XLSX.writeFile(wb, getExportFileName("Reservations", "xlsx"));
  };

  const printHousingLetter = async (profile: any, assignment: any) => {
    const chosenAr = await openDialog();
    const room = rooms.find((r: any) => r.id === (assignment.roomId || assignment.data?.roomId));
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
      propAddress: (activeProp as any)?.address || "",
      systemLogoUrl: (settings as any)?.systemLogo,
      propLogoUrl: (activeProp as any)?.logo,
    });
  };

  const RES_COLS = [
    { key: "guest", label: "Guest & Type", labelAr: "النزيل والتصنيف", defaultVisible: true, fixed: true },
    { key: "contact", label: "Contact & ID", labelAr: "التواصل والهوية", defaultVisible: true },
    { key: "stay", label: "Stay Period", labelAr: "فترة الإقامة", defaultVisible: true },
    { key: "room", label: "Room & Dept", labelAr: "الغرفة والقسم", defaultVisible: true },
    { key: "status", label: "Status", labelAr: "الحالة", defaultVisible: true },
    { key: "actions", label: "Actions", labelAr: "إجراءات", defaultVisible: true, fixed: true },
    // Granular columns for power users via ColumnChooser:
    { key: "emptype", label: "Type only", labelAr: "النوع فقط", defaultVisible: false },
    { key: "phone", label: "Phone only", labelAr: "الهاتف فقط", defaultVisible: false },
    { key: "id", label: "ID only", labelAr: "الهوية فقط", defaultVisible: false },
    { key: "dept", label: "Dept only", labelAr: "القسم فقط", defaultVisible: false },
    { key: "roomtype", label: "Room Type only", labelAr: "نوع الغرفة فقط", defaultVisible: false },
    { key: "checkin", label: "Check-in only", labelAr: "الدخول فقط", defaultVisible: false },
    { key: "checkout", label: "Check-out only", labelAr: "المغادرة فقط", defaultVisible: false },
  ];
  const { visible: resVisible, toggle: resToggle, showAll: resShowAll, hideAll: resHideAll, isVisible: isResVisible } = useColumnVisibility(RES_COLS);
  const upcomingCount = (reservations || []).filter((r: any) => r.status === "UPCOMING").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{ar ? "الحجوزات والتسكين" : "Reservations & Housing"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{ar ? "إدارة الحجوزات وتسكين الغرف للموظفين الداخليين والطرف الثالث" : "Manage housing reservations and assign rooms for internal & third-party staff"}</p>
        </div>
        <PermissionGate module="accommodation" action="create">
          <Button onClick={openNewDialog} className="gap-2 self-start sm:self-auto shadow-sm">
            <Plus className="w-4 h-4" />
            {ar ? "حجز / تسكين جديد" : "New Reservation / Assignment"}
          </Button>
        </PermissionGate>
      </div>

      {(statusFilter === "UPCOMING" ? paginationTotal > 0 : upcomingCount > 0) && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
          <CalendarDays className="w-4 h-4 flex-shrink-0" />
          <span>{ar ? `${statusFilter === "UPCOMING" ? paginationTotal : upcomingCount} حجز ينتظر التسكين` : `${statusFilter === "UPCOMING" ? paginationTotal : upcomingCount} reservation(s) awaiting check-in`}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input className="pl-9 rtl:pr-9 rtl:pl-3" placeholder={ar ? "بحث..." : "Search..."} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder={ar ? "حالة الحجز" : "Reservation Status"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="UPCOMING">{ar ? "الحجوزات (في انتظار التسكين)" : "Reservations (Awaiting Check-in)"}</SelectItem>
            <SelectItem value="CHECKED_IN">{ar ? "تم التسكين (Checked In)" : "Checked In"}</SelectItem>
            <SelectItem value="COMPLETED">{ar ? "منتهي" : "Completed"}</SelectItem>
            <SelectItem value="CANCELLED">{ar ? "ملغي" : "Cancelled"}</SelectItem>
            <SelectItem value="all">{ar ? "كل الحالات" : "All Statuses"}</SelectItem>
          </SelectContent>
        </Select>
        <ColumnChooser cols={RES_COLS} visible={resVisible} onToggle={resToggle} onShowAll={resShowAll} onHideAll={resHideAll} ar={ar} />
        <Button variant="outline" size="sm" onClick={exportResExcel} className="h-10">{ar ? "تصدير" : "Export"}</Button>
      </div>

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
                    : `Are you sure you want to delete ${selectedRows.size} selected reservations?`
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

      <div className="border rounded-xl overflow-hidden bg-card shadow-xs">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-muted/80 hover:bg-muted/80">
              <TableHead className="w-10 px-3 sticky ltr:left-0 rtl:right-0 z-20 bg-muted/90"><Checkbox checked={allResPageSelected} onCheckedChange={toggleSelectAllRes} /></TableHead>
              {isResVisible("guest") && (
                <TableHead className="font-semibold text-xs text-foreground min-w-[190px]">
                  {ar ? "النزيل والتصنيف" : "Guest & Type"}
                </TableHead>
              )}
              {isResVisible("contact") && (
                <TableHead className="font-semibold text-xs text-foreground min-w-[130px]">
                  {ar ? "التواصل والهوية" : "Contact & ID"}
                </TableHead>
              )}
              {isResVisible("stay") && (
                <TableHead className="font-semibold text-xs text-foreground min-w-[150px]">
                  {ar ? "فترة الإقامة" : "Stay Period"}
                </TableHead>
              )}
              {isResVisible("room") && (
                <TableHead className="font-semibold text-xs text-foreground min-w-[130px]">
                  {ar ? "الغرفة والقسم" : "Room & Dept"}
                </TableHead>
              )}
              {isResVisible("emptype") && <TableHead className="font-semibold text-xs">{ar ? "النوع" : "Type"}</TableHead>}
              {isResVisible("phone") && <TableHead className="font-semibold text-xs">{ar ? "الهاتف" : "Phone"}</TableHead>}
              {isResVisible("id") && <TableHead className="font-semibold text-xs">{ar ? "الهوية" : "ID Card"}</TableHead>}
              {isResVisible("dept") && <TableHead className="font-semibold text-xs">{ar ? "القسم" : "Dept"}</TableHead>}
              {isResVisible("roomtype") && <TableHead className="font-semibold text-xs">{ar ? "نوع الغرفة" : "Room Type"}</TableHead>}
              {isResVisible("checkin") && <TableHead className="font-semibold text-xs">{ar ? "الدخول" : "Check-in"}</TableHead>}
              {isResVisible("checkout") && <TableHead className="font-semibold text-xs">{ar ? "المغادرة" : "Check-out"}</TableHead>}
              {isResVisible("status") && (
                <TableHead className="font-semibold text-xs text-foreground min-w-[95px]">
                  {ar ? "الحالة" : "Status"}
                </TableHead>
              )}
              {isResVisible("actions") && (
                <TableHead className="font-semibold text-xs text-center w-24 sticky ltr:right-0 rtl:left-0 z-20 bg-muted/90 border-s border-border">
                  {ar ? "إجراءات" : "Actions"}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
              ))
            ) : (reservations || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                  <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>{ar ? "لا توجد حجوزات" : "No reservations found"}</p>
                </TableCell>
              </TableRow>
            ) : (
              (reservations || []).map((res: any) => {
                const isSel = selectedRows.has(res.id);
                const isThirdParty = res.employmentType === "THIRD_PARTY" || res.department === "طرف ثالث";
                return (
                  <TableRow key={res.id} className={`group ${isSel ? "bg-primary/5" : "hover:bg-muted/20"}`}>
                    <TableCell className="px-3 sticky ltr:left-0 rtl:right-0 z-10 bg-card group-hover:bg-accent/40">
                      <Checkbox checked={isSel} onCheckedChange={() => toggleResRow(res.id)} />
                    </TableCell>

                    {/* Guest & Profile Type */}
                    {isResVisible("guest") && (
                      <TableCell className="py-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-sm text-foreground leading-tight">
                            {res.firstName} {res.lastName}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isThirdParty ? (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 text-[11px] font-bold px-2 py-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block mr-1 rtl:ml-1 rtl:mr-0" />
                                {ar ? "طرف ثالث" : "Third Party"}
                                {res.companyName ? ` • ${res.companyName}` : ""}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 text-[11px] font-bold px-2 py-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block mr-1 rtl:ml-1 rtl:mr-0" />
                                {ar ? "موظف داخلي" : "Internal"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    )}

                    {/* Contact & ID */}
                    {isResVisible("contact") && (
                      <TableCell className="py-2.5">
                        <div className="flex flex-col text-xs gap-0.5">
                          {res.guestPhone ? (
                            <span className="font-mono text-foreground font-medium flex items-center gap-1" dir="ltr">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              {res.guestPhone}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {res.guestIdCardNumber && (
                            <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1">
                              <CreditCard className="w-3 h-3 text-muted-foreground/70" />
                              {res.guestIdCardNumber}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}

                    {/* Stay Period */}
                    {isResVisible("stay") && (
                      <TableCell className="py-2.5 whitespace-nowrap">
                        <div className="flex flex-col text-xs gap-0.5">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{formatDate(res.checkInDate)}</span>
                            <span className="text-muted-foreground">←</span>
                            <span className="text-amber-700 dark:text-amber-400 font-semibold">{formatDate(res.checkOutDate)}</span>
                          </div>
                        </div>
                      </TableCell>
                    )}

                    {/* Room & Dept */}
                    {isResVisible("room") && (
                      <TableCell className="py-2.5">
                        <div className="flex flex-col text-xs gap-0.5">
                          <span className="font-medium text-foreground">
                            {res.roomType || (ar ? "غير محدد" : "Unspecified")}
                          </span>
                          {res.department && res.department !== "طرف ثالث" && (
                            <span className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                              {res.department}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}

                    {/* Granular Fallback Cells if user checked them specifically in ColumnChooser */}
                    {isResVisible("emptype") && (
                      <TableCell>
                        {isThirdParty ? (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-semibold">
                            {ar ? "طرف ثالث" : "Third Party"}{res.companyName ? ` • ${res.companyName}` : ""}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
                            {ar ? "موظف داخلي" : "Internal"}
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    {isResVisible("phone") && <TableCell className="text-sm">{res.guestPhone || "—"}</TableCell>}
                    {isResVisible("id") && <TableCell className="text-sm font-mono">{res.guestIdCardNumber || "—"}</TableCell>}
                    {isResVisible("dept") && <TableCell className="text-sm">{res.department || "—"}</TableCell>}
                    {isResVisible("roomtype") && <TableCell className="text-sm">{res.roomType || "—"}</TableCell>}
                    {isResVisible("checkin") && <TableCell className="text-sm whitespace-nowrap">{formatDate(res.checkInDate)}</TableCell>}
                    {isResVisible("checkout") && <TableCell className="text-sm whitespace-nowrap">{formatDate(res.checkOutDate)}</TableCell>}

                    {/* Status */}
                    {isResVisible("status") && (
                      <TableCell className="py-2.5 whitespace-nowrap">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusColor(res.status)}`}>
                          {statusLabel[res.status] || res.status}
                        </span>
                      </TableCell>
                    )}

                    {/* Actions */}
                    {isResVisible("actions") && (
                      <TableCell className="w-24 text-center sticky ltr:right-0 rtl:left-0 z-10 bg-card group-hover:bg-accent/40 border-s border-border">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 font-medium bg-background hover:bg-muted shadow-xs">
                              {ar ? "إجراءات" : "Actions"} <ChevronDown className="w-3 h-3 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 shadow-lg">
                            {res.status === "UPCOMING" && (
                              <DropdownMenuItem onClick={() => handleStartCheckin(res)} className="cursor-pointer font-medium text-emerald-600">
                                <CheckCircle className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-emerald-500" />{ar ? "تسكين (Check-In)" : "Check-In"}
                              </DropdownMenuItem>
                            )}
                            <PermissionGate module="accommodation" action="edit">
                              <DropdownMenuItem onClick={() => openEdit(res)} className="cursor-pointer">
                                <Pencil className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-amber-500" />{ar ? "تعديل" : "Edit"}
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate module="accommodation" action="delete">
                              <DropdownMenuItem onClick={() => setDeleteId(res.id)} className="text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10">
                                <Trash className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-destructive" />{ar ? "حذف" : "Delete"}
                              </DropdownMenuItem>
                            </PermissionGate>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {paginationTotal > 0 && (
        <DataPagination total={paginationTotal} pageSize={pageSize} currentPage={currentPage} onPageChange={setCurrentPage} onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }} ar={ar} />
      )}

      {/* NEW RESERVATION / ASSIGNMENT DIALOG */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-primary" />
              {ar ? "حجز / تسكين جديد" : "New Reservation / Assignment"}
            </DialogTitle>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3].map((s) => (<div key={s} className={`h-1.5 rounded-full flex-1 transition-colors ${step >= s ? "bg-primary" : "bg-muted"}`} />))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {step === 1 && (ar ? "الخطوة 1: تحديد نوع الشخص ونظام الحجز" : "Step 1: Choose person type & booking mode")}
              {step === 2 && personMode === "existing" && (ar ? "الخطوة 2: البحث عن الموظف المسجل مسبقاً" : "Step 2: Search existing registered profile")}
              {step === 2 && personMode === "new" && (ar ? "الخطوة 2: إدخال بيانات الملف الجديد والمستندات" : "Step 2: Enter new profile data & upload documents")}
              {step === 3 && (ar ? "الخطوة 3: اختيار الغرفة وتواريخ الإقامة" : "Step 3: Select room and check-in dates")}
            </p>
          </DialogHeader>

          {/* STEP 1: CHOOSE MODE */}
          {step === 1 && (
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{ar ? "هل الشخص موجود مسبقاً في النظام أم نيو بروفايل؟" : "Is this person registered or a new profile?"}</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => { setPersonMode("existing"); }} className={`flex flex-col items-center gap-3 p-5 border-2 rounded-xl transition-all ${personMode === "existing" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}>
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                      <UserCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm">{ar ? "انترنال بروفايل (موظف داخلي)" : "Internal Profile"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ar ? "البحث عن موظف مسجل مسبقاً في النظام" : "Search existing registered employee"}</p>
                    </div>
                  </button>
                  <button onClick={() => { setPersonMode("new"); setNewForm((f) => ({ ...f, employmentType: "THIRD_PARTY" })); }} className={`flex flex-col items-center gap-3 p-5 border-2 rounded-xl transition-all ${personMode === "new" ? "border-purple-600 bg-purple-500/5 ring-2 ring-purple-500/20" : "border-border hover:border-purple-500/50 hover:bg-muted/30"}`}>
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm">{ar ? "Third Party نيو بروفايل" : "Third Party (New Profile)"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ar ? "إدخال بيانات طرف ثالث وإنشاء بروفايل جديد" : "Enter third-party details & create new profile"}</p>
                    </div>
                  </button>
                </div>
              </div>

              {personMode && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-sm font-semibold">{ar ? "طريقة الحجز" : "Booking Mode"}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setBookingType("direct")}
                      className={`flex items-start gap-2.5 p-3 rounded-lg border-2 text-left rtl:text-right transition-all ${bookingType === "direct" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-muted-foreground"}`}
                    >
                      <CheckCircle className={`w-4 h-4 mt-0.5 ${bookingType === "direct" ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <p className="text-sm font-semibold">{ar ? "تسكين فوري" : "Direct Assignment"}</p>
                        <p className="text-xs text-muted-foreground">{ar ? "تسكين الشخص في الغرفة والسرير الآن" : "Assign to room & bed immediately"}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setBookingType("upcoming")}
                      className={`flex items-start gap-2.5 p-3 rounded-lg border-2 text-left rtl:text-right transition-all ${bookingType === "upcoming" ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-muted-foreground"}`}
                    >
                      <CalendarDays className={`w-4 h-4 mt-0.5 ${bookingType === "upcoming" ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <p className="text-sm font-semibold">{ar ? "حجز مستقبلي" : "Future Reservation"}</p>
                        <p className="text-xs text-muted-foreground">{ar ? "حجز لتاريخ مستقبلي ثم تسكينه لاحقاً" : "Book for future date with check-in later"}</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)} disabled={!personMode}>
                  {ar ? "التالي" : "Next"} <ChevronRight className="w-4 h-4 ml-1 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2A: EXISTING PROFILE SEARCH */}
          {step === 2 && personMode === "existing" && (
            <div className="space-y-4 py-2">
              {allProperties.length > 1 && (
                <Select value={searchPropertyId} onValueChange={(v) => { setSearchPropertyId(v); clearProfile(); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={ar ? "كل الفروع" : "All Properties"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{ar ? "كل الفروع" : "All Properties"}</SelectItem>
                    {allProperties.map((p: any) => (<SelectItem key={p.id} value={String(p.id)}>{p.displayName || p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}
              <div className="relative" ref={searchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
                  <Input className="pl-9 pr-9 rtl:pr-9 rtl:pl-9" placeholder={ar ? "ابحث بالاسم أو الكود أو الهوية..." : "Search by name, code, or ID..."} value={empSearch} onChange={(e) => { setEmpSearch(e.target.value); if (selectedProfile) clearProfile(); }} autoComplete="off" />
                  {empSearch && (<button onClick={clearProfile} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground rtl:right-auto rtl:left-3"><X className="w-4 h-4" /></button>)}
                </div>
                {showDropdown && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {isSearching && <div className="p-3 text-sm text-muted-foreground">{ar ? "جاري البحث..." : "Searching..."}</div>}
                    {!isSearching && empResults.length === 0 && <div className="p-3 text-sm text-muted-foreground">{ar ? "لا توجد نتائج" : "No results"}</div>}
                    {empResults.map((emp) => (
                      <button key={emp.id} className="w-full text-left rtl:text-right px-4 py-3 hover:bg-muted/50 flex items-start gap-3 border-b last:border-0 transition-colors" onClick={() => selectProfile(emp)}>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-xs font-bold text-primary">{emp.firstName[0]}{emp.lastName[0]}</span></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-muted-foreground">{emp.profileId} • {emp.department || "—"} • {emp.jobTitle || "—"}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {emp.employmentType === "THIRD_PARTY" ? (
                              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{ar ? "طرف ثالث" : "Third Party"}{emp.companyName ? ` • ${emp.companyName}` : ""}</span>
                            ) : (
                              <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">{ar ? "داخلي" : "Internal"}</span>
                            )}
                            {emp.employmentType !== "THIRD_PARTY" && emp.contractEndDate && (
                              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                {ar ? "انتهاء العقد:" : "Contract End:"} {emp.contractEndDate}
                              </span>
                            )}
                            {emp.accommodationRoom && (
                              <span className="text-xs bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                {ar ? `مقيم حالياً: غرفة #${emp.accommodationRoom}` : `In-House: Room #${emp.accommodationRoom}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedProfile && (
                <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"><span className="text-sm font-bold text-primary">{selectedProfile.firstName[0]}{selectedProfile.lastName[0]}</span></div>
                    <div>
                      <p className="font-semibold">{selectedProfile.firstName} {selectedProfile.lastName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{selectedProfile.profileId} • {selectedProfile.department || "—"} • {selectedProfile.jobTitle || "—"}</p>
                      {selectedProfile.employmentType !== "THIRD_PARTY" && selectedProfile.contractEndDate && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-0.5">
                          📄 {ar ? "تاريخ انتهاء العقد:" : "Contract End Date:"} {selectedProfile.contractEndDate}
                        </p>
                      )}
                    </div>
                    {selectedProfile.employmentType === "THIRD_PARTY" ? (
                      <Badge className="ml-auto rtl:ml-0 rtl:mr-auto bg-purple-100 text-purple-800 text-xs font-semibold">{ar ? "طرف ثالث" : "Third Party"}{selectedProfile.companyName ? ` • ${selectedProfile.companyName}` : ""}</Badge>
                    ) : (
                      <Badge variant="outline" className="ml-auto rtl:ml-0 rtl:mr-auto bg-blue-50 text-blue-700 text-xs font-semibold">{ar ? "موظف داخلي" : "Internal Employee"}</Badge>
                    )}
                  </div>
                  {selectedProfile.accommodationRoom && (
                    <div className="mt-3 p-3 rounded-lg border border-red-300 bg-red-50/90 dark:bg-red-950/40 text-red-800 dark:text-red-300 text-xs flex items-start gap-2.5">
                      <X className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">
                          {ar
                            ? `تنبيه: هذا الموظف مقيم بالفعل بالسكن في غرفة رقم #${selectedProfile.accommodationRoom} ${selectedProfile.accommodationBuilding ? `(${selectedProfile.accommodationBuilding})` : ""}`
                            : `Warning: This employee is already residing in Room #${selectedProfile.accommodationRoom}`}
                        </p>
                        <p className="mt-1 text-red-700 dark:text-red-400">
                          {ar
                            ? "لا يمكن تسكينه مرتين. لنقل الموظف لغرفة أخرى، يرجى استخدام خيار (نقل لغرفة أخرى) من صفحة المقيمين بالسكن."
                            : "Cannot be double-assigned. To transfer this employee, use 'Room Move' from the In-House page."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1 rtl:rotate-180" />{ar ? "رجوع" : "Back"}</Button>
                <Button onClick={() => setStep(3)} disabled={!selectedProfile}>{ar ? "التالي" : "Next"}<ChevronRight className="w-4 h-4 ml-1 rtl:rotate-180" /></Button>
              </div>
            </div>
          )}

          {/* STEP 2B: FULL NEW PROFILE FORM (EXACTLY LIKE ADD PROFILE) */}
          {step === 2 && personMode === "new" && (
            <div className="space-y-5 py-2">
              {/* Photo Picker */}
              <div className="flex justify-center">
                <div className="relative group">
                  <div
                    className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center overflow-hidden bg-muted cursor-pointer hover:border-primary transition-colors shadow-xs"
                    onClick={() => photoRef.current?.click()}
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Camera className="w-7 h-7" />
                        <span className="text-xs text-center leading-tight px-1 font-medium">
                          {ar ? "إضافة\nصورة" : "Add\nPhoto"}
                        </span>
                      </div>
                    )}
                  </div>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                </div>
              </div>

              {/* Third-Party Profile Banner */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 text-xs font-semibold shadow-2xs">
                <Users className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
                <span>{ar ? "ملف موظف طرف ثالث جديد (مقاول / مورد / شركة خارجية)" : "New Third-Party Profile (Contractor / Vendor)"}</span>
              </div>

              {/* Section 1: Personal Information (الاسم رباعي والهوية والاتصال) */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{ar ? "1. البيانات الشخصية الأساسية" : "1. Personal Information"}</p>
                  <span className="text-xs text-muted-foreground font-mono">{newForm.profileId}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "كود الموظف *" : "Profile Code *"}</Label>
                    <Input value={newForm.profileId} onChange={(e) => setNewForm((f) => ({ ...f, profileId: e.target.value }))} placeholder={ar ? "مثال: EMP-001" : "e.g. EMP-001"} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الاسم الأول *" : "First Name *"}</Label>
                    <Input value={newForm.firstName} onChange={(e) => setNewForm((f) => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الاسم الثاني *" : "Second Name *"}</Label>
                    <Input value={newForm.lastName} onChange={(e) => setNewForm((f) => ({ ...f, lastName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الاسم الثالث" : "Third Name"}</Label>
                    <Input value={newForm.thirdName} onChange={(e) => setNewForm((f) => ({ ...f, thirdName: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الاسم الرابع" : "Fourth Name"}</Label>
                    <Input value={newForm.fourthName} onChange={(e) => setNewForm((f) => ({ ...f, fourthName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "رقم الهوية / الإقامة *" : "National ID *"}</Label>
                    <Input value={newForm.nationalId} onChange={(e) => setNewForm((f) => ({ ...f, nationalId: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الجنسية" : "Nationality"}</Label>
                    <Select value={newForm.nationality || "none"} onValueChange={(v) => setNewForm((f) => ({ ...f, nationality: v === "none" ? "" : v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {nationalityValues.length > 0 ? nationalityValues.map((n: any) => (<SelectItem key={n.id} value={n.value}>{n.value}</SelectItem>)) : ["Egyptian", "Saudi", "Emirati", "Jordanian", "Other"].map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الهاتف *" : "Phone *"}</Label>
                    <Input value={newForm.phone} onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+201..." />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الجنس" : "Gender"}</Label>
                    <Select value={newForm.gender || "M"} onValueChange={(v) => setNewForm((f) => ({ ...f, gender: v }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">{ar ? "ذكر" : "Male"}</SelectItem>
                        <SelectItem value="F">{ar ? "أنثى" : "Female"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "تاريخ الميلاد" : "Date of Birth"}</Label>
                    <DateInput value={newForm.dateOfBirth} onChange={(iso) => setNewForm((f) => ({ ...f, dateOfBirth: iso }))} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "العنوان" : "Address"}</Label>
                    <Input value={newForm.address} onChange={(e) => setNewForm((f) => ({ ...f, address: e.target.value }))} placeholder={ar ? "العنوان بالكامل..." : "Full address..."} className="h-9" />
                  </div>
                </div>
              </div>

              {/* Section 2: Work & Company Information (بيانات العمل والشركة للطرف الثالث) */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-4 shadow-2xs">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-primary" />
                  {ar ? "2. بيانات العمل والشركة (طرف ثالث)" : "2. Work & Company Information (Third-Party)"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {ar ? "اسم الشركة (المقاول / المورد) *" : "Company Name (Contractor / Vendor) *"} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={newForm.companyName}
                      onChange={(e) => setNewForm((f) => ({ ...f, companyName: e.target.value }))}
                      placeholder={ar ? "أدخل اسم شركة المقاول أو المورد..." : "Enter contractor/vendor company..."}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {ar ? "الوظيفة / المهنة *" : "Job / Occupation *"} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={newForm.jobTitle}
                      onChange={(e) => setNewForm((f) => ({ ...f, jobTitle: e.target.value }))}
                      placeholder={ar ? "مثال: أمن وحراسة، فني، نظافة، سائق..." : "e.g. Security, Tech, Cleaner..."}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: ID Documents & Passports (مستندات وصور الهوية) */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{ar ? "3. صور الهوية وجواز السفر والمستندات" : "3. ID Documents & Passport Attachments"}</p>
                  <span className="text-xs font-medium text-primary">{(newForm.idDocuments || []).length} {ar ? "مرفقات" : "files"}</span>
                </div>
                <input ref={docsRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleDocSelect} />
                <Button type="button" variant="outline" onClick={() => docsRef.current?.click()} className="w-full border-dashed h-11 gap-2 bg-background hover:bg-muted font-medium">
                  <FileText className="w-4 h-4 text-primary" />
                  {ar ? "+ رفع صور البطاقة أو جواز السفر أو عقود العمل" : "+ Upload ID Cards, Passports or Contract Documents"}
                </Button>
                {newForm.idDocuments && newForm.idDocuments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                    {newForm.idDocuments.map((doc, i) => (
                      <div key={i} className="relative group border rounded-lg overflow-hidden h-28 flex flex-col justify-between bg-card shadow-xs">
                        <div className="relative h-20 w-full bg-muted/30 overflow-hidden flex items-center justify-center">
                          {doc.fileData.startsWith("data:image") ? (
                            <img src={doc.fileData} alt={doc.fileName} className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-muted-foreground"><span className="text-xs font-mono font-bold">PDF</span></div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeDoc(i); }}
                            className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full flex items-center justify-center shadow transition-transform active:scale-90 z-20"
                            title={ar ? "حذف هذا المستند" : "Remove document"}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="p-1.5 bg-background border-t">
                          <span className="text-[11px] font-medium truncate block" title={doc.fileName}>{doc.fileName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1 rtl:rotate-180" />{ar ? "رجوع" : "Back"}</Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={
                    !newForm.firstName?.trim() ||
                    !newForm.lastName?.trim() ||
                    !newForm.nationalId?.trim() ||
                    !newForm.phone?.trim() ||
                    !newForm.companyName?.trim() ||
                    !newForm.jobTitle?.trim()
                  }
                  className="font-semibold"
                >
                  {ar ? "التالي (تحديد الغرفة)" : "Next (Select Room)"}<ChevronRight className="w-4 h-4 ml-1 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: ROOM & BED SELECTION */}
          {step === 3 && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>{ar ? "تاريخ الدخول" : "Check-in"} <span className="text-destructive">*</span></Label><DateInput value={checkInDate} onChange={(iso) => setCheckInDate(iso)} /></div>
                <div className="space-y-1.5">
                  <Label>{ar ? "المغادرة المتوقعة" : "Expected Check-out"}</Label>
                  <DateInput value={expectedCheckOut} onChange={(iso) => setExpectedCheckOut(iso)} min={checkInDate} />
                  {((selectedProfile?.employmentType !== "THIRD_PARTY" && selectedProfile?.contractEndDate) || (newForm.employmentType === "INTERNAL" && newForm.contractEndDate)) && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5 mt-0.5">
                      <FileText className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      <span>{ar ? "مرتبط تلقائياً بتاريخ انتهاء عقد الموظف الداخلي" : "Auto-filled from employee's Contract End Date"}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={searchBuilding} onValueChange={setSearchBuilding}>
                  <SelectTrigger className="flex-1 h-9 text-sm">
                    <SelectValue placeholder={ar ? "المبنى" : "Building"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{ar ? "كل المباني" : "All Buildings"}</SelectItem>
                    {buildings.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={searchFloor} onValueChange={setSearchFloor}>
                  <SelectTrigger className="flex-1 h-9 text-sm">
                    <SelectValue placeholder={ar ? "الطابق" : "Floor"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{ar ? "كل الطوابق" : "All Floors"}</SelectItem>
                    {floors
                      .filter((f) => searchBuilding === "all" || f.buildingId === parseInt(searchBuilding))
                      .map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>{f.name || `F${f.floorNumber}`}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  className="flex-1 h-9 text-sm"
                  placeholder={ar ? "رقم الغرفة" : "Room #"}
                  value={searchRoomNumber}
                  onChange={(e) => setSearchRoomNumber(e.target.value)}
                />
                {(searchBuilding !== "all" || searchFloor !== "all" || searchRoomNumber.trim()) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0 border border-dashed"
                    onClick={() => {
                      setSearchBuilding("all");
                      setSearchFloor("all");
                      setSearchRoomNumber("");
                    }}
                    title={ar ? "إلغاء الفلاتر وعرض الكل" : "Reset filters"}
                  >
                    <X className="w-3.5 h-3.5 mr-1 rtl:ml-1 rtl:mr-0" />
                    {ar ? "عرض الكل" : "Show All"}
                  </Button>
                )}
              </div>
              {recommendation && (
                <div className="flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                    <span className="font-semibold">{ar ? "الغرف الموصى بها هي الأنسب بناءً على الملف الشخصي" : "Recommended rooms are best suited based on person's profile"}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    {sortedFilteredRooms.length} {ar ? "غرفة متاحة" : "available"}
                  </span>
                </div>
              )}
              <div className="max-h-64 overflow-y-auto pr-1">
                {sortedFilteredRooms.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed rounded-xl bg-muted/10">
                    <BedDouble className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-semibold text-muted-foreground">
                      {ar ? "لا توجد غرف متاحة تطابق الفلاتر المحددة" : "No available rooms match the selected filters"}
                    </p>
                    {(searchBuilding !== "all" || searchFloor !== "all" || searchRoomNumber.trim()) && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setSearchBuilding("all");
                          setSearchFloor("all");
                          setSearchRoomNumber("");
                        }}
                        className="mt-2 text-xs text-primary"
                      >
                        {ar ? "إعادة ضبط الفلاتر وعرض كل الغرف" : "Reset filters and show all rooms"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {sortedFilteredRooms.map((room) => {
                      const occ = room.currentOccupancy ?? 0;
                      const cap = room.capacity ?? 1;
                      const isFull = occ >= cap;
                      const isSel = selectedRoomId === String(room.id);
                      const rec = recommendation?.recommendedMap[room.id];
                      const freeSpots = Math.max(0, cap - occ);

                      return (
                        <button
                          type="button"
                          key={room.id}
                          disabled={isFull}
                          onClick={() => {
                            setSelectedRoomId(String(room.id));
                            setSelectedBed(cap === 1 ? "1" : "");
                            // Base the top filters on this room
                            if (room.buildingId) setSearchBuilding(String(room.buildingId));
                            if (room.floorId) setSearchFloor(String(room.floorId));
                            setSearchRoomNumber("");
                          }}
                          className={`group relative flex flex-col justify-between p-3 rounded-xl border-2 text-start transition-all duration-200 cursor-pointer ${
                            isSel
                              ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                              : isFull
                              ? "border-border/60 bg-muted/40 opacity-60 cursor-not-allowed"
                              : rec?.levelMatch
                              ? "border-amber-300 dark:border-amber-800/80 bg-amber-50/30 dark:bg-amber-950/20 hover:border-primary/60 hover:bg-muted/30"
                              : "border-border bg-card hover:border-primary/60 hover:bg-muted/30"
                          }`}
                        >
                          {/* Header: Room Number + Selection or Recommendation Status */}
                          <div className="flex items-start justify-between gap-1.5 w-full">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                                  isSel
                                    ? "bg-primary text-primary-foreground"
                                    : rec?.levelMatch
                                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                    : "bg-muted text-foreground"
                                }`}
                              >
                                <BedDouble className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <span className="font-extrabold text-sm font-mono tracking-tight block truncate">
                                  {ar ? `غرفة ${room.roomNumber}` : `Room ${room.roomNumber}`}
                                </span>
                                <span className="text-[10px] text-muted-foreground block truncate">
                                  {room.roomType || (ar ? "قياسية" : "Standard")}
                                </span>
                              </div>
                            </div>

                            {isSel ? (
                              <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-2xs">
                                <CheckCircle className="w-3.5 h-3.5" />
                              </div>
                            ) : rec?.levelMatch ? (
                              <div
                                className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"
                                title={ar ? (rec.badgeLabelAr || "موصى بها") : (rec.badgeLabelEn || "Recommended")}
                              >
                                <Sparkles className="w-3 h-3" />
                              </div>
                            ) : null}
                          </div>

                          {/* Badges: Recommendation / Classification */}
                          <div className="my-2 flex flex-wrap gap-1 min-h-[22px] items-center">
                            {rec?.levelMatch ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100/90 text-amber-900 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 truncate max-w-full">
                                <Sparkles className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                <span className="truncate">{ar ? (rec.badgeLabelAr || "موصى بها") : (rec.badgeLabelEn || "Recommended")}</span>
                              </span>
                            ) : room.classification ? (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium border truncate max-w-full ${
                                  room.classification.toLowerCase().includes("deluxe")
                                    ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                    : room.classification.toLowerCase().includes("superior")
                                    ? "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                    : room.classification.toLowerCase().includes("family")
                                    ? "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                    : "bg-muted text-foreground border-border"
                                }`}
                              >
                                {room.classification}
                              </span>
                            ) : null}
                          </div>

                          {/* Footer: Building/Floor location & Occupancy */}
                          <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10.5px] text-muted-foreground w-full">
                            <span className="truncate max-w-[60%]" title={`${buildingMap[room.buildingId] || "—"} • F${floorMap[room.floorId]?.number ?? "—"}`}>
                              {buildingMap[room.buildingId] || "—"} {floorMap[room.floorId]?.number ? `• F${floorMap[room.floorId]?.number}` : ""}
                            </span>
                            <span
                              className={`font-semibold shrink-0 px-1.5 py-0.5 rounded text-[10px] ${
                                isFull
                                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                  : freeSpots === cap
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              }`}
                            >
                              {occ}/{cap} {ar ? "سرير" : "beds"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SELECTION: BED OR ENTIRE ROOM */}
              {selectedRoomId && isMultiBed && (
                <div className="space-y-3 p-3.5 rounded-xl border bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">
                      {ar ? "تحديد السرير أو الغرفة كاملة" : "Bed or Full Room Selection"} <span className="text-destructive">*</span>
                    </Label>
                    <span className="text-xs text-primary font-medium inline-flex items-center gap-1">
                      {selectedBed === "ALL" ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{ar ? "تم اختيار الغرفة كاملة" : "Full room selected"}</span>
                        </>
                      ) : selectedBed ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{ar ? `تم اختيار سرير رقم ${selectedBed}` : `Bed ${selectedBed} selected`}</span>
                        </>
                      ) : (
                        <span className="text-destructive font-semibold">{ar ? "مطلوب التحديد" : "Selection required"}</span>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedBed("ALL")}
                      className={`p-3 rounded-lg border-2 text-sm font-semibold flex items-center justify-between transition-all ${
                        selectedBed === "ALL"
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                          : "border-border hover:border-primary/50 hover:bg-background"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold">{ar ? "حجز الغرفة بالكامل (خاص)" : "Entire Room (Full Lock)"}</span>
                      </div>
                      {selectedBed === "ALL" && <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />}
                    </button>

                    <div className="flex items-center text-[11px] text-muted-foreground px-1 leading-tight">
                      {ar
                        ? "اختر (الغرفة كاملة) لحجز كل الأسِرّة لحساب هذا النزيل، أو حدد سرير محدد بالأسفل."
                        : "Select Entire Room to reserve all beds, or pick an individual bed below."}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs text-muted-foreground font-medium">{ar ? "أو اختر سرير محدد:" : "Or select a specific bed:"}</span>
                    <div className="flex flex-wrap gap-2">
                      {bedOptions.map((bed) => {
                        const isOcc = occupiedBeds.has(bed);
                        const isSel = selectedBed === String(bed);
                        return (
                          <button
                            key={bed}
                            type="button"
                            disabled={isOcc}
                            onClick={() => setSelectedBed(String(bed))}
                            className={`min-w-[50px] h-10 px-3 rounded-lg border-2 text-xs font-bold transition-all ${
                              isSel
                                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                : isOcc
                                ? "border-border bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                                : "border-border hover:border-primary hover:bg-primary/10"
                            }`}
                          >
                            {ar ? `سرير ${bed}` : `Bed ${bed}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5"><Label>{ar ? "ملاحظات" : "Notes"}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={ar ? "أي ملاحظات إضافية..." : "Any additional notes..."} /></div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4 mr-1 rtl:rotate-180" />{ar ? "رجوع" : "Back"}</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    createAssignmentMutation.isPending ||
                    createReservationMutation.isPending ||
                    !selectedRoomId ||
                    (isMultiBed && !selectedBed)
                  }
                  className="font-semibold"
                >
                  {createAssignmentMutation.isPending || createReservationMutation.isPending
                    ? (ar ? "جاري الحفظ والتسكين..." : "Processing...")
                    : bookingType === "direct"
                    ? (ar ? "تأكيد وتسكين فوري" : "Confirm & Assign Now")
                    : (ar ? "إنشاء حجز مستقبلي" : "Create Future Reservation")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CHECK-IN DIALOG */}
      <Dialog open={checkinDialog.open} onOpenChange={(o) => !o && setCheckinDialog({ open: false, id: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{ar ? "تسكين الحجز" : "Check-In"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {checkinDialog.guestName && <p className="text-sm">{ar ? "الضيف:" : "Guest:"} <span className="font-semibold">{checkinDialog.guestName}</span></p>}
            <Input placeholder={ar ? "بحث عن غرفة..." : "Search room..."} value={checkinRoomSearch} onChange={(e) => setCheckinRoomSearch(e.target.value)} />
            <div className="max-h-52 overflow-y-auto space-y-2">
              {filteredCheckinRooms.map((r: any) => (
                <button key={r.id} onClick={() => setCheckinRoomId(String(r.id))} className={`w-full flex items-center gap-3 p-3 border-2 rounded-lg text-sm text-left rtl:text-right transition-all ${checkinRoomId === String(r.id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                  <BedDouble className="w-4 h-4 text-muted-foreground" />
                  <div><p className="font-medium">{ar ? "غرفة" : "Room"} {r.roomNumber}</p><p className="text-xs text-muted-foreground">{buildingMap[r.buildingId] || "—"} • {r.roomType || "—"} • {r.currentOccupancy ?? 0}/{r.capacity ?? 1}</p></div>
                  {checkinRoomId === String(r.id) && <CheckCircle className="w-4 h-4 text-primary ml-auto rtl:ml-0 rtl:mr-auto" />}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCheckinDialog({ open: false, id: null })}>{ar ? "إلغاء" : "Cancel"}</Button>
              <Button onClick={handleCheckin} disabled={!checkinRoomId || checkinMutation.isPending}>{checkinMutation.isPending ? (ar ? "جاري التسكين..." : "...") : (ar ? "تسكين" : "Check-In")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={editDialog.open} onOpenChange={(o) => !o && setEditDialog({ open: false, reservation: null })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{ar ? "تعديل الحجز" : "Edit Reservation"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{ar ? "الاسم الأول" : "First Name"}</Label><Input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>{ar ? "اسم العائلة" : "Last Name"}</Label><Input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>{ar ? "رقم الهوية" : "ID Card"}</Label><Input value={editForm.guestIdCardNumber} onChange={(e) => setEditForm((f) => ({ ...f, guestIdCardNumber: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>{ar ? "الهاتف" : "Phone"}</Label><Input value={editForm.guestPhone} onChange={(e) => setEditForm((f) => ({ ...f, guestPhone: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>{ar ? "تاريخ الدخول" : "Check-in"}</Label><DateInput value={editForm.checkInDate} onChange={(iso) => setEditForm((f) => ({ ...f, checkInDate: iso }))} /></div>
              <div className="space-y-1.5"><Label>{ar ? "تاريخ المغادرة" : "Check-out"}</Label><DateInput value={editForm.checkOutDate} onChange={(iso) => setEditForm((f) => ({ ...f, checkOutDate: iso }))} /></div>
              <div className="space-y-1.5"><Label>{ar ? "القسم" : "Department"}</Label>
                <Select value={editForm.department || "none"} onValueChange={(v) => setEditForm((f) => ({ ...f, department: v === "none" ? "" : v, jobTitle: "" }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">—</SelectItem>{departmentValues.map((d: any) => (<SelectItem key={d.id} value={d.value}>{d.value}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>{ar ? "المسمى الوظيفي" : "Job Title"}</Label>
                <Select value={editForm.jobTitle || "none"} onValueChange={(v) => setEditForm((f) => ({ ...f, jobTitle: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">—</SelectItem>{filteredEditJobTitles.map((t: any) => (<SelectItem key={t.id} value={t.value}>{t.value}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "نوع النزيل (الجهة)" : "Resident Type"}</Label>
                <Select
                  value={editForm.employmentType || "INTERNAL"}
                  onValueChange={(v) =>
                    setEditForm((f) => ({
                      ...f,
                      employmentType: v,
                      department: v === "THIRD_PARTY" && !f.department ? (ar ? "طرف ثالث" : "Third Party") : f.department,
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTERNAL">{ar ? "موظف داخلي" : "Internal Employee"}</SelectItem>
                    <SelectItem value="THIRD_PARTY">{ar ? "طرف ثالث" : "Third Party"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editForm.employmentType === "THIRD_PARTY" && (
                <div className="space-y-1.5 col-span-2">
                  <Label>{ar ? "اسم الشركة / الجهة الخارجية" : "Company Name"}</Label>
                  <Input
                    placeholder={ar ? "اسم الشركة التابع لها النزيل" : "Company / Contractor Name"}
                    value={editForm.companyName || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5"><Label>{ar ? "ملاحظات" : "Notes"}</Label><Textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialog({ open: false, reservation: null })}>{ar ? "إلغاء" : "Cancel"}</Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>{updateMutation.isPending ? (ar ? "جاري..." : "...") : (ar ? "حفظ" : "Save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{ar ? "حذف الحجز؟" : "Delete?"}</AlertDialogTitle><AlertDialogDescription>{ar ? "لا يمكن التراجع عن هذا الإجراء." : "This cannot be undone."}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>{ar ? "حذف" : "Delete"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* KEY PROMPT */}
      <Dialog open={keyPromptOpen} onOpenChange={setKeyPromptOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Key className="w-5 h-5 text-primary" />{ar ? "تم التسكين بنجاح!" : "Assignment Successful!"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{ar ? "هل تريد إصدار مفتاح الغرفة أو طباعة خطاب السكن؟" : "Issue a room key or print the housing letter?"}</p>
            {lastAssignment && (
              <KeyManagementPanel
                assignmentId={lastAssignment?.id || lastAssignment?.data?.id}
                roomId={lastAssignment?.roomId || lastAssignment?.data?.roomId}
                propertyId={activePropertyId}
                checkInDate={checkInDate}
                checkOutDate={expectedCheckOut || selectedProfile?.contractEndDate || (newForm.employmentType === "INTERNAL" ? newForm.contractEndDate : undefined)}
                ar={ar}
              />
            )}
            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => { const p = selectedProfile || (newForm.firstName ? { firstName: newForm.firstName, lastName: newForm.lastName, department: newForm.department, jobTitle: newForm.jobTitle, nationalId: newForm.nationalId } : null); if (p && lastAssignment) printHousingLetter(p, lastAssignment); }} className="gap-2"><Printer className="w-4 h-4" />{ar ? "طباعة خطاب السكن" : "Print Housing Letter"}</Button>
              <Button onClick={() => { setKeyPromptOpen(false); setLocation("/accommodation/in-house"); }}>{ar ? "عرض المقيمين" : "View In-House"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PrintLanguageDialog open={langDialogOpen} onSelect={handleSelect} onCancel={handleCancel} />
    </div>
  );
}
