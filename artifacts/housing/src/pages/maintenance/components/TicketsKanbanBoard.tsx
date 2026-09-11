import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Wrench,
  Sparkles,
  FileText,
  Clock,
  User,
  CheckCircle2,
  Play,
  RotateCcw,
  Check,
  Eye,
  Trash,
  MoreVertical,
  AlertCircle,
  Building,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/date-utils";

interface TicketsKanbanBoardProps {
  tickets: any[];
  ar: boolean;
  onSelectTicket: (id: number) => void;
  onQuickStatusChange: (id: number, newStatus: string) => void;
  onDeleteTicket?: (id: number) => void;
  roomMap: Record<number, string>;
  roomOccupantMap: Record<number, string>;
  properties: any[];
  canEdit: boolean;
  canDelete: boolean;
  categoryIcons: Record<string, any>;
  categoryAr: Record<string, string>;
  problemTypesMap: Record<string, { labelEn: string; labelAr: string }>;
  priorityAr: Record<string, string>;
  statusAr: Record<string, string>;
  formatDuration: (startedAt: any, resolvedAt: any, reportedAt: any) => string;
  getDurationColor: (startedAt: any, resolvedAt: any, reportedAt: any) => string;
}

interface ColumnConfig {
  id: "open" | "in_progress" | "resolved" | "closed";
  titleAr: string;
  titleEn: string;
  color: string;
  borderColor: string;
  badgeColor: string;
  nextStatus?: string;
  nextLabelAr?: string;
  nextLabelEn?: string;
  nextIcon?: any;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: "open",
    titleAr: "مفتوحة وجديدة",
    titleEn: "Open",
    color: "bg-blue-500",
    borderColor: "border-t-blue-500",
    badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    nextStatus: "in_progress",
    nextLabelAr: "بدء التنفيذ",
    nextLabelEn: "Start Work",
    nextIcon: Play,
  },
  {
    id: "in_progress",
    titleAr: "قيد التنفيذ والعمل",
    titleEn: "In Progress",
    color: "bg-amber-500",
    borderColor: "border-t-amber-500",
    badgeColor: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    nextStatus: "resolved",
    nextLabelAr: "تم الإنجاز",
    nextLabelEn: "Mark Done",
    nextIcon: CheckCircle2,
  },
  {
    id: "resolved",
    titleAr: "تم الحل والإصلاح",
    titleEn: "Resolved",
    color: "bg-emerald-500",
    borderColor: "border-t-emerald-500",
    badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    nextStatus: "closed",
    nextLabelAr: "إغلاق الطلب",
    nextLabelEn: "Close Ticket",
    nextIcon: Check,
  },
  {
    id: "closed",
    titleAr: "مغلقة وأرشيف",
    titleEn: "Closed",
    color: "bg-slate-400",
    borderColor: "border-t-slate-400",
    badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    nextStatus: "open",
    nextLabelAr: "إعادة فتح",
    nextLabelEn: "Reopen",
    nextIcon: RotateCcw,
  },
];

export function TicketsKanbanBoard({
  tickets = [],
  ar = false,
  onSelectTicket,
  onQuickStatusChange,
  onDeleteTicket,
  roomMap = {},
  roomOccupantMap = {},
  properties = [],
  canEdit = true,
  canDelete = false,
  categoryIcons,
  categoryAr,
  problemTypesMap,
  priorityAr,
  formatDuration,
  getDurationColor,
}: TicketsKanbanBoardProps) {
  // Group tickets by column
  const groupedTickets = useMemo(() => {
    const groups: Record<string, any[]> = {
      open: [],
      in_progress: [],
      resolved: [],
      closed: [],
    };
    for (const t of tickets) {
      const s = (t.status || "open").toLowerCase();
      if (groups[s]) {
        groups[s].push(t);
      } else {
        groups.open.push(t);
      }
    }
    return groups;
  }, [tickets]);

  const priorityBadgeStyle = (p: string) => {
    switch ((p || "").toUpperCase()) {
      case "URGENT":
        return {
          dot: "bg-red-500 animate-pulse",
          badge: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-800",
        };
      case "HIGH":
        return {
          dot: "bg-orange-500",
          badge: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200 dark:border-orange-800",
        };
      case "MEDIUM":
        return {
          dot: "bg-yellow-500",
          badge: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
        };
      default:
        return {
          dot: "bg-slate-400",
          badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
        };
    }
  };

  const categoryBadgeStyle = (c: string) => {
    switch (c) {
      case "maintenance":
        return "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "housekeeping":
        return "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800";
      default:
        return "bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pb-6 items-start">
      {COLUMNS.map((col) => {
        const colTickets = groupedTickets[col.id] || [];
        const NextIcon = col.nextIcon;

        return (
          <div
            key={col.id}
            className={`flex flex-col bg-muted/30 dark:bg-muted/15 border border-t-4 rounded-xl shadow-xs overflow-hidden ${col.borderColor}`}
          >
            {/* Column Header */}
            <div className="p-3.5 border-b bg-card/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                <h3 className="text-xs sm:text-sm font-bold text-foreground">
                  {ar ? col.titleAr : col.titleEn}
                </h3>
              </div>
              <Badge variant="outline" className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badgeColor}`}>
                {colTickets.length}
              </Badge>
            </div>

            {/* Column Cards Container */}
            <div className="p-2.5 space-y-2.5 min-h-[420px] max-h-[750px] overflow-y-auto">
              {colTickets.map((ticket) => {
                const pStyle = priorityBadgeStyle(ticket.priority);
                const problemName = ar
                  ? (problemTypesMap[ticket.problemType]?.labelAr || ticket.problemType)
                  : (problemTypesMap[ticket.problemType]?.labelEn || ticket.problemType);

                const roomNum = ticket.roomNumber || roomMap[ticket.roomId] || ticket.roomId;
                const occupant = roomOccupantMap[ticket.roomId];
                const propName =
                  ticket.propertyName ||
                  properties.find((p: any) => p.id === ticket.propertyId)?.displayName ||
                  properties.find((p: any) => p.id === ticket.propertyId)?.name;

                return (
                  <div
                    key={ticket.id}
                    onClick={() => onSelectTicket(ticket.id)}
                    className="group relative bg-card border rounded-xl p-3.5 shadow-xs hover:shadow-md hover:border-primary/40 transition-all cursor-pointer space-y-2.5"
                  >
                    {/* Card Top: ID, Category & Priority */}
                    <div className="flex items-center justify-between gap-1.5 text-xs">
                      <span className="font-mono font-bold text-muted-foreground text-[11px]">
                        #{ticket.id}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {/* Category */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${categoryBadgeStyle(ticket.category)}`}
                        >
                          {categoryIcons[ticket.category] || <FileText className="w-3 h-3" />}
                          <span>{ar ? (categoryAr[ticket.category] ?? ticket.category) : ticket.category}</span>
                        </span>

                        {/* Priority */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${pStyle.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${pStyle.dot}`} />
                          <span>
                            {ar
                              ? (priorityAr[ticket.priority?.toUpperCase()] ?? ticket.priority)
                              : ticket.priority}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Problem Title & Room Badge */}
                    <div className="space-y-1">
                      <h4 className="text-xs sm:text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {problemName}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <Badge variant="secondary" className="text-[11px] font-medium py-0 px-1.5 bg-muted">
                          {ar ? "الغرفة" : "Room"} {roomNum}
                        </Badge>
                        {propName && (
                          <span className="text-[10px] text-muted-foreground">
                            • {propName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Occupant (if available) */}
                    {occupant && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 p-1.5 rounded-lg">
                        <User className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate font-medium text-foreground">{occupant}</span>
                      </div>
                    )}

                    {/* Description Snippet */}
                    {ticket.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {ticket.description}
                      </p>
                    )}

                    {/* Card Footer: SLA & Quick Actions */}
                    <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span className={`font-bold ${getDurationColor(ticket.startedAt, ticket.resolvedAt, ticket.reportedAt)}`}>
                          {formatDuration(ticket.startedAt, ticket.resolvedAt, ticket.reportedAt)}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canEdit && col.nextStatus && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-6 px-2 text-[10px] gap-1 font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
                            onClick={() => onQuickStatusChange(ticket.id, col.nextStatus!)}
                            title={ar ? col.nextLabelAr : col.nextLabelEn}
                          >
                            {NextIcon && <NextIcon className="w-3 h-3" />}
                            <span>{ar ? col.nextLabelAr : col.nextLabelEn}</span>
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs">
                            <DropdownMenuItem onClick={() => onSelectTicket(ticket.id)}>
                              <Eye className="w-3.5 h-3.5 mr-2" />
                              {ar ? "عرض التفاصيل الكاملة" : "View Full Details"}
                            </DropdownMenuItem>
                            {canEdit && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onQuickStatusChange(ticket.id, "open")}>
                                  <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                                  {ar ? "تعيين كـ مفتوحة" : "Set Open"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onQuickStatusChange(ticket.id, "in_progress")}>
                                  <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
                                  {ar ? "تعيين كـ قيد التنفيذ" : "Set In Progress"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onQuickStatusChange(ticket.id, "resolved")}>
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                                  {ar ? "تعيين كـ تم الحل" : "Set Resolved"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onQuickStatusChange(ticket.id, "closed")}>
                                  <span className="w-2 h-2 rounded-full bg-slate-400 mr-2" />
                                  {ar ? "تعيين كـ مغلقة" : "Set Closed"}
                                </DropdownMenuItem>
                              </>
                            )}
                            {canDelete && onDeleteTicket && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDeleteTicket(ticket.id)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash className="w-3.5 h-3.5 mr-2" />
                                  {ar ? "حذف التذكرة" : "Delete Ticket"}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}

              {colTickets.length === 0 && (
                <div className="h-44 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center p-4 text-muted-foreground/60 space-y-1.5">
                  <AlertCircle className="w-6 h-6 stroke-[1.5]" />
                  <span className="text-xs font-medium">
                    {ar ? `لا توجد تذاكر ${col.titleAr}` : `No ${col.titleEn} tickets`}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
