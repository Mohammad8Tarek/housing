// Add a new job level policy.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { PoliciesSectionState } from "./usePoliciesSectionState";

export function renderAddLevelDialog(s: PoliciesSectionState) {
  const { ar, isAddLevelOpen, setIsAddLevelOpen, newLevelKey, setNewLevelKey, newLevelNameEn, setNewLevelNameEn, newLevelNameAr, setNewLevelNameAr, newLevelCapacities, setNewLevelCapacities, newLevelAllowEntire, setNewLevelAllowEntire, newLevelDescription, setNewLevelDescription, handleAddLevel } = s;
  return (
<Dialog open={isAddLevelOpen} onOpenChange={setIsAddLevelOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-primary">
            <Plus className="w-5 h-5 text-primary" />
            {ar ? "إضافة مستوى وظيفي جديد للسياسات" : "Add New Job Level Policy"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {ar
              ? "تحديد كود المستوى، الاسم، وسعات الأسرة المسموحة للغرفة (يمكن اختيار أكثر من سعة)"
              : "Define level code, title, and customizable allowed bed capacities for accommodation"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">{ar ? "كود / رقم المستوى" : "Level Key / Code"}</Label>
              <Input
                value={newLevelKey}
                onChange={(e) => setNewLevelKey(e.target.value)}
                placeholder={ar ? "مثال: 5 أو VIP" : "e.g. 5 or VIP"}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold">{ar ? "الاسم بالعربية" : "Arabic Label"}</Label>
              <Input
                value={newLevelNameAr}
                onChange={(e) => setNewLevelNameAr(e.target.value)}
                placeholder={ar ? "مثال: المستوى 5 / مشرفين" : "e.g. Supervisors"}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">{ar ? "الاسم بالإنجليزية" : "English Name"}</Label>
            <Input
              value={newLevelNameEn}
              onChange={(e) => setNewLevelNameEn(e.target.value)}
              placeholder="e.g. Level 5 / Supervisors"
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">{ar ? "الوصف أو الملاحظات" : "Description / Notes"}</Label>
            <Input
              value={newLevelDescription}
              onChange={(e) => setNewLevelDescription(e.target.value)}
              placeholder={ar ? "مثال: متاح سكن ثنائي أو ثلاثي" : "e.g. 2 or 3 bed rooms"}
              className="mt-1 text-xs"
            />
          </div>

          {/* Allowed Bed Capacities Multi-Select */}
          <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
            <div className="flex items-center justify-between text-xs">
              <Label className="font-semibold text-foreground">
                {ar ? "سعات الأسرة المسموحة بالغرفة:" : "Allowed Bed Capacities:"}
              </Label>
              <span className="font-bold text-primary">
                {[...newLevelCapacities].sort((a, b) => a - b).join(" ، ")} {ar ? "سرير" : "beds"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {ar
                ? "انقر لتحديد أو إلغاء تحديد السعات المسموح بها لهذا المستوى (مثل 2 و 3)"
                : "Click to toggle allowed capacities (e.g. 2 and 3 beds)"}
            </p>
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((bed) => {
                const isSelected = newLevelCapacities.includes(bed);
                return (
                  <button
                    key={bed}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        if (newLevelCapacities.length <= 1) {
                          toast.error(ar ? "يجب اختيار سعة واحدة على الأقل" : "Select at least one capacity");
                          return;
                        }
                        setNewLevelCapacities(newLevelCapacities.filter((c) => c !== bed));
                      } else {
                        setNewLevelCapacities([...newLevelCapacities, bed].sort((a, b) => a - b));
                      }
                    }}
                    className={`text-xs font-bold py-1.5 px-2 rounded-lg border transition-all flex items-center justify-center gap-1 ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-2xs scale-[1.02]"
                        : "bg-background text-muted-foreground hover:bg-muted border-muted/50 hover:text-foreground"
                    }`}
                  >
                    {isSelected ? "✓" : ""} {bed} {ar ? "سرير" : "beds"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allow Entire Room Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="space-y-0.5 pe-4">
              <Label className="text-xs font-bold block">
                {ar ? "السماح بحجز غرفة كاملة (فردي)" : "Allow Full Room Booking (Single)"}
              </Label>
              <span className="text-[11px] text-muted-foreground block">
                {ar
                  ? "السماح للموظف بحجز غرفة بمفرده حتى لو كانت متعددة الأسرة"
                  : "Allow booking an entire room exclusively for this level"}
              </span>
            </div>
            <Switch
              checked={newLevelAllowEntire}
              onCheckedChange={setNewLevelAllowEntire}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddLevelOpen(false)}
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleAddLevel}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {ar ? "إضافة المستوى" : "Add Level"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
