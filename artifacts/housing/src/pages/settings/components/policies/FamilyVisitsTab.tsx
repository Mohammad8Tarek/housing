// Policies > Family visits tab: visit limits + approval signature workflow.
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HeartHandshake, Plus, Trash2, Pencil, ArrowUp, ArrowDown, RotateCcw, FileCheck } from "lucide-react";
import type { PoliciesSectionState } from "./usePoliciesSectionState";

export function renderFamilyVisitsTab(s: PoliciesSectionState) {
  const { form, ar, currentSignaturePolicy, handleOpenAddStep, handleOpenEditStep, handleMoveStepUp, handleMoveStepDown, handleDeleteStep, handleResetWorkflow } = s;
  return (
<TabsContent value="family_visits" className="space-y-4 focus-visible:outline-none">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartHandshake className="w-4 h-4 text-pink-500" />
            {ar ? "2. سياسة وضوابط الزيارات العائلية (Family Visit Policy)" : "2. Family Visit Policy"}
          </CardTitle>
          <CardDescription>
            {ar
              ? "ضوابط استحقاق مدد واستضافات عائلات الموظفين والاشتراطات الرسمية"
              : "Eligibility criteria, maximum duration, cooldown, and identity rules for family visits"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FormField
              control={form.control}
              name="visitMaxNights"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">{ar ? "الحد الأقصى لليالي الزيارة" : "Max Nights / Visit"}</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={60} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">{ar ? "افتراضياً 7 ليالٍ" : "Default 7 nights"}</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visitMaxVisitsPerYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">{ar ? "الحد الأقصى للزيارات سنوياً" : "Max Visits / Year"}</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={20} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">{ar ? "افتراضياً زيارتان سنوياً" : "Default 2 visits/year"}</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visitMinServiceMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">{ar ? "الحد الأدنى للخدمة (شهور)" : "Min Service (Months)"}</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={60} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">{ar ? "أشهر خدمة قبل الاستحقاق" : "Months of service required"}</FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visitCooldownDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">{ar ? "فترة التهدئة الفاصلة (أيام)" : "Cooldown Days"}</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={365} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">{ar ? "الفاصل بين الزيارات" : "Days between visits"}</FormDescription>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="visitRequireNationalId"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card mt-2">
                <div className="space-y-0.5 pe-4">
                  <FormLabel className="text-xs font-bold">
                    {ar ? "إلزامية إدخال الرقم القومي لجميع أفراد الأسرة والمرافقين" : "Require National ID for All Family Companions"}
                  </FormLabel>
                  <FormDescription className="text-[11px]">
                    {ar
                      ? "عدم إتمام طلب الزيارة إلا بعد تسجيل الرقم القومي (14 رقماً) وإثبات صلة القرابة لكل فرد"
                      : "Mandates 14-digit National ID and relationship documentation for each companion"}
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
            name="familyVisitPolicyText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">{ar ? "نص وبنود لائحة الزيارات العائلية التفصيلية" : "Family Visit Policy Guidelines (Text)"}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder={ar ? "أدخل نص التعليمات والاشتراطات الخاصة بالاستضافة العائلية..." : "Enter details for family hosting policy..."}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Signature & Approval Workflow Card */}
      <Card className="border-pink-500/20 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-pink-700 dark:text-pink-400">
              <FileCheck className="w-5 h-5 text-pink-600" />
              {ar
                ? "مسار واعتمادات طلبات السكن والاستضافة (Signature & Approval Workflow)"
                : "Hosting & Visit Approval Workflow"}
            </CardTitle>
            <CardDescription>
              {ar
                ? "تحديد تسلسل التوقيعات المطلوبة لطلبات السكن والاستضافة والزيارات العائلية الخاصة بهذا العقار، وإعادة ترتيبها أو إضافة جهات اعتماد جديدة"
                : "Configure the required signature chain, reorder approval stages, or add new approval roles for this property"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetWorkflow}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {ar ? "استعادة الافتراضي" : "Reset Default"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleOpenAddStep}
              className="gap-1.5 text-xs font-semibold bg-pink-600 hover:bg-pink-700 text-white"
            >
              <Plus className="w-4 h-4" />
              {ar ? "إضافة خطوة اعتماد" : "Add Approval Step"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-16 font-bold text-xs text-center">{ar ? "الترتيب" : "Order"}</TableHead>
                  <TableHead className="font-bold text-xs">{ar ? "المسمى العربي" : "Arabic Title"}</TableHead>
                  <TableHead className="font-bold text-xs">{ar ? "المسمى الإنجليزي" : "English Title"}</TableHead>
                  <TableHead className="font-bold text-xs">{ar ? "الوظيفة / الصلاحية المطلوبة" : "Required Role"}</TableHead>
                  <TableHead className="font-bold text-xs">{ar ? "ملاحظات المسار" : "Description"}</TableHead>
                  <TableHead className="font-bold text-xs text-end w-36">{ar ? "الإجراءات والترتيب" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentSignaturePolicy.map((step, idx) => (
                  <TableRow key={step.id || `step_${idx}`} className="hover:bg-muted/30">
                    <TableCell className="text-center font-bold">
                      <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center bg-pink-50 text-pink-700 border-pink-300">
                        {step.stepOrder}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-sm">
                      {step.labelAr}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {step.labelEn}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px] bg-muted">
                        {step.roleRequired}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {step.description || "-"}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          disabled={idx === 0}
                          onClick={() => handleMoveStepUp(idx)}
                          title={ar ? "تقديم الخطوة لأعلى" : "Move Up"}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          disabled={idx === currentSignaturePolicy.length - 1}
                          onClick={() => handleMoveStepDown(idx)}
                          title={ar ? "تأخير الخطوة لأسفل" : "Move Down"}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleOpenEditStep(idx)}
                          title={ar ? "تعديل" : "Edit"}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          disabled={currentSignaturePolicy.length <= 1}
                          onClick={() => handleDeleteStep(idx)}
                          title={ar ? "حذف" : "Delete"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
