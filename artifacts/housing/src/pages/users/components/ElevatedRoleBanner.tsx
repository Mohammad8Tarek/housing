// Shown when a user's role already grants access, so editing their stored
// permission matrix does not restrict them (mirrors the API behavior).
import { ShieldAlert } from "lucide-react";
import { isElevatedRole, elevatedScope } from "@/lib/permissions";

export function ElevatedRoleBanner({
  roles,
  ar,
}: {
  roles: Array<string | null | undefined> | null | undefined;
  ar: boolean;
}) {
  if (!isElevatedRole(roles)) return null;
  const full = elevatedScope(roles) === "full";
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
      <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="text-sm">
        <h3 className="font-bold text-amber-800 dark:text-amber-300">
          {ar
            ? "دور كامل الصلاحيات — المصفوفة لا تقيّد هذا المستخدم"
            : "Full-access role — the matrix does not restrict this user"}
        </h3>
        <p className="text-xs text-amber-700/90 dark:text-amber-300/80 mt-1">
          {full
            ? ar
              ? "هذا الدور (مدير عام للنظام) يملك كل الصلاحيات دائماً، وأي قائمة صلاحيات محفوظة عليه يتم تجاهلها. لتقييد الحساب، أعطِه دوراً غير كامل."
              : "This role (system admin) always has every permission; any stored permission list is ignored. To restrict the account, give it a non-elevated role."
            : ar
              ? "دور admin يملك كل الموديولات ما عدا «العقارات»، بغض النظر عن الصلاحيات المحفوظة. لتقييد الحساب، أعطِه دوراً غير admin."
              : "The admin role has every module except Properties, regardless of the stored permissions. To restrict the account, give it a non-admin role."}
        </p>
      </div>
    </div>
  );
}
