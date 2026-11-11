import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NationalitySelect } from "@/components/ui/nationality-select";
import { Search, BedDouble, X, AlertCircle, Ban, Check } from "lucide-react";
import { getBedOptions, roomTypeCapacity } from "../../shared/profile-search";
import type {
  CancelDialogState,
  EditDialogState,
  EditFormState,
  Setter,
} from "../types";

interface EditReservationDialogProps {
  ar: boolean;
  activePropertyId: number | string | null | undefined;
  editDialog: EditDialogState;
  setEditDialog: Setter<EditDialogState>;
  editForm: EditFormState;
  setEditForm: Setter<EditFormState>;
  departmentValues: any[];
  filteredEditJobTitles: any[];
  rooms: any[];
  buildings: any[];
  buildingMap: Record<string, any>;
  showEditRoomPicker: boolean;
  setShowEditRoomPicker: Setter<boolean>;
  editBuildingId: string;
  setEditBuildingId: Setter<string>;
  editRoomSearch: string;
  setEditRoomSearch: Setter<string>;
  filteredEditRooms: any[];
  entireRoomOccupiedSet: Set<number>;
  setCancelDialog: Setter<CancelDialogState>;
  handleUpdate: () => void;
  updateMutation: { isPending: boolean };
}

export function EditReservationDialog({
  ar,
  activePropertyId,
  editDialog,
  setEditDialog,
  editForm,
  setEditForm,
  departmentValues,
  filteredEditJobTitles,
  rooms,
  buildings,
  buildingMap,
  showEditRoomPicker,
  setShowEditRoomPicker,
  editBuildingId,
  setEditBuildingId,
  editRoomSearch,
  setEditRoomSearch,
  filteredEditRooms,
  entireRoomOccupiedSet,
  setCancelDialog,
  handleUpdate,
  updateMutation,
}: EditReservationDialogProps) {
  return (
    <Dialog
      open={editDialog.open}
      onOpenChange={(o) =>
        !o && setEditDialog({ open: false, reservation: null })
      }
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ar ? "تعديل الحجز" : "Edit Reservation"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{ar ? "الاسم الأول" : "First Name"}</Label>
              <Input
                value={editForm.firstName}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, firstName: e.target.value }))
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
                  setEditForm((f) => ({ ...f, guestPhone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "تاريخ الدخول" : "Check-in"}</Label>
              <DateInput
                value={editForm.checkInDate}
                onChange={(iso) =>
                  setEditForm((f) => ({ ...f, checkInDate: iso }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "تاريخ المغادرة" : "Check-out"}</Label>
              <DateInput
                value={editForm.checkOutDate}
                onChange={(iso) =>
                  setEditForm((f) => ({ ...f, checkOutDate: iso }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "القسم" : "Department"}</Label>
              <Select
                value={editForm.department || "none"}
                onValueChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    department: v === "none" ? "" : v,
                    jobTitle: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {departmentValues.map((d: any) => (
                    <SelectItem key={d.id} value={d.value}>
                      {d.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "المسمى الوظيفي" : "Job Title"}</Label>
              <Select
                value={editForm.jobTitle || "none"}
                onValueChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    jobTitle: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {filteredEditJobTitles.map((t: any) => (
                    <SelectItem key={t.id} value={t.value}>
                      {t.value}
                    </SelectItem>
                  ))}
                </SelectContent>
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
                    department:
                      v === "THIRD_PARTY" && !f.department
                        ? ar
                          ? "طرف ثالث"
                          : "Third Party"
                        : f.department,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTERNAL">
                    {ar ? "موظف داخلي" : "Internal Employee"}
                  </SelectItem>
                  <SelectItem value="THIRD_PARTY">
                    {ar ? "طرف ثالث" : "Third Party"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "الجنسية" : "Nationality"}</Label>
              <NationalitySelect
                value={editForm.nationality}
                onChange={(v) => setEditForm((f) => ({ ...f, nationality: v }))}
                propertyId={
                  typeof activePropertyId === "number"
                    ? activePropertyId
                    : undefined
                }
                className="h-9 text-xs"
                placeholder={ar ? "اختر الجنسية..." : "Select nationality..."}
              />
            </div>
            {editForm.employmentType === "THIRD_PARTY" && (
              <div className="space-y-1.5 col-span-2">
                <Label>
                  {ar ? "اسم الشركة / الجهة الخارجية" : "Company Name"}
                </Label>
                <Input
                  placeholder={
                    ar
                      ? "اسم الشركة التابع لها النزيل"
                      : "Company / Contractor Name"
                  }
                  value={editForm.companyName || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, companyName: e.target.value }))
                  }
                />
              </div>
            )}
          </div>

          {/* ROOM & BED SELECTION */}
          <div className="space-y-2.5 p-3.5 rounded-xl border bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">
                  {ar ? "الغرفة والسرير المحجوز" : "Reserved Room & Bed"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {editForm.roomId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 gap-1"
                    onClick={() => {
                      setEditForm((f) => ({
                        ...f,
                        roomId: "",
                        bedNumber: "",
                        roomType: "",
                      }));
                      setShowEditRoomPicker(false);
                    }}
                  >
                    <X className="w-3 h-3" />
                    {ar ? "إلغاء التخصيص" : "Clear"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant={showEditRoomPicker ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1"
                  onClick={() => setShowEditRoomPicker((prev) => !prev)}
                >
                  <BedDouble className="w-3.5 h-3.5" />
                  {showEditRoomPicker
                    ? ar
                      ? "إخفاء قائمة الغرف"
                      : "Hide Rooms"
                    : editForm.roomId
                      ? ar
                        ? "تغيير الغرفة"
                        : "Change Room"
                      : ar
                        ? "تخصيص غرفة"
                        : "Assign Room"}
                </Button>
              </div>
            </div>

            {/* Current assigned room display */}
            {editForm.roomId ? (
              (() => {
                const currRoom = rooms.find(
                  (r: any) => String(r.id) === String(editForm.roomId),
                );
                const bName = currRoom
                  ? buildingMap[currRoom.buildingId]
                  : null;
                return (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border bg-background text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold font-mono">
                        {currRoom?.roomNumber || editForm.roomId}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">
                          {ar
                            ? `غرفة ${currRoom?.roomNumber || editForm.roomId}`
                            : `Room ${currRoom?.roomNumber || editForm.roomId}`}
                          {bName ? ` - ${bName}` : ""}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>
                            {currRoom?.roomType ||
                              editForm.roomType ||
                              (ar ? "قياسية" : "Standard")}
                          </span>
                          <span>•</span>
                          <span className="font-medium text-primary">
                            {editForm.bedNumber === "ALL"
                              ? ar
                                ? "الغرفة بالكامل"
                                : "Entire Room"
                              : editForm.bedNumber
                                ? ar
                                  ? `سرير رقم ${editForm.bedNumber}`
                                  : `Bed #${editForm.bedNumber}`
                                : ar
                                  ? "بدون سرير محدد"
                                  : "Bed unassigned"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-[11px]"
                    >
                      {ar ? "غرفة محجوزة" : "Reserved"}
                    </Badge>
                  </div>
                );
              })()
            ) : (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-dashed text-xs text-muted-foreground bg-background/50">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>
                    {ar
                      ? "لم يتم تحديد غرفة لهذا الحجز بعد."
                      : "No room assigned to this reservation yet."}
                  </span>
                </div>
              </div>
            )}

            {/* Collapsible Room Picker */}
            {showEditRoomPicker && (
              <div className="space-y-3 pt-2 border-t mt-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="w-full sm:w-48">
                    <Select
                      value={editBuildingId}
                      onValueChange={setEditBuildingId}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue
                          placeholder={ar ? "كل المباني" : "All Buildings"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {ar ? "كل المباني" : "All Buildings"}
                        </SelectItem>
                        {buildings.map((b: any) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute right-2.5 rtl:right-2.5 rtl:left-auto left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={
                        ar
                          ? "بحث برقم الغرفة أو النوع..."
                          : "Search room number or type..."
                      }
                      value={editRoomSearch}
                      onChange={(e) => setEditRoomSearch(e.target.value)}
                      className="h-8 text-xs px-8"
                    />
                    {editRoomSearch && (
                      <button
                        type="button"
                        onClick={() => setEditRoomSearch("")}
                        className="absolute left-2.5 rtl:left-2.5 rtl:right-auto right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Room Cards Scroll Area */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border rounded-lg p-1.5 bg-background">
                  {filteredEditRooms.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      {ar
                        ? "لا توجد غرف مطابقة لمعايير البحث"
                        : "No rooms match the criteria"}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {filteredEditRooms.slice(0, 36).map((rm: any) => {
                        const isSel = String(editForm.roomId) === String(rm.id);
                        const occ = rm.currentOccupancy ?? 0;
                        const cap = rm.capacity ?? 1;
                        const isFull =
                          occ >= cap || entireRoomOccupiedSet.has(rm.id);
                        const bName = buildingMap[rm.buildingId];

                        return (
                          <button
                            key={rm.id}
                            type="button"
                            onClick={() => {
                              setEditForm((f) => ({
                                ...f,
                                roomId: String(rm.id),
                                roomType: rm.roomType || f.roomType,
                                bedNumber:
                                  (rm.capacity ?? 1) === 1
                                    ? "1"
                                    : f.roomId === String(rm.id)
                                      ? f.bedNumber
                                      : "1",
                              }));
                            }}
                            className={`p-2 rounded-lg border text-start transition-all flex flex-col justify-between text-xs ${
                              isSel
                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                : isFull
                                  ? "border-border/60 bg-muted/40 opacity-70 hover:opacity-100"
                                  : "border-border hover:border-primary/50 hover:bg-muted/20"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 w-full">
                              <span className="font-bold font-mono text-sm">
                                {ar
                                  ? `غرفة ${rm.roomNumber}`
                                  : `Room ${rm.roomNumber}`}
                              </span>
                              {isSel && (
                                <Check className="w-3.5 h-3.5 text-primary" />
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate w-full mt-0.5">
                              {bName ? `${bName} • ` : ""}
                              {rm.roomType || (ar ? "قياسية" : "Standard")}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 pt-1 border-t border-border/40 w-full">
                              <span>
                                {ar ? `السعة: ${cap}` : `Cap: ${cap}`}
                              </span>
                              <span
                                className={
                                  occ >= cap
                                    ? "text-amber-600 font-medium"
                                    : "text-emerald-600 font-medium"
                                }
                              >
                                {occ}/{cap}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bed Selector for currently picked room */}
                {editForm.roomId &&
                  (() => {
                    const selRoom = rooms.find(
                      (r: any) => String(r.id) === String(editForm.roomId),
                    );
                    const cap =
                      selRoom?.capacity ??
                      (roomTypeCapacity[selRoom?.roomType?.toLowerCase()] || 1);
                    if (cap <= 1) return null;
                    const bedOpts = getBedOptions(selRoom?.roomType, cap);

                    return (
                      <div className="p-2.5 rounded-lg border bg-muted/30 space-y-2">
                        <Label className="text-xs font-semibold">
                          {ar
                            ? "تحديد السرير المطلوب في هذه الغرفة:"
                            : "Select Bed in this room:"}
                        </Label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              editForm.bedNumber === "ALL"
                                ? "default"
                                : "outline"
                            }
                            className="h-7 text-xs"
                            onClick={() =>
                              setEditForm((f) => ({ ...f, bedNumber: "ALL" }))
                            }
                          >
                            {ar ? "الغرفة بالكامل" : "Entire Room"}
                          </Button>
                          {bedOpts.map((bedNum) => (
                            <Button
                              key={bedNum}
                              type="button"
                              size="sm"
                              variant={
                                editForm.bedNumber === String(bedNum)
                                  ? "default"
                                  : "outline"
                              }
                              className="h-7 text-xs"
                              onClick={() =>
                                setEditForm((f) => ({
                                  ...f,
                                  bedNumber: String(bedNum),
                                }))
                              }
                            >
                              {ar ? `سرير ${bedNum}` : `Bed ${bedNum}`}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{ar ? "ملاحظات" : "Notes"}</Label>
            <Textarea
              value={editForm.notes}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <div>
              {editDialog.reservation?.status === "UPCOMING" && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                  onClick={() => {
                    const res = editDialog.reservation;
                    setEditDialog({ open: false, reservation: null });
                    setCancelDialog({
                      open: true,
                      reservation: res,
                      reason: "",
                    });
                  }}
                >
                  <Ban className="w-4 h-4" />
                  {ar ? "إلغاء هذا الحجز" : "Cancel Reservation"}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
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
                    ? "جاري..."
                    : "..."
                  : ar
                    ? "حفظ التعديلات"
                    : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
