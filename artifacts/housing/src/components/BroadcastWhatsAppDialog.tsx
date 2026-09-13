import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Radio,
  Send,
  Users,
  Building,
  Layers,
  DoorClosed,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Phone,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useListBuildings, useListFloors, useListRooms } from "@workspace/api-client-react";

interface BroadcastWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: number | string | null;
  initialTargetMode?: "all" | "building" | "floor" | "rooms" | "selected";
  selectedProfileIds?: number[];
  language?: string;
}

const PRESET_MESSAGES = [
  {
    titleAr: "تنبيه صيانة دورية 🔧",
    titleEn: "Maintenance Notice 🔧",
    textAr: `عزيزي الزميل/ {name} 🌴
نود إحاطتك علماً بوجود أعمال صيانة دورية مجدولة في {building}، غرفة {room}.
نرجو التكرم بالتعاون وتسهيل مهمة فريق الصيانة.
شاكرين لكم حسن تعاونكم.
إدارة سكن {property}`,
    textEn: `Dear {name} 🌴
Please be advised that scheduled maintenance will take place in {building}, Room {room}.
Thank you for your kind cooperation.
{property} Housing Management`,
  },
  {
    titleAr: "تعليمات الهاوس كيبنج 🧹",
    titleEn: "Housekeeping Alert 🧹",
    textAr: `عزيزي الزميل/ {name} 🌴
تذكير بموعد النظافة الدورية الأسبوعية لغرفة {room} غداً.
يُرجى ترتيب المتعلقات الشخصية لتسهيل عمل فريق الهاوس كيبنج.
نتمنى لك إقامة طيبة! ✨
إدارة سكن {property}`,
    textEn: `Dear {name} 🌴
Reminder of the scheduled weekly room cleaning for Room {room} tomorrow.
Please organize personal belongings to facilitate the housekeeping team's task.
{property} Housing Management`,
  },
  {
    titleAr: "إشعار إداري عام 📢",
    titleEn: "General Notice 📢",
    textAr: `عزيزي الزميل/ {name} 🌴
نحيطكم علماً بضرورة الالتزام بالتعليمات والهدوء داخل {building} للحفاظ على راحة جميع الزملاء.
شاكرين لكم تفهمكم وحسن تعاونكم الدائم.
إدارة سكن {property}`,
    textEn: `Dear {name} 🌴
Please adhere to housing regulations and quiet hours in {building} for everyone's comfort.
Thank you for your cooperation.
{property} Housing Management`,
  },
];

export function BroadcastWhatsAppDialog({
  open,
  onOpenChange,
  propertyId,
  initialTargetMode = "all",
  selectedProfileIds = [],
  language = "ar",
}: BroadcastWhatsAppDialogProps) {
  const ar = language === "ar";
  const numPropId = propertyId ? Number(propertyId) : null;

  // Targeting states
  const [targetType, setTargetType] = useState<"ALL" | "BUILDING" | "FLOOR" | "ROOMS" | "SELECTED">(
    initialTargetMode === "selected" && selectedProfileIds.length > 0 ? "SELECTED" : "ALL"
  );
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [roomFilterSearch, setRoomFilterSearch] = useState<string>("");

  // Message & Compose states
  const [messageText, setMessageText] = useState<string>("");
  const [recipientSearch, setRecipientSearch] = useState<string>("");

  // Preview & sending states
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<{
    totalMatched: number;
    readyCount: number;
    missingPhoneCount: number;
    recipients: any[];
  }>({ totalMatched: 0, readyCount: 0, missingPhoneCount: 0, recipients: [] });

  // Data lookups
  const { data: buildingsData } = useListBuildings({ propertyId: numPropId || undefined });
  const buildings = Array.isArray(buildingsData) ? buildingsData : (buildingsData as any)?.data || [];

  const { data: floorsData } = useListFloors({ propertyId: numPropId || undefined });
  const floors = Array.isArray(floorsData) ? floorsData : (floorsData as any)?.data || [];

  const { data: roomsData } = useListRooms({ propertyId: numPropId || undefined, limit: 1000 } as any);
  const rooms = Array.isArray(roomsData) ? roomsData : (roomsData as any)?.data || [];

  // Filter floors by selected building
  const availableFloors = useMemo(() => {
    if (!selectedBuildingId) return floors;
    return floors.filter((f: any) => String(f.buildingId) === String(selectedBuildingId));
  }, [floors, selectedBuildingId]);

  // Filter rooms
  const availableRooms = useMemo(() => {
    let list = rooms;
    if (selectedBuildingId) {
      list = list.filter((r: any) => String(r.buildingId) === String(selectedBuildingId));
    }
    if (selectedFloorId) {
      list = list.filter((r: any) => String(r.floorId) === String(selectedFloorId));
    }
    if (roomFilterSearch.trim()) {
      list = list.filter((r: any) => String(r.roomNumber).includes(roomFilterSearch.trim()));
    }
    return list;
  }, [rooms, selectedBuildingId, selectedFloorId, roomFilterSearch]);

  // Reset or set target mode on open
  useEffect(() => {
    if (open) {
      if (initialTargetMode === "selected" && selectedProfileIds.length > 0) {
        setTargetType("SELECTED");
      } else {
        setTargetType("ALL");
      }
    }
  }, [open, initialTargetMode, selectedProfileIds]);

  // Fetch preview whenever filters change
  const fetchPreview = async () => {
    if (!open || !numPropId) return;
    setIsLoadingPreview(true);
    try {
      const payload: any = { targetType };
      if (targetType === "BUILDING" && selectedBuildingId) {
        payload.buildingId = Number(selectedBuildingId);
      } else if (targetType === "FLOOR" && selectedFloorId) {
        payload.floorId = Number(selectedFloorId);
      } else if (targetType === "ROOMS" && selectedRoomIds.length > 0) {
        payload.roomIds = selectedRoomIds;
      } else if (targetType === "SELECTED" && selectedProfileIds.length > 0) {
        payload.profileIds = selectedProfileIds;
      }

      const res = await fetch(`/api/whatsapp/broadcast/preview?propertyId=${numPropId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewData({
          totalMatched: data.totalMatched || 0,
          readyCount: data.readyCount || 0,
          missingPhoneCount: data.missingPhoneCount || 0,
          recipients: data.recipients || [],
        });
      }
    } catch (e: any) {
      console.error("Failed to fetch broadcast preview:", e);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchPreview();
    }
  }, [open, numPropId, targetType, selectedBuildingId, selectedFloorId, selectedRoomIds]);

  // Insert variable tag into message
  const insertTag = (tag: string) => {
    setMessageText((prev) => prev + " " + tag);
  };

  // Filter recipient list preview
  const displayedRecipients = useMemo(() => {
    if (!recipientSearch.trim()) return previewData.recipients;
    const q = recipientSearch.toLowerCase();
    return previewData.recipients.filter(
      (r: any) =>
        r.name.toLowerCase().includes(q) ||
        r.roomNumber.toLowerCase().includes(q) ||
        (r.buildingName && r.buildingName.toLowerCase().includes(q)) ||
        (r.phone && r.phone.includes(q))
    );
  }, [previewData.recipients, recipientSearch]);

  // Handle Send Broadcast
  const handleSendBroadcast = async () => {
    if (!messageText.trim()) {
      toast.error(ar ? "يرجى كتابة نص الرسالة أولاً" : "Please enter message text");
      return;
    }

    const eligibleRecipients = previewData.recipients.filter((r) => r.hasPhone);
    if (eligibleRecipients.length === 0) {
      toast.error(
        ar
          ? "لا يوجد أي مستلم لديه رقم هاتف واتساب مسجل في التحديد الحالي!"
          : "No recipients with valid WhatsApp phone in this selection!"
      );
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch(`/api/whatsapp/broadcast/send?propertyId=${numPropId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          recipients: eligibleRecipients,
          messageText,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send broadcast");
      }

      toast.success(
        ar
          ? `🚀 تم جدولة إرسال ${data.stats?.queued || eligibleRecipients.length} رسالة جماعية في الخلفية بأمان!`
          : `🚀 Broadcast queued successfully for ${data.stats?.queued || eligibleRecipients.length} recipients!`
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || (ar ? "حدث خطأ أثناء إرسال الرسائل" : "Error sending broadcast"));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-primary/20 shadow-2xl">
        <DialogHeader className="p-5 border-b bg-muted/40 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20 shadow-xs">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  {ar ? "إرسال رسالة جماعية (واتساب)" : "Broadcast WhatsApp Message"}
                  <Badge variant="outline" className="text-[11px] font-medium bg-emerald-50 text-emerald-700 border-emerald-300">
                    <ShieldCheck className="w-3 h-3 mr-1 rtl:ml-1" />
                    {ar ? "نظام آمن ضد الحظر" : "Anti-Ban Protected"}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {ar
                    ? "تحديد الشريحة المستهدفة من المقيمين وإرسال إشعار موجه ومخصص عبر الواتساب"
                    : "Target specific residents and dispatch personalized notifications"}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* 1. Targeting Mode */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {ar ? "1. الشريحة المستهدفة" : "1. Target Audience"}
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetType("ALL");
                  setSelectedBuildingId("");
                  setSelectedFloorId("");
                  setSelectedRoomIds([]);
                }}
                className={`p-3 rounded-xl border-2 text-start transition-all flex flex-col gap-1.5 ${
                  targetType === "ALL"
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 shadow-xs"
                    : "border-border hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Users className="w-4 h-4 text-emerald-600" />
                  {targetType === "ALL" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <span className="text-xs font-bold">{ar ? "جميع المقيمين" : "All In-House"}</span>
                <span className="text-[10px] text-muted-foreground">{ar ? "كامل السكن" : "Full Property"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetType("BUILDING");
                  setSelectedFloorId("");
                  setSelectedRoomIds([]);
                }}
                className={`p-3 rounded-xl border-2 text-start transition-all flex flex-col gap-1.5 ${
                  targetType === "BUILDING"
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 shadow-xs"
                    : "border-border hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Building className="w-4 h-4 text-emerald-600" />
                  {targetType === "BUILDING" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <span className="text-xs font-bold">{ar ? "حسب المبنى" : "By Building"}</span>
                <span className="text-[10px] text-muted-foreground">{ar ? "مبنى محدد" : "Single Building"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetType("FLOOR");
                  setSelectedRoomIds([]);
                }}
                className={`p-3 rounded-xl border-2 text-start transition-all flex flex-col gap-1.5 ${
                  targetType === "FLOOR"
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 shadow-xs"
                    : "border-border hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  {targetType === "FLOOR" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <span className="text-xs font-bold">{ar ? "حسب الدور" : "By Floor"}</span>
                <span className="text-[10px] text-muted-foreground">{ar ? "دور معين" : "Single Floor"}</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetType("ROOMS")}
                className={`p-3 rounded-xl border-2 text-start transition-all flex flex-col gap-1.5 ${
                  targetType === "ROOMS"
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 shadow-xs"
                    : "border-border hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <DoorClosed className="w-4 h-4 text-emerald-600" />
                  {targetType === "ROOMS" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <span className="text-xs font-bold">{ar ? "غرف معينة" : "Specific Rooms"}</span>
                <span className="text-[10px] text-muted-foreground">{ar ? "تحديد غرف" : "Pick Rooms"}</span>
              </button>
            </div>

            {/* Target Criteria Sub-selectors */}
            {targetType === "BUILDING" && (
              <div className="p-3 bg-muted/30 rounded-lg border flex flex-col gap-1.5 animate-in fade-in-50">
                <Label className="text-xs font-medium">{ar ? "اختر المبنى المطلوب:" : "Select Building:"}</Label>
                <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={ar ? "اختر مبنى..." : "Select building..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((b: any) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetType === "FLOOR" && (
              <div className="p-3 bg-muted/30 rounded-lg border grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in-50">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">{ar ? "المبنى:" : "Building:"}</Label>
                  <Select value={selectedBuildingId} onValueChange={(val) => { setSelectedBuildingId(val); setSelectedFloorId(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder={ar ? "اختر المبنى..." : "Select building..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {buildings.map((b: any) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">{ar ? "الدور / الطابق:" : "Floor:"}</Label>
                  <Select value={selectedFloorId} onValueChange={setSelectedFloorId} disabled={!selectedBuildingId}>
                    <SelectTrigger>
                      <SelectValue placeholder={ar ? "اختر الدور..." : "Select floor..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFloors.map((f: any) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {ar ? `الدور ${f.floorNumber}` : `Floor ${f.floorNumber}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {targetType === "ROOMS" && (
              <div className="p-3 bg-muted/30 rounded-lg border space-y-2 animate-in fade-in-50">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">{ar ? "حدد الغرف المطلوبة:" : "Select Rooms:"}</Label>
                  {selectedRoomIds.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedRoomIds([])} className="h-6 text-[11px] text-destructive">
                      {ar ? "إلغاء تحديد الكل" : "Clear All"}
                    </Button>
                  )}
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={ar ? "تصفية برقم الغرفة..." : "Filter room number..."}
                    value={roomFilterSearch}
                    onChange={(e) => setRoomFilterSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 border rounded bg-background">
                  {availableRooms.map((r: any) => {
                    const isSelected = selectedRoomIds.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedRoomIds((prev) =>
                            isSelected ? prev.filter((id) => id !== r.id) : [...prev, r.id]
                          );
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                          isSelected
                            ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                            : "bg-muted/40 hover:bg-muted text-foreground border-border"
                        }`}
                      >
                        {r.roomNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Recipient Preview Metrics */}
          <div className="p-4 rounded-xl border bg-card/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {ar ? "2. إحصائية المستلمين المطابقين" : "2. Matched Recipients"}
              </span>
              <Button variant="ghost" size="sm" onClick={fetchPreview} disabled={isLoadingPreview} className="h-7 text-xs gap-1">
                <RefreshCw className={`w-3 h-3 ${isLoadingPreview ? "animate-spin" : ""}`} />
                {ar ? "تحديث المعاينة" : "Refresh"}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border bg-background flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold text-foreground">{previewData.totalMatched}</span>
                <span className="text-[11px] text-muted-foreground">{ar ? "إجمالي المطابقين" : "Total Matched"}</span>
              </div>

              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold text-emerald-600">{previewData.readyCount}</span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                  {ar ? "جاهز للإرسال (واتساب)" : "Ready (With Phone)"}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-extrabold text-amber-600">{previewData.missingPhoneCount}</span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  {ar ? "بدون رقم هاتف" : "Missing Phone"}
                </span>
              </div>
            </div>

            {/* Warning if missing phones */}
            {previewData.missingPhoneCount > 0 && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 text-amber-800 dark:text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  {ar
                    ? `تنبيه: يوجد ${previewData.missingPhoneCount} مقيم ليس لديهم رقم هاتف مسجل في ملفهم الشخصي. سيتم تجاوزهم تلقائياً لعدم توفر رقم.`
                    : `Notice: ${previewData.missingPhoneCount} resident(s) have no phone recorded in profile. They will be skipped.`}
                </span>
              </div>
            )}

            {/* Collapsible recipient table */}
            {previewData.recipients.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">{ar ? "قائمة المستلمين:" : "Recipient List:"}</span>
                  <Input
                    placeholder={ar ? "بحث في القائمة..." : "Search list..."}
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="h-7 w-48 text-xs"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border text-xs divide-y bg-background">
                  {displayedRecipients.map((r: any) => (
                    <div key={r.profileId} className="p-2 flex items-center justify-between gap-2 hover:bg-muted/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold truncate">{r.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                          {r.buildingName ? `${r.buildingName} - ` : ""}غرفة {r.roomNumber}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {r.hasPhone ? (
                          <span className="text-[11px] font-mono text-emerald-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {r.phone}
                          </span>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                            {ar ? "لا يوجد هاتف" : "No Phone"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Message Composer */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {ar ? "3. محرر الرسالة" : "3. Message Composer"}
              </Label>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>{ar ? "عدد الحروف:" : "Characters:"}</span>
                <span className="font-mono font-bold text-foreground">{messageText.length}</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">{ar ? "نماذج رسائل سريعة:" : "Quick Templates:"}</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_MESSAGES.map((preset, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMessageText(ar ? preset.textAr : preset.textEn)}
                    className="h-7 text-xs gap-1 border-dashed hover:border-emerald-500 hover:text-emerald-700"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    {ar ? preset.titleAr : preset.titleEn}
                  </Button>
                ))}
              </div>
            </div>

            {/* Variables Bar */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">{ar ? "إدراج متغيرات ديناميكية:" : "Insert Variables:"}</span>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => insertTag("{name}")}
                  className="h-6 text-[11px] px-2 font-mono"
                >
                  {"{name}"} <span className="text-[9px] text-muted-foreground ml-1">({ar ? "الاسم" : "Name"})</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => insertTag("{room}")}
                  className="h-6 text-[11px] px-2 font-mono"
                >
                  {"{room}"} <span className="text-[9px] text-muted-foreground ml-1">({ar ? "الغرفة" : "Room"})</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => insertTag("{building}")}
                  className="h-6 text-[11px] px-2 font-mono"
                >
                  {"{building}"} <span className="text-[9px] text-muted-foreground ml-1">({ar ? "المبنى" : "Building"})</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => insertTag("{property}")}
                  className="h-6 text-[11px] px-2 font-mono"
                >
                  {"{property}"} <span className="text-[9px] text-muted-foreground ml-1">({ar ? "السكن" : "Hotel"})</span>
                </Button>
              </div>
            </div>

            <Textarea
              placeholder={
                ar
                  ? "اكتب نص الرسالة الجماعية هنا... يمكنك استخدام المتغيرات أعلاه لتخصيص كل رسالة باسم المقيم وغرفته."
                  : "Type your broadcast message here... Use tags above to personalize each message."
              }
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={5}
              className="resize-none font-sans text-sm leading-relaxed"
            />
          </div>

          {/* Anti-Ban Safe Pacing Footer Note */}
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-muted-foreground flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-foreground">
                {ar ? "إرسال ذكي آمن ضد حظر الواتساب:" : "Anti-Ban Safe Pacing:"}
              </span>
              <p className="leading-normal">
                {ar
                  ? "يتم توزيع الرسائل عبر طابور ذكي مع تأخير واقعي ومحاكاة الكتابة البشرية (Human Typing Delay)، مما يضمن وصول الرسائل للجميع بسلاسة دون تعريض الرقم للإيقاف."
                  : "Messages are paced in a background queue with realistic human typing delays to protect your WhatsApp account from being flagged."}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/30 sticky bottom-0 z-10 flex items-center justify-between sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            {ar ? "إلغاء" : "Cancel"}
          </Button>

          <Button
            onClick={handleSendBroadcast}
            disabled={isSending || !messageText.trim() || previewData.readyCount === 0}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {ar ? "جاري الإرسال..." : "Sending..."}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {ar ? `إرسال إلى ${previewData.readyCount} مقيم الآن` : `Send to ${previewData.readyCount} Residents`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
