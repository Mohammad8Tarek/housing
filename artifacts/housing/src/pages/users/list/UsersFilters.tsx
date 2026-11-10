// Users list: search, role/status/property filters.
import { ShieldCheck, Shield, Fingerprint, Gauge, LockKeyhole, ClipboardCheck, Sparkles } from "lucide-react";
import type { UsersPageState } from "./useUsersPageState";

export function renderUsersFilters(s: UsersPageState) {
  const { ar, setCurrentPage, statusFilter, setStatusFilter, workflowFilter, setWorkflowFilter, signedFilter, setSignedFilter, customPermsFilter, setCustomPermsFilter, stats } = s;
  return (
<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold">
                <Gauge className="h-4 w-4 text-[#0F2A44]" />
                {ar ? "ملخص التشغيل والصلاحيات" : "Operations & Access Overview"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {ar
                  ? "نظرة سريعة على الحسابات، أدوار الاعتماد، والصلاحيات المخصصة."
                  : "A quick health check for accounts, approval roles, and custom access."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomPermsFilter((prev) => !prev);
                setCurrentPage(1);
              }}
              title={ar ? "تصفية المستخدمين ذوي الصلاحيات المخصصة" : "Filter users with custom permissions"}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                customPermsFilter
                  ? "bg-[#C9A24D] text-white border-[#C9A24D] shadow-sm"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              }`}
            >
              <Sparkles className="w-3 h-3 text-[#C9A24D]" />
              <span>{stats.customPermissionTotal} {ar ? "صلاحية مخصصة" : "custom permissions"}</span>
              {customPermsFilter && <span className="text-[10px]">✕</span>}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {
                id: "active",
                label: ar ? "نشط" : "Active",
                value: stats.active,
                icon: ShieldCheck,
                tone: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-800/40",
                active: statusFilter === "ACTIVE",
                onClick: () => {
                  setStatusFilter((prev) => (prev === "ACTIVE" ? "all" : "ACTIVE"));
                  setCurrentPage(1);
                },
              },
              {
                id: "locked",
                label: ar ? "مقفول" : "Locked",
                value: stats.locked,
                icon: LockKeyhole,
                tone: "text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-800/40",
                active: statusFilter === "LOCKED",
                onClick: () => {
                  setStatusFilter((prev) => (prev === "LOCKED" ? "all" : "LOCKED"));
                  setCurrentPage(1);
                },
              },
              {
                id: "workflow",
                label: ar ? "أدوار اعتماد" : "Approval roles",
                value: stats.workflowUsers,
                icon: ClipboardCheck,
                tone: "text-amber-700 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-800/40",
                active: workflowFilter === "workflow",
                onClick: () => {
                  setWorkflowFilter((prev) => (prev === "workflow" ? "all" : "workflow"));
                  setCurrentPage(1);
                },
              },
              {
                id: "signed",
                label: ar ? "بتوقيع" : "Signed",
                value: stats.signedWorkflowUsers,
                icon: Fingerprint,
                tone: "text-sky-700 bg-sky-50 border-sky-100 dark:bg-sky-950/20 dark:border-sky-800/40",
                active: signedFilter === "signed",
                onClick: () => {
                  setSignedFilter((prev) => (prev === "signed" ? "all" : "signed"));
                  setCurrentPage(1);
                },
              },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`rounded-lg border p-3 text-start transition-all cursor-pointer hover:shadow-sm ${item.tone} ${
                  item.active ? "ring-2 ring-offset-2 ring-[#0F2A44] dark:ring-[#C9A24D] shadow-md scale-[1.02]" : "opacity-90 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{item.label}</span>
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="mt-2 text-2xl font-bold flex items-baseline justify-between">
                  <span>{item.value}</span>
                  {item.active && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                      {ar ? "مفعل" : "Filtered"}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-5">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Shield className="h-4 w-4 text-[#C9A24D]" />
            {ar ? "تقسيمة الصلاحيات" : "Permission Groups"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ar
              ? "تنظيم وتصنيف الصلاحيات وفقاً لدورات العمل الفندقية والتشغيلية المعتمدة."
              : "Permissions are grouped by hotel workflows, not technical screens."}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              ar ? "التشغيل اليومي" : "Daily operations",
              ar ? "مسار التسكين" : "Accommodation flow",
              ar ? "بوابة الموظف" : "Employee portal",
              ar ? "الإدارة" : "Management",
              ar ? "الأمان والتدقيق" : "Security & audit",
            ].map((label) => (
              <div key={label} className="rounded-lg border bg-muted/20 px-3 py-2 text-sm font-medium">
                {label}
              </div>
            ))}
          </div>
        </section>
      </div>
  );
}
