// Read-only property details and contacts dialog.
import { PermissionGate } from "@/components/ui/permission-gate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Edit, Building2, Users, Phone, Mail, MessageCircle } from "lucide-react";
import type { PropertiesState } from "./usePropertiesState";

export function renderPropertyDetailsDialog(s: PropertiesState) {
  const { ar, selectedPropForDetails, setSelectedPropForDetails, openEdit } = s;
  return (
<Dialog
        open={Boolean(selectedPropForDetails)}
        onOpenChange={(open) => !open && setSelectedPropForDetails(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedPropForDetails && (
            <div className="space-y-6">
              <DialogHeader className="border-b pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden border shadow-xs shrink-0"
                      style={{
                        backgroundColor: selectedPropForDetails.logo
                          ? "transparent"
                          : (selectedPropForDetails.primaryColor ?? "#0F2A44"),
                      }}
                    >
                      {selectedPropForDetails.logo ? (
                        <img
                          src={selectedPropForDetails.logo}
                          alt={selectedPropForDetails.name}
                          className="w-12 h-12 object-contain"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <span>{selectedPropForDetails.name}</span>
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded font-bold">
                          {selectedPropForDetails.code}
                        </span>
                      </DialogTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedPropForDetails.displayName || selectedPropForDetails.name}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={selectedPropForDetails.status === "active" ? "default" : "secondary"}
                    className={
                      selectedPropForDetails.status === "active"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200"
                        : "bg-gray-100 text-gray-600"
                    }
                  >
                    {ar
                      ? selectedPropForDetails.status === "active"
                        ? "نشط"
                        : "غير نشط"
                      : selectedPropForDetails.status}
                  </Badge>
                </div>
              </DialogHeader>

              {/* General Property Info Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-2.5 rounded-lg bg-muted/40 border text-xs">
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "اللغة الافتراضية" : "Default Language"}
                  </span>
                  <span className="font-semibold">
                    {selectedPropForDetails.defaultLanguage === "ar"
                      ? "🇸🇦 العربية (Arabic)"
                      : "🇺🇸 English"}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border text-xs">
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "اللون المميز" : "Primary Color"}
                  </span>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <div
                      className="w-3.5 h-3.5 rounded border"
                      style={{
                        backgroundColor:
                          selectedPropForDetails.primaryColor ?? "#0F2A44",
                      }}
                    />
                    <span className="font-mono text-[11px]">
                      {selectedPropForDetails.primaryColor ?? "#0F2A44"}
                    </span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border text-xs col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-muted-foreground block mb-0.5">
                    {ar ? "رمز العقار" : "Property Code"}
                  </span>
                  <span className="font-mono font-semibold">
                    {selectedPropForDetails.code}
                  </span>
                </div>
              </div>

              {selectedPropForDetails.description && (
                <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground">
                  <span className="text-[10px] font-semibold text-foreground block mb-1">
                    {ar ? "الوصف" : "Description"}
                  </span>
                  {selectedPropForDetails.description}
                </div>
              )}

              {/* Management Contacts Section */}
              <div className="space-y-4 pt-1">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">
                    {ar ? "دليل مسؤولي الموارد البشرية وإدارة السكن" : "Key HR & Housing Contacts"}
                  </h3>
                </div>

                {/* Grid of contacts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* HR Department */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                      {ar ? "إدارة الموارد البشرية (HR)" : "HR Management"}
                    </div>

                    {/* HR Manager */}
                    <div className="p-3 rounded-lg border bg-primary/5 border-primary/20 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-primary">
                          {ar ? "مدير الموارد البشرية" : "HR Manager"}
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-foreground">
                        {selectedPropForDetails.hrContact1Name || "—"}
                      </div>
                      {selectedPropForDetails.hrContact1Title && (
                        <div className="text-xs text-muted-foreground">
                          {selectedPropForDetails.hrContact1Title}
                        </div>
                      )}
                      <div className="pt-1.5 flex flex-col gap-1 text-xs border-t border-primary/15">
                        {selectedPropForDetails.hrContact1Phone ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono dir-ltr text-xs">
                              {selectedPropForDetails.hrContact1Phone}
                            </span>
                            <div className="flex items-center gap-1">
                              <a
                                href={`tel:${selectedPropForDetails.hrContact1Phone}`}
                                className="p-1 rounded hover:bg-primary/20 text-primary transition-colors"
                                title={ar ? "اتصال" : "Call"}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`https://wa.me/${String(selectedPropForDetails.hrContact1Phone).replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 text-[11px] italic">{ar ? "لا يوجد رقم مسجل" : "No phone"}</span>
                        )}
                        {selectedPropForDetails.hrContact1Email ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate dir-ltr text-xs text-muted-foreground" title={selectedPropForDetails.hrContact1Email}>
                              {selectedPropForDetails.hrContact1Email}
                            </span>
                            <a
                              href={`mailto:${selectedPropForDetails.hrContact1Email}`}
                              className="p-1 rounded hover:bg-blue-500/20 text-blue-600 shrink-0 transition-colors"
                              title={selectedPropForDetails.hrContact1Email}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 text-[11px] italic">{ar ? "لا يوجد بريد مسجل" : "No email"}</span>
                        )}
                      </div>
                    </div>

                    {/* Asst HR Manager */}
                    <div className="p-3 rounded-lg border bg-muted/40 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          {ar ? "مساعد مدير الموارد البشرية" : "Assistant HR Manager"}
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-foreground">
                        {selectedPropForDetails.hrContact2Name || "—"}
                      </div>
                      {selectedPropForDetails.hrContact2Title && (
                        <div className="text-xs text-muted-foreground">
                          {selectedPropForDetails.hrContact2Title}
                        </div>
                      )}
                      <div className="pt-1.5 flex flex-col gap-1 text-xs border-t">
                        {selectedPropForDetails.hrContact2Phone ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono dir-ltr text-xs">
                              {selectedPropForDetails.hrContact2Phone}
                            </span>
                            <div className="flex items-center gap-1">
                              <a
                                href={`tel:${selectedPropForDetails.hrContact2Phone}`}
                                className="p-1 rounded hover:bg-primary/20 text-primary transition-colors"
                                title={ar ? "اتصال" : "Call"}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`https://wa.me/${String(selectedPropForDetails.hrContact2Phone).replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 text-[11px] italic">{ar ? "لا يوجد رقم مسجل" : "No phone"}</span>
                        )}
                        {selectedPropForDetails.hrContact2Email ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate dir-ltr text-xs text-muted-foreground" title={selectedPropForDetails.hrContact2Email}>
                              {selectedPropForDetails.hrContact2Email}
                            </span>
                            <a
                              href={`mailto:${selectedPropForDetails.hrContact2Email}`}
                              className="p-1 rounded hover:bg-blue-500/20 text-blue-600 shrink-0 transition-colors"
                              title={selectedPropForDetails.hrContact2Email}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 text-[11px] italic">{ar ? "لا يوجد بريد مسجل" : "No email"}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Housing Department */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      {ar ? "إدارة السكن (Housing)" : "Housing Management"}
                    </div>

                    {/* Housing Manager */}
                    <div className="p-3 rounded-lg border bg-amber-500/10 border-amber-500/20 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-300">
                          {ar ? "مدير السكن" : "Housing Manager"}
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-foreground">
                        {selectedPropForDetails.housingManager1Name || "—"}
                      </div>
                      {selectedPropForDetails.housingManager1Title && (
                        <div className="text-xs text-muted-foreground">
                          {selectedPropForDetails.housingManager1Title}
                        </div>
                      )}
                      <div className="pt-1.5 flex flex-col gap-1 text-xs border-t border-amber-500/15">
                        {selectedPropForDetails.housingManager1Phone ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono dir-ltr text-xs text-amber-700 dark:text-amber-300 font-semibold">
                              {selectedPropForDetails.housingManager1Phone}
                            </span>
                            <div className="flex items-center gap-1">
                              <a
                                href={`tel:${selectedPropForDetails.housingManager1Phone}`}
                                className="p-1 rounded hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors"
                                title={ar ? "اتصال" : "Call"}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`https://wa.me/${String(selectedPropForDetails.housingManager1Phone).replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 text-[11px] italic">{ar ? "لا يوجد رقم مسجل" : "No phone"}</span>
                        )}
                        {selectedPropForDetails.housingManager1Email ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate dir-ltr text-xs text-muted-foreground" title={selectedPropForDetails.housingManager1Email}>
                              {selectedPropForDetails.housingManager1Email}
                            </span>
                            <a
                              href={`mailto:${selectedPropForDetails.housingManager1Email}`}
                              className="p-1 rounded hover:bg-blue-500/20 text-blue-600 shrink-0 transition-colors"
                              title={selectedPropForDetails.housingManager1Email}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 text-[11px] italic">{ar ? "لا يوجد بريد مسجل" : "No email"}</span>
                        )}
                      </div>
                    </div>

                    {/* Asst Housing Manager */}
                    <div className="p-3 rounded-lg border bg-muted/40 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          {ar ? "مساعد مدير السكن" : "Assistant Housing Manager"}
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-foreground">
                        {selectedPropForDetails.housingManager2Name || "—"}
                      </div>
                      {selectedPropForDetails.housingManager2Title && (
                        <div className="text-xs text-muted-foreground">
                          {selectedPropForDetails.housingManager2Title}
                        </div>
                      )}
                      <div className="pt-1.5 flex flex-col gap-1 text-xs border-t">
                        {selectedPropForDetails.housingManager2Phone ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono dir-ltr text-xs">
                              {selectedPropForDetails.housingManager2Phone}
                            </span>
                            <div className="flex items-center gap-1">
                              <a
                                href={`tel:${selectedPropForDetails.housingManager2Phone}`}
                                className="p-1 rounded hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors"
                                title={ar ? "اتصال" : "Call"}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`https://wa.me/${String(selectedPropForDetails.housingManager2Phone).replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded hover:bg-emerald-500/20 text-emerald-600 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 text-[11px] italic">{ar ? "لا يوجد رقم مسجل" : "No phone"}</span>
                        )}
                        {selectedPropForDetails.housingManager2Email ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate dir-ltr text-xs text-muted-foreground" title={selectedPropForDetails.housingManager2Email}>
                              {selectedPropForDetails.housingManager2Email}
                            </span>
                            <a
                              href={`mailto:${selectedPropForDetails.housingManager2Email}`}
                              className="p-1 rounded hover:bg-blue-500/20 text-blue-600 shrink-0 transition-colors"
                              title={selectedPropForDetails.housingManager2Email}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 text-[11px] italic">{ar ? "لا يوجد بريد مسجل" : "No email"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dialog Footer */}
              <div className="flex justify-between items-center gap-3 pt-4 border-t">
                <PermissionGate module="properties" action="edit">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      const p = selectedPropForDetails;
                      setSelectedPropForDetails(null);
                      openEdit(p, "contacts");
                    }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>{ar ? "تعديل بيانات العقار ومسؤولي التواصل" : "Edit Property & Contacts"}</span>
                  </Button>
                </PermissionGate>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedPropForDetails(null)}
                >
                  {ar ? "إغلاق" : "Close"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
  );
}
