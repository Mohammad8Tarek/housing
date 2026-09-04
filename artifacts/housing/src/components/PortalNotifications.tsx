// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  X,
  AlertCircle,
  Info,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Megaphone,
  Calendar,
  Star,
  FileText,
  RefreshCw,
} from "lucide-react";

const TYPE_ICONS = {
  activity: <Calendar className="w-4 h-4 text-green-500" />,
  evaluation: <Star className="w-4 h-4 text-amber-500" />,
  document: <FileText className="w-4 h-4 text-blue-500" />,
  announcement: <Megaphone className="w-4 h-4 text-purple-500" />,
};

const PRIORITY_BADGE = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30",
};

const EMPTY_FORM = {
  title: "",
  titleAr: "",
  message: "",
  messageAr: "",
  type: "announcement",
  priority: "medium",
  targetAll: true,
  department: "",
  expiresAt: "",
};

export default function PortalNotifications() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // ── Fetch notifications list ───────────────────────────────────
  const {
    data: notifsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["portal-notifications-admin", activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-notifications?propertyId=${activePropertyId}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      return d.notifications ?? d ?? [];
    },
    enabled: !!activePropertyId,
  });
  const notifications: any[] = Array.isArray(notifsData) ? notifsData : [];

  // ── Fetch stats ────────────────────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ["portal-notifications-stats-admin", activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-notifications/stats?propertyId=${activePropertyId}`,
        { credentials: "include" },
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  // ── Create notification ────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(
        `/api/portal-notifications?propertyId=${activePropertyId}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, propertyId: activePropertyId }),
        },
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success(ar ? "تم إنشاء الإشعار بنجاح" : "Notification created successfully");
      queryClient.invalidateQueries({
        queryKey: ["portal-notifications-admin", activePropertyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["portal-notifications-stats-admin", activePropertyId],
      });
      setShowCreate(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast.error(ar ? "خطأ في الإنشاء" : "Creation failed"),
  });

  // ── Delete notification ────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(
        `/api/portal-notifications/${id}?propertyId=${activePropertyId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success(ar ? "تم الحذف" : "Deleted");
      queryClient.invalidateQueries({
        queryKey: ["portal-notifications-admin", activePropertyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["portal-notifications-stats-admin", activePropertyId],
      });
    },
    onError: () => toast.error(ar ? "فشل الحذف" : "Delete failed"),
  });

  const handleCreate = () => {
    if (!form.title || !form.message) {
      toast.error(
        ar ? "العنوان والرسالة مطلوبان" : "Title and message are required",
      );
      return;
    }
    createMutation.mutate({
      title: form.title,
      titleAr: form.titleAr || form.title,
      message: form.message,
      messageAr: form.messageAr || form.message,
      type: form.type,
      priority: form.priority,
      targetAll: form.targetAll,
      department: form.department || undefined,
      expiresAt: form.expiresAt
        ? new Date(form.expiresAt).toISOString()
        : undefined,
    });
  };

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            {ar ? "الإشعارات" : "Notifications"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {ar
              ? "إدارة إشعارات البوابة وإرسالها للموظفين"
              : "Manage and send portal notifications to profiles"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {ar ? "إشعار جديد" : "New Notification"}
          </Button>
        </div>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: ar ? "إجمالي" : "Total", value: stats.total, color: "" },
            {
              label: ar ? "عالية" : "High",
              value: stats.byPriority?.high ?? 0,
              color: "text-red-600",
            },
            {
              label: ar ? "متوسطة" : "Medium",
              value: stats.byPriority?.medium ?? 0,
              color: "text-amber-600",
            },
            {
              label: ar ? "منخفضة" : "Low",
              value: stats.byPriority?.low ?? 0,
              color: "text-blue-600",
            },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-4 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Notifications List ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {ar ? "الإشعارات المُرسلة" : "Sent Notifications"}
          </CardTitle>
          <CardDescription>
            {ar
              ? "قائمة بكل الإشعارات المُرسلة للموظفين"
              : "All notifications sent to profiles"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {ar
                  ? "لا توجد إشعارات بعد. اضغط «إشعار جديد» لإنشاء أول إشعار."
                  : "No notifications yet. Click «New Notification» to create one."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n: any) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors group"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {TYPE_ICONS[n.type] ?? <Bell className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm">
                        {ar ? n.titleAr || n.title : n.title}
                      </span>
                      <Badge
                        className={`text-[10px] px-1.5 py-0 ${PRIORITY_BADGE[n.priority] ?? ""}`}
                      >
                        {ar
                          ? ({ high: "عالية", medium: "متوسطة", low: "منخفضة" }[
                              n.priority
                            ] ?? n.priority)
                          : n.priority}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {ar
                          ? ({
                              activity: "فعالية",
                              evaluation: "استبيان",
                              document: "مستند",
                              announcement: "إعلان",
                            }[n.type] ?? n.type)
                          : n.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {ar ? n.messageAr || n.message : n.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {n.createdAt ? formatDateTime(n.createdAt) : ""}
                        {n.expiresAt
                          ? ` · ${ar ? "ينتهي" : "expires"}: ${formatDate(n.expiresAt)}`
                          : ""}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                        onClick={() => deleteMutation.mutate(n.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create Dialog ──────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              {ar ? "إنشاء إشعار جديد" : "Create New Notification"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{ar ? "العنوان بالإنجليزية *" : "Title (English) *"}</Label>
                <Input
                  placeholder="Enter title..."
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "العنوان بالعربية" : "Title (Arabic)"}</Label>
                <Input
                  placeholder="أدخل العنوان..."
                  value={form.titleAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, titleAr: e.target.value }))
                  }
                  dir="rtl"
                />
              </div>
            </div>

            {/* Message */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{ar ? "الرسالة بالإنجليزية *" : "Message (English) *"}</Label>
                <Textarea
                  placeholder="Enter message..."
                  rows={3}
                  value={form.message}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, message: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "الرسالة بالعربية" : "Message (Arabic)"}</Label>
                <Textarea
                  placeholder="أدخل الرسالة..."
                  rows={3}
                  value={form.messageAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, messageAr: e.target.value }))
                  }
                  dir="rtl"
                />
              </div>
            </div>

            {/* Type & Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{ar ? "النوع" : "Type"}</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">
                      {ar ? "إعلان" : "Announcement"}
                    </SelectItem>
                    <SelectItem value="activity">
                      {ar ? "فعالية" : "Activity"}
                    </SelectItem>
                    <SelectItem value="evaluation">
                      {ar ? "استبيان" : "Evaluation"}
                    </SelectItem>
                    <SelectItem value="document">
                      {ar ? "مستند" : "Document"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "الأولوية" : "Priority"}</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">
                      {ar ? "عالية" : "High"}
                    </SelectItem>
                    <SelectItem value="medium">
                      {ar ? "متوسطة" : "Medium"}
                    </SelectItem>
                    <SelectItem value="low">{ar ? "منخفضة" : "Low"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Expiry */}
            <div className="space-y-1.5">
              <Label>
                {ar ? "تاريخ الانتهاء (اختياري)" : "Expiry Date (Optional)"}
              </Label>
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expiresAt: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending ? (
                ar ? (
                  "جاري الإرسال..."
                ) : (
                  "Sending..."
                )
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  {ar ? "إرسال الإشعار" : "Send Notification"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
