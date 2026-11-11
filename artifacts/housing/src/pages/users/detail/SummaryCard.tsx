// User detail: identity and status summary card.
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShieldAlert,
  Lock,
  Building2,
  Pen,
  Briefcase,
  Mail,
  Phone,
  Fingerprint,
} from "lucide-react";
import { roleColor } from "../utils";
import type { UserDetailPageState } from "./useUserDetailPageState";

export function renderSummaryCard(s: UserDetailPageState) {
  const {
    ar,
    currentUser,
    user,
    jobTitle,
    primaryRole,
    isActive,
    selectedPropertyIds,
    signaturePreview,
    isLocked,
    lockoutRemainingMinutes,
    primaryRoleObj,
    workflowRoleObj,
  } = s;
  return (
    <Card className="border shadow-sm overflow-hidden bg-gradient-to-br from-card via-card to-muted/20">
      <div className="h-2.5 bg-gradient-to-r from-[#0F2A44] via-[#C9A24D] to-[#0F2A44]" />
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-md transition-transform hover:scale-105 ${
                primaryRole === "super_admin"
                  ? "bg-gradient-to-br from-purple-600 to-indigo-700"
                  : primaryRole === "admin"
                    ? "bg-gradient-to-br from-red-600 to-rose-700"
                    : "bg-gradient-to-br from-[#0F2A44] to-[#1e4e7e]"
              }`}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {user.username}
                </h1>
                {user.username === currentUser?.username && (
                  <Badge
                    variant="outline"
                    className="border-[#C9A24D] text-[#C9A24D] text-xs font-semibold"
                  >
                    {ar ? "حسابك الحالي" : "You"}
                  </Badge>
                )}
                {isLocked ? (
                  <Badge className="bg-rose-500/15 text-rose-700 border-rose-300 dark:border-rose-800 dark:text-rose-400 gap-1 animate-pulse font-bold">
                    <Lock className="w-3 h-3" />
                    {ar
                      ? `مقفول (${lockoutRemainingMinutes} دقيقة متبقية)`
                      : `Locked (${lockoutRemainingMinutes}m left)`}
                  </Badge>
                ) : isActive ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:border-emerald-800 dark:text-emerald-400 gap-1 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {ar ? "نشط" : "Active"}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 font-medium">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    {ar ? "غير نشط" : "Inactive"}
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold ${roleColor(primaryRole)}`}
                >
                  {ar ? primaryRoleObj?.labelAr : primaryRoleObj?.label}
                </span>
                {jobTitle && jobTitle !== "none" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 font-medium">
                    <Briefcase className="w-3 h-3 text-amber-600" />
                    {ar ? workflowRoleObj?.labelAr : workflowRoleObj?.label}
                  </span>
                )}
                {user.email && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                    {user.email}
                  </span>
                )}
                {user.phone && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" />
                    {user.phone}
                  </span>
                )}
                {(user.nationalId || (user as any).national_id) && (
                  <span className="flex items-center gap-1 text-muted-foreground font-mono">
                    <Fingerprint className="w-3.5 h-3.5" />
                    {user.nationalId || (user as any).national_id}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Security Quick Telemetry Cards */}
          <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-center">
            <div className="flex items-center gap-3 p-3 rounded-xl border bg-background/80 min-w-[130px]">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  {ar ? "الفروع المصرحة" : "Properties"}
                </p>
                <p className="text-sm font-bold">
                  {selectedPropertyIds.length || (ar ? "عام" : "Global")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl border bg-background/80 min-w-[130px]">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${signaturePreview ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
              >
                <Pen className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  {ar ? "التوقيع الرقمي" : "Digital Signature"}
                </p>
                <p className="text-sm font-bold text-foreground">
                  {signaturePreview
                    ? ar
                      ? "مفعل ومسجل"
                      : "Registered"
                    : ar
                      ? "غير مسجل"
                      : "Not Set"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl border bg-background/80 min-w-[130px]">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${user.failedLoginAttempts > 0 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}
              >
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  {ar ? "محاولات فاشلة" : "Failed Logins"}
                </p>
                <p className="text-sm font-bold text-foreground">
                  {user.failedLoginAttempts || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
