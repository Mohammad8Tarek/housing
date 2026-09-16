import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { usePermission } from "@/hooks/use-permission";
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
  const { can, isSuperAdmin, isAdmin } = usePermission();

  const canMnt = isSuperAdmin || isAdmin || can("maintenance", "view") || can("workers", "view");
  const canHsk = isSuperAdmin || isAdmin || can("housekeeping", "view");
  const hasBoth = canMnt && canHsk;

  const [departmentFilter, setDepartmentFilter] = useState<string>(() => {
    if (canHsk && !canMnt) return "housekeeping";
    if (canMnt && !canHsk) return "maintenance";
    return "all";
  });

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [workerTypeFilter, setWorkerTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const availableSpecialties = useMemo(() => {
    if (departmentFilter === "housekeeping") {
      return WORKER_SPECIALTIES.filter((s) => s.key === "housekeeping");
    }
    if (departmentFilter === "maintenance") {
      return WORKER_SPECIALTIES.filter((s) => s.key !== "housekeeping");
    }
    return WORKER_SPECIALTIES;
  }, [departmentFilter]);

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
      workerTypeFilter,
      departmentFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        propertyId: String(propertyId),
      });
      if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());
      if (departmentFilter !== "all") params.append("department", departmentFilter);
      if (specialtyFilter !== "all") params.append("specialty", specialtyFilter);
      if (workerTypeFilter !== "all") params.append("workerType", workerTypeFilter);

      const res = await fetch(`/api/workers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch workers");
      return res.json();
    },
    enabled: !!propertyId,
  });

  const workers: Worker[] = data?.data || [];

  // إحصائيات سريعة للفنيين
  const totalWorkers = workers.length;
  const stats = useMemo(() => {
    const available = workers.filter((w) => w.status === "available").length;
    const busy = workers.filter((w) => w.status === "busy").length;
    const onLeave = workers.filter((w) => w.status === "on_leave" || w.status === "inactive").length;
    const activeTasks = workers.reduce((sum, w) => sum + (w.activeTasksCount || 0), 0);
    return { available, busy, onLeave, activeTasks };
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
      {/* Header & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border rounded-xl p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <HardHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                {ar ? "سجل فريق الصيانة والفنيين" : "Technicians & Maintenance Team"}
              </h2>
              <Badge variant="secondary" className="font-mono text-xs">
                {totalWorkers} {ar ? "فني" : "workers"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {propertyName ? `${ar ? "الفندق / العقار:" : "Property:"} ${propertyName}` : (ar ? "إدارة وتوزيع فنيي الصيانة والعمالة والمقاولين" : "Manage technicians, trade workers, and contractors")}
            </p>
          </div>
        </div>

        <PermissionGate module="settings" action="edit">
          <Button
            onClick={() => {
              setSelectedWorker(null);
              setDialogOpen(true);
            }}
            className="gap-2 text-xs font-semibold self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>{ar ? "إضافة فني جديد" : "Add Technician"}</span>
          </Button>
        </PermissionGate>
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
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            <span>{ar ? "تصفية حسب:" : "Filter by:"}</span>
          </div>

          {/* Department Filter (Visible when user has access to both) */}
          {hasBoth && (
            <Select
              value={departmentFilter}
              onValueChange={(val) => {
                setDepartmentFilter(val);
                setSpecialtyFilter("all");
              }}
            >
              <SelectTrigger className="h-8 text-xs w-[145px]">
                <SelectValue placeholder={ar ? "القسم" : "Department"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الأقسام" : "All Departments"}</SelectItem>
                <SelectItem value="maintenance">{ar ? "الصيانة الفنية" : "Maintenance"}</SelectItem>
                <SelectItem value="housekeeping">{ar ? "الهاوس كيبنج" : "Housekeeping"}</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Specialty Filter */}
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue placeholder={ar ? "التخصص" : "Specialty"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل التخصصات" : "All Specialties"}</SelectItem>
              {availableSpecialties.map((sp) => (
                <SelectItem key={sp.key} value={sp.key}>
                  {ar ? sp.labelAr : sp.labelEn}
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

          {(specialtyFilter !== "all" || workerTypeFilter !== "all" || (hasBoth && departmentFilter !== "all") || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDepartmentFilter(canHsk && !canMnt ? "housekeeping" : canMnt && !canHsk ? "maintenance" : "all");
                setSpecialtyFilter("all");
                setWorkerTypeFilter("all");
                setSearch("");
              }}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {ar ? "مسح التصفية" : "Clear Filters"}
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
                  {/* Top Bar: Specialty Badge and Actions Dropdown */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>{getSpecialtyBadge(w.specialty)}</div>

                    <div className="flex items-center gap-1">
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
                          <PermissionGate module="settings" action="edit">
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
                          <PermissionGate module="settings" action="edit">
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
