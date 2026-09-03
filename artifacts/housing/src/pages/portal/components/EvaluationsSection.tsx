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

export function EvaluationsSection() {
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
    stats?.responded ?? evals.filter((ev) => ev.profileRating != null).length;
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
            {ar ? "استبيانات الموظفين" : "Profile Surveys"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {ar
              ? "إنشاء استبيانات وتقييمات يشارك فيها الموظفون"
              : "Create surveys and evaluations for profiles to rate"}
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
                  : "After this date, profiles will no longer see this evaluation"}
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
                    : "No questions added yet. Profiles will see a general rating only."}
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
                            {resp.profileName?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {resp.profileName}
                            </p>
                            {resp.profileCode && (
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {resp.profileCode}
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
