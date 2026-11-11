// Policies > Rules & curfew tab.
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";
import { TabsContent } from "@/components/ui/tabs";
import { Clock } from "lucide-react";
import type { PoliciesSectionState } from "./usePoliciesSectionState";

export function renderRulesTab(s: PoliciesSectionState) {
  const { form, ar } = s;
  return (
    <TabsContent value="rules" className="space-y-4 focus-visible:outline-none">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-amber-500" />
            {ar
              ? "3. قواعد السكن ومواعيد الإغلاق (Housing Rules & Curfew)"
              : "3. Housing Rules & Curfew"}
          </CardTitle>
          <CardDescription>
            {ar
              ? "تنظيم مواعيد الدخول والخروج ولائحة السلوك والتعليمات العامة"
              : "Regulate curfew times, code of conduct, and resident house rules"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="curfewEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card">
                  <div className="space-y-0.5 pe-4">
                    <FormLabel className="text-xs font-bold">
                      {ar
                        ? "تفعيل موعد إغلاق بوابات السكن (Curfew)"
                        : "Enable Housing Curfew"}
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      {ar
                        ? "تسجيل تنبيه عند دخول الموظفين بعد الموعد المحدد"
                        : "Trigger alerts for residents arriving after curfew"}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="curfewTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">
                    {ar ? "ساعة الإغلاق المسائي" : "Curfew Cutoff Time"}
                  </FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    {ar ? "مثال: 23:00 (11 مساءً)" : "e.g., 23:00 (11:00 PM)"}
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="housingRulesText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">
                  {ar
                    ? "لائحة قواعد وسلوكيات السكن (Code of Conduct)"
                    : "Housing Code of Conduct"}
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder={
                      ar
                        ? "اكتب تعليمات الحفاظ على الهدوء، النظافة، السلامة، وممنوعات التدخين..."
                        : "Specify rules regarding quiet hours, cleanliness, safety, smoking bans..."
                    }
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="housingPolicyText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">
                  {ar
                    ? "اللائحة العامة وتعهد النزيل (General Policy & Agreement)"
                    : "General Policy & Agreement"}
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder={
                      ar
                        ? "نص الإقرار الذي يوقع عليه النزيل عند الاستلام والتسكين..."
                        : "Agreement text signed upon check-in..."
                    }
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}
