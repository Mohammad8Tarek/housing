import { useState, useMemo, useEffect } from "react";
import {
  useListInHouseAssignments,
  useListBuildings,
  useListFloors,
  useCheckoutAssignment,
  useTransferAssignment,
  useGetSettings,
  useListProperties,
  getListInHouseAssignmentsQueryKey,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { checkPolicyCompliance } from "@/lib/room-recommender";
import {
  PolicyExceptionApprovalModal,
  type PolicyViolationItem,
} from "@/components/PolicyExceptionApprovalModal";
import { GatePassModal } from "../GatePassModal";
import { BroadcastWhatsAppDialog } from "@/components/BroadcastWhatsAppDialog";
import { useColumnVisibility } from "@/components/ui/column-chooser";
import { ProfileProfilePopup } from "@/components/ui/profile-profile-popup";
import { formatDate } from "@/lib/date-utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePrintLanguage,
  PrintLanguageDialog,
} from "@/lib/PrintLanguageDialog";
import { usePermission } from "@/hooks/use-permission";
import { useAllRows } from "@/lib/use-all-rows";

import { CHECKOUT_REASONS, IH_COLS } from "./utils/constants";
import {
  exportSelectedExcel,
  exportSelectedPdf,
} from "./utils/export-selected";
import { printHousingLetterFor } from "./utils/housing-letter";
import { useTransferTarget } from "./hooks/useTransferTarget";
import { InHouseToolbar } from "./components/InHouseToolbar";
import { InHouseTable } from "./components/InHouseTable";
import type { RowActions } from "./components/InHouseTableRow";
import {
  WhatsAppDialog,
  type WhatsAppDialogState,
} from "./components/WhatsAppDialog";
import {
  ExtendStayDialog,
  type ExtendDialogState,
} from "./components/ExtendStayDialog";
import {
  CheckoutDialog,
  type CheckoutDialogState,
} from "./components/CheckoutDialog";
import { BulkExtendDialog } from "./components/BulkExtendDialog";
import { BulkCheckoutDialog } from "./components/BulkCheckoutDialog";
import {
  VacationDialog,
  type VacationDialogState,
} from "./components/VacationDialog";
import {
  TransferDialog,
  type TransferDialogState,
} from "./components/TransferDialog";
import {
  ReissueKeyDialog,
  type ReissueDialogState,
} from "./components/ReissueKeyDialog";
import {
  PrintAfterTransferDialog,
  type PrintAfterTransferState,
} from "./components/PrintAfterTransferDialog";

export { CHECKOUT_REASONS };

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

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [bulkCheckoutOpen, setBulkCheckoutOpen] = useState(false);
  const [bulkCheckoutLoading, setBulkCheckoutLoading] = useState(false);
  const [bulkCheckoutNotes, setBulkCheckoutNotes] = useState("");
  const [bulkCheckoutReason, setBulkCheckoutReason] = useState("");
  const [checkoutDialog, setCheckoutDialog] = useState<CheckoutDialogState>({
    open: false,
    id: null,
  });
  const [vacationDialog, setVacationDialog] = useState<VacationDialogState>({
    open: false,
    emp: null,
  });
  const [vacationStartDate, setVacationStartDate] = useState(
    new Date().toISOString().split("T")[0],
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

  const [transferDialog, setTransferDialog] = useState<TransferDialogState>({
    open: false,
    id: null,
  });
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
  const [transferArchiveSource, setTransferArchiveSource] =
    useState<boolean>(true);
  const [profileEmpId, setProfileEmpId] = useState<number | null>(null);
  const [transferPolicyModal, setTransferPolicyModal] = useState<{
    open: boolean;
    violations: PolicyViolationItem[];
  }>({ open: false, violations: [] });

  // Re-issue key state
  const [reissueDialog, setReissueDialog] = useState<ReissueDialogState>({
    open: false,
    assignment: null,
    emp: null,
    room: null,
  });
  const [reissueNotes, setReissueNotes] = useState("");
  const [reissueIssuing, setReissueIssuing] = useState(false);
  const [printAfterTransfer, setPrintAfterTransfer] =
    useState<PrintAfterTransferState>(null);

  // Extend stay state
  const [extendDialog, setExtendDialog] = useState<ExtendDialogState>({
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
  const [whatsAppDialog, setWhatsAppDialog] = useState<WhatsAppDialogState>({
    open: false,
    assignmentId: null,
    emp: null,
  });

  // Gate Pass modal state
  const [gatePassOpen, setGatePassOpen] = useState(false);
  const [selectedGatePassProfileId, setSelectedGatePassProfileId] = useState<
    number | null
  >(null);
  const [whatsAppPhone, setWhatsAppPhone] = useState("");
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Broadcast WhatsApp state
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTargetMode, setBroadcastTargetMode] = useState<
    "all" | "selected"
  >("all");

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
      toast.error(
        ar
          ? "يرجى إدخال رقم هاتف الواتساب للموظف"
          : "Please enter a valid WhatsApp phone number",
      );
      return;
    }
    setIsSendingWhatsApp(true);
    try {
      const res = await fetch(
        `/api/assignments/${whatsAppDialog.assignmentId}/send-whatsapp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: activePropertyId,
            phone: whatsAppPhone.trim(),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(
          data.error ||
            (ar
              ? "فشل إرسال رسالة الواتساب"
              : "Failed to send WhatsApp message"),
        );
      }
      toast.success(
        data.message ||
          (ar
            ? "تم إرسال رسالة التسكين عبر الواتساب بنجاح!"
            : "WhatsApp welcome message sent successfully!"),
      );
      setWhatsAppDialog((prev) => ({ ...prev, open: false }));
      queryClient.invalidateQueries({
        queryKey: getListInHouseAssignmentsQueryKey({
          propertyId: activePropertyId as any,
        }),
      });
    } catch (err: any) {
      toast.error(
        err.message ||
          (ar ? "فشل إرسال رسالة الواتساب" : "Failed to send WhatsApp message"),
      );
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const numericPropertyId =
    typeof activePropertyId === "number" ? activePropertyId : undefined;
  const { data: _pData } = useListProperties();
  const allProperties: any[] = Array.isArray(_pData)
    ? _pData
    : ((_pData as any)?.data as any[]) || [];
  const { data: settings } = useGetSettings(
    { propertyId: numericPropertyId },
    {
      query: {
        queryKey: ["getSettings", numericPropertyId],
        enabled: !!numericPropertyId,
      } as any,
    },
  );
  const activeProp = allProperties.find((p: any) => p.id === activePropertyId);

  const { data: assignmentsRes, isLoading } = useListInHouseAssignments(
    {
      propertyId: numericPropertyId as any,
      page: currentPage,
      limit: pageSize,
      search: debouncedSearch || undefined,
    },
    {
      query: {
        queryKey: getListInHouseAssignmentsQueryKey({
          propertyId: numericPropertyId as any,
          page: currentPage,
          limit: pageSize,
          search: debouncedSearch || undefined,
        }),
        enabled: !!numericPropertyId,
      },
    },
  );
  const assignments: any[] = Array.isArray(assignmentsRes)
    ? assignmentsRes
    : ((assignmentsRes as any)?.data as any[]) || [];
  const total = Array.isArray(assignmentsRes)
    ? assignmentsRes.length
    : (((assignmentsRes as any)?.pagination?.total as number) ??
      assignments.length);

  const selectedProfileIds = useMemo(() => {
    return Array.from(selectedRows)
      .map((id) => {
        const a = (assignments || []).find((x: any) => x.id === id);
        return a?.profileId ? Number(a.profileId) : null;
      })
      .filter((id): id is number => id !== null);
  }, [selectedRows, assignments]);

  const { data: _eDataWrapper } = useAllRows(
    "/api/profiles",
    { propertyId: numericPropertyId ?? undefined },
    { enabled: !!numericPropertyId },
  );
  const profiles: any[] = Array.isArray(_eDataWrapper)
    ? _eDataWrapper
    : ((_eDataWrapper as any)?.profiles as any[]) ||
      ((_eDataWrapper as any)?.data as any[]) ||
      [];
  const { data: _rData } = useAllRows(
    "/api/rooms",
    { propertyId: numericPropertyId },
    { enabled: !!numericPropertyId, staleTime: 60000 },
  );
  const rooms: any[] = Array.isArray(_rData)
    ? _rData
    : ((_rData as any)?.data as any[]) || [];
  const { data: _bData } = useListBuildings(
    { propertyId: numericPropertyId } as any,
    {
      query: {
        queryKey: ["listBuildings", numericPropertyId],
        enabled: !!numericPropertyId,
        staleTime: 300000,
      } as any,
    },
  );
  const buildings: any[] = Array.isArray(_bData)
    ? _bData
    : ((_bData as any)?.data as any[]) || [];
  const { data: _fData } = useListFloors(
    { propertyId: numericPropertyId } as any,
    {
      query: {
        queryKey: ["listFloors", numericPropertyId],
        enabled: !!numericPropertyId,
        staleTime: 300000,
      } as any,
    },
  );
  const floors: any[] = Array.isArray(_fData)
    ? _fData
    : ((_fData as any)?.data as any[]) || [];

  // Transfer target property data (rooms, beds, recommendations)
  const {
    targetRooms,
    targetAssignments,
    targetBuildingMap,
    targetOccupiedBeds,
    bedOccupantsMap,
    selectedTargetRoom,
    bedOptions,
    transferRecommendations,
    filteredTransferRooms,
  } = useTransferTarget({
    transferPropertyId,
    activePropertyId,
    numericPropertyId,
    transferRoomId,
    transferOpen: transferDialog.open,
    transferEmp: transferDialog.emp,
    selectedTransferBed,
    setSelectedTransferBed,
    roomSearch,
    profiles,
    settings,
    ar,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListInHouseAssignmentsQueryKey({
        propertyId: activePropertyId as any,
      }),
    });
    queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
  };

  const handleConfirmVacation = async () => {
    if (!vacationDialog.emp) return;
    if (!vacationStartDate || !vacationEndDate) {
      toast.error(
        ar
          ? "يرجى تحديد تاريخ البدء وتاريخ الانتهاء"
          : "Please select start and end dates",
      );
      return;
    }
    if (new Date(vacationEndDate) < new Date(vacationStartDate)) {
      toast.error(
        ar
          ? "تاريخ العودة يجب أن يكون بعد تاريخ البدء"
          : "Return date must be after start date",
      );
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
          : `Vacation recorded for ${vacationDialog.emp.firstName}`,
      );
      setVacationDialog({ open: false, emp: null });
      invalidate();
    } catch (err: any) {
      toast.error(
        err.message || (ar ? "فشل تسجيل الإجازة" : "Failed to record vacation"),
      );
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
          : `${emp.firstName} returned from vacation`,
      );
      invalidate();
    } catch {
      toast.error(
        ar ? "فشل تسجيل العودة من الإجازة" : "Failed to record return",
      );
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
      const res = await fetch(
        `/api/assignments/${extendDialog.assignment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedCheckOutDate: extendNewDate,
            notes: extendNotes,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to extend stay");
      }

      toast.success(
        ar
          ? `تم تمديد إقامة ${extendDialog.emp ? `${extendDialog.emp.firstName} ${extendDialog.emp.lastName || ""}` : ""} حتى ${formatDate(extendNewDate)} بنجاح`
          : `Stay extended until ${formatDate(extendNewDate)} successfully`,
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
        setCheckoutDialog({ open: false, id: null, propertyId: undefined });
        setCheckoutNotes("");
        setCheckoutReason("");
      },
      onError: async (e: any) => {
        let msg = e?.message;
        try {
          const body =
            e?.data ||
            (await e?.response
              ?.clone?.()
              ?.json?.()
              .catch(() => null)) ||
            {};
          if (body?.error) msg = body.error;
        } catch {}
        toast.error(msg || (ar ? "فشل تسجيل الخروج" : "Failed to check out"));
      },
    },
  });

  const transferMutation = useTransferAssignment({
    mutation: {
      onSuccess: (data: any) => {
        invalidate();
        const emp = transferDialog.emp;
        const targetRoom = targetRooms.find(
          (r: any) => r.id === parseInt(transferRoomId),
        );
        const isCross = Boolean(
          transferPropertyId &&
          String(transferPropertyId) !== String(activePropertyId),
        );
        if (isCross) {
          queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
          queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        }
        toast.success(
          isCross
            ? ar
              ? "تم نقل الموظف بنجاح إلى الفندق والغرفة الجديدة"
              : "Resident successfully transferred to the new hotel & room"
            : ar
              ? "تم نقل الغرفة بنجاح"
              : "Room Move successful",
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
          const body =
            err?.data ||
            (await err?.response
              ?.clone?.()
              ?.json?.()
              .catch(() => null)) ||
            {};
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

  const empMap = Object.fromEntries(profiles.map((e: any) => [e.id, e]));
  const roomMap = Object.fromEntries(rooms.map((r: any) => [r.id, r]));
  const buildingMap = Object.fromEntries(
    buildings.map((b: any) => [b.id, b.name]),
  );
  const floorMap = Object.fromEntries(
    floors.map((f: any) => [f.id, { name: f.name, number: f.floorNumber }]),
  );
  const lookupMaps = { empMap, roomMap, buildingMap, floorMap };

  // Row selection helpers
  const pagedIds = assignments.map((a: any) => a.id);
  const allPageSelected =
    pagedIds.length > 0 && pagedIds.every((id: any) => selectedRows.has(id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedIds.forEach((id: any) => next.delete(id));
        return next;
      });
    } else {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedIds.forEach((id: any) => next.add(id));
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
      toast.error(
        ar
          ? "يرجى اختيار سبب المغادرة (إلزامي)"
          : "Checkout reason is mandatory",
      );
      return;
    }
    const propId =
      checkoutDialog.propertyId ||
      (activePropertyId !== "all" ? Number(activePropertyId) : undefined);
    checkoutMutation.mutate({
      id: checkoutDialog.id,
      data: {
        checkOutDate: new Date(checkoutDate).toISOString(),
        checkOutReason: checkoutReason,
        notes: checkoutNotes || undefined,
        propertyId: propId,
      } as any,
    });
  };

  const handleExportSelectedExcel = () =>
    exportSelectedExcel({ assignments, selectedRows, ar, ...lookupMaps });

  const handleExportSelectedPdf = () =>
    exportSelectedPdf({
      assignments,
      selectedRows,
      ar,
      ...lookupMaps,
      allProperties,
      numericPropertyId,
      settings,
    });

  const handleBulkCheckout = async () => {
    if (selectedRows.size === 0) return;
    if (!bulkCheckoutReason) {
      toast.error(
        ar
          ? "يرجى اختيار سبب المغادرة الجماعية (إلزامي)"
          : "Bulk checkout reason is mandatory",
      );
      return;
    }
    setBulkCheckoutLoading(true);
    const ids = Array.from(selectedRows);
    let successCount = 0;
    for (const id of ids) {
      try {
        const item = (assignments || []).find((x: any) => x.id === id);
        const itemPropId =
          item?.propertyId ||
          (activePropertyId !== "all" ? Number(activePropertyId) : undefined);
        await checkoutMutation.mutateAsync({
          id,
          data: {
            checkOutDate: new Date().toISOString(),
            checkOutReason: bulkCheckoutReason,
            notes: bulkCheckoutNotes || (ar ? "خروج جماعي" : "Bulk Checkout"),
            propertyId: itemPropId,
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

  const printHousingLetter = async (assignment: any, emp: any) =>
    printHousingLetterFor({
      assignment,
      emp,
      ar,
      ...lookupMaps,
      activeProp,
      settings,
    });

  const handleTransfer = (policyException?: {
    approvedBy: string;
    reason: string;
  }) => {
    if (!transferDialog.id || !transferRoomId) {
      toast.error(ar ? "الرجاء اختيار غرفة" : "Please select a room");
      return;
    }
    if (bedOptions.length > 0 && !selectedTransferBed) {
      toast.error(ar ? "الرجاء اختيار سرير" : "Please select a bed");
      return;
    }
    if (
      selectedTransferBed &&
      targetOccupiedBeds.has(Number(selectedTransferBed))
    ) {
      toast.error(
        ar
          ? "السرير المحدد مشغول بالفعل، يرجى اختيار سرير شاغر"
          : "Selected bed is already occupied, please choose an available bed",
      );
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
        if ((settings as any)?.policyRequireExceptionApproval) {
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

    const targetPropId = transferPropertyId
      ? parseInt(transferPropertyId)
      : undefined;
    const effectiveSourcePropId =
      transferDialog.sourcePropertyId ||
      (activePropertyId !== "all" ? Number(activePropertyId) : undefined);
    const isCross = Boolean(
      targetPropId &&
      effectiveSourcePropId &&
      targetPropId !== effectiveSourcePropId,
    );
    transferMutation.mutate({
      id: transferDialog.id,
      data: {
        newRoomId: parseInt(transferRoomId),
        newBedNumber: selectedTransferBed
          ? parseInt(selectedTransferBed)
          : undefined,
        transferDate: new Date().toISOString(),
        transferReason: transferReason || undefined,
        propertyId: effectiveSourcePropId,
        targetPropertyId: targetPropId,
        archiveSourceProfile: isCross ? transferArchiveSource : undefined,
        hasPolicyException: Boolean(policyException),
        policyApprovedBy: policyException?.approvedBy,
        policyExceptionReason: policyException?.reason,
      } as any,
    });
  };

  const {
    visible: ihVisible,
    toggle: ihToggle,
    showAll: ihShowAll,
    hideAll: ihHideAll,
    isVisible: isIHVisible,
  } = useColumnVisibility(IH_COLS);

  // Per-row action handlers (receive the same emp/room fallbacks the row computes)
  const rowActions: RowActions = {
    onOpenProfile: (profileId) => setProfileEmpId(profileId),
    onExtend: openExtendDialog,
    onReissueKey: (assignment, emp, room) => {
      setReissueNotes("");
      setReissueDialog({
        open: true,
        assignment,
        emp,
        room,
      });
    },
    onPrintLetter: printHousingLetter,
    onGatePass: (profileId) => {
      setSelectedGatePassProfileId(profileId);
      setGatePassOpen(true);
    },
    onReturnFromVacation: handleReturnFromVacation,
    onSetVacation: (emp, room) => {
      const today = new Date().toISOString().split("T")[0];
      setVacationStartDate(today);
      const future = new Date();
      future.setDate(future.getDate() + 14);
      setVacationEndDate(future.toISOString().split("T")[0]);
      setVacationNotes("");
      setVacationDialog({ open: true, emp, room });
    },
    onWhatsApp: handleOpenWhatsAppDialog,
    onCheckout: (a, emp) => {
      setCheckoutDate(new Date().toISOString().split("T")[0]);
      setCheckoutNotes("");
      setCheckoutReason("");
      setCheckoutDialog({
        open: true,
        id: a.id,
        emp: emp || {
          id: a.profileId,
          firstName: a.profileFirstName,
          lastName: a.profileLastName,
        },
        propertyId:
          a.propertyId ||
          (activePropertyId !== "all" ? Number(activePropertyId) : undefined),
      });
    },
    onTransfer: (a, emp) => {
      setTransferRoomId("");
      setSelectedTransferBed("");
      setTransferReason("");
      setRoomSearch("");
      const effectiveItemPropId =
        a.propertyId ||
        (activePropertyId !== "all" ? Number(activePropertyId) : undefined);
      setTransferPropertyId(
        String(effectiveItemPropId || activePropertyId || ""),
      );
      setTransferDialog({
        open: true,
        id: a.id,
        emp: emp || {
          id: a.profileId,
          firstName: a.profileFirstName,
          lastName: a.profileLastName,
        },
        sourcePropertyId: effectiveItemPropId,
      });
    },
  };

  return (
    <div className="space-y-4">
      <InHouseToolbar
        ar={ar}
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setCurrentPage(1);
        }}
        columns={{
          visible: ihVisible,
          toggle: ihToggle,
          showAll: ihShowAll,
          hideAll: ihHideAll,
        }}
        selectedCount={selectedRows.size}
        onClearSelection={() => setSelectedRows(new Set())}
        onExportExcel={handleExportSelectedExcel}
        onExportPDF={handleExportSelectedPdf}
        onBroadcastAll={() => {
          setBroadcastTargetMode("all");
          setBroadcastOpen(true);
        }}
        onBroadcastSelected={() => {
          setBroadcastTargetMode("selected");
          setBroadcastOpen(true);
        }}
        onBulkExtend={() => {
          const defaultDate = new Date();
          defaultDate.setDate(defaultDate.getDate() + 14);
          setBulkExtendDate(defaultDate.toISOString().split("T")[0]);
          setBulkExtendNotes("");
          setBulkExtendOpen(true);
        }}
        onBulkCheckout={() => setBulkCheckoutOpen(true)}
      />

      <InHouseTable
        ar={ar}
        isLoading={isLoading}
        assignments={assignments}
        total={total}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        selectedRows={selectedRows}
        allPageSelected={allPageSelected}
        onToggleSelectAll={toggleSelectAll}
        onToggleRow={toggleRow}
        visibleColumns={ihVisible}
        isIHVisible={isIHVisible}
        {...lookupMaps}
        actions={rowActions}
      />

      {/* WhatsApp Welcome / Check-in Notification Dialog */}
      <WhatsAppDialog
        ar={ar}
        dialog={whatsAppDialog}
        setDialog={setWhatsAppDialog}
        phone={whatsAppPhone}
        setPhone={setWhatsAppPhone}
        isSending={isSendingWhatsApp}
        onSend={handleSendWhatsApp}
      />

      {/* Extend Stay Dialog */}
      <ExtendStayDialog
        ar={ar}
        dialog={extendDialog}
        setDialog={setExtendDialog}
        newDate={extendNewDate}
        setNewDate={setExtendNewDate}
        notes={extendNotes}
        setNotes={setExtendNotes}
        loading={extendLoading}
        applyPreset={applyExtendPreset}
        onConfirm={handleConfirmExtend}
      />

      {/* Checkout Dialog */}
      <CheckoutDialog
        ar={ar}
        dialog={checkoutDialog}
        setDialog={setCheckoutDialog}
        checkoutDate={checkoutDate}
        setCheckoutDate={setCheckoutDate}
        checkoutReason={checkoutReason}
        setCheckoutReason={setCheckoutReason}
        checkoutNotes={checkoutNotes}
        setCheckoutNotes={setCheckoutNotes}
        isPending={checkoutMutation.isPending}
        onConfirm={handleCheckout}
      />

      {/* Bulk Extend Dialog */}
      <BulkExtendDialog
        ar={ar}
        open={bulkExtendOpen}
        setOpen={setBulkExtendOpen}
        selectedCount={selectedRows.size}
        date={bulkExtendDate}
        setDate={setBulkExtendDate}
        notes={bulkExtendNotes}
        setNotes={setBulkExtendNotes}
        loading={bulkExtendLoading}
        applyPreset={applyBulkExtendPreset}
        onConfirm={handleBulkExtend}
      />

      {/* Bulk Checkout Dialog */}
      <BulkCheckoutDialog
        ar={ar}
        open={bulkCheckoutOpen}
        setOpen={setBulkCheckoutOpen}
        selectedCount={selectedRows.size}
        reason={bulkCheckoutReason}
        setReason={setBulkCheckoutReason}
        notes={bulkCheckoutNotes}
        setNotes={setBulkCheckoutNotes}
        loading={bulkCheckoutLoading}
        onConfirm={handleBulkCheckout}
      />

      {/* Vacation Dialog */}
      <VacationDialog
        ar={ar}
        dialog={vacationDialog}
        setDialog={setVacationDialog}
        startDate={vacationStartDate}
        setStartDate={setVacationStartDate}
        endDate={vacationEndDate}
        setEndDate={setVacationEndDate}
        notes={vacationNotes}
        setNotes={setVacationNotes}
        submitting={vacationSubmitting}
        durationDays={vacationDurationDays}
        onConfirm={handleConfirmVacation}
      />

      {/* Transfer Dialog */}
      <TransferDialog
        ar={ar}
        dialog={transferDialog}
        setDialog={setTransferDialog}
        activePropertyId={activePropertyId}
        canCrossProperty={isSuperAdmin || can("accommodation", "transfer")}
        contextProperties={contextProperties}
        transferPropertyId={transferPropertyId}
        setTransferPropertyId={setTransferPropertyId}
        transferRoomId={transferRoomId}
        setTransferRoomId={setTransferRoomId}
        selectedTransferBed={selectedTransferBed}
        setSelectedTransferBed={setSelectedTransferBed}
        roomSearch={roomSearch}
        setRoomSearch={setRoomSearch}
        transferReason={transferReason}
        setTransferReason={setTransferReason}
        transferArchiveSource={transferArchiveSource}
        setTransferArchiveSource={setTransferArchiveSource}
        filteredTransferRooms={filteredTransferRooms}
        targetBuildingMap={targetBuildingMap}
        transferRecommendations={transferRecommendations}
        bedOptions={bedOptions}
        targetOccupiedBeds={targetOccupiedBeds}
        bedOccupantsMap={bedOccupantsMap}
        isPending={transferMutation.isPending}
        onConfirm={() => handleTransfer()}
      />

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
      <ReissueKeyDialog
        ar={ar}
        dialog={reissueDialog}
        setDialog={setReissueDialog}
        notes={reissueNotes}
        setNotes={setReissueNotes}
        issuing={reissueIssuing}
        setIssuing={setReissueIssuing}
        numericPropertyId={numericPropertyId}
        invalidate={invalidate}
      />

      {/* Profile Profile Popup */}
      <ProfileProfilePopup
        profileId={profileEmpId}
        propertyId={numericPropertyId}
        onClose={() => setProfileEmpId(null)}
      />

      {/* Print Housing Letter prompt after transfer */}
      <PrintAfterTransferDialog
        ar={ar}
        state={printAfterTransfer}
        setState={setPrintAfterTransfer}
        printHousingLetter={printHousingLetter}
      />

      <PrintLanguageDialog
        open={langDialogOpen}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />

      {/* Broadcast WhatsApp Dialog */}
      <BroadcastWhatsAppDialog
        open={broadcastOpen}
        onOpenChange={setBroadcastOpen}
        propertyId={numericPropertyId ?? null}
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
