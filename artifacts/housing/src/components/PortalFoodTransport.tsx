// @ts-nocheck
import { useState } from "react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
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
import { Badge } from "@/components/ui/badge";
import { UtensilsCrossed, Bus, Plus, Trash2, Edit } from "lucide-react";

export default function PortalFoodTransport() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  const { data: menuData, isLoading: menuLoading } = useQuery({
    queryKey: ["portal-food-menu", activePropertyId],
    queryFn: async () => {
      const r = await fetch(
        `/api/portal-food/admin/menu?propertyId=${activePropertyId}`,
      );
      const d = await r.json();
      return d.items ?? [];
    },
    enabled: !!activePropertyId,
  });

  const { data: scheduleData, isLoading: schedLoading } = useQuery({
    queryKey: ["portal-transport-schedules", activePropertyId],
    queryFn: async () => {
      const r = await fetch(
        `/api/portal-food/admin/schedules?propertyId=${activePropertyId}`,
      );
      const d = await r.json();
      return d.schedules ?? [];
    },
    enabled: !!activePropertyId,
  });

  const items = menuData ?? [];
  const schedules = scheduleData ?? [];

  return (
    <Tabs defaultValue="food" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="food" className="gap-2">
          <UtensilsCrossed className="w-4 h-4" /> {ar ? "الطعام" : "Food"}
        </TabsTrigger>
        <TabsTrigger value="transport" className="gap-2">
          <Bus className="w-4 h-4" /> {ar ? "المواصلات" : "Transport"}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="food">
        <FoodMenuSection
          propertyId={activePropertyId}
          items={items}
          loading={menuLoading}
          queryClient={queryClient}
        />
      </TabsContent>

      <TabsContent value="transport">
        <TransportSection
          propertyId={activePropertyId}
          schedules={schedules}
          loading={schedLoading}
          queryClient={queryClient}
        />
      </TabsContent>
    </Tabs>
  );
}

function FoodMenuSection({ propertyId, items, loading, queryClient }) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [isOpen, setIsOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const emptyForm = {
    name: "",
    nameAr: "",
    description: "",
    descriptionAr: "",
    price: "0",
    mealType: "daily",
    category: "main",
    date: "",
    available: true,
  };
  const [form, setForm] = useState(emptyForm);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const isEdit = !!data.id;
      const url = isEdit
        ? `/api/portal-food/admin/menu/${data.id}`
        : "/api/portal-food/admin/menu";
      const method = isEdit ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, propertyId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(ar ? "تم الحفظ" : "Saved");
      queryClient.invalidateQueries({
        queryKey: ["portal-food-menu", propertyId],
      });
      setIsOpen(false);
      setEditItem(null);
      setForm(emptyForm);
    },
    onError: () => toast.error("Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await fetch(
        `/api/portal-food/admin/menu/${id}?propertyId=${propertyId}`,
        { method: "DELETE" },
      );
    },
    onSuccess: () => {
      toast.success(ar ? "تم الحذف" : "Deleted");
      queryClient.invalidateQueries({
        queryKey: ["portal-food-menu", propertyId],
      });
    },
  });

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name,
      nameAr: item.nameAr || "",
      description: item.description || "",
      descriptionAr: item.descriptionAr || "",
      price: item.price || "0",
      mealType: item.mealType || "daily",
      category: item.category || "main",
      date: item.date || "",
      available: item.available,
    });
    setIsOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">
          {ar ? "قائمة الطعام" : "Food Menu"}
        </h3>
        <Button
          onClick={() => {
            setEditItem(null);
            setForm(emptyForm);
            setIsOpen(true);
          }}
          size="sm"
        >
          <Plus className="w-4 h-4 me-1" />
          {ar ? "إضافة" : "Add"}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{ar ? "الاسم" : "Name"}</TableHead>
            <TableHead>{ar ? "النوع" : "Type"}</TableHead>
            <TableHead>{ar ? "التصنيف" : "Category"}</TableHead>
            <TableHead>{ar ? "السعر" : "Price"}</TableHead>
            <TableHead>{ar ? "التاريخ" : "Date"}</TableHead>
            <TableHead>{ar ? "نشط" : "Active"}</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground py-8"
              >
                {ar ? "جاري التحميل..." : "Loading..."}
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground py-8"
              >
                {ar ? "لا توجد عناصر" : "No items yet"}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {ar && item.nameAr ? item.nameAr : item.name}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{item.mealType}</Badge>
                </TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell>{item.price}</TableCell>
                <TableCell>{item.date || "—"}</TableCell>
                <TableCell>
                  {item.available ? (
                    <Badge className="bg-green-500">Yes</Badge>
                  ) : (
                    <Badge variant="outline">No</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(item)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(item.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          srTitle={ar ? "عنصر قائمة" : "Menu Item"}
        >
          <DialogHeader>
            <DialogTitle>
              {editItem ? (ar ? "تعديل" : "Edit") : ar ? "إضافة" : "Add"}{" "}
              {ar ? "عنصر" : "Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{ar ? "الاسم (إنج)" : "Name (EN)"}</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>{ar ? "الاسم (عربي)" : "Name (AR)"}</Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nameAr: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{ar ? "النوع" : "Meal Type"}</Label>
                <Select
                  value={form.mealType}
                  onValueChange={(v) => setForm((f) => ({ ...f, mealType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">
                      {ar ? "يومي" : "Daily"}
                    </SelectItem>
                    <SelectItem value="weekly">
                      {ar ? "أسبوعي" : "Weekly"}
                    </SelectItem>
                    <SelectItem value="special">
                      {ar ? "خاص" : "Special"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{ar ? "التصنيف" : "Category"}</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">
                      {ar ? "رئيسي" : "Main"}
                    </SelectItem>
                    <SelectItem value="side">
                      {ar ? "جانبي" : "Side"}
                    </SelectItem>
                    <SelectItem value="drink">
                      {ar ? "مشروب" : "Drink"}
                    </SelectItem>
                    <SelectItem value="dessert">
                      {ar ? "حلوى" : "Dessert"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{ar ? "السعر" : "Price"}</Label>
                <Input
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>{ar ? "التاريخ" : "Date"}</Label>
                <DateInput
                  value={form.date}
                  onChange={(iso) =>
                    setForm((f) => ({ ...f, date: iso }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{ar ? "الوصف (إنج)" : "Desc (EN)"}</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>{ar ? "الوصف (عربي)" : "Desc (AR)"}</Label>
                <Input
                  value={form.descriptionAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, descriptionAr: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              onClick={() =>
                saveMutation.mutate(
                  editItem ? { ...form, id: editItem.id } : form,
                )
              }
              className="w-full"
            >
              {editItem ? (ar ? "تحديث" : "Update") : ar ? "إضافة" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransportSection({ propertyId, schedules, loading, queryClient }) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [isOpen, setIsOpen] = useState(false);
  const [editSched, setEditSched] = useState(null);
  const emptyForm = {
    route: "",
    routeAr: "",
    location: "",
    locationAr: "",
    departure: "",
    arrival: "",
    days: "daily",
    customDays: "",
    capacity: 20,
    notes: "",
    notesAr: "",
    active: true,
  };
  const [form, setForm] = useState(emptyForm);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const isEdit = !!data.id;
      const url = isEdit
        ? `/api/portal-food/admin/schedules/${data.id}`
        : "/api/portal-food/admin/schedules";
      const method = isEdit ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, propertyId }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(ar ? "تم الحفظ" : "Saved");
      queryClient.invalidateQueries({
        queryKey: ["portal-transport-schedules", propertyId],
      });
      setIsOpen(false);
      setEditSched(null);
      setForm(emptyForm);
    },
    onError: () => toast.error("Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await fetch(
        `/api/portal-food/admin/schedules/${id}?propertyId=${propertyId}`,
        { method: "DELETE" },
      );
    },
    onSuccess: () => {
      toast.success(ar ? "تم الحذف" : "Deleted");
      queryClient.invalidateQueries({
        queryKey: ["portal-transport-schedules", propertyId],
      });
    },
  });

  const openEdit = (s) => {
    setEditSched(s);
    setForm({
      route: s.route,
      routeAr: s.routeAr || "",
      location: s.location || "",
      locationAr: s.locationAr || "",
      departure: s.departure,
      arrival: s.arrival || "",
      days: s.days || "daily",
      customDays: s.customDays || "",
      capacity: s.capacity || 20,
      notes: s.notes || "",
      notesAr: s.notesAr || "",
      active: s.active,
    });
    setIsOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">
          {ar ? "مواعيد المواصلات" : "Transport Schedules"}
        </h3>
        <Button
          onClick={() => {
            setEditSched(null);
            setForm(emptyForm);
            setIsOpen(true);
          }}
          size="sm"
        >
          <Plus className="w-4 h-4 me-1" />
          {ar ? "إضافة" : "Add"}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{ar ? "الخط" : "Route"}</TableHead>
            <TableHead>{ar ? "الموقع" : "Location"}</TableHead>
            <TableHead>{ar ? "الانطلاق" : "Departure"}</TableHead>
            <TableHead>{ar ? "الوصول" : "Arrival"}</TableHead>
            <TableHead>{ar ? "الأيام" : "Days"}</TableHead>
            <TableHead>{ar ? "السعة" : "Capacity"}</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground py-8"
              >
                {ar ? "جاري التحميل..." : "Loading..."}
              </TableCell>
            </TableRow>
          ) : schedules.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground py-8"
              >
                {ar ? "لا توجد مواعيد" : "No schedules yet"}
              </TableCell>
            </TableRow>
          ) : (
            schedules.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  {ar && s.routeAr ? s.routeAr : s.route}
                </TableCell>
                <TableCell>
                  {ar && s.locationAr ? s.locationAr : s.location || "—"}
                </TableCell>
                <TableCell>{s.departure}</TableCell>
                <TableCell>{s.arrival || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{s.days}</Badge>
                </TableCell>
                <TableCell>{s.capacity}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(s)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(s.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="max-w-xl max-h-[90vh] overflow-y-auto"
          srTitle={ar ? "موعد مواصلات" : "Transport Schedule"}
        >
          <DialogHeader>
            <DialogTitle>
              {editSched ? (ar ? "تعديل" : "Edit") : ar ? "إضافة" : "Add"}{" "}
              {ar ? "موعد" : "Schedule"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{ar ? "الخط (إنج)" : "Route (EN)"}</Label>
                <Input
                  value={form.route}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, route: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>{ar ? "الخط (عربي)" : "Route (AR)"}</Label>
                <Input
                  value={form.routeAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, routeAr: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{ar ? "الموقع (إنج)" : "Location (EN)"}</Label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>{ar ? "الموقع (عربي)" : "Location (AR)"}</Label>
                <Input
                  value={form.locationAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, locationAr: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>{ar ? "الانطلاق" : "Departure"}</Label>
                <Input
                  value={form.departure}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, departure: e.target.value }))
                  }
                  placeholder="06:00"
                />
              </div>
              <div>
                <Label>{ar ? "الوصول" : "Arrival"}</Label>
                <Input
                  value={form.arrival}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, arrival: e.target.value }))
                  }
                  placeholder="06:45"
                />
              </div>
              <div>
                <Label>{ar ? "السعة" : "Capacity"}</Label>
                <Input
                  type="number"
                  value={form.capacity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, capacity: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{ar ? "الأيام" : "Days"}</Label>
                <Select
                  value={form.days}
                  onValueChange={(v) => setForm((f) => ({ ...f, days: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">
                      {ar ? "يومياً" : "Daily"}
                    </SelectItem>
                    <SelectItem value="weekdays">
                      {ar ? "أيام العمل" : "Weekdays"}
                    </SelectItem>
                    <SelectItem value="weekends">
                      {ar ? "نهاية الأسبوع" : "Weekends"}
                    </SelectItem>
                    <SelectItem value="custom">
                      {ar ? "مخصص" : "Custom"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.days === "custom" && (
                <div>
                  <Label>{ar ? "أيام" : "Custom Days"}</Label>
                  <Input
                    value={form.customDays}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, customDays: e.target.value }))
                    }
                    placeholder="mon,tue,wed"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{ar ? "ملاحظات (إنج)" : "Notes (EN)"}</Label>
                <Input
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>{ar ? "ملاحظات (عربي)" : "Notes (AR)"}</Label>
                <Input
                  value={form.notesAr}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notesAr: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              onClick={() =>
                saveMutation.mutate(
                  editSched ? { ...form, id: editSched.id } : form,
                )
              }
              className="w-full"
            >
              {editSched ? (ar ? "تحديث" : "Update") : ar ? "إضافة" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
