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

export function PortalContactsSection() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editContact, setEditContact] = useState<any>(null);
  const emptyForm = {
    nameAr: "",
    nameEn: "",
    roleAr: "",
    roleEn: "",
    phone: "",
    email: "",
    extension: "",
  };
  const [form, setForm] = useState(emptyForm);

  const { data: contactsData, isLoading } = useQuery({
    queryKey: ["portal-contacts", activePropertyId],
    queryFn: async () => {
      const r = await fetch(
        `/api/portal-contacts?propertyId=${activePropertyId}`,
      );
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.contacts ?? []);
    },
    enabled: !!activePropertyId,
  });

  const contacts = contactsData ?? [];

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const isEdit = !!data.id;
      const url = isEdit
        ? `/api/portal-contacts/${data.id}`
        : "/api/portal-contacts";
      const method = isEdit ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, propertyId: activePropertyId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(
        ar
          ? editContact
            ? "تم التعديل"
            : "تمت الإضافة"
          : editContact
            ? "Contact updated"
            : "Contact added",
      );
      queryClient.invalidateQueries({
        queryKey: ["portal-contacts", activePropertyId],
      });
      setIsOpen(false);
      setEditContact(null);
      setForm(emptyForm);
    },
    onError: () => toast.error("Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/portal-contacts/${id}?propertyId=${activePropertyId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast.success(ar ? "تم الحذف" : "Contact deleted");
      queryClient.invalidateQueries({
        queryKey: ["portal-contacts", activePropertyId],
      });
    },
  });

  const openAdd = () => {
    setEditContact(null);
    setForm(emptyForm);
    setIsOpen(true);
  };
  const openEdit = (c: any) => {
    setEditContact(c);
    setForm({
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      roleAr: c.roleAr ?? "",
      roleEn: c.roleEn ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      extension: c.extension ?? "",
    });
    setIsOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            {ar ? "جهات اتصال البوابة" : "Portal Contacts"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {ar
              ? "أضف عدة جهات اتصال تظهر للموظفين في البوابة (مشرف سكن، موارد بشرية، إلخ)"
              : "Add multiple contacts visible to profiles (Housing Supervisor, HR, etc.)"}
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" />{" "}
          {ar ? "إضافة جهة اتصال" : "Add Contact"}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : contacts.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl py-16 text-center text-muted-foreground">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {ar ? "لا توجد جهات اتصال حتى الآن" : "No contacts added yet"}
          </p>
          <p className="text-xs mt-1">
            {ar
              ? "اضغط «إضافة جهة اتصال» للبدء"
              : "Click «Add Contact» to get started"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((c: any) => (
            <Card
              key={c.id}
              className="group relative overflow-hidden hover:border-primary/50 transition-colors"
            >
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm">
                      {ar ? c.nameAr : c.nameEn}
                    </div>
                    {(c.roleAr || c.roleEn) && (
                      <Badge variant="secondary" className="text-[10px] mt-1">
                        {ar ? c.roleAr : c.roleEn}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(c)}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(c.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {c.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      {c.phone}
                      {c.extension && (
                        <span className="text-[10px]">({c.extension})</span>
                      )}
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      {c.email}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={isOpen}
        onOpenChange={(o) => {
          setIsOpen(o);
          if (!o) {
            setEditContact(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent
          className="max-w-lg"
          srTitle={
            ar
              ? editContact
                ? "تعديل جهة اتصال"
                : "إضافة جهة اتصال"
              : editContact
                ? "Edit Contact"
                : "Add Contact"
          }
        >
          <DialogHeader>
            <DialogTitle>
              {ar
                ? editContact
                  ? "تعديل جهة اتصال"
                  : "إضافة جهة اتصال"
                : editContact
                  ? "Edit Contact"
                  : "Add Contact"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{ar ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nameAr: e.target.value }))
                  }
                  placeholder={ar ? "مثال: محمد أحمد" : "e.g. Mohamed Ahmed"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nameEn: e.target.value }))
                  }
                  placeholder="e.g. Mohamed Ahmed"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "المسمى الوظيفي (عربي)" : "Role (Arabic)"}</Label>
                <Input
                  value={form.roleAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, roleAr: e.target.value }))
                  }
                  placeholder={ar ? "مثال: مشرف سكن" : "e.g. Housing Supervisor"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {ar ? "المسمى الوظيفي (إنجليزي)" : "Role (English)"}
                </Label>
                <Input
                  value={form.roleEn}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, roleEn: e.target.value }))
                  }
                  placeholder="e.g. Housing Supervisor"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "الهاتف" : "Phone"}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+971 50 123 4567"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  {ar ? "التحويلة (اختياري)" : "Extension (Optional)"}
                </Label>
                <Input
                  value={form.extension}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, extension: e.target.value }))
                  }
                  placeholder="#4055"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>
                  {ar ? "البريد الإلكتروني (اختياري)" : "Email (Optional)"}
                </Label>
                <Input
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="name@company.com"
                  type="email"
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!form.nameAr || !form.nameEn || saveMutation.isPending}
              onClick={() =>
                saveMutation.mutate(
                  editContact ? { ...form, id: editContact.id } : form,
                )
              }
            >
              {saveMutation.isPending
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? editContact
                    ? "تعديل"
                    : "إضافة"
                  : editContact
                    ? "Update"
                    : "Add Contact"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
