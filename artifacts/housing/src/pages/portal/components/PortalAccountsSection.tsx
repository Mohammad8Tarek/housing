// @ts-nocheck
import { useState } from "react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatDate } from "@/lib/date-utils";
import { toast } from "sonner";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";
import { DataPagination } from "@/components/DataPagination";
import {
  Shield,
  RefreshCw,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  X,
  Users,
  KeyRound,
  UserCheck,
  UserX,
} from "lucide-react";

export function PortalAccountsSection() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  // Pagination & Filter States
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  // Fetch paginated accounts from backend
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "portal-accounts",
      activePropertyId,
      currentPage,
      pageSize,
      debouncedSearch,
      statusFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        propertyId: String(activePropertyId),
        page: String(currentPage),
        limit: String(pageSize),
        paginate: "true",
      });

      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const r = await fetch(`/api/portal-auth/accounts?${params.toString()}`);
      if (!r.ok) {
        return { accounts: [], total: 0, activeCount: 0, totalPages: 0 };
      }
      const res = await r.json();
      if (Array.isArray(res)) {
        return {
          accounts: res,
          total: res.length,
          activeCount: res.filter((a: any) => a.isActive).length,
          totalPages: Math.ceil(res.length / pageSize),
        };
      }
      return res;
    },
    enabled: !!activePropertyId,
    placeholderData: (prev) => prev,
  });

  const accounts = data?.accounts ?? [];
  const total = data?.total ?? 0;
  const activeCount = data?.activeCount ?? 0;

  // Toggle Portal Access Mutation
  const toggleMutation = useMutation({
    mutationFn: async ({
      profileId,
      isActive,
    }: {
      profileId: string;
      isActive: boolean;
    }) => {
      const r = await fetch("/api/portal-auth/toggle-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          isActive,
          propertyId: activePropertyId,
        }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.isActive
          ? ar
            ? "تم تفعيل صلاحية البوابة بنجاح"
            : "Portal access enabled successfully"
          : ar
            ? "تم تعطيل صلاحية البوابة"
            : "Portal access disabled",
      );
      queryClient.invalidateQueries({
        queryKey: ["portal-accounts", activePropertyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["portal-account"],
      });
    },
    onError: () =>
      toast.error(ar ? "حدث خطأ أثناء تغيير الحالة" : "Error updating status"),
  });

  // Reset Password Mutation
  const resetMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const r = await fetch("/api/portal-auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, propertyId: activePropertyId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (res) => {
      const pw = res?.temporaryPassword || "1234";
      toast.success(
        ar
          ? `تمت إعادة تعيين كلمة المرور بنجاح: ${pw}`
          : `Password reset successfully: ${pw}`,
        { duration: 8000 },
      );
      queryClient.invalidateQueries({
        queryKey: ["portal-accounts", activePropertyId],
      });
    },
    onError: () =>
      toast.error(
        ar ? "حدث خطأ أثناء إعادة تعيين كلمة المرور" : "Error resetting password",
      ),
  });

  return (
    <div className="space-y-4">
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {ar ? "إدارة حسابات بوابة المقيمين" : "Portal Account Management"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {ar
              ? "التحكم في صلاحيات دخول الموظفين لبوابة المقيمين، تفعيل/تعطيل الحسابات، وإعادة تعيين كلمات المرور"
              : "Control employee portal login access, enable/disable accounts, and reset passwords"}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Badge
            variant="outline"
            className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium"
          >
            <CheckCircle className="w-3.5 h-3.5 me-1.5 text-emerald-600" />
            {ar ? `${activeCount} حساب مفعّل` : `${activeCount} Active Accounts`}
          </Badge>
          <Badge
            variant="outline"
            className="text-xs bg-muted/50 font-medium"
          >
            <Users className="w-3.5 h-3.5 me-1.5 text-muted-foreground" />
            {ar ? `${total} إجمالي السجلات` : `${total} Total Records`}
          </Badge>
        </div>
      </div>

      {/* Filter Bar: Debounced Search & Status Select */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={
              ar
                ? "بحث بالاسم، رقم الموظف، الوظيفة، القسم..."
                : "Search by name, profile ID, job title, department..."
            }
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="ps-9 pe-9 h-9 text-xs"
          />
          {search && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title={ar ? "مسح البحث" : "Clear search"}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-full sm:w-52 h-9 text-xs">
            <Filter className="w-3.5 h-3.5 me-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {ar ? "جميع الحالات (الكل)" : "All Statuses"}
            </SelectItem>
            <SelectItem value="active">
              {ar ? "البوابة مفعّلة فقط" : "Active Portal Only"}
            </SelectItem>
            <SelectItem value="inactive">
              {ar ? "البوابة معطّلة" : "Disabled Portal Only"}
            </SelectItem>
            <SelectItem value="no_account">
              {ar ? "بدون حساب بوابة" : "No Portal Account"}
            </SelectItem>
          </SelectContent>
        </Select>

        {(search || statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setCurrentPage(1);
            }}
            className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {ar ? "إعادة ضبط التصفية" : "Reset Filters"}
          </Button>
        )}
      </div>

      {/* Table Content */}
      {isLoading ? (
        <div className="border rounded-lg p-4 space-y-3 bg-card">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>{ar ? "الموظف والوظيفة" : "Employee & Job"}</TableHead>
                <TableHead>{ar ? "رقم الموظف" : "Profile ID"}</TableHead>
                <TableHead>{ar ? "القسم / الإدارة" : "Department"}</TableHead>
                <TableHead>{ar ? "آخر تسجيل دخول" : "Last Login"}</TableHead>
                <TableHead>{ar ? "حالة البوابة" : "Portal Status"}</TableHead>
                <TableHead className="text-center">{ar ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc: any, idx: number) => {
                const rowNum = (currentPage - 1) * pageSize + idx + 1;
                return (
                  <TableRow key={acc.profileId} className="hover:bg-muted/20">
                    <TableCell className="text-center text-xs text-muted-foreground font-mono">
                      {rowNum}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">
                          {acc.profileName ?? acc.profileId}
                        </span>
                        {acc.jobTitle && (
                          <span className="text-[11px] text-muted-foreground">
                            {acc.jobTitle}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2 py-0.5 rounded border border-border/50">
                        {acc.profileId}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {acc.department || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {acc.lastLoginAt ? (
                        formatDate(acc.lastLoginAt)
                      ) : (
                        <span className="text-muted-foreground/60">
                          {ar ? "لم يدخل بعد" : "Never"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {acc.isActive ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] w-fit font-medium">
                            <CheckCircle className="w-3 h-3 me-1" />
                            {ar ? "بوابة مفعّلة" : "Portal Active"}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-muted-foreground w-fit"
                          >
                            <XCircle className="w-3 h-3 me-1" />
                            {acc.hasAccount
                              ? ar
                                ? "بوابة معطّلة"
                                : "Portal Disabled"
                              : ar
                                ? "بدون حساب"
                                : "No Account"}
                          </Badge>
                        )}
                        {acc.profileStatus && (
                          <span className="text-[10px] text-muted-foreground/80">
                            {acc.profileStatus}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant={acc.isActive ? "outline" : "default"}
                          size="sm"
                          className="h-7 text-xs px-2.5 gap-1"
                          onClick={() =>
                            toggleMutation.mutate({
                              profileId: acc.profileId,
                              isActive: !acc.isActive,
                            })
                          }
                          disabled={toggleMutation.isPending}
                        >
                          {acc.isActive ? (
                            <>
                              <UserX className="w-3 h-3 text-red-500" />
                              {ar ? "تعطيل" : "Disable"}
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3" />
                              {ar ? "تفعيل" : "Enable"}
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2.5 gap-1 hover:bg-muted"
                          onClick={() => resetMutation.mutate(acc.profileId)}
                          disabled={resetMutation.isPending}
                          title={ar ? "إعادة تعيين كلمة المرور إلى 1234" : "Reset password to 1234"}
                        >
                          <KeyRound className="w-3 h-3 text-amber-500" />
                          {ar ? "إعادة كلمة المرور" : "Reset Password"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {accounts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Shield className="w-8 h-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium">
                        {ar
                          ? "لا توجد حسابات بوابة مطابقة لمعايير البحث"
                          : "No portal accounts found matching criteria"}
                      </p>
                      {(search || statusFilter !== "all") && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setSearch("");
                            setStatusFilter("all");
                            setCurrentPage(1);
                          }}
                          className="text-xs"
                        >
                          {ar ? "مسح عوامل التصفية" : "Clear filters"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* DataPagination Component */}
          <DataPagination
            total={total}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
