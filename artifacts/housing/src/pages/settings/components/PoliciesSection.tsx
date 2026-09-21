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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  Users,
  Clock,
  FileText,
  UserCheck,
  Building,
  Phone,
  Mail,
  Printer,
  Sparkles,
  HeartHandshake,
} from "lucide-react";
import { useFormContext } from "react-hook-form";
import type { SettingsFormData } from "../hooks/useSettingsForm";
import { printLuxuryReport } from "@/pages/reports/utils/luxury-report-engine";

interface PoliciesSectionProps {
  language: string;
  isLoading: boolean;
  propertyName?: string;
}

export function PoliciesSection({
  language,
  isLoading,
  propertyName,
}: PoliciesSectionProps) {
  const form = useFormContext<SettingsFormData>();
  const ar = language === "ar";

  const handleExportPolicyPdf = () => {
    const values = form.getValues();
    const propName = propertyName || (ar ? "سكن موظفي صن رايز" : "Sunrise Staff Housing");

    const policyContentHtml = `
      <div style="font-family: inherit; line-height: 1.8; color: #1e293b; padding: 10px 0;">
        <div style="background: linear-gradient(135deg, #0F2A44 0%, #1e3a5f 100%); color: #fff; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 8px 0; color: #C9A24D; font-size: 20px; font-weight: bold;">
            ${ar ? "وثيقة ولائحة سياسات السكن الرسمية" : "Official Housing Policy & Code of Conduct"}
          </h2>
          <p style="margin: 0; font-size: 13px; opacity: 0.9;">
            ${propName} — ${ar ? "تطبق على كافة النزلاء والمقيمين بالسكن" : "Applicable to all housing residents"}
          </p>
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="color: #0F2A44; border-bottom: 2px solid #C9A24D; padding-bottom: 6px; font-size: 16px;">
            ${ar ? "1. استحقاق السكن وتوزيع الغرف حسب الدرجة الوظيفية" : "1. Room Allocation & Job Level Entitlements"}
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #0F2A44; border: 1px solid #cbd5e1;">
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: start;">${ar ? "الدرجة الوظيفية" : "Job Level"}</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: start;">${ar ? "الحد الأقصى للأفراد بالغرفة" : "Max Room Capacity"}</th>
                <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: start;">${ar ? "إمكانية حجز غرفة كاملة (Single)" : "Entire Room Allowance"}</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background-color: #fffbeb;">
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong style="color: #b45309;">${ar ? "الدرجة صفر (Level 0 - الإدارة العليا / VIP)" : "Level 0 (Executive / VIP)"}</strong></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel0Capacity} ${ar ? "فرد (غرفة مستقلة / جناح)" : "person (Single / Suite)"}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel0AllowEntire ? (ar ? "مسموح (غرفة كاملة مستقلة)" : "Allowed (Entire Room)") : (ar ? "غير مسموح" : "Not Allowed")}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${ar ? "الدرجة الأولى (Level 1 - المدراء)" : "Level 1 (Executive/Managers)"}</strong></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel1Capacity} ${ar ? "فرد" : "person"}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel1AllowEntire ? (ar ? "مسموح (غرفة فردية كاملة)" : "Allowed (Entire Room)") : (ar ? "غير مسموح" : "Not Allowed")}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${ar ? "الدرجة الثانية (Level 2 - المشرفين)" : "Level 2 (Supervisors)"}</strong></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel2Capacity} ${ar ? "أفراد" : "persons"}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel2AllowEntire ? (ar ? "مسموح" : "Allowed") : (ar ? "تسكين مشترك فقط" : "Shared Only")}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${ar ? "الدرجة الثالثة (Level 3 - الموظفين)" : "Level 3 (Staff)"}</strong></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel3Capacity} ${ar ? "أفراد" : "persons"}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${ar ? "تسكين مشترك" : "Shared Only"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #cbd5e1;"><strong>${ar ? "الدرجة الرابعة (Level 4 - العمال)" : "Level 4 (Workers)"}</strong></td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${values.policyLevel4Capacity} ${ar ? "أفراد" : "persons"}</td>
                <td style="padding: 8px; border: 1px solid #cbd5e1;">${ar ? "تسكين مشترك" : "Shared Only"}</td>
              </tr>
            </tbody>
          </table>
          <p style="margin-top: 8px; font-size: 12px; color: #475569;">
            * ${ar ? "سياسة توحيد الأقسام بالغرف (Department Clustering): " : "Department Clustering Policy: "}
            <strong>${values.policyDepartmentClustering ? (ar ? "مفعلة (يقوم النظام تلقائياً باختيار غرف من نفس القسم)" : "Enabled (Auto-match roommates from same department)") : (ar ? "معطلة" : "Disabled")}</strong>
            ${values.policyStrictDepartmentSegregation ? `<br />* <span style="color:#b91c1c; font-weight:bold;">${ar ? "تنبيه صارم: يُمنع نهائياً تسكين أقسام مختلفة في نفس الغرفة." : "Strict segregation: Different departments in the same room are strictly prohibited."}</span>` : ""}
          </p>
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="color: #0F2A44; border-bottom: 2px solid #C9A24D; padding-bottom: 6px; font-size: 16px;">
            ${ar ? "2. سياسة وضوابط الزيارات العائلية" : "2. Family Visit Policy & Rules"}
          </h3>
          <ul style="font-size: 12px; color: #334155; margin: 8px 0; padding-${ar ? "right" : "left"}: 20px;">
            <li><strong>${ar ? "الحد الأقصى لليالي الزيارة الواحدة:" : "Max nights per visit:"}</strong> ${values.visitMaxNights} ${ar ? "ليالي" : "nights"}</li>
            <li><strong>${ar ? "الحد الأقصى لعدد الزيارات المسموح بها سنوياً:" : "Max visits per year:"}</strong> ${values.visitMaxVisitsPerYear} ${ar ? "زيارات" : "visits"}</li>
            <li><strong>${ar ? "الحد الأدنى لخدمة الموظف قبل استحقاق الزيارة:" : "Min service before eligibility:"}</strong> ${values.visitMinServiceMonths} ${ar ? "أشهر" : "months"}</li>
            <li><strong>${ar ? "فترة التهدئة الفاصلة بين زيارة وأخرى:" : "Cooldown period between visits:"}</strong> ${values.visitCooldownDays} ${ar ? "يوماً" : "days"}</li>
            <li><strong>${ar ? "إلزامية الرقم القومي / إثبات الهوية لكافة المرافقين:" : "Mandatory National ID for companions:"}</strong> ${values.visitRequireNationalId ? (ar ? "إلزامي لكافة الأفراد والمرافقين" : "Mandatory for all companions") : (ar ? "اختياري" : "Optional")}</li>
          </ul>
          ${values.familyVisitPolicyText ? `<div style="background:#f8fafc; padding:12px; border-left:4px solid #C9A24D; font-size:12px; white-space:pre-wrap; margin-top:8px;">${values.familyVisitPolicyText}</div>` : ""}
        </div>

        <div style="margin-bottom: 24px;">
          <h3 style="color: #0F2A44; border-bottom: 2px solid #C9A24D; padding-bottom: 6px; font-size: 16px;">
            ${ar ? "3. لائحة السكن ومواعيد الإغلاق (Curfew & Housing Rules)" : "3. Housing Rules & Curfew"}
          </h3>
          <p style="font-size: 12px; color: #334155; margin: 6px 0;">
            <strong>${ar ? "موعد إغلاق بوابات السكن (Curfew):" : "Curfew Policy:"}</strong>
            ${values.curfewEnabled ? `<span style="color:#b91c1c; font-weight:bold;">${ar ? `مفعل — الساعة ${values.curfewTime}` : `Enabled at ${values.curfewTime}`}</span>` : (ar ? "غير محدد / حر" : "Open / No Curfew")}
          </p>
          ${values.housingRulesText ? `<div style="background:#f8fafc; padding:12px; border-left:4px solid #0F2A44; font-size:12px; white-space:pre-wrap; margin-top:8px;">${values.housingRulesText}</div>` : ""}
          ${values.housingPolicyText ? `<div style="background:#fffbeb; padding:12px; border-left:4px solid #f59e0b; font-size:12px; white-space:pre-wrap; margin-top:8px;">${values.housingPolicyText}</div>` : ""}
        </div>

        <div style="margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 16px;">
          <h4 style="color: #0F2A44; font-size: 14px; margin-bottom: 12px;">${ar ? "مسؤولو التواصل والإبلاغ عن المخالفات والطوارئ" : "Emergency & Key Contact Persons"}</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 11px;">
            ${values.hrContact1Name ? `<div style="background:#f1f5f9; padding:8px; border-radius:4px;"><strong>${values.hrContact1Title || (ar ? "مدير الموارد البشرية" : "HR Manager")}:</strong> ${values.hrContact1Name} | ${values.hrContact1Phone} | ${values.hrContact1Email}</div>` : ""}
            ${values.hrContact2Name ? `<div style="background:#f1f5f9; padding:8px; border-radius:4px;"><strong>${values.hrContact2Title || (ar ? "منسق الموارد البشرية" : "HR Coordinator")}:</strong> ${values.hrContact2Name} | ${values.hrContact2Phone} | ${values.hrContact2Email}</div>` : ""}
            ${values.housingManager1Name ? `<div style="background:#f1f5f9; padding:8px; border-radius:4px;"><strong>${values.housingManager1Title || (ar ? "مدير السكن" : "Housing Manager")}:</strong> ${values.housingManager1Name} | ${values.housingManager1Phone} | ${values.housingManager1Email}</div>` : ""}
            ${values.housingManager2Name ? `<div style="background:#f1f5f9; padding:8px; border-radius:4px;"><strong>${values.housingManager2Title || (ar ? "مساعد مدير السكن" : "Assistant Housing Manager")}:</strong> ${values.housingManager2Name} | ${values.housingManager2Phone} | ${values.housingManager2Email}</div>` : ""}
          </div>
        </div>
      </div>
    `;

    printLuxuryReport({
      title: ar ? "لائحة وسياسات السكن الرسمية" : "Official Housing Policy & Code of Conduct",
      titleAr: "لائحة وسياسات السكن الرسمية",
      subtitle: propName,
      subtitleAr: propName,
      language: ar ? "ar" : "en",
      orientation: "portrait",
      showKpis: false,
      showSignatures: true,
      signatures: {
        role1: "Housing Manager",
        role1Ar: "مدير السكن",
        role2: "Human Resources Director",
        role2Ar: "مدير الموارد البشرية",
        role3: "General Manager",
        role3Ar: "المدير العام",
      },
      rows: [],
      customSectionsHtml: policyContentHtml,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Export Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl border">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {ar ? "سياسات ولوائح السكن والمحددات الإدارية" : "Housing Policies, Regulations & Allocation Rules"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ar
              ? "يتبع النظام هذه القواعد تلقائياً في التسكين والبحث عن الغرف المناسبة واحتساب المخالفات لكل عقار"
              : "The system enforces these rules automatically during room allocations, matching, and violation audits"}
          </p>
        </div>
        <Button
          type="button"
          onClick={handleExportPolicyPdf}
          variant="outline"
          className="gap-2 border-primary/30 hover:bg-primary/5 text-primary font-semibold text-xs shadow-sm"
        >
          <Printer className="w-4 h-4" />
          {ar ? "تصدير وثيقة سياسة السكن (PDF)" : "Export Policy Document (PDF)"}
        </Button>
      </div>

      {/* 1. Room Allocation & Level Entitlements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building className="w-4 h-4 text-primary" />
            {ar ? "1. سياسة استحقاق السكن والدرجات الوظيفية (Allocation Rules)" : "1. Job Level Entitlements & Department Rules"}
          </CardTitle>
          <CardDescription>
            {ar
              ? "تحديد سعة الغرف المسموحة لكل درجة وظيفية وضوابط تسكين الأقسام المشتركة"
              : "Set room capacity per job level and configure department clustering rules"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <FormField
              control={form.control}
              name="policyLevel0Capacity"
              render={({ field }) => (
                <FormItem className="bg-amber-500/10 p-3 rounded-lg border border-amber-300/70 dark:border-amber-700/50">
                  <FormLabel className="text-xs font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                    <Badge variant="outline" className="bg-amber-500 text-white border-amber-600 text-[10px] font-bold">Level 0 ★</Badge>
                    {ar ? "سعة الإدارة العليا" : "Level 0 Capacity"}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={5} {...field} className="bg-background" />
                  </FormControl>
                  <FormDescription className="text-[11px] text-amber-900/80 dark:text-amber-300/80 font-medium">
                    {ar ? "القيادات العليا والمدراء العموم / VIP (فردي/جناح - 1 فرد)" : "Top Execs / GM / VIP (default 1)"}
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="policyLevel1Capacity"
              render={({ field }) => (
                <FormItem className="bg-muted/30 p-3.5 rounded-lg border">
                  <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300 text-[10px]">Level 1</Badge>
                    {ar ? "سعة غرفة الدرجة الأولى" : "Level 1 Capacity"}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={10} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    {ar ? "مدراء العموم ورؤساء القطاعات (عادة 1 فرد)" : "Executive / GMs (default 1)"}
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="policyLevel2Capacity"
              render={({ field }) => (
                <FormItem className="bg-muted/30 p-3.5 rounded-lg border">
                  <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-300 text-[10px]">Level 2</Badge>
                    {ar ? "سعة غرفة الدرجة الثانية" : "Level 2 Capacity"}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={10} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    {ar ? "مدراء الأقسام والمساعدون (عادة 2 فرد)" : "Department Heads (default 2)"}
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="policyLevel3Capacity"
              render={({ field }) => (
                <FormItem className="bg-muted/30 p-3.5 rounded-lg border">
                  <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 border-indigo-300 text-[10px]">Level 3</Badge>
                    {ar ? "سعة غرفة الدرجة الثالثة" : "Level 3 Capacity"}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={10} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    {ar ? "المشرفون والموظفون (عادة 2 إلى 3)" : "Supervisors/Staff (default 3)"}
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="policyLevel4Capacity"
              render={({ field }) => (
                <FormItem className="bg-muted/30 p-3.5 rounded-lg border">
                  <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-300 text-[10px]">Level 4</Badge>
                    {ar ? "سعة غرفة الدرجة الرابعة" : "Level 4 Capacity"}
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={10} {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">
                    {ar ? "العمال والخدمات المعاونة (عادة 4)" : "Line Staff/Workers (default 4)"}
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* Entire Room Booking & Department Clustering */}
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
              name="policyLevel0AllowEntire"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-amber-500/5 border-amber-300/60 dark:border-amber-700/50">
                  <div className="space-y-0.5 pe-4">
                    <FormLabel className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      {ar ? "حجز غرفة كاملة للإدارة العليا (Level 0 Entire Room)" : "Allow Entire Room for Level 0"}
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      {ar
                        ? "استحقاق حجز الغرفة بالكامل كفردي أو جناح مستقل لقيادات الإدارة العليا"
                        : "Allow booking full single room/suite for Level 0 executives"}
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
              name="policyLevel1AllowEntire"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card">
                  <div className="space-y-0.5 pe-4">
                    <FormLabel className="text-xs font-bold">
                      {ar ? "السماح بحجز غرفة كاملة (Level 1 Entire Room)" : "Allow Entire Room for Level 1"}
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      {ar
                        ? "استحقاق حجز الغرفة بالكامل كفردي لمدراء الدرجة الأولى"
                        : "Allow booking the entire room for Level 1 executives"}
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
              name="policyLevel2AllowEntire"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between p-3.5 border rounded-lg bg-card">
                  <div className="space-y-0.5 pe-4">
                    <FormLabel className="text-xs font-bold">
                      {ar ? "السماح بحجز غرفة كاملة (Level 2 Entire Room)" : "Allow Entire Room for Level 2"}
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      {ar
                        ? "إتاحة حجز الغرفة كاملة لمدراء الدرجة الثانية في حالات الاستثناء"
                        : "Allow booking the entire room for Level 2 department managers"}
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

      {/* 2. Family Visit Policy */}
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

      {/* 3. Housing Rules & Curfew */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-amber-500" />
            {ar ? "3. قواعد السكن ومواعيد الإغلاق (Housing Rules & Curfew)" : "3. Housing Rules & Curfew"}
          </CardTitle>
          <CardDescription>
            {ar ? "تنظيم مواعيد الدخول والخروج ولائحة السلوك والتعليمات العامة" : "Regulate curfew times, code of conduct, and resident house rules"}
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
                      {ar ? "تفعيل موعد إغلاق بوابات السكن (Curfew)" : "Enable Housing Curfew"}
                    </FormLabel>
                    <FormDescription className="text-[11px]">
                      {ar ? "تسجيل تنبيه عند دخول الموظفين بعد الموعد المحدد" : "Trigger alerts for residents arriving after curfew"}
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
              name="curfewTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">{ar ? "ساعة الإغلاق المسائي" : "Curfew Cutoff Time"}</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormDescription className="text-[11px]">{ar ? "مثال: 23:00 (11 مساءً)" : "e.g., 23:00 (11:00 PM)"}</FormDescription>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="housingRulesText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">{ar ? "لائحة قواعد وسلوكيات السكن (Code of Conduct)" : "Housing Code of Conduct"}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder={ar ? "اكتب تعليمات الحفاظ على الهدوء، النظافة، السلامة، وممنوعات التدخين..." : "Specify rules regarding quiet hours, cleanliness, safety, smoking bans..."}
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
                <FormLabel className="text-xs font-semibold">{ar ? "اللائحة العامة وتعهد النزيل (General Policy & Agreement)" : "General Policy & Agreement"}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder={ar ? "نص الإقرار الذي يوقع عليه النزيل عند الاستلام والتسكين..." : "Agreement text signed upon check-in..."}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* 4. HR Contacts & Housing Managers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-primary" />
            {ar ? "4. مسؤولو الموارد البشرية وإدارة السكن (Key Contacts)" : "4. Key HR & Housing Contacts"}
          </CardTitle>
          <CardDescription>
            {ar
              ? "يتم إظهار جهات الاتصال هذه في بوابة الموظفين المقيمين للاتصال السريع والتواصل المباشر"
              : "These contacts are displayed in the Resident Portal for instant WhatsApp, Call, and Email support"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* HR Contacts */}
          <div>
            <h4 className="text-xs font-bold text-primary flex items-center gap-1.5 mb-3">
              <UserCheck className="w-3.5 h-3.5" />
              {ar ? "إدارة الموارد البشرية (HR Management)" : "HR Management"}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* HR Manager */}
              <div className="p-3.5 border rounded-lg bg-card space-y-3">
                <span className="text-[11px] font-bold text-primary uppercase">{ar ? "مدير الموارد البشرية" : "HR Manager"}</span>
                <FormField
                  control={form.control}
                  name="hrContact1Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "الاسم" : "Name"}</FormLabel>
                      <FormControl><Input placeholder={ar ? "اسم مدير الموارد البشرية" : "HR Manager Name"} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="hrContact1Title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "المسمى الوظيفي" : "Title"}</FormLabel>
                        <FormControl><Input placeholder="HR Manager" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hrContact1Phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "الهاتف / واتساب" : "Phone/WhatsApp"}</FormLabel>
                        <FormControl><Input placeholder="+20 10..." {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="hrContact1Email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "البريد الإلكتروني" : "Email"}</FormLabel>
                      <FormControl><Input placeholder="hr@sunrise-resorts.com" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Assistant HR Manager */}
              <div className="p-3.5 border rounded-lg bg-card space-y-3">
                <span className="text-[11px] font-bold text-primary uppercase">{ar ? "مساعد مدير الموارد البشرية" : "Assistant HR Manager"}</span>
                <FormField
                  control={form.control}
                  name="hrContact2Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "الاسم" : "Name"}</FormLabel>
                      <FormControl><Input placeholder={ar ? "اسم مساعد مدير الموارد البشرية" : "Assistant HR Manager Name"} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="hrContact2Title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "المسمى الوظيفي" : "Title"}</FormLabel>
                        <FormControl><Input placeholder="Assistant HR Manager" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hrContact2Phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "الهاتف / واتساب" : "Phone/WhatsApp"}</FormLabel>
                        <FormControl><Input placeholder="+20 10..." {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="hrContact2Email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "البريد الإلكتروني" : "Email"}</FormLabel>
                      <FormControl><Input placeholder="hr.support@sunrise-resorts.com" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Housing Managers */}
          <div>
            <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-3">
              <Building className="w-3.5 h-3.5" />
              {ar ? "إدارة السكن (Housing Management)" : "Housing Management"}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Housing Manager */}
              <div className="p-3.5 border rounded-lg bg-card space-y-3">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase">{ar ? "مدير السكن" : "Housing Manager"}</span>
                <FormField
                  control={form.control}
                  name="housingManager1Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "الاسم" : "Name"}</FormLabel>
                      <FormControl><Input placeholder={ar ? "اسم مدير السكن" : "Housing Manager Name"} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="housingManager1Title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "المسمى الوظيفي" : "Title"}</FormLabel>
                        <FormControl><Input placeholder="Housing Manager" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="housingManager1Phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "الهاتف / واتساب" : "Phone/WhatsApp"}</FormLabel>
                        <FormControl><Input placeholder="+20 10..." {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="housingManager1Email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "البريد الإلكتروني" : "Email"}</FormLabel>
                      <FormControl><Input placeholder="housing@sunrise-resorts.com" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Assistant Housing Manager */}
              <div className="p-3.5 border rounded-lg bg-card space-y-3">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase">{ar ? "مساعد مدير السكن" : "Assistant Housing Manager"}</span>
                <FormField
                  control={form.control}
                  name="housingManager2Name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "الاسم" : "Name"}</FormLabel>
                      <FormControl><Input placeholder={ar ? "اسم مساعد مدير السكن" : "Assistant Housing Manager Name"} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    control={form.control}
                    name="housingManager2Title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "المسمى الوظيفي" : "Title"}</FormLabel>
                        <FormControl><Input placeholder="Assistant Housing Manager" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="housingManager2Phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-medium">{ar ? "الهاتف / واتساب" : "Phone/WhatsApp"}</FormLabel>
                        <FormControl><Input placeholder="+20 10..." {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="housingManager2Email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-medium">{ar ? "البريد الإلكتروني" : "Email"}</FormLabel>
                      <FormControl><Input placeholder="housing.supervisor@sunrise-resorts.com" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
