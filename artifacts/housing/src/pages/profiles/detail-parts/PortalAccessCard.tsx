// Profile detail: resident portal account status and actions.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Shield } from "lucide-react";
import type {
  ProfileDetailState,
  ProfileDetailView,
} from "./useProfileDetailState";

export function renderPortalAccessCard(
  s: ProfileDetailState,
  v: ProfileDetailView,
) {
  const {
    ar,
    setResetOpen,
    setSetPwOpen,
    pwSaving,
    accessSaving,
    portalAccount,
  } = s;
  const { portalProfileId, togglePortalAccess } = v;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          {ar ? "بوابة المقيمين" : "Resident Portal"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {ar
              ? "يمكن للمسؤولين تعديل صلاحيات البوابة وإدارة كلمة مرور الموظف من هنا."
              : "Admins can edit portal access and manage the profile password from here."}
          </div>
          <Badge
            variant={portalAccount?.isActive ? "default" : "secondary"}
            className="self-start"
          >
            {portalAccount
              ? portalAccount.isActive
                ? ar
                  ? "نشط"
                  : "Active"
                : ar
                  ? "معطل"
                  : "Disabled"
              : ar
                ? "لم يتم تحميل الحساب"
                : "Account loading"}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">
              {ar ? "صلاحية الدخول" : "Portal access"}
            </p>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "تفعيل أو تعطيل دخول هذا الموظف للبوابة."
                : "Enable or disable this profile's portal login."}
            </p>
          </div>
          <Switch
            checked={Boolean(portalAccount?.isActive)}
            disabled={!portalAccount || accessSaving}
            onCheckedChange={togglePortalAccess}
            aria-label={ar ? "تفعيل/تعطيل البوابة" : "Toggle portal access"}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setSetPwOpen(true)}
            disabled={pwSaving}
          >
            {ar ? "تعيين كلمة مرور جديدة" : "Set New Password"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setResetOpen(true)}
            disabled={pwSaving}
          >
            {ar ? "إنشاء كلمة مرور مؤقتة" : "Generate Temporary Password"}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {ar
            ? `معرّ�? الدخول: ${portalProfileId || "—"}`
            : `Login ID: ${portalProfileId || "—"}`}
        </div>
      </CardContent>
    </Card>
  );
}
