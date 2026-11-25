// User detail > Access & permissions > change history.
// Who changed this user's roles or permissions and when, with before/after.
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  History,
  Plus,
  Minus,
  ArrowRight,
  Ban,
  ShieldCheck,
  MapPin,
} from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { Skeleton } from "@/components/ui/skeleton";

type HistoryEntry = {
  id: number;
  username: string | null;
  userRole: string | null;
  action: string | null;
  createdAt: string | null;
  details: {
    rolesChanged?: boolean;
    permsChanged?: boolean;
    oldRoles?: string[];
    newRoles?: string[];
    addedPerms?: string[];
    removedPerms?: string[];
    deniedChanged?: boolean;
    addedDenied?: string[];
    removedDenied?: string[];
    scopesChanged?: boolean;
    changedScopeKeys?: string[];
  } | null;
};

export function PermissionHistory({
  userId,
  ar,
}: {
  userId: number;
  ar: boolean;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/users/permission-history", userId],
    queryFn: () =>
      customFetch<{ data: HistoryEntry[] }>(
        `/api/users/${userId}/permission-history?limit=50`,
      ),
    enabled: !!userId,
  });
  const entries = data?.data ?? [];

  return (
    <Card className="border shadow-sm">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <History className="w-4 h-4 text-[#C9A24D]" />
          {ar ? "سجل تغييرات الصلاحيات والأدوار" : "Access change history"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        {isLoading ? (
          <div className="py-2 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground py-4">
            {ar ? "تعذّر تحميل السجل" : "Could not load the history"}
          </p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            {ar
              ? "لا توجد تغييرات مسجّلة على صلاحيات أو أدوار هذا المستخدم."
              : "No recorded changes to this user's roles or permissions."}
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((e) => {
              const d = e.details ?? {};
              return (
                <li
                  key={e.id}
                  className="rounded-lg border p-3 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold">
                      {ar ? "بواسطة" : "By"} {e.username ?? "—"}
                      {e.userRole ? (
                        <Badge
                          variant="outline"
                          className="ms-2 text-[10px] px-1.5 py-0"
                        >
                          {e.userRole}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground">
                      {e.createdAt ? formatDate(e.createdAt) : ""}
                    </span>
                  </div>

                  {d.rolesChanged && (
                    <div
                      className="flex items-center gap-1.5 flex-wrap"
                      dir="ltr"
                    >
                      <span className="font-medium">
                        {ar ? "الدور:" : "Role:"}
                      </span>
                      <span className="text-muted-foreground">
                        [{(d.oldRoles ?? []).join(", ") || "—"}]
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-foreground font-semibold">
                        [{(d.newRoles ?? []).join(", ") || "—"}]
                      </span>
                    </div>
                  )}

                  {(d.addedPerms?.length || d.removedPerms?.length) && (
                    <div className="flex flex-col gap-1" dir="ltr">
                      {d.addedPerms && d.addedPerms.length > 0 && (
                        <div className="flex items-start gap-1 text-emerald-600 dark:text-emerald-400">
                          <Plus className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="break-all">
                            {d.addedPerms.join(", ")}
                          </span>
                        </div>
                      )}
                      {d.removedPerms && d.removedPerms.length > 0 && (
                        <div className="flex items-start gap-1 text-rose-600 dark:text-rose-400">
                          <Minus className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="break-all">
                            {d.removedPerms.join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {(d.addedDenied?.length || d.removedDenied?.length) && (
                    <div className="flex flex-col gap-1" dir="ltr">
                      <span className="font-medium text-rose-700 dark:text-rose-300 flex items-center gap-1">
                        <Ban className="w-3 h-3" />
                        {ar ? "المنع الصريح:" : "Explicit deny:"}
                      </span>
                      {d.addedDenied && d.addedDenied.length > 0 && (
                        <div className="flex items-start gap-1 text-rose-600 dark:text-rose-400">
                          <Ban className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="break-all">
                            {d.addedDenied.join(", ")}
                          </span>
                        </div>
                      )}
                      {d.removedDenied && d.removedDenied.length > 0 && (
                        <div className="flex items-start gap-1 text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="break-all">
                            {d.removedDenied.join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {d.scopesChanged && d.changedScopeKeys?.length ? (
                    <div className="flex flex-col gap-1" dir="ltr">
                      <span className="font-medium text-sky-700 dark:text-sky-300 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {ar ? "نطاق الفنادق:" : "Property scope:"}
                      </span>
                      <span className="break-all text-sky-700 dark:text-sky-400">
                        {d.changedScopeKeys.join(", ")}
                      </span>
                    </div>
                  ) : null}

                  {!d.rolesChanged &&
                    !d.addedPerms?.length &&
                    !d.removedPerms?.length &&
                    !d.addedDenied?.length &&
                    !d.removedDenied?.length &&
                    !d.changedScopeKeys?.length &&
                    e.action && (
                      <p className="text-muted-foreground break-words">
                        {e.action}
                      </p>
                    )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
