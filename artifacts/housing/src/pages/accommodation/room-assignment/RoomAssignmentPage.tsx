import {
  recommendBestRooms,
  checkPolicyCompliance,
} from "@/lib/room-recommender";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateAssignment,
  useListProperties,
  getListAssignmentsQueryKey,
  getListRoomsQueryKey,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { useLocation } from "wouter";
import { BedDouble } from "lucide-react";
import { usePermission } from "@/hooks/use-permission";
import { PermissionGate } from "@/components/ui/permission-gate";
import { generateHousingLetterPdf } from "@/lib/pdf-utils";
import {
  usePrintLanguage,
  PrintLanguageDialog,
} from "@/lib/PrintLanguageDialog";
import { type ProfileResult, getBedOptions } from "../shared/profile-search";
import type { FloorInfo, VacationPromptData } from "./types";
import { useRoomAssignmentQueries } from "./hooks/useRoomAssignmentQueries";
import {
  buildRoomActiveAssignmentsMap,
  buildEntireRoomOccupiedSet,
  buildSingleOccupantRoomsMap,
  buildSelectedRoomBedMap,
  getAvailableRooms,
  filterRooms,
  sortRoomsByRecommendation,
  findFirstFreeBed,
} from "./utils/room-occupancy";
import { describeAssignmentError } from "./utils/assignment-errors";
import { ProfileSearchCard } from "./components/ProfileSearchCard";
import { RecommendationBanner } from "./components/RecommendationBanner";
import { TargetPropertySelect } from "./components/TargetPropertySelect";
import { RoomFiltersBar } from "./components/RoomFiltersBar";
import { RoomSelect } from "./components/RoomSelect";
import { PolicyViolationAlert } from "./components/PolicyViolationAlert";
import { SelectedRoomInfo } from "./components/SelectedRoomInfo";
import { FullLockToggle } from "./components/FullLockToggle";
import { BedSelector } from "./components/BedSelector";
import { PolicyExceptionNotice } from "./components/PolicyExceptionNotice";
import { KeyIssuancePromptDialog } from "./components/KeyIssuancePromptDialog";
import { VacationOverrideDialog } from "./components/VacationOverrideDialog";
import { CrossPropertyConfirmDialog } from "./components/CrossPropertyConfirmDialog";
import { PolicyExceptionDialog } from "./components/PolicyExceptionDialog";

export default function RoomAssignment() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();

  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const ar = language === "ar";
  const { langDialogOpen, openDialog, handleSelect, handleCancel } =
    usePrintLanguage();

  const [empSearch, setEmpSearch] = useState("");
  const [empResults, setEmpResults] = useState<ProfileResult[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileResult | null>(
    null,
  );
  const [isFamilyHousing, setIsFamilyHousing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchPropertyId, setSearchPropertyId] = useState<string>(
    activePropertyId && activePropertyId !== "all"
      ? String(activePropertyId)
      : "all",
  );
  const [targetPropertyId, setTargetPropertyId] = useState<string>(() =>
    activePropertyId && activePropertyId !== "all"
      ? String(activePropertyId)
      : "",
  );

  const { data: _pData } = useListProperties({
    query: { queryKey: ["/api/properties"] },
  });
  const allProperties = _pData || [];

  useEffect(() => {
    // Default search to "all" so cross-property employees are discovered immediately by name/code
    setSearchPropertyId("all");
    if (activePropertyId && activePropertyId !== "all") {
      setTargetPropertyId(String(activePropertyId));
    } else if (activePropertyId === "all" || !activePropertyId) {
      if (allProperties && allProperties.length > 0 && !targetPropertyId) {
        setTargetPropertyId(String(allProperties[0].id));
      }
    } else if (allProperties && allProperties.length === 1) {
      setTargetPropertyId(String(allProperties[0].id));
    }
  }, [activePropertyId, allProperties]);

  const effectiveTargetPropId =
    Number(targetPropertyId) ||
    (typeof activePropertyId === "number" ? activePropertyId : 1);

  const {
    settings,
    profilesList,
    roomsQuery,
    rooms,
    buildings,
    floors,
    allAssignments,
  } = useRoomAssignmentQueries({ activePropertyId, effectiveTargetPropId });

  const activeProp = allProperties.find((p: any) => p.id === activePropertyId);
  const targetProp =
    allProperties.find((p: any) => p.id === effectiveTargetPropId) ||
    activeProp;

  const [transferType, setTransferType] = useState<"PERMANENT" | "TASK_FORCE">(
    "PERMANENT",
  );
  const [archiveSourceProfile, setArchiveSourceProfile] =
    useState<boolean>(true);
  const [crossPropertyModalOpen, setCrossPropertyModalOpen] =
    useState<boolean>(false);
  const [customPhone, setCustomPhone] = useState("");
  const [policyOverride, setPolicyOverride] = useState<boolean>(false);
  const [policyOverrideReason, setPolicyOverrideReason] = useState<string>("");
  const [policyApprovedBy, setPolicyApprovedBy] = useState<string>("");
  const [policyExceptionModalOpen, setPolicyExceptionModalOpen] =
    useState<boolean>(false);
  const isCrossProperty = Boolean(
    selectedProfile &&
    ((selectedProfile.propertyId &&
      Number(selectedProfile.propertyId) !== effectiveTargetPropId) ||
      (selectedProfile.propertyName &&
        targetProp?.name &&
        selectedProfile.propertyName.trim().toLowerCase() !==
          targetProp?.name.trim().toLowerCase())),
  );

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedRoomId, setSelectedRoomId] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("roomId") || "";
    } catch {
      return "";
    }
  });
  const [selectedBed, setSelectedBed] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("bed") || "";
    } catch {
      return "";
    }
  });
  const [checkInDate, setCheckInDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [expectedCheckOut, setExpectedCheckOut] = useState("");
  const [notes, setNotes] = useState("");
  const [isEntireRoom, setIsEntireRoom] = useState(false);

  // فلاتر الغرف
  const [searchBuilding, setSearchBuilding] = useState("all");
  const [searchFloor, setSearchFloor] = useState("all");
  const [searchRoomNumber, setSearchRoomNumber] = useState("");

  // Key prompt state after successful assignment
  const [keyPromptOpen, setKeyPromptOpen] = useState(false);
  const [keyIssuing, setKeyIssuing] = useState(false);
  const [lastAssignment, setLastAssignment] = useState<any>(null);

  // Vacation temporary assignment prompt state
  const [vacationPromptData, setVacationPromptData] =
    useState<VacationPromptData | null>(null);

  const printHousingLetter = async () => {
    const chosenAr = ar;
    const emp = selectedProfile;
    const assignment = lastAssignment;
    if (!emp || !assignment) return;
    const room = rooms.find(
      (r) => r.id === (assignment.roomId || parseInt(selectedRoomId)),
    );
    const building = room ? buildingMap[room.buildingId] : null;
    const floorNum = room ? floorMap[room.floorId]?.number : null;
    await generateHousingLetterPdf({
      isArabic: chosenAr,
      profile: emp,
      assignment: {
        ...assignment,
        bedNumber: assignment.bedNumber || selectedBed,
      },
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

  useEffect(() => {
    try {
      const urlRoomId = new URLSearchParams(window.location.search).get(
        "roomId",
      );
      if (urlRoomId && rooms.length > 0) {
        const rm = rooms.find((r) => r.id === parseInt(urlRoomId));
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
      (can("accommodation", "override_single_occupancy") ||
        can("reservations", "override_single_occupancy"))),
  );

  // Active assignments indexed by roomId
  const roomActiveAssignmentsMap = useMemo(
    () => buildRoomActiveAssignmentsMap(allAssignments),
    [allAssignments],
  );

  // Build set of rooms occupied entirely by a single resident
  const entireRoomOccupiedSet = useMemo(
    () => buildEntireRoomOccupiedSet(allAssignments),
    [allAssignments],
  );

  // Single occupant rooms: capacity > 1 and currently occupied by exactly 1 person
  const singleOccupantRoomsMap = useMemo(
    () =>
      buildSingleOccupantRoomsMap(
        rooms,
        roomActiveAssignmentsMap,
        entireRoomOccupiedSet,
        ar,
      ),
    [rooms, roomActiveAssignmentsMap, entireRoomOccupiedSet, ar],
  );

  // Bed occupants map for currently selected room
  const selectedRoomBedMap = useMemo(
    () =>
      buildSelectedRoomBedMap(
        selectedRoomId,
        rooms,
        roomActiveAssignmentsMap,
        entireRoomOccupiedSet,
        ar,
      ),
    [
      selectedRoomId,
      rooms,
      roomActiveAssignmentsMap,
      entireRoomOccupiedSet,
      ar,
    ],
  );

  // Build set of occupied bed numbers for the currently selected room
  const occupiedBeds = useMemo(() => {
    return new Set<number>(Array.from(selectedRoomBedMap.keys()));
  }, [selectedRoomBedMap]);

  const buildingMap: Record<number, string> = Object.fromEntries(
    buildings.map((b) => [b.id, b.name]),
  );
  const floorMap: Record<number, FloorInfo> = Object.fromEntries(
    floors.map((f) => [f.id, { name: f.floorNumber, number: f.floorNumber }]),
  );

  // استبعاد الغرف غير الصالحة للسكن (صيانة، خارج الخدمة، خارج النظام)
  const availableRooms = getAvailableRooms(rooms);

  // الغرف بعد تطبيق الفلاتر
  const filteredRooms = filterRooms(
    availableRooms,
    searchBuilding,
    searchFloor,
    searchRoomNumber,
  );

  const recommendation = useMemo(() => {
    if (!selectedProfile || !rooms.length) return null;
    return recommendBestRooms({
      profile: {
        ...selectedProfile,
        isFamily: isFamilyHousing,
      },
      rooms,
      assignments: allAssignments,
      profiles: profilesList,
      policySettings: settings,
      preferences: {
        isFamily: isFamilyHousing,
      },
    });
  }, [
    selectedProfile,
    rooms,
    allAssignments,
    profilesList,
    settings,
    isFamilyHousing,
  ]);

  // Pre-sort filtered rooms so recommended ones appear first
  const sortedFilteredRooms = useMemo(
    () => sortRoomsByRecommendation(filteredRooms, recommendation),
    [filteredRooms, recommendation],
  );

  // Auto-Select best compliant room based on level and department policy
  useEffect(() => {
    if (selectedProfile && recommendation?.bestRoom && !selectedRoomId) {
      setSelectedRoomId(String(recommendation.bestRoom.id));
      const r = recommendation.bestRoom;
      const opts = getBedOptions(r.roomType, r.capacity);
      if (opts.length > 0) {
        setSelectedBed(String(opts[0]));
      }
    }
  }, [selectedProfile?.id, recommendation?.bestRoom?.id, selectedRoomId]);

  const selectedRoom = rooms.find((r) => r.id === parseInt(selectedRoomId));
  const bedOptions = selectedRoom
    ? getBedOptions(selectedRoom.roomType, selectedRoom.capacity)
    : [];
  const isMultiBed = bedOptions.length > 1;

  const policyCheck = useMemo(() => {
    if (!selectedProfile || !selectedRoom)
      return { compliant: true, violations: [] };
    return checkPolicyCompliance({
      profile: selectedProfile,
      room: selectedRoom,
      assignments: allAssignments,
      profiles: profilesList,
      policySettings: settings,
      isEntireRoom,
    });
  }, [
    selectedProfile,
    selectedRoom,
    allAssignments,
    profilesList,
    settings,
    isEntireRoom,
  ]);

  const createMutation = useCreateAssignment({
    mutation: {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({
          queryKey: getListAssignmentsQueryKey({
            propertyId: effectiveTargetPropId,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: getListRoomsQueryKey(roomsQuery),
        });
        if (isCrossProperty && selectedProfile?.propertyId) {
          queryClient.invalidateQueries({
            queryKey: getListAssignmentsQueryKey({
              propertyId: selectedProfile.propertyId,
            }),
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/rooms"],
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/assignments"],
          });
        }
        toast.success(
          isCrossProperty
            ? ar
              ? "تم تسكين الموظف ونقل بياناته بنجاح بين الفنادق"
              : "Employee accommodated and synchronized successfully across properties"
            : ar
              ? "تم التسكين بنجاح"
              : "Assignment created successfully",
        );
        // Show key issuance prompt
        setLastAssignment(data);
        setKeyPromptOpen(true);
      },
      onError: async (err: any) => {
        let description = err.message;
        try {
          const body =
            err?.data ||
            (await err?.response
              ?.clone?.()
              ?.json?.()
              .catch(() => null)) ||
            {};
          if (body?.code === "BED_OCCUPANT_ON_VACATION" && body?.canOverride) {
            setVacationPromptData({
              occupantName:
                body.occupantName ||
                (ar ? "الموظف الأصلي" : "Original Occupant"),
              vacationEndDate: body.vacationEndDate,
            });
            return;
          }
          const described = describeAssignmentError(body, ar);
          if (described !== undefined) description = described;
        } catch {}
        toast.error(description || (ar ? "خطأ" : "Error"));
      },
    },
  });

  /* Cross-property profile search */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!empSearch.trim() || empSearch.trim().length < 1) {
      setEmpResults([]);
      setShowDropdown(false);
      return;
    }
    if (
      selectedProfile &&
      empSearch ===
        `${selectedProfile.firstName} ${selectedProfile.lastName} (${selectedProfile.profileId})`
    ) {
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const propParam =
          searchPropertyId && searchPropertyId !== "all"
            ? `&propertyId=${searchPropertyId}`
            : "";
        const resp = await fetch(
          `/api/profiles/search?q=${encodeURIComponent(empSearch.trim())}${propParam}`,
        );
        const data = await resp.json();
        setEmpResults(Array.isArray(data) ? data : []);
        setShowDropdown(true);
      } catch {
        setEmpResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [empSearch, searchPropertyId, activePropertyId]);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectProfile = (emp: ProfileResult) => {
    setSelectedProfile(emp);
    setCustomPhone(emp.phone || "");
    setEmpSearch(`${emp.firstName} ${emp.lastName} (${emp.profileId})`);
    setShowDropdown(false);
  };

  const clearProfile = () => {
    setSelectedProfile(null);
    setCustomPhone("");
    setEmpSearch("");
    setEmpResults([]);
  };

  const handleSubmit = () => {
    if (!selectedProfile) {
      toast.error(ar ? "الرجاء اختيار موظف" : "Please select an profile");
      return;
    }
    if (!selectedRoomId) {
      toast.error(ar ? "الرجاء اختيار غرفة" : "Please select a room");
      return;
    }
    if (!checkInDate) {
      toast.error(
        ar ? "الرجاء تحديد تاريخ الدخول" : "Please set check-in date",
      );
      return;
    }
    if (
      selectedRoom &&
      selectedRoom.capacity > 1 &&
      !isEntireRoom &&
      !selectedBed
    ) {
      toast.error(
        ar
          ? "الرجاء تحديد السرير الذي سيسكن فيه الموظف"
          : "Please select bed number",
      );
      return;
    }
    if (
      selectedBed &&
      occupiedBeds.has(parseInt(selectedBed)) &&
      !isEntireRoom
    ) {
      toast.error(
        ar
          ? "السرير المحدد مشغول حالياً بنزيل آخر. لا يمكن التسكين عليه."
          : "The selected bed is currently occupied. Cannot assign.",
      );
      return;
    }
    if (
      selectedRoom &&
      singleOccupantRoomsMap.has(selectedRoom.id) &&
      !canOverrideSingleOccupancy
    ) {
      toast.error(
        ar
          ? "تسكين نزيل إضافي في غرفة يشغلها شخص بمفرده يتطلب صلاحية إدارية استثنائية (override_single_occupancy)."
          : "Assigning an additional occupant to a single-occupant room requires administrative permission.",
      );
      return;
    }
    if (
      isEntireRoom &&
      selectedRoom &&
      selectedRoom.capacity > 1 &&
      !canOverrideSingleOccupancy
    ) {
      toast.error(
        ar
          ? "حجز الغرفة متعددة الأسِرّة بالكامل لشخص واحد يتطلب صلاحية إدارية استثنائية."
          : "Reserving an entire multi-bed room requires administrative permission.",
      );
      return;
    }

    if (!policyCheck.compliant && !policyOverride) {
      // If policy exceptions require approval, prompt user with the formal approval modal
      setPolicyExceptionModalOpen(true);
      return;
    }

    // If cross-property: OPEN THE EXPLICIT CONFIRMATION MODAL TO ASK THE USER DIRECTLY!
    if (isCrossProperty) {
      setCrossPropertyModalOpen(true);
      return;
    }

    executeAssignment();
  };

  const executeAssignment = (
    archiveOverride?: boolean,
    exceptionData?: { reason?: string; approvedBy?: string },
  ) => {
    if (!selectedProfile || !selectedRoomId) return;
    const finalArchive =
      archiveOverride !== undefined ? archiveOverride : archiveSourceProfile;
    const finalTransferType = finalArchive ? "PERMANENT" : "TASK_FORCE";

    const effReason = exceptionData?.reason || policyOverrideReason;
    const effApprovedBy = exceptionData?.approvedBy || policyApprovedBy;
    const isException =
      policyOverride ||
      Boolean(exceptionData?.reason || exceptionData?.approvedBy);

    const finalNotes =
      isException && effReason
        ? `${notes ? notes + " | " : ""}[استثناء سياسة: ${effReason}${effApprovedBy ? ` | المعتمد: ${effApprovedBy}` : ""}]`
        : notes || undefined;

    createMutation.mutate({
      data: {
        propertyId: effectiveTargetPropId,
        profileId: selectedProfile.id,
        roomId: parseInt(selectedRoomId),
        checkInDate: new Date(checkInDate).toISOString(),
        expectedCheckOutDate: expectedCheckOut
          ? new Date(expectedCheckOut).toISOString()
          : undefined,
        bedNumber: isEntireRoom
          ? selectedBed
            ? parseInt(selectedBed)
            : 1
          : selectedBed
            ? parseInt(selectedBed)
            : selectedRoom?.capacity === 1
              ? 1
              : undefined,
        isEntireRoom: isEntireRoom,
        notes: finalNotes,
        hasPolicyException: isException || undefined,
        policyExceptionReason: isException ? effReason : undefined,
        policyApprovedBy: isException ? effApprovedBy : undefined,
        sourcePropertyId: selectedProfile.propertyId,
        transferType: isCrossProperty ? finalTransferType : undefined,
        archiveSourceProfile: isCrossProperty ? finalArchive : undefined,
        checkoutPreviousAssignment:
          isCrossProperty &&
          Boolean((selectedProfile as any).accommodationRoom),
        phone: customPhone.trim() || undefined,
      } as any,
    });
    setCrossPropertyModalOpen(false);
    setPolicyExceptionModalOpen(false);
  };

  const handleConfirmVacationOverride = () => {
    if (!selectedProfile || !selectedRoomId) return;
    const checkout = expectedCheckOut || vacationPromptData?.vacationEndDate;
    if (!checkout) {
      toast.error(
        ar
          ? "يرجى تحديد تاريخ خروج متوقع للتسكين المؤقت لضمان عدم التعارض مع عودة المقيم الأصلي"
          : "Please set an expected check-out date for the temporary assignment",
      );
      return;
    }

    createMutation.mutate({
      data: {
        propertyId: effectiveTargetPropId,
        profileId: selectedProfile.id,
        roomId: parseInt(selectedRoomId),
        checkInDate: new Date(checkInDate).toISOString(),
        expectedCheckOutDate: new Date(checkout).toISOString(),
        bedNumber: selectedBed
          ? parseInt(selectedBed)
          : selectedRoom?.capacity === 1
            ? 1
            : undefined,
        notes: notes || undefined,
        isTemporaryVacationOverride: true,
        sourcePropertyId: selectedProfile.propertyId,
        transferType: isCrossProperty
          ? archiveSourceProfile
            ? "PERMANENT"
            : "TASK_FORCE"
          : undefined,
        archiveSourceProfile: isCrossProperty
          ? archiveSourceProfile
          : undefined,
        checkoutPreviousAssignment:
          isCrossProperty &&
          Boolean((selectedProfile as any).accommodationRoom),
        phone: customPhone.trim() || undefined,
      } as any,
    });
    setVacationPromptData(null);
  };

  /** Recommendation banner CTA: pick the best room, sync filters and choose the first free bed. */
  const handleSelectRecommendedRoom = () => {
    if (!recommendation?.bestRoom) return;
    const best = recommendation.bestRoom;
    setSelectedRoomId(String(best.id));
    const bId = best.buildingId ?? (best as any).building_id;
    const fId = best.floorId ?? (best as any).floor_id;
    const rNum = best.roomNumber ?? (best as any).room_number;
    if (bId != null) setSearchBuilding(String(bId));
    if (fId != null) setSearchFloor(String(fId));
    if (rNum != null) setSearchRoomNumber(String(rNum));
    // Pick first free bed
    const freeBed = findFirstFreeBed(best, allAssignments);
    if (freeBed) setSelectedBed(String(freeBed));
    toast.success(
      ar
        ? `تم اختيار الغرفة المقترحة رقم ${best.roomNumber} بنجاح`
        : `Selected room ${best.roomNumber}`,
    );
  };

  /** Room picker change: reset full-lock, default the bed and sync filters to the picked room. */
  const handleRoomChange = (v: string) => {
    setSelectedRoomId(v);
    setIsEntireRoom(false);
    const picked = rooms.find((rm) => rm.id === parseInt(v));
    if (picked) {
      if (picked.capacity === 1) {
        setSelectedBed("1");
      } else {
        setSelectedBed("");
      }
      const bId = picked.buildingId ?? (picked as any).building_id;
      const fId = picked.floorId ?? (picked as any).floor_id;
      const rNum = picked.roomNumber ?? (picked as any).room_number;
      if (bId != null) setSearchBuilding(String(bId));
      if (fId != null) setSearchFloor(String(fId));
      if (rNum != null) setSearchRoomNumber(String(rNum));
    } else {
      setSelectedBed("");
    }
  };

  /** Policy exception dialog approve: validate, record override, then continue the flow. */
  const handleApprovePolicyException = () => {
    if (!policyApprovedBy.trim()) {
      toast.error(
        ar
          ? "يرجى تحديد الجهة المعتمدة للاستثناء"
          : "Please specify authorizing authority",
      );
      return;
    }
    if (!policyOverrideReason.trim()) {
      toast.error(
        ar
          ? "يرجى كتابة سبب الاستثناء الإداري"
          : "Please enter exception justification",
      );
      return;
    }
    setPolicyOverride(true);
    toast.success(
      ar ? "تم تسجيل الاستثناء الإداري بنجاح" : "Policy exception recorded",
    );
    setPolicyExceptionModalOpen(false);
    if (isCrossProperty) {
      setCrossPropertyModalOpen(true);
    } else {
      executeAssignment(undefined, {
        reason: policyOverrideReason,
        approvedBy: policyApprovedBy,
      });
    }
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">
          {ar ? "تعيين الغرف" : "Room Assignment"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ar
            ? "تعيين موظف لغرفة محددة مع تحديد السرير عند الحاجة"
            : "Assign an profile to a specific room with optional bed selection"}
        </p>
      </div>

      {/* بطاقة الموظف */}
      <ProfileSearchCard
        ar={ar}
        allProperties={allProperties}
        activePropertyId={activePropertyId}
        effectiveTargetPropId={effectiveTargetPropId}
        targetProp={targetProp}
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
        customPhone={customPhone}
        setCustomPhone={setCustomPhone}
        isFamilyHousing={isFamilyHousing}
        setIsFamilyHousing={setIsFamilyHousing}
        isCrossProperty={isCrossProperty}
        archiveSourceProfile={archiveSourceProfile}
        setArchiveSourceProfile={setArchiveSourceProfile}
        setTransferType={setTransferType}
      />

      {/* ── كارت الترشيح الذكي حسب المستوى ── */}
      {selectedProfile && recommendation?.bestRoom && (
        <RecommendationBanner
          ar={ar}
          recommendation={recommendation}
          onSelectBest={handleSelectRecommendedRoom}
        />
      )}

      {/* بطاقة الغرفة */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-primary" />
              {ar ? "بيانات الغرفة والتسكين" : "Room & Accommodation Details"}
            </CardTitle>

            {/* محدد فندق التسكين المستهدف */}
            {allProperties.length > 1 && (
              <TargetPropertySelect
                ar={ar}
                allProperties={allProperties}
                activePropertyId={activePropertyId}
                targetPropertyId={targetPropertyId}
                onChange={(v) => {
                  setTargetPropertyId(v);
                  setSelectedRoomId("");
                  setSelectedBed("");
                  setSearchBuilding("all");
                  setSearchFloor("all");
                  setSearchRoomNumber("");
                }}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── فلاتر البحث ── */}
          <RoomFiltersBar
            ar={ar}
            buildings={buildings}
            floors={floors}
            searchBuilding={searchBuilding}
            searchFloor={searchFloor}
            searchRoomNumber={searchRoomNumber}
            onBuildingChange={(v) => {
              setSearchBuilding(v);
              setSearchFloor("all");
              setSelectedRoomId("");
              setSelectedBed("");
            }}
            onFloorChange={(v) => {
              setSearchFloor(v);
              setSelectedRoomId("");
              setSelectedBed("");
            }}
            onRoomNumberChange={(v) => {
              setSearchRoomNumber(v);
              setSelectedRoomId("");
              setSelectedBed("");
            }}
            onReset={() => {
              setSearchBuilding("all");
              setSearchFloor("all");
              setSearchRoomNumber("");
            }}
          />

          {/* ── قائمة الغرف المفلترة ── */}
          <RoomSelect
            ar={ar}
            selectedRoomId={selectedRoomId}
            onChange={handleRoomChange}
            filteredRooms={filteredRooms}
            sortedFilteredRooms={sortedFilteredRooms}
            recommendation={recommendation}
            entireRoomOccupiedSet={entireRoomOccupiedSet}
            singleOccupantRoomsMap={singleOccupantRoomsMap}
            canOverrideSingleOccupancy={canOverrideSingleOccupancy}
            buildingMap={buildingMap}
            floorMap={floorMap}
          />

          {/* تنبيه مخالفة سياسة التسكين */}
          {selectedProfile && selectedRoom && !policyCheck.compliant && (
            <PolicyViolationAlert
              ar={ar}
              policyCheck={policyCheck}
              policyOverride={policyOverride}
              setPolicyOverride={setPolicyOverride}
              policyOverrideReason={policyOverrideReason}
              setPolicyOverrideReason={setPolicyOverrideReason}
            />
          )}

          {/* معلومات الغرفة المختارة */}
          {selectedRoom && (
            <SelectedRoomInfo
              ar={ar}
              selectedRoom={selectedRoom}
              buildingMap={buildingMap}
              floorMap={floorMap}
              entireRoomOccupiedSet={entireRoomOccupiedSet}
              singleOccupantRoomsMap={singleOccupantRoomsMap}
            />
          )}

          {/* ── خيار Full Lock: قفل الغرفة بالكامل ── */}
          {selectedRoom && !entireRoomOccupiedSet.has(selectedRoom.id) && (
            <FullLockToggle
              ar={ar}
              selectedRoom={selectedRoom}
              isEntireRoom={isEntireRoom}
              setIsEntireRoom={setIsEntireRoom}
              setSelectedBed={setSelectedBed}
              canOverrideSingleOccupancy={canOverrideSingleOccupancy}
            />
          )}

          {/* ── قسم اختيار السرير: هتسكن في أنهي سرير؟ ── */}
          {selectedRoom && (
            <BedSelector
              ar={ar}
              selectedRoom={selectedRoom}
              bedOptions={bedOptions}
              selectedBed={selectedBed}
              setSelectedBed={setSelectedBed}
              isEntireRoom={isEntireRoom}
              occupiedBeds={occupiedBeds}
              selectedRoomBedMap={selectedRoomBedMap}
            />
          )}

          {/* التواريخ */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {ar ? "تاريخ الدخول" : "Check-in Date"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <DateInput
                value={checkInDate}
                onChange={(iso) => setCheckInDate(iso)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {ar ? "تاريخ الخروج المتوقع" : "Expected Check-out"}
              </label>
              <DateInput
                value={expectedCheckOut}
                onChange={(iso) => setExpectedCheckOut(iso)}
              />
            </div>
          </div>

          {/* ملاحظات */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {ar ? "ملاحظات" : "Notes"}
            </label>
            <Input
              placeholder={
                ar ? "أي ملاحظات إضافية..." : "Any additional notes..."
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Policy Compliance & Exception Notice */}
          {!policyCheck.compliant && (
            <PolicyExceptionNotice
              ar={ar}
              policyCheck={policyCheck}
              policyOverride={policyOverride}
              policyOverrideReason={policyOverrideReason}
              policyApprovedBy={policyApprovedBy}
              onOpenExceptionModal={() => setPolicyExceptionModalOpen(true)}
            />
          )}

          <PermissionGate module="accommodation" action="create">
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={
                createMutation.isPending ||
                !selectedProfile ||
                !selectedRoomId ||
                (!!selectedRoom &&
                  selectedRoom.currentOccupancy >= selectedRoom.capacity)
              }
            >
              {createMutation.isPending
                ? ar
                  ? "جاري التعيين..."
                  : "Assigning..."
                : ar
                  ? "تعيين الغرفة"
                  : "Assign Room"}
            </Button>
          </PermissionGate>
        </CardContent>
      </Card>

      {/* Key Issuance Prompt Dialog */}
      <KeyIssuancePromptDialog
        ar={ar}
        open={keyPromptOpen}
        onOpenChange={(open) => {
          if (!open && keyIssuing) return;
          setKeyPromptOpen(open);
          if (!open) {
            setLocation("/accommodation/in-house");
          }
        }}
        keyIssuing={keyIssuing}
        setKeyIssuing={setKeyIssuing}
        lastAssignment={lastAssignment}
        selectedRoom={selectedRoom}
        selectedProfile={selectedProfile}
        activePropertyId={activePropertyId}
        checkInDate={checkInDate}
        expectedCheckOut={expectedCheckOut}
        onIssueComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
          toast.success(
            ar ? "تم إصدار المفاتيح بنجاح" : "Keys issued successfully",
          );
        }}
        onPrintHousingLetter={printHousingLetter}
        onClose={() => {
          setKeyPromptOpen(false);
          setLocation("/accommodation/in-house");
        }}
      />

      {/* ── ديالوج تأكيد تصريح الإدارة للتسكين المؤقت (بديل إجازة) ── */}
      <VacationOverrideDialog
        ar={ar}
        vacationPromptData={vacationPromptData}
        onCancel={() => setVacationPromptData(null)}
        selectedBed={selectedBed}
        expectedCheckOut={expectedCheckOut}
        setExpectedCheckOut={setExpectedCheckOut}
        onConfirm={handleConfirmVacationOverride}
      />

      {/* ── نافذة تأكيد وسؤال نقل الموظف عبر الفنادق (Cross-Property Transfer Modal) ── */}
      <CrossPropertyConfirmDialog
        ar={ar}
        open={crossPropertyModalOpen}
        onOpenChange={setCrossPropertyModalOpen}
        selectedProfile={selectedProfile}
        targetProp={targetProp}
        archiveSourceProfile={archiveSourceProfile}
        setArchiveSourceProfile={setArchiveSourceProfile}
        setTransferType={setTransferType}
        isPending={createMutation.isPending}
        onConfirm={() => executeAssignment()}
      />

      {/* Policy Exception Approval Dialog */}
      <PolicyExceptionDialog
        ar={ar}
        open={policyExceptionModalOpen}
        onOpenChange={setPolicyExceptionModalOpen}
        policyCheck={policyCheck}
        policyApprovedBy={policyApprovedBy}
        setPolicyApprovedBy={setPolicyApprovedBy}
        policyOverrideReason={policyOverrideReason}
        setPolicyOverrideReason={setPolicyOverrideReason}
        onApprove={handleApprovePolicyException}
      />

      <PrintLanguageDialog
        open={langDialogOpen}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />
    </div>
  );
}
