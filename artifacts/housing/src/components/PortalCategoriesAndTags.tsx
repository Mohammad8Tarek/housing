import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedConfirmModal } from "@/components/shared/AnimatedConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Palette, Tag, Trash2, Search } from "lucide-react";
import { useState } from "react";

export default function PortalCategoriesAndTags() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const [deleteCatDialog, setDeleteCatDialog] = useState<{
    open: boolean;
    id: number;
    name: string;
  }>({ open: false, id: 0, name: "" });
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: "",
    nameAr: "",
    color: "#0F2A44",
    icon: "folder",
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ["portal-categories", activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-categories?propertyId=${activePropertyId}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  const { data: statuses } = useQuery({
    queryKey: ["portal-activity-statuses", activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-categories/statuses?propertyId=${activePropertyId}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch statuses");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  const { data: tags } = useQuery({
    queryKey: ["portal-tags", activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-categories/tags?propertyId=${activePropertyId}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch tags");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/portal-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, propertyId: activePropertyId }),
      });
      if (!res.ok) throw new Error("Failed to create category");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["portal-categories", activePropertyId],
      });
      toast.success(ar ? "تم إنشاء التصنيف" : "Category created");
      setIsOpen(false);
      setNewCategory({
        name: "",
        nameAr: "",
        color: "#0F2A44",
        icon: "folder",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      const res = await fetch(
        `/api/portal-categories/${categoryId}?propertyId=${activePropertyId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!res.ok) throw new Error("Failed to delete category");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["portal-categories", activePropertyId],
      });
      toast.success(ar ? "تم حذف التصنيف" : "Category deleted");
    },
  });

  const filteredCategories =
    categories?.filter(
      (c: any) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.nameAr.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  if (!activePropertyId) {
    return (
      <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
        {ar
          ? "يرجى اختيار العقار من القائمة أعلاه لعرض التصنيفات والحالات"
          : "Please select a property above to view categories and statuses"}
      </div>
    );
  }

  if (isLoading) return <Skeleton className="h-96 w-full rounded-lg" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="w-6 h-6 text-primary" />
            {ar ? "التصنيفات والوسوم" : "Categories & Tags"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {ar ? "تنظيم محتوى البوابة" : "Organize portal content"}
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> {ar ? "تصنيف جديد" : "New Category"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{ar ? "تصنيف جديد" : "New Category"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{ar ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                <Input
                  value={newCategory.nameAr}
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, nameAr: e.target.value })
                  }
                  placeholder="مثال: اجتماعي"
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                <Input
                  value={newCategory.name}
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, name: e.target.value })
                  }
                  placeholder="e.g. Social"
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "اللون" : "Color"}</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={newCategory.color}
                    onChange={(e) =>
                      setNewCategory({ ...newCategory, color: e.target.value })
                    }
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <Input value={newCategory.color} disabled />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createCategoryMutation.mutate(newCategory)}
                disabled={!newCategory.name || !newCategory.nameAr}
              >
                {ar ? "إنشاء" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories */}
      <div>
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={ar ? "بحث..." : "Search categories..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.length > 0 ? (
            filteredCategories.map((category: any) => (
              <Card
                key={category.id}
                className="group hover:border-primary/50 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: category.color }}
                    >
                      <Palette className="w-5 h-5" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={() =>
                        setDeleteCatDialog({
                          open: true,
                          id: category.id,
                          name: category.name,
                        })
                      }
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <CardTitle className="text-base mt-2">
                    {ar ? category.nameAr : category.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-1 flex-wrap">
                    {category.contentTypes?.map((type: string) => (
                      <Badge key={type} variant="secondary" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-muted-foreground">
              {ar ? "لا توجد تصنيفات" : "No categories found"}
            </div>
          )}
        </div>
      </div>

      {/* Activity statuses */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {ar ? "حالات الفعاليات" : "Activity Statuses"}
          </CardTitle>
          <CardDescription>
            {ar
              ? "تظهر للموظفين على بطاقات الفعاليات في البوابة"
              : "Shown to employees on activity cards in the portal"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {statuses?.map((s: any) => (
              <Badge
                key={s.key}
                variant="secondary"
                className="px-3 py-1 text-sm"
              >
                {ar ? s.nameAr : s.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />{" "}
            {ar ? "الوسوم المتاحة" : "Available Tags"}
          </CardTitle>
          <CardDescription>
            {ar ? "الوسوم المستخدمة في المحتوى" : "Tags used across content"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {tags?.map((tag: any) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="px-3 py-1 text-sm cursor-pointer hover:bg-muted"
                style={{ borderColor: tag.color, color: tag.color }}
              >
                {ar ? tag.nameAr : tag.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <AnimatedConfirmModal
        open={deleteCatDialog.open}
        onOpenChange={(open) =>
          setDeleteCatDialog((prev) => ({ ...prev, open }))
        }
        title={
          ar
            ? `حذف "${deleteCatDialog.name}"؟`
            : `Delete "${deleteCatDialog.name}"?`
        }
        description={
          ar
            ? "هل أنت متأكد من الحذف؟"
            : "Are you sure you want to delete this category?"
        }
        variant="destructive"
        onConfirm={() => deleteCategoryMutation.mutate(deleteCatDialog.id)}
      />
    </div>
  );
}
