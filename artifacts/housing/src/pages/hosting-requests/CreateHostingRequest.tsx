import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Loader2,
  Upload,
  Paperclip,
  AlertTriangle,
  User,
  History,
  CalendarCheck,
} from "lucide-react";
import { useProperty } from "@/context/PropertyContext";
import { useAuth } from "@/context/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type ProfileResult = {
  id: number;
  profileId: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string | null;
  department?: string | null;
  accommodationRoom?: string | null;
  accommodationRoomType?: string | null;
  accommodationBuilding?: string | null;
  accommodationFloor?: string | null;
};

type HistoryRecord = {
  id: number;
  requestNumber: string;
  status: string;
  fromDate: string;
  toDate: string;
  consumedDays: number;
};

const STATUS_STYLES: Record<string, { label: string; labelAr: string; cls: string }> = {
  in_signing: { label: "In Review", labelAr: "قيد المراجعة", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  approved:   { label: "Approved",  labelAr: "مقبول",       cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  rejected:   { label: "Rejected",  labelAr: "مرفوض",       cls: "bg-rose-100 text-rose-800 border-rose-300" },
  returned:   { label: "Returned",  labelAr: "مُعاد",         cls: "bg-slate-100 text-slate-700 border-slate-300" },
  cancelled:  { label: "Cancelled", labelAr: "ملغي",          cls: "bg-gray-100 text-gray-600 border-gray-300" },
};

function StatusBadge({ status, ar }: { status: string; ar: boolean }) {
  const meta = STATUS_STYLES[status] ?? { label: status, labelAr: status, cls: "bg-slate-100 text-slate-700" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.cls}`}>
      {ar ? meta.labelAr : meta.label}
    </span>
  );
}

export default function CreateHostingRequest() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [, setLocation] = useLocation();
  const { properties, activePropertyId } = useProperty();
  const { user } = useAuth();

  const [form, setForm] = useState({
    hotelId: "",
    clockNumber: "",
    visitHotelId: "",
    numberOfRooms: "",
    assignedRoomNumber: "",
    familyMembersCount: "",
    familyMembersIncluded: "",
    fromDate: "",
    toDate: "",
    consumedDays: 0,
    remarks: "",
    attachmentData: "",
  });

  const [assignedRoomInfo, setAssignedRoomInfo] = useState<{
    id: number;
    roomType: string;
    building: string;
    floor: string;
    isOccupied?: boolean;
    isReserved?: boolean;
    hasPendingRequest?: boolean;
  } | null>(null);
  const [isSearchingRoom, setIsSearchingRoom] = useState(false);
  const searchRoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [profile, setProfile] = useState<ProfileResult | null>(null);
  const [isSearchingEmp, setIsSearchingEmp] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-fetch profile by Clock Number (debounced)
  useEffect(() => {
    if (!form.clockNumber || form.clockNumber.length < 2) {
      setProfile(null);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingEmp(true);
      try {
        const propId = form.hotelId || activePropertyId || "";
        const resp = await fetch(
          `/api/profiles/search?q=${encodeURIComponent(form.clockNumber)}&propertyId=${propId}`,
        );
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          const exact = data.find(
            (e) => String(e.profileId) === String(form.clockNumber),
          );
          setProfile(exact || data[0]);
        } else {
          setProfile(null);
        }
      } catch {
        setProfile(null);
      } finally {
        setIsSearchingEmp(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [form.clockNumber, form.hotelId, activePropertyId]);

  // Auto-fetch room info by room number (debounced)
  useEffect(() => {
    if (!form.assignedRoomNumber || form.assignedRoomNumber.length < 1) {
      setAssignedRoomInfo(null);
      return;
    }

    if (searchRoomTimeoutRef.current)
      clearTimeout(searchRoomTimeoutRef.current);

    searchRoomTimeoutRef.current = setTimeout(async () => {
      setIsSearchingRoom(true);
      try {
        const propId =
          form.visitHotelId || form.hotelId || activePropertyId || "";
        const resp = await fetch(
          `/api/rooms/by-number?number=${encodeURIComponent(form.assignedRoomNumber)}&propertyId=${propId}`,
        );
        if (resp.ok) {
          const data = await resp.json();
          setAssignedRoomInfo(data);
        } else {
          setAssignedRoomInfo(null);
        }
      } catch {
        setAssignedRoomInfo(null);
      } finally {
        setIsSearchingRoom(false);
      }
    }, 500);

    return () => {
      if (searchRoomTimeoutRef.current)
        clearTimeout(searchRoomTimeoutRef.current);
    };
  }, [form.assignedRoomNumber, form.visitHotelId, form.hotelId, activePropertyId]);

  const updateField = (field: string, value: any) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "fromDate" || field === "toDate") {
        const from = field === "fromDate" ? value : prev.fromDate;
        const to = field === "toDate" ? value : prev.toDate;
        if (from && to) {
          const diff = Math.max(
            0,
            Math.ceil(
              (new Date(to).getTime() - new Date(from).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          );
          updated.consumedDays = diff;
        }
      }
      return updated;
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/hosting-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: form.hotelId ? parseInt(form.hotelId) : undefined,
          visitHotelId: form.visitHotelId
            ? parseInt(form.visitHotelId)
            : undefined,
          clockNumber: form.clockNumber || undefined,
          numberOfRooms: 1,
          assignedRoomId: assignedRoomInfo?.id || undefined,
          familyMembersCount: parseInt(form.familyMembersCount),
          familyMembersIncluded: form.familyMembersIncluded || undefined,
          fromDate: form.fromDate,
          toDate: form.toDate,
          consumedDays: form.consumedDays,
          remarks: form.remarks || undefined,
          attachmentData: form.attachmentData || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create");
      return data.data;
    },
    onSuccess: (created) => {
      toast.success(
        ar
          ? `تم إنشاء الطلب ${created.requestNumber || created.request_number}`
          : `Request ${created.requestNumber || created.request_number} created`,
      );
      setLocation(`/hosting-requests/${created.requestNumber || created.request_number || created.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Hosting history for this profile
  const { data: hostingHistory = [], isLoading: isLoadingHistory } = useQuery<HistoryRecord[]>({
    queryKey: ["hosting-history", profile?.profileId],
    queryFn: async () => {
      if (!profile?.profileId) return [];
      const res = await fetch(
        `/api/hosting-requests/history/${encodeURIComponent(String(profile.profileId))}`,
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.data || [];
    },
    enabled: !!profile?.profileId,
  });

  // Detect if selected dates overlap with any active/in_signing history record
  const hasDateConflict = useMemo(() => {
    if (!form.fromDate || !form.toDate || hostingHistory.length === 0) return null;
    const newFrom = new Date(form.fromDate).getTime();
    const newTo = new Date(form.toDate).getTime();
    return hostingHistory.find((h) => {
      if (!["in_signing", "approved"].includes(h.status)) return false;
      const hFrom = new Date(h.fromDate).getTime();
      const hTo = new Date(h.toDate).getTime();
      return newFrom <= hTo && newTo >= hFrom;
    }) || null;
  }, [form.fromDate, form.toDate, hostingHistory]);

  // Last hosting record
  const lastHosting = hostingHistory.length > 0 ? hostingHistory[0] : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.hotelId ||
      !form.clockNumber ||
      !form.visitHotelId ||
      !form.assignedRoomNumber ||
      !form.familyMembersCount ||
      !form.fromDate ||
      !form.toDate
    ) {
      toast.error(
        ar ? "يرجى ملء الحقول المطلوبة (*)" : "Please fill required fields (*)",
      );
      return;
    }
    if (hasDateConflict) {
      toast.error(
        ar
          ? `يوجد طلب مكرر للموظف في نفس الفترة (طلب رقم ${hasDateConflict.requestNumber})`
          : `Duplicate request exists for this profile in the same period (Request ${hasDateConflict.requestNumber})`,
      );
      return;
    }
    createMutation.mutate();
  };

  const empFullName = profile
    ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
    : "";

  return (
    <div className="w-full space-y-6 max-w-6xl mx-auto pb-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/hosting-requests")}
        >
          <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
        </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {ar ? "إنشاء طلب استضافة" : "Create Hosting Request"}
              {empFullName ? ` — ${empFullName}` : ""}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {ar ? "طلبات الاستضافة" : "Hosting Requests"}
            </p>
          </div>
        </div>

        <form id="hosting-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Request Information */}
          <Card className="border-t-4 border-t-primary/20">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                {ar ? "معلومات الطلب" : "Request Information"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
              <div className="space-y-2">
                <Label>{ar ? "السكن الأساسي *" : "Residence *"}</Label>
                <Select
                  value={form.hotelId}
                  onValueChange={(v) => updateField("hotelId", v)}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={ar ? "اختر الفندق" : "Select Hotel"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {properties?.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{ar ? "سكن الزيارة *" : "Visit Residence *"}</Label>
                <Select
                  value={form.visitHotelId}
                  onValueChange={(v) => updateField("visitHotelId", v)}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        ar ? "اختر سكن الزيارة" : "Select Visit Residence"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {properties?.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Profile Data */}
          <Card className="border-t-4 border-t-blue-400/40 bg-blue-50/20 dark:bg-blue-950/10">
            <CardHeader className="bg-blue-50/40 dark:bg-blue-900/10 pb-4 flex flex-row items-center gap-3 space-y-0">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  {ar ? "بيانات الموظف" : "Profile Data"}
                  <span className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-blue-100 text-blue-700 rounded-full">
                    {ar ? "تعبئة تلقائية" : "Auto-filled"}
                  </span>
                </CardTitle>
              </div>
              {lastHosting && (
                <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground bg-background border rounded-lg px-3 py-2">
                  <CalendarCheck className="w-3.5 h-3.5 text-blue-500" />
                  <span>{ar ? "آخر استضافة:" : "Last hosting:"}</span>
                  <span className="font-medium">{new Date(lastHosting.fromDate).toLocaleDateString()}</span>
                  <StatusBadge status={lastHosting.status} ar={ar} />
                </div>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6">
              <div className="space-y-2">
                <Label className="flex justify-between">
                  <span>{ar ? "رقم البصمة *" : "Clock Number *"}</span>
                  {isSearchingEmp && (
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  )}
                </Label>
                <Input
                  placeholder="12345"
                  value={form.clockNumber}
                  onChange={(e) => updateField("clockNumber", e.target.value)}
                />
                {form.clockNumber.length >= 2 && !isSearchingEmp && !profile && (
                  <p className="text-xs text-rose-500">
                    {ar ? "لم يُعثر على موظف بهذا الرقم" : "No profile found with this ID"}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{ar ? "الاسم" : "Name"}</Label>
                <Input
                  readOnly
                  className="bg-muted/50"
                  value={empFullName}
                  placeholder={ar ? "الاسم" : "Name"}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "القسم" : "Department"}</Label>
                <Input
                  readOnly
                  className="bg-muted/50"
                  value={profile?.department || ""}
                  placeholder={ar ? "القسم" : "Department"}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "المنصب" : "Position"}</Label>
                <Input
                  readOnly
                  className="bg-muted/50"
                  value={profile?.jobTitle || ""}
                  placeholder={ar ? "المنصب" : "Position"}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "مبنى السكن" : "Acc. Building"}</Label>
                <Input
                  readOnly
                  className="bg-muted/50"
                  value={profile?.accommodationBuilding || ""}
                  placeholder={ar ? "المبنى" : "Building"}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "دور السكن" : "Acc. Floor"}</Label>
                <Input
                  readOnly
                  className="bg-muted/50"
                  value={profile?.accommodationFloor || ""}
                  placeholder={ar ? "الدور" : "Floor"}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "رقم غرفة السكن" : "Acc. Room"}</Label>
                <Input
                  readOnly
                  className="bg-muted/50"
                  value={profile?.accommodationRoom || ""}
                  placeholder={ar ? "الغرفة" : "Room"}
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "نوع الغرفة" : "Room Type"}</Label>
                <Input
                  readOnly
                  className="bg-muted/50"
                  value={profile?.accommodationRoomType || ""}
                  placeholder={ar ? "النوع" : "Type"}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 2.5: Hosting History */}
          {profile && (
            <Card className="border-t-4 border-t-indigo-400/40">
              <CardHeader className="bg-indigo-50/30 dark:bg-indigo-900/10 pb-4 flex flex-row items-center gap-3 space-y-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <History className="w-5 h-5 text-white" />
                </div>
                <CardTitle className="text-lg text-indigo-900 dark:text-indigo-200">
                  {ar ? "سجل الاستضافات السابقة" : "Previous Hosting Records"}
                </CardTitle>
                {hostingHistory.length > 0 && (
                  <span className="ml-auto text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                    {hostingHistory.length} {ar ? "سجل" : "records"}
                  </span>
                )}
              </CardHeader>
              <CardContent className="pt-4">
                {isLoadingHistory ? (
                  <div className="flex justify-center p-6">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  </div>
                ) : hostingHistory.length > 0 ? (
                  <div className="rounded-xl border bg-card overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="font-semibold">{ar ? "رقم الطلب" : "Request #"}</TableHead>
                          <TableHead>{ar ? "من" : "From"}</TableHead>
                          <TableHead>{ar ? "إلى" : "To"}</TableHead>
                          <TableHead>{ar ? "الأيام" : "Days"}</TableHead>
                          <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {hostingHistory.map((h) => (
                          <TableRow key={h.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono text-sm font-medium">
                              {h.requestNumber}
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(h.fromDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(h.toDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{h.consumedDays}</TableCell>
                            <TableCell>
                              <StatusBadge status={h.status} ar={ar} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                    <History className="w-8 h-8 opacity-30" />
                    <p className="text-sm">
                      {ar
                        ? "لا توجد استضافات سابقة لهذا الموظف"
                        : "No previous hosting records for this profile"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Date Conflict Warning */}
          {hasDateConflict && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800 text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">
                  {ar ? "تعارض في التواريخ!" : "Date Conflict Detected!"}
                </p>
                <p className="text-sm mt-0.5 opacity-80">
                  {ar
                    ? `يوجد طلب ${hasDateConflict.status === "approved" ? "معتمد" : "قيد المراجعة"} رقم ${hasDateConflict.requestNumber} للموظف في نفس الفترة الزمنية.`
                    : `A ${hasDateConflict.status === "approved" ? "approved" : "pending"} request (${hasDateConflict.requestNumber}) already exists for this profile covering the same dates.`}
                </p>
              </div>
            </div>
          )}

          {/* Section 3: Visit Details */}
          <Card className="border-t-4 border-t-primary/20">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                {ar ? "تفاصيل الزيارة" : "Visit Details"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>{ar ? "أفراد العائلة *" : "Family Members *"}</Label>
                  <Input
                    type="number"
                    min={1}
                    required
                    value={form.familyMembersCount}
                    onChange={(e) =>
                      updateField("familyMembersCount", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {ar
                      ? "أفراد العائلة المشمولين *"
                      : "Family Members Included *"}
                  </Label>
                  <Select
                    value={form.familyMembersIncluded}
                    onValueChange={(v) => updateField("familyMembersIncluded", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={ar ? "اختر" : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Spouse">
                        {ar ? "الزوج/الزوجة" : "Spouse"}
                      </SelectItem>
                      <SelectItem value="Children">
                        {ar ? "الأبناء" : "Children"}
                      </SelectItem>
                      <SelectItem value="Parents">
                        {ar ? "الوالدين" : "Parents"}
                      </SelectItem>
                      <SelectItem value="Spouse & Children">
                        {ar ? "الزوج/الزوجة والأبناء" : "Spouse & Children"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>{ar ? "من *" : "From *"}</Label>
                  <Input
                    type="date"
                    required
                    value={form.fromDate}
                    onChange={(e) => updateField("fromDate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{ar ? "إلى *" : "To *"}</Label>
                  <Input
                    type="date"
                    required
                    value={form.toDate}
                    onChange={(e) => updateField("toDate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{ar ? "الأيام المستهلكة *" : "Consumed Days *"}</Label>
                  <Input
                    type="number"
                    value={form.consumedDays}
                    readOnly
                    className="bg-muted/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{ar ? "ملاحظات" : "Remarks"}</Label>
                <Textarea
                  rows={3}
                  value={form.remarks}
                  onChange={(e) => updateField("remarks", e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-primary font-semibold">
                    {ar ? "غرفة الاستضافة المعينة *" : "Assigned Hosting Room *"}
                  </Label>
                  {assignedRoomInfo?.isOccupied && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold border border-red-200">
                      {ar ? "هذه الغرفة ساكنة حالياً!" : "Room is currently occupied!"}
                    </span>
                  )}
                  {assignedRoomInfo?.isReserved && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-200">
                      {ar ? "يوجد حجز قادم على هذه الغرفة!" : "Room has an upcoming reservation!"}
                    </span>
                  )}
                  {assignedRoomInfo?.hasPendingRequest && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold border border-orange-200">
                      {ar ? "يوجد طلب استضافة قيد المراجعة لهذه الغرفة!" : "Pending hosting request exists for this room!"}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <Label className="flex justify-between">
                      <span>{ar ? "رقم الغرفة" : "Room Number"}</span>
                      {isSearchingRoom && (
                        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                      )}
                    </Label>
                    <Input
                      placeholder="101"
                      value={form.assignedRoomNumber}
                      onChange={(e) =>
                        updateField("assignedRoomNumber", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{ar ? "نوع الغرفة" : "Room Type"}</Label>
                    <Input
                      readOnly
                      className="bg-muted/50"
                      value={assignedRoomInfo?.roomType || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{ar ? "المبنى" : "Building"}</Label>
                    <Input
                      readOnly
                      className="bg-muted/50"
                      value={assignedRoomInfo?.building || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{ar ? "الدور" : "Floor"}</Label>
                    <Input
                      readOnly
                      className="bg-muted/50"
                      value={assignedRoomInfo?.floor || ""}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Attachments */}
          <Card className="border-t-4 border-t-primary/20">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Paperclip className="w-5 h-5 transform rotate-45" />
                {ar ? "المرفقات" : "Attachments"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-muted-foreground gap-3 hover:bg-muted/30 transition-colors relative">
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error(
                          ar
                            ? "حجم الملف كبير جداً (أقصى حد 5 ميجا)"
                            : "File size too large (max 5MB)",
                        );
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        updateField("attachmentData", ev.target?.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-center">
                  {form.attachmentData ? (
                    <p className="font-semibold text-green-600">
                      {ar ? "تم إرفاق ملف بنجاح" : "File attached successfully"}
                    </p>
                  ) : (
                    <>
                      <p className="font-semibold text-foreground">
                        {ar
                          ? "انقر للرفع أو اسحب الملفات هنا"
                          : "Click to upload or drag files here"}
                      </p>
                      <p className="text-sm mt-1">
                        {ar
                          ? "الحد الأقصى لحجم الملف 5 ميجابايت"
                          : "Max file size 5MB"}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/hosting-requests")}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={
                createMutation.isPending ||
                !!assignedRoomInfo?.isOccupied ||
                !!assignedRoomInfo?.isReserved ||
                !!assignedRoomInfo?.hasPendingRequest ||
                !!hasDateConflict
              }
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {ar ? "تقديم الطلب" : "Submit Request"}
            </Button>
          </div>
        </form>
    </div>
  );
}
