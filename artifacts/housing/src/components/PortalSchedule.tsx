import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Plus,
  Zap,
} from "lucide-react";

export default function PortalSchedule() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [isOpen, setIsOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    titleAr: "",
    type: "evaluation",
    startTime: "",
    priority: "medium",
    location: "",
  });

  const { data: schedule, isLoading } = useQuery({
    queryKey: ["portal-schedule", activePropertyId, currentMonth, currentYear],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-schedule?propertyId=${activePropertyId}&month=${currentMonth + 1}&year=${currentYear}`,
      );
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  const { data: calendar } = useQuery({
    queryKey: ["portal-calendar", activePropertyId],
    queryFn: async () => {
      const fromDate = new Date(currentYear, currentMonth, 1).toISOString();
      const toDate = new Date(currentYear, currentMonth + 1, 0).toISOString();
      const res = await fetch(
        `/api/portal-schedule/calendar?propertyId=${activePropertyId}&from=${fromDate}&to=${toDate}`,
      );
      if (!res.ok) throw new Error("Failed to fetch calendar");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  const { data: reminders } = useQuery({
    queryKey: ["portal-reminders", activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-schedule/reminders?propertyId=${activePropertyId}`,
      );
      if (!res.ok) throw new Error("Failed to fetch reminders");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/portal-schedule/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, propertyId: activePropertyId }),
      });
      if (!res.ok) throw new Error("Failed to create event");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["portal-calendar", activePropertyId],
      });
      toast.success(ar ? "تم إنشاء الحدث" : "Event created");
      setIsOpen(false);
      setNewEvent({
        title: "",
        titleAr: "",
        type: "evaluation",
        startTime: "",
        priority: "medium",
        location: "",
      });
    },
  });

  const snoozeReminderMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/portal-schedule/reminders/${id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 30, propertyId: activePropertyId }),
      });
      if (!res.ok) throw new Error("Failed to snooze reminder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["portal-reminders", activePropertyId],
      });
      toast.success(ar
          ? "تم تأجيل التذكير لمدة 30 دقيقة"
          : "Reminder snoozed for 30 minutes");
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full rounded-lg" />;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900/30";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "evaluation":
        return "📋";
      case "activity":
        return "🎯";
      case "deadline":
        return "⏰";
      case "reminder":
        return "🔔";
      default:
        return "📅";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            {ar ? "جدول البوابة" : "Portal Schedule"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {ar
              ? "جدول الفعاليات والاستبيانات والمواعيد الأساسية"
              : "Schedule events, evaluations, and deadlines"}
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> {ar ? "حدث جديد" : "New Event"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {ar ? "إضافة حدث جديد" : "Add New Event"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{ar ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
                <Input
                  value={newEvent.titleAr}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, titleAr: e.target.value })
                  }
                  placeholder={
                    ar ? "مثال: استبيان المشاركة" : "e.g. Employee Survey"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "العنوان (إنجليزي)" : "Title (English)"}</Label>
                <Input
                  value={newEvent.title}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, title: e.target.value })
                  }
                  placeholder="e.g. Engagement Survey"
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "النوع" : "Type"}</Label>
                <Select
                  value={newEvent.type}
                  onValueChange={(v) => setNewEvent({ ...newEvent, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evaluation">
                      {ar ? "استبيان" : "Evaluation"}
                    </SelectItem>
                    <SelectItem value="activity">
                      {ar ? "فعالية" : "Activity"}
                    </SelectItem>
                    <SelectItem value="deadline">
                      {ar ? "موعد نهائي" : "Deadline"}
                    </SelectItem>
                    <SelectItem value="reminder">
                      {ar ? "تذكير" : "Reminder"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{ar ? "التاريخ والوقت" : "Date & Time"}</Label>
                <Input
                  type="datetime-local"
                  value={newEvent.startTime}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, startTime: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "الأولوية" : "Priority"}</Label>
                <Select
                  value={newEvent.priority}
                  onValueChange={(v) =>
                    setNewEvent({ ...newEvent, priority: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{ar ? "منخفضة" : "Low"}</SelectItem>
                    <SelectItem value="medium">
                      {ar ? "متوسطة" : "Medium"}
                    </SelectItem>
                    <SelectItem value="high">
                      {ar ? "عالية" : "High"}
                    </SelectItem>
                    <SelectItem value="critical">
                      {ar ? "حرجة" : "Critical"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => createEventMutation.mutate(newEvent)}
                disabled={!newEvent.title || !newEvent.startTime}
              >
                {ar ? "إنشاء الحدث" : "Create Event"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {schedule?.upcomingDeadlines?.length || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              {ar ? "مواعيد نهائية" : "Upcoming Deadlines"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {schedule?.priorityItems?.filter(
                (p: any) => p.priority === "high",
              ).length || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              {ar ? "عالية الأولوية" : "High Priority Items"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {reminders?.today?.length || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              {ar ? "تذكيرات اليوم" : "Today's Reminders"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {new Date(currentYear, currentMonth).toLocaleDateString(
                ar ? "ar-EG" : "en-GB",
                {
                  month: "long",
                  year: "numeric",
                },
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (currentMonth === 0) {
                    setCurrentMonth(11);
                    setCurrentYear(currentYear - 1);
                  } else {
                    setCurrentMonth(currentMonth - 1);
                  }
                }}
              >
                ←
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (currentMonth === 11) {
                    setCurrentMonth(0);
                    setCurrentYear(currentYear + 1);
                  } else {
                    setCurrentMonth(currentMonth + 1);
                  }
                }}
              >
                →
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-4">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center text-xs font-bold p-2">
                {ar
                  ? {
                      Sun: "ح",
                      Mon: "ن",
                      Tue: "ث",
                      Wed: "أ",
                      Thu: "خ",
                      Fri: "ج",
                      Sat: "س",
                    }[day]
                  : day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2"></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const hasEvents = calendar?.events?.some(
                (e: any) => new Date(e.startTime).getDate() === day,
              );
              return (
                <div
                  key={day}
                  className={`p-2 rounded border text-center text-xs font-medium cursor-pointer transition-colors ${
                    hasEvents
                      ? "bg-primary/20 border-primary text-primary font-bold"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {day}
                  {hasEvents && <div className="text-[6px] mt-0.5">•••</div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="w-5 h-5 text-amber-500" />
            {ar ? "الأحداث القادمة" : "Upcoming Events"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {calendar?.events && calendar.events.length > 0 ? (
            <div className="space-y-2">
              {calendar.events.slice(0, 8).map((event: any) => (
                <div
                  key={event.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border-l-4 bg-card ${
                    event.priority === "critical"
                      ? "border-l-red-500"
                      : event.priority === "high"
                        ? "border-l-orange-500"
                        : event.priority === "medium"
                          ? "border-l-yellow-500"
                          : "border-l-blue-500"
                  }`}
                >
                  <span className="text-lg">{getTypeIcon(event.type)}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">
                      {event.title || event.titleAr}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(event.startTime).toLocaleString()}
                      </span>
                      <Badge
                        className={`text-xs ${getPriorityColor(event.priority)}`}
                      >
                        {event.priority}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {ar ? "لا توجد أحداث قادمة" : "No upcoming events"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reminders */}
      {reminders &&
        (reminders.today?.length > 0 || reminders.tomorrow?.length > 0) && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-amber-900 dark:text-amber-400">
                <AlertCircle className="w-5 h-5" />
                {ar ? "التذكيرات" : "Reminders"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reminders.today?.map((reminder: any) => (
                <div
                  key={reminder.id}
                  className="flex items-center justify-between p-2 rounded bg-white dark:bg-card"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm">{reminder.title}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => snoozeReminderMutation.mutate(reminder.id)}
                    className="text-xs"
                  >
                    {ar ? "تأجيل" : "Snooze"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
    </div>
  );
}
