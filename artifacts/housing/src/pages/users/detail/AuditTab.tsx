// User detail > Audit trail tab.
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, RefreshCw, History } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserDetailPageState } from "./useUserDetailPageState";
import { SessionsList } from "@/components/SessionsList";
import { UserTwoFactorCard } from "./UserTwoFactorCard";
import { PermissionGate } from "@/components/ui/permission-gate";
import { MonitorSmartphone } from "lucide-react";

export function renderAuditTab(s: UserDetailPageState) {
  const { ar, isAuditLoading, refetchAudit, auditLogs, userId } = s;
  return (
    <div className="space-y-6">
      <PermissionGate module="users" action="edit">
        <UserTwoFactorCard ar={ar} userId={userId} />
      </PermissionGate>
      <PermissionGate module="users" action="edit">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MonitorSmartphone className="w-5 h-5 text-[#C9A24D]" />
              {ar ? "الأجهزة المسجّل دخول منها" : "Signed-in devices"}
            </CardTitle>
            <CardDescription>
              {ar
                ? "الجلسات المفتوحة للحساب ده دلوقتي. تقدر تخرّج جهاز واحد أو تخرّجه من كل الأجهزة."
                : "This account's open sessions. Sign out one device or sign the user out everywhere."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SessionsList ar={ar} userId={userId} />
          </CardContent>
        </Card>
      </PermissionGate>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-[#C9A24D]" />
              {ar
                ? "سجل نشاط وحركات المستخدم"
                : "User Security & Activity Audit"}
            </CardTitle>
            <CardDescription>
              {ar
                ? "سجل زمني مفصل لجميع العمليات والحركات التي نفذها هذا الحساب في النظام."
                : "Chronological activity log performed by this account."}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchAudit()}
            disabled={isAuditLoading}
            className="text-xs"
          >
            <RefreshCw
              className={cn(
                "w-3.5 h-3.5 me-1.5",
                isAuditLoading && "animate-spin",
              )}
            />
            {ar ? "تحديث السجل" : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent>
          {isAuditLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-[#C9A24D]" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <Activity className="w-8 h-8 mx-auto opacity-30" />
              <p className="font-semibold">
                {ar
                  ? "لا توجد حركات مسجلة لهذا المستخدم حتى الآن"
                  : "No activity logs recorded yet"}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-40">
                      {ar ? "التاريخ والوقت" : "Timestamp"}
                    </TableHead>
                    <TableHead>{ar ? "الموديول" : "Module"}</TableHead>
                    <TableHead>{ar ? "الإجراء" : "Action"}</TableHead>
                    <TableHead>{ar ? "التفاصيل" : "Details"}</TableHead>
                    <TableHead className="w-32">
                      {ar ? "عنوان IP" : "IP Address"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {new Date(
                          log.createdAt || log.timestamp,
                        ).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-muted">
                          {log.module}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-bold text-foreground">
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {typeof log.details === "object"
                          ? JSON.stringify(log.details)
                          : String(log.details || "—")}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {log.ipAddress || log.ip || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
