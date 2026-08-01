//@ts-nocheck
// @ts-nocheck
import { useState } from "react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import PortalDocuments from "@/components/PortalDocuments";
import PortalAnalyticsDashboard from "@/components/PortalAnalyticsDashboard";

import PortalReports from "@/components/PortalReports";
import PortalCategoriesAndTags from "@/components/PortalCategoriesAndTags";
import PortalFoodTransport from "@/components/PortalFoodTransport";
import PortalChat from "@/components/PortalChat";
import {
  Star,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  Trophy,
  MessageSquare,
  Globe,
  Mail,
  Phone,
  BarChart3,
  Bell,
  Users,
  Shield,
  RefreshCw,
  CheckCircle,
  XCircle,
  Palette,
  UtensilsCrossed,
  MessageCircle,
} from "lucide-react";

export function PortalAccountsSection() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["portal-accounts", activePropertyId],
    queryFn: async () => {
      const r = await fetch(
        `/api/portal-auth/accounts?propertyId=${activePropertyId}`,
      );
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.accounts ?? []);
    },
    enabled: !!activePropertyId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      employeeId,
      isActive,
    }: {
      employeeId: string;
      isActive: boolean;
    }) => {
      const r = await fetch("/api/portal-auth/toggle-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
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
            ? "تم تفعيل البوابة"
            : "Portal access enabled"
          : ar
            ? "تم تعطيل البوابة"
            : "Portal access disabled",
      );
      queryClient.invalidateQueries({
        queryKey: ["portal-accounts", activePropertyId],
      });
    },
    onError: () => toast.error(ar ? "حدث خطأ" : "Error occurred"),
  });

  const resetMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const r = await fetch("/api/portal-auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, propertyId: activePropertyId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(
        ar
          ? `تم إعادة تعيين كلمة المرور المؤقتة: ${data.temporaryPassword}`
          : `Temp password: ${data.temporaryPassword}`,
      );
    },
    onError: () => toast.error(ar ? "حدث خطأ" : "Error occurred"),
  });

  const filtered = (accounts || []).filter(
    (a: any) =>
      !search ||
      a.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
      a.employeeId?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            {ar ? "إدارة حسابات البوابة" : "Portal Account Management"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {ar
              ? "تفعيل وتعطيل صلاحية الموظفين للدخول إلى البوابة وإعادة تعيين كلمات المرور"
              : "Enable/disable employee portal access and reset passwords"}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant="outline" className="text-xs">
            {ar
              ? `${(accounts || []).filter((a: any) => a.isActive).length} مفعل`
              : `${(accounts || []).filter((a: any) => a.isActive).length} active`}
          </Badge>
        </div>
      </div>

      <Input
        placeholder={
          ar ? "بحث باسم أو رقم الموظف..." : "Search by name or employee ID..."
        }
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>{ar ? "الموظف" : "Employee"}</TableHead>
                <TableHead>{ar ? "رقم الموظف" : "Employee ID"}</TableHead>
                <TableHead>{ar ? "آخر دخول" : "Last Login"}</TableHead>
                <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
                <TableHead className="text-center">
                  {ar ? "الإجراءات" : "Actions"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((acc: any) => (
                <TableRow key={acc.employeeId}>
                  <TableCell className="font-medium text-sm">
                    {acc.employeeName ?? acc.employeeId}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {acc.employeeId}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {acc.lastLoginAt
                      ? new Date(acc.lastLoginAt).toLocaleDateString(
                          ar ? "ar-EG" : "en-GB",
                        )
                      : ar
                        ? "لم يدخل بعد"
                        : "Never"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {acc.isActive ? (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] w-fit">
                          <CheckCircle className="w-3 h-3 me-1" />
                          {ar ? "بوابة مفعلة" : "Portal active"}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-muted-foreground w-fit"
                        >
                          <XCircle className="w-3 h-3 me-1" />
                          {acc.hasAccount
                            ? ar
                              ? "بوابة معطلة"
                              : "Portal disabled"
                            : ar
                              ? "بدون حساب"
                              : "No account"}
                        </Badge>
                      )}
                      {acc.employeeStatus && (
                        <span className="text-[10px] text-muted-foreground">
                          {acc.employeeStatus}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant={acc.isActive ? "outline" : "default"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          toggleMutation.mutate({
                            employeeId: acc.employeeId,
                            isActive: !acc.isActive,
                          })
                        }
                        disabled={toggleMutation.isPending}
                      >
                        {acc.isActive
                          ? ar
                            ? "تعطيل"
                            : "Disable"
                          : ar
                            ? "تفعيل"
                            : "Enable"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => resetMutation.mutate(acc.employeeId)}
                        disabled={resetMutation.isPending}
                      >
                        <RefreshCw className="w-3 h-3 me-1" />
                        {ar ? "إعادة كلمة المرور" : "Reset Password"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-muted-foreground"
                  >
                    {ar
                      ? "لا توجد حسابات بوابة مسجلة"
                      : "No portal accounts found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
