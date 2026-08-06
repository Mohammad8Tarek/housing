// @ts-nocheck
import { useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useListAssignments,
  useListRooms,
  useListBuildings,
  useListFloors,
  useGetSettings,
  useListProperties,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { useProperty } from "@/context/PropertyContext";
import {
  User,
  Briefcase,
  Building2,
  Phone,
  Camera,
  Calendar,
  MapPin,
  Globe2,
  Shield,
  ArrowLeft,
  BedDouble,
  History,
  Home,
  Printer,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { generateHousingLetterPdf } from "@/lib/pdf-utils";
import {
  usePrintLanguage,
  PrintLanguageDialog,
} from "@/lib/PrintLanguageDialog";

function EmployeeAvatar({
  firstName,
  lastName,
  photoUrl,
  size = "lg",
}: {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: "md" | "lg";
}) {
  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const dim = size === "lg" ? "w-24 h-24 text-3xl" : "w-12 h-12 text-base";
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={initials}
        className={`${dim} rounded-full object-cover border-4 border-background shadow-lg flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full bg-primary/10 border-4 border-background shadow-lg flex items-center justify-center flex-shrink-0`}
    >
      <span className="font-bold text-primary">{initials}</span>
    </div>
  );
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ENDED: "bg-gray-100 text-gray-700",
    TRANSFERRED: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
};

export default function EmployeeDetail() {
  const { id } = useParams();
  const employeeId = Number(id);
  const { language } = useLanguage();
  const { activePropertyId } = useProperty();
  const ar = language === "ar";
  const { langDialogOpen, openDialog, handleSelect, handleCancel } =
    usePrintLanguage();

  const { data: settings } = useGetSettings({
    query: { enabled: !!activePropertyId },
  });
  const { data: properties = [] } = useListProperties();
  const activeProp = properties.find((p: any) => p.id === activePropertyId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [setPwOpen, setSetPwOpen] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ password: "", confirm: "" });

  const {
    data: employee,
    isLoading: empLoading,
    refetch,
  } = useQuery({
    queryKey: ["employee", employeeId, activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/employees/${employeeId}?propertyId=${activePropertyId}`,
      );
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!employeeId && !!activePropertyId,
  });

  const portalEmployeeIdForQuery = String((employee as any)?.employeeId ?? "");
  const { data: portalAccount, refetch: refetchPortalAccount } = useQuery({
    queryKey: ["portal-account", portalEmployeeIdForQuery, activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-auth/accounts?propertyId=${activePropertyId}`,
      );
      if (!res.ok) return null;
      const data = await res.json().catch(() => []);
      const accounts = Array.isArray(data) ? data : (data.accounts ?? []);
      return (
        accounts.find(
          (account: any) => account.employeeId === portalEmployeeIdForQuery,
        ) ?? null
      );
    },
    enabled: !!activePropertyId && !!portalEmployeeIdForQuery,
  });

  const { data: allAssignments } = useListAssignments(
    { propertyId: activePropertyId } as any,
    { query: { enabled: !!employeeId } },
  );

  const { data: _rData } = useListRooms(
    { propertyId: activePropertyId, limit: 1000 },
    { query: { enabled: !!activePropertyId } },
  );
  const rooms = _rData?.data || [];
  const { data: buildings = [] } = useListBuildings(
    { propertyId: activePropertyId },
    { query: { enabled: !!activePropertyId } },
  );
  const { data: floors = [] } = useListFloors(
    { propertyId: activePropertyId },
    { query: { enabled: !!activePropertyId } },
  );

  const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const buildingMap = Object.fromEntries(buildings.map((b) => [b.id, b.name]));
  const floorMap = Object.fromEntries(floors.map((f) => [f.id, f.floorNumber]));

  const employeeAssignments = (allAssignments ?? []).filter(
    (a) => a.employeeId === employeeId,
  );
  const currentAssignment = employeeAssignments.find(
    (a) => a.status === "ACTIVE",
  );
  const pastAssignments = employeeAssignments
    .filter((a) => a.status !== "ACTIVE")
    .sort(
      (a, b) =>
        new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime(),
    );

  const printHousingLetter = async () => {
    const chosenAr = await openDialog();
    const emp = employee as any;
    const assignment = currentAssignment;
    if (!emp || !assignment) return;
    const room = roomMap[assignment.roomId];
    const building = room ? buildingMap[room.buildingId] : null;
    const floorNum = room ? floorMap[room.floorId] : null;
    await generateHousingLetterPdf({
      isArabic: chosenAr,
      employee: emp,
      assignment,
      room,
      building,
      floorNum,
      propName: activeProp?.name || "",
      propAddress: (activeProp as any)?.address || "",
      systemLogoUrl: (settings as any)?.systemLogo,
      propLogoUrl: (activeProp as any)?.logo,
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(
        ar
          ? "الملف كبير جداً (الحد الأقصى 2 ميغابايت)"
          : "File too large (max 2MB)",
      );
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await fetch(`/api/employees/${employeeId}/photo`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoUrl: reader.result,
            propertyId: activePropertyId,
          }),
        });
        toast.success(ar ? "تم رفع الصورة" : "Photo uploaded");
        refetch();
      } catch {
        toast.error(ar ? "خطأ في الرفع" : "Upload error");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  if (empLoading || !employeeId)
    return (
      <div className="p-8">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (!employee)
    return (
      <div className="p-8 text-muted-foreground">
        {ar ? "الموظف غير موجود" : "Employee not found"}
      </div>
    );

  const emp = employee as any;

  const portalPropertyId = Number(emp.propertyId ?? activePropertyId);
  const portalEmployeeId = String(emp.employeeId ?? "");

  const resetPortalPassword = async () => {
    if (!portalEmployeeId || !portalPropertyId) {
      toast.error(ar ? "بيانات الموظف مفقودة" : "Employee data missing");
      return;
    }
    try {
      setPwSaving(true);
      const res = await fetch("/api/portal-auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: portalEmployeeId,
          propertyId: portalPropertyId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Request failed");
      toast.success(
        ar ? "تم إنشاء كلمة مرور مؤقتة" : "Temporary password generated",
        {
          description: data.temporaryPassword
            ? `${ar ? "كلمة المرور المؤقتة" : "Temporary password"}: ${data.temporaryPassword}`
            : data.message,
        },
      );
      refetchPortalAccount();
      setResetOpen(false);
    } catch (e: any) {
      toast.error(ar ? "خطأ" : "Error", {
        description: e?.message ?? String(e),
      });
    } finally {
      setPwSaving(false);
    }
  };

  const setPortalPassword = async () => {
    if (!portalEmployeeId || !portalPropertyId) {
      toast.error(ar ? "بيانات الموظف مفقودة" : "Employee data missing");
      return;
    }
    if (pwForm.password.length < 6) {
      toast.error(ar ? "كلمة المرور قصيرة" : "Password too short", {
        description: ar ? "الحد الأدنى 6 أحرف" : "Minimum 6 characters",
      });
      return;
    }
    if (pwForm.password !== pwForm.confirm) {
      toast.error(ar ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    try {
      setPwSaving(true);
      const res = await fetch("/api/portal-auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: portalEmployeeId,
          propertyId: portalPropertyId,
          newPassword: pwForm.password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Request failed");
      toast.success(ar ? "تم تعيين كلمة مرور جديدة" : "Password set");
      refetchPortalAccount();
      setSetPwOpen(false);
      setPwForm({ password: "", confirm: "" });
    } catch (e: any) {
      toast.error(ar ? "خطأ" : "Error", {
        description: e?.message ?? String(e),
      });
    } finally {
      setPwSaving(false);
    }
  };

  const togglePortalAccess = async (isActive: boolean) => {
    if (!portalEmployeeId || !portalPropertyId) {
      toast.error(ar ? "بيانات الموظف مفقودة" : "Employee data missing");
      return;
    }
    try {
      setAccessSaving(true);
      const res = await fetch("/api/portal-auth/toggle-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: portalEmployeeId,
          propertyId: portalPropertyId,
          isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Request failed");
      toast.success(
        isActive
          ? ar
            ? "تم تفعيل حساب البوابة"
            : "Portal account enabled"
          : ar
            ? "تم تعطيل حساب البوابة"
            : "Portal account disabled",
      );
      refetchPortalAccount();
    } catch (e: any) {
      toast.error(ar ? "خطأ" : "Error", {
        description: e?.message ?? String(e),
      });
    } finally {
      setAccessSaving(false);
    }
  };

  const infoItems = [
    {
      icon: <Shield className="w-4 h-4" />,
      label: ar ? "رقم الهوية" : "National ID",
      value: emp.nationalId,
    },
    {
      icon: <Globe2 className="w-4 h-4" />,
      label: ar ? "الجنسية" : "Nationality",
      value: emp.nationality,
    },
    {
      icon: <Phone className="w-4 h-4" />,
      label: ar ? "الهاتف" : "Phone",
      value: emp.phone || emp.phoneNumber,
    },
    {
      icon: <User className="w-4 h-4" />,
      label: ar ? "الجنس" : "Gender",
      value:
        emp.gender === "M"
          ? ar
            ? "ذكر"
            : "Male"
          : emp.gender === "F"
            ? ar
              ? "أنثى"
              : "Female"
            : emp.gender,
    },
    {
      icon: <Briefcase className="w-4 h-4" />,
      label: ar ? "القسم" : "Department",
      value: emp.department,
    },
    {
      icon: <Briefcase className="w-4 h-4" />,
      label: ar ? "المسمى الوظيفي" : "Job Title",
      value: emp.jobTitle,
    },
    {
      icon: <Briefcase className="w-4 h-4" />,
      label: ar ? "الدرجة" : "Level",
      value: emp.level,
    },
    {
      icon: <Calendar className="w-4 h-4" />,
      label: ar ? "تاريخ التعيين" : "Hire Date",
      value: emp.hireDate
        ? format(new Date(emp.hireDate), "MMM d, yyyy")
        : null,
    },
    {
      icon: <MapPin className="w-4 h-4" />,
      label: ar ? "العنوان" : "Address",
      value: emp.address,
    },
  ].filter((i) => i.value);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/employees">
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {ar ? "العودة للموظفين" : "Back to Employees"}
        </Button>
      </Link>

      {/* Profile card */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="pt-0 pb-6">
          <div className="flex flex-col sm:flex-row gap-4 -mt-12">
            <div className="relative flex-shrink-0">
              <EmployeeAvatar
                firstName={emp.firstName}
                lastName={emp.lastName}
                photoUrl={emp.photoUrl}
                size="lg"
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:bg-primary/90 transition-colors"
                title={ar ? "تغيير الصورة" : "Change photo"}
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="pt-12 sm:pt-14 flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <h1 className="text-2xl font-bold">
                    {`${emp.firstName} ${emp.thirdName || ""} ${emp.fourthName || ""} ${emp.lastName}`.replace(/\s+/g, ' ').trim()}
                  </h1>
                  <p className="text-muted-foreground font-mono text-sm mt-0.5">
                    {emp.employeeId || emp.employeeCode}
                  </p>
                  {emp.jobTitle && (
                    <p className="text-sm text-primary font-medium mt-1">
                      {emp.jobTitle}{" "}
                      {emp.department ? `• ${emp.department}` : ""}
                    </p>
                  )}
                </div>
                <Badge
                  variant={emp.status === "ACTIVE" ? "default" : "secondary"}
                  className="self-start"
                >
                  {emp.status}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-6">
            {infoItems.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-3 rounded-lg bg-muted/30"
              >
                <span className="text-muted-foreground mt-0.5 flex-shrink-0">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    {item.label}
                  </p>
                  <p className="text-sm font-medium truncate">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current assignment */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="w-4 h-4 text-primary" />
              {ar ? "السكن الحالي" : "Current Housing"}
            </CardTitle>
            {currentAssignment && (
              <Button
                size="sm"
                variant="outline"
                onClick={printHousingLetter}
                className="gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                {ar ? "طباعة خطاب السكن" : "Print Housing Letter"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {currentAssignment ? (
            (() => {
              const room = roomMap[currentAssignment.roomId];
              const building = room ? buildingMap[room.buildingId] : null;
              const floorNum = room ? floorMap[room.floorId] : null;
              const daysStayed = differenceInDays(
                new Date(),
                new Date(currentAssignment.checkInDate),
              );
              const daysRemaining = currentAssignment.expectedCheckOutDate
                ? differenceInDays(
                    new Date(currentAssignment.expectedCheckOutDate),
                    new Date(),
                  )
                : null;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: ar ? "المبنى" : "Building",
                      value: building ?? `#${room?.buildingId ?? "—"}`,
                      icon: <Building2 className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "الدور" : "Floor",
                      value: floorNum
                        ? `${ar ? "الطابق" : "Floor"} ${floorNum}`
                        : "—",
                      icon: null,
                    },
                    {
                      label: ar ? "الغرفة" : "Room",
                      value: room?.roomNumber ?? currentAssignment.roomId,
                      icon: <Home className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "السرير" : "Bed",
                      value: currentAssignment.bedNumber ?? "—",
                      icon: <BedDouble className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "تاريخ الدخول" : "Check-in",
                      value: format(
                        new Date(currentAssignment.checkInDate),
                        "MMM d, yyyy",
                      ),
                      icon: <Calendar className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "المغادرة المتوقعة" : "Expected Out",
                      value: currentAssignment.expectedCheckOutDate
                        ? format(
                            new Date(currentAssignment.expectedCheckOutDate),
                            "MMM d, yyyy",
                          )
                        : "—",
                      icon: <Calendar className="w-4 h-4" />,
                    },
                    {
                      label: ar ? "مدة الإقامة" : "Days Stayed",
                      value: `${daysStayed} ${ar ? "يوم" : "days"}`,
                      icon: null,
                    },
                    {
                      label: ar ? "الأيام المتبقية" : "Days Remaining",
                      value:
                        daysRemaining !== null
                          ? `${daysRemaining} ${ar ? "يوم" : "days"}`
                          : "—",
                      icon: null,
                    },
                  ].map((row, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/30">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">
                        {row.label}
                      </p>
                      <p className="font-semibold text-sm">
                        {String(row.value)}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })()
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Home className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>
                {ar
                  ? "لا يوجد تسكين نشط حالياً"
                  : "No active housing assignment"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Portal Access */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            {ar ? "بوابة الموظفين" : "Employee Portal"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {ar
                ? "يمكن للمسؤولين تعديل صلاحيات البوابة وإدارة كلمة مرور الموظف من هنا."
                : "Admins can edit portal access and manage the employee password from here."}
            </div>
            <Badge
              variant={portalAccount?.isActive ? "default" : "secondary"}
              className="self-start"
            >
              {portalAccount
                ? portalAccount.isActive
                  ? ar
                    ? "نشط"
                    : "Active"
                  : ar
                    ? "معطل"
                    : "Disabled"
                : ar
                  ? "لم يتم تحميل الحساب"
                  : "Account loading"}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">
                {ar ? "صلاحية الدخول" : "Portal access"}
              </p>
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "تفعيل أو تعطيل دخول هذا الموظف للبوابة."
                  : "Enable or disable this employee's portal login."}
              </p>
            </div>
            <Switch
              checked={Boolean(portalAccount?.isActive)}
              disabled={!portalAccount || accessSaving}
              onCheckedChange={togglePortalAccess}
              aria-label={ar ? "تفعيل/تعطيل البوابة" : "Toggle portal access"}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setSetPwOpen(true)}
              disabled={pwSaving}
            >
              {ar ? "تعيين كلمة مرور جديدة" : "Set New Password"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setResetOpen(true)}
              disabled={pwSaving}
            >
              {ar ? "إنشاء كلمة مرور مؤقتة" : "Generate Temporary Password"}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {ar
              ? `معرّ�? الدخول: ${portalEmployeeId || "—"}`
              : `Login ID: ${portalEmployeeId || "—"}`}
          </div>
        </CardContent>
      </Card>

      {/* Assignment history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            {ar ? "سجل الإقامة" : "Housing History"}
            {pastAssignments.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pastAssignments.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>{ar ? "المبنى" : "Building"}</TableHead>
                <TableHead>{ar ? "الدور" : "Floor"}</TableHead>
                <TableHead>{ar ? "الغرفة" : "Room"}</TableHead>
                <TableHead>{ar ? "السرير" : "Bed"}</TableHead>
                <TableHead>{ar ? "الدخول" : "Check-in"}</TableHead>
                <TableHead>{ar ? "الخروج" : "Check-out"}</TableHead>
                <TableHead>{ar ? "المدة" : "Days"}</TableHead>
                <TableHead>{ar ? "ملاحظات" : "Notes"}</TableHead>
                <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pastAssignments.map((a) => {
                const room = roomMap[a.roomId];
                const building = room ? buildingMap[room.buildingId] : null;
                const floorNum = room ? floorMap[room.floorId] : null;
                const checkOutDate =
                  a.checkOutDate || (a as any).actualCheckOutDate;
                const days =
                  a.checkInDate && checkOutDate
                    ? Math.max(
                        0,
                        Math.round(
                          (new Date(checkOutDate).getTime() -
                            new Date(a.checkInDate).getTime()) /
                            86400000,
                        ),
                      )
                    : null;
                return (
                  <TableRow key={a.id} className="hover:bg-muted/20">
                    <TableCell className="text-sm whitespace-nowrap">
                      {building ? (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          {building}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{floorNum ?? "—"}</TableCell>
                    <TableCell>
                      <span className="font-mono font-semibold text-primary">
                        {room?.roomNumber ?? a.roomId}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.bedNumber ? (
                        <Badge variant="outline" className="text-xs">
                          <BedDouble className="w-3 h-3 mr-1" />
                          {a.bedNumber}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {a.checkInDate
                        ? format(new Date(a.checkInDate), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {checkOutDate
                        ? format(new Date(checkOutDate), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {days !== null ? (
                        <Badge variant="outline" className="text-xs">
                          {days}
                          {ar ? "د" : "d"}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                      {a.notes || "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(a.status)}`}
                      >
                        {a.status}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pastAssignments.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {ar
                      ? "لا يوجد سجل إقامة سابق"
                      : "No previous housing history"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reset confirm */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "إعادة تعيين كلمة المرور" : "Reset Password"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "سيؤدي هذا إلى إنشاء كلمة مرور مؤقتة جديدة وإجبار الموظف على تغييرها عند تسجيل الدخول التالي."
                : "This will generate a new temporary password and force the employee to change it on next login."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pwSaving}>
              {ar ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={resetPortalPassword}
              disabled={pwSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pwSaving
                ? ar
                  ? "جاري العمل..."
                  : "Working..."
                : ar
                  ? "تأكيد"
                  : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set password dialog */}
      <Dialog
        open={setPwOpen}
        onOpenChange={(o) => {
          setSetPwOpen(o);
          if (!o) setPwForm({ password: "", confirm: "" });
        }}
      >
        <DialogContent
          className="max-w-md"
          srTitle={ar ? "تعيين كلمة مرور جديدة" : "Set New Password"}
        >
          <DialogHeader>
            <DialogTitle>
              {ar ? "تعيين كلمة مرور جديدة" : "Set New Password"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{ar ? "كلمة المرور الجديدة" : "New password"}</Label>
              <Input
                type="password"
                value={pwForm.password}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, password: e.target.value }))
                }
                placeholder={ar ? "6 أحرف على الأقل" : "At least 6 characters"}
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "تأكيد كلمة المرور" : "Confirm password"}</Label>
              <Input
                type="password"
                value={pwForm.confirm}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, confirm: e.target.value }))
                }
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {ar
                ? "سيتم تعيين كلمة المرور مباشرة دون إجبار تغييرها."
                : "This sets the password directly (no forced change)."}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSetPwOpen(false)}
              disabled={pwSaving}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={setPortalPassword} disabled={pwSaving}>
              {pwSaving
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? "حفظ"
                  : "Save"}
            </Button>
          </DialogFooter>
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
