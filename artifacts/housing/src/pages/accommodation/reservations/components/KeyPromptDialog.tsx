import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import KeyManagementPanel from "@/components/KeyManagementPanel";
import { Key, Printer } from "lucide-react";
import { type ProfileResult } from "../../shared/profile-search";
import type { NewFormState, Setter } from "../types";

interface KeyPromptDialogProps {
  ar: boolean;
  keyPromptOpen: boolean;
  setKeyPromptOpen: Setter<boolean>;
  lastAssignment: any;
  activePropertyId: number | string | null | undefined;
  checkInDate: string;
  expectedCheckOut: string;
  selectedProfile: ProfileResult | null;
  newForm: NewFormState;
  printHousingLetter: (profile: any, assignment: any) => Promise<void>;
  setLocation: (to: string) => void;
}

export function KeyPromptDialog({
  ar, keyPromptOpen, setKeyPromptOpen, lastAssignment, activePropertyId, checkInDate,
  expectedCheckOut, selectedProfile, newForm, printHousingLetter, setLocation,
}: KeyPromptDialogProps) {
  return (

      <Dialog open={keyPromptOpen} onOpenChange={setKeyPromptOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Key className="w-5 h-5 text-primary" />{ar ? "تم التسكين بنجاح!" : "Assignment Successful!"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{ar ? "هل تريد إصدار مفتاح الغرفة أو طباعة خطاب السكن؟" : "Issue a room key or print the housing letter?"}</p>
            {lastAssignment && (
              <KeyManagementPanel
                assignmentId={lastAssignment?.id || lastAssignment?.data?.id}
                roomId={lastAssignment?.roomId || lastAssignment?.data?.roomId}
                propertyId={typeof activePropertyId === "number" ? activePropertyId : Number(activePropertyId) || 0}
                checkInDate={checkInDate}
                checkOutDate={expectedCheckOut || selectedProfile?.contractEndDate || (newForm.employmentType === "INTERNAL" ? newForm.contractEndDate : undefined)}
              />
            )}
            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => { const f = newForm as any; const p = selectedProfile || (f.firstName ? { firstName: f.firstName, lastName: f.lastName, firstNameAr: f.firstNameAr, lastNameAr: f.lastNameAr, department: f.department, departmentAr: f.departmentAr, jobTitle: f.jobTitle, jobTitleAr: f.jobTitleAr, nationalId: f.nationalId, nationality: f.nationality, phone: f.phone, level: f.level } : null); if (p && lastAssignment) printHousingLetter(p, lastAssignment); }} className="gap-2"><Printer className="w-4 h-4" />{ar ? "طباعة خطاب السكن" : "Print Housing Letter"}</Button>
              <Button onClick={() => { setKeyPromptOpen(false); setLocation("/accommodation/in-house"); }}>{ar ? "عرض المقيمين" : "View In-House"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
  );
}
