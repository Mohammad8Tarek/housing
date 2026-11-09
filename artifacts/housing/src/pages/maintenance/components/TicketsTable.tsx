import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DataPagination } from "@/components/DataPagination";
import { format } from "date-fns";
import {
  Trash,
  Wrench,
  Sparkles,
  Eye,
  Layers,
  ShieldCheck,
  User,
  MoreVertical,
  Building2,
  DoorClosed,
  Star,
} from "lucide-react";
import {
  CATEGORIES_AR,
  CATEGORIES_EN,
  PROBLEM_TYPES_MAP,
  PRIORITY_AR,
  priorityColor,
  statusColor,
} from "../utils/ticket-constants";
import { formatDuration, STATUS_AR, STATUS_EN } from "../utils/ticket-duration";

export function TicketRequesterCell({ ticket, ar }: { ticket: any; ar: boolean }) {
  const rep = (ticket.reportedBy || "").trim();
  if (rep) {
    const isSystemAdmin = ["admin", "super_admin", "system_admin", "system", "test_superadmin"].includes(rep.toLowerCase());
    if (isSystemAdmin) {
      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1 font-semibold text-xs text-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>{ar ? "إدارة السكن" : "Housing Admin"}</span>
            <span className="text-[10px] text-muted-foreground font-mono">({rep})</span>
          </span>
          {ticket.residentName && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1" title={ticket.residentName}>
              <User className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate max-w-[140px]">{ticket.residentName}</span>
            </span>
          )}
        </div>
      );
    }

    const isQr = rep.includes("مسح QR") || rep.includes("QR");
    const cleanName = rep.replace(/\s*-\s*\[مسح QR.*?\]/g, "").trim();

    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 font-bold text-xs text-foreground">
          <User className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate max-w-[160px]" title={cleanName}>{cleanName}</span>
        </span>
        {isQr && (
          <Badge variant="outline" className="w-fit text-[9px] px-1 py-0 h-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300">
            {ar ? "مسح QR الغرفة" : "Room QR Scan"}
          </Badge>
        )}
      </div>
    );
  }

  if (ticket.residentName) {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-xs text-foreground" title={ticket.residentName}>
        <User className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="truncate max-w-[160px]">{ticket.residentName}</span>
      </span>
    );
  }

  return (
    <span className="text-[11px] text-muted-foreground/70 italic flex items-center gap-1">
      <User className="w-3 h-3 opacity-40 shrink-0" />
      <span>{ar ? "شاغرة (بدون نزيل)" : "Vacant"}</span>
    </span>
  );
}

interface TicketsTableProps {
  ar: boolean;
  paged: any[];
  filtered: any[];
  selectedTicketIds: Set<number>;
  setSelectedTicketIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  visible: Set<string>;
  isVisible: (key: string) => boolean;
  isColVisible: (key: string) => boolean;
  onSelectTicket: (id: number) => void;
  onDeleteTicket: (id: number) => void;
  roomMap: Record<number, string>;
  properties: any[];
  isSuperAdmin: boolean;
  isAdmin: boolean;
  canDeleteHsk: boolean;
  canDeleteMnt: boolean;
  categoryFilter: string;
  onClearEmptyFilters: () => void;
  paginationData: any;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function TicketsTable({
  ar,
  paged,
  filtered,
  selectedTicketIds,
  setSelectedTicketIds,
  visible,
  isVisible,
  isColVisible,
  onSelectTicket,
  onDeleteTicket,
  roomMap,
  properties,
  isSuperAdmin,
  isAdmin,
  canDeleteHsk,
  canDeleteMnt,
  categoryFilter,
  onClearEmptyFilters,
  paginationData,
  pageSize,
  onPageSizeChange,
  currentPage,
  onPageChange,
}: TicketsTableProps) {
  return (
    <div className="border rounded-xl bg-card overflow-hidden shadow-xs w-full">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40 text-[11px]">
            <TableHead className="w-9 px-2 text-center">
              <Checkbox
                checked={
                  paged.length > 0 &&
                  paged.every((t: any) => selectedTicketIds.has(t.id))
                }
                onCheckedChange={(checked) => {
                  setSelectedTicketIds(
                    checked
                      ? new Set([
                          ...selectedTicketIds,
                          ...paged.map((t: any) => t.id),
                        ])
                      : new Set(
                          Array.from(selectedTicketIds).filter(
                            (id) => !paged.some((t: any) => t.id === id),
                          ),
                        ),
                  );
                }}
              />
            </TableHead>
            {isVisible("id") && (
              <TableHead className="font-semibold w-12 px-2 text-center">
                {ar ? "رقم" : "ID"}
              </TableHead>
            )}
            {isColVisible("building_floor") && (
              <TableHead className="font-semibold w-[15%] px-2">
                {ar ? "المبنى والدور" : "BUILDING & FLOOR"}
              </TableHead>
            )}
            {isColVisible("room") && (
              <TableHead className="font-semibold w-[8%] px-2">
                {ar ? "رقم الغرفة" : "ROOM"}
              </TableHead>
            )}
            {isColVisible("requester") && (
              <TableHead className="font-semibold w-[15%] px-2">
                {ar ? "مقدم الطلب" : "REQUESTER"}
              </TableHead>
            )}
            {isColVisible("property") && (
              <TableHead className="font-semibold w-[12%] px-2">
                {ar ? "الفندق / السكن" : "PROPERTY / HOUSING"}
              </TableHead>
            )}
            {isVisible("problem") && (
              <TableHead className="font-semibold w-[22%] px-2">
                {ar ? "المشكلة والوصف" : "PROBLEM"}
              </TableHead>
            )}
            {isVisible("department") && (
              <TableHead className="font-semibold w-[10%] px-2">
                {ar ? "القسم" : "DEPT"}
              </TableHead>
            )}
            {isVisible("status") && (
              <TableHead className="font-semibold w-[11%] px-2">
                {ar ? "الحالة" : "STATUS"}
              </TableHead>
            )}
            {isVisible("priority") && (
              <TableHead className="font-semibold w-[8%] px-2">
                {ar ? "الأولوية" : "PRIORITY"}
              </TableHead>
            )}
            {isColVisible("assigned_to") && (
              <TableHead className="font-semibold w-[13%] px-2">
                {ar ? "المسند إليه" : "ASSIGNED TO"}
              </TableHead>
            )}
            {isVisible("at") && (
              <TableHead className="font-semibold w-[10%] px-2">
                {ar ? "تاريخ البلاغ" : "REPORTED"}
              </TableHead>
            )}
            {isVisible("duration") && (
              <TableHead className="font-semibold w-[8%] px-2">
                {ar ? "المدة" : "DURATION"}
              </TableHead>
            )}
            {isVisible("rating") && (
              <TableHead className="font-semibold w-[8%] px-2">
                {ar ? "التقييم" : "RATING"}
              </TableHead>
            )}
            {isVisible("actions") && (
              <TableHead className="font-semibold w-14 px-2 text-center">
                {ar ? "إجراءات" : "ACTIONS"}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.map((req: any) => (
            <TableRow
              key={req.id}
              onClick={() => onSelectTicket(req.id)}
              className="cursor-pointer hover:bg-muted/40 transition-colors group"
            >
              <TableCell className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedTicketIds.has(req.id)}
                  onCheckedChange={(checked) => {
                    setSelectedTicketIds((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(req.id);
                      else next.delete(req.id);
                      return next;
                    });
                  }}
                />
              </TableCell>

              {isVisible("id") && (
                <TableCell className="font-mono text-xs font-bold text-muted-foreground px-2 text-center">
                  #{req.id}
                </TableCell>
              )}

              {isColVisible("building_floor") && (
                <TableCell className="text-xs font-medium px-2 overflow-hidden">
                  {(req.buildingName || req.floorNumber) ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      {req.buildingName && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800 text-[11px] font-medium truncate max-w-full" title={req.buildingName}>
                          <Building2 className="w-3 h-3 shrink-0 text-sky-600 dark:text-sky-400" />
                          <span className="truncate">{req.buildingName}</span>
                        </span>
                      )}
                      {req.floorNumber && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800 text-[11px] font-medium shrink-0" title={ar ? "الدور / الطابق" : "Floor"}>
                          <Layers className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span>{ar ? `د ${req.floorNumber}` : `Fl ${req.floorNumber}`}</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">—</span>
                  )}
                </TableCell>
              )}

              {isColVisible("room") && (
                <TableCell className="text-xs font-bold text-foreground whitespace-nowrap px-2 overflow-hidden">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border text-xs font-bold" title={req.roomNumber || roomMap[req.roomId] || (req.roomId ? `#${req.roomId}` : "—")}>
                    <DoorClosed className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{req.roomNumber || roomMap[req.roomId] || (req.roomId ? `#${req.roomId}` : "—")}</span>
                  </span>
                </TableCell>
              )}

              {isColVisible("requester") && (
                <TableCell className="text-xs font-medium px-2 overflow-hidden">
                  <TicketRequesterCell ticket={req} ar={ar} />
                </TableCell>
              )}

              {isColVisible("property") && (
                <TableCell className="text-xs px-2 overflow-hidden">
                  <div className="flex items-center gap-1.5 truncate" title={req.propertyName || properties.find((p: any) => p.id === req.propertyId)?.displayName || (ar ? "سكن العاملين" : "Staff Housing")}>
                    <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-medium text-foreground truncate">
                      {req.propertyName ||
                        properties.find((p: any) => p.id === req.propertyId)?.displayName ||
                        properties.find((p: any) => p.id === req.propertyId)?.name ||
                        (ar ? "سكن العاملين" : "Staff Housing")}
                    </span>
                  </div>
                </TableCell>
              )}

              {isVisible("problem") && (
                <TableCell className="text-xs px-2 overflow-hidden">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-semibold text-foreground text-xs truncate" title={req.title || req.description}>
                      {req.title || (ar ? (PROBLEM_TYPES_MAP[req.problemType]?.labelAr || req.problemType) : (PROBLEM_TYPES_MAP[req.problemType]?.labelEn || req.problemType)) || (ar ? "طلب صيانة" : "Maintenance Ticket")}
                    </span>
                    {req.description && (
                      <span className="text-[11px] text-muted-foreground truncate" title={req.description}>
                        {req.description}
                      </span>
                    )}
                  </div>
                </TableCell>
              )}

              {isVisible("department") && (
                <TableCell className="text-xs px-2 overflow-hidden">
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-foreground truncate">
                      {ar
                        ? ((CATEGORIES_AR as Record<string, string>)[req.category] || req.category)
                        : ((CATEGORIES_EN as Record<string, string>)[req.category] || req.category?.toUpperCase())}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {ar
                        ? (PROBLEM_TYPES_MAP[req.problemType]?.labelAr || req.problemType)
                        : (PROBLEM_TYPES_MAP[req.problemType]?.labelEn || req.problemType)}
                    </span>
                  </div>
                </TableCell>
              )}

              {isVisible("status") && (
                <TableCell className="px-2 overflow-hidden">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border max-w-full ${statusColor(req.status)}`}
                    title={ar
                      ? (STATUS_AR[req.status?.toLowerCase()] || req.status)
                      : (STATUS_EN[req.status?.toLowerCase()] || req.status)}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        req.status === "open"
                          ? "bg-blue-500"
                          : req.status === "in_progress"
                            ? "bg-amber-500"
                            : req.status === "resolved"
                              ? "bg-emerald-500"
                              : "bg-slate-400"
                      }`}
                    />
                    <span className="truncate">
                      {ar
                        ? (STATUS_AR[req.status?.toLowerCase()] || req.status)
                        : (STATUS_EN[req.status?.toLowerCase()] || req.status)}
                    </span>
                  </span>
                </TableCell>
              )}

              {isVisible("priority") && (
                <TableCell className="px-2 overflow-hidden">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border max-w-full ${priorityColor(req.priority)}`}
                    title={ar ? (PRIORITY_AR[req.priority?.toUpperCase()] || req.priority) : req.priority}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      (req.priority || "").toUpperCase() === "URGENT" ? "bg-red-600 animate-pulse" :
                      (req.priority || "").toUpperCase() === "HIGH" ? "bg-orange-500" :
                      (req.priority || "").toUpperCase() === "MEDIUM" ? "bg-yellow-500" : "bg-slate-400"
                    }`} />
                    <span className="truncate">
                      {ar
                        ? (PRIORITY_AR[req.priority?.toUpperCase()] || req.priority)
                        : req.priority}
                    </span>
                  </span>
                </TableCell>
              )}

              {isColVisible("assigned_to") && (
                <TableCell className="text-xs px-2 overflow-hidden">
                  {req.assignedToName || req.workerName ? (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-medium max-w-full" title={req.assignedToName || req.workerName}>
                      <Wrench className="w-3 h-3 shrink-0 text-purple-600 dark:text-purple-400" />
                      <span className="truncate">{req.assignedToName || req.workerName}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50 text-[11px] italic">
                      {ar ? "غير مسند" : "Unassigned"}
                    </span>
                  )}
                </TableCell>
              )}

              {isVisible("at") && (
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap px-2 overflow-hidden">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground truncate">
                      {ar ? "البدء: " : "Start: "}{req.reportedAt ? format(new Date(req.reportedAt), "dd-MM-yyyy") : "—"}
                    </span>
                    <span className="text-muted-foreground text-[10px] font-mono">
                      {req.reportedAt ? format(new Date(req.reportedAt), "hh:mm:ss a") : ""}
                    </span>
                  </div>
                </TableCell>
              )}

              {isVisible("duration") && (
                <TableCell className="px-2 overflow-hidden">
                  {req.startedAt || req.reportedAt ? (
                    <Badge
                      variant="secondary"
                      className="font-mono text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 truncate"
                    >
                      {formatDuration(
                        req.startedAt,
                        req.resolvedAt,
                        req.reportedAt,
                        ar,
                      )}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">—</span>
                  )}
                </TableCell>
              )}

              {isVisible("rating") && (
                <TableCell className="px-2 overflow-hidden">
                  {req.rating ? (
                    <div className="flex flex-col gap-0.5">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 w-fit shadow-2xs">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                        <span>{req.rating}/5</span>
                      </div>
                      {req.ratingComment && (
                        <span
                          className="text-[10px] text-muted-foreground truncate max-w-full"
                          title={req.ratingComment}
                        >
                          {req.ratingComment}
                        </span>
                      )}
                    </div>
                  ) : ["resolved", "closed"].includes(req.status) ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 font-medium truncate"
                    >
                      {ar ? "بانتظار التقييم" : "Pending"}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </TableCell>
              )}

              {isVisible("actions") && (
                <TableCell className="px-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      size="icon"
                      className="h-7 w-7 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs"
                      onClick={() => onSelectTicket(req.id)}
                      title={ar ? "عرض التفاصيل ومتابعة سير العمل" : "View Details & Workflow"}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>

                    {(isSuperAdmin || isAdmin || (req.category === "housekeeping" ? canDeleteHsk : canDeleteMnt)) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 text-xs">
                          <DropdownMenuItem
                            onClick={() => onSelectTicket(req.id)}
                            className="gap-2 cursor-pointer font-medium"
                          >
                            <Eye className="w-3.5 h-3.5 text-primary" />
                            <span>{ar ? "سير العمل والتفاصيل" : "Workflow & Details"}</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDeleteTicket(req.id)}
                            className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash className="w-3.5 h-3.5" />
                            <span>{ar ? "حذف التذكرة" : "Delete Ticket"}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}

          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={visible.size + 1}
                className="py-16 text-center"
              >
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-16 h-16 bg-muted/60 rounded-full flex items-center justify-center mb-2">
                    {categoryFilter === "housekeeping" ? (
                      <Sparkles className="w-8 h-8 text-sky-500/60" />
                    ) : (
                      <Wrench className="w-8 h-8 text-amber-500/60" />
                    )}
                  </div>
                  <p className="text-base font-bold text-foreground">
                    {categoryFilter === "housekeeping"
                      ? (ar ? "لا توجد طلبات هاوس كيبنج حالياً" : "No housekeeping orders found")
                      : categoryFilter === "maintenance"
                        ? (ar ? "لا توجد بلاغات صيانة حالياً" : "No maintenance orders found")
                        : (ar ? "لم يتم العثور على أي تذاكر مطابقة" : "No tickets found")}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm text-center">
                    {ar
                      ? "لا توجد تذاكر تطابق معايير البحث الحالية. يمكنك مسح الفلاتر أو إنشاء طلب جديد."
                      : "There are no tickets matching your active filter criteria. Try clearing filters or create a new ticket."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={onClearEmptyFilters}
                  >
                    {ar ? "مسح جميع الفلاتر" : "Clear All Filters"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {paginationData.total > 0 && (
        <DataPagination
          total={paginationData.total}
          pageSize={pageSize}
          onPageSizeChange={onPageSizeChange}
          currentPage={currentPage}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
