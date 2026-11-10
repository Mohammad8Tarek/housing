// Policies > Key contacts & admins tab.
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { TabsContent } from "@/components/ui/tabs";
import { Users, UserCheck, Building } from "lucide-react";
import type { PoliciesSectionState } from "./usePoliciesSectionState";

export function renderContactsTab(s: PoliciesSectionState) {
  const { form, ar } = s;
  return (
<TabsContent value="contacts" className="space-y-4 focus-visible:outline-none">
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
    </TabsContent>
  );
}
