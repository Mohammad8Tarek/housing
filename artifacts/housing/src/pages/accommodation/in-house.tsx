// @ts-nocheck
import { useState, useMemo } from "react";
import {
  useListInHouseAssignments,
  useListProfiles,
  useListRooms,
  useListBuildings,
  useListFloors,
  useCheckoutAssignment,
  useTransferAssignment,
  useGetSettings,
  useListProperties,
  getListInHouseAssignmentsQueryKey,
  useListAssignments,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LogOut,
  ArrowRightLeft,
  Users,
  BedDouble,
  Building2,
  Search,
  UserCircle,
  X,
  Check,
  CheckCircle,
  Palmtree,
  Key,
  Printer,
  UserCheck,
  Info,
  CalendarPlus,
  Calendar,
  Clock,
  Globe,
  Layers,
  MessageSquare,
  Send,
  AlertTriangle,
  Radio,
  QrCode,
} from "lucide-react";
import { recommendBestRooms, checkPolicyCompliance } from "@/lib/room-recommender";
import {
  PolicyExceptionApprovalModal,
  type PolicyViolationItem,
} from "@/components/PolicyExceptionApprovalModal";
import { GatePassModal } from "./GatePassModal";
import { BroadcastWhatsAppDialog } from "@/components/BroadcastWhatsAppDialog";
import {
  ColumnChooser,
  useColumnVisibility,
} from "@/components/ui/column-chooser";
import { ProfileProfilePopup } from "@/components/ui/profile-profile-popup";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, differenceInDays } from "date-fns";
import { formatDate, getExportFileName } from "@/lib/date-utils";
import { formatNationality } from "@/lib/countries";
import { useQueryClient } from "@tanstack/react-query";
import { DataPagination } from "@/components/DataPagination";
import KeyManagementPanel from "@/components/KeyManagementPanel";
import { generateHousingLetterPdf, printLuxuryReport } from "@/lib/pdf-utils";
import {
  usePrintLanguage,
  PrintLanguageDialog,
} from "@/lib/PrintLanguageDialog";
import { usePermission } from "@/hooks/use-permission";
import { PermissionGate } from "@/components/ui/permission-gate";
import {
  getProfileDisplayName,
  getProfileDisplayJobTitle,
  getProfileDisplayDepartment,
} from "@/lib/profile-display-utils";

export const CHECKOUT_REASONS = [
  { value: "resignation", labelAr: "استقالة من العمل", labelEn: "Resignation" },
  { value: "contract_end", labelAr: "انتهاء عقد العمل", labelEn: "Contract Termination / End" },
  { value: "property_transfer", labelAr: "نقل لفندق أو فرع آخر", labelEn: "Transfer to Another Property" },
  { value: "external_housing", labelAr: "انتقال لسكن خارجي (بدل سكن)", labelEn: "Moved to External Housing" },
  { value: "extended_leave", labelAr: "إجازة مطولة مع إخلاء طرف", labelEn: "Extended Leave with Clearance" },
  { value: "disciplinary", labelAr: "إنهاء خدمة / فصل تأديبي", labelEn: "Disciplinary Dismissal" },
  { value: "other", labelAr: "أسباب أخرى", labelEn: "Other Reason" },
];

function EmpAvatar({ emp, name, photoUrl }: { emp?: any; name?: string; photoUrl?: string }) {
  const photo = photoUrl || emp?.photoUrl;
  const firstName = emp?.firstName || name?.split(" ")?.[0] || "";
  const lastName = emp?.lastName || name?.split(" ")?.slice(1)?.join(" ") || "";
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "—";
  return photo ? (
    <img
      src={photo}
      alt={initials}
      className="w-9 h-9 rounded-full object-cover border border-border shadow-xs flex-shrink-0"
    />
  ) : (
    <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-primary">{initials}</span>
    </div>
  );
}

export default function InHouse() {
  const {
    activePropertyId,
    isSuperAdmin,
    properties: contextProperties,
  } = useProperty();
  const { language } = useLanguage();
  const { can } = usePermission();

  const queryClient = useQueryClient();
  const ar = language === "ar";
  const { langDialogOpen, openDialog, handleSelect, handleCancel } =
    usePrintLanguage();

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [bulkCheckoutOpen, setBulkCheckoutOpen] = useState(false);
  const [bulkCheckoutLoading, setBulkCheckoutLoading] = useState(false);
  const [bulkCheckoutNotes, setBulkCheckoutNotes] = useState("");
  const [bulkCheckoutReason, setBulkCheckoutReason] = useState("");
  const [checkoutDialog, setCheckoutDialog] = useState<{
    open: boolean;
    id: number | null;
    emp?: any;
  }>({ open: false, id: null });
  const [vacationDialog, setVacationDialog] = useState<{
    open: boolean;
    emp: any;
    room?: any;
  }>({ open: false, emp: null });
  const [vacationStartDate, setVacationStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [vacationEndDate, setVacationEndDate] = useState("");
  const [vacationNotes, setVacationNotes] = useState("");
  const [vacationSubmitting, setVacationSubmitting] = useState(false);

  const vacationDurationDays = () => {
    if (!vacationStartDate || !vacationEndDate) return null;
    const s = new Date(vacationStartDate);
    const e = new Date(vacationEndDate);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : null;
  };

  const [transferDialog, setTransferDialog] = useState<{
    open: boolean;
    id: number | null;
    emp?: any;
  }>({ open: false, id: null });
  const [checkoutDate, setCheckoutDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [checkoutReason, setCheckoutReason] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [transferRoomId, setTransferRoomId] = useState("");
  const [selectedTransferBed, setSelectedTransferBed] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [transferPropertyId, setTransferPropertyId] = useState<string>("");
  const [transferArchiveSource, setTransferArchiveSource] = useState<boolean>(true);
  const [profileEmpId, setProfileEmpId] = useState<number | null>(null);
  const [transferPolicyModal, setTransferPolicyModal] = useState<{
    open: boolean;
    violations: PolicyViolationItem[];
  }>({ open: false, violations: [] });

  // Re-issue key state
  const [reissueDialog, setReissueDialog] = useState<{
    open: boolean;
    assignment: any;
    emp: any;
    room: any;
  }>({ open: false, assignment: null, emp: null, room: null });
  const [reissueNotes, setReissueNotes] = useState("");
  const [reissueIssuing, setReissueIssuing] = useState(false);
  const [printAfterTransfer, setPrintAfterTransfer] = useState<{
    assignment: any;
    emp: any;
    room: any;
    building: string | null;
    floorNum: string | null;
  } | null>(null);

  // Extend stay state
  const [extendDialog, setExtendDialog] = useState<{
    open: boolean;
    assignment: any | null;
    emp: any | null;
    room: any | null;
  }>({
    open: false,
    assignment: null,
    emp: null,
    room: null,
  });
  const [extendNewDate, setExtendNewDate] = useState("");
  const [extendNotes, setExtendNotes] = useState("");
  const [extendLoading, setExtendLoading] = useState(false);

  // Bulk extend stay state
  const [bulkExtendOpen, setBulkExtendOpen] = useState(false);
  const [bulkExtendDate, setBulkExtendDate] = useState("");
  const [bulkExtendNotes, setBulkExtendNotes] = useState("");
  const [bulkExtendLoading, setBulkExtendLoading] = useState(false);

  // WhatsApp welcome notification state
  const [whatsAppDialog, setWhatsAppDialog] = useState<{
    open: boolean;
    assignmentId: number | null;
    emp: any | null;
    roomNumber?: string;
    bedNumber?: any;
  }>({
    open: false,
    assignmentId: null,
    emp: null,
  });

  // Gate Pass modal state
  const [gatePassOpen, setGatePassOpen] = useState(false);
  const [selectedGatePassProfileId, setSelectedGatePassProfileId] = useState<number | null>(null);
  const [whatsAppPhone, setWhatsAppPhone] = useState("");
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Broadcast WhatsApp state
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTargetMode, setBroadcastTargetMode] = useState<"all" | "selected">("all");

  const handleOpenWhatsAppDialog = (a: any, empData: any) => {
    const p = empData || {
      id: a.profileId,
      firstName: a.profileFirstName || a.firstName,
      lastName: a.profileLastName || a.lastName,
      phone: a.profilePhone || a.phone || "",
    };
    setWhatsAppPhone(p.phone || a.phone || a.profilePhone || "");
    setWhatsAppDialog({
      open: true,
      assignmentId: a.id,
      emp: p,
      roomNumber: a.roomNumber,
      bedNumber: a.bedNumber,
    });
  };

  const handleSendWhatsApp = async () => {
    if (!whatsAppPhone.trim()) {
      toast.error(ar ? "يرجى إدخال رقم هاتف الواتساب للموظف" : "Please enter a valid WhatsApp phone number");
      return;
    }
    setIsSendingWhatsApp(true);
    try {
      const res = await fetch(`/api/assignments/${whatsAppDialog.assignmentId}/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: activePropertyId,
          phone: whatsAppPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || (ar ? "فشل إرسال رسالة الواتساب" : "Failed to send WhatsApp message"));
      }
      toast.success(data.message || (ar ? "تم إرسال رسالة التسكين عبر الواتساب بنجاح!" : "WhatsApp welcome message sent successfully!"));
      setWhatsAppDialog((prev) => ({ ...prev, open: false }));
      queryClient.invalidateQueries({
        queryKey: getListInHouseAssignmentsQueryKey({ propertyId: activePropertyId as any }),
      });
    } catch (err: any) {
      toast.error(err.message || (ar ? "فشل إرسال رسالة الواتساب" : "Failed to send WhatsApp message"));
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const { data: _pData } = useListProperties();
  const allProperties = _pData?.data || _pData || [];
  const { data: settings } = useGetSettings({
    query: { enabled: !!activePropertyId },
  });
  const activeProp = allProperties.find((p: any) => p.id === activePropertyId);

  const { data: assignmentsRes, isLoading } = useListInHouseAssignments(
    {
      propertyId: activePropertyId as any,
      page: currentPage,
      limit: pageSize,
      search: debouncedSearch || undefined,
    },
    {
      query: {
        queryKey: getListInHouseAssignmentsQueryKey({
          propertyId: activePropertyId as any,
          page: currentPage,
          limit: pageSize,
          search: debouncedSearch || undefined,
        }),
        enabled: !!activePropertyId,
      },
    },
  );
  const assignments = assignmentsRes?.data || [];
  const total = assignmentsRes?.pagination?.total || 0;

  const selectedProfileIds = useMemo(() => {
    return Array.from(selectedRows).map((id) => {
      const a = (assignments || []).find((x: any) => x.id === id);
      return a?.profileId ? Number(a.profileId) : null;
    }).filter((id): id is number => id !== null);
  }, [selectedRows, assignments]);

  const { data: _eDataWrapper } = useListProfiles(
    { propertyId: activePropertyId ?? undefined, limit: 1000 },
    { query: { enabled: !!activePropertyId } },
  );
  const profiles = _eDataWrapper?.profiles || _eDataWrapper?.data || [];
  const { data: _rData } = useListRooms(
    { propertyId: activePropertyId, limit: 1000 },
    { query: { enabled: !!activePropertyId, staleTime: 60000 } },
  );
  const rooms = _rData?.data || [];
  const { data: _bData } = useListBuildings(
    { propertyId: activePropertyId },
    { query: { enabled: !!activePropertyId, staleTime: 300000 } },
  );
  const buildings = _bData?.data || [];
  const { data: _fData } = useListFloors(
    { propertyId: activePropertyId },
    { query: { enabled: !!activePropertyId, staleTime: 300000 } },
  );
  const floors = _fData?.data || [];

  // For cross-property transfer: load rooms from selected target property
  const targetPropId =
    transferPropertyId && transferPropertyId !== String(activePropertyId)
      ? Number(transferPropertyId)
      : activePropertyId;
  const { data: _targetRoomsWrapper } = useListRooms(
    { propertyId: targetPropId, limit: 1000 },
    { query: { enabled: !!targetPropId } },
  );
  const targetRooms = _targetRoomsWrapper?.data || [];
  const { data: _tbData } = useListBuildings(
    { propertyId: targetPropId },
    { query: { enabled: !!targetPropId } },
  );
  const targetBuildings = _tbData?.data || [];
  const { data: _taData } = useListAssignments(
    { propertyId: targetPropId } as any,
    { query: { enabled: !!targetPropId, staleTime: 30000 } },
  );
  const targetAssignments = _taData?.data || [];

  // Compute occupied beds for transfer target room
  const targetOccupiedBeds = new Set<number>(
    targetAssignments
      .filter(
        (a: any) =>
          a.status === "ACTIVE" &&
          a.roomId === parseInt(transferRoomId) &&
          a.bedNumber != null,
      )
      .map((a: any) => a.bedNumber as number),
  );

  const selectedTargetRoom = targetRooms.find(
    (r) => r.id === parseInt(transferRoomId),
  );
  const transferRoomCapacity = selectedTargetRoom?.capacity ?? 0;
  const bedOptions = Array.from(
    { length: transferRoomCapacity },
    (_, i) => i + 1,
  );

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListInHouseAssignmentsQueryKey({ propertyId: activePropertyId as any }),
    });
    queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
  };

  
  const handleConfirmVacation = async () => {
    if (!vacationDialog.emp) return;
    if (!vacationStartDate || !vacationEndDate) {
      toast.error(ar ? "يرجى تحديد تاريخ البدء وتاريخ الانتهاء" : "Please select start and end dates");
      return;
    }
    if (new Date(vacationEndDate) < new Date(vacationStartDate)) {
      toast.error(ar ? "تاريخ العودة يجب أن يكون بعد تاريخ البدء" : "Return date must be after start date");
      return;
    }

    setVacationSubmitting(true);
    try {
      let res = await fetch(`/api/profiles/${vacationDialog.emp.id}/vacation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: activePropertyId,
          startDate: vacationStartDate,
          endDate: vacationEndDate,
          notes: vacationNotes,
        }),
      });
      if (res.status === 404) {
        res = await fetch(`/api/profiles/${vacationDialog.emp.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: activePropertyId,
            status: "VACATION",
            vacationStartDate,
            vacationEndDate,
            vacationNotes,
          }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast.success(
        ar
          ? `تم تسجيل إجازة ${vacationDialog.emp.firstName} بنجاح (من ${vacationStartDate} إلى ${vacationEndDate})`
          : `Vacation recorded for ${vacationDialog.emp.firstName}`
      );
      setVacationDialog({ open: false, emp: null });
      invalidate();
    } catch (err: any) {
      toast.error(err.message || (ar ? "فشل تسجيل الإجازة" : "Failed to record vacation"));
    } finally {
      setVacationSubmitting(false);
    }
  };

  const handleReturnFromVacation = async (emp: any) => {
    if (!emp) return;
    try {
      let res = await fetch(`/api/profiles/${emp.id}/return-vacation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: activePropertyId,
        }),
      });
      if (res.status === 404) {
        res = await fetch(`/api/profiles/${emp.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: activePropertyId,
            status: "ACTIVE",
            vacationStartDate: null,
            vacationEndDate: null,
            vacationNotes: "",
          }),
        });
      }
      if (!res.ok) throw new Error();
      toast.success(
        ar
          ? `تم تسجيل عودة ${emp.firstName} من الإجازة بنجاح (مقيم بالسكن)`
          : `${emp.firstName} returned from vacation`
      );
      invalidate();
    } catch {
      toast.error(ar ? "فشل تسجيل العودة من الإجازة" : "Failed to record return");
    }
  };

  const openExtendDialog = (assignment: any, emp: any, room: any) => {
    let baseDate = new Date();
    if (assignment?.expectedCheckOutDate) {
      const exp = new Date(assignment.expectedCheckOutDate);
      if (!isNaN(exp.getTime()) && exp > baseDate) {
        baseDate = exp;
      }
    }
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + 7);

    setExtendNewDate(nextDate.toISOString().split("T")[0]);
    setExtendNotes(assignment?.notes || "");
    setExtendDialog({
      open: true,
      assignment,
      emp,
      room,
    });
  };

  const applyExtendPreset = (days: number) => {
    let baseDate = new Date();
    if (extendDialog.assignment?.expectedCheckOutDate) {
      const exp = new Date(extendDialog.assignment.expectedCheckOutDate);
      if (!isNaN(exp.getTime()) && exp > baseDate) {
        baseDate = exp;
      }
    }
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + days);
    setExtendNewDate(nextDate.toISOString().split("T")[0]);
  };

  const handleConfirmExtend = async () => {
    if (!extendDialog.assignment) return;
    if (!extendNewDate) {
      toast.error(
        ar
          ? "يرجى تحديد تاريخ المغادرة الجديد المتوقع"
          : "Please select a new expected departure date",
      );
      return;
    }

    setExtendLoading(true);
    try {
      const res = await fetch(`/api/assignments/${extendDialog.assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedCheckOutDate: extendNewDate,
          notes: extendNotes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to extend stay");
      }

      toast.success(
        ar
          ? `تم تمديد إقامة ${extendDialog.emp ? `${extendDialog.emp.firstName} ${extendDialog.emp.lastName || ""}` : ""} حتى ${extendNewDate} بنجاح`
          : `Stay extended until ${extendNewDate} successfully`,
      );
      setExtendDialog({ open: false, assignment: null, emp: null, room: null });
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
    } catch (err: any) {
      toast.error(
        err.message || (ar ? "فشل تمديد الإقامة" : "Failed to extend stay"),
      );
    } finally {
      setExtendLoading(false);
    }
  };

  const applyBulkExtendPreset = (days: number) => {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + days);
    setBulkExtendDate(baseDate.toISOString().split("T")[0]);
  };

  const handleBulkExtend = async () => {
    if (!bulkExtendDate) {
      toast.error(
        ar
          ? "يرجى تحديد تاريخ المغادرة الجديد المتوقع"
          : "Please select new expected departure date",
      );
      return;
    }
    const ids = Array.from(selectedRows);
    if (ids.length === 0) return;

    setBulkExtendLoading(true);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/assignments/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expectedCheckOutDate: bulkExtendDate,
              notes: bulkExtendNotes || undefined,
            }),
          }),
        ),
      );

      toast.success(
        ar
          ? `تم تمديد إقامة ${ids.length} مقيم حتى ${bulkExtendDate} بنجاح`
          : `Stay extended for ${ids.length} resident(s) until ${bulkExtendDate}`,
      );
      setBulkExtendOpen(false);
      setSelectedRows(new Set());
      setBulkExtendDate("");
      setBulkExtendNotes("");
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
    } catch (err: any) {
      toast.error(
        err.message ||
          (ar ? "فشل التمديد الجماعي" : "Failed to extend stay in bulk"),
      );
    } finally {
      setBulkExtendLoading(false);
    }
  };

  const checkoutMutation = useCheckoutAssignment({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم تسجيل الخروج" : "Checked out successfully");
        setCheckoutDialog({ open: false, id: null });
        setCheckoutNotes("");
      },
      onError: (e: any) => {
        toast.error(e.message || (ar ? "خطأ" : "Error"));
      },
    },
  });

  const transferMutation = useTransferAssignment({
    mutation: {
      onSuccess: (data: any) => {
        invalidate();
        const emp = transferDialog.emp;
        const targetRoom = targetRooms.find(
          (r) => r.id === parseInt(transferRoomId),
        );
        const isCross = Boolean(transferPropertyId && String(transferPropertyId) !== String(activePropertyId));
        if (isCross) {
          queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
          queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        }
        toast.success(
          isCross
            ? (ar ? "تم نقل الموظف بنجاح إلى الفندق والغرفة الجديدة" : "Resident successfully transferred to the new hotel & room")
            : (ar ? "تم نقل الغرفة بنجاح" : "Room Move successful")
        );
        setPrintAfterTransfer({
          assignment: data,
          emp,
          room: targetRoom,
          building: targetRoom
            ? targetBuildingMap[targetRoom.buildingId]
            : null,
          floorNum: null,
        });
        setTransferDialog({ open: false, id: null });
        setTransferRoomId("");
        setSelectedTransferBed("");
        setTransferReason("");
        setRoomSearch("");
        setTransferPropertyId("");
      },
      onError: async (err: any) => {
        let description = err.message;
        try {
          const body = err?.data || (await err?.response?.clone?.()?.json?.().catch(() => null)) || {};
          if (body?.code === "BED_TAKEN") {
            description = ar
              ? `هذا السرير مشغول بالفعل في الغرفة الجديدة. اختر سريرًا آخر.`
              : `This bed is already occupied. Please choose a different bed.`;
          } else if (body?.code === "ROOM_FULL") {
            description = ar
              ? `الغرفة المستهدفة ممتلئة.`
              : `Target room is full.`;
          } else if (body?.error) {
            description = body.error;
          }
        } catch {}
        toast.error(description || (ar ? "خطأ" : "Error"));
      },
    },
  });

  const empMap = Object.fromEntries(profiles.map((e) => [e.id, e]));
  const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
  const buildingMap = Object.fromEntries(buildings.map((b) => [b.id, b.name]));
  const floorMap = Object.fromEntries(
    floors.map((f) => [f.id, { name: f.name, number: f.floorNumber }]),
  );
  const targetBuildingMap = Object.fromEntries(
    targetBuildings.map((b) => [b.id, b.name]),
  );

  const transferRecommendations = useMemo(() => {
    if (!transferDialog.open || !transferDialog.emp || targetRooms.length === 0) {
      return { bestRoom: null, scoredRooms: [], recommendedMap: {} as Record<number, any> };
    }
    return recommendBestRooms({
      profile: transferDialog.emp,
      rooms: targetRooms,
      assignments: targetAssignments,
      profiles: [],
      policySettings: settings || {},
    });
  }, [transferDialog.open, transferDialog.emp, targetRooms, targetAssignments, settings]);

  const transferableRooms = targetRooms.filter(
    (r) =>
      r.status?.toLowerCase() !== "maintenance" &&
      (r.currentOccupancy ?? 0) < (r.capacity ?? 1),
  );

  const filteredTransferRooms = useMemo(() => {
    const list = transferableRooms.filter((r) => {
      if (!roomSearch.trim()) return true;
      const q = roomSearch.toLowerCase();
      const b = targetBuildingMap[r.buildingId] ?? "";
      return (
        r.roomNumber?.toLowerCase().includes(q) ||
        b.toLowerCase().includes(q) ||
        r.roomType?.toLowerCase().includes(q)
      );
    });

    // Sort by AI recommender score descending so highest matching rooms appear first
    return list.sort((a, b) => {
      const scoreA = transferRecommendations.recommendedMap[a.id]?.score ?? 0;
      const scoreB = transferRecommendations.recommendedMap[b.id]?.score ?? 0;
      return scoreB - scoreA;
    });
  }, [transferableRooms, roomSearch, targetBuildingMap, transferRecommendations]);

  // Row selection helpers
  const pagedIds = assignments.map((a) => a.id);
  const allPageSelected =
    pagedIds.length > 0 && pagedIds.every((id) => selectedRows.has(id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };
  const toggleRow = (id: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCheckout = () => {
    if (!checkoutDialog.id) return;
    if (!checkoutReason) {
      toast.error(ar ? "يرجى اختيار سبب المغادرة (إلزامي)" : "Checkout reason is mandatory");
      return;
    }
    checkoutMutation.mutate({
      id: checkoutDialog.id,
      data: {
        checkOutDate: new Date(checkoutDate).toISOString(),
        checkOutReason: checkoutReason,
        notes: checkoutNotes || undefined,
      } as any,
    });
  };

  const exportSelectedExcel = () => {
    const target = assignments.filter((a) => selectedRows.has(a.id));
    if (target.length === 0) return;
    const rows = target.map((a: any) => {
      const emp = empMap[a.profileId];
      const room = roomMap[a.roomId];
      const bName = a.buildingName || (room ? buildingMap[room.buildingId] : "");
      const fNum = a.floorNumber ?? (room ? floorMap[room.floorId]?.number : "");
      const rNum = a.roomNumber || room?.roomNumber || a.roomId || "";

      const profileObj = emp || {
        id: a.profileId,
        firstName: a.profileFirstName,
        lastName: a.profileLastName,
        firstNameAr: a.profileFirstNameAr,
        lastNameAr: a.profileLastNameAr,
        thirdNameAr: a.profileThirdNameAr,
        fourthNameAr: a.profileFourthNameAr,
        jobTitle: a.profileJobTitle || (a as any).jobTitle,
        jobTitleAr: a.profileJobTitleAr,
        department: a.profileDepartment,
        departmentAr: a.profileDepartmentAr,
      };

      const fullName = getProfileDisplayName(profileObj, ar) || (ar ? "بدون اسم" : "Unknown");
      const code = a.profileCode || emp?.profileId || a.profileId;
      const dept = getProfileDisplayDepartment(profileObj, ar);
      const job = getProfileDisplayJobTitle(profileObj, ar);
      const nat = formatNationality(a.profileNationality || (emp as any)?.nationality, ar);

      if (ar) {
        return {
          "كود الموظف": code,
          "الاسم": fullName,
          "رقم الغرفة": rNum,
          "المبنى": bName,
          "الطابق": fNum != null ? fNum : "",
          "السرير": (a.bedNumber || a.isEntireRoom) ? `سرير ${a.bedNumber || 1}${a.isEntireRoom ? ' (غرفة كاملة)' : ''}` : "",
          "تاريخ التسكين": formatDate(a.checkInDate, ""),
          "تاريخ المغادرة المتوقع": formatDate(a.expectedCheckOutDate, ""),
          "الجنسية": nat,
          "الهاتف": emp?.phone || (a as any).phone || "",
          "الوظيفة": job,
          "القسم": dept,
          "الحالة": (a as any).profileStatus === "VACATION" || emp?.status === "VACATION"
            ? "في إجازة"
            : (a as any).profileStatus === "LEFT" || emp?.status === "LEFT"
              ? "تمت المغادرة"
              : "مقيم بالسكن",
        };
      }

      return {
        Code: code,
        Name: fullName,
        "Room Number": rNum,
        Building: bName,
        Floor: fNum != null ? fNum : "",
        Bed: (a.bedNumber || a.isEntireRoom) ? `Bed ${a.bedNumber || 1}${a.isEntireRoom ? ' (Entire Room)' : ''}` : "",
        "Check-In Date": formatDate(a.checkInDate, ""),
        "Expected Check-Out": formatDate(a.expectedCheckOutDate, ""),
        Nationality: nat,
        Phone: emp?.phone || (a as any).phone || "",
        "Job Title": job,
        Department: dept,
        Status: (a as any).profileStatus || emp?.status || a.status || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ar ? "المقيمون بالسكن" : "In-House");
    XLSX.writeFile(wb, getExportFileName(ar ? "المقيمون_بالسكن" : "InHouse_Selected", "xlsx"));
  };

  const exportSelectedPdf = async () => {
    const target = assignments.filter((a) => selectedRows.has(a.id));
    if (target.length === 0) return;
    const rows = target.map((a: any) => {
      const emp = empMap[a.profileId];
      const room = roomMap[a.roomId];
      const bName = a.buildingName || (room ? buildingMap[room.buildingId] : "");
      const fNum = a.floorNumber ?? (room ? floorMap[room.floorId]?.number : "");
      const rNum = a.roomNumber || room?.roomNumber || a.roomId || "";

      const profileObj = emp || {
        id: a.profileId,
        firstName: a.profileFirstName,
        lastName: a.profileLastName,
        firstNameAr: a.profileFirstNameAr,
        lastNameAr: a.profileLastNameAr,
        thirdNameAr: a.profileThirdNameAr,
        fourthNameAr: a.profileFourthNameAr,
        jobTitle: a.profileJobTitle || (a as any).jobTitle,
        jobTitleAr: a.profileJobTitleAr,
        department: a.profileDepartment,
        departmentAr: a.profileDepartmentAr,
      };

      const fullName = getProfileDisplayName(profileObj, ar) || (ar ? "بدون اسم" : "Unknown");
      const code = a.profileCode || emp?.profileId || a.profileId;
      const dept = getProfileDisplayDepartment(profileObj, ar);
      const job = getProfileDisplayJobTitle(profileObj, ar);
      const nat = formatNationality(a.profileNationality || (emp as any)?.nationality, ar);

      return {
        [ar ? "كود الموظف" : "Code"]: code,
        [ar ? "الاسم" : "Name"]: fullName,
        [ar ? "رقم الغرفة" : "Room"]: rNum,
        [ar ? "المبنى" : "Building"]: bName,
        [ar ? "الطابق" : "Floor"]: fNum != null ? fNum : "",
        [ar ? "السرير" : "Bed"]: (a.bedNumber || a.isEntireRoom) ? `${ar ? "سرير " : "Bed "}${a.bedNumber || 1}${a.isEntireRoom ? (ar ? " (غرفة كاملة)" : " (Full)") : ""}` : "—",
        [ar ? "تاريخ التسكين" : "Check-in"]: formatDate(a.checkInDate, ""),
        [ar ? "المغادرة المتوقعة" : "Expected Out"]: formatDate(a.expectedCheckOutDate, ""),
        [ar ? "الجنسية" : "Nationality"]: nat,
        [ar ? "الهاتف" : "Phone"]: emp?.phone || (a as any).phone || "—",
        [ar ? "الوظيفة" : "Job Title"]: job,
        [ar ? "القسم" : "Department"]: dept,
        [ar ? "الحالة" : "Status"]: (a as any).profileStatus === "VACATION" || emp?.status === "VACATION"
          ? (ar ? "في إجازة" : "Vacation")
          : (a as any).profileStatus === "LEFT" || emp?.status === "LEFT"
            ? (ar ? "تمت المغادرة" : "Checked Out")
            : (ar ? "مقيم بالسكن" : "In-House"),
      };
    });

    await printLuxuryReport({
      activeTab: "assignments",
      title: ar ? "كشف المقيمين بالسكن — الموظفون المحددون" : "In-House Selected Residents Report",
      language: ar ? "ar" : "en",
      properties,
      activePropertyId,
      settings,
      rows,
      orientation: "landscape",
    });
  };

  const handleBulkCheckout = async () => {
    if (selectedRows.size === 0) return;
    if (!bulkCheckoutReason) {
      toast.error(ar ? "يرجى اختيار سبب المغادرة الجماعية (إلزامي)" : "Bulk checkout reason is mandatory");
      return;
    }
    setBulkCheckoutLoading(true);
    const ids = Array.from(selectedRows);
    let successCount = 0;
    for (const id of ids) {
      try {
        await checkoutMutation.mutateAsync({
          id,
          data: {
            checkOutDate: new Date().toISOString(),
            checkOutReason: bulkCheckoutReason,
            notes: bulkCheckoutNotes || (ar ? "خروج جماعي" : "Bulk Checkout"),
          } as any,
        });
        successCount++;
      } catch (e) {
        console.error("Bulk checkout error for id", id, e);
      }
    }
    setBulkCheckoutLoading(false);
    setBulkCheckoutOpen(false);
    setSelectedRows(new Set());
    setBulkCheckoutNotes("");
    setBulkCheckoutReason("");
    toast.success(
      ar
        ? `تم تسجيل خروج ${successCount} من أصل ${ids.length} مقيم بنجاح`
        : `Successfully checked out ${successCount} of ${ids.length} resident(s)`,
    );
  };

  const printHousingLetter = async (assignment: any, emp: any) => {
    const chosenAr = ar;
    const room = roomMap[assignment.roomId];
    const building = assignment?.buildingName || (room ? buildingMap[room.buildingId] : null);
    const floorNum = assignment?.floorNumber ?? (room ? floorMap[room.floorId]?.number : null);
    const fallbackProfile = empMap[assignment.profileId] || {};
    const mergedProfile = {
      ...fallbackProfile,
      ...emp,
      id: emp?.id || fallbackProfile.id || assignment.profileId,
      profileId: emp?.profileId || fallbackProfile.profileId || assignment.profileCode || assignment.profileId,
      firstName: emp?.firstName || fallbackProfile.firstName || assignment.profileFirstName,
      lastName: emp?.lastName || fallbackProfile.lastName || assignment.profileLastName,
      firstNameAr: emp?.firstNameAr || fallbackProfile.firstNameAr || assignment.profileFirstNameAr,
      lastNameAr: emp?.lastNameAr || fallbackProfile.lastNameAr || assignment.profileLastNameAr,
      thirdNameAr: emp?.thirdNameAr || fallbackProfile.thirdNameAr || assignment.profileThirdNameAr,
      fourthNameAr: emp?.fourthNameAr || fallbackProfile.fourthNameAr || assignment.profileFourthNameAr,
      nationalId: emp?.nationalId || fallbackProfile.nationalId || assignment.profileNationalId,
      nationality: emp?.nationality || fallbackProfile.nationality || assignment.profileNationality,
      department: emp?.department || fallbackProfile.department || assignment.profileDepartment,
      departmentAr: emp?.departmentAr || fallbackProfile.departmentAr || assignment.profileDepartmentAr,
      jobTitle: emp?.jobTitle || fallbackProfile.jobTitle || assignment.profileJobTitle || (assignment as any).jobTitle,
      jobTitleAr: emp?.jobTitleAr || fallbackProfile.jobTitleAr || assignment.profileJobTitleAr,
      level: emp?.level || fallbackProfile.level || assignment.profileLevel,
      phone: emp?.phone || fallbackProfile.phone || assignment.profilePhone,
    };
    await generateHousingLetterPdf({
      isArabic: chosenAr,
      profile: mergedProfile,
      assignment,
      room,
      building,
      floorNum,
      propName: activeProp?.name || "",
      propNameAr: (activeProp as any)?.displayName || activeProp?.name || "",
      propAddress: (activeProp as any)?.address || "",
      systemLogoUrl: (settings as any)?.systemLogo,
      propLogoUrl: (activeProp as any)?.logo,
    });
  };

  const handleTransfer = (policyException?: { approvedBy: string; reason: string }) => {
    if (!transferDialog.id || !transferRoomId) {
      toast.error(ar ? "الرجاء اختيار غرفة" : "Please select a room");
      return;
    }
    if (bedOptions.length > 0 && !selectedTransferBed) {
      toast.error(ar ? "الرجاء اختيار سرير" : "Please select a bed");
      return;
    }

    // Check policy compliance if exception not yet approved
    if (!policyException && selectedTargetRoom && transferDialog.emp) {
      const compliance = checkPolicyCompliance({
        profile: transferDialog.emp,
        room: selectedTargetRoom,
        assignments: targetAssignments,
        profiles: [],
        policySettings: settings || {},
      });

      if (!compliance.compliant && compliance.violations.length > 0) {
        if (settings?.policyRequireExceptionApproval) {
          setTransferPolicyModal({
            open: true,
            violations: compliance.violations,
          });
          return;
        } else {
          toast.warning(
            ar
              ? "تنبيه: التسكين يخالف بعض السياسات المحددة"
              : "Warning: Transfer conflicts with housing policies",
          );
        }
      }
    }

    const targetPropId = transferPropertyId ? parseInt(transferPropertyId) : undefined;
    const isCross = Boolean(targetPropId && targetPropId !== Number(activePropertyId));
    transferMutation.mutate({
      id: transferDialog.id,
      data: {
        newRoomId: parseInt(transferRoomId),
        newBedNumber: selectedTransferBed
          ? parseInt(selectedTransferBed)
          : undefined,
        transferDate: new Date().toISOString(),
        transferReason: transferReason || undefined,
        targetPropertyId: targetPropId,
        archiveSourceProfile: isCross ? transferArchiveSource : undefined,
        hasPolicyException: Boolean(policyException),
        policyApprovedBy: policyException?.approvedBy,
        policyExceptionReason: policyException?.reason,
      } as any,
    });
  };

  const IH_COLS = [
    {
      key: "profile",
      label: "Resident",
      labelAr: "الموظف",
      defaultVisible: true,
      fixed: true,
    },
    {
      key: "building",
      label: "Building & Floor",
      labelAr: "المبنى والدور",
      defaultVisible: true,
    },
    {
      key: "room",
      label: "Room & Bed",
      labelAr: "الغرفة والسرير",
      defaultVisible: true,
      fixed: true,
    },
    {
      key: "checkin",
      label: "Check-in",
      labelAr: "تاريخ الدخول",
      defaultVisible: true,
    },
    {
      key: "expected",
      label: "Expected Out",
      labelAr: "المغادرة المتوقعة",
      defaultVisible: true,
    },
    {
      key: "personStatus",
      label: "Status",
      labelAr: "الحالة",
      defaultVisible: true,
    },
    {
      key: "actions",
      label: "Actions",
      labelAr: "إجراءات",
      defaultVisible: true,
      fixed: true,
    },
  ];
  const {
    visible: ihVisible,
    toggle: ihToggle,
    showAll: ihShowAll,
    hideAll: ihHideAll,
    isVisible: isIHVisible,
  } = useColumnVisibility(IH_COLS);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {ar ? "المقيمون حالياً" : "In-House"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <PermissionGate anyPermission={[["whatsapp", "create"], ["accommodation", "edit"]]}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBroadcastTargetMode("all");
                setBroadcastOpen(true);
              }}
              className="gap-1.5 font-semibold text-xs h-9 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 bg-background shadow-xs"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              {ar ? "إرسال جماعي (واتساب)" : "Broadcast WhatsApp"}
            </Button>
          </PermissionGate>
          <ColumnChooser
            cols={IH_COLS}
            visible={ihVisible}
            onToggle={ihToggle}
            onShowAll={ihShowAll}
            onHideAll={ihHideAll}
          />
          <div className="relative flex-1 min-w-[180px] sm:w-52 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={
                ar ? "بحث بالاسم أو الغرفة..." : "Search by name or room..."
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        count={selectedRows.size}
        onClear={() => setSelectedRows(new Set())}
        onExportExcel={exportSelectedExcel}
        onExportPDF={exportSelectedPdf}
        extraActions={
          <div className="flex items-center gap-2">
            <PermissionGate anyPermission={[["whatsapp", "create"], ["accommodation", "edit"]]}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBroadcastTargetMode("selected");
                  setBroadcastOpen(true);
                }}
                className="gap-1.5 font-semibold text-xs h-8 text-emerald-600 border-emerald-500/40 hover:bg-emerald-50 bg-background"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-500" />
                {ar ? "واتساب للمحددين" : "WhatsApp Selected"}
              </Button>
            </PermissionGate>
            <PermissionGate module="accommodation" action="edit">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const defaultDate = new Date();
                  defaultDate.setDate(defaultDate.getDate() + 14);
                  setBulkExtendDate(defaultDate.toISOString().split("T")[0]);
                  setBulkExtendNotes("");
                  setBulkExtendOpen(true);
                }}
                className="gap-1.5 font-semibold text-xs h-8 text-primary border-primary/30 hover:bg-primary/10 bg-background"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                {ar ? "تمديد إقامة جماعي" : "Bulk Extend"}
              </Button>
            </PermissionGate>
            <PermissionGate module="accommodation" action="checkout">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkCheckoutOpen(true)}
                className="gap-1.5 font-semibold text-xs h-8"
              >
                <LogOut className="w-3.5 h-3.5" />
                {ar ? "تسجيل خروج جماعي" : "Bulk Check-out"}
              </Button>
            </PermissionGate>
          </div>
        }
        ar={ar}
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="border rounded-xl bg-card overflow-hidden overflow-x-auto shadow-xs">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10 px-3">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                {isIHVisible("profile") && (
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider min-w-[200px]">
                    {ar ? "الموظف" : "Resident"}
                  </TableHead>
                )}
                {isIHVisible("building") && (
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider min-w-[130px]">
                    {ar ? "المبنى والدور" : "Building & Floor"}
                  </TableHead>
                )}
                {isIHVisible("room") && (
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider min-w-[120px]">
                    {ar ? "الغرفة والسرير" : "Room & Bed"}
                  </TableHead>
                )}
                {isIHVisible("checkin") && (
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider min-w-[110px]">
                    {ar ? "تاريخ الدخول" : "Check-in"}
                  </TableHead>
                )}
                {isIHVisible("expected") && (
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider min-w-[130px]">
                    {ar ? "المغادرة المتوقعة" : "Expected Out"}
                  </TableHead>
                )}
                {isIHVisible("personStatus") && (
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider min-w-[110px]">
                    {ar ? "الحالة" : "Status"}
                  </TableHead>
                )}
                {isIHVisible("actions") && (
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider w-24 text-center">
                    {ar ? "إجراءات" : "Actions"}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a: any) => {
                const emp = empMap[a.profileId];
                const room = roomMap[a.roomId];
                const building = a.buildingName || (room ? buildingMap[room.buildingId] : null);
                const floorNum = a.floorNumber ?? (room ? floorMap[room.floorId]?.number : null);
                const roomNum = a.roomNumber || room?.roomNumber || (a.roomId ? `#${a.roomId}` : "—");
                const roomType = a.roomType || room?.roomType;

                const profileObj = emp || {
                  id: a.profileId,
                  firstName: a.profileFirstName,
                  lastName: a.profileLastName,
                  firstNameAr: a.profileFirstNameAr,
                  lastNameAr: a.profileLastNameAr,
                  thirdNameAr: a.profileThirdNameAr,
                  fourthNameAr: a.profileFourthNameAr,
                  jobTitle: a.profileJobTitle || (a as any).jobTitle,
                  jobTitleAr: a.profileJobTitleAr,
                  department: a.profileDepartment,
                  departmentAr: a.profileDepartmentAr,
                };

                const fullName = getProfileDisplayName(profileObj, ar) || (ar ? "بدون اسم" : "Unknown");
                const profileCode = a.profileCode || emp?.profileId || (a.profileId ? String(a.profileId) : "");
                const department = getProfileDisplayDepartment(profileObj, ar);
                const nationality = a.profileNationality || (emp as any)?.nationality;
                const photoUrl = a.profilePhotoUrl || emp?.photoUrl;

                const daysStayed = a.checkInDate
                  ? differenceInDays(new Date(), new Date(a.checkInDate))
                  : 0;
                const daysRemaining = a.expectedCheckOutDate
                  ? differenceInDays(
                      new Date(a.expectedCheckOutDate),
                      new Date(),
                    )
                  : null;
                const isAlert =
                  daysRemaining !== null &&
                  daysRemaining <= 3 &&
                  daysRemaining >= 0;
                const isOverdue = daysRemaining !== null && daysRemaining < 0;
                const isEntire = Boolean(
                  a.isEntireRoom ||
                  (a as any).is_entire_room ||
                  a.notes?.includes("[حجز الغرفة بالكامل]") ||
                  a.notes?.includes("[تسكين الغرفة بالكامل]")
                );
                const displayBed = a.bedNumber ?? (isEntire ? 1 : null);
                const isSelected = selectedRows.has(a.id);

                return (
                  <TableRow
                    key={a.id}
                    className={`${isSelected ? "bg-primary/5" : isOverdue ? "bg-red-50/60 dark:bg-red-950/20" : isAlert ? "bg-amber-50/60 dark:bg-amber-950/20" : "hover:bg-muted/20"} transition-colors`}
                  >
                    <TableCell className="px-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(a.id)}
                      />
                    </TableCell>

                    {/* Column 1: Resident / Employee */}
                    {isIHVisible("profile") && (
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => a.profileId && setProfileEmpId(a.profileId)}
                            className="cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                            title={ar ? "عرض ملف المقيم" : "View profile"}
                          >
                            <EmpAvatar emp={emp} name={fullName} photoUrl={photoUrl} />
                          </button>
                          <div className="flex flex-col min-w-0">
                            <button
                              type="button"
                              onClick={() => a.profileId && setProfileEmpId(a.profileId)}
                              className="font-semibold text-foreground text-sm leading-tight text-left rtl:text-right hover:text-primary hover:underline transition-colors truncate"
                            >
                              {fullName}
                            </button>
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
                              {profileCode && (
                                <span className="font-mono text-[11px] text-muted-foreground font-medium">
                                  #{profileCode}
                                </span>
                              )}
                              {department && (
                                <>
                                  <span className="text-muted-foreground/40">·</span>
                                  <span className="text-[11px]">{department}</span>
                                </>
                              )}
                              {nationality && (
                                <>
                                  <span className="text-muted-foreground/40">·</span>
                                  <span className="text-[11px] flex items-center gap-0.5">
                                    <Globe className="w-2.5 h-2.5 text-muted-foreground/60" />
                                    {formatNationality(nationality, ar, false)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    )}

                    {/* Column 2: Building & Floor */}
                    {isIHVisible("building") && (
                      <TableCell className="py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-primary/70" />
                            {building || "—"}
                          </span>
                          {floorNum != null && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Layers className="w-3 h-3 text-muted-foreground/60" />
                              {ar ? `الدور ${floorNum}` : `Floor ${floorNum}`}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}

                    {/* Column 3: Room & Bed */}
                    {isIHVisible("room") && (
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-primary text-base">
                              {roomNum}
                            </span>
                            {displayBed ? (
                              <Badge variant="secondary" className="text-xs font-semibold px-1.5 py-0">
                                <BedDouble className="w-3 h-3 mr-1 rtl:ml-1 rtl:mr-0" />
                                {ar ? `سرير ${displayBed}` : `Bed ${displayBed}`}
                              </Badge>
                            ) : null}
                            {isEntire && (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 text-[11px] px-1.5 py-0 font-medium">
                                {ar ? "غرفة كاملة" : "Entire"}
                              </Badge>
                            )}
                          </div>
                          {roomType && (
                            <span className="text-[11px] text-muted-foreground capitalize">
                              {roomType}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}

                    {/* Column 4: Check-in Date */}
                    {isIHVisible("checkin") && (
                      <TableCell className="py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {formatDate(a.checkInDate)}
                          </span>
                          <span className="text-xs text-muted-foreground mt-0.5">
                            {ar ? `منذ ${daysStayed} يوم` : `${daysStayed}d ago`}
                          </span>
                        </div>
                      </TableCell>
                    )}

                    {/* Column 5: Expected Check-out */}
                    {isIHVisible("expected") && (
                      <TableCell className="py-3 whitespace-nowrap">
                        {a.expectedCheckOutDate ? (
                          <div className="flex flex-col">
                            <span
                              className={
                                isOverdue
                                  ? "text-sm font-semibold text-red-600"
                                  : isAlert
                                    ? "text-sm font-semibold text-amber-600"
                                    : "text-sm font-medium text-foreground"
                              }
                            >
                              {formatDate(a.expectedCheckOutDate)}
                            </span>
                            {isOverdue && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-bold w-fit mt-0.5">
                                {ar ? "متأخر" : "Overdue"}
                              </Badge>
                            )}
                            {isAlert && !isOverdue && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-bold border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 w-fit mt-0.5">
                                {daysRemaining} {ar ? "يوم متبقي" : "d left"}
                              </Badge>
                            )}
                            {!isOverdue && !isAlert && daysRemaining !== null && (
                              <span className="text-xs text-muted-foreground mt-0.5">
                                {ar ? `متبقي ${daysRemaining} يوم` : `${daysRemaining}d left`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}

                    {/* Column 6: Status */}
                    {isIHVisible("personStatus") && (
                      <TableCell className="py-3">
                        {(() => {
                          const pStatus = ((a as any).profileStatus || emp?.status || "").toUpperCase();
                          const isVacation = pStatus === "VACATION";
                          const isCheckedOut = a.status === "CHECKED_OUT" || a.status === "LEFT" || pStatus === "LEFT" || pStatus === "CHECKED_OUT";

                          if (isCheckedOut) {
                            return (
                              <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 text-xs gap-1 font-medium whitespace-nowrap">
                                <LogOut className="w-3 h-3" />
                                {ar ? "مغادر" : "Checked Out"}
                              </Badge>
                            );
                          }

                          if (isVacation) {
                            const returnDate = (a as any).vacationEndDate || emp?.vacationEndDate;
                            return (
                              <div className="flex flex-col gap-0.5 items-start">
                                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 text-xs font-semibold gap-1 whitespace-nowrap">
                                  <Palmtree className="w-3 h-3 text-amber-600" />
                                  {ar ? "في إجازة" : "On Vacation"}
                                </Badge>
                                {returnDate && (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    {ar ? `عودة: ${formatDate(returnDate)}` : `Return: ${formatDate(returnDate)}`}
                                  </span>
                                )}
                              </div>
                            );
                          }

                          return (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs font-semibold gap-1 whitespace-nowrap">
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                              {ar ? "مقيم بالسكن" : "In-House"}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                    )}

                    {/* Column 5: Actions */}
                    {isIHVisible("actions") && (
                      <TableCell className="py-2.5 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs font-semibold gap-1"
                            >
                              <ArrowRightLeft className="w-3 h-3 rtl:ml-1 rtl:mr-0" />
                              {ar ? "إجراءات" : "Actions"}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <PermissionGate module="accommodation" action="edit">
                              <DropdownMenuItem
                                onClick={() => openExtendDialog(a, emp || { id: a.profileId, firstName: a.profileFirstName, lastName: a.profileLastName }, room || { id: a.roomId, roomNumber: a.roomNumber })}
                                className="text-primary font-medium"
                              >
                                <CalendarPlus className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-primary" />
                                {ar ? "تمديد الإقامة" : "Extend Stay"}
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate module="accommodation" action="edit">
                              <DropdownMenuItem
                                onClick={() => {
                                  setReissueNotes("");
                                  setReissueDialog({
                                    open: true,
                                    assignment: a,
                                    emp: emp || { id: a.profileId, firstName: a.profileFirstName, lastName: a.profileLastName },
                                    room: room || { id: a.roomId, roomNumber: a.roomNumber },
                                  });
                                }}
                              >
                                <Key className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                {ar ? "إعادة إصدار مفتاح" : "Re-issue Key"}
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate module="accommodation" action="export">
                              <DropdownMenuItem
                                onClick={() => printHousingLetter(a, profileObj)}
                              >
                                <Printer className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                {ar ? "طباعة خطاب السكن" : "Print Housing Letter"}
                              </DropdownMenuItem>
                            </PermissionGate>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedGatePassProfileId(a.profileId);
                                setGatePassOpen(true);
                              }}
                              className="font-medium text-emerald-600 dark:text-emerald-400"
                            >
                              <QrCode className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-emerald-600 dark:text-emerald-400" />
                              {ar ? "تصريح السكن (Gate Pass)" : "Gate QR Pass"}
                            </DropdownMenuItem>
                            <PermissionGate module="accommodation" action="edit">
                              <DropdownMenuItem
                                onClick={() => {
                                  if (emp?.status === "VACATION" || (a as any).profileStatus === "VACATION") {
                                    handleReturnFromVacation(emp || { id: a.profileId, firstName: a.profileFirstName });
                                  } else {
                                    const today = new Date().toISOString().split("T")[0];
                                    setVacationStartDate(today);
                                    const future = new Date();
                                    future.setDate(future.getDate() + 14);
                                    setVacationEndDate(future.toISOString().split("T")[0]);
                                    setVacationNotes("");
                                    setVacationDialog({ open: true, emp: emp || { id: a.profileId, firstName: a.profileFirstName }, room });
                                  }
                                }}
                                className={(emp?.status === "VACATION" || (a as any).profileStatus === "VACATION") ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}
                              >
                                {(emp?.status === "VACATION" || (a as any).profileStatus === "VACATION") ? (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-emerald-600" />
                                    {ar ? "تسجيل عودة من الإجازة" : "Return from Vacation"}
                                  </>
                                ) : (
                                  <>
                                    <Palmtree className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-amber-600" />
                                    {ar ? "تسجيل خروج في إجازة" : "Set on Vacation"}
                                  </>
                                )}
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate anyPermission={[["whatsapp", "create"], ["accommodation", "edit"]]}>
                              <DropdownMenuItem
                                onClick={() => {
                                  handleOpenWhatsAppDialog(a, emp);
                                }}
                              >
                                <MessageSquare className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-emerald-600" />
                                {ar ? "إرسال تفاصيل التسكين (واتساب)" : "Send WhatsApp Welcome"}
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate module="accommodation" action="checkout">
                              <DropdownMenuItem
                                onClick={() => {
                                  setCheckoutDate(
                                    new Date().toISOString().split("T")[0],
                                  );
                                  setCheckoutNotes("");
                                  setCheckoutReason("");
                                  setCheckoutDialog({
                                    open: true,
                                    id: a.id,
                                    emp: emp || { id: a.profileId, firstName: a.profileFirstName, lastName: a.profileLastName },
                                  });
                                }}
                              >
                                <LogOut className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                {ar ? "خروج" : "Checkout"}
                              </DropdownMenuItem>
                            </PermissionGate>
                            <PermissionGate module="accommodation" action="transfer">
                              <DropdownMenuItem
                                onClick={() => {
                                  setTransferRoomId("");
                                  setSelectedTransferBed("");
                                  setTransferReason("");
                                  setRoomSearch("");
                                  setTransferPropertyId(
                                    String(activePropertyId ?? ""),
                                  );
                                  setTransferDialog({
                                    open: true,
                                    id: a.id,
                                    emp: emp || { id: a.profileId, firstName: a.profileFirstName, lastName: a.profileLastName },
                                  });
                                }}
                              >
                                <ArrowRightLeft className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                                {ar ? "نقل لغرفة أخرى" : "Room Move"}
                              </DropdownMenuItem>
                            </PermissionGate>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {assignments.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={ihVisible.size + 1}
                    className="py-12 text-center"
                  >
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-muted-foreground">
                      {ar ? "لا توجد تعيينات نشطة" : "No active assignments"}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {/* Total row */}
            {assignments.length > 0 && (
              <tfoot>
                <tr className="bg-muted/40 border-t font-semibold text-sm">
                  <td colSpan={2} className="px-4 py-2 text-muted-foreground">
                    {ar ? "الإجمالي" : "Total"}
                  </td>
                  <td
                    colSpan={ihVisible.size}
                    className="px-4 py-2 text-muted-foreground"
                  >
                    {assignments.length} {ar ? "مقيم" : "residents"}
                    {selectedRows.size > 0 && (
                      <span className="ml-3 text-primary">
                        · {selectedRows.size} {ar ? "محدد" : "selected"}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </Table>
          {total > 0 && (
            <DataPagination
              total={total}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      )}

      {/* WhatsApp Welcome / Check-in Notification Dialog */}
      <Dialog
        open={whatsAppDialog.open}
        onOpenChange={(open) =>
          setWhatsAppDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent
          className="max-w-md"
          srTitle={ar ? "إرسال تفاصيل التسكين عبر الواتساب" : "Send WhatsApp Check-in Details"}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              {ar ? "إرسال تفاصيل التسكين عبر الواتساب" : "Send WhatsApp Check-in Details"}
            </DialogTitle>
          </DialogHeader>

          {whatsAppDialog.emp && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
              <EmpAvatar emp={whatsAppDialog.emp} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">
                  {whatsAppDialog.emp.firstName} {whatsAppDialog.emp.lastName}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono font-medium">#{whatsAppDialog.emp.id || whatsAppDialog.emp.profileId}</span>
                  {whatsAppDialog.roomNumber && (
                    <>
                      <span>•</span>
                      <span>
                        {ar ? "غرفة" : "Room"} {whatsAppDialog.roomNumber}
                        {whatsAppDialog.bedNumber ? ` (${ar ? "سرير" : "Bed"} ${whatsAppDialog.bedNumber})` : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {!whatsAppDialog.emp?.phone && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {ar ? "لا يوجد رقم هاتف مسجل في ملف الموظف" : "No phone number registered for this employee"}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {ar
                    ? "أدخل رقم الواتساب بالأسفل ليتم حفظه تلقائياً في ملف الموظف وإرسال رسالة التسكين الترحيبية وتفاصيل الغرفة إليه فوراً."
                    : "Enter the WhatsApp number below to save it to their profile and send check-in details immediately."}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">
                {ar ? "رقم هاتف الواتساب للموظف" : "WhatsApp Phone Number"} *
              </Label>
              <Input
                placeholder="010xxxxxxxx أو 201xxxxxxxxx"
                value={whatsAppPhone}
                onChange={(e) => setWhatsAppPhone(e.target.value)}
                dir="ltr"
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                {ar
                  ? "سيتم إرسال رسالة ترحيبية تشمل اسم الفندق، المبنى، الدور، الغرفة، السرير، ورابط بوابة المقيمين."
                  : "Includes hotel name, building, room, bed, and portal link."}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWhatsAppDialog((prev) => ({ ...prev, open: false }))}
                disabled={isSendingWhatsApp}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                onClick={handleSendWhatsApp}
                disabled={isSendingWhatsApp || !whatsAppPhone.trim()}
              >
                {isSendingWhatsApp ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {ar ? "إرسال الرسالة الآن" : "Send Message Now"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extend Stay Dialog */}
      <Dialog
        open={extendDialog.open}
        onOpenChange={(open) =>
          setExtendDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent
          className="max-w-md"
          srTitle={ar ? "تمديد فترة الإقامة" : "Extend Stay Period"}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <CalendarPlus className="w-5 h-5 text-primary" />
              {ar ? "تمديد فترة الإقامة" : "Extend Stay Period"}
            </DialogTitle>
          </DialogHeader>

          {extendDialog.emp && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
              <EmpAvatar emp={extendDialog.emp} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">
                  {extendDialog.emp.firstName} {extendDialog.emp.lastName}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono font-medium">{extendDialog.emp.profileId}</span>
                  {extendDialog.room && (
                    <>
                      <span>•</span>
                      <span>
                        {ar ? "غرفة" : "Room"} {extendDialog.room.roomNumber}
                        {extendDialog.assignment?.bedNumber ? ` (${ar ? "سرير" : "Bed"} ${extendDialog.assignment.bedNumber})` : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {extendDialog.assignment && (
            <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div>
                <span className="text-muted-foreground block mb-0.5">
                  {ar ? "تاريخ التسكين:" : "Check-in Date:"}
                </span>
                <span className="font-semibold">
                  {formatDate(extendDialog.assignment.checkInDate)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">
                  {ar ? "تاريخ المغادرة الحالي:" : "Current Departure:"}
                </span>
                <span className="font-semibold">
                  {formatDate(extendDialog.assignment.expectedCheckOutDate, ar ? "غير محدد" : "Not set")}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">
                {ar ? "تاريخ المغادرة الجديد المتوقع" : "New Expected Departure Date"} *
              </Label>
              <DateInput
                value={extendNewDate}
                onChange={(iso) => setExtendNewDate(iso)}
                min={new Date().toISOString().split("T")[0]}
                className="font-mono text-sm"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                <span className="text-xs text-muted-foreground mr-1 rtl:ml-1 rtl:mr-0">
                  {ar ? "إضافة سريعة:" : "Quick add:"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyExtendPreset(3)}
                >
                  +3 {ar ? "أيام" : "days"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyExtendPreset(7)}
                >
                  + {ar ? "أسبوع" : "1 week"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyExtendPreset(14)}
                >
                  + {ar ? "أسبوعين" : "2 weeks"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyExtendPreset(30)}
                >
                  + {ar ? "شهر" : "1 month"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyExtendPreset(90)}
                >
                  + 3 {ar ? "أشهر" : "months"}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                {ar ? "سبب التمديد / ملاحظات" : "Extension Reason / Notes"}
              </Label>
              <Textarea
                placeholder={
                  ar
                    ? "أدخل سبب تمديد الإقامة أو أي تفاصيل إضافية..."
                    : "Enter reason for extending stay or additional notes..."
                }
                value={extendNotes}
                onChange={(e) => setExtendNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setExtendDialog({
                    open: false,
                    assignment: null,
                    emp: null,
                    room: null,
                  })
                }
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleConfirmExtend}
                disabled={extendLoading || !extendNewDate}
                className="gap-1.5 bg-primary font-semibold"
              >
                <CalendarPlus className="w-4 h-4" />
                {extendLoading
                  ? ar
                    ? "جاري التمديد..."
                    : "Extending..."
                  : ar
                    ? "تأكيد تمديد الإقامة"
                    : "Confirm Extension"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog
        open={checkoutDialog.open}
        onOpenChange={(open) =>
          setCheckoutDialog({ open, id: open ? checkoutDialog.id : null })
        }
      >
        <DialogContent
          className="max-w-sm"
          srTitle={ar ? "تسجيل خروج" : "Checkout Profile"}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="w-5 h-5" />
              {ar ? "تسجيل خروج" : "Checkout Profile"}
            </DialogTitle>
          </DialogHeader>
          {checkoutDialog.emp && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 -mt-2">
              <EmpAvatar emp={checkoutDialog.emp} />
              <div>
                <p className="font-semibold text-sm">
                  {checkoutDialog.emp.firstName} {checkoutDialog.emp.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {checkoutDialog.emp.profileId}
                </p>
              </div>
            </div>
          )}
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>{ar ? "تاريخ الخروج" : "Check-out Date"}</Label>
              <DateInput
                value={checkoutDate}
                onChange={(iso) => setCheckoutDate(iso)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 font-semibold text-xs">
                {ar ? "سبب المغادرة" : "Check-out Reason"}
                <span className="text-destructive font-bold">*</span>
              </Label>
              <Select value={checkoutReason} onValueChange={setCheckoutReason}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={ar ? "اختر سبب المغادرة (إلزامي)..." : "Select reason (Mandatory)..."} />
                </SelectTrigger>
                <SelectContent>
                  {CHECKOUT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {ar ? r.labelAr : r.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                placeholder={ar ? "أي ملاحظات إضافية..." : "Any additional notes..."}
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setCheckoutDialog({ open: false, id: null })}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleCheckout}
                disabled={checkoutMutation.isPending || !checkoutReason}
              >
                {checkoutMutation.isPending
                  ? ar
                    ? "جاري..."
                    : "Processing..."
                  : ar
                    ? "تأكيد الخروج"
                    : "Confirm Checkout"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Extend Dialog */}
      <Dialog
        open={bulkExtendOpen}
        onOpenChange={(open) => {
          if (!open && !bulkExtendLoading) setBulkExtendOpen(false);
        }}
      >
        <DialogContent
          className="max-w-md"
          srTitle={ar ? "تمديد إقامة جماعي" : "Bulk Extend Stay"}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <CalendarPlus className="w-5 h-5 text-primary" />
              {ar ? "تمديد إقامة جماعي" : "Bulk Extend Stay"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm">
              <p className="font-semibold text-primary">
                {ar
                  ? `تمديد فترة الإقامة لعدد (${selectedRows.size}) من المقيمين المحددين`
                  : `Extend stay period for (${selectedRows.size}) selected residents`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {ar
                  ? "سيتم تحديث تاريخ المغادرة المتوقع لجميع المقيمين المحددين دفعة واحدة."
                  : "Expected check-out date will be updated for all selected residents at once."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">
                {ar ? "تاريخ المغادرة الجديد المتوقع لجميع المحددين" : "New Expected Departure Date"} *
              </Label>
              <DateInput
                value={bulkExtendDate}
                onChange={(iso) => setBulkExtendDate(iso)}
                min={new Date().toISOString().split("T")[0]}
                className="font-mono text-sm"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                <span className="text-xs text-muted-foreground mr-1 rtl:ml-1 rtl:mr-0">
                  {ar ? "إضافة سريعة:" : "Quick add:"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyBulkExtendPreset(7)}
                >
                  + {ar ? "أسبوع" : "1 week"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyBulkExtendPreset(14)}
                >
                  + {ar ? "أسبوعين" : "2 weeks"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyBulkExtendPreset(30)}
                >
                  + {ar ? "شهر" : "1 month"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-normal"
                  onClick={() => applyBulkExtendPreset(90)}
                >
                  + 3 {ar ? "أشهر" : "months"}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">
                {ar ? "سبب التمديد الجماعي / ملاحظات" : "Extension Reason / Notes (Optional)"}
              </Label>
              <Input
                placeholder={ar ? "سبب تمديد الإقامة الجماعي..." : "Reason for bulk extension..."}
                value={bulkExtendNotes}
                onChange={(e) => setBulkExtendNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setBulkExtendOpen(false)}
                disabled={bulkExtendLoading}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleBulkExtend}
                disabled={bulkExtendLoading || !bulkExtendDate}
                className="gap-1.5 bg-primary font-semibold"
              >
                <CalendarPlus className="w-4 h-4" />
                {bulkExtendLoading
                  ? ar
                    ? "جاري التمديد..."
                    : "Extending..."
                  : ar
                    ? `تأكيد تمديد (${selectedRows.size}) مقيم`
                    : `Confirm Extend (${selectedRows.size})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Checkout Dialog */}
      <Dialog
        open={bulkCheckoutOpen}
        onOpenChange={(open) => {
          if (!open && !bulkCheckoutLoading) setBulkCheckoutOpen(false);
        }}
      >
        <DialogContent
          className="max-w-md"
          srTitle={ar ? "تسجيل خروج جماعي" : "Bulk Check-out"}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <LogOut className="w-5 h-5" />
              {ar ? "تسجيل خروج جماعي" : "Bulk Check-out"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
              <p className="font-semibold text-destructive">
                {ar
                  ? `هل أنت متأكد من رغبتك في تسجيل خروج ${selectedRows.size} مقيم محدد؟`
                  : `Are you sure you want to check out ${selectedRows.size} selected resident(s)?`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {ar
                  ? "سيتم تحرير الأسرة والغرف وتحديث حالة المقيمين إلى مغادر."
                  : "Beds will be freed and residents status updated to checked out."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 font-semibold text-xs">
                {ar ? "سبب المغادرة الجماعية" : "Bulk Check-out Reason"}
                <span className="text-destructive font-bold">*</span>
              </Label>
              <Select value={bulkCheckoutReason} onValueChange={setBulkCheckoutReason}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={ar ? "اختر سبب المغادرة الجماعية (إلزامي)..." : "Select bulk reason (Mandatory)..."} />
                </SelectTrigger>
                <SelectContent>
                  {CHECKOUT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {ar ? r.labelAr : r.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "ملاحظات خروج جماعي (اختياري)" : "Notes (Optional)"}</Label>
              <Input
                placeholder={ar ? "سبب أو تفاصيل المغادرة الجماعية..." : "Reason or details..."}
                value={bulkCheckoutNotes}
                onChange={(e) => setBulkCheckoutNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setBulkCheckoutOpen(false);
                  setBulkCheckoutReason("");
                }}
                disabled={bulkCheckoutLoading}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkCheckout}
                disabled={bulkCheckoutLoading || !bulkCheckoutReason}
                className="gap-1.5"
              >
                {bulkCheckoutLoading ? (
                  ar ? "جاري الخروج..." : "Checking out..."
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    {ar ? `تأكيد خروج (${selectedRows.size})` : `Confirm Checkout (${selectedRows.size})`}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vacation Dialog */}
      <Dialog
        open={vacationDialog.open}
        onOpenChange={(open) => {
          if (!open) setVacationDialog({ open: false, emp: null });
        }}
      >
        <DialogContent
          className="max-w-md"
          srTitle={ar ? "تسجيل إجازة موظف" : "Record Employee Vacation"}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Palmtree className="w-5 h-5" />
              {ar ? "تسجيل خروج في إجازة" : "Set Employee on Vacation"}
            </DialogTitle>
          </DialogHeader>

          {vacationDialog.emp && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <EmpAvatar emp={vacationDialog.emp} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground truncate">
                  {vacationDialog.emp.firstName} {vacationDialog.emp.lastName}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{vacationDialog.emp.employeeId || vacationDialog.emp.profileId}</span>
                  {vacationDialog.room && (
                    <Badge variant="outline" className="text-[10px] py-0">
                      {ar ? "غرفة" : "Room"} {vacationDialog.room.roomNumber}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {ar ? "تاريخ بدء الإجازة (من)" : "Start Date"}
                </Label>
                <DateInput
                  value={vacationStartDate}
                  onChange={(iso) => setVacationStartDate(iso)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {ar ? "تاريخ العودة المتوقع (إلى)" : "Return Date"}
                </Label>
                <DateInput
                  value={vacationEndDate}
                  onChange={(iso) => setVacationEndDate(iso)}
                />
              </div>
            </div>

            {vacationDurationDays() !== null && (
              <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 flex items-center justify-between text-xs font-bold">
                <span>{ar ? "مدة الإجازة المحسوبة:" : "Vacation Duration:"}</span>
                <span className="text-sm px-2 py-0.5 rounded bg-teal-200/60 dark:bg-teal-900/60">
                  {vacationDurationDays()} {ar ? "يوم" : "Days"}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {ar ? "ملاحظات الإجازة (اختياري)" : "Vacation Notes"}
              </Label>
              <Textarea
                placeholder={
                  ar
                    ? "اكتب أي تفاصيل إضافية مثل رقم الطوارئ أو سبب الإجازة..."
                    : "Add any notes or contact info..."
                }
                value={vacationNotes}
                onChange={(e) => setVacationNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="p-2.5 rounded-lg bg-muted/40 border text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500" /> {ar ? "تأثير الإجراء:" : "Action Effect:"}
              </p>
              <p>• {ar ? "سيتحول الموظف إلى حالة 'في إجازة' مع حفظ التواريخ." : "Employee status will change to Vacation with dates saved."}</p>
              <p>• {ar ? "ستتحول غرفته تلقائياً إلى 'مشغولة - إجازة' ويبقى سريره محجوزاً له." : "Room will automatically switch to Occupied Vacation holding his bed."}</p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setVacationDialog({ open: false, emp: null })}
                disabled={vacationSubmitting}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleConfirmVacation}
                disabled={vacationSubmitting || !vacationStartDate || !vacationEndDate}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-semibold"
              >
                <Palmtree className="w-4 h-4" />
                {vacationSubmitting
                  ? ar
                    ? "جاري الحفظ..."
                    : "Saving..."
                  : ar
                    ? "تأكيد الإجازة"
                    : "Confirm Vacation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog
        open={transferDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setTransferDialog({ open: false, id: null });
            setTransferRoomId("");
            setSelectedTransferBed("");
            setRoomSearch("");
            setTransferPropertyId("");
          }
        }}
      >
        <DialogContent
          className="max-w-md"
          srTitle={ar ? "نقل لغرفة جديدة" : "Room Move"}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              {ar ? "نقل لغرفة جديدة" : "Room Move"}
            </DialogTitle>
          </DialogHeader>
          {transferDialog.emp && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 -mt-2">
              <EmpAvatar emp={transferDialog.emp} />
              <div>
                <p className="font-semibold text-sm">
                  {transferDialog.emp.firstName} {transferDialog.emp.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {transferDialog.emp.profileId}
                </p>
              </div>
            </div>
          )}
          <div className="space-y-4 pt-1">
            {/* Cross-property transfer for super_admin or users with accommodation.transfer */}
            {(isSuperAdmin || can("accommodation", "transfer")) && contextProperties.length > 1 && (
              <div className="space-y-1.5">
                <Label>{ar ? "الفرع المستهدف" : "Target Property"}</Label>
                <Select
                  value={transferPropertyId || String(activePropertyId ?? "")}
                  onValueChange={(v) => {
                    setTransferPropertyId(v);
                    setTransferRoomId("");
                    setRoomSearch("");
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue
                      placeholder={
                        ar ? "اختر الفرع..." : "Select property..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {contextProperties.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        <span className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          {p.name}
                          {p.id === activePropertyId && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] py-0 px-1 ml-1"
                            >
                              {ar ? "حالي" : "current"}
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                {ar ? "الغرفة الجديدة" : "New Room"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder={ar ? "بحث عن غرفة..." : "Search room..."}
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                />
              </div>
              <div className="border rounded-lg max-h-52 overflow-y-auto">
                {filteredTransferRooms.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground text-center">
                    {ar ? "لا توجد غرف متاحة" : "No available rooms"}
                  </p>
                ) : (
                  filteredTransferRooms.map((r) => {
                    const building = targetBuildingMap[r.buildingId];
                    const isSelected = transferRoomId === String(r.id);
                    const available =
                      (r.capacity ?? 1) - (r.currentOccupancy ?? 0);
                    const rec = transferRecommendations.recommendedMap[r.id];
                    const isConflict = rec && rec.score < 0;
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          setTransferRoomId(String(r.id));
                          setSelectedTransferBed("");
                        }}
                        className={`w-full text-left px-3 py-2.5 flex items-center justify-between border-b last:border-0 transition-colors ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"}`}
                      >
                        <div className="flex flex-col text-left gap-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-semibold">
                              {r.roomNumber}
                            </span>
                            {building && (
                              <span className="text-xs text-muted-foreground">
                                {building}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground capitalize">
                              {r.roomType}
                            </span>
                            {rec?.badgeLabelAr && (
                              <Badge className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 text-[10px] px-1.5 py-0 font-medium">
                                🤖 {ar ? rec.badgeLabelAr : rec.badgeLabelEn}
                              </Badge>
                            )}
                          </div>
                          {isConflict && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              {ar ? "تحذير: مخالفة سياسة التسكين" : "Warning: Conflicts with policy"}
                            </span>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs ml-2 shrink-0">
                          <BedDouble className="w-3 h-3 mr-1" />
                          {available}/{r.capacity}
                        </Badge>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {transferRoomId && bedOptions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <BedDouble className="w-4 h-4 text-muted-foreground" />
                  {ar ? "السرير في الغرفة الجديدة" : "Bed in New Room"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {bedOptions.map((bed) => {
                    const isTaken = targetOccupiedBeds.has(bed);
                    const isSelected = selectedTransferBed === String(bed);
                    return (
                      <button
                        key={bed}
                        type="button"
                        onClick={() =>
                          !isTaken && setSelectedTransferBed(String(bed))
                        }
                        disabled={isTaken}
                        title={
                          isTaken
                            ? ar
                              ? "هذا السرير مشغول"
                              : "Bed already occupied"
                            : undefined
                        }
                        className={`relative px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                          isTaken
                            ? "bg-red-50 border-red-200 text-red-400 dark:bg-red-950/30 dark:border-red-800 dark:text-red-500 cursor-not-allowed opacity-70"
                            : isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-card hover:bg-muted border-border"
                        }`}
                      >
                        {ar ? `سرير ${bed}` : `Bed ${bed}`}
                        {isTaken && (
                          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                            <X className="w-2.5 h-2.5 text-white" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedTransferBed && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    {ar
                      ? `تم اختيار سرير ${selectedTransferBed}`
                      : `Bed ${selectedTransferBed} selected`}
                  </p>
                )}
              </div>
            )}

            {/* Cross-property transfer profile fate choice */}
            {transferPropertyId && String(transferPropertyId) !== String(activePropertyId) && (
              <div className="p-3 rounded-xl border-2 border-amber-500/50 bg-amber-50/70 dark:bg-amber-950/30 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <ArrowRightLeft className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold">
                    {ar ? "نقل موظف إلى فرع/فندق آخر (Cross-Property Transfer)" : "Cross-Property Transfer"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {ar
                    ? "سيتم تسجيل خروج الموظف من غرفته الحالية وتحرير سريره مع حفظ كافة سجلات الغرف التاريخية 100%."
                    : "Resident will be checked out and their bed released, with 100% room logs preserved."}
                </p>

                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-bold text-foreground">
                    {ar ? "ماذا تريد أن تفعل بملف الموظف في هذا الفندق؟" : "What should happen to the profile in this hotel?"}
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTransferArchiveSource(true)}
                      className={`p-2.5 rounded-lg border text-start transition-all cursor-pointer ${
                        transferArchiveSource ? "bg-primary/10 border-primary ring-1 ring-primary/30 shadow-2xs" : "bg-background border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {ar ? "1. نقله وحذفه من هنا" : "1. Transfer & Archive Here"}
                        </span>
                        {transferArchiveSource && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {ar ? "أرشفة الملف هنا لعدم التكرار، مع بقاء كل لوج الغرف 100%." : "Archive profile here to avoid duplicates, keeping all room logs."}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransferArchiveSource(false)}
                      className={`p-2.5 rounded-lg border text-start transition-all cursor-pointer ${
                        !transferArchiveSource ? "bg-primary/10 border-primary ring-1 ring-primary/30 shadow-2xs" : "bg-background border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {ar ? "2. نقله وتسيب البروفايل هنا" : "2. Keep Profile Active Here"}
                        </span>
                        {!transferArchiveSource && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {ar ? "إبقاء الملف متاحاً ونشطاً في هذا الفندق أيضاً (انتداب / فرعين)." : "Keep profile active in this hotel too (secondment / dual work)."}
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{ar ? "سبب النقل" : "Transfer Reason"}</Label>
              <Textarea
                placeholder={ar ? "سبب النقل..." : "Reason for transfer..."}
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setTransferDialog({ open: false, id: null })}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={transferMutation.isPending || !transferRoomId}
              >
                {transferMutation.isPending
                  ? ar
                    ? "جاري النقل..."
                    : "Moving..."
                  : ar
                    ? "تأكيد النقل"
                    : "Confirm Move"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Policy Exception Approval Modal */}
      <PolicyExceptionApprovalModal
        open={transferPolicyModal.open}
        onOpenChange={(open) =>
          setTransferPolicyModal((prev) => ({ ...prev, open }))
        }
        titleAr="اعتماد استثناء لنقل الموظف لغرفة تخالف السياسات"
        titleEn="Approve Policy Exception for Room Move"
        violations={transferPolicyModal.violations}
        isLoading={transferMutation.isPending}
        onConfirm={(approval) => {
          setTransferPolicyModal({ open: false, violations: [] });
          handleTransfer(approval);
        }}
      />

      {/* Re-issue Key Dialog */}
      <Dialog
        open={reissueDialog.open}
        onOpenChange={(open) => {
          if (!open && reissueIssuing) return;
          setReissueDialog({
            open,
            assignment: open ? reissueDialog.assignment : null,
            emp: open ? reissueDialog.emp : null,
            room: open ? reissueDialog.room : null,
          });
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-600" />
              {ar ? "إعادة إصدار مفتاح" : "Re-issue Key Card"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {reissueDialog.emp && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-semibold">
                  {reissueDialog.emp.firstName} {reissueDialog.emp.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ar ? "الغرفة" : "Room"}: {reissueDialog.room?.roomNumber} —{" "}
                  {ar ? "السرير" : "Bed"}:{" "}
                  {reissueDialog.assignment?.bedNumber || "—"}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">
                {ar ? "سبب إعادة الإصدار" : "Reason"}
              </Label>
              <Input
                className="h-8 text-xs"
                placeholder={ar ? "مثال: المفتاح ضائع" : "e.g., Key lost"}
                value={reissueNotes}
                onChange={(e) => setReissueNotes(e.target.value)}
              />
            </div>
            {reissueDialog.assignment &&
              reissueDialog.room &&
              activePropertyId && (
                <KeyManagementPanel
                  propertyId={activePropertyId}
                  roomId={reissueDialog.assignment.roomId}
                  assignmentId={reissueDialog.assignment.id}
                  profileId={reissueDialog.assignment.profileId}
                  defaultCardType="guest"
                  notes={
                    reissueNotes ||
                    (ar ? "إعادة إصدار - مفتاح ضائع" : "Re-issue - lost key")
                  }
                  onIssuingChange={setReissueIssuing}
                  onIssueComplete={() => {
                    invalidate();
                    toast.success(
                      ar
                        ? "تم إصدار المفاتيح بنجاح"
                        : "Keys issued successfully",
                    );
                  }}
                />
              )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={reissueIssuing}
                onClick={() =>
                  setReissueDialog({
                    open: false,
                    assignment: null,
                    emp: null,
                    room: null,
                  })
                }
              >
                {ar ? "إغلاق" : "Close"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Profile Popup */}
      <ProfileProfilePopup
        profileId={profileEmpId}
        propertyId={activePropertyId}
        onClose={() => setProfileEmpId(null)}
      />

      {/* Print Housing Letter prompt after transfer */}
      {printAfterTransfer && (
        <Dialog
          open={!!printAfterTransfer}
          onOpenChange={(open) => {
            if (!open) setPrintAfterTransfer(null);
          }}
        >
          <DialogContent
            className="max-w-sm"
            srTitle={ar ? "طباعة خطاب السكن" : "Print Housing Letter"}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Printer className="w-4 h-4 text-primary" />
                {ar ? "خطاب السكن" : "Housing Letter"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {ar
                ? `تم نقل ${printAfterTransfer.emp?.firstName || ""} ${printAfterTransfer.emp?.lastName || ""} بنجاح. هل تريد طباعة خطاب السكن للغرفة الجديدة؟`
                : `${printAfterTransfer.emp?.firstName || ""} ${printAfterTransfer.emp?.lastName || ""} transferred. Print housing letter for the new room?`}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPrintAfterTransfer(null)}
              >
                {ar ? "تخطي" : "Skip"}
              </Button>
              <Button
                size="sm"
                className="gap-1"
                onClick={() => {
                  printHousingLetter(
                    printAfterTransfer.assignment,
                    printAfterTransfer.emp,
                  );
                  setPrintAfterTransfer(null);
                }}
              >
                <Printer className="w-3.5 h-3.5" />
                {ar ? "طباعة" : "Print"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <PrintLanguageDialog
        open={langDialogOpen}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />

      {/* Broadcast WhatsApp Dialog */}
      <BroadcastWhatsAppDialog
        open={broadcastOpen}
        onOpenChange={setBroadcastOpen}
        propertyId={activePropertyId}
        initialTargetMode={broadcastTargetMode}
        selectedProfileIds={selectedProfileIds}
        language={language}
      />

      <GatePassModal
        profileId={selectedGatePassProfileId}
        isOpen={gatePassOpen}
        onClose={() => setGatePassOpen(false)}
        language={language}
      />
    </div>
  );
}
