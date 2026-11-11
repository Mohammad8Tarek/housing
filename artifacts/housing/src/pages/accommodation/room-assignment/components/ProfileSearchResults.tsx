import type { Property } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UserCheck,
  Building2,
  CheckCircle2,
  Briefcase,
  Phone,
  Home,
  UserX,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { ProfileResult } from "../../shared/profile-search";

/** ── مصفوفة نتائج البحث الذكية (Profile Selection Matrix) ── */
export function ProfileSearchResults({
  ar,
  isSearching,
  empResults,
  empSearch,
  searchPropertyId,
  allProperties,
  effectiveTargetPropId,
  selectProfile,
}: {
  ar: boolean;
  isSearching: boolean;
  empResults: ProfileResult[];
  empSearch: string;
  searchPropertyId: string;
  allProperties: Property[];
  effectiveTargetPropId: number;
  selectProfile: (emp: ProfileResult) => void;
}) {
  return (
    <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-card border-2 border-primary/30 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1">
      {/* شريط معلومات البحث */}
      <div className="px-4 py-2.5 bg-muted/60 border-b flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">
            {isSearching
              ? ar
                ? "جاري البحث..."
                : "Searching..."
              : ar
                ? `مصفوفة نتائج البحث (${empResults.length} موظف)`
                : `Search Results Matrix (${empResults.length} profiles)`}
          </span>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] font-semibold border-primary/30 text-primary"
        >
          {searchPropertyId === "all"
            ? ar
              ? "🌐 بحث شامل في كل الفنادق"
              : "🌐 All Properties Scope"
            : `${ar ? "فندق: " : "Property: "} ${allProperties.find((p) => String(p.id) === searchPropertyId)?.name || ""}`}
        </Badge>
      </div>

      {isSearching && (
        <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2.5">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span>
            {ar
              ? "جاري البحث عبر قواعد بيانات الفنادق..."
              : "Searching across hotel databases..."}
          </span>
        </div>
      )}

      {!isSearching && empResults.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          <UserX className="w-10 h-10 mx-auto mb-2.5 text-muted-foreground/40" />
          <p className="font-bold text-foreground text-sm">
            {ar
              ? "لم يتم العثور على أي نتائج مطابقة"
              : "No matching profiles found"}
          </p>
          <p className="text-xs text-muted-foreground/80 mt-1">
            {ar
              ? `لا يوجد موظف يطابق "${empSearch}" في نطاق البحث الحالي. جرب تغيير النطاق إلى "كل الفروع".`
              : `No profile matches "${empSearch}". Try switching scope to "All Properties".`}
          </p>
        </div>
      )}

      {!isSearching && empResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 max-h-[440px] overflow-y-auto">
          {empResults.map((emp) => {
            const isOtherBranch =
              Number(emp.propertyId) !== effectiveTargetPropId;
            return (
              <div
                key={`${emp.propertyId}-${emp.id}`}
                onClick={() => selectProfile(emp)}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer group shadow-2xs hover:shadow-md flex flex-col justify-between gap-3 ${
                  isOtherBranch
                    ? "border-amber-500/30 bg-amber-500/[0.02] hover:border-amber-500 hover:bg-amber-500/[0.06]"
                    : "border-border/80 bg-card hover:border-primary hover:bg-muted/30"
                }`}
              >
                {/* الجزء العلوي: الصورة والاسم والفرع */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-primary font-black flex items-center justify-center flex-shrink-0 border border-primary/25 shadow-2xs group-hover:scale-105 transition-transform overflow-hidden">
                    {emp.photoUrl ? (
                      <img
                        src={emp.photoUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>
                        {emp.firstName?.[0] || ""}
                        {emp.lastName?.[0] || ""}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                        {emp.firstName} {emp.lastName}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono py-0 px-1.5 h-4 bg-muted/40"
                      >
                        #{emp.profileId}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] py-0 px-1.5 h-4.5 font-semibold flex items-center gap-1 ${
                          isOtherBranch
                            ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
                            : "bg-primary/10 text-primary border-primary/25"
                        }`}
                      >
                        <Building2 className="w-2.5 h-2.5" />
                        <span>
                          {emp.propertyName || (ar ? "فندق خارجي" : "Hotel")}
                        </span>
                      </Badge>
                      {isOtherBranch && (
                        <Badge className="text-[9px] py-0 px-1 h-4 bg-amber-500 text-white">
                          {ar ? "تحويل فندق" : "Cross-Hotel"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* بيانات الوظيفة والقسم والرقم القومي */}
                <div className="space-y-1.5 text-xs text-muted-foreground pt-1 border-t border-border/40">
                  {(emp.jobTitle || emp.department) && (
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-muted-foreground/70 flex-shrink-0" />
                      <span className="truncate font-medium text-foreground/80">
                        {emp.jobTitle || "—"}
                      </span>
                      {emp.department && (
                        <>
                          <span className="text-muted-foreground/40">•</span>
                          <span className="truncate">{emp.department}</span>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground/80 pt-0.5">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-muted-foreground/70" />
                      {emp.nationalId || "—"}
                    </span>
                    {emp.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted-foreground/70" />
                        {emp.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* الجزء السفلي: حالة التسكين وزر الاختيار */}
                <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                  {emp.accommodationRoom ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0.5 px-2 bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 flex items-center gap-1 font-medium"
                    >
                      <Home className="w-3 h-3 text-amber-600 flex-shrink-0" />
                      <span className="truncate">
                        {ar
                          ? `مقيم: ${emp.accommodationBuilding ? `${emp.accommodationBuilding} - ` : ""}غ ${emp.accommodationRoom}`
                          : `Housed: ${emp.accommodationBuilding ? `${emp.accommodationBuilding} ` : ""}Rm ${emp.accommodationRoom}`}
                      </span>
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0.5 px-2 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 flex items-center gap-1 font-medium"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                      <span>{ar ? "متاح للتسكين" : "Unassigned / Ready"}</span>
                    </Badge>
                  )}

                  <Button
                    size="sm"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectProfile(emp);
                    }}
                    className="h-7 text-xs font-bold px-3 gap-1 shadow-xs group-hover:bg-primary"
                  >
                    <span>
                      {ar
                        ? isOtherBranch
                          ? "اختيار للنقل"
                          : "اختيار"
                        : "Select"}
                    </span>
                    <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
