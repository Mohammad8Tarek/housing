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
} from "lucide-react";
import { useRef } from "react";
import {
  ColumnChooser,
  useColumnVisibility,
} from "@/components/ui/column-chooser";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";

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
  const logoFileRef = useRef<HTMLInputElement>(null);

  const { data: properties, isLoading } = useListProperties();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });

  const createMutation = useCreateProperty({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم إنشاء العقار" : "Property created");
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

  const closeDialog = () => {
    setIsOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setActiveTab("general");
    setShowAdminPass(false);
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
      key: "language",
      label: "Language",
      labelAr: "اللغة",
      defaultVisible: true,
    },
    { key: "color", label: "Color", labelAr: "اللون", defaultVisible: true },
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
      Language: p.defaultLanguage ?? "",
      Status: p.status ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Properties");
    XLSX.writeFile(
      wb,
      `properties_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">
            {ar ? "العقارات" : "Properties"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ar
              ? "إدارة العقارات والمرافق في النظام"
              : "Manage properties and facilities in the system"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnChooser
            cols={PROP_COLS}
            visible={propVisible}
            onToggle={propToggle}
            onShowAll={propShowAll}
            onHideAll={propHideAll}
          />
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            {ar ? "إضافة عقار" : "Add Property"}
          </Button>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(prop)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
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
          className="max-w-xl max-h-[90vh] overflow-y-auto"
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
            <TabsList className="grid w-full grid-cols-3">
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
