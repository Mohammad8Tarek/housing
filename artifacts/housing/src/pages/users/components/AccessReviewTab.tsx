// Access review: what each user can actually do, as the server grants it.
// Filter by one permission to answer "who can …?", expand a row to see every
// action per module, and export the whole matrix to Excel.
import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  Download,
  Layers,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DataPagination } from "@/components/DataPagination";
import { PermissionGate } from "@/components/ui/permission-gate";
import { useDebounce } from "@/hooks/use-debounce";
import { getExportFileName } from "@/lib/date-utils";
import { XLSX, writeSunriseWorkbook } from "@/lib/xlsx-brand";
import { ACTION_LABELS, MODULE_LABELS } from "@/lib/permissions";

type ReviewUser = {
  id: number;
  username: string;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  roles: string[];
  active: boolean;
  status: string;
  isRoot: boolean;
  template: { id: number; nameAr: string; nameEn: string } | null;
  permissions: string[];
};

type ReviewResponse = {
  data: ReviewUser[];
  pagination: { page: number; limit: number; total: number };
  totalUsers: number;
  totalPermissions: number;
  permissionCounts: Record<string, number>;
};

const moduleOf = (p: string) => p.slice(0, p.indexOf("."));
const actionOf = (p: string) => p.slice(p.indexOf(".") + 1);

function useLabels(ar: boolean) {
  return useMemo(
    () => ({
      module: (m: string) => {
        const l = (MODULE_LABELS as Record<string, { en: string; ar: string }>)[
          m
        ];
        return l ? (ar ? l.ar : l.en) : m;
      },
      action: (a: string) => {
        const l = (ACTION_LABELS as Record<string, { en: string; ar: string }>)[
          a
        ];
        return l ? (ar ? l.ar : l.en) : a;
      },
    }),
    [ar],
  );
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== "all") qs.set(k, String(v));
  }
  return `/api/users/access-review?${qs.toString()}`;
}

export function AccessReviewTab({ ar }: { ar: boolean }) {
  const label = useLabels(ar);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState("active");
  const [permission, setPermission] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = {
    search: debouncedSearch.trim(),
    status,
    permission,
  };
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/users/access-review", filters, page, pageSize],
    queryFn: () =>
      customFetch<ReviewResponse>(
        buildQuery({ ...filters, page, limit: pageSize }),
      ),
    placeholderData: (prev) => prev,
  });

  const counts = data?.permissionCounts ?? {};
  const totalPermissions = data?.totalPermissions ?? 0;

  // Catalogue grouped by module, from the server's own permission list.
  const catalogue = useMemo(() => {
    const byModule = new Map<string, string[]>();
    for (const p of Object.keys(counts)) {
      const m = moduleOf(p);
      byModule.set(m, [...(byModule.get(m) ?? []), p]);
    }
    return byModule;
  }, [counts]);

  const resetPage = () => {
    setPage(1);
    setExpanded(null);
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const all: ReviewUser[] = [];
      for (let p = 1; p <= 100; p++) {
        const res = await customFetch<ReviewResponse>(
          buildQuery({ ...filters, page: p, limit: 100 }),
        );
        all.push(...res.data);
        if (all.length >= res.pagination.total || res.data.length === 0) break;
      }
      const modules = [...catalogue.keys()];
      const header = [
        ar ? "المستخدم" : "User",
        ar ? "الأدوار" : "Roles",
        ar ? "قالب الدور" : "Role template",
        ar ? "الحالة" : "Status",
        ar ? "عدد الصلاحيات" : "Permissions",
        ...modules.map((m) => label.module(m)),
      ];
      const rows = all.map((u) => {
        const held = new Set(u.permissions);
        return [
          u.username,
          u.isRoot
            ? ar
              ? "مدير النظام (كل الصلاحيات)"
              : "System admin (everything)"
            : u.roles.join(", "),
          u.template ? (ar ? u.template.nameAr : u.template.nameEn) : "",
          u.active ? (ar ? "نشط" : "Active") : ar ? "غير نشط" : "Inactive",
          `${u.permissions.length}/${totalPermissions}`,
          ...modules.map((m) =>
            (catalogue.get(m) ?? [])
              .filter((p) => held.has(p))
              .map((p) => label.action(actionOf(p)))
              .join(ar ? "، " : ", "),
          ),
        ];
      });
      const title =
        permission !== "all"
          ? [
              `${ar ? "من يملك صلاحية" : "Who can"}: ${label.module(moduleOf(permission))} — ${label.action(actionOf(permission))}`,
            ]
          : [ar ? "مراجعة صلاحيات المستخدمين" : "User access review"];
      const ws = XLSX.utils.aoa_to_sheet([title, [], header, ...rows]);
      ws["!cols"] = header.map((_, i) => ({ wch: i < 5 ? 22 : 26 }));
      if (ar) ws["!views"] = [{ RTL: true }] as any;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, ar ? "الصلاحيات" : "Access");
      writeSunriseWorkbook(wb, getExportFileName("Access_Review", "xlsx"), {
        rtl: ar,
      });
    } catch {
      toast.error(ar ? "تعذر تصدير الملف" : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const users = data?.data ?? [];
  const total = data?.pagination.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground flex gap-3">
        <ShieldCheck className="w-5 h-5 text-[#C9A24D] shrink-0 mt-0.5" />
        <p>
          {ar
            ? "الصلاحيات هنا هي اللي السيرفر بيطبّقها فعلاً على كل مستخدم. اختار صلاحية عشان تعرف مين يقدر يعملها، أو افتح أي مستخدم عشان تشوف صلاحياته في كل قسم."
            : "These are the permissions the server actually enforces for each user. Pick a permission to see who holds it, or expand a user to see their access per module."}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={
              ar
                ? "بحث بالاسم أو الإيميل أو القسم..."
                : "Search name, email or department..."
            }
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            className="pl-10 rtl:pr-10 rtl:pl-3 h-10"
          />
        </div>
        <Select
          value={permission}
          onValueChange={(v) => {
            setPermission(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-full lg:w-[320px] h-10">
            <SelectValue placeholder={ar ? "من يملك صلاحية…" : "Who can…"}>
              {permission === "all"
                ? ar
                  ? "كل الصلاحيات"
                  : "All permissions"
                : `${label.module(moduleOf(permission))} — ${label.action(actionOf(permission))}`}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[360px]">
            <SelectItem value="all">
              {ar ? "كل الصلاحيات" : "All permissions"}
            </SelectItem>
            {[...catalogue.entries()].map(([m, perms]) => (
              <SelectGroup key={m}>
                <SelectLabel>{label.module(m)}</SelectLabel>
                {perms.map((p) => (
                  <SelectItem key={p} value={p}>
                    {label.action(actionOf(p))}{" "}
                    <span className="text-muted-foreground">
                      ({counts[p] ?? 0})
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-full lg:w-[150px] h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{ar ? "النشطين" : "Active"}</SelectItem>
            <SelectItem value="inactive">
              {ar ? "غير النشطين" : "Inactive"}
            </SelectItem>
            <SelectItem value="all">{ar ? "الكل" : "All"}</SelectItem>
          </SelectContent>
        </Select>
        <PermissionGate module="users" action="export">
          <Button
            variant="outline"
            className="h-10 gap-2"
            onClick={exportAll}
            disabled={exporting || total === 0}
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {ar ? "تصدير Excel" : "Export Excel"}
          </Button>
        </PermissionGate>
      </div>

      {permission !== "all" && data && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-sm">
          <span>
            <b>{total}</b>{" "}
            {ar
              ? `من ${data.totalUsers} مستخدم يقدروا: `
              : `of ${data.totalUsers} users can: `}
            <b>
              {label.module(moduleOf(permission))} —{" "}
              {label.action(actionOf(permission))}
            </b>
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1"
            onClick={() => {
              setPermission("all");
              resetPage();
            }}
          >
            <X className="w-3.5 h-3.5" />
            {ar ? "إلغاء" : "Clear"}
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="md:w-[30%] px-4 py-3 text-start font-semibold">
                {ar ? "المستخدم" : "User"}
              </th>
              <th className="hidden md:table-cell w-[22%] px-4 py-3 text-start font-semibold">
                {ar ? "الدور / القالب" : "Role / template"}
              </th>
              <th className="w-[34%] md:w-[18%] px-4 py-3 text-start font-semibold">
                {ar ? "حجم الصلاحيات" : "Access"}
              </th>
              <th className="hidden md:table-cell px-4 py-3 text-start font-semibold">
                {ar ? "الأقسام" : "Modules"}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="py-10 text-center">
                  <Loader2 className="w-5 h-5 animate-spin inline" />
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={4} className="py-10 text-center">
                  <span className="text-destructive">
                    {ar ? "تعذر التحميل" : "Failed to load"}
                  </span>{" "}
                  <Button size="sm" variant="link" onClick={() => refetch()}>
                    {ar ? "إعادة المحاولة" : "Retry"}
                  </Button>
                </td>
              </tr>
            )}
            {!isLoading && !isError && users.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-10 text-center text-muted-foreground"
                >
                  {ar ? "لا يوجد مستخدمين" : "No users"}
                </td>
              </tr>
            )}
            {users.map((u) => {
              const held = new Set(u.permissions);
              const modules = [...catalogue.entries()]
                .map(([m, perms]) => ({
                  m,
                  n: perms.filter((p) => held.has(p)).length,
                  of: perms.length,
                }))
                .filter((x) => x.n > 0);
              const pct = totalPermissions
                ? Math.round((u.permissions.length / totalPermissions) * 100)
                : 0;
              const open = expanded === u.id;
              return (
                <Fragment key={u.id}>
                  <tr
                    className={`border-t cursor-pointer hover:bg-muted/30 ${open ? "bg-muted/30" : ""}`}
                    onClick={() => setExpanded(open ? null : u.id)}
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-2 min-w-0">
                        <ChevronDown
                          className={`w-4 h-4 mt-0.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold truncate flex items-center gap-2">
                            <span className="truncate">{u.username}</span>
                            {!u.active && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 text-muted-foreground"
                              >
                                {ar ? "غير نشط" : "Inactive"}
                              </Badge>
                            )}
                          </div>
                          <div
                            className="text-xs text-muted-foreground truncate"
                            title={[u.jobTitle, u.department, u.email]
                              .filter(Boolean)
                              .join(" · ")}
                          >
                            {[u.jobTitle, u.department, u.email]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 align-top overflow-hidden">
                      {u.isRoot ? (
                        <Badge className="bg-[#0F2A44] text-white">
                          {ar ? "مدير النظام" : "System admin"}
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.roles.slice(0, 2).map((r) => (
                            <Badge
                              key={r}
                              variant="secondary"
                              className="text-[11px] truncate max-w-full"
                            >
                              {r}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                        <Layers className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {u.isRoot
                            ? ar
                              ? "كل الصلاحيات دائماً"
                              : "Always every permission"
                            : u.template
                              ? ar
                                ? u.template.nameAr
                                : u.template.nameEn
                              : ar
                                ? "صلاحيات مخصصة"
                                : "Individual permissions"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold tabular-nums">
                        {u.permissions.length}
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          / {totalPermissions}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 75 ? "bg-rose-500" : pct >= 40 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 align-top overflow-hidden">
                      <div className="flex flex-wrap gap-1">
                        {modules.slice(0, 5).map((x) => (
                          <Badge
                            key={x.m}
                            variant="outline"
                            className={`text-[11px] font-normal ${x.n === x.of ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-amber-500/40 text-amber-700 dark:text-amber-400"}`}
                          >
                            {label.module(x.m)} {x.n}/{x.of}
                          </Badge>
                        ))}
                        {modules.length > 5 && (
                          <Badge
                            variant="secondary"
                            className="text-[11px] font-normal"
                          >
                            +{modules.length - 5}
                          </Badge>
                        )}
                        {modules.length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            {ar ? "بدون صلاحيات" : "No access"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-muted/20">
                      <td colSpan={4} className="px-4 py-4">
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {[...catalogue.entries()].map(([m, perms]) => {
                            const has = perms.filter((p) => held.has(p));
                            return (
                              <div
                                key={m}
                                className={`rounded-lg border bg-background p-3 ${has.length === 0 ? "opacity-50" : ""}`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <span className="font-semibold text-xs truncate">
                                    {label.module(m)}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground tabular-nums">
                                    {has.length}/{perms.length}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {perms.map((p) => (
                                    <span
                                      key={p}
                                      className={`text-[11px] rounded px-1.5 py-0.5 ${held.has(p) ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground line-through"} ${p === permission ? "ring-1 ring-amber-500" : ""}`}
                                    >
                                      {label.action(actionOf(p))}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <DataPagination
          total={total}
          pageSize={pageSize}
          currentPage={page}
          onPageChange={(p) => {
            setPage(p);
            setExpanded(null);
          }}
          onPageSizeChange={(s) => {
            setPageSize(s);
            resetPage();
          }}
        />
      </div>
    </div>
  );
}
