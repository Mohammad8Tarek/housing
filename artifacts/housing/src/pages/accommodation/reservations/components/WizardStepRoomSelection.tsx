import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BedDouble, CheckCircle, X, ChevronLeft, Building, FileText, Lock, AlertTriangle,
} from "lucide-react";
import { type ProfileResult } from "../../shared/profile-search";
import type { NewFormState, Setter } from "../types";

interface WizardStepRoomSelectionProps {
  ar: boolean;
  bookingType: "direct" | "upcoming";
  checkInDate: string;
  setCheckInDate: Setter<string>;
  expectedCheckOut: string;
  setExpectedCheckOut: Setter<string>;
  selectedProfile: ProfileResult | null;
  newForm: NewFormState;
  searchBuilding: string;
  setSearchBuilding: Setter<string>;
  searchFloor: string;
  setSearchFloor: Setter<string>;
  searchRoomNumber: string;
  setSearchRoomNumber: Setter<string>;
  buildings: any[];
  floors: any[];
  buildingMap: Record<string, any>;
  floorMap: Record<string, { name: any; number: any }>;
  sortedFilteredRooms: any[];
  entireRoomOccupiedSet: Set<number>;
  singleOccupantRoomsMap: Map<number, { residentName: string }>;
  selectedRoomBedMap: Map<number, { residentName: string }>;
  occupiedBeds: Set<number>;
  canOverrideSingleOccupancy: boolean;
  selectedRoomId: string;
  setSelectedRoomId: Setter<string>;
  selectedBed: string;
  setSelectedBed: Setter<string>;
  isMultiBed: boolean;
  bedOptions: number[];
  notes: string;
  setNotes: Setter<string>;
  setStep: Setter<1 | 2 | 3>;
  handleSubmit: () => void;
  createAssignmentMutation: { isPending: boolean };
  createReservationMutation: { isPending: boolean };
}

export function WizardStepRoomSelection({
  ar, bookingType, checkInDate, setCheckInDate, expectedCheckOut, setExpectedCheckOut,
  selectedProfile, newForm, searchBuilding, setSearchBuilding, searchFloor, setSearchFloor,
  searchRoomNumber, setSearchRoomNumber, buildings, floors, buildingMap, floorMap,
  sortedFilteredRooms, entireRoomOccupiedSet, singleOccupantRoomsMap, selectedRoomBedMap, occupiedBeds,
  canOverrideSingleOccupancy, selectedRoomId, setSelectedRoomId, selectedBed, setSelectedBed,
  isMultiBed, bedOptions, notes, setNotes, setStep, handleSubmit,
  createAssignmentMutation, createReservationMutation,
}: WizardStepRoomSelectionProps) {
  return (

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
                    {buildings.map((b: any) => (
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
                      .filter(
                        (f) =>
                          searchBuilding === "all" ||
                          String(f.buildingId ?? (f as any).building_id) === String(searchBuilding),
                      )
                      .map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {ar ? "دور" : "Floor"} {f.floorNumber ?? (f as any).floor_number ?? f.name}
                        </SelectItem>
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
              <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
                <span className="font-medium">{ar ? "اختر الغرفة المناسبة:" : "Select Room:"}</span>
                <span className="text-[11px]">
                  {sortedFilteredRooms.length} {ar ? "غرفة" : "rooms"}
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto pr-1">
                {sortedFilteredRooms.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed rounded-xl bg-muted/10">
                    <BedDouble className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-semibold text-muted-foreground">
                      {ar ? "لا توجد غرف تطابق الفلاتر المحددة" : "No rooms match the selected filters"}
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
                      const isEntireReserved = entireRoomOccupiedSet.has(room.id);
                      const isFull = occ >= cap || isEntireReserved;
                      const isSingleOccRoom = singleOccupantRoomsMap.has(room.id);
                      const isBlockedBySingleOcc = isSingleOccRoom && !canOverrideSingleOccupancy;
                      const isSelectable = !isFull && !isBlockedBySingleOcc;
                      const isSel = selectedRoomId === String(room.id);
                      const freeSpots = Math.max(0, cap - occ);
                      const singleResidentInfo = singleOccupantRoomsMap.get(room.id);

                      return (
                        <button
                          type="button"
                          key={room.id}
                          disabled={!isSelectable}
                          onClick={() => {
                            if (isBlockedBySingleOcc) {
                              toast.error(
                                ar
                                  ? "هذه الغرفة يشغلها شخص بمفرده وبها أسِرّة شاغرة. تسكين نزيل إضافي مع النزيل يتطلب صلاحية إدارية."
                                  : "This room is occupied by a single resident. Assigning an additional occupant requires administrative permission."
                              );
                              return;
                            }
                            if (isFull) return;
                            setSelectedRoomId(String(room.id));
                            setSelectedBed(cap === 1 ? "1" : "");
                            // Base the top filters on this room
                            const bId = room.buildingId ?? (room as any).building_id;
                            const fId = room.floorId ?? (room as any).floor_id;
                            const rNum = room.roomNumber ?? (room as any).room_number;
                            if (bId != null) setSearchBuilding(String(bId));
                            if (fId != null) setSearchFloor(String(fId));
                            if (rNum != null) setSearchRoomNumber(String(rNum));
                          }}
                          className={`group relative flex flex-col justify-between p-3 rounded-xl border-2 text-start transition-all duration-200 ${
                            isSel
                              ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm cursor-pointer"
                              : !isSelectable
                              ? "border-border/60 bg-muted/50 opacity-60 cursor-not-allowed select-none"
                              : "border-border bg-card hover:border-primary/60 hover:bg-muted/30 cursor-pointer"
                          }`}
                        >
                          {/* Header: Room Number + Selection / Lock Status */}
                          <div className="flex items-start justify-between gap-1.5 w-full">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                                  isSel
                                    ? "bg-primary text-primary-foreground"
                                    : !isSelectable
                                    ? "bg-muted text-muted-foreground"
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
                            ) : isFull ? (
                              <div
                                className="w-5 h-5 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0"
                                title={isEntireReserved ? (ar ? "محجوزة بالكامل" : "Entire Room") : (ar ? "الغرفة ممتلئة" : "Room is full")}
                              >
                                <Lock className="w-3 h-3" />
                              </div>
                            ) : isBlockedBySingleOcc ? (
                              <div
                                className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0"
                                title={ar ? "يتطلب صلاحية إدارية" : "Permission required"}
                              >
                                <Lock className="w-3 h-3" />
                              </div>
                            ) : null}
                          </div>

                          {/* Badges: Full status / Classification */}
                          <div className="my-2 flex flex-wrap gap-1 min-h-[22px] items-center">
                            {isFull ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20 truncate max-w-full">
                                <Lock className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">
                                  {isEntireReserved
                                    ? (ar ? "محجوزة بالكامل" : "Entire Room")
                                    : (ar ? "ممتلئة (ساكنة)" : "Full / Occupied")}
                                </span>
                              </span>
                            ) : isBlockedBySingleOcc ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 truncate max-w-full" title={ar ? `يشغلها بمفرده: ${singleResidentInfo?.residentName || ""}` : `Occupied alone: ${singleResidentInfo?.residentName || ""}`}>
                                <Lock className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">
                                  {ar ? "شخص بمفرده (يتطلب صلاحية)" : "Single Occupant (Req. Perm.)"}
                                </span>
                              </span>
                            ) : isSingleOccRoom ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 truncate max-w-full">
                                <span>⚠️</span>
                                <span className="truncate">
                                  {ar ? "شخص بمفرده (مسموح بالصلاحية)" : "Single Occupant (Authorized)"}
                                </span>
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
                              {occ}/{cap} {ar ? "سرير" : "beds"} {isFull ? (ar ? "• ممتلئة" : "• Full") : ""}
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
                  {/* Single Occupant Authorized Notice */}
                  {singleOccupantRoomsMap.has(parseInt(selectedRoomId)) && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">
                          {ar ? "تنبيه: غرفة يشغلها نزيل بمفرده" : "Notice: Room Occupied by Single Resident"}
                        </span>
                        <span>
                          {ar
                            ? `هذه الغرفة يشغلها حالياً النزيل (${singleOccupantRoomsMap.get(parseInt(selectedRoomId))?.residentName || ""}) بمفرده وبها أسِرّة شاغرة. أنت تقوم بالتسكين المشترك بموجب الصلاحية الإدارية الاستثنائية الممنوحة لك.`
                            : `This room is currently occupied by (${singleOccupantRoomsMap.get(parseInt(selectedRoomId))?.residentName || ""}) alone. You are assigning shared occupancy under your administrative override permission.`}
                        </span>
                      </div>
                    </div>
                  )}

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
                      disabled={!canOverrideSingleOccupancy}
                      onClick={() => {
                        if (!canOverrideSingleOccupancy) {
                          toast.error(
                            ar
                              ? "حجز الغرفة متعددة الأسِرّة بالكامل لشخص واحد يتطلب صلاحية إدارية استثنائية."
                              : "Reserving an entire multi-bed room for a single person requires administrative permission."
                          );
                          return;
                        }
                        setSelectedBed("ALL");
                      }}
                      className={`p-3 rounded-lg border-2 text-sm font-semibold flex items-center justify-between transition-all ${
                        selectedBed === "ALL"
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                          : !canOverrideSingleOccupancy
                          ? "border-border bg-muted/40 opacity-60 cursor-not-allowed"
                          : "border-border hover:border-primary/50 hover:bg-background cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold">{ar ? "حجز الغرفة بالكامل (خاص)" : "Entire Room (Full Lock)"}</span>
                        {!canOverrideSingleOccupancy && (
                          <Lock className="w-3 h-3 text-muted-foreground ml-1" />
                        )}
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
                        const occInfo = selectedRoomBedMap.get(bed);
                        return (
                          <button
                            key={bed}
                            type="button"
                            disabled={isOcc}
                            onClick={() => {
                              if (isOcc) return;
                              setSelectedBed(String(bed));
                            }}
                            title={
                              isOcc
                                ? `${ar ? "سرير مشغول" : "Bed Occupied"}: ${occInfo?.residentName || ""}`
                                : undefined
                            }
                            className={`min-w-[80px] h-10 px-3 rounded-lg border-2 text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 ${
                              isSel
                                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                : isOcc
                                ? "border-destructive/30 bg-destructive/10 text-destructive cursor-not-allowed opacity-75 select-none"
                                : "border-border hover:border-primary hover:bg-primary/10 cursor-pointer"
                            }`}
                          >
                            {isOcc && <Lock className="w-3.5 h-3.5 text-destructive shrink-0" />}
                            <span>{ar ? `سرير ${bed}` : `Bed ${bed}`}</span>
                            {isOcc && (
                              <span className="text-[10px] font-normal opacity-90 truncate max-w-[130px]">
                                ({occInfo?.residentName || (ar ? "مشغول" : "Occupied")})
                              </span>
                            )}
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
  );
}
