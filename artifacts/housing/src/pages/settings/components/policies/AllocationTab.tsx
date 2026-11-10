// Policies > Room & level allocation tab.
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { ShieldAlert, Building, Sparkles, HeartHandshake, Plus, Trash2, Bot, ShieldCheck, RotateCcw } from "lucide-react";
import type { JobLevelPolicy } from "../../hooks/useSettingsForm";
import { DEFAULT_JOB_LEVEL_POLICIES } from "../../hooks/useSettingsForm";
import type { PoliciesSectionState } from "./usePoliciesSectionState";

export function renderAllocationTab(s: PoliciesSectionState) {
  const { form, ar, setIsAddLevelOpen, handleToggleCapacity, handleToggleAllowEntire, handleDeleteLevel, handleResetDefaultLevels } = s;
  return (
<TabsContent value="allocation" className="space-y-4 focus-visible:outline-none">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building className="w-4 h-4 text-primary" />
                  {ar ? "1. سياسة استحقاق السكن والدرجات الوظيفية (Allocation Rules)" : "1. Job Level Entitlements & Department Rules"}
                </CardTitle>
                <CardDescription>
                  {ar
                    ? "تحديد سعة الغرف المسموحة لكل درجة وظيفية (تخصيص أعداد الأسرة المسموحة بالغرفة) وإمكانية حجز غرفة كاملة"
                    : "Customize allowed room bed capacities and full-room booking privileges per job level"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleResetDefaultLevels}
                  className="gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {ar ? "استعادة الافتراضي" : "Reset Defaults"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsAddLevelOpen(true)}
                  className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4" />
                  {ar ? "إضافة مستوى جديد" : "Add Level"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dynamic Job Level Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {((form.watch("jobLevelPolicies") && form.watch("jobLevelPolicies").length > 0)
                  ? form.watch("jobLevelPolicies")
                  : DEFAULT_JOB_LEVEL_POLICIES
                ).map((lvl: JobLevelPolicy, index: number) => {
                  const isL0 = lvl.levelKey === "0" || lvl.id === "level_0";
                  const isL1 = lvl.levelKey === "1" || lvl.id === "level_1";
                  const isL2 = lvl.levelKey === "2" || lvl.id === "level_2";
                  const isL3 = lvl.levelKey === "3" || lvl.id === "level_3";
                  const isL4 = lvl.levelKey === "4" || lvl.id === "level_4";

                  const badgeBg = isL0
                    ? "bg-amber-500 text-white border-amber-600 font-bold"
                    : isL1
                    ? "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400"
                    : isL2
                    ? "bg-blue-500/10 text-blue-700 border-blue-300 dark:text-blue-400"
                    : isL3
                    ? "bg-indigo-500/10 text-indigo-700 border-indigo-300 dark:text-indigo-400"
                    : isL4
                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-400"
                    : "bg-purple-500/10 text-purple-700 border-purple-300 dark:text-purple-400";

                  const cardBorder = isL0
                    ? "border-amber-300/80 bg-amber-500/5 dark:border-amber-700/60"
                    : "border-border bg-card hover:border-primary/40";

                  const sortedCapacities = [...(lvl.allowedCapacities || [1])].sort((a, b) => a - b);

                  return (
                    <div
                      key={lvl.id || `level_${index}`}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between shadow-xs ${cardBorder}`}
                    >
                      <div className="space-y-3">
                        {/* Level Header: Badge + Delete Button */}
                        <div className="flex items-center justify-between gap-1.5">
                          <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${badgeBg}`}>
                            {isL0 ? "Level 0 ★" : `Level ${lvl.levelKey || index}`}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteLevel(lvl.id)}
                            title={ar ? "حذف هذا المستوى" : "Delete level"}
                            className="h-6 w-6 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        {/* Level Title & Subtitle */}
                        <div>
                          <div className="text-xs font-bold leading-snug line-clamp-1">
                            {ar ? lvl.nameAr || lvl.name : lvl.name || lvl.nameAr}
                          </div>
                          <div className="text-[10px] text-muted-foreground leading-normal mt-0.5 line-clamp-2">
                            {lvl.description || (ar ? lvl.name : lvl.nameAr)}
                          </div>
                        </div>

                        {/* Multi-Capacity Customization */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-muted-foreground">
                              {ar ? "سعات الأسرة:" : "Bed Capacities:"}
                            </span>
                            <span className="font-bold text-primary text-[11px]">
                              {sortedCapacities.join(" ، ")} {ar ? "سرير" : "beds"}
                            </span>
                          </div>

                          {/* Capacity Selectable Chips 1..8 */}
                          <div className="grid grid-cols-4 gap-1">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((bed) => {
                              const isSelected = lvl.allowedCapacities.includes(bed);
                              return (
                                <button
                                  key={bed}
                                  type="button"
                                  onClick={() => handleToggleCapacity(lvl.id, bed)}
                                  className={`text-[11px] font-bold py-1 px-1.5 rounded-md border transition-all flex items-center justify-center gap-0.5 ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary shadow-2xs scale-[1.02]"
                                      : "bg-background text-muted-foreground hover:bg-muted/70 border-muted/50 hover:text-foreground"
                                  }`}
                                  title={`${bed} ${ar ? "سرير بالغرفة" : "beds in room"}`}
                                >
                                  {isSelected ? "✓" : ""} {bed}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Footer: Allow Entire Room Switch */}
                      <div className="mt-3.5 pt-2.5 border-t border-border/60 flex items-center justify-between">
                        <div className="space-y-0.5 pe-2">
                          <span className="text-[11px] font-bold block leading-tight">
                            {ar ? "غرفة كاملة" : "Entire Room"}
                          </span>
                          <span className="text-[9.5px] text-muted-foreground block leading-tight">
                            {lvl.allowEntire ? (ar ? "مسموح (فردي)" : "Allowed") : (ar ? "مشترك فقط" : "Shared")}
                          </span>
                        </div>
                        <Switch
                          checked={lvl.allowEntire}
                          onCheckedChange={(val) => handleToggleAllowEntire(lvl.id, val)}
                          className="scale-85"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />

              {/* Department Clustering & Segregation Policies */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="policyDepartmentClustering"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card">
                      <div className="space-y-0.5 pe-4">
                        <FormLabel className="text-xs font-bold flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          {ar ? "التجميع التلقائي حسب القسم (Department Clustering)" : "Auto Department Clustering"}
                        </FormLabel>
                        <FormDescription className="text-[11px]">
                          {ar
                            ? "النظام يختار ويبحث تلقائياً عن الغرف التي يتواجد بها زملاء من نفس القسم (مثل عمال الـ Housekeeping معاً)"
                            : "Prioritize & auto-recommend rooms housing colleagues from the same department"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="policyStrictDepartmentSegregation"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card">
                      <div className="space-y-0.5 pe-4">
                        <FormLabel className="text-xs font-bold flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                          {ar ? "منع خلط الأقسام نهائياً (Strict Segregation)" : "Strict Department Segregation"}
                        </FormLabel>
                        <FormDescription className="text-[11px]">
                          {ar
                            ? "منع تسكين أي موظف في غرفة بها موظف من قسم آخر وظهور استثناء للمشرف"
                            : "Disallow mixing employees of different departments in the same room"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="policyStrictGenderSegregation"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-pink-50/50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800">
                      <div className="space-y-0.5 pe-4">
                        <FormLabel className="text-xs font-bold flex items-center gap-1.5 text-pink-900 dark:text-pink-300">
                          <ShieldAlert className="w-3.5 h-3.5 text-pink-600" />
                          {ar ? "سياسة فصل الجنسين الصارمة (Strict Gender Segregation)" : "Strict Gender Segregation"}
                        </FormLabel>
                        <FormDescription className="text-[11px] text-pink-950/70 dark:text-pink-300/70">
                          {ar
                            ? "منع منعاً باتاً تسكين موظف وموظفة في نفس الغرفة المشتركة أو حجز غرفة مخصصة للجنس الآخر"
                            : "Strictly prohibit mixed-gender shared accommodation or cross-gender wing allocation"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="policyStrictFamilySegregation"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800">
                      <div className="space-y-0.5 pe-4">
                        <FormLabel className="text-xs font-bold flex items-center gap-1.5 text-indigo-900 dark:text-indigo-300">
                          <HeartHandshake className="w-3.5 h-3.5 text-indigo-600" />
                          {ar ? "سياسة سكن العائلات الصارمة (Strict Family Segregation)" : "Strict Family Segregation"}
                        </FormLabel>
                        <FormDescription className="text-[11px] text-indigo-950/70 dark:text-indigo-300/70">
                          {ar
                            ? "حظر تسكين الموظفين العزاب في أجنحة العائلات، وحظر تسكين عائلة في غرفة مشتركة مع عزاب إلا باستثناء معتمد"
                            : "Strictly reserve family suites for families; bachelors require approved exception"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="policyAdaptiveLearning"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                      <div className="space-y-0.5 pe-4">
                        <FormLabel className="text-xs font-bold flex items-center gap-1.5 text-blue-900 dark:text-blue-300">
                          <Bot className="w-3.5 h-3.5 text-blue-600" />
                          {ar ? "التعلم الذكي لتوزيع الأقسام (AI Adaptive Territory Learning)" : "AI Adaptive Department Learning"}
                        </FormLabel>
                        <FormDescription className="text-[11px] text-blue-950/70 dark:text-blue-300/70">
                          {ar
                            ? "يتعلم محرك التسكين سلوكياً قطاعات الأقسام (Housekeeping / F&B / مطبخ) ويرشح الغرف التي تجمع زملاء القسم تلقائياً"
                            : "Engine learns department territories dynamically and clusters colleagues together automatically"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="policyRequireExceptionApproval"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                      <div className="space-y-0.5 pe-4">
                        <FormLabel className="text-xs font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                          {ar ? "حوكمة واعتماد استثناءات التسكين (Approval Workflow)" : "Require Exception Approval Workflow"}
                        </FormLabel>
                        <FormDescription className="text-[11px] text-amber-950/70 dark:text-amber-300/70">
                          {ar
                            ? "إلزامية فتح نموذج تسجيل رسمي لتسجيل المسوغ الإداري والجهة المعتمدة عند أي مخالفة لسياسات السكن"
                            : "Mandates formal approval dialog and logs justification & approving party for any policy override"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
  );
}
