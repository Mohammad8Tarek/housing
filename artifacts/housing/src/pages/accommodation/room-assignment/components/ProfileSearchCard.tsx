import type { RefObject } from "react";
import type { Property } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, UserCheck, Building2, X } from "lucide-react";
import type { ProfileResult } from "../../shared/profile-search";
import { ProfileSearchResults } from "./ProfileSearchResults";
import { SelectedProfileCard } from "./SelectedProfileCard";
import { CrossPropertyTransferCard } from "./CrossPropertyTransferCard";

/** بطاقة الموظف — scope selector, debounced search box, results matrix, selected card & cross-property fate. */
export function ProfileSearchCard({
  ar,
  allProperties,
  activePropertyId,
  effectiveTargetPropId,
  targetProp,
  searchPropertyId,
  setSearchPropertyId,
  searchRef,
  empSearch,
  setEmpSearch,
  empResults,
  isSearching,
  showDropdown,
  selectedProfile,
  selectProfile,
  clearProfile,
  customPhone,
  setCustomPhone,
  isFamilyHousing,
  setIsFamilyHousing,
  isCrossProperty,
  archiveSourceProfile,
  setArchiveSourceProfile,
  setTransferType,
}: {
  ar: boolean;
  allProperties: Property[];
  activePropertyId: number | "all" | undefined;
  effectiveTargetPropId: number;
  targetProp: Property | undefined;
  searchPropertyId: string;
  setSearchPropertyId: (v: string) => void;
  searchRef: RefObject<HTMLDivElement | null>;
  empSearch: string;
  setEmpSearch: (v: string) => void;
  empResults: ProfileResult[];
  isSearching: boolean;
  showDropdown: boolean;
  selectedProfile: ProfileResult | null;
  selectProfile: (emp: ProfileResult) => void;
  clearProfile: () => void;
  customPhone: string;
  setCustomPhone: (v: string) => void;
  isFamilyHousing: boolean;
  setIsFamilyHousing: (v: boolean) => void;
  isCrossProperty: boolean;
  archiveSourceProfile: boolean;
  setArchiveSourceProfile: (v: boolean) => void;
  setTransferType: (v: "PERMANENT" | "TASK_FORCE") => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-primary" />
          {ar ? "بيانات الموظف" : "Profile"}
        </CardTitle>
        <CardDescription>
          {ar ? "ابحث عن موظف من أي فرع" : "Search across all properties"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {allProperties.length > 1 && (
          <div className="mb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 border border-dashed">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-xs font-bold text-foreground">
                {ar ? "نطاق بحث الموظفين:" : "Profile Search Scope:"}
              </span>
            </div>
            <Select
              value={searchPropertyId}
              onValueChange={(v) => {
                setSearchPropertyId(v);
                clearProfile();
              }}
            >
              <SelectTrigger className="h-8 w-full sm:w-64 text-xs font-semibold">
                <SelectValue
                  placeholder={
                    ar ? "🌐 كل الفنادق والفروع (بحث شامل)" : "All Properties"
                  }
                />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem
                  value="all"
                  className="text-xs font-bold text-primary"
                >
                  <div className="flex items-center gap-1.5">
                    <span>🌐</span>
                    <span>
                      {ar
                        ? "كل الفنادق والفروع (بحث شامل)"
                        : "All Properties (Global Search)"}
                    </span>
                  </div>
                </SelectItem>
                {allProperties.map((p) => (
                  <SelectItem
                    key={p.id}
                    value={String(p.id)}
                    className="text-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{p.displayName || p.name}</span>
                      {p.id === activePropertyId && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] py-0 px-1 ml-1 rtl:mr-1"
                        >
                          {ar ? "الحالي" : "Active"}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 pr-9 h-10 text-sm font-medium"
              placeholder={
                ar
                  ? "ابحث بالاسم، أو كود الموظف، أو الرقم القومي، أو رقم الهاتف..."
                  : "Search by employee name, staff code, national ID, or phone..."
              }
              value={empSearch}
              onChange={(e) => {
                setEmpSearch(e.target.value);
                if (selectedProfile) clearProfile();
              }}
              autoComplete="off"
            />
            {empSearch && (
              <button
                onClick={clearProfile}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ── مصفوفة نتائج البحث الذكية (Profile Selection Matrix) ── */}
          {showDropdown && (
            <ProfileSearchResults
              ar={ar}
              isSearching={isSearching}
              empResults={empResults}
              empSearch={empSearch}
              searchPropertyId={searchPropertyId}
              allProperties={allProperties}
              effectiveTargetPropId={effectiveTargetPropId}
              selectProfile={selectProfile}
            />
          )}
        </div>

        {/* ── كارت الموظف المختار التنفيذي (Selected Profile Executive Card) ── */}
        {selectedProfile && (
          <SelectedProfileCard
            ar={ar}
            selectedProfile={selectedProfile}
            customPhone={customPhone}
            setCustomPhone={setCustomPhone}
            isFamilyHousing={isFamilyHousing}
            setIsFamilyHousing={setIsFamilyHousing}
            clearProfile={clearProfile}
          />
        )}

        {/* ── كارت التسكين العابر للفنادق (Cross-Property Assignment) ── */}
        {selectedProfile && isCrossProperty && (
          <CrossPropertyTransferCard
            ar={ar}
            selectedProfile={selectedProfile}
            targetProp={targetProp}
            archiveSourceProfile={archiveSourceProfile}
            setArchiveSourceProfile={setArchiveSourceProfile}
            setTransferType={setTransferType}
          />
        )}
      </CardContent>
    </Card>
  );
}
