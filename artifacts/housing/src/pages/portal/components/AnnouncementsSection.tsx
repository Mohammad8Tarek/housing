import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionGate } from "@/components/ui/permission-gate";
import { ListSkeleton } from "@/components/ui/page-states";
import { formatDate } from "@/lib/date-utils";
import { toast } from "sonner";
import {
  Megaphone,
  Send,
  Trash2,
  Users,
  Building2,
  Loader2,
  BellRing,
} from "lucide-react";

type Announcement = {
  id: number;
  title: string;
  titleAr: string | null;
  message: string;
  messageAr: string | null;
  type: string;
  priority: "low" | "medium" | "high";
  targetAll: boolean;
  department: string | null;
  createdAt: string;
  expiresAt: string | null;
};

const priorityStyle: Record<string, string> = {
  high: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  medium:
    "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  low: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
};

export function AnnouncementsSection() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  const pid =
    typeof activePropertyId === "number" ? activePropertyId : undefined;

  const { data: departments = [] } = useLookupValues(
    pid,
    LOOKUP_CATEGORIES.DEPARTMENT,
  );

  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [message, setMessage] = useState("");
  const [messageAr, setMessageAr] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [target, setTarget] = useState<"all" | "department">("all");
  const [department, setDepartment] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const listKey = ["/api/portal-notifications", pid];
  const { data, isLoading } = useQuery<{ notifications: Announcement[] }>({
    queryKey: listKey,
    queryFn: async () => {
      const res = await fetch(`/api/portal-notifications?propertyId=${pid}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!pid,
  });
  const announcements = data?.notifications ?? [];

  const resetForm = () => {
    setTitle("");
    setTitleAr("");
    setMessage("");
    setMessageAr("");
    setPriority("medium");
    setTarget("all");
    setDepartment("");
    setExpiresAt("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/portal-notifications?propertyId=${pid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          titleAr: titleAr.trim() || undefined,
          message: message.trim(),
          messageAr: messageAr.trim() || undefined,
          type: "announcement",
          priority,
          targetAll: target === "all",
          department: target === "department" ? department : undefined,
          expiresAt: expiresAt
            ? new Date(`${expiresAt}T23:59:59`).toISOString()
            : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.success === false)
        throw new Error(body?.message || "Failed to send");
      return body;
    },
    onSuccess: () => {
      toast.success(
        ar
          ? "تم إرسال الإعلان للمقيمين ✅"
          : "Announcement sent to residents ✅",
      );
      resetForm();
      queryClient.invalidateQueries({ queryKey: listKey });
    },
    onError: (e: any) =>
      toast.error(e?.message || (ar ? "فشل الإرسال" : "Failed to send")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(
        `/api/portal-notifications/${id}?propertyId=${pid}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      toast.success(ar ? "تم حذف الإعلان" : "Announcement deleted");
      queryClient.invalidateQueries({ queryKey: listKey });
    },
    onError: () => toast.error(ar ? "فشل الحذف" : "Failed to delete"),
  });

  const canSubmit =
    !!pid &&
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    (target === "all" || department.length > 0) &&
    !createMutation.isPending;

  if (!pid) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-3">
        <Building2 className="w-12 h-12 text-muted-foreground/50 mx-auto" />
        <p className="text-muted-foreground">
          {ar
            ? "اختر فندقاً محدداً من الأعلى لإرسال إعلان لمقيميه."
            : "Select a specific property above to send an announcement to its residents."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-rose-500" />
        {ar
          ? "ابعث إعلاناً لكل المقيمين أو قسم معيّن — يوصلهم إشعار فوري + داخل البوابة."
          : "Broadcast to all residents or a department — delivered as a push + in-portal notification."}
      </p>

      {/* Compose */}
      <PermissionGate module="portal_notifications" action="create">
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BellRing className="w-4 h-4 text-rose-500" />
              {ar ? "إعلان جديد" : "New announcement"}
            </CardTitle>
            <CardDescription>
              {ar
                ? "العنوان والنص بالعربي أساسي؛ الإنجليزي اختياري."
                : "Arabic title/message is primary; English is optional."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {ar ? "العنوان (عربي)" : "Title (Arabic)"}
                </Label>
                <Input
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  dir="rtl"
                  placeholder={
                    ar ? "مثال: انقطاع المياه غداً" : "عنوان بالعربي"
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {ar ? "العنوان (إنجليزي) *" : "Title (English) *"}
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Water outage tomorrow"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {ar ? "النص (عربي)" : "Message (Arabic)"}
                </Label>
                <Textarea
                  value={messageAr}
                  onChange={(e) => setMessageAr(e.target.value)}
                  dir="rtl"
                  rows={3}
                  placeholder={ar ? "تفاصيل الإعلان بالعربي" : "النص بالعربي"}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {ar ? "النص (إنجليزي) *" : "Message (English) *"}
                </Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Announcement details"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {ar ? "الأولوية" : "Priority"}
                </Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">{ar ? "عاجل" : "High"}</SelectItem>
                    <SelectItem value="medium">
                      {ar ? "عادي" : "Medium"}
                    </SelectItem>
                    <SelectItem value="low">{ar ? "منخفض" : "Low"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  {ar ? "الجمهور المستهدف" : "Audience"}
                </Label>
                <Select
                  value={target}
                  onValueChange={(v) => setTarget(v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {ar ? "كل المقيمين" : "All residents"}
                    </SelectItem>
                    <SelectItem value="department">
                      {ar ? "قسم محدد" : "Specific department"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {target === "department" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {ar ? "القسم" : "Department"}
                  </Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={ar ? "اختر قسماً" : "Select department"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d: any) => (
                        <SelectItem key={d.id} value={d.value}>
                          {ar ? d.valueAr || d.value : d.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {ar ? "تنتهي في (اختياري)" : "Expires (optional)"}
                  </Label>
                  <DateInput value={expiresAt} onChange={setExpiresAt} />
                </div>
              )}
            </div>

            {target === "department" && (
              <div className="space-y-1.5 max-w-[220px]">
                <Label className="text-xs">
                  {ar ? "تنتهي في (اختياري)" : "Expires (optional)"}
                </Label>
                <DateInput value={expiresAt} onChange={setExpiresAt} />
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit}
                className="gap-2"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {ar ? "إرسال الإعلان" : "Send announcement"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </PermissionGate>

      {/* History */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {ar ? "الإعلانات المُرسلة" : "Sent announcements"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ListSkeleton rows={3} />
          ) : announcements.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {ar ? "لا توجد إعلانات بعد." : "No announcements yet."}
            </p>
          ) : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border p-3.5 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {ar ? a.titleAr || a.title : a.title}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${priorityStyle[a.priority]}`}
                      >
                        {a.priority === "high"
                          ? ar
                            ? "عاجل"
                            : "High"
                          : a.priority === "low"
                            ? ar
                              ? "منخفض"
                              : "Low"
                            : ar
                              ? "عادي"
                              : "Medium"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 gap-1"
                      >
                        {a.targetAll || !a.department ? (
                          <>
                            <Users className="w-3 h-3" />
                            {ar ? "الكل" : "All"}
                          </>
                        ) : (
                          <>
                            <Building2 className="w-3 h-3" />
                            {a.department}
                          </>
                        )}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {ar ? a.messageAr || a.message : a.message}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">
                      {formatDate(a.createdAt)}
                      {a.expiresAt
                        ? ` · ${ar ? "تنتهي" : "expires"} ${formatDate(a.expiresAt)}`
                        : ""}
                    </p>
                  </div>
                  <PermissionGate module="portal_notifications" action="delete">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(a.id)}
                      className="text-muted-foreground hover:text-rose-600 shrink-0"
                      title={ar ? "حذف" : "Delete"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </PermissionGate>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
