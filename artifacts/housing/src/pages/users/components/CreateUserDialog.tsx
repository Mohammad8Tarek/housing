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
import { UserCog, Plus, Mail, Phone, Shield, Building } from "lucide-react";
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
          <Button className="bg-[#0F2A44] hover:bg-[#0F2A44]/90 text-white gap-2 shadow-sm transition-all hover:shadow-md">
            <Plus className="w-4 h-4" />
            {ar ? "إضافة مستخدم" : "Add User"}
          </Button>
        </DialogTrigger>
      </PermissionGate>

      <DialogContent
        className="max-w-2xl p-0 overflow-hidden"
        srTitle={ar ? "إضافة مستخدم جديد" : "Add New User"}
      >
        <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-950 p-6 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <UserCog className="w-5 h-5" />
              </div>
              <div>
                <span className="block">{ar ? "إضافة مستخدم جديد" : "Add New User"}</span>
                <span className="block text-sm font-normal text-muted-foreground mt-1">
                  {ar ? "أدخل بيانات المستخدم وصلاحياته" : "Enter user details and access levels"}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
          {/* Section 1: Profile Details */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-muted/50">
              <UserCog className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {ar ? "بيانات الحساب" : "Account Details"}
              </h3>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {ar ? "اسم المستخدم" : "Username"} <span className="text-destructive">*</span>
              </Label>
              <Input
                className="bg-muted/30 focus-visible:ring-primary/20"
                placeholder="e.g. john.doe"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                autoComplete="off"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                {ar ? "البريد الإلكتروني" : "Email"}
              </Label>
              <Input
                className="bg-muted/30 focus-visible:ring-primary/20"
                type="email"
                placeholder="e.g. john@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                {ar ? "الهاتف" : "Phone"}
              </Label>
              <Input
                className="bg-muted/30 focus-visible:ring-primary/20"
                type="tel"
                placeholder="e.g. +1 (555) 123-4567"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                autoComplete="tel"
              />
            </div>
          </div>

          {/* Section 2: Security & Roles */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-muted/50">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {ar ? "الأمان والصلاحيات" : "Security & Access"}
              </h3>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {ar ? "كلمة المرور" : "Password"} <span className="text-destructive">*</span>
              </Label>
              <Input
                className="bg-muted/30 focus-visible:ring-primary/20"
                type="password"
                placeholder={ar ? "الحد الأدنى 6 أحرف" : "Minimum 6 characters"}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{ar ? "دور النظام" : "System Role"}</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger className="bg-muted/30 focus:ring-primary/20">
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
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {ar ? "منصب الاعتماد" : "Workflow Role"}
              </Label>
              <Select value={form.jobTitle} onValueChange={(v) => setForm((f) => ({ ...f, jobTitle: v }))}>
                <SelectTrigger className="bg-muted/30 focus:ring-primary/20">
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
            
            {/* Property assignment */}
            {isSuperAdmin && form.role !== "super_admin" && (
              <div className="space-y-2 pt-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-muted-foreground" />
                  {ar ? "تعيين في الفروع" : "Assign to Properties"} <span className="text-destructive">*</span>
                </Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto bg-muted/10">
                  {properties?.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 cursor-pointer hover:bg-muted/40 px-2 py-1.5 rounded-md transition-colors"
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
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                      />
                      <span className="flex-1 text-sm">{p.name}</span>
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        {p.code}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {isSuperAdmin && form.role === "super_admin" && (
              <div className="mt-4 rounded-lg bg-primary/5 border border-primary/10 p-3 text-sm text-primary">
                {ar
                  ? "المدير العام له صلاحية الوصول لجميع الفروع افتراضياً."
                  : "Super Admin has access to all properties by default."}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-muted/20 border-t p-4 flex items-center justify-between px-6">
          <div className="text-xs text-muted-foreground">
            {ar ? "سيتم تطبيق صلاحيات الدور الافتراضية." : "Default role permissions will be applied."}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={onSubmit} 
              disabled={createMutation.isPending}
              className="bg-[#0F2A44] hover:bg-[#0F2A44]/90 text-white shadow-sm"
            >
              {createMutation.isPending
                ? (ar ? "جاري الإنشاء..." : "Creating...")
                : (ar ? "إنشاء المستخدم" : "Create User")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
