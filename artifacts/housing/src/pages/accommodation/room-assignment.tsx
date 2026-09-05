import { recommendBestRooms } from "@/lib/room-recommender";
import { Sparkles } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListRooms,
  useCreateAssignment,
  useListBuildings,
  useListFloors,
  useListProperties,
  useListAssignments,
  useGetSettings,
  getListAssignmentsQueryKey,
  getListRoomsQueryKey,
} from "@workspace/api-client-react";
import type { ListRoomsParams } from "@workspace/api-client-react";
import type {
  Room,
  Building,
  Floor,
  Assignment,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Search,
  UserCheck,
  BedDouble,
  Building2,
  Info,
  X,
  CheckCircle2,
  AlertTriangle,
  Key,
  Printer,
  Lock,
} from "lucide-react";
import { usePermission } from "@/hooks/use-permission";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import KeyManagementPanel from "@/components/KeyManagementPanel";
import { generateHousingLetterPdf } from "@/lib/pdf-utils";
import {
  usePrintLanguage,
  PrintLanguageDialog,
} from "@/lib/PrintLanguageDialog";

type ProfileResult = {
  id: number;
  propertyId: number;
  propertyName: string | null;
  profileId: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  jobTitle: string | null;
  department: string | null;
  nationality: string | null;
  phone: string | null;
  level: string | null;
  status: string;
  gender: string | null;
};

const roomTypeCapacity: Record<string, number> = {
  single: 1,
  double: 2,
  triple: 3,
  quad: 4,
};

function getBedOptions(roomType: string, capacity: number): number[] {
  const max = roomTypeCapacity[roomType?.toLowerCase()] ?? capacity;
  return Array.from({ length: max }, (_, i) => i + 1);
}

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
  const [selectedProfile, setSelectedProfile] =
    useState<ProfileResult | null>(null);
  const [isFamilyHousing, setIsFamilyHousing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchPropertyId, setSearchPropertyId] = useState<string>("all");

  const { data: _pData } = useListProperties({
    query: { queryKey: ["/api/properties"] },
  });
  const allProperties = _pData || [];
  const { data: settings } = useGetSettings(undefined, {
    query: {
      queryKey: ["/api/settings"],
      enabled: !!activePropertyId,
    },
  });
  const activeProp = allProperties.find((p: any) => p.id === activePropertyId);
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
  const [vacationPromptData, setVacationPromptData] = useState<{
    occupantName: string;
    vacationEndDate?: string;
  } | null>(null);

  const printHousingLetter = async () => {
    const chosenAr = await openDialog();
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
      propAddress: (activeProp as any)?.address || "",
      systemLogoUrl: (settings as any)?.systemLogo,
      propLogoUrl: (activeProp as any)?.logo,
    });
  };

  // NOTE: backend reads `limit` from the query string even though the
  // generated ListRoomsParams type omits it — keep it via cast (no runtime change).
  const roomsQuery = {
    propertyId: activePropertyId as number,
    limit: 1000,
  } as ListRoomsParams;
  const { data: _rData } = useListRooms(roomsQuery, {
    query: {
      queryKey: ["/api/rooms", roomsQuery],
      enabled: !!activePropertyId,
      staleTime: 30000,
    },
  });
  // NOTE: /api/rooms returns a { data, pagination } envelope (not a bare
  // array), so unwrap .data first. Runtime shape verified in routes/rooms.ts.
  const rooms: Room[] = Array.isArray(_rData)
    ? _rData
    : (((_rData as unknown as { data?: Room[] })?.data as Room[] | undefined) || []);

  useEffect(() => {
    try {
      const urlRoomId = new URLSearchParams(window.location.search).get("roomId");
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
  const { data: _bData } = useListBuildings(
    { propertyId: activePropertyId as number },
    {
      query: {
        queryKey: ["/api/buildings", activePropertyId],
        enabled: !!activePropertyId,
        staleTime: 300000,
      },
    },
  );
  const buildings: Building[] = Array.isArray(_bData)
    ? _bData
    : (((_bData as any)?.data as Building[] | undefined) || []);
  const { data: _fData } = useListFloors(
    { propertyId: activePropertyId as number },
    {
      query: {
        queryKey: ["/api/floors", activePropertyId],
        enabled: !!activePropertyId,
        staleTime: 300000,
      },
    },
  );
  const floors: Floor[] = Array.isArray(_fData)
    ? _fData
    : (((_fData as any)?.data as Floor[] | undefined) || []);
  const { isSuperAdmin, isAdmin, hasRole, can } = usePermission();
  const canOverrideSingleOccupancy =
    isSuperAdmin ||
    isAdmin ||
    hasRole("super_admin") ||
    hasRole("admin") ||
    hasRole("housing_manager") ||
    hasRole("manager") ||
    can("accommodation", "override_single_occupancy") ||
    can("reservations", "override_single_occupancy");

  const { data: _aData } = useListAssignments(
    { propertyId: activePropertyId as number, limit: 5000 } as any,
    {
      query: {
        queryKey: ["/api/assignments", activePropertyId, 5000],
        enabled: !!activePropertyId,
        staleTime: 30000,
      },
    },
  );
  // NOTE: /api/assignments returns a { data, pagination } envelope.
  const allAssignments: Assignment[] = Array.isArray(_aData)
    ? _aData
    : (((_aData as unknown as { data?: Assignment[] })?.data as Assignment[] | undefined) || []);

  // Active assignments indexed by roomId
  const roomActiveAssignmentsMap = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const a of allAssignments) {
      if (a.status === "ACTIVE") {
        const rId = Number(a.roomId);
        if (!map.has(rId)) map.set(rId, []);
        map.get(rId)!.push(a);
      }
    }
    return map;
  }, [allAssignments]);

  // Build set of rooms occupied entirely by a single resident
  const entireRoomOccupiedSet = useMemo(() => {
    const set = new Set<number>();
    allAssignments
      .filter(
        (a: any) =>
          a.status === "ACTIVE" &&
          (a.isEntireRoom || a.is_entire_room),
      )
      .forEach((a: any) => set.add(Number(a.roomId)));
    return set;
  }, [allAssignments]);

  // Single occupant rooms: capacity > 1 and currently occupied by exactly 1 person
  const singleOccupantRoomsMap = useMemo(() => {
    const map = new Map<number, { residentName: string }>();
    for (const room of rooms) {
      const cap = room.capacity ?? 1;
      if (cap <= 1) continue;
      const rId = Number(room.id);
      const activeList = roomActiveAssignmentsMap.get(rId) || [];
      const occ = room.currentOccupancy ?? 0;
      const effectiveOcc = Math.max(occ, activeList.length);
      const isEntire = entireRoomOccupiedSet.has(rId);

      if (effectiveOcc === 1 || (isEntire && cap > 1)) {
        const first = activeList[0];
        const name = first
          ? [first.profileFirstName || first.firstName, first.profileLastName || first.lastName].filter(Boolean).join(" ") || first.employeeName || first.profileName || (ar ? "نزيل مسكن" : "Resident")
          : (ar ? "نزيل بمفرده" : "Single Resident");
        map.set(rId, { residentName: name });
      }
    }
    return map;
  }, [rooms, roomActiveAssignmentsMap, entireRoomOccupiedSet, ar]);

  // Bed occupants map for currently selected room
  const selectedRoomBedMap = useMemo(() => {
    const map = new Map<number, { residentName: string }>();
    if (!selectedRoomId) return map;
    const rId = parseInt(selectedRoomId);
    const room = rooms.find((r: any) => r.id === rId);
    const cap = room?.capacity ?? 1;
    const activeList = roomActiveAssignmentsMap.get(rId) || [];
    const isEntire = entireRoomOccupiedSet.has(rId);

    if (isEntire) {
      for (let b = 1; b <= cap; b++) {
        map.set(b, { residentName: ar ? "محجوز (غرفة كاملة)" : "Occupied (Full Room)" });
      }
      return map;
    }

    const unassigned: string[] = [];
    for (const a of activeList) {
      const name = [a.profileFirstName || a.firstName, a.profileLastName || a.lastName].filter(Boolean).join(" ") || a.employeeName || a.profileName || (ar ? "نزيل مسكن" : "Resident");
      if (a.bedNumber != null && Number(a.bedNumber) > 0) {
        map.set(Number(a.bedNumber), { residentName: name });
      } else {
        unassigned.push(name);
      }
    }

    let nextBed = 1;
    for (const name of unassigned) {
      while (nextBed <= cap && map.has(nextBed)) {
        nextBed++;
      }
      if (nextBed <= cap) {
        map.set(nextBed, { residentName: name });
        nextBed++;
      }
    }

    return map;
  }, [selectedRoomId, rooms, roomActiveAssignmentsMap, entireRoomOccupiedSet, ar]);

  // Build set of occupied bed numbers for the currently selected room
  const occupiedBeds = useMemo(() => {
    return new Set<number>(Array.from(selectedRoomBedMap.keys()));
  }, [selectedRoomBedMap]);

  const buildingMap = Object.fromEntries(buildings.map((b) => [b.id, b.name]));
  const floorMap = Object.fromEntries(
    floors.map((f) => [f.id, { name: f.floorNumber, number: f.floorNumber }]),
  );

  // استبعاد الغرف غير الصالحة للسكن (صيانة، خارج الخدمة، خارج النظام)
  const availableRooms = rooms
    .filter((r) => {
      const s = r.status?.toLowerCase() || "";
      return !["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(s);
    })
    .sort((a, b) => {
      const aFull = a.currentOccupancy >= a.capacity;
      const bFull = b.currentOccupancy >= b.capacity;
      if (aFull && !bFull) return 1;
      if (!aFull && bFull) return -1;
      return 0;
    });

  // الغرف بعد تطبيق الفلاتر
  const filteredRooms = availableRooms.filter((r) => {
    const bId = r.buildingId ?? (r as any).building_id;
    const fId = r.floorId ?? (r as any).floor_id;
    if (searchBuilding !== "all" && String(bId) !== String(searchBuilding))
      return false;
    if (searchFloor !== "all" && String(fId) !== String(searchFloor))
      return false;
    if (
      searchRoomNumber.trim() &&
      !r.roomNumber
        ?.toString()
        .toLowerCase()
        .includes(searchRoomNumber.trim().toLowerCase())
    )
      return false;
    return true;
  });

  const recommendation = useMemo(() => {
    if (!selectedProfile || !rooms.length) return null;
    return recommendBestRooms({
      profile: {
        ...selectedProfile,
        isFamily: isFamilyHousing,
      },
      rooms,
      assignments: allAssignments,
      profiles: [],
      preferences: {
        isFamily: isFamilyHousing,
      },
    });
  }, [selectedProfile, rooms, allAssignments, isFamilyHousing]);

  // Pre-sort filtered rooms so recommended ones appear first
  const sortedFilteredRooms = useMemo(() => {
    if (!recommendation) return filteredRooms;
    return [...filteredRooms].sort((a, b) => {
      const isRecA = recommendation.recommendedMap[a.id]?.levelMatch ? 1 : 0;
      const isRecB = recommendation.recommendedMap[b.id]?.levelMatch ? 1 : 0;
      if (isRecA !== isRecB) return isRecB - isRecA;
      const scoreA = recommendation.recommendedMap[a.id]?.score ?? 0;
      const scoreB = recommendation.recommendedMap[b.id]?.score ?? 0;
      return scoreB - scoreA;
    });
  }, [filteredRooms, recommendation]);


  const selectedRoom = rooms.find((r) => r.id === parseInt(selectedRoomId));
  const bedOptions = selectedRoom
    ? getBedOptions(selectedRoom.roomType, selectedRoom.capacity)
    : [];
  const isMultiBed = bedOptions.length > 1;

  const createMutation = useCreateAssignment({
    mutation: {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({
          queryKey: getListAssignmentsQueryKey({
            propertyId: activePropertyId as number,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: getListRoomsQueryKey(roomsQuery),
        });
        // Show key issuance prompt
        setLastAssignment(data);
        setKeyPromptOpen(true);
      },
      onError: async (err: any) => {
        let description = err.message;
        try {
          const body = err?.data || (await err?.response?.clone?.()?.json?.().catch(() => null)) || {};
          if (body?.code === "BED_OCCUPANT_ON_VACATION" && body?.canOverride) {
            setVacationPromptData({
              occupantName: body.occupantName || (ar ? "الموظف الأصلي" : "Original Occupant"),
              vacationEndDate: body.vacationEndDate,
            });
            return;
          }
          if (body?.code === "BED_TAKEN") {
            description = body.error || (ar
              ? `هذا السرير مشغول بالفعل بمقيم بالسكن. ممنوع منعاً باتاً تسكين شخص فوق شخص على نفس السرير.`
              : `This bed is already occupied. Double-rooming on the same bed is strictly forbidden.`);
          } else if (body?.code === "ROOM_NOT_ELIGIBLE") {
            description = body.error || (ar ? "الغرفة غير صالحة للتسكين حالياً (صيانة / خارج الخدمة)." : "Room is not eligible.");
          } else if (body?.code === "PROFILE_ALREADY_ASSIGNED") {
            description = ar
              ? `الموظف مسكّن بالفعل في غرفة رقم ${body.existingRoomId}. يجب تسجيل الخروج أولاً.`
              : `Profile already assigned to room ${body.existingRoomId}. Please check out first.`;
          } else if (body?.code === "ROOM_ENTIRE_OCCUPIED") {
            description = body.error || (ar
              ? "هذه الغرفة مخصصة بالكامل لموظف آخر (استخدام فردي) ولا يمكن تسكين أي شخص إضافي عليها."
              : "This room is reserved as an entire room for another resident.");
          } else if (body?.code === "ROOM_NOT_EMPTY_FOR_ENTIRE") {
            description = body.error || (ar
              ? "لا يمكن تخصيص الغرفة بالكامل لوجود مقيمين حاليين بها."
              : "Room already has active occupants.");
          } else if (body?.code === "ROOM_FULL") {
            description = ar ? `الغرفة وصلت للحد الأقصى لطاقتها الاستيعابية.` : `Room is full.`;
          } else if (body?.error) {
            description = body.error;
          }
        } catch {}
        toast.error(description || (ar ? "خطأ" : "Error"));
      },
    },
  });

  /* Cross-property profile search */
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
        const propParam =
          searchPropertyId !== "all" ? `&propertyId=${searchPropertyId}` : "";
        const resp = await fetch(
          `/api/profiles/search?q=${encodeURIComponent(empSearch.trim())}${propParam}`,
        );
        const data = await resp.json();
        setEmpResults(data);
        setShowDropdown(true);
      } catch {
        setEmpResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [empSearch, searchPropertyId]);

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
    setEmpSearch(`${emp.firstName} ${emp.lastName} (${emp.profileId})`);
    setShowDropdown(false);
  };

  const clearProfile = () => {
    setSelectedProfile(null);
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
    if (isMultiBed && !isEntireRoom && !selectedBed) {
      toast.error(ar ? "الرجاء تحديد رقم السرير" : "Please select bed number");
      return;
    }
    if (isMultiBed && !isEntireRoom && occupiedBeds.has(parseInt(selectedBed))) {
      toast.error(
        ar
          ? "السرير المحدد مشغول حالياً بنزيل آخر. لا يمكن التسكين عليه."
          : "The selected bed is currently occupied. Cannot assign.",
      );
      return;
    }
    if (selectedRoom && singleOccupantRoomsMap.has(selectedRoom.id) && !canOverrideSingleOccupancy) {
      toast.error(
        ar
          ? "تسكين نزيل إضافي في غرفة يشغلها شخص بمفرده يتطلب صلاحية إدارية استثنائية (override_single_occupancy)."
          : "Assigning an additional occupant to a single-occupant room requires administrative permission.",
      );
      return;
    }
    if (isEntireRoom && selectedRoom && selectedRoom.capacity > 1 && !canOverrideSingleOccupancy) {
      toast.error(
        ar
          ? "حجز الغرفة متعددة الأسِرّة بالكامل لشخص واحد يتطلب صلاحية إدارية استثنائية."
          : "Reserving an entire multi-bed room requires administrative permission.",
      );
      return;
    }

    createMutation.mutate({
      data: {
        propertyId: activePropertyId!,
        profileId: selectedProfile.id,
        roomId: parseInt(selectedRoomId),
        checkInDate: new Date(checkInDate).toISOString(),
        expectedCheckOutDate: expectedCheckOut
          ? new Date(expectedCheckOut).toISOString()
          : undefined,
        bedNumber: isEntireRoom ? (selectedBed ? parseInt(selectedBed) : 1) : (selectedBed ? parseInt(selectedBed) : undefined),
        isEntireRoom: isEntireRoom,
        notes: notes || undefined,
      } as any,
    });
  };

  const handleConfirmVacationOverride = () => {
    if (!selectedProfile || !selectedRoomId) return;
    const checkout = expectedCheckOut || vacationPromptData?.vacationEndDate;
    if (!checkout) {
      toast.error(
        ar
          ? "يرجى تحديد تاريخ خروج متوقع للتسكين المؤقت لضمان عدم التعارض مع عودة المقيم الأصلي"
          : "Please set an expected check-out date for the temporary assignment"
      );
      return;
    }

    createMutation.mutate({
      data: {
        propertyId: activePropertyId!,
        profileId: selectedProfile.id,
        roomId: parseInt(selectedRoomId),
        checkInDate: new Date(checkInDate).toISOString(),
        expectedCheckOutDate: new Date(checkout).toISOString(),
        bedNumber: selectedBed ? parseInt(selectedBed) : undefined,
        notes: notes || undefined,
        isTemporaryVacationOverride: true,
      } as any,
    });
    setVacationPromptData(null);
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            {ar ? "بيانات الموظف" : "Profile"}
          </CardTitle>
          <CardDescription>
            {ar ? "ابحث عن موظف من أي فرع" : "Search across all properties"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allProperties.length > 1 && (
            <div className="mb-3">
              <Select
                value={searchPropertyId}
                onValueChange={(v) => {
                  setSearchPropertyId(v);
                  clearProfile();
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue
                    placeholder={ar ? "كل الفروع" : "All Properties"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {ar ? "كل الفروع" : "All Properties"}
                  </SelectItem>
                  {allProperties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.displayName || p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9 pr-9"
                placeholder={
                  ar
                    ? "ابحث بالاسم أو الكود أو الهوية..."
                    : "Search by name, code, or national ID..."
                }
                value={empSearch}
                onChange={(e) => {
                  setEmpSearch(e.target.value);
                  if (selectedProfile) clearProfile();
                }}
                autoComplete="off"
              />
              {empSearch && (
                <button
                  onClick={clearProfile}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {showDropdown && (
              <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {isSearching && (
                  <div className="p-3 text-sm text-muted-foreground">
                    {ar ? "جاري البحث..." : "Searching..."}
                  </div>
                )}
                {!isSearching && empResults.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">
                    {ar ? "لا توجد نتائج" : "No results found"}
                  </div>
                )}
                {empResults.map((emp) => (
                  <button
                    key={emp.id}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-start gap-3 border-b last:border-0 transition-colors"
                    onClick={() => selectProfile(emp)}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">
                        {emp.firstName[0]}
                        {emp.lastName[0]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {emp.profileId} • {emp.nationalId}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {emp.jobTitle && (
                          <span className="text-xs text-muted-foreground">
                            {emp.jobTitle}
                          </span>
                        )}
                        {emp.propertyName && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 h-4"
                          >
                            <Building2 className="w-2.5 h-2.5 mr-0.5" />
                            {emp.propertyName}
                          </Badge>
                        )}
                        {emp.propertyId !== activePropertyId && (
                          <Badge className="text-[10px] py-0 px-1.5 h-4 bg-amber-500">
                            {ar ? "فرع آخر" : "Other Branch"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedProfile && (
            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">
                    {selectedProfile.firstName} {selectedProfile.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedProfile.profileId} •{" "}
                    {selectedProfile.jobTitle || "—"} •{" "}
                    {selectedProfile.department || "—"}
                  </p>
                  {selectedProfile.propertyId !== activePropertyId && (
                    <Badge className="mt-1 text-[10px] bg-amber-500">
                      <Building2 className="w-2.5 h-2.5 mr-1" />
                      {selectedProfile.propertyName}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold px-2.5 py-1.5 rounded-lg border bg-background hover:bg-muted/50 transition-colors shadow-2xs">
                  <input
                    type="checkbox"
                    checked={isFamilyHousing}
                    onChange={(e) => setIsFamilyHousing(e.target.checked)}
                    className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <span className="text-foreground">
                    {ar ? "تسكين عائلي (أجنحة عائلية)" : "Family Housing (Family Suites)"}
                  </span>
                </label>
                <button
                  onClick={clearProfile}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                  title={ar ? "إلغاء التحديد" : "Clear"}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── كارت الترشيح الذكي حسب المستوى ── */}
      {selectedProfile && recommendation?.bestRoom && (
        <div className="p-4 rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-amber-500 text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-foreground">
                  {ar ? "أفضل غرفة مقترحة تلقائياً للموظف:" : "Best Recommended Room for Employee:"}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white shadow-sm">
                  {ar
                    ? (recommendation.recommendedMap[recommendation.bestRoom.id]?.badgeLabelAr || "موصى بها")
                    : (recommendation.recommendedMap[recommendation.bestRoom.id]?.badgeLabelEn || "Recommended")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {ar
                  ? `غرفة رقم ${recommendation.bestRoom.roomNumber} (${recommendation.bestRoom.roomType || "قياسية"} - سعة ${recommendation.bestRoom.capacity} سرير)`
                  : `Room ${recommendation.bestRoom.roomNumber} (${recommendation.bestRoom.roomType || "Standard"} - Capacity ${recommendation.bestRoom.capacity} beds)`}
                {ar
                  ? (recommendation.recommendedMap[recommendation.bestRoom.id]?.matchReasonAr
                    ? ` • ${recommendation.recommendedMap[recommendation.bestRoom.id].matchReasonAr}`
                    : "")
                  : (recommendation.recommendedMap[recommendation.bestRoom.id]?.matchReasonEn
                    ? ` • ${recommendation.recommendedMap[recommendation.bestRoom.id].matchReasonEn}`
                    : "")}
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => {
              const best = recommendation.bestRoom;
              setSelectedRoomId(String(best.id));
              const bId = best.buildingId ?? (best as any).building_id;
              const fId = best.floorId ?? (best as any).floor_id;
              const rNum = best.roomNumber ?? (best as any).room_number;
              if (bId != null) setSearchBuilding(String(bId));
              if (fId != null) setSearchFloor(String(fId));
              if (rNum != null) setSearchRoomNumber(String(rNum));
              // Pick first free bed
              const bCap = best.capacity || 1;
              const curOccs = (allAssignments || []).filter(
                (a: any) => a.status === "ACTIVE" && a.roomId === best.id && a.bedNumber != null
              ).map((a: any) => a.bedNumber);
              const freeBed = Array.from({ length: bCap }, (_, i) => i + 1).find(b => !curOccs.includes(b));
              if (freeBed) setSelectedBed(String(freeBed));
              toast.success(ar ? `تم اختيار الغرفة المقترحة رقم ${best.roomNumber} بنجاح` : `Selected room ${best.roomNumber}`);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-md flex-shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {ar ? "اختيار هذه الغرفة وتسكينه فوراً" : "Select Recommended Room"}
          </Button>
        </div>
      )}

      {/* بطاقة الغرفة */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-primary" />
            {ar ? "بيانات الغرفة" : "Room Details"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── فلاتر البحث ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg border border-dashed">
            {/* فلتر المبنى */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">
                {ar ? "المبنى" : "Building"}
              </label>
              <Select
                value={searchBuilding}
                onValueChange={(v) => {
                  setSearchBuilding(v);
                  setSearchFloor("all");
                  setSelectedRoomId("");
                  setSelectedBed("");
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue
                    placeholder={ar ? "كل المباني" : "All Buildings"}
                  />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">
                    {ar ? "كل المباني" : "All Buildings"}
                  </SelectItem>
                  {buildings.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* فلتر الدور */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">
                {ar ? "الدور" : "Floor"}
              </label>
              <Select
                value={searchFloor}
                onValueChange={(v) => {
                  setSearchFloor(v);
                  setSelectedRoomId("");
                  setSelectedBed("");
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={ar ? "كل الأدوار" : "All Floors"} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">
                    {ar ? "كل الأدوار" : "All Floors"}
                  </SelectItem>
                  {floors
                    .filter(
                      (f) =>
                        searchBuilding === "all" ||
                        String(f.buildingId ?? (f as any).building_id) === String(searchBuilding),
                    )
                    .map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {ar ? "دور" : "Floor"} {f.floorNumber ?? (f as any).floor_number}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* بحث برقم الغرفة */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">
                {ar ? "رقم الغرفة" : "Room #"}
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="h-9 pl-7"
                  placeholder={ar ? "اكتب رقم الغرفة..." : "Room number..."}
                  value={searchRoomNumber}
                  onChange={(e) => {
                    setSearchRoomNumber(e.target.value);
                    setSelectedRoomId("");
                    setSelectedBed("");
                  }}
                />
              </div>
            </div>

            {(searchBuilding !== "all" || searchFloor !== "all" || searchRoomNumber.trim()) && (
              <div className="md:col-span-3 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground border border-dashed"
                  onClick={() => {
                    setSearchBuilding("all");
                    setSearchFloor("all");
                    setSearchRoomNumber("");
                  }}
                >
                  <X className="w-3.5 h-3.5 mr-1 rtl:ml-1 rtl:mr-0" />
                  {ar ? "إلغاء الفلاتر وعرض الكل" : "Reset Filters / Show All"}
                </Button>
              </div>
            )}
          </div>

          {/* ── قائمة الغرف المفلترة ── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {ar ? "اختر الغرفة" : "Select Room"}{" "}
              <span className="text-red-500">*</span>
              {filteredRooms.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  ({filteredRooms.length} {ar ? "غرفة" : "rooms"})
                </span>
              )}
            </label>
            <Select
              value={selectedRoomId}
              onValueChange={(v) => {
                setSelectedRoomId(v);
                setSelectedBed("");
                setIsEntireRoom(false);
                const picked = rooms.find((rm) => rm.id === parseInt(v));
                if (picked) {
                  const bId = picked.buildingId ?? (picked as any).building_id;
                  const fId = picked.floorId ?? (picked as any).floor_id;
                  const rNum = picked.roomNumber ?? (picked as any).room_number;
                  if (bId != null) setSearchBuilding(String(bId));
                  if (fId != null) setSearchFloor(String(fId));
                  if (rNum != null) setSearchRoomNumber(String(rNum));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    filteredRooms.length === 0
                      ? ar
                        ? "لا توجد غرف تطابق الفلاتر"
                        : "No rooms match filters"
                      : ar
                        ? "اختر الغرفة من القائمة..."
                        : "Select a room..."
                  }
                />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={4}
                className="max-h-64 overflow-y-auto"
              >
                {filteredRooms.length === 0 ? (
                  <div className="p-4 text-center">
                    <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2 opacity-50" />
                    <p className="text-xs text-muted-foreground">
                      {ar
                        ? "لا توجد غرف متاحة تطابق خيارات البحث"
                        : "No rooms match current filters"}
                    </p>
                  </div>
                ) : (
                  sortedFilteredRooms.map((r) => {
                    const isEntireReserved = entireRoomOccupiedSet.has(r.id);
                    const isFull = r.currentOccupancy >= r.capacity || isEntireReserved;
                    const isSingleOccRoom = singleOccupantRoomsMap.has(r.id);
                    const isBlockedBySingleOcc = isSingleOccRoom && !canOverrideSingleOccupancy;
                    const isDisabled = isFull || isBlockedBySingleOcc;
                    const building = buildingMap[r.buildingId] ?? "—";
                    const floor = floorMap[r.floorId];
                    return (
                      <SelectItem
                        key={r.id}
                        value={String(r.id)}
                        disabled={isDisabled}
                      >
                        <div
                          className={`flex items-center gap-2 ${isDisabled ? "opacity-50" : ""}`}
                        >
                          <span className="font-mono font-bold text-primary">
                            {r.roomNumber}
                          </span>
                          {recommendation?.recommendedMap[r.id]?.levelMatch && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                              {ar
                                ? recommendation.recommendedMap[r.id].badgeLabelAr
                                : recommendation.recommendedMap[r.id].badgeLabelEn}
                            </span>
                          )}
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {building}
                          </span>
                          {floor?.number !== undefined && (
                            <span className="text-[10px] text-muted-foreground">
                              {ar ? "دور" : "F"} {floor.number}
                            </span>
                          )}
                          <Badge
                            variant={isFull ? "destructive" : isBlockedBySingleOcc ? "outline" : "outline"}
                            className={`text-[9px] h-4 py-0 ${
                              isEntireReserved
                                ? "bg-purple-700 text-white border-purple-800"
                                : isBlockedBySingleOcc
                                ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30"
                                : isSingleOccRoom
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300"
                                : ""
                            }`}
                          >
                            {isEntireReserved
                              ? ar
                                ? "محجوزة بالكامل (فردي)"
                                : "ENTIRE ROOM"
                              : isFull
                              ? ar
                                ? "ممتلئة"
                                : "FULL"
                              : isBlockedBySingleOcc
                              ? ar
                                ? "شخص بمفرده (يتطلب صلاحية)"
                                : "SINGLE OCCUPANT (REQ. PERM)"
                              : isSingleOccRoom
                              ? ar
                                ? "شخص بمفرده (مسموح بالصلاحية)"
                                : "SINGLE OCCUPANT (AUTH)"
                              : r.roomType}
                          </Badge>
                          {r.classification && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                                r.classification.toLowerCase().includes("deluxe")
                                  ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                  : r.classification.toLowerCase().includes("superior")
                                  ? "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                  : r.classification.toLowerCase().includes("family")
                                  ? "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                  : "bg-muted text-foreground border-border"
                              }`}
                            >
                              {r.classification}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-medium ${isFull ? "text-red-500" : isBlockedBySingleOcc ? "text-amber-600 font-bold" : "text-muted-foreground"}`}
                          >
                            {r.currentOccupancy}/{r.capacity}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          {/* معلومات الغرفة المختارة */}
          {selectedRoom &&
            (() => {
              const roomFull =
                selectedRoom.currentOccupancy >= selectedRoom.capacity;
              return (
                <>
                  <div
                    className={`p-3 rounded-lg border flex flex-wrap gap-4 text-sm ${roomFull ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" : "bg-muted/40"}`}
                  >
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        {ar ? "المبنى" : "Building"}
                      </span>
                      <span className="font-medium">
                        {buildingMap[selectedRoom.buildingId] ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        {ar ? "الدور" : "Floor"}
                      </span>
                      <span className="font-medium">
                        {floorMap[selectedRoom.floorId]?.number ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        {ar ? "نوع الغرفة" : "Room Type"}
                      </span>
                      <span className="font-medium capitalize">
                        {selectedRoom.roomType}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        {ar ? "الطاقة الاستيعابية" : "Capacity"}
                      </span>
                      <span
                        className={`font-bold ${roomFull ? "text-red-600" : "text-foreground"}`}
                      >
                        {selectedRoom.currentOccupancy}/{selectedRoom.capacity}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        {ar ? "الحالة" : "Status"}
                      </span>
                      <Badge
                        variant={
                          roomFull
                            ? "destructive"
                            : selectedRoom.status?.toLowerCase() === "available"
                              ? "default"
                              : "secondary"
                        }
                        className="capitalize"
                      >
                        {roomFull
                          ? ar
                            ? "ممتلئة"
                            : "Full"
                          : selectedRoom.status}
                      </Badge>
                    </div>
                    {selectedRoom.gender && (
                      <div>
                        <span className="text-xs text-muted-foreground block">
                          {ar ? "الجنس" : "Gender"}
                        </span>
                        <span className="font-medium capitalize">
                          {selectedRoom.gender}
                        </span>
                      </div>
                    )}
                  </div>
                  {entireRoomOccupiedSet.has(selectedRoom.id) ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 border border-purple-200 dark:bg-purple-950/20 dark:border-purple-800 text-purple-700 dark:text-purple-400">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <p className="text-sm font-medium">
                        {ar
                          ? "هذه الغرفة محجوزة بالكامل لموظف آخر (استخدام فردي/غرفة خاصة). لا يمكن تسكين أي شخص آخر عليها."
                          : "This room is reserved exclusively for another resident. No additional assignments are permitted."}
                      </p>
                    </div>
                  ) : roomFull ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800 text-red-700 dark:text-red-400">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <p className="text-sm font-medium">
                        {ar
                          ? `هذه الغرفة وصلت للحد الأقصى (${selectedRoom.capacity} سرير).`
                          : `This room is at full capacity (${selectedRoom.capacity} bed${selectedRoom.capacity !== 1 ? "s" : ""}).`}
                      </p>
                    </div>
                  ) : null}
                  {/* Single Occupant Authorized Notice */}
                  {selectedRoom && singleOccupantRoomsMap.has(selectedRoom.id) && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">
                          {ar ? "تنبيه: غرفة يشغلها نزيل بمفرده" : "Notice: Room Occupied by Single Resident"}
                        </span>
                        <span>
                          {ar
                            ? `هذه الغرفة يشغلها حالياً النزيل (${singleOccupantRoomsMap.get(selectedRoom.id)?.residentName || ""}) بمفرده وبها أسِرّة شاغرة. أنت تقوم بالتسكين المشترك بموجب الصلاحية الإدارية الاستثنائية الممنوحة لك.`
                            : `This room is currently occupied by (${singleOccupantRoomsMap.get(selectedRoom.id)?.residentName || ""}) alone. You are assigning shared occupancy under your administrative override permission.`}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

          {/* خيار تخصيص الغرفة بالكامل لشخص واحد */}
          {selectedRoom && !entireRoomOccupiedSet.has(selectedRoom.id) && (
            <div
              className={`p-3 rounded-lg border transition-colors ${
                isEntireRoom
                  ? "bg-purple-50/80 border-purple-300 dark:bg-purple-950/30 dark:border-purple-700"
                  : "bg-muted/20 border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="entire-room-toggle"
                      checked={isEntireRoom}
                      disabled={selectedRoom.currentOccupancy > 0 || (!canOverrideSingleOccupancy && selectedRoom.capacity > 1)}
                      onChange={(e) => {
                        if (!canOverrideSingleOccupancy && selectedRoom.capacity > 1) {
                          toast.error(
                            ar
                              ? "حجز الغرفة متعددة الأسِرّة بالكامل لشخص واحد يتطلب صلاحية إدارية استثنائية."
                              : "Reserving an entire multi-bed room for a single person requires administrative permission."
                          );
                          return;
                        }
                        const checked = e.target.checked;
                        setIsEntireRoom(checked);
                        if (checked) {
                          setSelectedBed("1");
                        }
                      }}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-gray-300 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <label
                      htmlFor="entire-room-toggle"
                      className={`text-sm font-semibold cursor-pointer ${
                        selectedRoom.currentOccupancy > 0
                          ? "text-muted-foreground opacity-60"
                          : "text-foreground"
                      }`}
                    >
                      {ar
                        ? "تسكين الغرفة بالكامل لهذا الموظف (استخدام فردي / غرفة كاملة)"
                        : "Assign Entire Room to this Resident (Single/Exclusive Room)"}
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedRoom.currentOccupancy > 0
                      ? ar
                        ? "لا يمكن تخصيص الغرفة بالكامل لوجود مقيمين حاليين بها. متاحة فقط للغرف الشاغرة بالكامل (0 مقيم)."
                        : "Cannot reserve entire room: already has active occupants."
                      : isEntireRoom
                        ? ar
                          ? `تم حجز كافة أسِرّة الغرفة (${selectedRoom.capacity} سرير) بالكامل لهذا المقيم. لن تظهر الغرفة كشاغرة ولن يُسمح بتسكين أي شخص آخر عليها.`
                          : `All ${selectedRoom.capacity} beds are reserved for this resident. No one else can be assigned.`
                        : ar
                          ? "قم بتفعيل هذا الخيار للغرف المخصصة للمدراء أو الإداريين (غرفة خاصة) لقفل الغرفة بالكامل ومنع إضافة مقيم آخر معهم."
                          : "Check this to lock the whole room for single/private occupancy."}
                  </p>
                </div>
                {isEntireRoom && (
                  <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/60 dark:text-purple-200 text-xs font-bold whitespace-nowrap">
                    {ar ? "غرفة خاصة كاملة" : "Exclusive Room"}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* اختيار السرير */}
          {isMultiBed && !isEntireRoom && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <BedDouble className="w-4 h-4 text-primary" />
                {ar ? "رقم السرير" : "Bed Number"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {bedOptions.map((bed) => {
                  const isTaken = occupiedBeds.has(bed);
                  const isSelected = selectedBed === String(bed);
                  const occInfo = selectedRoomBedMap.get(bed);
                  return (
                    <button
                      key={bed}
                      type="button"
                      onClick={() => {
                        if (isTaken) return;
                        setSelectedBed(String(bed));
                      }}
                      disabled={isTaken}
                      title={
                        isTaken
                          ? ar
                            ? `سرير ${bed} مشغول بالنزيل: ${occInfo?.residentName || ""}`
                            : `Bed ${bed} occupied by: ${occInfo?.residentName || ""}`
                          : undefined
                      }
                      className={`relative px-4 py-2 rounded-lg border text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                        isTaken
                          ? "bg-destructive/10 border-destructive/30 text-destructive cursor-not-allowed opacity-75 select-none"
                          : isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card hover:bg-muted border-border cursor-pointer"
                      }`}
                    >
                      {isTaken && <Lock className="w-3.5 h-3.5 text-destructive shrink-0" />}
                      <span>{ar ? `سرير ${bed}` : `Bed ${bed}`}</span>
                      {isTaken && (
                        <span className="text-[10px] font-normal opacity-90 truncate max-w-[130px]">
                          ({occInfo?.residentName || (ar ? "مشغول" : "Occupied")})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedBed && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {ar
                    ? `تم اختيار السرير رقم ${selectedBed}`
                    : `Bed ${selectedBed} selected`}
                </p>
              )}
            </div>
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
        </CardContent>
      </Card>

      {/* Key Issuance Prompt Dialog */}
      <Dialog
        open={keyPromptOpen}
        onOpenChange={(open) => {
          if (!open && keyIssuing) return;
          setKeyPromptOpen(open);
          if (!open) {
            setLocation("/accommodation/in-house");
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-600" />
              {ar ? "إصدار مفاتيح الغرفة" : "Issue Room Keys"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {lastAssignment && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-semibold">
                  {ar ? "تم التعيين بنجاح" : "Assignment Successful"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {ar ? "الغرفة" : "Room"}: {selectedRoom?.roomNumber} —{" "}
                  {ar ? "السعة" : "Capacity"}: {selectedRoom?.capacity}{" "}
                  {ar ? "أسرّة" : "beds"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ar ? "عدد المفاتيح المطلوبة" : "Keys needed"}:{" "}
                  <span className="font-bold text-amber-600">
                    {selectedRoom?.capacity}
                  </span>
                </p>
              </div>
            )}
            {lastAssignment && selectedRoom && activePropertyId && (
              <KeyManagementPanel
                propertyId={activePropertyId as number}
                roomId={selectedRoom.id}
                assignmentId={lastAssignment.id}
                profileId={
                  selectedProfile
                    ? parseInt(selectedProfile.id as any)
                    : undefined
                }
                checkInDate={checkInDate}
                checkOutDate={expectedCheckOut}
                onIssuingChange={setKeyIssuing}
                onIssueComplete={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
                  toast.success(
                    ar ? "تم إصدار المفاتيح بنجاح" : "Keys issued successfully",
                  );
                }}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={printHousingLetter}
                disabled={keyIssuing}
                className="gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                {ar ? "طباعة خطاب السكن" : "Print Housing Letter"}
              </Button>
              <Button
                variant="outline"
                disabled={keyIssuing}
                onClick={() => {
                  setKeyPromptOpen(false);
                  setLocation("/accommodation/in-house");
                }}
              >
                {ar ? "تخطي" : "Skip"}
              </Button>
              <Button
                disabled={keyIssuing}
                onClick={() => {
                  setKeyPromptOpen(false);
                  setLocation("/accommodation/in-house");
                }}
              >
                {ar ? "متابعة" : "Continue"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── ديالوج تأكيد تصريح الإدارة للتسكين المؤقت (بديل إجازة) ── */}
      <Dialog
        open={!!vacationPromptData}
        onOpenChange={(open) => !open && setVacationPromptData(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              {ar ? "تصريح إدارة السكن: تسكين مؤقت بديل إجازة" : "Manager Override: Temporary Vacation Housing"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p className="text-foreground">
              {ar
                ? `السرير رقم (${selectedBed}) مخصص للموظف (${vacationPromptData?.occupantName}) وهو حالياً في إجازة رسمية${
                    vacationPromptData?.vacationEndDate ? ` حتى تاريخ ${vacationPromptData.vacationEndDate}` : ""
                  }.`
                : `Bed #${selectedBed} is assigned to ${vacationPromptData?.occupantName} who is currently on vacation.`}
            </p>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-1 text-amber-900 dark:text-amber-200">
              <p className="font-bold">
                {ar ? "ضوابط التسكين المؤقت وفقاً لسياسة السكن:" : "Policy Rules:"}
              </p>
              <p>• {ar ? "يُسمح بالتسكين المؤقت فقط بقرار وتصريح من مدير السكن أو الآدمن." : "Allowed only by Housing Manager or Admin permission."}</p>
              <p>• {ar ? "ممنوع منعاً باتاً تسكين شخصين معاً؛ هذا التسكين مؤقت فقط طالما أن الموظف الأصلي في إجازة." : "No double rooming allowed; only valid while resident is away."}</p>
              <p>• {ar ? "يجب مغادرة أو نقل الموظف البديل فور عودة الموظف الأصلي من الإجازة." : "Temporary occupant must vacate before original resident returns."}</p>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold">
                {ar ? "تاريخ مغادرة الموظف المؤقت (إلزامي):" : "Expected Check-out Date (Required):"}
              </label>
              <DateInput
                value={expectedCheckOut || vacationPromptData?.vacationEndDate || ""}
                max={vacationPromptData?.vacationEndDate || undefined}
                onChange={(iso) => setExpectedCheckOut(iso)}
              />
              {vacationPromptData?.vacationEndDate && (
                <p className="text-[11px] text-muted-foreground">
                  {ar ? `تاريخ عودة المقيم الأصلي من الإجازة: ${vacationPromptData.vacationEndDate}` : `Return date: ${vacationPromptData.vacationEndDate}`}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-3">
            <Button
              variant="outline"
              onClick={() => setVacationPromptData(null)}
            >
              {ar ? "إلغاء والتراجع" : "Cancel"}
            </Button>
            <Button
              onClick={handleConfirmVacationOverride}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {ar ? "تأكيد التسكين المؤقت (بتصريح الإدارة)" : "Authorize Temporary Assignment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PrintLanguageDialog
        open={langDialogOpen}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />
    </div>
  );
}
