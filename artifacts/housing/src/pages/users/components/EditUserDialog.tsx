import { useState } from "react";
import {
  useUpdateUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { UserCog, Upload, Loader2, CheckCircle2, Pen, X } from "lucide-react";
import { SYSTEM_ROLES, WORKFLOW_ROLES } from "../utils";
import { getPermissionsForRoles } from "@/lib/permissions";
import { toast } from "sonner";

interface EditUserDialogProps {
  user: any;
  onClose: () => void;
}

function useUserSignature(userId: number) {
  return useQuery({
    queryKey: ["user-signature", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/signature`);
      if (!res.ok) throw new Error("Failed to fetch signature");
      return res.json() as Promise<{
        signatureImageUrl: string | null;
        uploadedAt: string | null;
      }>;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function EditUserDialog({ user, onClose }: EditUserDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const { user: currentUser, isSystemAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    status: user.status || "ACTIVE",
    role: user.roles?.[0] || "manager",
    jobTitle: user.jobTitle || "none",
  });

  const {
    data: sigData,
    isLoading: sigLoading,
    refetch: refetchSig,
  } = useUserSignature(user.id);

  const isSelf = currentUser?.id === user.id;
  const canUploadSignature = isSystemAdmin || isSelf;
  const [isUploadingSig, setIsUploadingSig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSigPreview, setShowSigPreview] = useState(false);

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success(
          ar ? "تم تحديث البيانات بنجاح" : "User data updated successfully",
        );
        onClose();
      },
      onError: (e: any) =>
        toast.error(
          e.message ||
            (ar ? "فشل تحديث البيانات" : "Failed to update user data"),
        ),
    },
  });

  const handleSignatureUpload = async (file: File) => {
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error(
        ar ? "يرجى رفع صورة PNG أو JPEG" : "Please upload a PNG or JPEG image",
      );
      return;
    }
    setIsUploadingSig(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const endpoint = isSelf
        ? "/api/users/me/signature"
        : `/api/users/${user.id}/signature`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureImage: base64 }),
      });
      if (!res.ok) throw new Error("Upload failed");
      toast.success(
        ar ? "تم حفظ التوقيع بنجاح" : "Signature saved successfully",
      );
      refetchSig();
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch (err: any) {
      toast.error(ar ? "فشل الرفع" : "Upload failed");
    } finally {
      setIsUploadingSig(false);
    }
  };

  const save = async () => {
    if (!formData.username.trim()) {
      toast.error(ar ? "الاسم مطلوب" : "Username is required");
      return;
    }

    setSaving(true);
    try {
      const resolvedRoles = [formData.role].filter(Boolean);
      await updateMutation.mutateAsync({
        id: user.id,
        data: {
          username: formData.username,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          status: formData.status,
          roles: resolvedRoles,
          jobTitle: formData.jobTitle === "none" ? null : formData.jobTitle,
          permissions: getPermissionsForRoles(resolvedRoles),
        } as any,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-sm"
        srTitle={ar ? "تعديل بيانات المستخدم" : "Edit User Data"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-blue-600" />
            {ar ? "تعديل بيانات المستخدم" : "Edit User Data"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-medium">
              {ar ? "اسم المستخدم" : "Username"}
            </Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              placeholder={ar ? "أدخل اسم المستخدم" : "Enter username"}
              className="font-mono"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              {ar ? "البريد الإلكتروني" : "Email"}
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder={ar ? "مثال@gmail.com" : "example@gmail.com"}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              {ar ? "الهاتف" : "Phone"}
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder={ar ? "+966 50 0000000" : "+1 (555) 000-0000"}
            />
          </div>

          {/* Role / Position */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {ar ? "صلاحية النظام" : "System Role"}
            </Label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                setFormData({ ...formData, role: value })
              }
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
          </div>

          {/* Workflow Role */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {ar ? "منصب الاعتماد (Workflow Role)" : "Workflow Role (Manager)"}
            </Label>
            <Select
              value={formData.jobTitle}
              onValueChange={(value) =>
                setFormData({ ...formData, jobTitle: value })
              }
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

          {/* Signature */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {ar ? "توقيع المستخدم" : "User Signature"}
            </Label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4">
                {sigLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : sigData?.signatureImageUrl ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSigPreview(!showSigPreview)}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Pen className="w-3 h-3" />
                      {ar ? "عرض التوقيع" : "View Signature"}
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingSig || !canUploadSignature}
                      onClick={() =>
                        document.getElementById("sig-upload")?.click()
                      }
                    >
                      {isUploadingSig ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {ar ? "استبدال" : "Replace"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploadingSig || !canUploadSignature}
                    onClick={() =>
                      document.getElementById("sig-upload")?.click()
                    }
                  >
                    {isUploadingSig ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {ar ? "رفع صورة التوقيع" : "Upload Signature"}
                  </Button>
                )}
                <input
                  id="sig-upload"
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSignatureUpload(file);
                  }}
                />
                {sigData?.signatureImageUrl && !sigLoading && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {ar ? "متوفر" : "Available"}
                  </span>
                )}
              </div>
              {showSigPreview && sigData?.signatureImageUrl && (
                <div className="relative inline-block border rounded-lg p-2 bg-muted/20">
                  <button
                    type="button"
                    onClick={() => setShowSigPreview(false)}
                    className="absolute top-1 right-1 rtl:left-1 rtl:right-auto bg-background rounded-full p-0.5 shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <img
                    src={sigData.signatureImageUrl}
                    alt="Signature"
                    className="max-h-24 object-contain"
                  />
                </div>
              )}
              {!canUploadSignature && (
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? "فقط المدير العام يمكنه رفع توقيع لمستخدم آخر"
                    : "Only system admins can upload signatures for other users."}
                </p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-medium">
              {ar ? "الحالة" : "Status"}
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    {ar ? "نشط" : "Active"}
                  </div>
                </SelectItem>
                <SelectItem value="INACTIVE">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    {ar ? "غير نشط" : "Inactive"}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="outline" onClick={onClose}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={save}
              disabled={saving || updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <UserCog className="w-4 h-4" />
              {updateMutation.isPending
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? "حفظ التغييرات"
                  : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
