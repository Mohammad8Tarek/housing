import { RoomImportWizard } from "./housing/components/import/RoomImportWizard";
import * as XLSX from "xlsx";
import { getExportFileName } from "@/lib/date-utils";
import {
  detectColumnField,
  validateAndNormalizeRows,
  downloadRoomImportTemplate,
} from "@/lib/room-importer-engine";
import { FileSpreadsheet, CheckCircle2, Download } from "lucide-react";
// @ts-nocheck
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProperties,
  useCreateProperty,
  useUpdateProperty,
  useDeleteProperty,
  getListPropertiesQueryKey,
} from "@workspace/api-client-react";
import { useLanguage } from "@/context/LanguageContext";
import { PermissionGate } from "@/components/ui/permission-gate";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnimatedConfirmModal } from "@/components/shared/AnimatedConfirmModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Edit,
  Trash,
  Plus,
  Building2,
  Globe,
  Palette,
  Shield,
  Eye,
  EyeOff,
  UserPlus,
  Upload,
  X,
  Users,
  Phone,
  Mail,
  MessageCircle,
} from "lucide-react";
import { useRef } from "react";
import {
  ColumnChooser,
  useColumnVisibility,
} from "@/components/ui/column-chooser";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";

type PropertyForm = {
  name: string;
  code: string;
  displayName: string;
  status: string;
  defaultLanguage: string;
  primaryColor: string;
  description: string;
  adminUsername: string;
  adminPassword: string;
  logo: string;
  hrContact1Name: string;
  hrContact1Title: string;
  hrContact1Phone: string;
  hrContact1Email: string;
  hrContact2Name: string;
  hrContact2Title: string;
  hrContact2Phone: string;
  hrContact2Email: string;
  housingManager1Name: string;
  housingManager1Title: string;
  housingManager1Phone: string;
  housingManager1Email: string;
  housingManager2Name: string;
  housingManager2Title: string;
  housingManager2Phone: string;
  housingManager2Email: string;
};

const EMPTY_FORM: PropertyForm = {
  name: "",
  code: "",
  displayName: "",
  status: "active",
  defaultLanguage: "en",
  primaryColor: "#0F2A44",
  description: "",
  adminUsername: "",
  adminPassword: "",
  logo: "",
  hrContact1Name: "",
  hrContact1Title: "",
  hrContact1Phone: "",
  hrContact1Email: "",
  hrContact2Name: "",
  hrContact2Title: "",
  hrContact2Phone: "",
  hrContact2Email: "",
  housingManager1Name: "",
  housingManager1Title: "",
  housingManager1Phone: "",
  housingManager1Email: "",
  housingManager2Name: "",
  housingManager2Title: "",
  housingManager2Phone: "",
  housingManager2Email: "",
};

const statusColor = (s: string) =>
  s === "active"
    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

export default function Properties() {
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

  const { data: properties, isLoading } = useListProperties();

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
    setHousingConfigFile(null);
    setHousingConfigParsedRows([]);
    setHousingConfigStats(null);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setActiveTab("general");
    setIsOpen(true);
  };

  const openEdit = (prop: any) => {
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
    setActiveTab("general");
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

    // Validate admin user fields: if one is filled, both must be filled
    if (!editingId && (form.adminUsername || form.adminPassword)) {
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

    if (form.adminUsername && form.adminPassword) {
      payload.adminUsername = form.adminUsername;
      payload.adminPassword = form.adminPassword;
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
      label: "HR Contacts",
      labelAr: "مسؤولو الموارد البشرية",
      defaultVisible: true,
    },
    {
      key: "housingManagers",
      label: "Housing Managers",
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
      "HR 1 Name": p.hrContact1Name ?? "",
      "HR 1 Title": p.hrContact1Title ?? "",
      "HR 1 Phone": p.hrContact1Phone ?? "",
      "HR 1 Email": p.hrContact1Email ?? "",
      "HR 2 Name": p.hrContact2Name ?? "",
      "HR 2 Title": p.hrContact2Title ?? "",
      "HR 2 Phone": p.hrContact2Phone ?? "",
      "HR 2 Email": p.hrContact2Email ?? "",
      "Housing Mgr 1 Name": p.housingManager1Name ?? "",
      "Housing Mgr 1 Title": p.housingManager1Title ?? "",
      "Housing Mgr 1 Phone": p.housingManager1Phone ?? "",
      "Housing Mgr 1 Email": p.housingManager1Email ?? "",
      "Housing Mgr 2 Name": p.housingManager2Name ?? "",
      "Housing Mgr 2 Title": p.housingManager2Title ?? "",
      "Housing Mgr 2 Phone": p.housingManager2Phone ?? "",
      "Housing Mgr 2 Email": p.housingManager2Email ?? "",
      Language: p.defaultLanguage ?? "",
      Status: p.status ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Properties");
    XLSX.writeFile(wb, getExportFileName("Properties", "xlsx"));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">
            {ar ? "العقارات" : "Properties"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ColumnChooser
            cols={PROP_COLS}
            visible={propVisible}
            onToggle={propToggle}
            onShowAll={propShowAll}
            onHideAll={propHideAll}
          />
          <PermissionGate module="properties" action="create">
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              {ar ? "إضافة عقار" : "Add Property"}
            </Button>
          </PermissionGate>
        </div>
      </div>

      <BulkActionBar
        count={selectedRows.size}
        onClear={() => setSelectedRows(new Set())}
        onExportExcel={exportPropExcel}
        ar={ar}
      />

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-10 px-3">
                  <Checkbox
                    checked={allPropSelected}
                    onCheckedChange={toggleSelectAllProp}
                  />
                </TableHead>
                {isPropVisible("name") && (
                  <TableHead className="font-semibold">
                    {ar ? "الاسم" : "Name"}
                  </TableHead>
                )}
                {isPropVisible("code") && (
                  <TableHead className="font-semibold">
                    {ar ? "الكود" : "Code"}
                  </TableHead>
                )}
                {isPropVisible("displayname") && (
                  <TableHead className="font-semibold">
                    {ar ? "اسم العرض" : "Display Name"}
                  </TableHead>
                )}
                {isPropVisible("hrContacts") && (
                  <TableHead className="font-semibold">
                    {ar ? "مسؤولو الموارد البشرية" : "HR Contacts"}
                  </TableHead>
                )}
                {isPropVisible("housingManagers") && (
                  <TableHead className="font-semibold">
                    {ar ? "إدارة السكن" : "Housing Managers"}
                  </TableHead>
                )}
                {isPropVisible("language") && (
                  <TableHead className="font-semibold">
                    {ar ? "اللغة" : "Language"}
                  </TableHead>
                )}
                {isPropVisible("color") && (
                  <TableHead className="font-semibold">
                    {ar ? "اللون" : "Color"}
                  </TableHead>
                )}
                {isPropVisible("status") && (
                  <TableHead className="font-semibold">
                    {ar ? "الحالة" : "Status"}
                  </TableHead>
                )}
                {isPropVisible("actions") && (
                  <TableHead className="font-semibold">
                    {ar ? "الإجراءات" : "Actions"}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {propList.map((prop) => {
                const isPropSelected = selectedRows.has(prop.id);
                return (
                  <TableRow
                    key={prop.id}
                    className={
                      isPropSelected ? "bg-primary/5" : "hover:bg-muted/20"
                    }
                  >
                    <TableCell className="px-3">
                      <Checkbox
                        checked={isPropSelected}
                        onCheckedChange={() => togglePropRow(prop.id)}
                      />
                    </TableCell>
                    {isPropVisible("name") && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
                            style={{
                              backgroundColor: (prop as any).logo
                                ? "transparent"
                                : ((prop as any).primaryColor ?? "#0F2A44"),
                            }}
                          >
                            {(prop as any).logo ? (
                              <img
                                src={(prop as any).logo}
                                alt={prop.name}
                                className="w-8 h-8 rounded-lg object-contain border"
                              />
                            ) : (
                              <Building2 className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <span className="font-medium">{prop.name}</span>
                        </div>
                      </TableCell>
                    )}
                    {isPropVisible("code") && (
                      <TableCell>
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">
                          {prop.code}
                        </span>
                      </TableCell>
                    )}
                    {isPropVisible("displayname") && (
                      <TableCell className="text-muted-foreground">
                        {prop.displayName || "—"}
                      </TableCell>
                    )}
                    {isPropVisible("hrContacts") && (
                      <TableCell className="max-w-xs">
                        <div className="space-y-1">
                          {((prop as any).hrContact1Name || (prop as any).hrContact1Phone) && (
                            <div className="flex items-center justify-between gap-1.5 p-1 px-2 rounded-md bg-primary/5 border border-primary/15 text-xs">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold truncate text-[11px] text-foreground">
                                  {(prop as any).hrContact1Name || (ar ? "مسؤول HR 1" : "HR Contact 1")}
                                </div>
                                {(prop as any).hrContact1Title && (
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {(prop as any).hrContact1Title}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {(prop as any).hrContact1Phone && (
                                  <>
                                    <a
                                      href={`tel:${(prop as any).hrContact1Phone}`}
                                      className="p-1 rounded hover:bg-primary/20 text-primary transition-colors"
                                      title={ar ? "اتصال" : "Call"}
                                    >
                                      <Phone className="w-3 h-3" />
                                    </a>
                                    <a
                                      href={`https://wa.me/${String((prop as any).hrContact1Phone).replace(/\D/g, "")}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 rounded hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                                      title="WhatsApp"
                                    >
                                      <MessageCircle className="w-3 h-3" />
                                    </a>
                                  </>
                                )}
                                {(prop as any).hrContact1Email && (
                                  <a
                                    href={`mailto:${(prop as any).hrContact1Email}`}
                                    className="p-1 rounded hover:bg-blue-500/20 text-blue-600 transition-colors"
                                    title={(prop as any).hrContact1Email}
                                  >
                                    <Mail className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                          {((prop as any).hrContact2Name || (prop as any).hrContact2Phone) && (
                            <div className="flex items-center justify-between gap-1.5 p-1 px-2 rounded-md bg-muted/50 border text-xs">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold truncate text-[11px] text-foreground">
                                  {(prop as any).hrContact2Name || (ar ? "مسؤول HR 2" : "HR Contact 2")}
                                </div>
                                {(prop as any).hrContact2Title && (
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {(prop as any).hrContact2Title}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {(prop as any).hrContact2Phone && (
                                  <>
                                    <a
                                      href={`tel:${(prop as any).hrContact2Phone}`}
                                      className="p-1 rounded hover:bg-primary/20 text-primary transition-colors"
                                      title={ar ? "اتصال" : "Call"}
                                    >
                                      <Phone className="w-3 h-3" />
                                    </a>
                                    <a
                                      href={`https://wa.me/${String((prop as any).hrContact2Phone).replace(/\D/g, "")}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 rounded hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                                      title="WhatsApp"
                                    >
                                      <MessageCircle className="w-3 h-3" />
                                    </a>
                                  </>
                                )}
                                {(prop as any).hrContact2Email && (
                                  <a
                                    href={`mailto:${(prop as any).hrContact2Email}`}
                                    className="p-1 rounded hover:bg-blue-500/20 text-blue-600 transition-colors"
                                    title={(prop as any).hrContact2Email}
                                  >
                                    <Mail className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                          {!((prop as any).hrContact1Name || (prop as any).hrContact1Phone || (prop as any).hrContact2Name || (prop as any).hrContact2Phone) && (
                            <span className="italic text-gray-400 text-xs">—</span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isPropVisible("housingManagers") && (
                      <TableCell className="max-w-xs">
                        <div className="space-y-1">
                          {((prop as any).housingManager1Name || (prop as any).housingManager1Phone) && (
                            <div className="flex items-center justify-between gap-1.5 p-1 px-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold truncate text-[11px] text-foreground">
                                  {(prop as any).housingManager1Name || (ar ? "مدير السكن 1" : "Housing Manager 1")}
                                </div>
                                {(prop as any).housingManager1Title && (
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {(prop as any).housingManager1Title}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {(prop as any).housingManager1Phone && (
                                  <>
                                    <a
                                      href={`tel:${(prop as any).housingManager1Phone}`}
                                      className="p-1 rounded hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors"
                                      title={ar ? "اتصال" : "Call"}
                                    >
                                      <Phone className="w-3 h-3" />
                                    </a>
                                    <a
                                      href={`https://wa.me/${String((prop as any).housingManager1Phone).replace(/\D/g, "")}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 rounded hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                                      title="WhatsApp"
                                    >
                                      <MessageCircle className="w-3 h-3" />
                                    </a>
                                  </>
                                )}
                                {(prop as any).housingManager1Email && (
                                  <a
                                    href={`mailto:${(prop as any).housingManager1Email}`}
                                    className="p-1 rounded hover:bg-blue-500/20 text-blue-600 transition-colors"
                                    title={(prop as any).housingManager1Email}
                                  >
                                    <Mail className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                          {((prop as any).housingManager2Name || (prop as any).housingManager2Phone) && (
                            <div className="flex items-center justify-between gap-1.5 p-1 px-2 rounded-md bg-muted/50 border text-xs">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold truncate text-[11px] text-foreground">
                                  {(prop as any).housingManager2Name || (ar ? "مدير السكن 2" : "Housing Manager 2")}
                                </div>
                                {(prop as any).housingManager2Title && (
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {(prop as any).housingManager2Title}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {(prop as any).housingManager2Phone && (
                                  <>
                                    <a
                                      href={`tel:${(prop as any).housingManager2Phone}`}
                                      className="p-1 rounded hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors"
                                      title={ar ? "اتصال" : "Call"}
                                    >
                                      <Phone className="w-3 h-3" />
                                    </a>
                                    <a
                                      href={`https://wa.me/${String((prop as any).housingManager2Phone).replace(/\D/g, "")}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 rounded hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                                      title="WhatsApp"
                                    >
                                      <MessageCircle className="w-3 h-3" />
                                    </a>
                                  </>
                                )}
                                {(prop as any).housingManager2Email && (
                                  <a
                                    href={`mailto:${(prop as any).housingManager2Email}`}
                                    className="p-1 rounded hover:bg-blue-500/20 text-blue-600 transition-colors"
                                    title={(prop as any).housingManager2Email}
                                  >
                                    <Mail className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                          {!((prop as any).housingManager1Name || (prop as any).housingManager1Phone || (prop as any).housingManager2Name || (prop as any).housingManager2Phone) && (
                            <span className="italic text-gray-400 text-xs">—</span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isPropVisible("language") && (
                      <TableCell>
                        <span className="text-xs">
                          {(prop as any).defaultLanguage === "ar"
                            ? "🇸🇦 العربية"
                            : "🇺🇸 English"}
                        </span>
                      </TableCell>
                    )}
                    {isPropVisible("color") && (
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-5 h-5 rounded border"
                            style={{
                              backgroundColor:
                                (prop as any).primaryColor ?? "#0F2A44",
                            }}
                          />
                          <span className="text-xs font-mono text-muted-foreground">
                            {(prop as any).primaryColor ?? "#0F2A44"}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    {isPropVisible("status") && (
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor(prop.status)}`}
                        >
                          {ar
                            ? prop.status === "active"
                              ? "نشط"
                              : "غير نشط"
                            : prop.status}
                        </span>
                      </TableCell>
                    )}
                    {isPropVisible("actions") && (
                      <TableCell>
                        <div className="flex gap-1">
                          <PermissionGate module="properties" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              title={ar ? "استيراد تكوين الغرف والمباني" : "Import Housing Config"}
                              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => {
                                setSelectedPropForImport(prop);
                                setImportWizardOpen(true);
                              }}
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(prop)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </PermissionGate>
                          <PermissionGate module="properties" action="delete">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                if (
                                  confirm(ar ? "هل أنت متأكد؟" : "Are you sure?")
                                )
                                  deleteMutation.mutate({ id: prop.id });
                              }}
                            >
                              <Trash className="w-4 h-4 text-red-500" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {propList.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={propVisible.size + 1}
                    className="py-12 text-center"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Building2 className="w-8 h-8 opacity-30" />
                      <p className="font-medium">
                        {ar
                          ? "لم يتم العثور على عقارات"
                          : "No properties found"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog */}
      <Dialog
        open={isOpen}
        onOpenChange={(v) => {
          if (!v) closeDialog();
        }}
      >
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          srTitle={
            editingId
              ? ar
                ? "تعديل العقار"
                : "Edit Property"
              : ar
                ? "عقار جديد"
                : "New Property"
          }
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold uppercase tracking-wide">
              <Building2 className="w-5 h-5" />
              {editingId
                ? ar
                  ? "تعديل العقار"
                  : "EDIT PROPERTY"
                : ar
                  ? "عقار جديد"
                  : "NEW PROPERTY"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger
                value="general"
                className="gap-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                <Globe className="w-3.5 h-3.5" />
                {ar ? "عام" : "GENERAL"}
              </TabsTrigger>
              <TabsTrigger
                value="branding"
                className="gap-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                <Palette className="w-3.5 h-3.5" />
                {ar ? "الهوية" : "BRANDING"}
              </TabsTrigger>
              <TabsTrigger
                value="admin"
                className="gap-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                <Shield className="w-3.5 h-3.5" />
                {ar ? "إدارة" : "ADMIN"}
              </TabsTrigger>
              <TabsTrigger
                value="contacts"
                className="gap-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                <Users className="w-3.5 h-3.5" />
                {ar ? "التواصل" : "CONTACTS"}
              </TabsTrigger>
              <TabsTrigger
                value="housing_config"
                className="gap-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                {ar ? "تكوين السكن" : "HOUSING"}
              </TabsTrigger>
            </TabsList>

            {/* ── GENERAL TAB ── */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {ar ? "اسم العقار (داخلي)" : "PROPERTY NAME (INTERNAL)"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder={
                    ar
                      ? "مثال: صن رايز كريستال باي"
                      : "e.g. Sunrise Crystal Bay"
                  }
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {ar ? "كود العقار (فريد)" : "PROPERTY CODE (UNIQUE)"}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. SCB-01"
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        code: e.target.value.toUpperCase(),
                      }))
                    }
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    {ar
                      ? "يستخدم للتعريف وتسجيل الدخول"
                      : "Used for identification & login"}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {ar ? "اسم العرض (للعموم)" : "DISPLAY NAME (PUBLIC)"}
                  </Label>
                  <Input
                    placeholder={
                      ar ? "مثال: منتجع كريستال باي" : "e.g. Crystal Bay Resort"
                    }
                    value={form.displayName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, displayName: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {ar ? "اللغة الافتراضية" : "DEFAULT LANGUAGE"}
                  </Label>
                  <Select
                    value={form.defaultLanguage}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, defaultLanguage: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">🇺🇸 English</SelectItem>
                      <SelectItem value="ar">🇸🇦 العربية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {ar ? "الحالة" : "STATUS"}
                  </Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        {ar ? "نشط" : "Active"}
                      </SelectItem>
                      <SelectItem value="inactive">
                        {ar ? "غير نشط" : "Inactive"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* ── BRANDING TAB ── */}
            <TabsContent value="branding" className="space-y-4 mt-4">
              {/* Logo Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {ar ? "شعار العقار (اختياري)" : "PROPERTY LOGO (OPTIONAL)"}
                </Label>
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
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
                    const reader = new FileReader();
                    reader.onload = () =>
                      setForm((f) => ({ ...f, logo: reader.result as string }));
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
                <div className="flex items-center gap-3">
                  {form.logo ? (
                    <div className="relative">
                      <img
                        src={form.logo}
                        alt="Logo"
                        className="h-16 w-16 rounded-lg object-contain border bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, logo: "" }))}
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-destructive/80"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/60 transition-colors"
                      onClick={() => logoFileRef.current?.click()}
                    >
                      <Building2 className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoFileRef.current?.click()}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      {ar ? "رفع الشعار" : "Upload Logo"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ar ? "JPG أو PNG، حجم أقصى 2MB" : "JPG or PNG, max 2MB"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {ar ? "اللون الأساسي" : "PRIMARY COLOR"}
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, primaryColor: e.target.value }))
                    }
                    className="h-12 w-16 rounded-lg border cursor-pointer"
                  />
                  <div className="flex-1">
                    <Input
                      value={form.primaryColor}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, primaryColor: e.target.value }))
                      }
                      className="font-mono"
                      placeholder="#0F2A44"
                    />
                  </div>
                  <div
                    className="h-12 w-12 rounded-lg border flex items-center justify-center"
                    style={{ backgroundColor: form.primaryColor }}
                  >
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                <p className="text-sm font-semibold">
                  {ar ? "معاينة" : "Preview"}
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden"
                    style={{
                      backgroundColor: form.logo
                        ? "transparent"
                        : form.primaryColor,
                    }}
                  >
                    {form.logo ? (
                      <img
                        src={form.logo}
                        alt="logo"
                        className="h-10 w-10 rounded-lg object-contain border"
                      />
                    ) : (
                      <Building2 className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm">
                      {form.displayName ||
                        form.name ||
                        (ar ? "اسم العقار" : "Property Name")}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {form.code || "CODE"}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── ADMIN TAB ── */}
            <TabsContent value="admin" className="space-y-4 mt-4">
              {/* Property code info */}
              <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/20 flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                    {ar ? "كود العقار" : "Property Code"}
                  </p>
                  <p className="font-mono font-bold text-blue-700 dark:text-blue-400 mt-0.5">
                    {form.code ||
                      (ar
                        ? "— أدخل الكود �?ي تبويب عام —"
                        : "— enter code in General tab —")}
                  </p>
                </div>
              </div>

              {/* Create admin user section */}
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-muted/40 border-b flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#C9A24D]" />
                  <p className="text-sm font-semibold">
                    {editingId
                      ? ar
                        ? "إضافة مستخدم جديد للعقار"
                        : "Add New User to Property"
                      : ar
                        ? "إنشاء مستخدم مسؤول (اختياري)"
                        : "Create Admin User (Optional)"}
                  </p>
                </div>
                <div className="p-4 space-y-3">
                  {editingId && (
                    <p className="text-xs text-muted-foreground">
                      {ar
                        ? "يمكنك إنشاء مستخدم جديد لهذا العقار هنا، أو من صفحة إدارة المستخدمين."
                        : "You can create a new user for this property here, or from the User Management page."}
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {ar ? "اسم المستخدم" : "USERNAME"}
                      {!editingId && (
                        <span className="text-muted-foreground font-normal normal-case tracking-normal ml-1">
                          ({ar ? "اختياري" : "optional"})
                        </span>
                      )}
                    </Label>
                    <Input
                      placeholder={
                        ar ? "مثال: manager.sunrise" : "e.g. manager.sunrise"
                      }
                      value={form.adminUsername}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          adminUsername: e.target.value,
                        }))
                      }
                      autoComplete="off"
                    />
                    {form.adminUsername.trim().toLowerCase() === "admin" && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        {ar
                          ? "ملاحظة: حساب 'admin' موجود مسبقاً، وسيتم منحه صلاحية إدارة هذا الفرع الجديد تلقائياً."
                          : "Note: 'admin' account already exists and will be granted access to this new property."}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {ar ? "كلمة المرور" : "PASSWORD"}
                      {!editingId && (
                        <span className="text-muted-foreground font-normal normal-case tracking-normal ml-1">
                          ({ar ? "اختياري" : "optional"})
                        </span>
                      )}
                    </Label>
                    <div className="relative">
                      <Input
                        type="password"
                        placeholder={
                          ar ? "الحد الأدنى 6 أحرف" : "Minimum 6 characters"
                        }
                        value={form.adminPassword}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            adminPassword: e.target.value,
                          }))
                        }
                        autoComplete="off"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPass((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showAdminPass ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  {!editingId && (
                    <p className="text-xs text-muted-foreground">
                      {ar
                        ? "إذا تركته فارغاً، يمكنك إضافة مستخدمين لاحقاً من صفحة إدارة المستخدمين."
                        : "If left blank, you can add users later from the User Management page."}
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── CONTACTS TAB (KEY HR & HOUSING MANAGERS) ── */}
            <TabsContent value="contacts" className="space-y-4 mt-4">
              <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/20 text-xs text-muted-foreground flex items-center gap-2.5">
                <Users className="w-5 h-5 text-primary shrink-0" />
                <span className="leading-relaxed">
                  {ar
                    ? "تسجيل وتعديل مسؤولي الموارد البشرية وإدارة السكن المعتمدين لهذا العقار. تظهر هذه البيانات تلقائياً في بوابة الموظفين والتواصل السريع."
                    : "Official HR Coordinators and Housing Managers for this property. These contacts are automatically displayed in the Resident Portal for instant resident support."}
                </span>
              </div>

              {/* HR Contacts Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {ar ? "مسؤولو الموارد البشرية (HR Contacts)" : "HR Coordinators"}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* HR 1 */}
                  <div className="p-3.5 rounded-xl border bg-card/60 space-y-2.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary inline-block">
                      {ar ? "مسؤول HR 1" : "HR Contact 1"}
                    </span>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "الاسم" : "Name"}</Label>
                      <Input
                        value={form.hrContact1Name}
                        onChange={(e) => setForm(f => ({ ...f, hrContact1Name: e.target.value }))}
                        placeholder={ar ? "مثال: أحمد محمود" : "Full Name"}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "المسمى الوظيفي" : "Title"}</Label>
                      <Input
                        value={form.hrContact1Title}
                        onChange={(e) => setForm(f => ({ ...f, hrContact1Title: e.target.value }))}
                        placeholder="HR Coordinator"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "رقم الهاتف / واتساب" : "Phone / WhatsApp"}</Label>
                      <Input
                        value={form.hrContact1Phone}
                        onChange={(e) => setForm(f => ({ ...f, hrContact1Phone: e.target.value }))}
                        placeholder="+20 100 000 0000"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "البريد الإلكتروني" : "Email"}</Label>
                      <Input
                        value={form.hrContact1Email}
                        onChange={(e) => setForm(f => ({ ...f, hrContact1Email: e.target.value }))}
                        placeholder="hr1@sunrise-resorts.com"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* HR 2 */}
                  <div className="p-3.5 rounded-xl border bg-card/60 space-y-2.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary inline-block">
                      {ar ? "مسؤول HR 2" : "HR Contact 2"}
                    </span>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "الاسم" : "Name"}</Label>
                      <Input
                        value={form.hrContact2Name}
                        onChange={(e) => setForm(f => ({ ...f, hrContact2Name: e.target.value }))}
                        placeholder={ar ? "مثال: سارة علي" : "Full Name"}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "المسمى الوظيفي" : "Title"}</Label>
                      <Input
                        value={form.hrContact2Title}
                        onChange={(e) => setForm(f => ({ ...f, hrContact2Title: e.target.value }))}
                        placeholder="HR Specialist"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "رقم الهاتف / واتساب" : "Phone / WhatsApp"}</Label>
                      <Input
                        value={form.hrContact2Phone}
                        onChange={(e) => setForm(f => ({ ...f, hrContact2Phone: e.target.value }))}
                        placeholder="+20 100 000 0000"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "البريد الإلكتروني" : "Email"}</Label>
                      <Input
                        value={form.hrContact2Email}
                        onChange={(e) => setForm(f => ({ ...f, hrContact2Email: e.target.value }))}
                        placeholder="hr2@sunrise-resorts.com"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Housing Managers Grid */}
              <div className="space-y-3 pt-2 border-t">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {ar ? "إدارة السكن (Housing Managers)" : "Housing Managers"}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Manager 1 */}
                  <div className="p-3.5 rounded-xl border bg-card/60 space-y-2.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 inline-block">
                      {ar ? "مدير السكن 1" : "Housing Manager 1"}
                    </span>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "الاسم" : "Name"}</Label>
                      <Input
                        value={form.housingManager1Name}
                        onChange={(e) => setForm(f => ({ ...f, housingManager1Name: e.target.value }))}
                        placeholder={ar ? "مثال: محمود فؤاد" : "Full Name"}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "المسمى الوظيفي" : "Title"}</Label>
                      <Input
                        value={form.housingManager1Title}
                        onChange={(e) => setForm(f => ({ ...f, housingManager1Title: e.target.value }))}
                        placeholder="Housing Manager"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "رقم الهاتف / واتساب" : "Phone / WhatsApp"}</Label>
                      <Input
                        value={form.housingManager1Phone}
                        onChange={(e) => setForm(f => ({ ...f, housingManager1Phone: e.target.value }))}
                        placeholder="+20 100 000 0000"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "البريد الإلكتروني" : "Email"}</Label>
                      <Input
                        value={form.housingManager1Email}
                        onChange={(e) => setForm(f => ({ ...f, housingManager1Email: e.target.value }))}
                        placeholder="housing1@sunrise-resorts.com"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Manager 2 */}
                  <div className="p-3.5 rounded-xl border bg-card/60 space-y-2.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 inline-block">
                      {ar ? "مدير السكن 2" : "Housing Manager 2"}
                    </span>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "الاسم" : "Name"}</Label>
                      <Input
                        value={form.housingManager2Name}
                        onChange={(e) => setForm(f => ({ ...f, housingManager2Name: e.target.value }))}
                        placeholder={ar ? "مثال: هاني عادل" : "Full Name"}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "المسمى الوظيفي" : "Title"}</Label>
                      <Input
                        value={form.housingManager2Title}
                        onChange={(e) => setForm(f => ({ ...f, housingManager2Title: e.target.value }))}
                        placeholder="Assistant Housing Manager"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "رقم الهاتف / واتساب" : "Phone / WhatsApp"}</Label>
                      <Input
                        value={form.housingManager2Phone}
                        onChange={(e) => setForm(f => ({ ...f, housingManager2Phone: e.target.value }))}
                        placeholder="+20 100 000 0000"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "البريد الإلكتروني" : "Email"}</Label>
                      <Input
                        value={form.housingManager2Email}
                        onChange={(e) => setForm(f => ({ ...f, housingManager2Email: e.target.value }))}
                        placeholder="housing2@sunrise-resorts.com"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── HOUSING CONFIG TAB ── */}
            <TabsContent value="housing_config" className="space-y-4 mt-4">
              <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  <span>{ar ? "استيراد وتكوين المباني والغرف والأدوار" : "Housing, Buildings, Floors & Rooms Config"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? "يمكنك إرفاق ملف Excel (.xlsx / .xls) أو CSV بتكوين الغرف والمباني ليقوم النظام تلقائياً بإنشاء الطوابق والمباني والغرف والأسرة الفيزيائية فور حفظ هذا العقار!"
                    : "Upload an Excel (.xlsx / .xls) or CSV room configuration file to automatically set up buildings, floors, rooms, and beds when this property is created!"}
                </p>
              </div>

              {!editingId ? (
                <div className="space-y-4">
                  <input
                    ref={housingFileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleHousingConfigFile}
                    className="hidden"
                  />

                  {/* Template Download Option */}
                  <div className="p-3.5 rounded-xl border bg-blue-500/5 border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-start w-full sm:w-auto">
                      <div className="p-2 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 shrink-0">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {ar ? "تحميل نموذج ملف تكوين الغرف (Template)" : "Download Room Configuration Template"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {ar ? "يحتوي على كافة الأعمدة القياسية وأمثلة توضيحية لتسهيل التعبئة" : "Includes all standard columns, examples & filling guide"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => downloadRoomImportTemplate("xlsx")}
                        className="h-8 text-xs gap-1.5 font-bold border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {ar ? "قالب Excel (.xlsx)" : "Excel (.xlsx)"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadRoomImportTemplate("csv")}
                        className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Download className="w-3 h-3" />
                        CSV
                      </Button>
                    </div>
                  </div>

                  {!housingConfigFile ? (
                    <div
                      onClick={() => housingFileInputRef.current?.click()}
                      className="p-6 border-2 border-dashed rounded-xl bg-muted/10 hover:bg-muted/20 border-primary/30 hover:border-primary transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-2 group"
                    >
                      <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-xs text-foreground">
                          {ar ? "اضغط لاختيار ملف تكوين السكن (Excel / CSV)" : "Click to select Housing Configuration file"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {ar ? "يدعم أعمدة: رقم الغرفة، النوع، السرير، أقصى إشغال، الدور، الإطلالة، الباب، المميزات، المساحة" : "Supports Room Number, Type, Beds, Capacity, Floor, View, Door, Features, Size"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-xs text-foreground">{housingConfigFile.name}</p>
                            <p className="text-[11px] text-muted-foreground">{(housingConfigFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => {
                            setHousingConfigFile(null);
                            setHousingConfigParsedRows([]);
                            setHousingConfigStats(null);
                          }}
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          {ar ? "إلغاء الملف" : "Remove"}
                        </Button>
                      </div>

                      {housingConfigStats && (
                        <div className="grid grid-cols-4 gap-2 pt-2 border-t text-center">
                          <div className="p-2 rounded-lg bg-muted/40">
                            <span className="text-[10px] text-muted-foreground font-semibold">{ar ? "المباني" : "Buildings"}</span>
                            <p className="text-base font-black text-foreground">{housingConfigStats.buildingsCount}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/40">
                            <span className="text-[10px] text-muted-foreground font-semibold">{ar ? "الأدوار" : "Floors"}</span>
                            <p className="text-base font-black text-foreground">{housingConfigStats.floorsCount}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold">{ar ? "الغرف" : "Rooms"}</span>
                            <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{housingConfigStats.roomsCount}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <span className="text-[10px] text-blue-800 dark:text-blue-300 font-semibold">{ar ? "الأسرة" : "Beds"}</span>
                            <p className="text-base font-black text-blue-600 dark:text-blue-400">{housingConfigStats.bedsCount}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 rounded-xl border bg-muted/10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-foreground">
                      {ar ? "استيراد وتحديث غرف هذا العقار" : "Import & Update Rooms for this Property"}
                    </h5>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                      {ar
                        ? "يمكنك استخدام معالج الاستيراد الشامل لرفع ملف Excel وتدقيق ومطابقة الغرف والأسرة مباشرة."
                        : "Use the universal import wizard to upload an Excel file and configure rooms for this property."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      setSelectedPropForImport({ id: editingId, name: form.name });
                      setImportWizardOpen(true);
                    }}
                    className="gap-2 text-xs font-bold bg-gradient-to-r from-primary to-indigo-600 text-white shadow-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {ar ? "فتح معالج استيراد الغرف لهذا العقار" : "Open Room Importer for this Property"}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-4 border-t mt-4">
            <Button variant="outline" onClick={closeDialog}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={onSubmit} disabled={isPending}>
              {isPending
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? "حفظ العقار"
                  : "Save Property"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <RoomImportWizard
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        properties={properties || []}
        currentPropertyId={selectedPropForImport?.id}
        buildings={[]}
        existingRooms={[]}
        onImportSuccess={() => {
          invalidate();
          queryClient.invalidateQueries();
        }}
      />
      <AnimatedConfirmModal
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title={ar ? "حذف العقار؟" : "Delete Property?"}
        description={
          ar
            ? "هل أنت متأكد أنك تريد حذف هذا العقار؟"
            : "Are you sure you want to delete this property?"
        }
        variant="destructive"
        onConfirm={() => deleteMutation.mutate({ id: deleteDialog.id })}
      />
    </div>
  );
}
