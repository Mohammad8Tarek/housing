import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { useDebounce } from "@/hooks/use-debounce";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  WorkerDialog,
  Worker,
  WORKER_SPECIALTIES,
  WORKER_STATUSES,
} from "./WorkerDialog";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Search,
  Wrench,
  Zap,
  Droplet,
  Wind,
  Hammer,
  Sparkles,
  Paintbrush,
  Tv,
  Phone,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Building,
  DollarSign,
  MoreVertical,
  Edit2,
  Trash2,
  LayoutGrid,
  List,
  Filter,
  RefreshCw,
  HardHat,
} from "lucide-react";

interface WorkersTabProps {
  propertyId: number;
  propertyName?: string;
  onFilterByWorker?: (workerId: number) => void;
}

export function WorkersTab({
  propertyId,
  propertyName,
  onFilterByWorker,
}: WorkersTabProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workerTypeFilter, setWorkerTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null);
  const [deleting, setDeleting] = useState(false);

  // جلب الفنيين للعقار النشط
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: [
      "/api/workers",
      propertyId,
      debouncedSearch,
      specialtyFilter,
      statusFilter,
      workerTypeFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        propertyId: String(propertyId),
      });
      if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());
      if (specialtyFilter !== "all") params.append("specialty", specialtyFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (workerTypeFilter !== "all") params.append("workerType", workerTypeFilter);

      const res = await fetch(`/api/workers?${params.toString()}`);
      if (!res.ok) {
        throw new Error(ar ? "فشل جلب قائمة الفنيين" : "Failed to load workers");
      }
      return res.json();
    },
    enabled: !!propertyId,
  });

  const workers: Worker[] = data?.data || [];

  // إحصائيات سريعة للفنيين
  const stats = useMemo(() => {
    const total = workers.length;
    const available = workers.filter((w) => w.status === "available").length;
    const busy = workers.filter((w) => w.status === "busy").length;
    const onLeave = workers.filter((w) => w.status === "on_leave" || w.status === "inactive").length;
    const activeTasks = workers.reduce((sum, w) => sum + (w.activeTasksCount || 0), 0);
    return { total, available, busy, onLeave, activeTasks };
  }, [workers]);

  // خريطة أيقونات وتسميات التخصص
  const specialtyMap = useMemo(() => {
    const map: Record<string, { labelAr: string; labelEn: string; icon: any }> = {};
    for (const s of WORKER_SPECIALTIES) {
      map[s.key] = s;
    }
    return map;
  }, []);

  const getSpecialtyBadge = (key: string) => {
    const item = specialtyMap[key] || {
      labelAr: key,
      labelEn: key,
      icon: Wrench,
    };
    const Icon = item.icon;
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{ar ? item.labelAr : item.labelEn}</span>
      </span>
    );
  };

  const getStatusBadge = (stKey: string) => {
    switch (stKey) {
      case "available":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{ar ? "متاح للعمل" : "Available"}</span>
          </span>
        );
      case "busy":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>{ar ? "مشغول في مهمة" : "Busy"}</span>
          </span>
        );
      case "on_leave":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>{ar ? "في إجازة" : "On Leave"}</span>
          </span>
        );
      case "inactive":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>{ar ? "غير نشط" : "Inactive"}</span>
          </span>
        );
    }
  };

  // معالجة تغيير الحالة سريعاً
  const handleQuickStatusChange = async (workerId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/workers/${workerId}?propertyId=${propertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success(ar ? "تم تحديث حالة الفني" : "Worker status updated");
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
    } catch (err: any) {
      toast.error(err.message || (ar ? "فشل التحديث" : "Failed to update"));
    }
  };

  // معالجة الحذف
  const handleDeleteWorker = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/workers/${deleteTarget.id}?propertyId=${propertyId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (ar ? "فشل حذف الفني" : "Failed to delete"));
      }
      toast.success(ar ? "تم حذف الفني بنجاح" : "Worker deleted successfully");
      await queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || (ar ? "حدث خطأ" : "An error occurred"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-card border rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {ar ? "إجمالي الفنيين والعمال" : "Total Technicians"}
            </span>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-foreground">
              {stats.total}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <span>{propertyName || (ar ? "الفندق النشط" : "Active Property")}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <HardHat className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl p-4 shadow-xs flex items-center justify-between bg-gradient-to-br from-emerald-50/40 to-transparent dark:from-emerald-950/20">
          <div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {ar ? "متاحون للعمل فوراً" : "Available Workers"}
            </span>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-emerald-700 dark:text-emerald-300">
              {stats.available}
            </div>
            <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span>{ar ? "جاهزون لاستلام بلاغات" : "Ready for tasks"}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-4 shadow-xs flex items-center justify-between bg-gradient-to-br from-amber-50/40 to-transparent dark:from-amber-950/20">
          <div>
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {ar ? "في مهام نشطة حالياً" : "Busy on Tasks"}
            </span>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-amber-700 dark:text-amber-300">
              {stats.busy}
            </div>
            <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              <span>{ar ? `${stats.activeTasks} مهمة قيد الإصلاح` : `${stats.activeTasks} active tasks`}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {ar ? "إجازة / غير نشط" : "On Leave / Inactive"}
            </span>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-foreground">
              {stats.onLeave}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span>{ar ? "خارج جدول العمل" : "Off schedule"}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-muted/80 flex items-center justify-center text-muted-foreground">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar & Filters Bar */}
      <div className="bg-card border rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                ar
                  ? "البحث باسم الفني، الهاتف، التخصص، أو الشركة..."
                  : "Search worker by name, phone, specialty, contractor..."
              }
              className="h-9 text-xs pl-9 rtl:pr-9 rtl:pl-3"
            />
          </div>

          {/* Action Buttons & View Mode */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-0.5 bg-muted/80 dark:bg-muted/40 rounded-lg border">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md text-xs transition-all ${
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={ar ? "عرض البطاقات" : "Grid Cards View"}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md text-xs transition-all ${
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={ar ? "عرض الجدول" : "Table View"}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-9 px-2.5 text-xs gap-1"
              title={ar ? "تحديث" : "Refresh"}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>

            <PermissionGate module="maintenance" action="create">
              <Button
                size="sm"
                onClick={() => {
                  setSelectedWorker(null);
                  setDialogOpen(true);
                }}
                className="h-9 px-3 text-xs gap-1.5 font-semibold"
              >
                <UserPlus className="w-4 h-4" />
                <span>{ar ? "إضافة فني جديد" : "Add Worker"}</span>
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            <span>{ar ? "تصفية حسب:" : "Filter by:"}</span>
          </div>

          {/* Specialty Filter */}
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue placeholder={ar ? "التخصص" : "Specialty"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل التخصصات" : "All Specialties"}</SelectItem>
              {WORKER_SPECIALTIES.map((sp) => (
                <SelectItem key={sp.key} value={sp.key}>
                  {ar ? sp.labelAr : sp.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue placeholder={ar ? "الحالة" : "Status"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل الحالات" : "All Statuses"}</SelectItem>
              {WORKER_STATUSES.map((st) => (
                <SelectItem key={st.key} value={st.key}>
                  {ar ? st.labelAr : st.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Worker Type Filter */}
          <Select value={workerTypeFilter} onValueChange={setWorkerTypeFilter}>
            <SelectTrigger className="h-8 text-xs w-[130px]">
              <SelectValue placeholder={ar ? "النوع" : "Type"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "الكل (داخلي ومقاول)" : "All Types"}</SelectItem>
              <SelectItem value="internal">{ar ? "فني داخلي" : "Internal Staff"}</SelectItem>
              <SelectItem value="contractor">{ar ? "مقاول خارجي" : "Contractor"}</SelectItem>
            </SelectContent>
          </Select>

          {(specialtyFilter !== "all" || statusFilter !== "all" || workerTypeFilter !== "all" || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSpecialtyFilter("all");
                setStatusFilter("all");
                setWorkerTypeFilter("all");
                setSearch("");
              }}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {ar ? "مسح الفلاتر" : "Reset"}
            </Button>
          )}

          <div className="ms-auto text-xs text-muted-foreground">
            {ar ? `عرض ${workers.length} فني` : `Showing ${workers.length} workers`}
          </div>
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-4 border rounded-xl space-y-3 bg-card">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : workers.length === 0 ? (
        /* Empty State */
        <div className="bg-card border rounded-xl p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            {ar ? "لا يوجد فنيون مسجلون لهذا الفندق بعد" : "No workers registered for this property"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {ar
              ? "يمكنك البدء بإضافة الفنيين والمقاولين التابعين لهذا الفندق لتعيينهم فوراً في بلاغات الصيانة والهاوس كيبنج."
              : "Start by registering maintenance technicians and contractors for this property to assign them work orders directly."}
          </p>
          <PermissionGate module="maintenance" action="create">
            <Button
              size="sm"
              onClick={() => {
                setSelectedWorker(null);
                setDialogOpen(true);
              }}
              className="mt-2 text-xs gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>{ar ? "إضافة فني الآن" : "Add Worker Now"}</span>
            </Button>
          </PermissionGate>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((w) => {
            const phoneClean = (w.phone || "").replace(/[^0-9+]/g, "");
            return (
              <div
                key={w.id}
                className="bg-card border rounded-xl p-4 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all flex flex-col justify-between relative group"
              >
                <div>
                  {/* Top Bar: Specialty Badge, Status, and Actions Dropdown */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>{getSpecialtyBadge(w.specialty)}</div>

                    <div className="flex items-center gap-1">
                      {getStatusBadge(w.status)}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs">
                          <PermissionGate module="maintenance" action="edit">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedWorker(w);
                                setDialogOpen(true);
                              }}
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-2 rtl:ml-2 text-primary" />
                              <span>{ar ? "تعديل البيانات" : "Edit Worker"}</span>
                            </DropdownMenuItem>
                          </PermissionGate>

                          <DropdownMenuSeparator />
                          {/* Quick Status Submenu */}
                          <DropdownMenuItem
                            onClick={() => handleQuickStatusChange(w.id!, "available")}
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 rtl:ml-2" />
                            <span>{ar ? "تعيين: متاح للعمل" : "Set Available"}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleQuickStatusChange(w.id!, "busy")}
                          >
                            <span className="w-2 h-2 rounded-full bg-amber-500 mr-2 rtl:ml-2" />
                            <span>{ar ? "تعيين: مشغول في مهمة" : "Set Busy"}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleQuickStatusChange(w.id!, "on_leave")}
                          >
                            <span className="w-2 h-2 rounded-full bg-blue-500 mr-2 rtl:ml-2" />
                            <span>{ar ? "تعيين: في إجازة" : "Set On Leave"}</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <PermissionGate module="maintenance" action="delete">
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(w)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2 rtl:ml-2" />
                              <span>{ar ? "حذف الفني" : "Delete Worker"}</span>
                            </DropdownMenuItem>
                          </PermissionGate>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Worker Name & Worker Type */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full bg-muted/80 border flex items-center justify-center font-bold text-sm text-foreground shrink-0 shadow-2xs">
                      {w.name
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-foreground truncate">
                        {w.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {w.workerType === "contractor" ? (
                            <span className="text-amber-700 dark:text-amber-400 font-medium">
                              {ar ? "مقاول خارجي" : "Contractor"}
                              {w.companyName ? ` (${w.companyName})` : ""}
                            </span>
                          ) : (
                            <span className="text-blue-700 dark:text-blue-400 font-medium">
                              {ar ? "فني داخلي" : "Internal Staff"}
                            </span>
                          )}
                        </span>
                        {w.dailyRate && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                            {w.dailyRate} {ar ? "ج.م/يوم" : "EGP/d"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Work Orders Stats Badges */}
                  <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-lg bg-muted/30 border text-xs">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground">
                        {ar ? "مهام قيد الإصلاح" : "Active Tasks"}
                      </span>
                      <span className="font-bold text-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" />
                        {w.activeTasksCount || 0}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground">
                        {ar ? "إجمالي المهام المنجزة" : "Total Handled"}
                      </span>
                      <span className="font-bold text-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {w.totalTasksCount || 0}
                      </span>
                    </div>
                  </div>

                  {/* Notes Snippet */}
                  {w.notes && (
                    <p className="text-[11px] text-muted-foreground/80 line-clamp-1 italic mb-3">
                      {w.notes}
                    </p>
                  )}
                </div>

                {/* Bottom Actions: Call & WhatsApp */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                  {w.phone ? (
                    <>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs gap-1.5 hover:text-primary hover:border-primary/40"
                      >
                        <a href={`tel:${phoneClean}`}>
                          <Phone className="w-3.5 h-3.5 text-blue-600" />
                          <span>{ar ? "اتصال" : "Call"}</span>
                        </a>
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs gap-1.5 hover:text-emerald-600 hover:border-emerald-500/40"
                      >
                        <a
                          href={`https://wa.me/${phoneClean.startsWith("0") ? "2" + phoneClean : phoneClean}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{ar ? "واتساب" : "WhatsApp"}</span>
                        </a>
                      </Button>
                    </>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/60 w-full text-center py-1">
                      {ar ? "لا يوجد رقم هاتف مسجل" : "No phone number registered"}
                    </span>
                  )}

                  {onFilterByWorker && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onFilterByWorker(w.id!)}
                      className="h-8 px-2 text-xs text-primary"
                      title={ar ? "عرض تذاكر هذا الفني" : "Filter tickets by worker"}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
          <Table className="table-fixed">
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-16 font-semibold">#</TableHead>
                <TableHead className="w-48 font-semibold">
                  {ar ? "اسم الفني والنوع" : "Worker Name & Type"}
                </TableHead>
                <TableHead className="w-36 font-semibold">
                  {ar ? "التخصص" : "Specialty"}
                </TableHead>
                <TableHead className="w-32 font-semibold">
                  {ar ? "الحالة" : "Status"}
                </TableHead>
                <TableHead className="w-48 font-semibold">
                  {ar ? "الهاتف والتواصل" : "Phone & Contact"}
                </TableHead>
                <TableHead className="w-32 font-semibold text-center">
                  {ar ? "مهام جارية" : "Active Tasks"}
                </TableHead>
                <TableHead className="w-32 font-semibold text-center">
                  {ar ? "إجمالي المهام" : "Total Tasks"}
                </TableHead>
                <TableHead className="w-24 font-semibold text-end">
                  {ar ? "الإجراءات" : "Actions"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((w) => {
                const phoneClean = (w.phone || "").replace(/[^0-9+]/g, "");
                return (
                  <TableRow key={w.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-xs text-muted-foreground font-semibold">
                      #{w.id}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">{w.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {w.workerType === "contractor"
                            ? `${ar ? "مقاول" : "Contractor"}${w.companyName ? ` • ${w.companyName}` : ""}`
                            : ar ? "فني داخلي" : "Internal"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>{getSpecialtyBadge(w.specialty)}</TableCell>

                    <TableCell>{getStatusBadge(w.status)}</TableCell>

                    <TableCell>
                      {w.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-foreground dir-ltr">
                            {w.phone}
                          </span>
                          <a
                            href={`https://wa.me/${phoneClean.startsWith("0") ? "2" + phoneClean : phoneClean}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-700 p-1"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-center font-bold text-foreground">
                      <span className={`inline-flex items-center gap-1 ${w.activeTasksCount ? "text-amber-600 font-bold" : "text-muted-foreground"}`}>
                        <Clock className="w-3 h-3" />
                        {w.activeTasksCount || 0}
                      </span>
                    </TableCell>

                    <TableCell className="text-center font-semibold text-foreground">
                      {w.totalTasksCount || 0}
                    </TableCell>

                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <PermissionGate module="maintenance" action="edit">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => {
                              setSelectedWorker(w);
                              setDialogOpen(true);
                            }}
                            title={ar ? "تعديل" : "Edit"}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>

                        <PermissionGate module="maintenance" action="delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-600"
                            onClick={() => setDeleteTarget(w)}
                            title={ar ? "حذف" : "Delete"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit Worker Modal Dialog */}
      <WorkerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        worker={selectedWorker}
        propertyId={propertyId}
        onSuccess={() => refetch()}
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>{ar ? "تأكيد حذف الفني" : "Confirm Worker Deletion"}</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? `هل أنت متأكد من رغبتك في حذف الفني "${deleteTarget?.name}"؟ سيتم فك ارتباطه بأي أوامر عمل قادمة.`
                : `Are you sure you want to delete worker "${deleteTarget?.name}"? Future work order associations will be removed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {ar ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorker}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (ar ? "جاري الحذف..." : "Deleting...") : (ar ? "نعم، احذف" : "Yes, Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
