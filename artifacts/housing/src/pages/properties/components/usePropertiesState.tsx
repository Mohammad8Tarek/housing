// State, effects and handlers of Properties (moved verbatim).
import * as XLSX from "xlsx";
import { getExportFileName } from "@/lib/date-utils";
import { detectColumnField, validateAndNormalizeRows } from "@/lib/room-importer-engine";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProperties,
  useCreateProperty,
  useUpdateProperty,
  useDeleteProperty,
  useListUsers,
  getListPropertiesQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { useRef } from "react";
import { useColumnVisibility } from "@/components/ui/column-chooser";
import { PropertyForm, EMPTY_FORM } from "./index.constants";

export function usePropertiesState() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const ar = language === "ar";

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PropertyForm>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState("general");
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    id: 0,
  });
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [selectedPropForImport, setSelectedPropForImport] = useState<any>(null);
  const [selectedPropForDetails, setSelectedPropForDetails] = useState<any | null>(null);

  // Property creation housing import state
  const [housingConfigFile, setHousingConfigFile] = useState<File | null>(null);
  const [housingConfigParsedRows, setHousingConfigParsedRows] = useState<any[]>([]);
  const [housingConfigStats, setHousingConfigStats] = useState<{
    roomsCount: number;
    floorsCount: number;
    buildingsCount: number;
    bedsCount: number;
  } | null>(null);
  const housingFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // User Assignment Mode state for property creation/editing
  const [userAssignMode, setUserAssignMode] = useState<"assign_existing" | "create_new" | "none">("assign_existing");
  const [selectedExistingUserIds, setSelectedExistingUserIds] = useState<number[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const { data: properties, isLoading } = useListProperties();
  const { data: allUsersRes } = useListUsers({ limit: 1000 } as any);
  const allUsers: any[] = Array.isArray(allUsersRes) ? allUsersRes : ((allUsersRes as any)?.data || []);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });

  const createMutation = useCreateProperty({
    mutation: {
      onSuccess: async (createdRes: any) => {
        invalidate();
        const createdProp = createdRes?.data || createdRes;
        const newPropId = createdProp?.id;

        if (newPropId && housingConfigParsedRows.length > 0) {
          try {
            const toastId = toast.loading(
              ar
                ? "جاري استيراد وتكوين المباني والغرف في السكن الجديد..."
                : "Setting up buildings & rooms in new property..."
            );
            const impRes = await fetch("/api/rooms/import/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                propertyId: newPropId,
                importMode: "create_update",
                fileName: housingConfigFile?.name || "initial_config.xlsx",
                rooms: housingConfigParsedRows,
              }),
            });
            if (impRes.ok) {
              const resJson = await impRes.json();
              toast.success(
                ar
                  ? `تم إنشاء السكن بنجاح واستيراد ${resJson.createdRows || housingConfigParsedRows.length} غرفة وجميع أدوارها وأسرتها!`
                  : `Property created with ${resJson.createdRows || housingConfigParsedRows.length} rooms & beds!`,
                { id: toastId }
              );
            } else {
              toast.error(ar ? "تم إنشاء السكن، ولكن فشل استيراد الغرف تلقائياً" : "Property created, but room import failed", { id: toastId });
            }
          } catch (e: any) {
            console.error("Room import error on property creation:", e);
          }
        } else {
          toast.success(ar ? "تم إنشاء العقار بنجاح" : "Property created successfully");
        }

        setHousingConfigFile(null);
        setHousingConfigParsedRows([]);
        setHousingConfigStats(null);
        closeDialog();
      },
      onError: (e: any) =>
        toast.error(ar ? "خطأ" : "Error", {
          description: e.message,
        }),
    },
  });

  const updateMutation = useUpdateProperty({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم التحديث" : "Property updated");
        closeDialog();
      },
      onError: (e: any) =>
        toast.error(ar ? "خطأ" : "Error", {
          description: e.message,
        }),
    },
  });

  const deleteMutation = useDeleteProperty({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم حذف العقار" : "Property deleted");
      },
    },
  });

    const handleHousingConfigFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const f = files[0];
    setHousingConfigFile(f);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const firstSheet = wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[firstSheet], { defval: "" });
        if (rows.length === 0) return;

        const headers = Object.keys(rows[0] || {});
        const mapping: Record<string, any> = {};
        headers.forEach((h) => {
          mapping[h] = detectColumnField(h);
        });

        const validation = validateAndNormalizeRows({
          rows,
          columnMapping: mapping,
        });

        const validRooms = validation.processedRows
          .filter((r) => r.isValid)
          .map((r) => r.normalizedRoom);

        setHousingConfigParsedRows(validRooms);

        const uniqueFloors = new Set(validRooms.map((r) => r.floor).filter(Boolean));
        const uniqueBuildings = new Set(validRooms.map((r) => r.building).filter(Boolean));
        const totalBeds = validRooms.reduce((sum, r) => sum + (r.capacity || 1), 0);

        setHousingConfigStats({
          roomsCount: validRooms.length,
          floorsCount: Math.max(1, uniqueFloors.size),
          buildingsCount: Math.max(1, uniqueBuildings.size),
          bedsCount: totalBeds,
        });

        toast.success(
          ar
            ? `تم تحليل الملف بنجاح: ${validRooms.length} غرفة جاهزة للإنشاء!`
            : `Detected ${validRooms.length} rooms ready for setup!`
        );
      } catch (err: any) {
        toast.error(ar ? "فشل قراءة ملف التكوين: " + err.message : "Failed to read config file");
      }
    };
    reader.readAsBinaryString(f);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setActiveTab("general");
    setShowAdminPass(false);
    setUserAssignMode("assign_existing");
    setSelectedExistingUserIds([]);
    setUserSearchQuery("");
    setHousingConfigFile(null);
    setHousingConfigParsedRows([]);
    setHousingConfigStats(null);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setActiveTab("general");
    setUserAssignMode("assign_existing");
    setSelectedExistingUserIds([]);
    setUserSearchQuery("");
    setIsOpen(true);
  };

  const openEdit = (prop: any, initialTab = "general") => {
    setForm({
      name: prop.name ?? "",
      code: prop.code ?? "",
      displayName: prop.displayName ?? "",
      status: prop.status ?? "active",
      defaultLanguage: prop.defaultLanguage ?? "en",
      primaryColor: prop.primaryColor ?? "#0F2A44",
      description: prop.description ?? "",
      adminUsername: "",
      adminPassword: "",
      logo: prop.logo ?? "",
      hrContact1Name: prop.hrContact1Name ?? "",
      hrContact1Title: prop.hrContact1Title ?? "",
      hrContact1Phone: prop.hrContact1Phone ?? "",
      hrContact1Email: prop.hrContact1Email ?? "",
      hrContact2Name: prop.hrContact2Name ?? "",
      hrContact2Title: prop.hrContact2Title ?? "",
      hrContact2Phone: prop.hrContact2Phone ?? "",
      hrContact2Email: prop.hrContact2Email ?? "",
      housingManager1Name: prop.housingManager1Name ?? "",
      housingManager1Title: prop.housingManager1Title ?? "",
      housingManager1Phone: prop.housingManager1Phone ?? "",
      housingManager1Email: prop.housingManager1Email ?? "",
      housingManager2Name: prop.housingManager2Name ?? "",
      housingManager2Title: prop.housingManager2Title ?? "",
      housingManager2Phone: prop.housingManager2Phone ?? "",
      housingManager2Email: prop.housingManager2Email ?? "",
    });
    setEditingId(prop.id);
    setActiveTab(initialTab);
    setUserAssignMode("assign_existing");
    const currentAssigned = (allUsers || [])
      .filter((u: any) => (u.propertyIds || []).includes(prop.id) || u.propertyId === prop.id)
      .map((u: any) => u.id);
    setSelectedExistingUserIds(currentAssigned);
    setUserSearchQuery("");
    setIsOpen(true);
  };

  const onSubmit = () => {
    if (!form.name.trim()) {
      toast.error(ar ? "اسم العقار مطلوب" : "Property name is required");
      return;
    }
    if (!form.code.trim()) {
      toast.error(ar ? "كود العقار مطلوب" : "Property code is required");
      return;
    }

    // Validate admin user fields if creating new
    if (userAssignMode === "create_new") {
      if (form.adminUsername || form.adminPassword) {
        if (!form.adminUsername.trim()) {
          toast.error(ar ? "اسم المستخدم مطلوب" : "Admin username is required");
          return;
        }
        if (!form.adminPassword.trim() || form.adminPassword.length < 6) {
          toast.error(
            ar
              ? "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل"
              : "Password must be at least 6 characters",
          );
          return;
        }
      }
    }

    const payload: any = {
      name: form.name,
      code: form.code.toUpperCase(),
      displayName: form.displayName || undefined,
      status: form.status,
      defaultLanguage: form.defaultLanguage,
      primaryColor: form.primaryColor,
      logo: form.logo || undefined,
      hrContact1Name: form.hrContact1Name || null,
      hrContact1Title: form.hrContact1Title || null,
      hrContact1Phone: form.hrContact1Phone || null,
      hrContact1Email: form.hrContact1Email || null,
      hrContact2Name: form.hrContact2Name || null,
      hrContact2Title: form.hrContact2Title || null,
      hrContact2Phone: form.hrContact2Phone || null,
      hrContact2Email: form.hrContact2Email || null,
      housingManager1Name: form.housingManager1Name || null,
      housingManager1Title: form.housingManager1Title || null,
      housingManager1Phone: form.housingManager1Phone || null,
      housingManager1Email: form.housingManager1Email || null,
      housingManager2Name: form.housingManager2Name || null,
      housingManager2Title: form.housingManager2Title || null,
      housingManager2Phone: form.housingManager2Phone || null,
      housingManager2Email: form.housingManager2Email || null,
    };

    if (userAssignMode === "create_new" && form.adminUsername && form.adminPassword) {
      payload.adminUsername = form.adminUsername.trim();
      payload.adminPassword = form.adminPassword;
    } else if (userAssignMode === "assign_existing") {
      if (selectedExistingUserIds.length > 0) {
        payload.assignedUserIds = selectedExistingUserIds;
      }
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const PROP_COLS = [
    { key: "name", label: "Name", labelAr: "الاسم", defaultVisible: true },
    { key: "code", label: "Code", labelAr: "الكود", defaultVisible: true },
    {
      key: "displayname",
      label: "Display Name",
      labelAr: "اسم العرض",
      defaultVisible: true,
    },
    {
      key: "hrContacts",
      label: "HR Management",
      labelAr: "إدارة الموارد البشرية",
      defaultVisible: true,
    },
    {
      key: "housingManagers",
      label: "Housing Management",
      labelAr: "إدارة السكن",
      defaultVisible: true,
    },
    {
      key: "language",
      label: "Language",
      labelAr: "اللغة",
      defaultVisible: false,
    },
    { key: "color", label: "Color", labelAr: "اللون", defaultVisible: false },
    { key: "status", label: "Status", labelAr: "الحالة", defaultVisible: true },
    {
      key: "actions",
      label: "Actions",
      labelAr: "الإجراءات",
      defaultVisible: true,
      fixed: true,
    },
  ];
  const {
    visible: propVisible,
    toggle: propToggle,
    showAll: propShowAll,
    hideAll: propHideAll,
    isVisible: isPropVisible,
  } = useColumnVisibility(PROP_COLS);

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const propList: any[] = properties || [];
  const allPropSelected =
    propList.length > 0 && propList.every((p) => selectedRows.has(p.id));
  const toggleSelectAllProp = () => {
    if (allPropSelected) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        propList.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        propList.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };
  const togglePropRow = (id: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const exportPropExcel = () => {
    const target =
      selectedRows.size > 0
        ? propList.filter((p) => selectedRows.has(p.id))
        : propList;
    const rows = target.map((p) => ({
      Name: p.name,
      Code: p.code,
      "Display Name": p.displayName ?? "",
      "HR Manager Name": p.hrContact1Name ?? "",
      "HR Manager Title": p.hrContact1Title ?? "",
      "HR Manager Phone": p.hrContact1Phone ?? "",
      "HR Manager Email": p.hrContact1Email ?? "",
      "Assistant HR Manager Name": p.hrContact2Name ?? "",
      "Assistant HR Manager Title": p.hrContact2Title ?? "",
      "Assistant HR Manager Phone": p.hrContact2Phone ?? "",
      "Assistant HR Manager Email": p.hrContact2Email ?? "",
      "Housing Manager Name": p.housingManager1Name ?? "",
      "Housing Manager Title": p.housingManager1Title ?? "",
      "Housing Manager Phone": p.housingManager1Phone ?? "",
      "Housing Manager Email": p.housingManager1Email ?? "",
      "Assistant Housing Manager Name": p.housingManager2Name ?? "",
      "Assistant Housing Manager Title": p.housingManager2Title ?? "",
      "Assistant Housing Manager Phone": p.housingManager2Phone ?? "",
      "Assistant Housing Manager Email": p.housingManager2Email ?? "",
      Language: p.defaultLanguage ?? "",
      Status: p.status ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Properties");
    XLSX.writeFile(wb, getExportFileName("Properties", "xlsx"));
  };
  return {
    language,
    queryClient,
    ar,
    isOpen,
    setIsOpen,
    editingId,
    setEditingId,
    form,
    setForm,
    activeTab,
    setActiveTab,
    showAdminPass,
    setShowAdminPass,
    deleteDialog,
    setDeleteDialog,
    importWizardOpen,
    setImportWizardOpen,
    selectedPropForImport,
    setSelectedPropForImport,
    selectedPropForDetails,
    setSelectedPropForDetails,
    housingConfigFile,
    setHousingConfigFile,
    housingConfigParsedRows,
    setHousingConfigParsedRows,
    housingConfigStats,
    setHousingConfigStats,
    housingFileInputRef,
    logoFileRef,
    userAssignMode,
    setUserAssignMode,
    selectedExistingUserIds,
    setSelectedExistingUserIds,
    userSearchQuery,
    setUserSearchQuery,
    properties,
    isLoading,
    allUsersRes,
    allUsers,
    invalidate,
    createMutation,
    updateMutation,
    deleteMutation,
    handleHousingConfigFile,
    closeDialog,
    openCreate,
    openEdit,
    onSubmit,
    isPending,
    PROP_COLS,
    propVisible,
    propToggle,
    propShowAll,
    propHideAll,
    isPropVisible,
    selectedRows,
    setSelectedRows,
    propList,
    allPropSelected,
    toggleSelectAllProp,
    togglePropRow,
    exportPropExcel,
  };
}

export type PropertiesState = ReturnType<typeof usePropertiesState>;
