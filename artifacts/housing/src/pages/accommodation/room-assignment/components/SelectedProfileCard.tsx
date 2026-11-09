import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Info, X, Phone } from "lucide-react";
import type { ProfileResult } from "../../shared/profile-search";

/** ── كارت الموظف المختار التنفيذي (Selected Profile Executive Card) ── */
export function SelectedProfileCard({
  ar,
  selectedProfile,
  customPhone,
  setCustomPhone,
  isFamilyHousing,
  setIsFamilyHousing,
  clearProfile,
}: {
  ar: boolean;
  selectedProfile: ProfileResult;
  customPhone: string;
  setCustomPhone: (v: string) => void;
  isFamilyHousing: boolean;
  setIsFamilyHousing: (v: boolean) => void;
  clearProfile: () => void;
}) {
  return (
    <div className="mt-3.5 p-4 rounded-xl bg-primary/[0.06] border-2 border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-primary text-white font-black flex items-center justify-center flex-shrink-0 shadow-md text-base">
          {selectedProfile.photoUrl ? (
            <img src={selectedProfile.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
          ) : (
            <span>
              {selectedProfile.firstName?.[0] || ""}
              {selectedProfile.lastName?.[0] || ""}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base text-foreground">
              {selectedProfile.firstName} {selectedProfile.lastName}
            </span>
            <Badge variant="outline" className="text-xs font-mono font-bold bg-background">
              #{selectedProfile.profileId}
            </Badge>
            {selectedProfile.propertyName && (
              <Badge className="text-xs bg-primary/20 text-primary border border-primary/30">
                <Building2 className="w-3 h-3 mr-1" />
                {selectedProfile.propertyName}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
            <span className="font-semibold text-foreground/80">{selectedProfile.jobTitle || "—"}</span>
            <span>•</span>
            <span>{selectedProfile.department || "—"}</span>
            {selectedProfile.nationalId && (
              <>
                <span>•</span>
                <span className="font-mono">{selectedProfile.nationalId}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {selectedProfile.phone ? (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1.5 font-mono py-0.5">
                <Phone className="w-3 h-3 text-emerald-600" />
                <span>{selectedProfile.phone}</span>
                <span className="text-[10px] text-muted-foreground font-sans">({ar ? "سيصل له إشعار الواتساب" : "WhatsApp active"})</span>
              </Badge>
            ) : (
              <div className="flex items-center gap-2 flex-wrap text-xs bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 px-2.5 py-1.5 rounded-lg">
                <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span className="font-semibold">{ar ? "لا يوجد رقم هاتف:" : "No phone:"}</span>
                <Input
                  placeholder={ar ? "أدخل رقم الواتساب لإرسال الترحيب..." : "Enter WhatsApp phone..."}
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  dir="ltr"
                  className="h-6 w-44 text-xs font-mono bg-background"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold px-3 py-2 rounded-lg border bg-background hover:bg-muted/50 transition-colors shadow-2xs">
          <input
            type="checkbox"
            checked={isFamilyHousing}
            onChange={(e) => setIsFamilyHousing(e.target.checked)}
            className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
          />
          <span className="text-foreground">
            {ar ? "تسكين عائلي" : "Family Housing"}
          </span>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearProfile}
          className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1"
        >
          <X className="w-3.5 h-3.5" />
          <span>{ar ? "تغيير" : "Change"}</span>
        </Button>
      </div>
    </div>
  );
}
