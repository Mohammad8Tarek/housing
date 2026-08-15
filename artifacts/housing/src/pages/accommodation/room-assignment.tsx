// @ts-nocheck
import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
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

type EmployeeResult = {
  id: number;
  propertyId: number;
  propertyName: string | null;
  employeeId: string;
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
  const [empResults, setEmpResults] = useState<EmployeeResult[]>([]);
  const [selectedEmployee, setSelectedEmployee] =
    useState<EmployeeResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchPropertyId, setSearchPropertyId] = useState<string>("all");

  const { data: _pData } = useListProperties();
  const allProperties = _pData?.data || _pData || [];
  const { data: settings } = useGetSettings({
    query: { enabled: !!activePropertyId },
  });
  const activeProp = allProperties.find((p: any) => p.id === activePropertyId);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedBed, setSelectedBed] = useState("");
  const [checkInDate, setCheckInDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [expectedCheckOut, setExpectedCheckOut] = useState("");
  const [notes, setNotes] = useState("");

  // فلاتر الغرف
  const [searchBuilding, setSearchBuilding] = useState("all");
  const [searchFloor, setSearchFloor] = useState("all");
  const [searchRoomNumber, setSearchRoomNumber] = useState("");

  // Key prompt state after successful assignment
  const [keyPromptOpen, setKeyPromptOpen] = useState(false);
  const [keyIssuing, setKeyIssuing] = useState(false);
  const [lastAssignment, setLastAssignment] = useState<any>(null);

  const printHousingLetter = async () => {
    const chosenAr = await openDialog();
    const emp = selectedEmployee;
    const assignment = lastAssignment;
    if (!emp || !assignment) return;
    const room = rooms.find(
      (r) => r.id === (assignment.roomId || parseInt(selectedRoomId)),
    );
    const building = room ? buildingMap[room.buildingId] : null;
    const floorNum = room ? floorMap[room.floorId]?.number : null;
    await generateHousingLetterPdf({
      isArabic: chosenAr,
      employee: emp,
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

  const { data: _rData } = useListRooms(
    { propertyId: activePropertyId, limit: 1000 },
    { query: { enabled: !!activePropertyId, staleTime: 30000 } },
  );
  const rooms = _rData?.data || [];
  const { data: _bData } = useListBuildings(
    { propertyId: propId },
    { query: { enabled: !!propId } },
  );
  const buildings = _bData?.data || [];
  const { data: _fData } = useListFloors(
    { propertyId: propId },
    { query: { enabled: !!propId } },
  );
  const floors = _fData?.data || [];
  const { data: _aData } = useListAssignments(
    { propertyId: propId } as any,
    { query: { enabled: !!propId } },
  );
  const allAssignments = _aData?.data || [];

  // Build set of occupied bed numbers for the currently selected room
  const occupiedBeds = new Set<number>(
    allAssignments
      .filter(
        (a: any) =>
          a.status === "ACTIVE" &&
          a.roomId === parseInt(selectedRoomId) &&
          a.bedNumber != null,
      )
      .map((a: any) => a.bedNumber as number),
  );

  const buildingMap = Object.fromEntries(buildings.map((b) => [b.id, b.name]));
  const floorMap = Object.fromEntries(
    floors.map((f) => [f.id, { name: f.name, number: f.floorNumber }]),
  );

  // كل الغرف غير الصيانة، مرتبة: المتاحة أولاً
  const availableRooms = rooms
    .filter((r) => r.status?.toLowerCase() !== "maintenance")
    .sort((a, b) => {
      const aFull = a.currentOccupancy >= a.capacity;
      const bFull = b.currentOccupancy >= b.capacity;
      if (aFull && !bFull) return 1;
      if (!aFull && bFull) return -1;
      return 0;
    });

  // الغرف بعد تطبيق الفلاتر
  const filteredRooms = availableRooms.filter((r) => {
    if (searchBuilding !== "all" && r.buildingId !== parseInt(searchBuilding))
      return false;
    if (searchFloor !== "all" && r.floorId !== parseInt(searchFloor))
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
            propertyId: activePropertyId,
          }),
        });
        queryClient.invalidateQueries({
          queryKey: getListRoomsQueryKey({
            propertyId: activePropertyId,
            limit: 1000,
          }),
        });
        // Show key issuance prompt
        setLastAssignment(data);
        setKeyPromptOpen(true);
      },
      onError: async (err: any) => {
        let description = err.message;
        try {
          const body = await err?.response?.json?.();
          if (body?.code === "BED_TAKEN") {
            description = ar
              ? `هذا السرير مشغول بالفعل. اختر سريرًا آخر.`
              : `This bed is already occupied. Please choose a different bed.`;
          } else if (body?.code === "EMPLOYEE_ALREADY_ASSIGNED") {
            description = ar
              ? `الموظف مسكّن بالفعل في غرفة رقم ${body.existingRoomId}. يجب تسجيل الخروج أولاً.`
              : `Employee already assigned to room ${body.existingRoomId}. Please check out first.`;
          } else if (body?.code === "ROOM_FULL") {
            description = ar ? `الغرفة ممتلئة.` : `Room is full.`;
          } else if (body?.error) {
            description = body.error;
          }
        } catch {}
        toast.error(description || (ar ? "خطأ" : "Error"));
      },
    },
  });

  /* Cross-property employee search */
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
          `/api/employees/search?q=${encodeURIComponent(empSearch.trim())}${propParam}`,
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

  const handleSubmit = () => {
    if (!selectedEmployee) {
      toast.error(ar ? "الرجاء اختيار موظف" : "Please select an employee");
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
    if (isMultiBed && !selectedBed) {
      toast.error(ar ? "الرجاء تحديد رقم السرير" : "Please select bed number");
      return;
    }

    createMutation.mutate({
      data: {
        propertyId: activePropertyId!,
        employeeId: selectedEmployee.id,
        roomId: parseInt(selectedRoomId),
        checkInDate: new Date(checkInDate).toISOString(),
        expectedCheckOutDate: expectedCheckOut
          ? new Date(expectedCheckOut).toISOString()
          : undefined,
        bedNumber: selectedBed ? parseInt(selectedBed) : undefined,
        notes: notes || undefined,
      } as any,
    });
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
            : "Assign an employee to a specific room with optional bed selection"}
        </p>
      </div>

      {/* بطاقة الموظف */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            {ar ? "بيانات الموظف" : "Employee"}
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
                  clearEmployee();
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
                  if (selectedEmployee) clearEmployee();
                }}
                autoComplete="off"
              />
              {empSearch && (
                <button
                  onClick={clearEmployee}
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
                    onClick={() => selectEmployee(emp)}
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
                        {emp.employeeId} • {emp.nationalId}
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

          {selectedEmployee && (
            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedEmployee.employeeId} •{" "}
                  {selectedEmployee.jobTitle || "—"} •{" "}
                  {selectedEmployee.department || "—"}
                </p>
                {selectedEmployee.propertyId !== activePropertyId && (
                  <Badge className="mt-1 text-[10px] bg-amber-500">
                    <Building2 className="w-2.5 h-2.5 mr-1" />
                    {selectedEmployee.propertyName}
                  </Badge>
                )}
              </div>
              <button
                onClick={clearEmployee}
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

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
                        f.buildingId === parseInt(searchBuilding),
                    )
                    .map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name}
                        {f.floorNumber !== undefined
                          ? ` (${ar ? "دور" : "Floor"} ${f.floorNumber})`
                          : ""}
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
              {/* ✅ الحل الرئيسي: position="popper" + max-h ثابت */}
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
                  filteredRooms.map((r) => {
                    const isFull = r.currentOccupancy >= r.capacity;
                    const building = buildingMap[r.buildingId] ?? "—";
                    const floor = floorMap[r.floorId];
                    return (
                      <SelectItem
                        key={r.id}
                        value={String(r.id)}
                        disabled={isFull}
                      >
                        <div
                          className={`flex items-center gap-2 ${isFull ? "opacity-50" : ""}`}
                        >
                          <span className="font-mono font-bold text-primary">
                            {r.roomNumber}
                          </span>
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {building}
                          </span>
                          {floor?.number !== undefined && (
                            <span className="text-[10px] text-muted-foreground">
                              {ar ? "دور" : "F"} {floor.number}
                            </span>
                          )}
                          <Badge
                            variant={isFull ? "destructive" : "outline"}
                            className="text-[9px] h-4 py-0"
                          >
                            {isFull ? (ar ? "ممتلئة" : "FULL") : r.roomType}
                          </Badge>
                          <span
                            className={`text-[10px] font-medium ${isFull ? "text-red-500" : "text-muted-foreground"}`}
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
                  {roomFull && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800 text-red-700 dark:text-red-400">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <p className="text-sm font-medium">
                        {ar
                          ? `هذه الغرفة وصلت للحد الأقصى (${selectedRoom.capacity} سرير).`
                          : `This room is at full capacity (${selectedRoom.capacity} bed${selectedRoom.capacity !== 1 ? "s" : ""}).`}
                      </p>
                    </div>
                  )}
                </>
              );
            })()}

          {/* اختيار السرير */}
          {isMultiBed && (
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
                  return (
                    <button
                      key={bed}
                      onClick={() => !isTaken && setSelectedBed(String(bed))}
                      disabled={isTaken}
                      title={
                        isTaken
                          ? ar
                            ? "هذا السرير مشغول"
                            : "Bed already occupied"
                          : undefined
                      }
                      className={`relative px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                        isTaken
                          ? "bg-red-50 border-red-200 text-red-400 dark:bg-red-950/30 dark:border-red-800 dark:text-red-500 cursor-not-allowed opacity-70"
                          : isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-card hover:bg-muted border-border"
                      }`}
                    >
                      {ar ? `سرير ${bed}` : `Bed ${bed}`}
                      {isTaken && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                          <X className="w-2.5 h-2.5 text-white" />
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
              <Input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {ar ? "تاريخ الخروج المتوقع" : "Expected Check-out"}
              </label>
              <Input
                type="date"
                value={expectedCheckOut}
                onChange={(e) => setExpectedCheckOut(e.target.value)}
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
              !selectedEmployee ||
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
                propertyId={activePropertyId}
                roomId={selectedRoom.id}
                assignmentId={lastAssignment.id}
                employeeId={
                  selectedEmployee
                    ? parseInt(selectedEmployee.id as any)
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

      <PrintLanguageDialog
        open={langDialogOpen}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />
    </div>
  );
}
