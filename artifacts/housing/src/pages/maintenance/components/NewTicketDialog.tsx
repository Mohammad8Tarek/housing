import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Wrench,
  Sparkles,
  FileText,
  Camera,
  ImageIcon,
  X,
  HardHat,
  User,
} from "lucide-react";
import {
  MAINTENANCE_PROBLEM_TYPES,
  HOUSEKEEPING_ORDER_TYPES,
  GENERAL_PROBLEM_TYPES,
  PRIORITIES,
  PRIORITY_AR,
} from "../utils/ticket-constants";

export interface TicketForm {
  roomId: string;
  category: string;
  problemType: string;
  description: string;
  priority: string;
  notes: string;
  workerId: string;
}

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCancel: () => void;
  ar: boolean;
  properties: any[];
  formPropertyId: string;
  setFormPropertyId: (v: string) => void;
  form: TicketForm;
  setForm: React.Dispatch<React.SetStateAction<TicketForm>>;
  allowedCreateCategories: string[];
  modalRooms: any[];
  rooms: any[];
  roomOccupantMap: Record<number, string>;
  formWorkers: any[];
  formPhotoUrl: string;
  setFormPhotoUrl: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function NewTicketDialog({
  open,
  onOpenChange,
  onCancel,
  ar,
  properties,
  formPropertyId,
  setFormPropertyId,
  form,
  setForm,
  allowedCreateCategories,
  modalRooms,
  rooms,
  roomOccupantMap,
  formWorkers,
  formPhotoUrl,
  setFormPhotoUrl,
  onSubmit,
  isPending,
}: NewTicketDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(
        ar
          ? "حجم الصورة كبير جداً (أقصى حد 5 ميجابايت)"
          : "Image too large (max 5MB)",
      );
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md sm:max-w-lg"
        srTitle={ar ? "إنشاء طلب جديد" : "Create New Ticket"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            {ar ? "إنشاء طلب / تذكرة جديدة" : "Create New Ticket"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Property Selector */}
          {properties.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {ar ? "الـ Resident" : "Resident"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formPropertyId}
                onValueChange={(v) => {
                  setFormPropertyId(v);
                  setForm((f) => ({ ...f, roomId: "" }));
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={ar ? "اختر الـ Resident" : "Select Resident"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.displayName || p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category Selector (if multiple allowed) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {ar ? "نوع الطلب والقسم المختص" : "Ticket Category & Department"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            {allowedCreateCategories.length > 1 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      category: "maintenance",
                      problemType: "Plumbing",
                    }))
                  }
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    form.category === "maintenance"
                      ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 shadow-xs ring-1 ring-amber-500"
                      : "bg-background hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <Wrench className="w-4 h-4 text-amber-600" />
                  <span>{ar ? "صيانة فنية" : "Maintenance"}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      category: "housekeeping",
                      problemType: "room_cleaning",
                    }))
                  }
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    form.category === "housekeeping"
                      ? "bg-sky-500/15 border-sky-500 text-sky-800 dark:text-sky-300 shadow-xs ring-1 ring-sky-500"
                      : "bg-background hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span>{ar ? "هاوس كيبنج" : "Housekeeping"}</span>
                </button>
                {allowedCreateCategories.includes("general") && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        category: "general",
                        problemType: "general_inquiry",
                      }))
                    }
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      form.category === "general"
                        ? "bg-purple-500/15 border-purple-500 text-purple-800 dark:text-purple-300 shadow-xs ring-1 ring-purple-500"
                        : "bg-background hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <FileText className="w-4 h-4 text-purple-600" />
                    <span>{ar ? "طلب عام" : "General"}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 border text-xs font-semibold">
                {form.category === "housekeeping" ? (
                  <>
                    <Sparkles className="w-4 h-4 text-sky-600" />
                    <span>
                      {ar ? "طلب هاوس كيبنج ونظافة" : "Housekeeping Order"}
                    </span>
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4 text-amber-600" />
                    <span>
                      {ar ? "بلاغ صيانة وعطل فني" : "Maintenance Work Order"}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Problem Type based on category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {form.category === "housekeeping"
                ? ar
                  ? "نوع خدمة النظافة"
                  : "Housekeeping Service Type"
                : form.category === "maintenance"
                  ? ar
                    ? "نوع المشكلة والعطل"
                    : "Issue / Problem Type"
                  : ar
                    ? "التصنيف"
                    : "Classification"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.problemType}
              onValueChange={(v) => setForm((f) => ({ ...f, problemType: v }))}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={ar ? "اختر النوع..." : "Select type..."}
                />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={4}
                className="max-h-64 overflow-y-auto"
              >
                {(form.category === "housekeeping"
                  ? HOUSEKEEPING_ORDER_TYPES
                  : form.category === "maintenance"
                    ? MAINTENANCE_PROBLEM_TYPES
                    : GENERAL_PROBLEM_TYPES
                ).map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    {ar ? item.labelAr : item.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {ar ? "الغرفة" : "Room"} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.roomId}
              onValueChange={(v) => setForm((f) => ({ ...f, roomId: v }))}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={ar ? "اختر الغرفة..." : "Select room..."}
                />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={4}
                className="max-h-64 overflow-y-auto"
              >
                {(modalRooms.length > 0 ? modalRooms : rooms)?.map((r: any) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    <span className="flex items-center justify-between w-full gap-3">
                      <span>
                        {ar ? "الغرفة" : "Room"} {r.roomNumber}
                      </span>
                      {roomOccupantMap[r.id] && (
                        <span className="text-[11px] text-muted-foreground font-normal">
                          ({roomOccupantMap[r.id]})
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.roomId && roomOccupantMap[Number(form.roomId)] && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>
                  {ar ? "النزيل المقيم:" : "Current Occupant:"}{" "}
                  <strong>{roomOccupantMap[Number(form.roomId)]}</strong>
                </span>
              </p>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {ar ? "الأولوية" : "Priority"}
            </Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          p === "URGENT"
                            ? "bg-red-500"
                            : p === "HIGH"
                              ? "bg-orange-500"
                              : p === "MEDIUM"
                                ? "bg-yellow-500"
                                : "bg-slate-400"
                        }`}
                      />
                      <span>{ar ? PRIORITY_AR[p] : p}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assign Worker (Optional) */}
          {formWorkers.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <HardHat className="w-3.5 h-3.5 text-primary" />
                <span>
                  {form.category === "housekeeping"
                    ? ar
                      ? "تعيين موظف نظافة (اختياري)"
                      : "Assign Cleaner (Optional)"
                    : ar
                      ? "تعيين فني من فريق العمل (اختياري)"
                      : "Assign Technician (Optional)"}
                </span>
              </Label>
              <Select
                value={form.workerId || "unassigned"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    workerId: v === "unassigned" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      form.category === "housekeeping"
                        ? ar
                          ? "اختر موظف النظافة..."
                          : "Select cleaner..."
                        : ar
                          ? "اختر الفني..."
                          : "Select worker..."
                    }
                  />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="max-h-56 overflow-y-auto"
                >
                  <SelectItem value="unassigned">
                    — {ar ? "بدون تعيين حالياً" : "None / Unassigned"} —
                  </SelectItem>
                  {formWorkers.map((w: any) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{w.name}</span>
                        <span className="text-muted-foreground text-[10px]">
                          ({w.specialty})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {ar ? "تفاصيل الطلب / المشكلة" : "Description & Details"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder={
                form.category === "housekeeping"
                  ? ar
                    ? "اكتب تفاصيل طلب النظافة أو المستلزمات المطلوبة..."
                    : "Describe cleaning or amenities requested..."
                  : ar
                    ? "صف المشكلة أو العطل بدقة..."
                    : "Describe the maintenance issue..."
              }
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
            />
          </div>

          {/* Photo Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {ar ? "صورة مرفقة (اختياري)" : "Attach Photo (Optional)"}
            </Label>
            <div className="flex items-center gap-3">
              {formPhotoUrl ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <img
                    src={formPhotoUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setFormPhotoUrl("")}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-black"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <label className="flex flex-col items-center gap-1 px-4 py-3 rounded-lg bg-surface border cursor-pointer hover:border-primary/40 transition-colors">
                    <Camera className="w-5 h-5 text-primary" />
                    <span className="text-[10px] text-muted-foreground">
                      {ar ? "كاميرا" : "Camera"}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                  <label className="flex flex-col items-center gap-1 px-4 py-3 rounded-lg bg-surface border cursor-pointer hover:border-primary/40 transition-colors">
                    <ImageIcon className="w-5 h-5 text-primary" />
                    <span className="text-[10px] text-muted-foreground">
                      {ar ? "معرض" : "Gallery"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onCancel}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={onSubmit} disabled={isPending}>
              {isPending
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? "إنشاء الطلب"
                  : "Create Ticket"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
