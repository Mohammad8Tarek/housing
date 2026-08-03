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
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Upload, Trash2, Paperclip } from "lucide-react";
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
import { Clock } from "lucide-react";


type EmployeeResult = {
  id: number;
  employeeId: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  jobTitle?: string | null;
  job_title?: string | null;
  department?: string | null;
  accommodationRoom?: string | null;
  accommodationRoomType?: string | null;
  accommodationBuilding?: string | null;
  accommodationFloor?: string | null;
};

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

  const [employee, setEmployee] = useState<EmployeeResult | null>(null);
  const [isSearchingEmp, setIsSearchingEmp] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-fetch employee by Clock Number
  useEffect(() => {
    if (!form.clockNumber || form.clockNumber.length < 2) {
      setEmployee(null);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingEmp(true);
      try {
        const propId = form.hotelId || activePropertyId || "";
        const resp = await fetch(
          `/api/employees/search?q=${encodeURIComponent(form.clockNumber)}&propertyId=${propId}`,
        );
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          // Find exact match or first result
          const exact = data.find(
            (e) => String(e.employeeId) === String(form.clockNumber),
          );
          setEmployee(exact || data[0]);
        } else {
          setEmployee(null);
        }
      } catch (err) {
        setEmployee(null);
      } finally {
        setIsSearchingEmp(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [form.clockNumber, form.hotelId, activePropertyId]);

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
      } catch (err) {
        setAssignedRoomInfo(null);
      } finally {
        setIsSearchingRoom(false);
      }
    }, 500);

    return () => {
      if (searchRoomTimeoutRef.current)
        clearTimeout(searchRoomTimeoutRef.current);
    };
  }, [form.assignedRoomNumber, form.hotelId, activePropertyId]);

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
      // In a real scenario, attachments would be uploaded first or sent as FormData
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
          ? `تم إنشاء الطلب ${created.request_number}`
          : `Request ${created.request_number} created`,
      );
      setLocation(`/hosting-requests/${created.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const { data: hostingHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["hosting-history", employee?.employeeId],
    queryFn: async () => {
      if (!employee?.employeeId) return [];
      const res = await fetch(`/api/hosting-requests/history/${encodeURIComponent(String(employee.employeeId))}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.data || [];
    },
    enabled: !!employee?.employeeId,
  });

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
    createMutation.mutate();
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/hosting-requests")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {ar ? "إنشاء طلب استضافة" : "Create Hosting Request"}
            {employee
              ? ` - ${employee.first_name} ${employee.last_name} (${employee.job_title || ""})`
              : ""}
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

        {/* Section 2: Employee Data */}
        <Card className="border-t-4 border-t-primary/20 bg-muted/10">
          <CardHeader className="bg-muted/30 pb-4 flex flex-row items-center gap-3 space-y-0">
            <CardTitle className="text-lg flex items-center gap-2">
              {ar ? "بيانات الموظف" : "Employee Data"}
            </CardTitle>
            <span className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-blue-100 text-blue-700 rounded-full">
              {ar ? "تعبئة تلقائية" : "Auto-filled"}
            </span>
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
            </div>
            <div className="space-y-2">
              <Label>{ar ? "الاسم" : "Name"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={
                  employee ? `${employee.first_name} ${employee.last_name}` : ""
                }
                placeholder={ar ? "الاسم" : "Name"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "القسم" : "Department"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.department || ""}
                placeholder={ar ? "القسم" : "Department"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "المنصب" : "Position"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.job_title || ""}
                placeholder={ar ? "المنصب" : "Position"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "مبنى السكن" : "Acc. Building"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.accommodationBuilding || ""}
                placeholder={ar ? "المبنى" : "Building"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "دور السكن" : "Acc. Floor"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.accommodationFloor || ""}
                placeholder={ar ? "الدور" : "Floor"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "رقم غرفة السكن" : "Acc. Room"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.accommodationRoom || ""}
                placeholder={ar ? "الغرفة" : "Room"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "نوع الغرفة" : "Room Type"}</Label>
              <Input
                readOnly
                className="bg-muted/50"
                value={employee?.accommodationRoomType || ""}
                placeholder={ar ? "النوع" : "Type"}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2.5: Hosting History */}
        {employee && (
          <Card className="border-t-4 border-t-blue-500/20 bg-blue-50/30">
            <CardHeader className="bg-blue-100/30 pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
                <Clock className="w-5 h-5" />
                {ar ? "سجلات الاستضافات السابقة" : "Previous Hosting Records"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoadingHistory ? (
                <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
              ) : hostingHistory && hostingHistory.length > 0 ? (
                <div className="rounded-md border bg-card overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>{ar ? "رقم الطلب" : "Request #"}</TableHead>
                        <TableHead>{ar ? "من" : "From"}</TableHead>
                        <TableHead>{ar ? "إلى" : "To"}</TableHead>
                        <TableHead>{ar ? "الأيام" : "Days"}</TableHead>
                        <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hostingHistory.map((h: any) => (
                        <TableRow key={h.id}>
                          <TableCell className="font-medium">{h.requestNumber}</TableCell>
                          <TableCell>{new Date(h.fromDate).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(h.toDate).toLocaleDateString()}</TableCell>
                          <TableCell>{h.consumedDays}</TableCell>
                          <TableCell>
                            <Badge variant={h.status === "approved" || h.status === "active" ? "default" : "secondary"}>
                              {h.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {ar ? "لا توجد استضافات سابقة لهذا الموظف" : "No previous hosting records for this employee"}
                </p>
              )}
            </CardContent>
          </Card>
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
              <div className="flex items-center gap-2">
                <Label className="text-primary font-semibold">
                  {ar ? "غرفة الاستضافة المعينة *" : "Assigned Hosting Room *"}
                </Label>
                {assignedRoomInfo?.isOccupied && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                    {ar
                      ? "هذه الغرفة ساكنة حالياً!"
                      : "Room is currently occupied!"}
                  </span>
                )}
                {assignedRoomInfo?.isReserved && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                    {ar
                      ? "يوجد حجز قادم على هذه الغرفة!"
                      : "Room has an upcoming reservation!"}
                  </span>
                )}
                {assignedRoomInfo?.hasPendingRequest && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">
                    {ar
                      ? "يوجد طلب استضافة قيد المراجعة لهذه الغرفة!"
                      : "Pending hosting request exists for this room!"}
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

        {/* Section 5: Attachments */}
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

        <div className="flex justify-end gap-3 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation("/hosting-requests")}
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || assignedRoomInfo?.isOccupied || assignedRoomInfo?.isReserved || assignedRoomInfo?.hasPendingRequest}
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
