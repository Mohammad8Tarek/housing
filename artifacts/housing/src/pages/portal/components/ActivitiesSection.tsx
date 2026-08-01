//@ts-nocheck
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

export function ActivitiesSection() {
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
    onError: () => toast.error(ar ? "خطأ في التحديث" : "Update failed"),
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
