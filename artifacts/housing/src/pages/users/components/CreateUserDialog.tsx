import { useState } from "react";
import {
  useCreateUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { useProperty } from "@/context/PropertyContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCog, Plus } from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import { getPermissionsForRoles } from "@/lib/permissions";
import { SYSTEM_ROLES, WORKFLOW_ROLES } from "../utils";

interface CreateUserDialogProps {
  properties: any[];
}

export function CreateUserDialog({ properties }: CreateUserDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const { activePropertyId, isSuperAdmin } = useProperty();

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    role: "manager",
    jobTitle: "none",
    propertyId: activePropertyId ?? 0,
    propertyIds: activePropertyId ? [activePropertyId] : ([] as number[]),
  });
  const resetForm = () => {
    setForm({
      username: "",
      email: "",
      phone: "",
      password: "",
      role: "manager",
      jobTitle: "none",
      propertyId: activePropertyId ?? 0,
      propertyIds: activePropertyId ? [activePropertyId] : [],
    });
  };

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success(
          ar ? "تم إنشاء المستخدم بنجاح" : "User created successfully",
        );
        setIsOpen(false);
        resetForm();
      },
      onError: (e: any) =>
        toast.error(
          e.message || (ar ? "خطأ في إنشاء المستخدم" : "Error creating user"),
        ),
    },
  });

  const onSubmit = () => {
    if (!form.username || !form.password) {
      toast.error(
        ar
          ? "الرجاء ملء جميع الحقول المطلوبة"
          : "Please fill all required fields",
      );
      return;
    }
    const needsProperty = form.role !== "super_admin";
    const pids =
      form.propertyIds.length > 0
        ? form.propertyIds
        : form.propertyId
          ? [form.propertyId]
          : [];
    const primaryPid = pids[0] || activePropertyId || 1;

    if (needsProperty && !primaryPid) {
      toast.error(
        ar
          ? "الرجاء اختيار فرع واحد على الأقل"
          : "Please select at least one property",
      );
      return;
    }

    const resolvedRoles = [form.role].filter(Boolean);
    const resolvedPermissions = getPermissionsForRoles(resolvedRoles);

    createMutation.mutate({
      data: {
        username: form.username,
        email: form.email || undefined,
        phone: form.phone || undefined,
        password: form.password,
        propertyId: primaryPid,
        propertyIds: pids,
        roles: resolvedRoles,
        jobTitle: form.jobTitle === "none" ? null : form.jobTitle,
        permissions: resolvedPermissions,
        status: "ACTIVE" as any,
      } as any,
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        setIsOpen(v);
        if (!v) resetForm();
      }}
    >
      <PermissionGate module="users" action="create">
        <DialogTrigger asChild>
          <Button className="bg-[#0F2A44] hover:bg-[#0F2A44]/90 text-white gap-2">
            <Plus className="w-4 h-4" />
            {ar ? "إضافة مستخدم" : "Add User"}
          </Button>
        </DialogTrigger>
      </PermissionGate>

      <DialogContent
        className="max-w-md"
        srTitle={ar ? "إضافة مستخدم جديد" : "Add New User"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            {ar ? "إضافة مستخدم جديد" : "Add New User"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>
              {ar ? "اسم المستخدم" : "Username"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="e.g. john.doe"
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{ar ? "البريد الإلكتروني" : "Email"}</Label>
            <Input
              type="email"
              placeholder="e.g. john@example.com"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{ar ? "الهاتف" : "Phone"}</Label>
            <Input
              type="tel"
              placeholder="e.g. +1 (555) 123-4567"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              autoComplete="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              {ar ? "كلمة المرور" : "Password"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              type="password"
              placeholder={ar ? "الحد الأدنى 6 أحرف" : "Minimum 6 characters"}
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{ar ? "الدور" : "Role"}</Label>
            <Select
              value={form.role}
              onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {ar ? r.labelAr : r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "سيتم تطبيق الصلاحيات الافتراضية لهذا الدور تلقائياً. يمكنك تعديلها لاحقاً."
                : "Default permissions for this role will be applied automatically. You can edit them afterwards."}
            </p>
          </div>

          {/* Workflow Role */}
          <div className="space-y-1.5">
            <Label>
              {ar ? "منصب الاعتماد (Workflow Role)" : "Workflow Role (Manager)"}
            </Label>
            <Select
              value={form.jobTitle}
              onValueChange={(v) => setForm((f) => ({ ...f, jobTitle: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKFLOW_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {ar ? r.labelAr : r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Signature hint */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 p-3 text-xs text-blue-700 dark:text-blue-300">
            {ar
              ? "يمكنك رفع توقيع المستخدم بعد إنشائه من خلال تعديل بيانات المستخدم."
              : "You can upload the user's signature after creation via Edit User."}
          </div>

          {/* Property assignment */}
          {isSuperAdmin && form.role !== "super_admin" && (
            <div className="space-y-1.5">
              <Label>
                {ar ? "تعيين في الفروع" : "Assign to Properties"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-44 overflow-y-auto bg-muted/20">
                {properties?.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/30 px-2 py-1.5 rounded-md transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={form.propertyIds.includes(p.id)}
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          propertyIds: e.target.checked
                            ? [...f.propertyIds, p.id]
                            : f.propertyIds.filter((id) => id !== p.id),
                          propertyId:
                            e.target.checked && f.propertyIds.length === 0
                              ? p.id
                              : f.propertyId,
                        }));
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-primary"
                    />
                    <span className="flex-1 text-sm font-medium">{p.name}</span>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {p.code}
                    </span>
                  </label>
                ))}
                {!properties?.length && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {ar ? "لا توجد فروع" : "No properties available"}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.propertyIds.length === 0
                  ? ar
                    ? "اختر فرعاً واحداً على الأقل"
                    : "Select at least one property"
                  : ar
                    ? `تم اختيار ${form.propertyIds.length} فرع`
                    : `${form.propertyIds.length} propert${form.propertyIds.length > 1 ? "ies" : "y"} selected`}
              </p>
            </div>
          )}
          {isSuperAdmin && form.role === "super_admin" && (
            <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
              {ar
                ? "المدير العام له صلاحية الوصول لجميع الفروع افتراضياً."
                : "Super Admin has access to all properties by default."}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={onSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending
                ? ar
                  ? "جاري الإنشاء..."
                  : "Creating..."
                : ar
                  ? "إنشاء المستخدم"
                  : "Create User"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
