import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Wrench,
  Brush,
  CheckCircle2,
  AlertCircle,
  Building,
  Layers,
  Phone,
  User,
  Camera,
  X,
  Clock,
  Sparkles,
  Droplets,
  Zap,
  Snowflake,
  Hammer,
  Tv,
  Paintbrush,
  HelpCircle,
  BedDouble,
  Sparkle,
  Trash2,
  Bug,
  Shirt,
  Send,
  Loader2,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

interface RoomInfo {
  id: number;
  roomNumber: string;
  roomType: string;
  classification?: string | null;
  capacity: number;
  currentOccupancy: number;
  status: string;
  cleanlinessStatus: string;
  buildingName: string;
  floorNumber: number;
}

interface PropertyInfo {
  id: number;
  name: string;
  displayName: string;
  logo?: string | null;
  primaryColor?: string;
}

const MAINTENANCE_TYPES = [
  { id: "plumbing", labelAr: "سباكة ومياه", labelEn: "Plumbing & Water", icon: Droplets, color: "text-blue-500 bg-blue-500/10 border-blue-200" },
  { id: "electrical", labelAr: "كهرباء وإنارة", labelEn: "Electrical & Lights", icon: Zap, color: "text-amber-500 bg-amber-500/10 border-amber-200" },
  { id: "ac", labelAr: "تكييف وتبريد", labelEn: "Air Conditioning (AC)", icon: Snowflake, color: "text-cyan-500 bg-cyan-500/10 border-cyan-200" },
  { id: "carpentry", labelAr: "نجارة وأبواب وأثاث", labelEn: "Carpentry & Furniture", icon: Hammer, color: "text-amber-700 bg-amber-700/10 border-amber-300" },
  { id: "appliances", labelAr: "أجهزة وشاشات ودش", labelEn: "Appliances & TV", icon: Tv, color: "text-indigo-500 bg-indigo-500/10 border-indigo-200" },
  { id: "civil", labelAr: "دهانات ومحارة ومباني", labelEn: "Civil & Painting", icon: Paintbrush, color: "text-emerald-500 bg-emerald-500/10 border-emerald-200" },
  { id: "other", labelAr: "عطل أو مشكلة أخرى", labelEn: "Other Issue", icon: HelpCircle, color: "text-purple-500 bg-purple-500/10 border-purple-200" },
];

const HOUSEKEEPING_TYPES = [
  { id: "full_clean", labelAr: "تنظيف شامل للغرفة", labelEn: "Full Room Cleaning", icon: Brush, color: "text-emerald-500 bg-emerald-500/10 border-emerald-200" },
  { id: "linen_change", labelAr: "تغيير ملايات وفرش", labelEn: "Linen & Bedding Change", icon: BedDouble, color: "text-blue-500 bg-blue-500/10 border-blue-200" },
  { id: "amenities", labelAr: "مستلزمات نظافة وحمام", labelEn: "Toiletries & Supplies", icon: Sparkles, color: "text-amber-500 bg-amber-500/10 border-amber-200" },
  { id: "pest_control", labelAr: "مكافحة حشرات ورش", labelEn: "Pest Control", icon: Bug, color: "text-rose-500 bg-rose-500/10 border-rose-200" },
  { id: "trash", labelAr: "جمع ونقل القمامة", labelEn: "Trash Collection", icon: Trash2, color: "text-orange-500 bg-orange-500/10 border-orange-200" },
  { id: "curtains", labelAr: "غسيل مفروشات وستائر", labelEn: "Laundry & Curtains", icon: Shirt, color: "text-indigo-500 bg-indigo-500/10 border-indigo-200" },
];

export default function RoomServiceLandingPage() {
  const [, setLocation] = useLocation();
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const ar = lang === "ar";

  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState<PropertyInfo | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active Tab: maintenance or housekeeping
  const [activeTab, setActiveTab] = useState<"maintenance" | "housekeeping">("maintenance");

  // Form State
  const [selectedType, setSelectedType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"medium" | "urgent">("medium");
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [preferredTime, setPreferredTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Success State
  const [submittedTicket, setSubmittedTicket] = useState<{
    id: number;
    roomNumber: string;
    category: string;
    message: string;
  } | null>(null);

  // Extract params from URL
  const query = new URLSearchParams(window.location.search);
  const propertyId = Number(query.get("p") || query.get("propertyId"));
  const roomId = Number(query.get("r") || query.get("roomId"));

  // Load stored reporter info from localStorage
  useEffect(() => {
    try {
      const storedName = localStorage.getItem("sunrise_resident_name");
      const storedPhone = localStorage.getItem("sunrise_resident_phone");
      if (storedName) setReporterName(storedName);
      if (storedPhone) setReporterPhone(storedPhone);
    } catch {}
  }, []);

  // Fetch Room Info
  useEffect(() => {
    if (!propertyId || !roomId) {
      setError(
        ar
          ? "رابط الـ QR غير صالح أو ينقصه رقم الغرفة والفندق"
          : "Invalid QR code link. Room or Property ID missing."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/public/room-info?propertyId=${propertyId}&roomId=${roomId}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || (ar ? "فشل تحميل بيانات الغرفة" : "Failed to load room"));
        }
        return res.json();
      })
      .then((data) => {
        setProperty(data.property);
        setRoom(data.room);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || (ar ? "تعذر العثور على الغرفة" : "Room not found"));
        setLoading(false);
      });
  }, [propertyId, roomId, ar]);

  // Set default selected type on tab change
  useEffect(() => {
    if (activeTab === "maintenance") {
      setSelectedType(MAINTENANCE_TYPES[0].labelAr);
    } else {
      setSelectedType(HOUSEKEEPING_TYPES[0].labelAr);
    }
  }, [activeTab]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error(ar ? "حجم الصورة كبير جداً (الحد الأقصى 8 ميجابايت)" : "Photo exceeds 8MB limit");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) {
      toast.error(ar ? "يرجى اختيار نوع الطلب أولاً" : "Please select request type");
      return;
    }
    if (!description.trim()) {
      toast.error(ar ? "يرجى كتابة تفاصيل الطلب أو العطل" : "Please write description details");
      return;
    }

    setSubmitting(true);
    try {
      // Save contact to localStorage for convenience
      if (reporterName) localStorage.setItem("sunrise_resident_name", reporterName);
      if (reporterPhone) localStorage.setItem("sunrise_resident_phone", reporterPhone);

      const payload = {
        propertyId,
        roomId,
        category: activeTab,
        problemType: selectedType,
        description: description.trim(),
        priority: priority === "urgent" ? "urgent" : "medium",
        reporterName: reporterName.trim(),
        reporterPhone: reporterPhone.trim(),
        photoUrl: photoBase64,
        preferredTime: preferredTime.trim() || null,
      };

      const res = await fetch("/api/public/room-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || (ar ? "فشل إرسال الطلب" : "Submission failed"));
      }

      setSubmittedTicket({
        id: data.ticketId,
        roomNumber: data.roomNumber || room?.roomNumber || String(roomId),
        category: activeTab,
        message: data.message,
      });

      toast.success(
        ar ? "تم إرسال طلبك بنجاح!" : "Request submitted successfully!"
      );
    } catch (err: any) {
      toast.error(err.message || (ar ? "حدث خطأ أثناء الإرسال" : "Submission error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedTicket(null);
    setDescription("");
    setPhotoBase64(null);
    setPreferredTime("");
    if (activeTab === "maintenance") {
      setSelectedType(MAINTENANCE_TYPES[0].labelAr);
    } else {
      setSelectedType(HOUSEKEEPING_TYPES[0].labelAr);
    }
  };

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      className="fixed inset-0 z-50 h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-3 sm:p-6"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-start pb-28">
        {/* Top Bar with Language Toggle */}
        <div className="w-full flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            SH
          </div>
          <div>
            <h1 className="text-xs font-bold leading-tight">
              {ar ? "سكن موظفي صن رايز" : "Sunrise Staff Housing"}
            </h1>
            <p className="text-[10px] text-muted-foreground">
              {ar ? "منظومة الخدمة الذاتية الفورية للغرف" : "Instant Room Service Portal"}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLang(ar ? "en" : "ar")}
          className="h-7 px-2 text-xs font-semibold gap-1 bg-background"
        >
          <Languages className="w-3.5 h-3.5" />
          <span>{ar ? "English" : "عربي"}</span>
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="w-full max-w-lg bg-card border rounded-2xl p-8 text-center space-y-4 shadow-sm my-auto">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">
            {ar ? "جاري قراءة بيانات الغرفة..." : "Loading room details..."}
          </p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="w-full max-w-lg bg-card border border-destructive/30 rounded-2xl p-6 text-center space-y-4 shadow-sm my-auto">
          <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-base font-bold text-destructive">
              {ar ? "تعذر العثور على الغرفة" : "Room Information Unavailable"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 px-4">{error}</p>
          </div>
          <div className="pt-2 text-xs text-muted-foreground">
            {ar
              ? "يرجى التأكد من مسح كود الـ QR الأصلي الموجود على باب الغرفة"
              : "Please verify you scanned the official QR code on the room door"}
          </div>
        </div>
      )}

      {/* Success Confirmation Card */}
      {!loading && submittedTicket && (
        <div className="w-full max-w-lg bg-card border rounded-2xl p-6 text-center space-y-5 shadow-lg my-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <Badge variant="outline" className="text-xs font-mono font-bold bg-emerald-500/10 text-emerald-700 border-emerald-300">
              {ar ? `رقم الطلب: #${submittedTicket.id}` : `Ticket #${submittedTicket.id}`}
            </Badge>
            <h2 className="text-lg font-bold text-foreground mt-2">
              {ar ? "تم استلام طلبك بنجاح!" : "Request Received Successfully!"}
            </h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {submittedTicket.message}
            </p>
          </div>

          <div className="bg-muted/40 p-4 rounded-xl text-start text-xs space-y-2 border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{ar ? "الغرفة:" : "Room:"}</span>
              <span className="font-bold">{room?.roomNumber} ({room?.buildingName})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{ar ? "نوع الخدمة:" : "Service Type:"}</span>
              <span className="font-semibold text-primary">
                {submittedTicket.category === "housekeeping"
                  ? (ar ? "خدمة نظافة وهاوس كيبنج" : "Housekeeping")
                  : (ar ? "بلاغ صيانة وأعطال" : "Maintenance")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{ar ? "الحالة الحالية:" : "Current Status:"}</span>
              <Badge variant="secondary" className="text-[10px]">
                {ar ? "قيد المتابعة والتنفيذ" : "Open / In Progress"}
              </Badge>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleResetForm}
            className="w-full h-11 font-bold text-xs"
          >
            {ar ? "تقديم طلب أو بلاغ آخر للغرفة" : "Submit Another Request"}
          </Button>
        </div>
      )}

      {/* Main Request Form */}
      {!loading && !error && !submittedTicket && room && property && (
        <div className="w-full max-w-lg space-y-4">
          {/* Room Banner Card */}
          <div className="bg-gradient-to-br from-[#0F2A44] to-[#1e3a5f] text-white rounded-2xl p-4 shadow-md border border-[#C9A24D]/30">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#C9A24D] tracking-wider">
                  {property.displayName || property.name}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs opacity-80">{ar ? "غرفة رقم" : "Room"}</span>
                  <span className="text-2xl font-black tracking-tight text-white">
                    {room.roomNumber}
                  </span>
                </div>
              </div>

              <div className="text-end space-y-1">
                <Badge className="bg-[#C9A24D] text-[#0F2A44] hover:bg-[#C9A24D] font-bold text-[11px] shadow-sm">
                  {room.buildingName}
                </Badge>
                <p className="text-[11px] opacity-85">
                  {ar ? `الدور ${room.floorNumber}` : `Floor ${room.floorNumber}`}
                </p>
              </div>
            </div>
          </div>

          {/* Service Selector Tabs */}
          <div className="bg-card border rounded-2xl shadow-sm overflow-hidden p-4">
            <Tabs
              value={activeTab}
              onValueChange={(val: any) => setActiveTab(val)}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-full h-12 p-1 bg-muted/60 rounded-xl mb-4">
                <TabsTrigger
                  value="maintenance"
                  className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
                >
                  <Wrench className="w-4 h-4 text-amber-500" />
                  <span>{ar ? "صيانة وأعطال" : "Maintenance"}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="housekeeping"
                  className="rounded-lg text-xs font-bold gap-1.5 data-[state=active]:bg-background data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm"
                >
                  <Brush className="w-4 h-4 text-emerald-500" />
                  <span>{ar ? "نظافة وغرف" : "Housekeeping"}</span>
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 1. Maintenance Content */}
                <TabsContent value="maintenance" className="space-y-4 mt-0 focus-visible:outline-none">
                  <div>
                    <label className="text-xs font-bold block mb-2">
                      {ar ? "اختر نوع العطل:" : "Select Problem Type:"}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {MAINTENANCE_TYPES.map((t) => {
                        const Icon = t.icon;
                        const isSelected = selectedType === (ar ? t.labelAr : t.labelEn);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedType(ar ? t.labelAr : t.labelEn)}
                            className={`p-2.5 rounded-xl border text-start flex items-center gap-2 transition-all ${
                              isSelected
                                ? "border-primary bg-primary/10 ring-2 ring-primary/20 font-bold"
                                : "hover:bg-muted/40 border-border/80"
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${t.color}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[11px] leading-tight">
                              {ar ? t.labelAr : t.labelEn}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority Toggle */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/20">
                    <div>
                      <span className="text-xs font-bold block">
                        {ar ? "درجة استعجال العطل:" : "Urgency Level:"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {priority === "urgent"
                          ? (ar ? "عطل طارئ يعطل استخدام الغرفة (مثل تسريب أو انقطاع كهرباء)" : "Critical fault disrupting room usage")
                          : (ar ? "عطل عادي تجري صيانته في الموعد المعتاد" : "Standard routine repair")}
                      </span>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant={priority === "medium" ? "default" : "outline"}
                        onClick={() => setPriority("medium")}
                        className="h-7 text-[11px] px-2.5 font-semibold"
                      >
                        {ar ? "عادي" : "Normal"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={priority === "urgent" ? "destructive" : "outline"}
                        onClick={() => setPriority("urgent")}
                        className="h-7 text-[11px] px-2.5 font-semibold"
                      >
                        {ar ? "طارئ ⚡" : "Urgent ⚡"}
                      </Button>
                    </div>
                  </div>

                  {/* Photo Attachment */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold block">
                      {ar ? "صورة العطل (اختياري):" : "Fault Photo (Optional):"}
                    </label>
                    {photoBase64 ? (
                      <div className="relative rounded-xl overflow-hidden border w-32 h-32 bg-black/5">
                        <img src={photoBase64} alt="Fault" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPhotoBase64(null)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/40 transition-colors text-xs font-medium text-muted-foreground">
                        <Camera className="w-4 h-4 text-primary" />
                        <span>{ar ? "التقاط أو إرفاق صورة العطل" : "Snap or upload fault photo"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </TabsContent>

                {/* 2. Housekeeping Content */}
                <TabsContent value="housekeeping" className="space-y-4 mt-0 focus-visible:outline-none">
                  <div>
                    <label className="text-xs font-bold block mb-2">
                      {ar ? "اختر نوع خدمة النظافة:" : "Select Cleaning Service:"}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {HOUSEKEEPING_TYPES.map((t) => {
                        const Icon = t.icon;
                        const isSelected = selectedType === (ar ? t.labelAr : t.labelEn);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedType(ar ? t.labelAr : t.labelEn)}
                            className={`p-2.5 rounded-xl border text-start flex items-center gap-2 transition-all ${
                              isSelected
                                ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20 font-bold"
                                : "hover:bg-muted/40 border-border/80"
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${t.color}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[11px] leading-tight">
                              {ar ? t.labelAr : t.labelEn}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preferred Time */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold block flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      {ar ? "الوقت المفضل للخدمة (اختياري):" : "Preferred Time (Optional):"}
                    </label>
                    <Input
                      placeholder={ar ? "مثال: بعد الساعة 2 ظهراً أو أثناء الراحة" : "e.g. After 2:00 PM"}
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </TabsContent>

                {/* Common Fields */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block">
                    {ar ? "تفاصيل الطلب / المشكلة:" : "Request / Problem Details:"} <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    placeholder={
                      activeTab === "maintenance"
                        ? (ar ? "اشرح العطل بالتفصيل وأين مكانه بالضبط داخل الغرفة أو الحمام..." : "Describe the fault details...")
                        : (ar ? "أية ملاحظات إضافية لفريق النظافة..." : "Additional notes for housekeeping...")
                    }
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="text-xs resize-none"
                    required
                  />
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold flex items-center gap-1">
                      <User className="w-3 h-3 text-muted-foreground" />
                      {ar ? "اسمك (مقدم الطلب):" : "Your Name:"}
                    </label>
                    <Input
                      placeholder={ar ? "اسم الموظف أو النزيل" : "Your name"}
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold flex items-center gap-1">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {ar ? "رقم الهاتف / واتساب:" : "Phone / WhatsApp:"}
                    </label>
                    <Input
                      placeholder={ar ? "للتواصل عند الحاجة" : "Contact phone"}
                      value={reporterPhone}
                      onChange={(e) => setReporterPhone(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <Button
                  type="submit"
                  disabled={submitting}
                  className={`w-full h-11 text-xs font-bold gap-2 shadow-md ${
                    activeTab === "housekeeping"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-primary hover:bg-primary/90 text-primary-foreground"
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{ar ? "جاري إرسال الطلب..." : "Submitting..."}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        {activeTab === "housekeeping"
                          ? (ar ? "إرسال طلب النظافة الآن" : "Submit Housekeeping Request")
                          : (ar ? "إرسال بلاغ الصيانة الآن" : "Submit Maintenance Request")}
                      </span>
                    </>
                  )}
                </Button>
              </form>
            </Tabs>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            {ar
              ? "سيتم استلام طلبك ومتابعته مباشرة من قبل إدارة السكن والفريق المختص"
              : "Your request is directly routed to housing administration and technicians"}
          </p>
        </div>
      )}
      </div>
    </div>
  );
}
