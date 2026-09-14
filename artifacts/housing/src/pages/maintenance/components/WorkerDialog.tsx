import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Edit2,
  Wrench,
  Zap,
  Droplet,
  Wind,
  Hammer,
  Sparkles,
  Paintbrush,
  Tv,
  Phone,
  CreditCard,
  Building,
  DollarSign,
  Loader2,
} from "lucide-react";

export interface Worker {
  id?: number;
  name: string;
  phone?: string | null;
  nationalId?: string | null;
  specialty: string;
  status: "available" | "busy" | "on_leave" | "inactive";
  workerType: "internal" | "contractor";
  companyName?: string | null;
  dailyRate?: number | string | null;
  notes?: string | null;
  profileId?: number | null;
  activeTasksCount?: number;
  totalTasksCount?: number;
}

interface WorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worker?: Worker | null;
  propertyId: number;
  onSuccess?: () => void;
}

export const WORKER_SPECIALTIES = [
  { key: "general", labelAr: "صيانة عامة", labelEn: "General Maintenance", icon: Wrench },
  { key: "plumbing", labelAr: "سباكة وصحي", labelEn: "Plumbing", icon: Droplet },
  { key: "electrical", labelAr: "كهرباء وتمديدات", labelEn: "Electrical", icon: Zap },
  { key: "hvac", labelAr: "تكييف وتبريد", labelEn: "HVAC & AC", icon: Wind },
  { key: "carpentry", labelAr: "نجارة وأثاث", labelEn: "Carpentry & Furniture", icon: Hammer },
  { key: "painting", labelAr: "نقاشة ودهانات", labelEn: "Painting & Decor", icon: Paintbrush },
  { key: "housekeeping", labelAr: "هاوس كيبنج ونظافة", labelEn: "Housekeeping", icon: Sparkles },
  { key: "appliances", labelAr: "أجهزة كهربائية", labelEn: "Home Appliances", icon: Tv },
];

export const WORKER_STATUSES = [
  { key: "available", labelAr: "متاح للعمل", labelEn: "Available", color: "bg-emerald-500", textAr: "متاح", textEn: "Available" },
  { key: "busy", labelAr: "مشغول في مهمة", labelEn: "Busy / On Task", color: "bg-amber-500", textAr: "مشغول", textEn: "Busy" },
  { key: "on_leave", labelAr: "في إجازة", labelEn: "On Leave", color: "bg-blue-500", textAr: "إجازة", textEn: "On Leave" },
  { key: "inactive", labelAr: "غير نشط / موقوف", labelEn: "Inactive", color: "bg-slate-400", textAr: "موقوف", textEn: "Inactive" },
];

export function WorkerDialog({
  open,
  onOpenChange,
  worker,
  propertyId,
  onSuccess,
}: WorkerDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Worker>({
    name: "",
    phone: "",
    nationalId: "",
    specialty: "general",
    status: "available",
    workerType: "internal",
    companyName: "",
    dailyRate: "",
    notes: "",
  });

  useEffect(() => {
    if (worker) {
      setFormData({
        name: worker.name || "",
        phone: worker.phone || "",
        nationalId: worker.nationalId || "",
        specialty: worker.specialty || "general",
        status: worker.status || "available",
        workerType: worker.workerType || "internal",
        companyName: worker.companyName || "",
        dailyRate: worker.dailyRate ?? "",
        notes: worker.notes || "",
      });
    } else {
      setFormData({
        name: "",
        phone: "",
        nationalId: "",
        specialty: "general",
        status: "available",
        workerType: "internal",
        companyName: "",
        dailyRate: "",
        notes: "",
      });
    }
  }, [worker, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error(ar ? "يرجى كتابة اسم الفني" : "Worker name is required");
      return;
    }

    if (!propertyId) {
      toast.error(ar ? "يرجى اختيار الفندق أولاً" : "Please select a property first");
      return;
    }

    setLoading(true);
    try {
      const url = worker?.id
        ? `/api/workers/${worker.id}?propertyId=${propertyId}`
        : `/api/workers?propertyId=${propertyId}`;
      const method = worker?.id ? "PUT" : "POST";

      const payload = {
        ...formData,
        dailyRate: formData.dailyRate ? Number(formData.dailyRate) : null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (ar ? "فشل حفظ بيانات الفني" : "Failed to save worker"));
      }

      toast.success(
        worker?.id
          ? ar
            ? "تم تحديث بيانات الفني بنجاح"
            : "Worker updated successfully"
          : ar
            ? "تمت إضافة الفني بنجاح"
            : "Worker added successfully"
      );

      await queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || (ar ? "حدث خطأ غير متوقع" : "An unexpected error occurred"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md sm:max-w-lg"
        srTitle={
          worker?.id
            ? ar
              ? "تعديل بيانات فني"
              : "Edit Worker Details"
            : ar
              ? "إضافة فني جديد"
              : "Add New Worker"
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            {worker?.id ? (
              <Edit2 className="w-5 h-5 text-primary" />
            ) : (
              <UserPlus className="w-5 h-5 text-primary" />
            )}
            <span>
              {worker?.id
                ? ar
                  ? `تعديل بيانات الفني: ${worker.name}`
                  : `Edit Worker: ${worker.name}`
                : ar
                  ? "إضافة فني / عامل جديد للفندق"
                  : "Add New Technician / Worker"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {ar ? "اسم الفني / العامل" : "Worker Name"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={ar ? "مثال: أحمد مصطفى" : "e.g. Ahmed Mostafa"}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{ar ? "رقم الهاتف / واتساب" : "Phone / WhatsApp"}</span>
              </Label>
              <Input
                type="tel"
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="01xxxxxxxxx"
                className="h-9 text-sm text-left font-mono"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {ar ? "التخصص المهني" : "Trade / Specialty"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.specialty}
                onValueChange={(val) => setFormData({ ...formData, specialty: val })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={ar ? "اختر التخصص" : "Select specialty"} />
                </SelectTrigger>
                <SelectContent>
                  {WORKER_SPECIALTIES.map((spec) => {
                    const Icon = spec.icon;
                    return (
                      <SelectItem key={spec.key} value={spec.key}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-primary shrink-0" />
                          <span>{ar ? spec.labelAr : spec.labelEn}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {ar ? "الحالة التشغيلية" : "Operational Status"}
              </Label>
              <Select
                value={formData.status}
                onValueChange={(val: any) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={ar ? "اختر الحالة" : "Select status"} />
                </SelectTrigger>
                <SelectContent>
                  {WORKER_STATUSES.map((st) => (
                    <SelectItem key={st.key} value={st.key}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${st.color} shrink-0`} />
                        <span>{ar ? st.labelAr : st.labelEn}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {ar ? "نوع الفني" : "Worker Type"}
              </Label>
              <Select
                value={formData.workerType}
                onValueChange={(val: any) => setFormData({ ...formData, workerType: val })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">
                    {ar ? "فني داخلي (معين)" : "Internal Staff"}
                  </SelectItem>
                  <SelectItem value="contractor">
                    {ar ? "مقاول خارجي / مورد" : "External Contractor"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{ar ? "الرقم القومي / الهوية" : "National ID / Iqama"}</span>
              </Label>
              <Input
                value={formData.nationalId || ""}
                onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                placeholder={ar ? "الرقم القومي" : "National ID"}
                className="h-9 text-sm font-mono"
              />
            </div>
          </div>

          {formData.workerType === "contractor" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{ar ? "اسم شركة المقاولات" : "Company Name"}</span>
                </Label>
                <Input
                  value={formData.companyName || ""}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder={ar ? "اسم الشركة أو الورشة" : "Contractor / Workshop name"}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{ar ? "اليومية / التكلفة (ج.م)" : "Daily Rate (EGP)"}</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.dailyRate ?? ""}
                  onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                  placeholder="0.00"
                  className="h-9 text-sm font-mono"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {ar ? "ملاحظات إضافية" : "Notes / Instructions"}
            </Label>
            <Textarea
              rows={2}
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={ar ? "أوقات التواجد، أرقام إضافية، نطاق العمل..." : "Working hours, special equipment, notes..."}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-xs h-9"
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="text-xs h-9 gap-1.5 font-semibold"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {worker?.id
                  ? ar
                    ? "حفظ التعديلات"
                    : "Save Changes"
                  : ar
                    ? "إضافة الفني"
                    : "Add Worker"}
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
