// @ts-nocheck
import { useState } from "react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import PortalDocuments from "@/components/PortalDocuments";
import PortalAnalyticsDashboard from "@/components/PortalAnalyticsDashboard";

import PortalReports from "@/components/PortalReports";
import PortalCategoriesAndTags from "@/components/PortalCategoriesAndTags";
import PortalFoodTransport from "@/components/PortalFoodTransport";
import PortalChat from "@/components/PortalChat";
import {
  Star,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  Trophy,
  MessageSquare,
  Globe,
  Mail,
  Phone,
  BarChart3,
  Bell,
  Users,
  Shield,
  RefreshCw,
  CheckCircle,
  XCircle,
  Palette,
  UtensilsCrossed,
  MessageCircle,
} from "lucide-react";

// ─── Portal Contacts Section (Multi-Contact CRUD) ─────────────
function PortalContactsSection() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editContact, setEditContact] = useState<any>(null);
  const emptyForm = {
    nameAr: "",
    nameEn: "",
    roleAr: "",
    roleEn: "",
    phone: "",
    email: "",
    extension: "",
  };
  const [form, setForm] = useState(emptyForm);

  const { data: contactsData, isLoading } = useQuery({
    queryKey: ["portal-contacts", activePropertyId],
    queryFn: async () => {
      const r = await fetch(
        `/api/portal-contacts?propertyId=${activePropertyId}`,
      );
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.contacts ?? []);
    },
    enabled: !!activePropertyId,
  });

  const contacts = contactsData ?? [];

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!data.id;
      const url = isEdit
        ? `/api/portal-contacts/${data.id}`
        : "/api/portal-contacts";
      const method = isEdit ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, propertyId: activePropertyId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(ar
          ? editContact
            ? "تم التعديل"
            : "تمت الإضافة"
          : editContact
            ? "Contact updated"
            : "Contact added");
      queryClient.invalidateQueries({
        queryKey: ["portal-contacts", activePropertyId],
      });
      setIsOpen(false);
      setEditContact(null);
      setForm(emptyForm);
    },
    onError: () => toast.error("Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/portal-contacts/${id}?propertyId=${activePropertyId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast.success(ar ? "تم الحذف" : "Contact deleted");
      queryClient.invalidateQueries({
        queryKey: ["portal-contacts", activePropertyId],
      });
    },
  });

  const openAdd = () => {
    setEditContact(null);
    setForm(emptyForm);
    setIsOpen(true);
  };
  const openEdit = (c: any) => {
    setEditContact(c);
    setForm({
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      roleAr: c.roleAr ?? "",
      roleEn: c.roleEn ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      extension: c.extension ?? "",
    });
    setIsOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            {ar ? "جهات اتصال البوابة" : "Portal Contacts"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {ar
              ? "أضف عدة جهات اتصال تظهر للموظفين في البوابة (مشرف سكن، موارد بشرية، إلخ)"
              : "Add multiple contacts visible to employees (Housing Supervisor, HR, etc.)"}
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />{" "}
          {ar ? "إضافة جهة اتصال" : "Add Contact"}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : contacts.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl py-16 text-center text-muted-foreground">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {ar ? "لا توجد جهات اتصال حتى الآن" : "No contacts added yet"}
          </p>
          <p className="text-xs mt-1">
            {ar
              ? "اضغط «إضافة جهة اتصال» للبدء"
              : "Click «Add Contact» to get started"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((c: any) => (
            <Card
              key={c.id}
              className="group relative overflow-hidden hover:border-primary/50 transition-colors"
            >
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm">
                      {ar ? c.nameAr : c.nameEn}
                    </div>
                    {(c.roleAr || c.roleEn) && (
                      <Badge variant="secondary" className="text-[10px] mt-1">
                        {ar ? c.roleAr : c.roleEn}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(c)}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(c.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      {c.phone}
                      {c.extension && (
                        <span className="text-[10px]">({c.extension})</span>
                      )}
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      {c.email}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={isOpen}
        onOpenChange={(o) => {
          setIsOpen(o);
          if (!o) {
            setEditContact(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent
          className="max-w-lg"
          srTitle={
            ar
              ? editContact
                ? "تعديل جهة اتصال"
                : "إضافة جهة اتصال"
              : editContact
                ? "Edit Contact"
                : "Add Contact"
          }
        >
          <DialogHeader>
            <DialogTitle>
              {ar
                ? editContact
                  ? "تعديل جهة اتصال"
                  : "إضافة جهة اتصال"
                : editContact
                  ? "Edit Contact"
                  : "Add Contact"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{ar ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nameAr: e.target.value }))
                  }
                  placeholder={ar ? "مثال: محمد أحمد" : "e.g. محمد أحمد"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nameEn: e.target.value }))
                  }
                  placeholder="e.g. Mohamed Ahmed"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "المسمى الوظيفي (عربي)" : "Role (Arabic)"}</Label>
                <Input
                  value={form.roleAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, roleAr: e.target.value }))
                  }
                  placeholder={ar ? "مثال: مشرف سكن" : "e.g. مشرف سكن"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {ar ? "المسمى الوظيفي (إنجليزي)" : "Role (English)"}
                </Label>
                <Input
                  value={form.roleEn}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, roleEn: e.target.value }))
                  }
                  placeholder="e.g. Housing Supervisor"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "الهاتف" : "Phone"}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+971 50 123 4567"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {ar ? "التحويلة (اختياري)" : "Extension (Optional)"}
                </Label>
                <Input
                  value={form.extension}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, extension: e.target.value }))
                  }
                  placeholder="#4055"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>
                  {ar ? "البريد الإلكتروني (اختياري)" : "Email (Optional)"}
                </Label>
                <Input
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="name@company.com"
                  type="email"
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!form.nameAr || !form.nameEn || saveMutation.isPending}
              onClick={() =>
                saveMutation.mutate(
                  editContact ? { ...form, id: editContact.id } : form,
                )
              }
            >
              {saveMutation.isPending
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? editContact
                    ? "تعديل"
                    : "إضافة"
                  : editContact
                    ? "Update"
                    : "Add Contact"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Evaluations Section (survey model: employees rate) ──────
function EvaluationsSection() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null,
  );
  const [form, setForm] = useState({
    titleAr: "",
    titleEn: "",
    descriptionAr: "",
    descriptionEn: "",
    category: "general",
    department: "",
    expiresAt: "",
  });
  const [items, setItems] = useState<
    Array<{ titleAr: string; titleEn: string; type: string; required: boolean }>
  >([]);

  const { data: evaluations, isLoading } = useQuery({
    queryKey: ["evaluations", activePropertyId],
    queryFn: async () => {
      const r = await fetch(`/api/evaluations?propertyId=${activePropertyId}`);
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: !!activePropertyId,
  });

  const { data: departments } = useQuery({
    queryKey: ["lookup-values", activePropertyId, "department"],
    queryFn: async () => {
      const r = await fetch(
        `/api/lookup-values?propertyId=${activePropertyId}&category=department`,
      );
      const d = await r.json();
      return Array.isArray(d) ? d : Array.isArray(d?.values) ? d.values : [];
    },
    enabled: !!activePropertyId,
  });

  const { data: evalCategories = [] } = useQuery({
    queryKey: ["portal-categories", activePropertyId, "evaluations"],
    queryFn: async () => {
      const r = await fetch(
        `/api/portal-categories?propertyId=${activePropertyId}&type=evaluations`,
      );
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!activePropertyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const r = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, propertyId: activePropertyId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(ar ? "تم إضافة التقييم" : "Evaluation added");
      queryClient.invalidateQueries({
        queryKey: ["evaluations", activePropertyId],
      });
      setIsOpen(false);
      setForm({
        titleAr: "",
        titleEn: "",
        descriptionAr: "",
        descriptionEn: "",
        category: "general",
        department: "",
        expiresAt: "",
      });
      setItems([]);
    },
  });

  const getTitle = (ev) =>
    (ar ? ev.titleAr || ev.titleEn : ev.titleEn || ev.titleAr) || ev.category;
  const getDesc = (ev) =>
    ar
      ? ev.descriptionAr || ev.descriptionEn
      : ev.descriptionEn || ev.descriptionAr;

  const { data: stats } = useQuery({
    queryKey: ["evaluations-stats", activePropertyId],
    queryFn: async () => {
      const r = await fetch(
        `/api/evaluations/stats?propertyId=${activePropertyId}`,
      );
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!activePropertyId,
  });

  // Fetch responses for selected template
  const { data: responsesData, isLoading: responsesLoading } = useQuery({
    queryKey: ["evaluations-responses", selectedTemplateId],
    queryFn: async () => {
      const r = await fetch(
        `/api/evaluations/${selectedTemplateId}/responses?propertyId=${activePropertyId}`,
      );
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!selectedTemplateId && responsesOpen,
  });

  const evals = evaluations || [];
  const totalEvals = stats?.total ?? evals.length;
  const responded =
    stats?.responded ?? evals.filter((ev) => ev.employeeRating != null).length;
  const avgRating = stats?.average_rating
    ? Number(stats.average_rating).toFixed(1)
    : "—";
  const responseRate =
    totalEvals > 0 ? Math.round((responded / totalEvals) * 100) + "%" : "—";

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(
        `/api/evaluations/${id}?propertyId=${activePropertyId}`,
        { method: "DELETE" },
      );
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(ar ? "تم حذف التقييم" : "Evaluation deleted");
      queryClient.invalidateQueries({
        queryKey: ["evaluations", activePropertyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["evaluations-stats", activePropertyId],
      });
    },
    onError: () => toast.error("Error deleting"),
  });

  const addItem = () =>
    setItems([
      ...items,
      { titleAr: "", titleEn: "", type: "rating", required: true },
    ]);
  const removeItem = (idx: number) =>
    setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: any) => {
    setItems(
      items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold">
            {ar ? "استبيانات الموظفين" : "Employee Surveys"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {ar
              ? "إنشاء استبيانات وتقييمات يشارك فيها الموظفون"
              : "Create surveys and evaluations for employees to rate"}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> {ar ? "استبيان جديد" : "New Survey"}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{totalEvals}</div>
            <div className="text-[10px] text-muted-foreground">
              {ar ? "إجمالي" : "Total"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-green-500">{responded}</div>
            <div className="text-[10px] text-muted-foreground">
              {ar ? "تم الرد" : "Responded"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-amber-500 flex items-center justify-center gap-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              {avgRating}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {ar ? "متوسط التقييم" : "Avg Rating"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{responseRate}</div>
            <div className="text-[10px] text-muted-foreground">
              {ar ? "معدل الاستجابة" : "Response Rate"}
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>{ar ? "العنوان" : "Title"}</TableHead>
                <TableHead>{ar ? "القسم" : "Dept"}</TableHead>
                <TableHead>{ar ? "الأسئلة" : "Items"}</TableHead>
                <TableHead>{ar ? "الردود" : "Responses"}</TableHead>
                <TableHead className="text-right">
                  {ar ? "التاريخ" : "Date"}
                </TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evals.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="font-medium">
                    <div className="text-sm">{getTitle(ev)}</div>
                    {getDesc(ev) && (
                      <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                        {getDesc(ev)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {ev.department ? (
                      <Badge variant="outline" className="text-[10px]">
                        {ev.department}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {ar ? "الكل" : "All"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {ev.items?.length || 0} {ar ? "سؤال" : "items"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-bold">
                      {ev.responseCount || 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-[10px] text-muted-foreground">
                    {new Date(ev.submittedAt).toLocaleDateString(
                      ar ? "ar-EG" : "en-GB",
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-primary"
                        title={ar ? "عرض الردود" : "View responses"}
                        onClick={() => {
                          setSelectedTemplateId(ev.id);
                          setResponsesOpen(true);
                        }}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(ev.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Survey Dialog with Items */}
      <Dialog
        open={isOpen}
        onOpenChange={(o) => {
          setIsOpen(o);
          if (!o) setItems([]);
        }}
      >
        <DialogContent
          className="max-w-2xl max-h-[85vh] overflow-y-auto"
          srTitle={ar ? "استبيان جديد" : "New Survey"}
        >
          <DialogHeader>
            <DialogTitle>{ar ? "استبيان جديد" : "New Survey"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{ar ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
                <Input
                  value={form.titleAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, titleAr: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "العنوان (إنجليزي)" : "Title (English)"}</Label>
                <Input
                  value={form.titleEn}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, titleEn: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{ar ? "التصنيف" : "Category"}</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {evalCategories.map((c: any) => (
                      <SelectItem key={c.key || c.id} value={c.key}>
                        {ar ? c.nameAr : c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {ar ? "القسم (اختياري)" : "Department (optional)"}
                </Label>
                <Select
                  value={form.department}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, department: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={ar ? "كل الأقسام" : "All departments"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">
                      {ar ? "كل الأقسام" : "All departments"}
                    </SelectItem>
                    {departments?.map((d) => (
                      <SelectItem key={d.id || d.value} value={d.value}>
                        {d.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{ar ? "الوصف (عربي)" : "Description (Arabic)"}</Label>
              <Input
                value={form.descriptionAr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descriptionAr: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "الوصف (إنجليزي)" : "Description (English)"}</Label>
              <Input
                value={form.descriptionEn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descriptionEn: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>
                {ar
                  ? "تاريخ الاختفاء من البوابة (اختياري)"
                  : "Expires from Portal At (Optional)"}
              </Label>
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expiresAt: e.target.value }))
                }
              />
              <p className="text-[10px] text-muted-foreground">
                {ar
                  ? "بعد هذا التاريخ لن يرى الموظفون هذا التقييم"
                  : "After this date, employees will no longer see this evaluation"}
              </p>
            </div>

            {/* Survey Items Section */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-bold">
                  {ar ? "أسئلة الاستبيان" : "Survey Questions"} ({items.length})
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addItem}
                  type="button"
                >
                  <Plus className="w-3 h-3 mr-1" />{" "}
                  {ar ? "إضافة سؤال" : "Add Question"}
                </Button>
              </div>
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                  {ar
                    ? "لم تتم إضافة أسئلة بعد. الموظفون سيرون تقييم عام فقط."
                    : "No questions added yet. Employees will see a general rating only."}
                </p>
              )}
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex gap-2 items-start p-3 border rounded-lg mb-2 bg-muted/20"
                >
                  <span className="text-xs font-bold text-muted-foreground mt-2">
                    #{idx + 1}
                  </span>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input
                      placeholder={ar ? "السؤال (عربي)" : "Question (Arabic)"}
                      value={item.titleAr}
                      onChange={(e) =>
                        updateItem(idx, "titleAr", e.target.value)
                      }
                      className="h-8 text-xs"
                    />
                    <Input
                      placeholder={
                        ar ? "السؤال (إنجليزي)" : "Question (English)"
                      }
                      value={item.titleEn}
                      onChange={(e) =>
                        updateItem(idx, "titleEn", e.target.value)
                      }
                      className="h-8 text-xs"
                    />
                    <Select
                      value={item.type}
                      onValueChange={(v) => updateItem(idx, "type", v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rating">
                          {ar ? "تقييم (1-5)" : "Rating (1-5)"}
                        </SelectItem>
                        <SelectItem value="text">
                          {ar ? "نص" : "Text"}
                        </SelectItem>
                        <SelectItem value="yes_no">
                          {ar ? "نعم / لا" : "Yes / No"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.required}
                          onChange={(e) =>
                            updateItem(idx, "required", e.target.checked)
                          }
                          className="accent-primary"
                        />
                        {ar ? "مطلوب" : "Required"}
                      </label>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive mt-1"
                    onClick={() => removeItem(idx)}
                    type="button"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              className="w-full"
              onClick={() => {
                const payload = {
                  ...form,
                  items: items.filter((i) => i.titleAr || i.titleEn),
                };
                if (payload.department === "__all__") payload.department = "";
                if (!payload.expiresAt) delete (payload as any).expiresAt;
                createMutation.mutate(payload);
              }}
              disabled={!form.titleAr || createMutation.isPending}
            >
              {ar ? "إنشاء الاستبيان" : "Create Survey"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Responses Dialog */}
      <Dialog open={responsesOpen} onOpenChange={setResponsesOpen}>
        <DialogContent
          className="max-w-3xl max-h-[85vh] overflow-y-auto"
          srTitle={ar ? "ردود التقييم" : "Evaluation Responses"}
        >
          <DialogHeader>
            <DialogTitle>
              {ar ? "ردود التقييم" : "Evaluation Responses"}
            </DialogTitle>
          </DialogHeader>
          {responsesLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : responsesData ? (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <Badge variant="secondary">
                  {responsesData.totalResponses} {ar ? "رد" : "responses"}
                </Badge>
                <Badge variant="secondary">
                  {responsesData.items?.length || 0} {ar ? "سؤال" : "questions"}
                </Badge>
              </div>
              {responsesData.responses?.length > 0 ? (
                <div className="space-y-3">
                  {responsesData.responses.map((resp: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 border rounded-lg bg-muted/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                            {resp.employeeName?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {resp.employeeName}
                            </p>
                            {resp.employeeCode && (
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {resp.employeeCode}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {resp.submittedAt
                            ? new Date(resp.submittedAt).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                      <div className="space-y-1 ml-9">
                        {resp.items?.map((item: any, iIdx: number) => {
                          const templateItem = responsesData.items?.find(
                            (ti: any) => ti.id === item.itemId,
                          );
                          return (
                            <div
                              key={iIdx}
                              className="flex items-start gap-2 text-xs"
                            >
                              <span className="text-muted-foreground font-medium min-w-[100px]">
                                {templateItem
                                  ? ar
                                    ? templateItem.titleAr
                                    : templateItem.titleEn
                                  : `Q${iIdx + 1}`}
                                :
                              </span>
                              {item.ratingValue != null ? (
                                <span className="flex items-center gap-0.5">
                                  {"★".repeat(item.ratingValue)}
                                  <span className="text-muted-foreground/30">
                                    {"★".repeat(5 - item.ratingValue)}
                                  </span>{" "}
                                  <span className="font-bold">
                                    {item.ratingValue}/5
                                  </span>
                                </span>
                              ) : item.textValue ? (
                                <span>{item.textValue}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {ar ? "لا توجد ردود بعد" : "No responses yet"}
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Activities Section ───────────────────────────────────────
function ActivitiesSection() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [registrationsOpen, setRegistrationsOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(
    null,
  );
  const [editForm, setEditForm] = useState<any>(null);
  const [form, setForm] = useState({
    titleAr: "",
    titleEn: "",
    descriptionAr: "",
    descriptionEn: "",
    category: "social",
    status: "planned",
    startDate: "",
    expiresAt: "",
    locationAr: "",
    locationEn: "",
    coverImage: "",
  });

  const { data: activityCategories = [] } = useQuery({
    queryKey: ["portal-categories", activePropertyId, "activities"],
    queryFn: async () => {
      const r = await fetch(
        `/api/portal-categories?propertyId=${activePropertyId}&type=activities`,
      );
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!activePropertyId,
  });

  const { data: activityStatuses = [] } = useQuery({
    queryKey: ["portal-activity-statuses", activePropertyId],
    queryFn: async () => {
      const r = await fetch(
        `/api/portal-categories/statuses?propertyId=${activePropertyId}`,
      );
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!activePropertyId,
  });

  const categoryLabel = (key: string) => {
    const c = activityCategories.find((x: any) => x.key === key);
    return c ? (ar ? c.nameAr : c.name) : key;
  };

  const statusLabel = (key: string) => {
    const s = activityStatuses.find((x: any) => x.key === key);
    return s ? (ar ? s.nameAr : s.name) : key;
  };
  const [coverPreview, setCoverPreview] = useState("");

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCoverPreview(dataUrl);
      setForm((f) => ({ ...f, coverImage: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const { data: activities, isLoading } = useQuery({
    queryKey: ["activities", activePropertyId],
    queryFn: async () => {
      const r = await fetch(`/api/activities?propertyId=${activePropertyId}`);
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: !!activePropertyId,
  });

  // Fetch registrations for selected activity
  const { data: registrations, isLoading: regLoading } = useQuery({
    queryKey: ["activity-registrations", selectedActivityId],
    queryFn: async () => {
      const r = await fetch(
        `/api/activities/${selectedActivityId}/registrations?propertyId=${activePropertyId}`,
      );
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedActivityId && registrationsOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const r = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, propertyId: activePropertyId }),
      });
      return r.json();
    },
    onSuccess: () => {
      toast.success(ar ? "تم إضافة الفعالية" : "Activity added");
      queryClient.invalidateQueries({
        queryKey: ["activities", activePropertyId],
      });
      setIsOpen(false);
      setForm({
        titleAr: "",
        titleEn: "",
        descriptionAr: "",
        descriptionEn: "",
        category: "social",
        status: "planned",
        startDate: "",
        expiresAt: "",
        locationAr: "",
        locationEn: "",
        coverImage: "",
      });
      setCoverPreview("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(
        `/api/activities/${data.id}?propertyId=${activePropertyId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(ar ? "تم تحديث الفعالية" : "Activity updated");
      queryClient.invalidateQueries({
        queryKey: ["activities", activePropertyId],
      });
      setEditOpen(false);
      setEditForm(null);
    },
    onError: () =>
      toast.error(ar ? "خطأ في التحديث" : "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await fetch(`/api/activities/${id}?propertyId=${activePropertyId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast.success(ar ? "تم حذف الفعالية" : "Activity deleted");
      queryClient.invalidateQueries({
        queryKey: ["activities", activePropertyId],
      });
    },
  });

  const openEdit = (act: any) => {
    setEditForm({
      id: act.id,
      titleAr: act.titleAr || "",
      titleEn: act.titleEn || "",
      descriptionAr: act.descriptionAr || "",
      descriptionEn: act.descriptionEn || "",
      category: act.category || "social",
      status: act.status || "planned",
      startDate: act.startDate || "",
      expiresAt: act.expiresAt || "",
      locationAr: act.locationAr || "",
      locationEn: act.locationEn || "",
      coverImage: act.coverImage || "",
    });
    setCoverPreview(act.coverImage || "");
    setEditOpen(true);
  };

  const handleEditCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCoverPreview(dataUrl);
      setEditForm((f: any) => ({ ...f, coverImage: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold">
            {ar ? "فعاليات الموظفين" : "Staff Activities"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {ar
              ? "تنظيم الفعاليات والأنشطة الترفيهية"
              : "Organize social and recreational events"}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />{" "}
          {ar ? "إضافة فعالية" : "Add Activity"}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activities?.map((act) => (
            <Card
              key={act.id}
              className="overflow-hidden group hover:border-primary/50 transition-colors"
            >
              {act.coverImage && (
                <div className="relative h-36 overflow-hidden">
                  <img
                    src={act.coverImage}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex gap-1 mb-2 flex-wrap">
                    <Badge variant="secondary">
                      {categoryLabel(act.category)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {statusLabel(act.status || "planned")}
                    </Badge>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary"
                      title={ar ? "الحجوزات" : "Registrations"}
                      onClick={() => {
                        setSelectedActivityId(act.id);
                        setRegistrationsOpen(true);
                      }}
                    >
                      <Users className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={ar ? "تعديل" : "Edit"}
                      onClick={() => openEdit(act)}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteMutation.mutate(act.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-base">
                  {ar ? act.titleAr : act.titleEn}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {ar ? act.descriptionAr : act.descriptionEn}
                </p>
                <div className="flex flex-col gap-1.5 pt-2 border-t text-[11px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-3 h-3" /> {act.startDate}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-3 h-3" />{" "}
                    {ar ? act.locationAr : act.locationEn}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {activities?.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl text-muted-foreground">
              {ar ? "لا توجد فعاليات حالية" : "No activities planned yet"}
            </div>
          )}
        </div>
      )}

      {/* Create Activity Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="max-w-2xl"
          srTitle={ar ? "إضافة فعالية جديدة" : "Add New Activity"}
        >
          <DialogHeader>
            <DialogTitle>
              {ar ? "إضافة فعالية جديدة" : "Add New Activity"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>{ar ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
              <Input
                value={form.titleAr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, titleAr: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "العنوان (إنجليزي)" : "Title (English)"}</Label>
              <Input
                value={form.titleEn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, titleEn: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "تاريخ البدء" : "Start Date"}</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>
                {ar
                  ? "تاريخ الاختفاء من البوابة (اختياري)"
                  : "Expires At (Optional)"}
              </Label>
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expiresAt: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "التصنيف" : "Category"}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activityCategories.map((c: any) => (
                    <SelectItem key={c.key || c.id} value={c.key}>
                      {ar ? c.nameAr : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{ar ? "الحالة" : "Status"}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activityStatuses.map((s: any) => (
                    <SelectItem key={s.key} value={s.key}>
                      {ar ? s.nameAr : s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{ar ? "المكان (عربي)" : "Location (Arabic)"}</Label>
              <Input
                value={form.locationAr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, locationAr: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{ar ? "المكان (إنجليزي)" : "Location (English)"}</Label>
              <Input
                value={form.locationEn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, locationEn: e.target.value }))
                }
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>{ar ? "الوصف (عربي)" : "Description (Arabic)"}</Label>
              <Input
                value={form.descriptionAr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descriptionAr: e.target.value }))
                }
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>{ar ? "الوصف (إنجليزي)" : "Description (English)"}</Label>
              <Input
                value={form.descriptionEn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descriptionEn: e.target.value }))
                }
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>{ar ? "صورة الغلاف" : "Cover Image"}</Label>
              <div className="flex items-center gap-4">
                {coverPreview && (
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-border flex-shrink-0">
                    <img
                      src={coverPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="cursor-pointer"
                  />
                  {coverPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setCoverPreview("");
                        setForm((f) => ({ ...f, coverImage: "" }));
                      }}
                      className="text-xs text-destructive mt-1 hover:underline"
                    >
                      {ar ? "إزالة الصورة" : "Remove image"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={() => createMutation.mutate(form)}
            disabled={
              !form.titleAr ||
              !form.titleEn ||
              !form.startDate ||
              createMutation.isPending
            }
          >
            {ar ? "إنشاء الفعالية" : "Create Activity"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Edit Activity Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditForm(null);
        }}
      >
        <DialogContent
          className="max-w-2xl max-h-[85vh] overflow-y-auto"
          srTitle={ar ? "تعديل الفعالية" : "Edit Activity"}
        >
          <DialogHeader>
            <DialogTitle>{ar ? "تعديل الفعالية" : "Edit Activity"}</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>{ar ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
                <Input
                  value={editForm.titleAr}
                  onChange={(e) =>
                    setEditForm((f: any) => ({ ...f, titleAr: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "العنوان (إنجليزي)" : "Title (English)"}</Label>
                <Input
                  value={editForm.titleEn}
                  onChange={(e) =>
                    setEditForm((f: any) => ({ ...f, titleEn: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "تاريخ البدء" : "Start Date"}</Label>
                <Input
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) =>
                    setEditForm((f: any) => ({
                      ...f,
                      startDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "تاريخ الانتهاء" : "Expires At"}</Label>
                <Input
                  type="date"
                  value={editForm.expiresAt}
                  onChange={(e) =>
                    setEditForm((f: any) => ({
                      ...f,
                      expiresAt: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "التصنيف" : "Category"}</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(v) =>
                    setEditForm((f: any) => ({ ...f, category: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activityCategories.map((c: any) => (
                      <SelectItem key={c.key || c.id} value={c.key}>
                        {ar ? c.nameAr : c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{ar ? "الحالة" : "Status"}</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) =>
                    setEditForm((f: any) => ({ ...f, status: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activityStatuses.map((s: any) => (
                      <SelectItem key={s.key} value={s.key}>
                        {ar ? s.nameAr : s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{ar ? "المكان (عربي)" : "Location (Arabic)"}</Label>
                <Input
                  value={editForm.locationAr}
                  onChange={(e) =>
                    setEditForm((f: any) => ({
                      ...f,
                      locationAr: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "المكان (إنجليزي)" : "Location (English)"}</Label>
                <Input
                  value={editForm.locationEn}
                  onChange={(e) =>
                    setEditForm((f: any) => ({
                      ...f,
                      locationEn: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>{ar ? "الوصف (عربي)" : "Description (Arabic)"}</Label>
                <Input
                  value={editForm.descriptionAr}
                  onChange={(e) =>
                    setEditForm((f: any) => ({
                      ...f,
                      descriptionAr: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>
                  {ar ? "الوصف (إنجليزي)" : "Description (English)"}
                </Label>
                <Input
                  value={editForm.descriptionEn}
                  onChange={(e) =>
                    setEditForm((f: any) => ({
                      ...f,
                      descriptionEn: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>{ar ? "صورة الغلاف" : "Cover Image"}</Label>
                <div className="flex items-center gap-4">
                  {coverPreview && (
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-border flex-shrink-0">
                      <img
                        src={coverPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleEditCoverUpload}
                      className="cursor-pointer"
                    />
                  </div>
                </div>
              </div>
              <div className="col-span-2">
                <Button
                  className="w-full"
                  onClick={() => updateMutation.mutate(editForm)}
                  disabled={
                    !editForm.titleAr ||
                    !editForm.titleEn ||
                    updateMutation.isPending
                  }
                >
                  {ar ? "حفظ التغييرات" : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Registrations Dialog */}
      <Dialog open={registrationsOpen} onOpenChange={setRegistrationsOpen}>
        <DialogContent
          className="max-w-2xl max-h-[85vh] overflow-y-auto"
          srTitle={ar ? "الحجوزات" : "Registrations"}
        >
          <DialogHeader>
            <DialogTitle>
              {ar ? "حجوزات الفعالية" : "Activity Registrations"}
            </DialogTitle>
          </DialogHeader>
          {regLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div>
              {registrations && registrations.length > 0 ? (
                <>
                  <div className="flex gap-3 mb-4">
                    <Badge variant="secondary">
                      {registrations.length} {ar ? "محجوز" : "registered"}
                    </Badge>
                    <Badge variant="secondary">
                      {registrations.filter((r: any) => r.attended).length}{" "}
                      {ar ? "حاضر" : "attended"}
                    </Badge>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>{ar ? "الاسم" : "Name"}</TableHead>
                          <TableHead>
                            {ar ? "الرقم الوظيفي" : "Employee Code"}
                          </TableHead>
                          <TableHead>
                            {ar ? "رقم البطاقة" : "National ID"}
                          </TableHead>
                          <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                          <TableHead>{ar ? "الحضور" : "Attendance"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registrations.map((reg: any) => (
                          <TableRow key={reg.id}>
                            <TableCell className="font-medium text-sm">
                              {reg.employeeName}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {reg.employeeCode || "—"}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {reg.nationalId || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  reg.status === "joined"
                                    ? "default"
                                    : "outline"
                                }
                                className="text-[10px]"
                              >
                                {reg.status === "joined"
                                  ? ar
                                    ? "منضم"
                                    : "Joined"
                                  : reg.status === "interested"
                                    ? ar
                                      ? "مهتم"
                                      : "Interested"
                                    : reg.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {reg.attended ? (
                                <Badge className="bg-green-500/10 text-green-600 text-[10px]">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  {ar ? "حاضر" : "Present"}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {ar ? "لا توجد حجوزات بعد" : "No registrations yet"}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Portal Accounts Section ─────────────────────────────────
function PortalAccountsSection() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["portal-accounts", activePropertyId],
    queryFn: async () => {
      const r = await fetch(
        `/api/portal-auth/accounts?propertyId=${activePropertyId}`,
      );
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.accounts ?? []);
    },
    enabled: !!activePropertyId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      employeeId,
      isActive,
    }: {
      employeeId: string;
      isActive: boolean;
    }) => {
      const r = await fetch("/api/portal-auth/toggle-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          isActive,
          propertyId: activePropertyId,
        }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (_, vars) => {
      toast.success(vars.isActive
          ? ar
            ? "تم تفعيل البوابة"
            : "Portal access enabled"
          : ar
            ? "تم تعطيل البوابة"
            : "Portal access disabled");
      queryClient.invalidateQueries({
        queryKey: ["portal-accounts", activePropertyId],
      });
    },
    onError: () =>
      toast.error(ar ? "حدث خطأ" : "Error occurred"),
  });

  const resetMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const r = await fetch("/api/portal-auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, propertyId: activePropertyId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(ar
          ? `تم إعادة تعيين كلمة المرور المؤقتة: ${data.temporaryPassword}`
          : `Temp password: ${data.temporaryPassword}`);
    },
    onError: () =>
      toast.error(ar ? "حدث خطأ" : "Error occurred"),
  });

  const filtered = (accounts || []).filter(
    (a: any) =>
      !search ||
      a.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
      a.employeeId?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            {ar ? "إدارة حسابات البوابة" : "Portal Account Management"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {ar
              ? "تفعيل وتعطيل صلاحية الموظفين للدخول إلى البوابة وإعادة تعيين كلمات المرور"
              : "Enable/disable employee portal access and reset passwords"}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant="outline" className="text-xs">
            {ar
              ? `${(accounts || []).filter((a: any) => a.isActive).length} مفعل`
              : `${(accounts || []).filter((a: any) => a.isActive).length} active`}
          </Badge>
        </div>
      </div>

      <Input
        placeholder={
          ar ? "بحث باسم أو رقم الموظف..." : "Search by name or employee ID..."
        }
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>{ar ? "الموظف" : "Employee"}</TableHead>
                <TableHead>{ar ? "رقم الموظف" : "Employee ID"}</TableHead>
                <TableHead>{ar ? "آخر دخول" : "Last Login"}</TableHead>
                <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                <TableHead className="text-center">
                  {ar ? "الإجراءات" : "Actions"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((acc: any) => (
                <TableRow key={acc.employeeId}>
                  <TableCell className="font-medium text-sm">
                    {acc.employeeName ?? acc.employeeId}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {acc.employeeId}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {acc.lastLoginAt
                      ? new Date(acc.lastLoginAt).toLocaleDateString(
                          ar ? "ar-EG" : "en-GB",
                        )
                      : ar
                        ? "لم يدخل بعد"
                        : "Never"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {acc.isActive ? (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] w-fit">
                          <CheckCircle className="w-3 h-3 me-1" />
                          {ar ? "بوابة مفعلة" : "Portal active"}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-muted-foreground w-fit"
                        >
                          <XCircle className="w-3 h-3 me-1" />
                          {acc.hasAccount
                            ? ar
                              ? "بوابة معطلة"
                              : "Portal disabled"
                            : ar
                              ? "بدون حساب"
                              : "No account"}
                        </Badge>
                      )}
                      {acc.employeeStatus && (
                        <span className="text-[10px] text-muted-foreground">
                          {acc.employeeStatus}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant={acc.isActive ? "outline" : "default"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          toggleMutation.mutate({
                            employeeId: acc.employeeId,
                            isActive: !acc.isActive,
                          })
                        }
                        disabled={toggleMutation.isPending}
                      >
                        {acc.isActive
                          ? ar
                            ? "تعطيل"
                            : "Disable"
                          : ar
                            ? "تفعيل"
                            : "Enable"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => resetMutation.mutate(acc.employeeId)}
                        disabled={resetMutation.isPending}
                      >
                        <RefreshCw className="w-3 h-3 me-1" />
                        {ar ? "إعادة كلمة المرور" : "Reset Password"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-muted-foreground"
                  >
                    {ar
                      ? "لا توجد حسابات بوابة مسجلة"
                      : "No portal accounts found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PortalDocsSection() {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          {ar ? "مستندات البوابة" : "Portal Documents"}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {ar
            ? "إدارة المستندات التي تظهر للموظفين في البوابة"
            : "Manage documents visible to employees in the portal"}
        </p>
      </div>
      <PortalDocuments />
    </div>
  );
}

// ─── Main Portal Page ─────────────────────────────────────────
export default function Portal() {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {ar ? "بوابة الموظفين" : "Employee Portal"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ar
            ? "إدارة التقييمات والفعاليات ومستندات البوابة وجهات الاتصال والتحليلات والجدولة"
            : "Manage evaluations, activities, portal documents, contacts, analytics, and scheduling"}
        </p>
      </div>
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="w-full md:w-auto flex gap-2 whitespace-nowrap mb-8 overflow-x-auto pb-2 scrollbar-hide scroll-smooth">
          <TabsTrigger
            value="analytics"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <BarChart3 className="w-4 h-4" /> {ar ? "التحليلات" : "Analytics"}
          </TabsTrigger>
          <TabsTrigger
            value="accounts"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <Users className="w-4 h-4" /> {ar ? "الحسابات" : "Accounts"}
          </TabsTrigger>
          <TabsTrigger
            value="evaluations"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <Star className="w-4 h-4" /> {ar ? "التقييمات" : "Evaluations"}
          </TabsTrigger>
          <TabsTrigger
            value="activities"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <Trophy className="w-4 h-4" /> {ar ? "الفعاليات" : "Activities"}
          </TabsTrigger>
          <TabsTrigger
            value="contacts"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <Globe className="w-4 h-4" /> {ar ? "جهات الاتصال" : "Contacts"}
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <MessageSquare className="w-4 h-4" />{" "}
            {ar ? "المستندات" : "Documents"}
          </TabsTrigger>

          <TabsTrigger
            value="reports"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <BarChart3 className="w-4 h-4" /> {ar ? "التقارير" : "Reports"}
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <Palette className="w-4 h-4" /> {ar ? "التصنيفات" : "Categories"}
          </TabsTrigger>
          <TabsTrigger
            value="food"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <UtensilsCrossed className="w-4 h-4" /> {ar ? "الطعام" : "Food"}
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="inline-flex items-center gap-2 text-xs lg:text-sm whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4" /> {ar ? "المحادثات" : "Chat"}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="analytics"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <PortalAnalyticsDashboard />
        </TabsContent>

        <TabsContent
          value="accounts"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <PortalAccountsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="evaluations"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <EvaluationsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="activities"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <ActivitiesSection />
        </TabsContent>

        <TabsContent
          value="contacts"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <PortalContactsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="documents"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <PortalDocsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="reports"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <PortalReports />
        </TabsContent>

        <TabsContent
          value="categories"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <PortalCategoriesAndTags />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="food"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <PortalFoodTransport />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="chat"
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <Card>
            <CardContent className="pt-6">
              <PortalChat />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
