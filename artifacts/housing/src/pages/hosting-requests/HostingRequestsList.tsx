import { useState, useCallback, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DataPagination } from "@/components/DataPagination";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useLocation } from "wouter";
import { Plus, Search } from "lucide-react";
import { usePermission } from "@/hooks/use-permission";

const STATUS_TABS = ["all", "in_signing", "approved", "rejected"] as const;

const statusLabels: Record<string, Record<string, string>> = {
  all: { en: "All", ar: "الكل" },
  in_signing: { en: "In Signing", ar: "قيد التوقيع" },
  approved: { en: "Approved", ar: "معتمد" },
  rejected: { en: "Rejected", ar: "مرفوض" },
};

const statusColors: Record<string, string> = {
  all: "",
  in_signing: "bg-muted-foreground",
  approved: "bg-green-500",
  rejected: "bg-red-500",
};

const statusBadgeVariant: Record<
  string,
  "success" | "warning" | "danger" | "info" | "muted"
> = {
  in_signing: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "muted",
};

export default function HostingRequestsList() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [, setLocation] = useLocation();
  const { canCreate } = usePermission();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data: countsData } = useQuery({
    queryKey: ["/api/hosting-requests/counts"],
    queryFn: async () => {
      const res = await fetch("/api/hosting-requests/counts");
      const json = await res.json();
      return json.data;
    },
  });

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: [
      "/api/hosting-requests",
      { page, limit, status: statusFilter, search },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/hosting-requests?${params}`);
      if (!res.ok) {
        throw new Error("Failed to load hosting requests");
      }
      return res.json();
    },
    placeholderData: (prev: any) => prev,
  });

  const handleSearch = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(1);
  }, []);

  const getStatusLabel = (status: string) => {
    if (status === "approved") return ar ? "معتمد" : "Approved";
    if (status === "in_signing") return ar ? "قيد التوقيع" : "In Signing";
    if (status === "rejected") return ar ? "مرفوض" : "Rejected";
    if (status === "cancelled") return ar ? "ملغي" : "Cancelled";
    return status;
  };

  const getPendingRole = (request: any) => {
    if (request.pendingOn) {
      const roleMap: Record<string, Record<string, string>> = {
        housing_manager: { en: "Housing Manager", ar: "مدير السكن" },
        hr_manager: { en: "HR Manager", ar: "مدير الموارد البشرية" },
        accounts_manager: { en: "Accounts Manager", ar: "مدير الحسابات" },
      };
      return roleMap[request.pendingOn]?.[language] ?? request.pendingOn;
    }

    if (
      request.status !== "in_signing" ||
      !Array.isArray(request.approval_steps)
    )
      return null;

    const stepOrder = request.current_step_order ?? request.currentStepOrder;
    const step = request.approval_steps.find(
      (s: any) => s.stepOrder === stepOrder,
    );
    if (!step) return null;

    const roleMap: Record<string, Record<string, string>> = {
      housing_manager: { en: "Housing Manager", ar: "مدير السكن" },
      hr_manager: { en: "HR Manager", ar: "مدير الموارد البشرية" },
      accounts_manager: { en: "Accounts Manager", ar: "مدير الحسابات" },
    };
    return roleMap[step.roleRequired]?.[language] ?? step.roleRequired;
  };

  const formatDateValue = (value: unknown) => {
    if (!value) return "—";

    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString(ar ? "ar-EG" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getTabLabel = (tab: string) => {
    const label = statusLabels[tab]?.[language] ?? statusLabels[tab]?.en ?? tab;
    return label;
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {ar ? "طلبات الاستضافة" : "Hosting Requests"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {countsData?.total != null
              ? `${countsData.total} ${ar ? "طلب" : "requests"}`
              : ""}
          </p>
        </div>
        {canCreate("hosting_requests") && (
          <Button
            type="button"
            onClick={() => setLocation("/hosting-requests/create")}
          >
            <Plus className="w-4 h-4 mr-2" />
            {ar ? "طلب استضافة جديد" : "New Hosting Request"}
          </Button>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {STATUS_TABS.map((tab) => {
          const count = countsData?.[tab] ?? countsData?.total;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setStatusFilter(tab);
                setPage(1);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab !== "all" && (
                <span className={`w-2 h-2 rounded-full ${statusColors[tab]}`} />
              )}
              {getTabLabel(tab)}
              {count != null && (
                <span className="text-xs text-muted-foreground">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={
              ar ? "بحث بالاسم أو رقم الطلب" : "Search by name or request ID"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </form>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-12 text-center text-muted-foreground">
              <p className="font-medium text-foreground">
                {ar
                  ? "تعذر تحميل طلبات الاستضافة"
                  : "Unable to load hosting requests"}
              </p>
              <p className="mt-2 text-sm">
                {error instanceof Error
                  ? error.message
                  : ar
                    ? "يرجى المحاولة مرة أخرى"
                    : "Please try again later"}
              </p>
            </div>
          ) : !data?.data?.length ? (
            <div className="p-12 text-center text-muted-foreground">
              {ar ? "لا توجد طلبات" : "No requests found"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      {ar ? "رقم الطلب" : "ID"}
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      {ar ? "الموظف" : "Employee"}
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      {ar ? "القسم" : "Dept"}
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      {ar ? "الحالة" : "Status"}
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      {ar ? "بانتظار" : "Pending On"}
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      {ar ? "التاريخ" : "Date"}
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      {ar ? "إجراءات" : "Actions"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((request: any) => (
                    <tr
                      key={request.id}
                      className="border-b hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 font-medium">
                        {request.request_number}
                      </td>
                      <td className="p-3">{request.employee_name}</td>
                      <td className="p-3 text-muted-foreground">
                        {request.department}
                      </td>
                      <td className="p-3">
                        <StatusBadge
                          label={getStatusLabel(request.status)}
                          variant={
                            statusBadgeVariant[request.status] ?? "muted"
                          }
                        />
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {getPendingRole(request) || "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDateValue(request.created_at)}
                      </td>
                      <td className="p-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setLocation(`/hosting-requests/${request.id}`)
                          }
                        >
                          {ar ? "عرض" : "View"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data?.pagination && (
        <DataPagination
          total={data.pagination.total}
          pageSize={limit}
          currentPage={page}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
