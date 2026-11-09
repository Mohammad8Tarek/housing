import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, X, ChevronRight, ChevronLeft, AlertTriangle, Check, ArrowRightLeft,
} from "lucide-react";
import { type ProfileResult } from "../../shared/profile-search";
import type { Setter } from "../types";

interface WizardStepExistingProfileProps {
  ar: boolean;
  allProperties: any[];
  activeProp: any;
  searchPropertyId: string;
  setSearchPropertyId: Setter<string>;
  searchRef: RefObject<HTMLDivElement | null>;
  empSearch: string;
  setEmpSearch: Setter<string>;
  empResults: ProfileResult[];
  isSearching: boolean;
  showDropdown: boolean;
  selectedProfile: ProfileResult | null;
  selectProfile: (emp: ProfileResult) => void;
  clearProfile: () => void;
  isCrossProperty: boolean;
  archiveSourceProfile: boolean;
  setArchiveSourceProfile: Setter<boolean>;
  setTransferType: Setter<"PERMANENT" | "TASK_FORCE">;
  setStep: Setter<1 | 2 | 3>;
}

export function WizardStepExistingProfile({
  ar, allProperties, activeProp, searchPropertyId, setSearchPropertyId, searchRef,
  empSearch, setEmpSearch, empResults, isSearching, showDropdown, selectedProfile,
  selectProfile, clearProfile, isCrossProperty, archiveSourceProfile, setArchiveSourceProfile,
  setTransferType, setStep,
}: WizardStepExistingProfileProps) {
  return (

            <div className="space-y-4 py-2">
              {allProperties.length > 1 && (
                <Select value={searchPropertyId} onValueChange={(v) => { setSearchPropertyId(v); clearProfile(); }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={ar ? "كل الفروع" : "All Properties"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{ar ? "كل الفروع" : "All Properties"}</SelectItem>
                    {allProperties.map((p: any) => (<SelectItem key={p.id} value={String(p.id)}>{p.displayName || p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}
              <div className="relative" ref={searchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
                  <Input className="pl-9 pr-9 rtl:pr-9 rtl:pl-9" placeholder={ar ? "ابحث بالاسم أو الكود أو الهوية..." : "Search by name, code, or ID..."} value={empSearch} onChange={(e) => { setEmpSearch(e.target.value); if (selectedProfile) clearProfile(); }} autoComplete="off" />
                  {empSearch && (<button onClick={clearProfile} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground rtl:right-auto rtl:left-3"><X className="w-4 h-4" /></button>)}
                </div>
                {showDropdown && (
                  <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {isSearching && <div className="p-3 text-sm text-muted-foreground">{ar ? "جاري البحث..." : "Searching..."}</div>}
                    {!isSearching && empResults.length === 0 && <div className="p-3 text-sm text-muted-foreground">{ar ? "لا توجد نتائج" : "No results"}</div>}
                    {empResults.map((emp) => (
                      <button key={emp.id} className="w-full text-left rtl:text-right px-4 py-3 hover:bg-muted/50 flex items-start gap-3 border-b last:border-0 transition-colors" onClick={() => selectProfile(emp)}>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-xs font-bold text-primary">{emp.firstName[0]}{emp.lastName[0]}</span></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-muted-foreground">{emp.profileId} • {emp.department || "—"} • {emp.jobTitle || "—"}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {emp.employmentType === "THIRD_PARTY" ? (
                              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{ar ? "طرف ثالث" : "Third Party"}{emp.companyName ? ` • ${emp.companyName}` : ""}</span>
                            ) : (
                              <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">{ar ? "داخلي" : "Internal"}</span>
                            )}
                            {emp.employmentType !== "THIRD_PARTY" && emp.contractEndDate && (
                              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                                {ar ? "انتهاء العقد:" : "Contract End:"} {emp.contractEndDate}
                              </span>
                            )}
                            {emp.accommodationRoom && (
                              <span className="text-xs bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                {ar ? `مقيم حالياً: غرفة #${emp.accommodationRoom}` : `In-House: Room #${emp.accommodationRoom}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedProfile && (
                <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"><span className="text-sm font-bold text-primary">{selectedProfile.firstName[0]}{selectedProfile.lastName[0]}</span></div>
                    <div>
                      <p className="font-semibold">{selectedProfile.firstName} {selectedProfile.lastName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{selectedProfile.profileId} • {selectedProfile.department || "—"} • {selectedProfile.jobTitle || "—"}</p>
                      {selectedProfile.employmentType !== "THIRD_PARTY" && selectedProfile.contractEndDate && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-0.5">
                          📄 {ar ? "تاريخ انتهاء العقد:" : "Contract End Date:"} {selectedProfile.contractEndDate}
                        </p>
                      )}
                    </div>
                    {selectedProfile.employmentType === "THIRD_PARTY" ? (
                      <Badge className="ml-auto rtl:ml-0 rtl:mr-auto bg-purple-100 text-purple-800 text-xs font-semibold">{ar ? "طرف ثالث" : "Third Party"}{selectedProfile.companyName ? ` • ${selectedProfile.companyName}` : ""}</Badge>
                    ) : (
                      <Badge variant="outline" className="ml-auto rtl:ml-0 rtl:mr-auto bg-blue-50 text-blue-700 text-xs font-semibold">{ar ? "موظف داخلي" : "Internal Employee"}</Badge>
                    )}
                  </div>
                  {selectedProfile.accommodationRoom && !isCrossProperty && (
                    <div className="mt-3 p-3 rounded-lg border border-red-300 bg-red-50/90 dark:bg-red-950/40 text-red-800 dark:text-red-300 text-xs flex items-start gap-2.5">
                      <X className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">
                          {ar
                            ? `تنبيه: هذا الموظف مقيم بالفعل بالسكن في غرفة رقم #${selectedProfile.accommodationRoom} ${selectedProfile.accommodationBuilding ? `(${selectedProfile.accommodationBuilding})` : ""}`
                            : `Warning: This employee is already residing in Room #${selectedProfile.accommodationRoom}`}
                        </p>
                        <p className="mt-1 text-red-700 dark:text-red-400">
                          {ar
                            ? "لا يمكن تسكينه مرتين في نفس الفندق. لنقل الموظف لغرفة أخرى، يرجى استخدام خيار (نقل لغرفة أخرى) من صفحة المقيمين بالسكن."
                            : "Cannot be double-assigned in same hotel. Use 'Room Move' from In-House page instead."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── كارت التسكين العابر للفنادق (Cross-Property Transfer Card) ── */}
                  {isCrossProperty && (
                    <div className="mt-3 p-3.5 rounded-xl border-2 border-amber-500/60 bg-amber-50/80 dark:bg-amber-950/40 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-amber-500 text-white shrink-0 shadow-2xs">
                          <ArrowRightLeft className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-foreground">
                              {ar ? "تسكين موظف من فندق آخر (Cross-Property Transfer)" : "Cross-Property Employee Assignment"}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-semibold border-amber-500/60 bg-amber-100/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
                              {selectedProfile.propertyName || (ar ? "فندق خارجي" : "Foreign Hotel")} ➔ {activeProp?.name || (ar ? "الفندق الحالي" : "Target Hotel")}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            {ar
                              ? `الموظف مسجل حالياً في (${selectedProfile.propertyName}). سيتم مزامنة بياناته ونقله إلى هذا الفندق فور إتمام التسكين.`
                              : `Resident belongs to (${selectedProfile.propertyName}). Data will be synchronized upon assignment.`}
                          </p>
                        </div>
                      </div>

                      {/* تنبيه إذا كان ساكناً في الفندق القديم */}
                      {selectedProfile.accommodationRoom && (
                        <div className="p-2.5 rounded-lg border border-amber-500/50 bg-amber-100/80 dark:bg-amber-900/50 text-amber-950 dark:text-amber-100 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-[11px]">
                              {ar
                                ? `تنبيه: الموظف ساكن حالياً في ${selectedProfile.propertyName} - غرفة رقم ${selectedProfile.accommodationRoom}!`
                                : `Notice: Resident is housed in ${selectedProfile.propertyName} - Room ${selectedProfile.accommodationRoom}!`}
                            </p>
                            <p className="text-[10.5px] text-muted-foreground dark:text-amber-200/90 leading-relaxed mt-0.5">
                              {ar
                                ? "⚡ سيقوم النظام تلقائياً بإنهاء إقامته السابقة (Check-out) وتحرير السرير هناك فور التسكين، مع الحفاظ الكامل على كافة سجلات الغرف التاريخية 100% دون أي حذف."
                                : "System will check out previous accommodation and release bed, preserving 100% of historical room logs."}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* خيارات مصير البروفايل */}
                      <div className="space-y-1.5 pt-0.5">
                        <label className="text-xs font-bold text-foreground block">
                          {ar
                            ? `سؤال: ماذا تريد أن تفعل بملف الموظف في الفندق القديم (${selectedProfile.propertyName})؟`
                            : `What should happen to the profile in (${selectedProfile.propertyName})?`}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setArchiveSourceProfile(true);
                              setTransferType("PERMANENT");
                            }}
                            className={`p-2.5 rounded-lg border text-start transition-all cursor-pointer relative ${
                              archiveSourceProfile
                                ? "bg-primary/10 border-primary shadow-2xs ring-1 ring-primary/30"
                                : "bg-background border-border hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">
                                {ar ? "1. نقله وحذفه من هناك" : "1. Transfer & Archive There"}
                              </span>
                              {archiveSourceProfile && <Check className="w-3.5 h-3.5 text-primary" />}
                            </div>
                            <Badge variant="outline" className="mt-1 text-[9px] font-medium bg-muted/60 text-muted-foreground">
                              {ar ? "أرشفة لمنع تكرار الاسم" : "Archive duplicate"}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                              {ar
                                ? "أرشفة ملفه هناك لعدم ظهوره مرتين، مع بقاء كل سجلات الإقامة القديمة واللوج 100%."
                                : "Archive old profile to avoid duplicate active records, keeping all stay logs."}
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setArchiveSourceProfile(false);
                              setTransferType("TASK_FORCE");
                            }}
                            className={`p-2.5 rounded-lg border text-start transition-all cursor-pointer relative ${
                              !archiveSourceProfile
                                ? "bg-primary/10 border-primary shadow-2xs ring-1 ring-primary/30"
                                : "bg-background border-border hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">
                                {ar ? "2. نقله وتسيب البروفايل هناك" : "2. Keep Active in Both"}
                              </span>
                              {!archiveSourceProfile && <Check className="w-3.5 h-3.5 text-primary" />}
                            </div>
                            <Badge variant="outline" className="mt-1 text-[9px] font-medium bg-muted/60 text-muted-foreground">
                              {ar ? "انتداب / فرعين" : "Secondment / Dual"}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                              {ar
                                ? "إبقاء الملف الشخصي متاحاً ونشطاً في الفندق القديم أيضاً (مناسب للانتداب والمأموريات)."
                                : "Keep profile active in source hotel too (for Task Force / dual property work)."}
                            </p>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1 rtl:rotate-180" />{ar ? "رجوع" : "Back"}</Button>
                <Button onClick={() => setStep(3)} disabled={!selectedProfile || (Boolean(selectedProfile.accommodationRoom) && !isCrossProperty)}>{ar ? "التالي" : "Next"}<ChevronRight className="w-4 h-4 ml-1 rtl:rotate-180" /></Button>
              </div>
            </div>
  );
}
