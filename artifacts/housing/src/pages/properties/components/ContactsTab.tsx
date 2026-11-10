// Property dialog > HR and housing manager contacts tab.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Building2, Users } from "lucide-react";
import type { PropertiesState } from "./usePropertiesState";

export function renderContactsTab(s: PropertiesState) {
  const { ar, form, setForm } = s;
  return (
<TabsContent value="contacts" className="space-y-4 mt-4">
              <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/20 text-xs text-muted-foreground flex items-center gap-2.5">
                <Users className="w-5 h-5 text-primary shrink-0" />
                <span className="leading-relaxed">
                  {ar
                    ? "تسجيل وتعديل بيانات إدارة الموارد البشرية وإدارة السكن (مدير الموارد البشرية، مساعد مدير الموارد البشرية، مدير السكن، مساعد مدير السكن). تظهر هذه البيانات تلقائياً في بوابة الموظفين والتواصل السريع."
                    : "Official HR & Housing Management contacts (HR Manager, Assistant HR Manager, Housing Manager, Assistant Housing Manager). These contacts are automatically displayed in the Resident Portal for instant resident support."}
                </span>
              </div>

              {/* HR Contacts Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {ar ? "إدارة الموارد البشرية (HR Management)" : "HR Management"}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* HR Manager */}
                  <div className="p-3.5 rounded-xl border bg-card/60 space-y-2.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary inline-block">
                      {ar ? "مدير الموارد البشرية" : "HR Manager"}
                    </span>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "الاسم" : "Name"}</Label>
                      <Input
                        value={form.hrContact1Name}
                        onChange={(e) => setForm(f => ({ ...f, hrContact1Name: e.target.value }))}
                        placeholder={ar ? "اسم مدير الموارد البشرية" : "HR Manager Name"}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "المسمى الوظيفي" : "Title"}</Label>
                      <Input
                        value={form.hrContact1Title}
                        onChange={(e) => setForm(f => ({ ...f, hrContact1Title: e.target.value }))}
                        placeholder="HR Manager"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "رقم الهاتف / واتساب" : "Phone / WhatsApp"}</Label>
                      <Input
                        value={form.hrContact1Phone}
                        onChange={(e) => setForm(f => ({ ...f, hrContact1Phone: e.target.value }))}
                        placeholder="+20 100 000 0000"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "البريد الإلكتروني" : "Email"}</Label>
                      <Input
                        value={form.hrContact1Email}
                        onChange={(e) => setForm(f => ({ ...f, hrContact1Email: e.target.value }))}
                        placeholder="hr.manager@sunrise-resorts.com"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Assistant HR Manager */}
                  <div className="p-3.5 rounded-xl border bg-card/60 space-y-2.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary inline-block">
                      {ar ? "مساعد مدير الموارد البشرية" : "Assistant HR Manager"}
                    </span>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "الاسم" : "Name"}</Label>
                      <Input
                        value={form.hrContact2Name}
                        onChange={(e) => setForm(f => ({ ...f, hrContact2Name: e.target.value }))}
                        placeholder={ar ? "اسم مساعد مدير الموارد البشرية" : "Assistant HR Manager Name"}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "المسمى الوظيفي" : "Title"}</Label>
                      <Input
                        value={form.hrContact2Title}
                        onChange={(e) => setForm(f => ({ ...f, hrContact2Title: e.target.value }))}
                        placeholder="Assistant HR Manager"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "رقم الهاتف / واتساب" : "Phone / WhatsApp"}</Label>
                      <Input
                        value={form.hrContact2Phone}
                        onChange={(e) => setForm(f => ({ ...f, hrContact2Phone: e.target.value }))}
                        placeholder="+20 100 000 0000"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "البريد الإلكتروني" : "Email"}</Label>
                      <Input
                        value={form.hrContact2Email}
                        onChange={(e) => setForm(f => ({ ...f, hrContact2Email: e.target.value }))}
                        placeholder="asst.hr@sunrise-resorts.com"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Housing Managers Grid */}
              <div className="space-y-3 pt-2 border-t">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {ar ? "إدارة السكن (Housing Management)" : "Housing Management"}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Housing Manager */}
                  <div className="p-3.5 rounded-xl border bg-card/60 space-y-2.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 inline-block">
                      {ar ? "مدير السكن" : "Housing Manager"}
                    </span>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "الاسم" : "Name"}</Label>
                      <Input
                        value={form.housingManager1Name}
                        onChange={(e) => setForm(f => ({ ...f, housingManager1Name: e.target.value }))}
                        placeholder={ar ? "اسم مدير السكن" : "Housing Manager Name"}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "المسمى الوظيفي" : "Title"}</Label>
                      <Input
                        value={form.housingManager1Title}
                        onChange={(e) => setForm(f => ({ ...f, housingManager1Title: e.target.value }))}
                        placeholder="Housing Manager"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "رقم الهاتف / واتساب" : "Phone / WhatsApp"}</Label>
                      <Input
                        value={form.housingManager1Phone}
                        onChange={(e) => setForm(f => ({ ...f, housingManager1Phone: e.target.value }))}
                        placeholder="+20 100 000 0000"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "البريد الإلكتروني" : "Email"}</Label>
                      <Input
                        value={form.housingManager1Email}
                        onChange={(e) => setForm(f => ({ ...f, housingManager1Email: e.target.value }))}
                        placeholder="housing.manager@sunrise-resorts.com"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Assistant Housing Manager */}
                  <div className="p-3.5 rounded-xl border bg-card/60 space-y-2.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 inline-block">
                      {ar ? "مساعد مدير السكن" : "Assistant Housing Manager"}
                    </span>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "الاسم" : "Name"}</Label>
                      <Input
                        value={form.housingManager2Name}
                        onChange={(e) => setForm(f => ({ ...f, housingManager2Name: e.target.value }))}
                        placeholder={ar ? "اسم مساعد مدير السكن" : "Assistant Housing Manager Name"}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "المسمى الوظيفي" : "Title"}</Label>
                      <Input
                        value={form.housingManager2Title}
                        onChange={(e) => setForm(f => ({ ...f, housingManager2Title: e.target.value }))}
                        placeholder="Assistant Housing Manager"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "رقم الهاتف / واتساب" : "Phone / WhatsApp"}</Label>
                      <Input
                        value={form.housingManager2Phone}
                        onChange={(e) => setForm(f => ({ ...f, housingManager2Phone: e.target.value }))}
                        placeholder="+20 100 000 0000"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{ar ? "البريد الإلكتروني" : "Email"}</Label>
                      <Input
                        value={form.housingManager2Email}
                        onChange={(e) => setForm(f => ({ ...f, housingManager2Email: e.target.value }))}
                        placeholder="asst.housing@sunrise-resorts.com"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
  );
}
