import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { useProperty } from "@/context/PropertyContext";
import { usePermission } from "@/hooks/use-permission";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDate } from "@/lib/date-utils";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Info,
  Brush,
  Sparkles,
  BedDouble,
  Plus,
  Search,
  CheckCircle2,
  Play,
  Trash,
  Eye,
  Clock,
  Filter,
  Check,
} from "lucide-react";
import { PageLoader } from "@/components/ui/loader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataPagination } from "@/components/DataPagination";
import { PermissionGate } from "@/components/ui/permission-gate";
import TicketDetailModal from "@/components/ui/ticket-detail-modal";
import {
  useListBuildings,
  useListFloors,
  useListRooms,
  useListMaintenance,
  useUpdateMaintenance,
  useCreateMaintenance,
  useDeleteMaintenance,
  useListProfiles,
  getListMaintenanceQueryKey,
} from "@workspace/api-client-react";
import { HousekeepingTab } from "../housing/components/HousekeepingTab";

const ORDER_TYPES: { key: string; labelEn: string; labelAr: string }[] = [
  { key: "room_cleaning", labelEn: "Room Cleaning", labelAr: "تنظيف الغرفة" },
  { key: "bed_sheets", labelEn: "Bed Linen Change", labelAr: "تغيير المفارش والأسرة" },
  { key: "towels", labelEn: "Towels & Amenities", labelAr: "توفر مناشف ومستلزمات" },
  { key: "deep_cleaning", labelEn: "Deep Cleaning", labelAr: "تنظيف شامل وعميق" },
  { key: "waste_removal", labelEn: "Trash Removal", labelAr: "تفريغ المهملات" },
  { key: "sanitization", labelEn: "Sanitization & Disinfection", labelAr: "تعقيم وتطهير" },
  { key: "turnover", labelEn: "Turnover Preparation", labelAr: "تجهيز لنزيل جديد" },
  { key: "other", labelEn: "Special / Other Request", labelAr: "طلب نظافة آخر" },
];

const STATUS_MAP: Record<string, { labelEn: string; labelAr: string; color: string }> = {
  open: { labelEn: "Open", labelAr: "مفتوح", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200" },
  in_progress: { labelEn: "In Progress", labelAr: "قيد التنفيذ", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200" },
  resolved: { labelEn: "Completed", labelAr: "مكتمل", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200" },
  closed: { labelEn: "Closed", labelAr: "مغلق", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200" },
};

const PRIORITY_MAP: Record<string, { labelEn: string; labelAr: string; color: string }> = {
  LOW: { labelEn: "Low", labelAr: "منخفضة", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  MEDIUM: { labelEn: "Medium", labelAr: "متوسطة", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  HIGH: { labelEn: "High", labelAr: "عالية", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  URGENT: { labelEn: "Urgent", labelAr: "عاجلة", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

function HousekeepingOrdersSection({
  propertyId,
  properties,
}: {
  propertyId: number | "all";
  properties: any[];
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    propertyId === "all" ? "all" : String(propertyId)
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form State
  const [createForm, setCreateForm] = useState({
    propertyId: propertyId === "all" ? String(properties[0]?.id || "") : String(propertyId),
    roomId: "",
    orderType: "room_cleaning",
    priority: "MEDIUM",
    description: "",
  });

  const effectiveQueryPropId = selectedPropertyId === "all" ? "all" : parseInt(selectedPropertyId, 10);

  // Maintenance tickets query scoped to category=housekeeping
  const { data: ticketsData, isLoading: ticketsLoading } = useListMaintenance(
    {
      propertyId: effectiveQueryPropId as any,
      category: "housekeeping",
      status: statusFilter === "all" ? undefined : statusFilter,
      priority: priorityFilter || undefined,
      search: debouncedSearch || undefined,
      page,
      limit: pageSize,
    } as any,
    {
      query: {
        queryKey: [
          "/api/maintenance",
          "housekeeping-tab",
          effectiveQueryPropId,
          statusFilter,
          priorityFilter,
          debouncedSearch,
          page,
          pageSize,
        ],
        refetchInterval: 12000,
      },
    }
  );

  // Profiles list for technicians/cleaners
  const { data: pData } = useListProfiles({ limit: 1000 } as any);
  const profiles = useMemo(() => {
    const raw = (pData as any)?.data || pData || [];
    return Array.isArray(raw) ? raw : [];
  }, [pData]);

  // Rooms list for picker
  const activePickerPropId = parseInt(createForm.propertyId, 10) || (propertyId !== "all" ? propertyId : properties[0]?.id);
  const { data: roomsWrapper } = useListRooms(
    { propertyId: activePickerPropId as number, limit: 1000 } as any,
    { query: { enabled: !!activePickerPropId } }
  );
  const availableRooms = useMemo(() => {
    const raw = (roomsWrapper as any)?.data || roomsWrapper || [];
    return Array.isArray(raw) ? raw : [];
  }, [roomsWrapper]);

  const orders = useMemo(() => {
    const raw = (ticketsData as any)?.data || ticketsData || [];
    return Array.isArray(raw) ? raw : [];
  }, [ticketsData]);

  const pagination = (ticketsData as any)?.pagination || {
    page,
    limit: pageSize,
    total: orders.length,
    totalPages: Math.ceil(orders.length / pageSize),
  };

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/maintenance"],
    });
  };

  const updateMutation = useUpdateMaintenance({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم تحديث حالة الطلب" : "Order status updated");
      },
      onError: (e) => toast.error(ar ? "خطأ" : "Error", { description: e.message }),
    },
  });

  const createMutation = useCreateMaintenance({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم إنشاء طلب النظافة بنجاح" : "Housekeeping order created");
        setIsCreateOpen(false);
        setCreateForm({
          propertyId: propertyId === "all" ? String(properties[0]?.id || "") : String(propertyId),
          roomId: "",
          orderType: "room_cleaning",
          priority: "MEDIUM",
          description: "",
        });
      },
      onError: (e) => toast.error(ar ? "خطأ" : "Error", { description: e.message }),
    },
  });

  const deleteMutation = useDeleteMaintenance({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم حذف الطلب" : "Order deleted");
        setDeleteId(null);
      },
      onError: (e) => toast.error(ar ? "خطأ" : "Error", { description: e.message }),
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.roomId || !createForm.description) {
      toast.error(ar ? "يرجى اختيار الغرفة وكتابة الوصف" : "Please select room and enter description");
      return;
    }
    const typeObj = ORDER_TYPES.find((t) => t.key === createForm.orderType);
    const problemType = typeObj ? (ar ? typeObj.labelAr : typeObj.labelEn) : createForm.orderType;

    createMutation.mutate({
      data: {
        propertyId: parseInt(createForm.propertyId, 10),
        roomId: parseInt(createForm.roomId, 10),
        category: "housekeeping",
        problemType,
        description: createForm.description,
        priority: createForm.priority,
      },
    });
  };

  // KPIs
  const totalCount = pagination.total || 0;
  const openCount = orders.filter((o: any) => o.status === "open").length;
  const inProgressCount = orders.filter((o: any) => o.status === "in_progress").length;
  const completedCount = orders.filter((o: any) => o.status === "resolved" || o.status === "closed").length;

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-card border rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {ar ? "إجمالي الطلبات" : "Total Orders"}
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-foreground">{totalCount}</span>
            <Sparkles className="w-5 h-5 text-sky-500 opacity-80" />
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            {ar ? "قيد الانتظار (جديدة)" : "Open / Pending"}
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{openCount}</span>
            <Clock className="w-5 h-5 text-blue-500 opacity-80" />
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            {ar ? "جاري العمل عليها" : "In Progress"}
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{inProgressCount}</span>
            <Play className="w-5 h-5 text-amber-500 opacity-80" />
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {ar ? "تم إنجازها" : "Completed"}
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500 opacity-80" />
          </div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="bg-card border rounded-xl p-3.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Property Selector if "all" is available */}
          {properties && properties.length > 1 && (
            <Select
              value={selectedPropertyId}
              onValueChange={(val) => {
                setSelectedPropertyId(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue placeholder={ar ? "كل الفنادق" : "All Hotels"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الفنادق" : "All Hotels"}</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={ar ? "بحث برقم الغرفة أو الوصف..." : "Search room or description..."}
              className="h-9 text-xs pl-9 rtl:pl-3 rtl:pr-9"
            />
          </div>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل الحالات" : "All Statuses"}</SelectItem>
              <SelectItem value="open">{ar ? "مفتوح / جديد" : "Open"}</SelectItem>
              <SelectItem value="in_progress">{ar ? "قيد التنفيذ" : "In Progress"}</SelectItem>
              <SelectItem value="resolved">{ar ? "مكتمل" : "Completed"}</SelectItem>
              <SelectItem value="closed">{ar ? "مغلق" : "Closed"}</SelectItem>
            </SelectContent>
          </Select>

          {/* Priority Filter */}
          <Select
            value={priorityFilter || "ALL"}
            onValueChange={(val) => {
              setPriorityFilter(val === "ALL" ? "" : val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[125px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{ar ? "كل الأولويات" : "All Priorities"}</SelectItem>
              <SelectItem value="LOW">{ar ? "منخفضة" : "Low"}</SelectItem>
              <SelectItem value="MEDIUM">{ar ? "متوسطة" : "Medium"}</SelectItem>
              <SelectItem value="HIGH">{ar ? "عالية" : "High"}</SelectItem>
              <SelectItem value="URGENT">{ar ? "عاجلة" : "Urgent"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Create Order Button */}
        <PermissionGate module="housekeeping" action="create">
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="h-9 gap-1.5 text-xs font-semibold shrink-0 bg-sky-600 hover:bg-sky-700 text-white"
          >
            <Plus className="w-4 h-4" />
            {ar ? "طلب نظافة جديد" : "New Housekeeping Order"}
          </Button>
        </PermissionGate>
      </div>

      {/* Orders Table */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-16 text-center">{ar ? "رقم" : "#"}</TableHead>
              <TableHead>{ar ? "الغرفة / الفندق" : "Room / Property"}</TableHead>
              <TableHead>{ar ? "نوع الطلب" : "Request Type"}</TableHead>
              <TableHead className="max-w-[280px]">{ar ? "الوصف" : "Description"}</TableHead>
              <TableHead>{ar ? "الأولوية" : "Priority"}</TableHead>
              <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
              <TableHead>{ar ? "تاريخ الطلب" : "Reported At"}</TableHead>
              <TableHead className="text-center">{ar ? "إجراءات سريعة" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ticketsLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    {ar ? "جاري تحميل الطلبات..." : "Loading orders..."}
                  </div>
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm font-medium">
                    {ar ? "لا توجد طلبات نظافة مطابقة" : "No housekeeping orders found"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ar ? "يمكنك إنشاء طلب نظافة جديد أو تغيير الفلاتر" : "You can create a new order or adjust your filters"}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order: any) => {
                const statusMeta = STATUS_MAP[order.status] || {
                  labelEn: order.status,
                  labelAr: order.status,
                  color: "bg-gray-100 text-gray-700",
                };
                const priorityMeta = PRIORITY_MAP[order.priority] || {
                  labelEn: order.priority,
                  labelAr: order.priority,
                  color: "bg-gray-100 text-gray-700",
                };

                return (
                  <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                    <TableHead className="w-16 text-center font-mono text-xs text-muted-foreground">
                      #{order.id}
                    </TableHead>
                    <TableCell>
                      <div className="font-semibold text-sm flex items-center gap-1.5">
                        <BedDouble className="w-3.5 h-3.5 text-muted-foreground" />
                        {order.roomNumber ? `${ar ? "غرفة" : "Room"} ${order.roomNumber}` : `#${order.roomId}`}
                      </div>
                      {order.propertyName && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {order.propertyName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-foreground">
                        {order.problemType || (ar ? "تنظيف عام" : "General Cleaning")}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <p className="text-xs text-muted-foreground line-clamp-2" title={order.description}>
                        {order.description || "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${priorityMeta.color} text-[11px] font-medium border-0`}>
                        {ar ? priorityMeta.labelAr : priorityMeta.labelEn}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusMeta.color} text-[11px] font-medium border`}>
                        {ar ? statusMeta.labelAr : statusMeta.labelEn}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(order.reportedAt || order.createdAt)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Quick start button */}
                        {order.status === "open" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] font-medium gap-1 text-amber-700 border-amber-300 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
                            onClick={() =>
                              updateMutation.mutate({
                                id: order.id,
                                data: {
                                  status: "in_progress",
                                  startedAt: new Date().toISOString(),
                                  propertyId: order.propertyId,
                                } as any,
                              })
                            }
                            title={ar ? "بدء التنفيذ" : "Start"}
                          >
                            <Play className="w-3 h-3" />
                            {ar ? "بدء" : "Start"}
                          </Button>
                        )}

                        {/* Quick complete button */}
                        {order.status === "in_progress" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] font-medium gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                            onClick={() =>
                              updateMutation.mutate({
                                id: order.id,
                                data: {
                                  status: "resolved",
                                  resolvedAt: new Date().toISOString(),
                                  propertyId: order.propertyId,
                                } as any,
                              })
                            }
                            title={ar ? "تم الإنجاز" : "Complete"}
                          >
                            <Check className="w-3 h-3" />
                            {ar ? "إنجاز" : "Done"}
                          </Button>
                        )}

                        {/* Full details */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setSelectedTicketId(order.id)}
                          title={ar ? "عرض التفاصيل" : "View details"}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>

                        {/* Delete */}
                        <PermissionGate module="housekeeping" action="delete">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                            onClick={() => setDeleteId(order.id)}
                            title={ar ? "حذف الطلب" : "Delete"}
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {pagination.total > 0 && (
          <DataPagination
            total={pagination.total}
            pageSize={pageSize}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setPage(1);
            }}
            currentPage={page}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Create Housekeeping Order Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-600" />
              {ar ? "طلب نظافة جديد" : "New Housekeeping Order"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            {/* Hotel Selector (if multiple properties) */}
            {properties && properties.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs">{ar ? "الفندق / العقار" : "Hotel / Property"}</Label>
                <Select
                  value={createForm.propertyId}
                  onValueChange={(val) =>
                    setCreateForm((f) => ({ ...f, propertyId: val, roomId: "" }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Room Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                {ar ? "الغرفة" : "Room"} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={createForm.roomId}
                onValueChange={(val) => setCreateForm((f) => ({ ...f, roomId: val }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={ar ? "اختر الغرفة..." : "Select room..."} />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {availableRooms.map((r: any) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {ar ? `غرفة ${r.roomNumber}` : `Room ${r.roomNumber}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Order Type */}
            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? "نوع الخدمة / الطلب" : "Service Type"}</Label>
              <Select
                value={createForm.orderType}
                onValueChange={(val) => setCreateForm((f) => ({ ...f, orderType: val }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {ar ? t.labelAr : t.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <Label className="text-xs">{ar ? "الأولوية" : "Priority"}</Label>
              <Select
                value={createForm.priority}
                onValueChange={(val) => setCreateForm((f) => ({ ...f, priority: val }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">{ar ? "منخفضة" : "Low"}</SelectItem>
                  <SelectItem value="MEDIUM">{ar ? "متوسطة" : "Medium"}</SelectItem>
                  <SelectItem value="HIGH">{ar ? "عالية" : "High"}</SelectItem>
                  <SelectItem value="URGENT">{ar ? "عاجلة (فوراً)" : "Urgent"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                {ar ? "الوصف والملاحظات" : "Description & Notes"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Textarea
                rows={3}
                className="text-xs resize-none"
                placeholder={
                  ar
                    ? "تفاصيل الطلب (مثال: تغيير ملايات السرير وتعقيم الحمام...)"
                    : "Details (e.g. linen replacement and sanitization...)"
                }
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-sky-600 hover:bg-sky-700 text-white"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending
                  ? ar
                    ? "جاري الحفظ..."
                    : "Saving..."
                  : ar
                    ? "إرسال الطلب"
                    : "Submit Order"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ar ? "حذف طلب النظافة؟" : "Delete Housekeeping Order?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "هل أنت متأكد من رغبتك في حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this order? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              {ar ? "تأكيد الحذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Modal */}
      {selectedTicketId !== null && (
        <TicketDetailModal
          open={selectedTicketId !== null}
          onClose={() => setSelectedTicketId(null)}
          ticket={orders.find((o: any) => o.id === selectedTicketId)}
          profiles={profiles}
          ar={ar}
          onStatusChange={(id, data) => {
            const tgt = orders.find((o: any) => o.id === id);
            updateMutation.mutate({
              id,
              data: {
                ...data,
                propertyId: tgt?.propertyId || effectiveQueryPropId,
              },
            });
          }}
          onAssignChange={(id, empId) => {
            const tgt = orders.find((o: any) => o.id === id);
            updateMutation.mutate({
              id,
              data: {
                assignedTo: empId,
                propertyId: tgt?.propertyId || effectiveQueryPropId,
              },
            });
          }}
        />
      )}
    </div>
  );
}

export default function HousekeepingPage() {
  const { activePropertyId, properties } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const { canView } = usePermission();

  const [mainTab, setMainTab] = useState<string>("rooms");

  const effectivePropId = activePropertyId === "all" ? properties[0]?.id : activePropertyId;

  const { data: bData, isLoading: bLoading } = useListBuildings(
    {
      propertyId: effectivePropId as number,
      limit: 1000,
    } as any,
    {
      query: {
        queryKey: ["/api/buildings", effectivePropId],
        enabled: !!effectivePropId,
      },
    }
  );

  const { data: fData, isLoading: fLoading } = useListFloors(
    {
      propertyId: effectivePropId as number,
      limit: 1000,
    } as any,
    {
      query: {
        queryKey: ["/api/floors", effectivePropId],
        enabled: !!effectivePropId,
      },
    }
  );

  const { data: _rDataWrapper, isLoading: rLoading } = useListRooms(
    { propertyId: effectivePropId as number, limit: 1000 } as any,
    {
      query: {
        queryKey: ["/api/rooms", effectivePropId, 1000],
        enabled: !!effectivePropId,
        staleTime: 0,
      },
    }
  );

  if (!activePropertyId) {
    return (
      <div className="p-8">
        <Alert>
          <Info className="w-4 h-4" />
          <AlertTitle>{ar ? "مطلوب" : "Required"}</AlertTitle>
          <AlertDescription>
            {ar ? "الرجاء اختيار فندق أولاً" : "Please select a hotel first"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (bLoading || fLoading || rLoading) {
    return <PageLoader />;
  }

  const buildings = (bData as any)?.data || bData || [];
  const floors = (fData as any)?.data || fData || [];
  const rData = (_rDataWrapper as any)?.data || _rDataWrapper || [];
  const rooms = Array.isArray(rData) ? rData : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 shadow-xs">
            <Brush className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {ar ? "إدارة النظافة والهاوس كيبنج" : "Housekeeping Management"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {ar
                ? "متابعة وتحديث حالة تنظيف الغرف وطلبات النظافة الفورية"
                : "Monitor room cleaning status and live housekeeping orders"}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="bg-muted/70 p-1 rounded-xl h-11 border">
          <TabsTrigger
            value="rooms"
            className="gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            <BedDouble className="w-4 h-4 text-orange-500" />
            {ar ? "حالة نظافة الغرف" : "Room Cleaning Status"}
          </TabsTrigger>
          <TabsTrigger
            value="orders"
            className="gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-sky-500" />
            {ar ? "طلبات وأوامر النظافة" : "Housekeeping Orders"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="mt-5">
          <HousekeepingTab
            propertyId={effectivePropId as number}
            buildings={buildings}
            floors={floors}
            rooms={rooms}
          />
        </TabsContent>

        <TabsContent value="orders" className="mt-5">
          <HousekeepingOrdersSection
            propertyId={activePropertyId}
            properties={properties || []}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
