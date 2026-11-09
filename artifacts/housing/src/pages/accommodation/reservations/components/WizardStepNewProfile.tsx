import type { ChangeEvent, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { NationalitySelect } from "@/components/ui/nationality-select";
import {
  X, ChevronRight, ChevronLeft, Building, Camera, FileText, AlertCircle, Users,
} from "lucide-react";
import type { DuplicateResults } from "@/hooks/use-check-duplicates";
import type { NewFormState, Setter } from "../types";

interface WizardStepNewProfileProps {
  ar: boolean;
  activePropertyId: number | string | null | undefined;
  newForm: NewFormState;
  setNewForm: Setter<NewFormState>;
  photoPreview: string | null;
  photoRef: RefObject<HTMLInputElement | null>;
  docsRef: RefObject<HTMLInputElement | null>;
  handlePhotoSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  clearPhoto: () => void;
  handleDocSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  removeDoc: (index: number) => void;
  resDuplicates: DuplicateResults;
  resHasDuplicates: boolean;
  setStep: Setter<1 | 2 | 3>;
}

export function WizardStepNewProfile({
  ar, activePropertyId, newForm, setNewForm, photoPreview, photoRef, docsRef,
  handlePhotoSelect, clearPhoto, handleDocSelect, removeDoc, resDuplicates, resHasDuplicates, setStep,
}: WizardStepNewProfileProps) {
  return (

            <div className="space-y-5 py-2">
              {/* Photo Picker */}
              <div className="flex justify-center">
                <div className="relative group">
                  <div
                    className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center overflow-hidden bg-muted cursor-pointer hover:border-primary transition-colors shadow-xs"
                    onClick={() => photoRef.current?.click()}
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Camera className="w-7 h-7" />
                        <span className="text-xs text-center leading-tight px-1 font-medium">
                          {ar ? "إضافة\nصورة" : "Add\nPhoto"}
                        </span>
                      </div>
                    )}
                  </div>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                </div>
              </div>

              {/* Third-Party Profile Banner */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 text-xs font-semibold shadow-2xs">
                <Users className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
                <span>{ar ? "ملف موظف طرف ثالث جديد (مقاول / مورد / شركة خارجية)" : "New Third-Party Profile (Contractor / Vendor)"}</span>
              </div>

              {/* Section 1: Personal Information (الاسم رباعي والهوية والاتصال) */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{ar ? "1. البيانات الشخصية الأساسية" : "1. Personal Information"}</p>
                  <span className="text-xs text-muted-foreground font-mono">{newForm.profileId}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "كود الموظف *" : "Profile Code *"}</Label>
                    <Input
                      value={newForm.profileId}
                      onChange={(e) => setNewForm((f) => ({ ...f, profileId: e.target.value }))}
                      placeholder={ar ? "مثال: EMP-001" : "e.g. EMP-001"}
                      className={resDuplicates.profileId ? "border-destructive focus-visible:ring-destructive bg-destructive/5" : ""}
                    />
                    {resDuplicates.profileId && (
                      <div className="flex items-center gap-1.5 text-xs text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {ar
                            ? `كود الموظف مسجل مسبقاً باسم: ${resDuplicates.profileId.name}`
                            : `Code already registered to: ${resDuplicates.profileId.name}`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الاسم الأول *" : "First Name *"}</Label>
                    <Input value={newForm.firstName} onChange={(e) => setNewForm((f) => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الاسم الثاني *" : "Second Name *"}</Label>
                    <Input value={newForm.lastName} onChange={(e) => setNewForm((f) => ({ ...f, lastName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الاسم الثالث" : "Third Name"}</Label>
                    <Input value={newForm.thirdName} onChange={(e) => setNewForm((f) => ({ ...f, thirdName: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الاسم الرابع" : "Fourth Name"}</Label>
                    <Input value={newForm.fourthName} onChange={(e) => setNewForm((f) => ({ ...f, fourthName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "رقم الهوية / الإقامة *" : "National ID *"}</Label>
                    <Input
                      value={newForm.nationalId}
                      onChange={(e) => setNewForm((f) => ({ ...f, nationalId: e.target.value }))}
                      className={resDuplicates.nationalId ? "border-destructive focus-visible:ring-destructive bg-destructive/5" : ""}
                    />
                    {resDuplicates.nationalId && (
                      <div className="flex items-center gap-1.5 text-xs text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {ar
                            ? `رقم الهوية مسجل مسبقاً للموظف: ${resDuplicates.nationalId.name} (كود: ${resDuplicates.nationalId.profileId})`
                            : `ID already registered to: ${resDuplicates.nationalId.name} (Code: ${resDuplicates.nationalId.profileId})`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الجنسية" : "Nationality"}</Label>
                    <NationalitySelect
                      value={newForm.nationality}
                      onChange={(v) => setNewForm((f) => ({ ...f, nationality: v }))}
                      propertyId={typeof activePropertyId === "number" ? activePropertyId : undefined}
                      className="h-9 text-xs"
                      placeholder={ar ? "اختر الجنسية..." : "Select nationality..."}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الهاتف *" : "Phone *"}</Label>
                    <Input
                      value={newForm.phone}
                      onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+201..."
                      className={resDuplicates.phone ? "border-destructive focus-visible:ring-destructive bg-destructive/5" : ""}
                    />
                    {resDuplicates.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {ar
                            ? `رقم الهاتف مسجل مسبقاً للموظف: ${resDuplicates.phone.name} (كود: ${resDuplicates.phone.profileId})`
                            : `Phone already registered to: ${resDuplicates.phone.name} (Code: ${resDuplicates.phone.profileId})`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "الجنس" : "Gender"}</Label>
                    <Select value={newForm.gender || "M"} onValueChange={(v) => setNewForm((f) => ({ ...f, gender: v }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">{ar ? "ذكر" : "Male"}</SelectItem>
                        <SelectItem value="F">{ar ? "أنثى" : "Female"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "تاريخ الميلاد" : "Date of Birth"}</Label>
                    <DateInput value={newForm.dateOfBirth} onChange={(iso) => setNewForm((f) => ({ ...f, dateOfBirth: iso }))} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{ar ? "العنوان" : "Address"}</Label>
                    <Input value={newForm.address} onChange={(e) => setNewForm((f) => ({ ...f, address: e.target.value }))} placeholder={ar ? "العنوان بالكامل..." : "Full address..."} className="h-9" />
                  </div>
                </div>
              </div>

              {/* Section 2: Work & Company Information (بيانات العمل والشركة للطرف الثالث) */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-4 shadow-2xs">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-primary" />
                  {ar ? "2. بيانات العمل والشركة (طرف ثالث)" : "2. Work & Company Information (Third-Party)"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {ar ? "اسم الشركة (المقاول / المورد) *" : "Company Name (Contractor / Vendor) *"} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={newForm.companyName}
                      onChange={(e) => setNewForm((f) => ({ ...f, companyName: e.target.value }))}
                      placeholder={ar ? "أدخل اسم شركة المقاول أو المورد..." : "Enter contractor/vendor company..."}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {ar ? "الوظيفة / المهنة *" : "Job / Occupation *"} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={newForm.jobTitle}
                      onChange={(e) => setNewForm((f) => ({ ...f, jobTitle: e.target.value }))}
                      placeholder={ar ? "مثال: أمن وحراسة، فني، نظافة، سائق..." : "e.g. Security, Tech, Cleaner..."}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: ID Documents & Passports (مستندات وصور الهوية) */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{ar ? "3. صور الهوية وجواز السفر والمستندات" : "3. ID Documents & Passport Attachments"}</p>
                  <span className="text-xs font-medium text-primary">{(newForm.idDocuments || []).length} {ar ? "مرفقات" : "files"}</span>
                </div>
                <input ref={docsRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handleDocSelect} />
                <Button type="button" variant="outline" onClick={() => docsRef.current?.click()} className="w-full border-dashed h-11 gap-2 bg-background hover:bg-muted font-medium">
                  <FileText className="w-4 h-4 text-primary" />
                  {ar ? "+ رفع صور البطاقة أو جواز السفر أو عقود العمل" : "+ Upload ID Cards, Passports or Contract Documents"}
                </Button>
                {newForm.idDocuments && newForm.idDocuments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                    {newForm.idDocuments.map((doc, i) => (
                      <div key={i} className="relative group border rounded-lg overflow-hidden h-28 flex flex-col justify-between bg-card shadow-xs">
                        <div className="relative h-20 w-full bg-muted/30 overflow-hidden flex items-center justify-center">
                          {doc.fileData.startsWith("data:image") ? (
                            <img src={doc.fileData} alt={doc.fileName} className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-muted-foreground"><span className="text-xs font-mono font-bold">PDF</span></div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeDoc(i); }}
                            className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full flex items-center justify-center shadow transition-transform active:scale-90 z-20"
                            title={ar ? "حذف هذا المستند" : "Remove document"}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="p-1.5 bg-background border-t">
                          <span className="text-[11px] font-medium truncate block" title={doc.fileName}>{doc.fileName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1 rtl:rotate-180" />{ar ? "رجوع" : "Back"}</Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={
                    resHasDuplicates ||
                    !newForm.firstName?.trim() ||
                    !newForm.lastName?.trim() ||
                    !newForm.nationalId?.trim() ||
                    !newForm.phone?.trim() ||
                    !newForm.companyName?.trim() ||
                    !newForm.jobTitle?.trim()
                  }
                  className="font-semibold"
                >
                  {ar ? "التالي (تحديد الغرفة)" : "Next (Select Room)"}<ChevronRight className="w-4 h-4 ml-1 rtl:rotate-180" />
                </Button>
              </div>
            </div>
  );
}
