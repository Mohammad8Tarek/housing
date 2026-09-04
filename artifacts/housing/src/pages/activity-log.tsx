// @ts-nocheck
import { useState, useEffect } from "react";
import { useAuditLog, useListActivityLogs } from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePermission } from "@/hooks/use-permission";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import {
  Activity,
  Download,
  Globe,
  KeyRound,
  Monitor,
  Printer,
  ShieldAlert,
  Copy,
  Eye,
  Terminal,
} from "lucide-react";
import { DataPagination } from "@/components/DataPagination";
import {
  ColumnChooser,
  useColumnVisibility,
} from "@/components/ui/column-chooser";

const MODULES = [
  "all",
  "auth",
  "system",
  "dashboard",
  "housing",
  "profiles",
  "accommodation",
  "reservations",
  "maintenance",
  "reports",
  "users",
  "settings",
  "activity_log",
  "properties",
  "documents",
  "billing",
  "communications",
  "evaluations",
  "surveys",
  "portal_content",
  "activities",
  "smart_locks",
  "hr_sync",
  "portal_notifications",
];

const ACTION_TYPES = [
  "all",
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "LOGIN_BLOCKED_LOCKED",
  "ACCOUNT_LOCKED",
  "PASSWORD_CHANGED",
  "PROPERTY_SWITCH",
  "CREATE",
  "UPDATE",
  "DELETE",
  "CHECKOUT",
  "CHECKIN",
  "AUTH",
  "SECURITY",
];
const KEY_ACTIONS = ["all", "issue", "revoke", "extend"];

const actionColor = (action: string) => {
  const a = (action ?? "").toUpperCase();
  if (a === "LOGIN_FAILED" || a.includes("SECURITY"))
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (a.includes("DELETE"))
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (a === "LOGIN" || a.includes("AUTH"))
    return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
  if (a === "LOGOUT")
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
  if (a.includes("CREATE") || a.includes("CHECKIN"))
    return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  if (a.includes("UPDATE") || a.includes("CHANGE"))
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  if (a.includes("CHECKOUT"))
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
};

const keyActionColor = (action: string) => {
  const a = (action ?? "").toLowerCase();
  if (a === "issue")
    return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  if (a === "revoke")
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (a === "extend")
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
};

const prettyKeyAction = (action: string, ar: boolean) => {
  const a = (action ?? "").toLowerCase();
  if (ar && a === "issue") return "إصدار";
  if (ar && a === "revoke") return "إلغاء";
  if (ar && a === "extend") return "تمديد";
  return a ? a.charAt(0).toUpperCase() + a.slice(1) : "-";
};

const parseDetails = (rawDetails: any): { isJson: boolean; data: any; summary?: string; roomNumber?: string } => {
  if (!rawDetails) return { isJson: false, data: null };
  if (typeof rawDetails === "object") {
    const roomNumber =
      rawDetails.roomNumber ||
      (rawDetails.fromRoomNumber ? `${rawDetails.fromRoomNumber} ➔ ${rawDetails.toRoomNumber}` : undefined);
    return {
      isJson: true,
      data: rawDetails,
      summary: rawDetails.summary || rawDetails.message || undefined,
      roomNumber,
    };
  }
  try {
    const parsed = JSON.parse(rawDetails);
    const isJson = typeof parsed === "object" && parsed !== null;
    const roomNumber = isJson
      ? parsed.roomNumber || (parsed.fromRoomNumber ? `${parsed.fromRoomNumber} ➔ ${parsed.toRoomNumber}` : undefined)
      : undefined;
    return {
      isJson,
      data: parsed,
      summary: parsed?.summary || parsed?.message || undefined,
      roomNumber,
    };
  } catch {
    return { isJson: false, data: rawDetails, summary: String(rawDetails) };
  }
};

const formatDetails = (details: any) => {
  if (!details) return "";
  const parsed = parseDetails(details);
  if (parsed.summary) return parsed.summary;
  if (typeof details === "string") return details;
  try {
    return Object.entries(details)
      .map(
        ([key, value]) =>
          `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`,
      )
      .join(" | ");
  } catch {
    return String(details);
  }
};

const escapeCsv = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  const needsQuoting =
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r");
  if (!needsQuoting) return str;
  return `"${str.replace(/"/g, '""')}"`;
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function downloadCsv(filename: string, rows: string[]) {
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ActivityLog() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const { can } = usePermission();
  const ar = language === "ar";
  const canViewActivityLog = can("activity_log", "view");
  const canExportActivityLog = can("activity_log", "export");
  const keyAuditPropertyId =
    typeof activePropertyId === "number" ? activePropertyId : 0;

  if (!canViewActivityLog) {
    return (
      <div className="min-h-[320px] flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50/80 p-8 text-center">
        <ShieldAlert className="w-10 h-10 text-red-600" />
        <h2 className="mt-4 text-xl font-semibold">
          {ar ? "غير مسموح" : "Access denied"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          {ar
            ? "ليس لديك صلاحية عرض سجل النشاط. يرجى التواصل مع مشرف النظام."
            : "You do not have permission to view activity logs. Contact your administrator if you believe this is an error."}
        </p>
      </div>
    );
  }

  const [activeView, setActiveView] = useState<"activity" | "keys">("activity");
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const [keySearch, setKeySearch] = useState("");
  const [keyActionFilter, setKeyActionFilter] = useState("all");
  const [keyDateFrom, setKeyDateFrom] = useState("");
  const [keyDateTo, setKeyDateTo] = useState("");
  const [keyPageSize, setKeyPageSize] = useState(20);
  const [keyCurrentPage, setKeyCurrentPage] = useState(1);

  const [keyLogsLoading, setKeyLogsLoading] = useState(false); // mock or replace if needed
  const { data: keyLogs = [], isLoading: isKeyLogsLoading } =
    useAuditLog(keyAuditPropertyId);

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: logsResponse, isLoading } = useListActivityLogs(
    { 
      propertyId: activePropertyId,
      page: currentPage,
      limit: pageSize,
      search: debouncedSearch || undefined,
      module: moduleFilter === "all" ? undefined : moduleFilter,
      action: actionFilter === "all" ? undefined : actionFilter,
    } as any, // Cast as any because the types might not be regenerated yet
    { query: { enabled: !!activePropertyId } },
  );

  const paginated = logsResponse?.data || [];
  const totalLogs = logsResponse?.pagination?.total || 0;

  // Replaced client-side filtering and pagination with server-side response

  const filteredKeyLogs = keyLogs.filter((log) => {
    const action = (log.action ?? "").toLowerCase();
    const details = formatDetails(log.details).toLowerCase();
    const term = keySearch.toLowerCase();
    const createdAt = log.createdAt ? new Date(log.createdAt) : null;
    const fromOk =
      !keyDateFrom ||
      (createdAt && createdAt >= new Date(`${keyDateFrom}T00:00:00`));
    const toOk =
      !keyDateTo ||
      (createdAt && createdAt <= new Date(`${keyDateTo}T23:59:59`));
    const matchesAction =
      keyActionFilter === "all" || action === keyActionFilter;
    const matchesSearch =
      !term ||
      String(log.id ?? "").includes(term) ||
      String(log.keyId ?? "").includes(term) ||
      String(log.performedBy ?? "").includes(term) ||
      (log.cardNumber ?? "").toLowerCase().includes(term) ||
      (log.roomNumber ?? "").toLowerCase().includes(term) ||
      action.includes(term) ||
      details.includes(term);
    return matchesAction && matchesSearch && fromOk && toOk;
  });

  const paginatedKeyLogs = filteredKeyLogs.slice(
    (keyCurrentPage - 1) * keyPageSize,
    keyCurrentPage * keyPageSize,
  );

  const COLS = [
    {
      key: "datetime",
      label: "Date & Time",
      labelAr: "التاريخ والوقت",
      defaultVisible: true,
    },
    { key: "user", label: "User", labelAr: "المستخدم", defaultVisible: true },
    {
      key: "action",
      label: "Action",
      labelAr: "الإجراء",
      defaultVisible: true,
    },
    { key: "module", label: "Module", labelAr: "الوحدة", defaultVisible: true },
    {
      key: "ip",
      label: "IP Address",
      labelAr: "عنوان IP",
      defaultVisible: true,
    },
    {
      key: "details",
      label: "Details",
      labelAr: "التفاصيل",
      defaultVisible: true,
    },
  ];
  const { visible, toggle, showAll, hideAll, isVisible } =
    useColumnVisibility(COLS);

  const exportActivityCsv = () => {
    const header = [
      "ID",
      "Timestamp",
      "Username",
      "Role",
      "Action",
      "Module",
      "IP Address",
      "Details",
    ]
      .map(escapeCsv)
      .join(",");
    const rows = paginated.map((l) =>
      [
        l.id,
        l.timestamp,
        l.username,
        l.userRole ?? "",
        l.action,
        l.module,
        (l as any).ipAddress ?? "",
        (l as any).details ?? "",
      ]
        .map(escapeCsv)
        .join(","),
    );
    downloadCsv(`activity-log-${format(new Date(), "yyyy-MM-dd")}.csv`, [
      header,
      ...rows,
    ]);
  };

  const exportKeyCsv = () => {
    const header = [
      "ID",
      "Timestamp",
      "Action",
      "Key ID",
      "Room",
      "Card Number",
      "Performed By",
      "Details",
    ]
      .map(escapeCsv)
      .join(",");
    const rows = filteredKeyLogs.map((l) =>
      [
        l.id,
        l.createdAt,
        l.action,
        l.keyId ?? "",
        l.roomNumber ?? "",
        l.cardNumber ?? "",
        l.performedBy ?? "",
        formatDetails(l.details),
      ]
        .map(escapeCsv)
        .join(","),
    );
    downloadCsv(`key-audit-${format(new Date(), "yyyy-MM-dd")}.csv`, [
      header,
      ...rows,
    ]);
  };

  const printKeyReport = () => {
    const rows = filteredKeyLogs
      .map(
        (l) => `
      <tr>
        <td>${escapeHtml(formatDateTime(l.createdAt, "-"))}</td>
        <td>${escapeHtml(prettyKeyAction(l.action, ar))}</td>
        <td>${escapeHtml(l.roomNumber || "-")}</td>
        <td>${escapeHtml(l.cardNumber || "-")}</td>
        <td>${escapeHtml(l.keyId ?? "-")}</td>
        <td>${escapeHtml(l.performedBy ?? "-")}</td>
        <td>${escapeHtml(formatDetails(l.details) || "-")}</td>
      </tr>
    `,
      )
      .join("");

    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) return;

    win.document.write(`
      <!doctype html>
      <html dir="${ar ? "rtl" : "ltr"}">
        <head>
          <meta charset="utf-8" />
          <title>${ar ? "تقرير سجل المفاتيح" : "Key Audit Report"}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0; font-size: 22px; }
            .meta { margin: 8px 0 18px; color: #6b7280; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; }
            th { background: #f3f4f6; text-align: ${ar ? "right" : "left"}; }
            tr:nth-child(even) td { background: #fafafa; }
          </style>
        </head>
        <body>
          <h1>${ar ? "تقرير سجل المفاتيح" : "Key Audit Report"}</h1>
          <div class="meta">
            ${ar ? "تاريخ الطباعة" : "Printed at"}: ${escapeHtml(formatDateTime(new Date()))}
            &nbsp; | &nbsp;
            ${ar ? "عدد السجلات" : "Records"}: ${filteredKeyLogs.length}
          </div>
          <table>
            <thead>
              <tr>
                <th>${ar ? "التاريخ والوقت" : "Date & Time"}</th>
                <th>${ar ? "الإجراء" : "Action"}</th>
                <th>${ar ? "الغرفة" : "Room"}</th>
                <th>${ar ? "رقم الكارت" : "Card Number"}</th>
                <th>${ar ? "رقم المفتاح" : "Key ID"}</th>
                <th>${ar ? "بواسطة" : "By"}</th>
                <th>${ar ? "التفاصيل" : "Details"}</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="7">${ar ? "لا توجد سجلات" : "No records"}</td></tr>`}</tbody>
          </table>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const keyStats = [
    {
      label: ar ? "إجمالي العمليات" : "Total Events",
      value: filteredKeyLogs.length,
      color: "text-foreground",
    },
    {
      label: ar ? "إصدار" : "Issued",
      value: filteredKeyLogs.filter((l) => l.action === "issue").length,
      color: "text-green-600",
    },
    {
      label: ar ? "إلغاء" : "Revoked",
      value: filteredKeyLogs.filter((l) => l.action === "revoke").length,
      color: "text-red-600",
    },
    {
      label: ar ? "الغرف المتأثرة" : "Rooms",
      value: new Set(filteredKeyLogs.map((l) => l.roomNumber).filter(Boolean))
        .size,
      color: "text-blue-600",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-[#C9A24D]" />
            {ar ? "سجل النشاط" : "Activity Log"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ar
              ? "سجل عمليات النظام وسجل مفاتيح الغرف في مكان واحد"
              : "System activity and room key audit trails in one place"}
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          {activeView === "activity" ? (
            <>
              <ColumnChooser
                cols={COLS}
                visible={visible}
                onToggle={toggle}
                onShowAll={showAll}
                onHideAll={hideAll}
                ar={ar}
              />
              {canExportActivityLog && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportActivityCsv}
                  className="gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  {ar ? "تصدير CSV" : "Export CSV"}
                </Button>
              )}
            </>
          ) : (
            <>
              {canExportActivityLog && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportKeyCsv}
                  className="gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  {ar ? "تصدير CSV" : "Export CSV"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={printKeyReport}
                className="gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                {ar ? "طباعة تقرير" : "Print Report"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="inline-flex rounded-lg border bg-muted/30 p-1"></div>

      {activeView === "activity" ? (
        <>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder={
                ar
                  ? "بحث بالمستخدم أو الإجراء أو IP..."
                  : "Search by user, action, IP..."
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-64"
            />
            <Select
              value={moduleFilter}
              onValueChange={(v) => {
                setModuleFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODULES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m === "all"
                      ? ar
                        ? "كل الوحدات"
                        : "All Modules"
                      : m.charAt(0).toUpperCase() + m.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={actionFilter}
              onValueChange={(v) => {
                setActionFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a === "all" ? (ar ? "كل الإجراءات" : "All Actions") : a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: ar ? "إجمالي السجلات" : "Total Records",
                value: totalLogs,
                color: "text-foreground",
              },
              {
                label: ar ? "تسجيلات دخول" : "Logins",
                value: paginated.filter((l) => l.action === "LOGIN").length,
                color: "text-purple-600",
              },
              {
                label: ar ? "تحذيرات أمان" : "Security Alerts",
                value: paginated.filter(
                  (l) =>
                    l.severity === "warning" || l.action === "LOGIN_FAILED",
                ).length,
                color: "text-amber-600",
              },
              {
                label: ar ? "إجراءات حذف" : "Deletions",
                value: paginated.filter((l) =>
                  (l.action ?? "").includes("DELETE"),
                ).length,
                color: "text-red-600",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="border rounded-lg p-3 bg-card text-center"
              >
                <p className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="border rounded-lg bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {isVisible("datetime") && (
                      <TableHead className="font-semibold whitespace-nowrap">
                        {ar ? "التاريخ والوقت" : "Date & Time"}
                      </TableHead>
                    )}
                    {isVisible("user") && (
                      <TableHead className="font-semibold">
                        {ar ? "المستخدم" : "User"}
                      </TableHead>
                    )}
                    {isVisible("action") && (
                      <TableHead className="font-semibold">
                        {ar ? "الإجراء" : "Action"}
                      </TableHead>
                    )}
                    {isVisible("module") && (
                      <TableHead className="font-semibold">
                        {ar ? "الوحدة" : "Module"}
                      </TableHead>
                    )}
                    {isVisible("ip") && (
                      <TableHead className="font-semibold">
                        {ar ? "عنوان IP" : "IP Address"}
                      </TableHead>
                    )}
                    {isVisible("details") && (
                      <TableHead className="font-semibold">
                        {ar ? "التفاصيل" : "Details"}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((log) => (
                    <TableRow
                      key={log.id}
                      className={`hover:bg-muted/20 ${(log as any).severity === "warning" ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
                    >
                      {isVisible("datetime") && (
                        <TableCell className="text-xs font-mono whitespace-nowrap">
                          <div className="font-medium text-foreground">
                            {formatDate(log.timestamp, "-")}
                          </div>
                          <div className="text-muted-foreground">
                            {log.timestamp
                              ? format(new Date(log.timestamp), "HH:mm:ss")
                              : ""}
                          </div>
                        </TableCell>
                      )}
                      {isVisible("user") && (
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                              {(log.username ?? "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {log.username || "-"}
                              </p>
                              {log.userRole && (
                                <p className="text-[10px] text-muted-foreground capitalize">
                                  {log.userRole.replace(/_/g, " ")}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      )}
                      {isVisible("action") && (
                        <TableCell>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${actionColor(log.action)}`}
                          >
                            {log.action}
                          </span>
                          {(log as any).severity === "warning" && (
                            <ShieldAlert className="inline-block w-3 h-3 ml-1 text-amber-500" />
                          )}
                        </TableCell>
                      )}
                      {isVisible("module") && (
                        <TableCell>
                          {log.module && (
                            <Badge
                              variant="outline"
                              className="text-xs capitalize"
                            >
                              {log.module}
                            </Badge>
                          )}
                          {log.entityType && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              {log.entityType} #{log.entityId}
                            </span>
                          )}
                        </TableCell>
                      )}
                      {isVisible("ip") && (
                        <TableCell>
                          {(log as any).ipAddress ? (
                            <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                              <Globe className="w-3 h-3 flex-shrink-0" />
                              {(log as any).ipAddress}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">
                              -
                            </span>
                          )}
                          {(log as any).userAgent && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Monitor className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" />
                              <span
                                className="text-[10px] text-muted-foreground/40 truncate max-w-[100px]"
                                title={(log as any).userAgent}
                              >
                                {(log as any).userAgent?.split(" ")[0]}
                              </span>
                            </div>
                          )}
                        </TableCell>
                      )}
                      {isVisible("details") && (
                        <TableCell className="text-sm text-muted-foreground max-w-[280px]">
                          {(() => {
                            const p = parseDetails((log as any).details);
                            return (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  {p.roomNumber && (
                                    <Badge
                                      variant="secondary"
                                      className="px-1.5 py-0 text-[10px] font-mono font-bold bg-blue-100/90 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 shrink-0"
                                      title={ar ? `الغرفة: ${p.roomNumber}` : `Room: ${p.roomNumber}`}
                                    >
                                      🚪 {p.roomNumber}
                                    </Badge>
                                  )}
                                  <p
                                    className="truncate text-xs text-foreground/80 font-medium"
                                    title={(log as any).details ?? ""}
                                  >
                                    {p.summary || (typeof p.data === "string" ? p.data : (log as any).details) || "-"}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1.5 text-[11px] gap-1 text-primary hover:bg-primary/10 flex-shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedLog(log);
                                  }}
                                  title={ar ? "عرض التفاصيل الكاملة" : "View full details"}
                                >
                                  <Eye className="w-3 h-3" />
                                  {ar ? "تفاصيل" : "Details"}
                                </Button>
                              </div>
                            );
                          })()}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {paginated.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={visible.size}
                        className="py-12 text-center"
                      >
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Activity className="w-8 h-8 opacity-30" />
                          <p className="font-medium">
                            {ar ? "لا توجد سجلات مطابقة" : "No matching logs"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ar
                              ? "ستظهر أحداث النظام هنا"
                              : "System activities will appear here"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  {selectedLog && (
                    (() => {
                      const detailsParsed = parseDetails((selectedLog as any).details);
                      return (
                        <div className="space-y-4">
                          <DialogHeader>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${actionColor(selectedLog.action)}`}>
                                  {selectedLog.action}
                                </span>
                                {selectedLog.module && (
                                  <Badge variant="outline" className="text-xs uppercase">
                                    {selectedLog.module}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground font-mono">
                                {formatDateTime(selectedLog.timestamp, "-")}
                              </span>
                            </div>
                            <DialogTitle className="text-lg font-bold mt-2">
                              {ar ? "تفاصيل العملية والنشاط" : "Activity Log Details"}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground">
                              {ar ? `رقم السجل: #${selectedLog.id}` : `Record ID: #${selectedLog.id}`}
                            </DialogDescription>
                          </DialogHeader>

                          {detailsParsed.summary && (
                            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-sm">
                              <p className="font-semibold text-primary mb-1">
                                {ar ? "ملخص الإجراء:" : "Action Summary:"}
                              </p>
                              <p className="text-foreground leading-relaxed">
                                {detailsParsed.summary}
                              </p>
                            </div>
                          )}

                          <div className={`grid grid-cols-2 ${detailsParsed.roomNumber ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-2.5 text-xs`}>
                            <div className="p-3 rounded-lg bg-muted/40 border">
                              <p className="text-muted-foreground font-medium mb-1">{ar ? "المستخدم:" : "User:"}</p>
                              <p className="font-semibold text-foreground">{selectedLog.username || "-"}</p>
                              {selectedLog.userRole && (
                                <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{selectedLog.userRole}</p>
                              )}
                            </div>
                            {detailsParsed.roomNumber && (
                              <div className="p-3 rounded-lg bg-blue-50/80 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800">
                                <p className="text-blue-700 dark:text-blue-300 font-semibold mb-1">{ar ? "رقم الغرفة:" : "Room Number:"}</p>
                                <p className="font-mono font-bold text-blue-950 dark:text-blue-100 text-sm">
                                  🚪 {detailsParsed.roomNumber}
                                </p>
                              </div>
                            )}
                            <div className="p-3 rounded-lg bg-muted/40 border">
                              <p className="text-muted-foreground font-medium mb-1">{ar ? "العنصر المرتبط:" : "Entity:"}</p>
                              <p className="font-semibold text-foreground">
                                {selectedLog.entityType ? `${selectedLog.entityType} #${selectedLog.entityId || ""}` : "-"}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-muted/40 border col-span-2 sm:col-span-1">
                              <p className="text-muted-foreground font-medium mb-1">{ar ? "عنوان IP:" : "IP Address:"}</p>
                              <p className="font-mono text-foreground">{(selectedLog as any).ipAddress || "-"}</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <Terminal className="w-3.5 h-3.5 text-primary" />
                                {ar ? "البيانات المسجلة (Payload & Parameters):" : "Recorded Payload & Data:"}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => {
                                  const content = typeof detailsParsed.data === "object"
                                    ? JSON.stringify(detailsParsed.data, null, 2)
                                    : String((selectedLog as any).details || "");
                                  navigator.clipboard.writeText(content);
                                  toast.success(ar ? "تم نسخ التفاصيل للحافظة" : "Copied to clipboard");
                                }}
                              >
                                <Copy className="w-3 h-3" />
                                {ar ? "نسخ JSON" : "Copy JSON"}
                              </Button>
                            </div>

                            <div className="rounded-xl border bg-slate-950 p-3.5 text-slate-50 text-xs font-mono overflow-x-auto max-h-[280px]">
                              {detailsParsed.isJson ? (
                                <pre className="whitespace-pre-wrap break-all leading-relaxed">
                                  {JSON.stringify(detailsParsed.data, null, 2)}
                                </pre>
                              ) : (
                                <p className="whitespace-pre-wrap leading-relaxed">
                                  {(selectedLog as any).details || (ar ? "لا توجد تفاصيل إضافية" : "No extra details recorded")}
                                </p>
                              )}
                            </div>
                          </div>

                          {(selectedLog as any).userAgent && (
                            <div className="text-[11px] text-muted-foreground pt-1 border-t">
                              <span className="font-medium text-foreground">{ar ? "المتصفح والنظام:" : "User Agent:"} </span>
                              <span className="font-mono text-[10px] break-all">{(selectedLog as any).userAgent}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </DialogContent>
              </Dialog>

              {totalLogs > 0 && (
                <DataPagination
                  total={totalLogs}
                  pageSize={pageSize}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                />
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {!keyAuditPropertyId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {ar
                ? "اختر فرعا محددا لعرض سجل المفاتيح."
                : "Select a specific property to view key audit logs."}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder={
                ar
                  ? "بحث بالغرفة أو رقم الكارت أو التفاصيل..."
                  : "Search room, card number, details..."
              }
              value={keySearch}
              onChange={(e) => {
                setKeySearch(e.target.value);
                setKeyCurrentPage(1);
              }}
              className="w-72"
            />
            <Select
              value={keyActionFilter}
              onValueChange={(v) => {
                setKeyActionFilter(v);
                setKeyCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KEY_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a === "all"
                      ? ar
                        ? "كل الإجراءات"
                        : "All Actions"
                      : prettyKeyAction(a, ar)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateInput
              value={keyDateFrom}
              onChange={(iso) => {
                setKeyDateFrom(iso);
                setKeyCurrentPage(1);
              }}
              className="w-44"
            />
            <DateInput
              value={keyDateTo}
              onChange={(iso) => {
                setKeyDateTo(iso);
                setKeyCurrentPage(1);
              }}
              className="w-44"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {keyStats.map((stat) => (
              <div
                key={stat.label}
                className="border rounded-lg p-3 bg-card text-center"
              >
                <p className={`text-2xl font-bold ${stat.color}`}>
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {keyLogsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="border rounded-lg bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-semibold whitespace-nowrap">
                      {ar ? "التاريخ والوقت" : "Date & Time"}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {ar ? "الإجراء" : "Action"}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {ar ? "الغرفة" : "Room"}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {ar ? "رقم الكارت" : "Card Number"}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {ar ? "المفتاح" : "Key"}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {ar ? "بواسطة" : "By"}
                    </TableHead>
                    <TableHead className="font-semibold">
                      {ar ? "التفاصيل" : "Details"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedKeyLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/20">
                      <TableCell className="text-xs font-mono whitespace-nowrap">
                        <div className="font-medium text-foreground">
                          {formatDate(log.createdAt, "-")}
                        </div>
                        <div className="text-muted-foreground">
                          {log.createdAt
                            ? format(new Date(log.createdAt), "HH:mm:ss")
                            : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${keyActionColor(log.action)}`}
                        >
                          {prettyKeyAction(log.action, ar)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {log.roomNumber || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.cardNumber || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        #{log.keyId ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.performedBy ? `User #${log.performedBy}` : "-"}
                      </TableCell>
                      <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                        <p
                          className="truncate"
                          title={formatDetails(log.details)}
                        >
                          {formatDetails(log.details) || "-"}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredKeyLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <KeyRound className="w-8 h-8 opacity-30" />
                          <p className="font-medium">
                            {ar
                              ? "لا توجد سجلات مفاتيح"
                              : "No key audit records found"}
                          </p>
                          <p className="text-sm">
                            {ar
                              ? "عمليات إصدار وإلغاء المفاتيح ستظهر هنا"
                              : "Key issue and revoke events will appear here"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filteredKeyLogs.length > 0 && (
                <DataPagination
                  total={filteredKeyLogs.length}
                  pageSize={keyPageSize}
                  onPageSizeChange={(size) => {
                    setKeyPageSize(size);
                    setKeyCurrentPage(1);
                  }}
                  currentPage={keyCurrentPage}
                  onPageChange={setKeyCurrentPage}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
