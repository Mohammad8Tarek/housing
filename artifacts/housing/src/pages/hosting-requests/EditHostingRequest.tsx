import { useState, useEffect, useRef } from "react";
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
import { useLocation, useParams } from "wouter";
import { PageLoader } from "@/components/ui/loader";
import { ArrowLeft, Loader2, Upload, Trash2, Paperclip } from "lucide-react";
import { useProperty } from "@/context/PropertyContext";

type ProfileResult = {
  id: number;
  profileId: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  department: string | null;
  accommodationRoom?: string | null;
  accommodationRoomType?: string | null;
  accommodationBuilding?: string | null;
  accommodationFloor?: string | null;
};

export default function EditHostingRequest() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [, setLocation] = useLocation();
  const { properties, activePropertyId } = useProperty();

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
  });

  const params = useParams();
  const requestId = params.id;

  const { data: requestRes, isLoading: isLoadingRequest } = useQuery({
    queryKey: ["hosting-requests", requestId],
    queryFn: async () => {
      const res = await fetch(`/api/hosting-requests/${requestId}`);
      if (!res.ok) throw new Error("Failed to fetch request");
      return res.json();
    },
    enabled: !!requestId,
  });

  useEffect(() => {
    if (requestRes?.data) {
      const r = requestRes.data;
      setForm({
        hotelId: r.hotelId ? String(r.hotelId) : "",
        clockNumber: r.clockNumber ? String(r.clockNumber) : "",
        visitHotelId: r.visitHotelId ? String(r.visitHotelId) : "",
        numberOfRooms: r.numberOfRooms ? String(r.numberOfRooms) : "",
        assignedRoomNumber: r.assignedRoomNumber
          ? String(r.assignedRoomNumber)
          : "",
        familyMembersCount: r.familyMembersCount
          ? String(r.familyMembersCount)
          : "",
        familyMembersIncluded: r.familyMembersIncluded || "",
        fromDate: r.fromDate ? String(r.fromDate).split("T")[0] : "",
        toDate: r.toDate ? String(r.toDate).split("T")[0] : "",
        consumedDays: r.consumedDays || 0,
        remarks: r.remarks || "",
      });
    }
  }, [requestRes?.data]);

  const [profile, setProfile] = useState<ProfileResult | null>(null);
  const [isSearchingEmp, setIsSearchingEmp] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-fetch profile by Clock Number
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
          // Find exact match or first result
          const exact = data.find(
            (e) => String(e.profileId) === String(form.clockNumber),
          );
          setProfile(exact || data[0]);
        } else {
          setProfile(null);
        }
      } catch (err) {
        setProfile(null);
      } finally {
        setIsSearchingEmp(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [form.clockNumber, form.hotelId, activePropertyId]);

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

  const updateMutation = useMutation({
    mutationFn: async () => {
      // In a real scenario, attachments would be uploaded first or sent as FormData
      const res = await fetch(`/api/hosting-requests/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: form.hotelId ? parseInt(form.hotelId) : undefined,
          visitHotelId: form.visitHotelId
            ? parseInt(form.visitHotelId)
            : undefined,
          numberOfRooms: parseInt(form.numberOfRooms),
          familyMembersCount: parseInt(form.familyMembersCount),
          familyMembersIncluded: form.familyMembersIncluded || undefined,
          fromDate: form.fromDate,
          toDate: form.toDate,
          consumedDays: form.consumedDays,
          remarks: form.remarks || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create");
      return data.data;
    },
    onSuccess: (updated) => {
      toast.success(
        ar
          ? `تم تحديث الطلب ${updated.request_number}`
          : `Request ${updated.request_number} updated`,
      );
      setLocation(`/hosting-requests/${updated.request_number || updated.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.hotelId ||
      !form.clockNumber ||
      !form.visitHotelId ||
      !form.numberOfRooms ||
      !form.familyMembersCount ||
      !form.fromDate ||
      !form.toDate
    ) {
      toast.error(
        ar ? "يرجى ملء الحقول المطلوبة (*)" : "Please fill required fields (*)",
      );
      return;
    }
    updateMutation.mutate();
  };

  if (isLoadingRequest) return <PageLoader />;

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(`/hosting-requests/${requestId}`)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {ar ? "تعديل طلب استضافة" : "Edit Hosting Request"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {ar ? "طلبات" : "requests"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
              <Label>{ar ? "الفندق *" : "Hotel *"}</Label>
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
            </div>

            <div className="space-y-2">
              <Label>{ar ? "فندق الزيارة *" : "Visit Hotel *"}</Label>
              <Select
                value={form.visitHotelId}
                onValueChange={(v) => updateField("visitHotelId", v)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      ar ? "اختر فندق الزيارة" : "Select Visit Hotel"
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
        <Card className="border-t-4 border-t-primary/20 bg-muted/10">
          <CardHeader className="bg-muted/30 pb-4 flex flex-row items-center gap-3 space-y-0">
            <CardTitle className="text-lg flex items-center gap-2">
              {ar ? "بيانات الموظف" : "Profile Data"}
            </CardTitle>
            <span className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-blue-100 text-blue-700 rounded-full">
              {ar ? "تعبئة تلقائية" : "Auto-filled"}
            </span>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            <div className="space-y-2">
              <Label>{ar ? "الاسم *" : "Name *"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={
                  profile ? `${profile.firstName} ${profile.lastName}` : ""
                }
                placeholder={ar ? "الاسم" : "Name"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "القسم *" : "Department *"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={profile?.department || ""}
                placeholder={ar ? "القسم" : "Department"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "المنصب *" : "Position *"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={profile?.jobTitle || ""}
                placeholder={ar ? "المنصب" : "Position"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "المبنى" : "Building"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={profile?.accommodationBuilding || ""}
                placeholder={ar ? "المبنى" : "Building"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "الدور" : "Floor"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={profile?.accommodationFloor || ""}
                placeholder={ar ? "الدور" : "Floor"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "رقم الغرفة" : "Room Number"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={profile?.accommodationRoom || ""}
                placeholder={ar ? "رقم الغرفة" : "Room Number"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "نوع الغرفة" : "Room Type"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={profile?.accommodationRoomType || ""}
                placeholder={ar ? "نوع الغرفة" : "Room Type"}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Visit Details */}
        <Card className="border-t-4 border-t-primary/20">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              {ar ? "تفاصيل الزيارة" : "Visit Details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>{ar ? "عدد الغرف *" : "No of Rooms *"}</Label>
                <Input
                  type="number"
                  min={1}
                  required
                  value={form.numberOfRooms}
                  onChange={(e) => updateField("numberOfRooms", e.target.value)}
                />
              </div>
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
            <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-muted-foreground gap-3 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
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
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation(`/hosting-requests/${requestId}`)}
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {ar ? "تقديم الطلب" : "Submit Request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
