// @ts-nocheck
import * as React from "react";
import { Check, ChevronsUpDown, Globe, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  ALL_COUNTRIES,
  POPULAR_COUNTRIES,
  Country,
  findCountry,
  getCountryFlag,
} from "@/lib/countries";
import { useLanguage } from "@/context/LanguageContext";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";

export interface NationalitySelectProps {
  value?: string | null;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  propertyId?: number;
  allowCustom?: boolean;
}

function normalizeArabic(text: string): string {
  return text
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ي|ى/g, "ي")
    .toLowerCase()
    .trim();
}

export function NationalitySelect({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  propertyId,
  allowCustom = true,
}: NationalitySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const { language } = useLanguage();
  const isAr = language === "ar";

  // Optional custom lookup values defined in Settings
  const { data: dbNationalities = [] } = useLookupValues(
    propertyId || 0,
    LOOKUP_CATEGORIES.NATIONALITY
  );

  const selectedCountry = React.useMemo(() => {
    return findCountry(value);
  }, [value]);

  // If value is set but doesn't match a predefined country, display it nicely
  const displayLabel = React.useMemo(() => {
    if (!value) return "";
    if (selectedCountry) {
      return isAr
        ? `${selectedCountry.flag} ${selectedCountry.demonymAr}`
        : `${selectedCountry.flag} ${selectedCountry.demonymEn}`;
    }
    return `🌐 ${value}`;
  }, [value, selectedCountry, isAr]);

  // Normalize search term
  const cleanSearch = search.trim();
  const normSearchAr = normalizeArabic(cleanSearch);
  const normSearchEn = cleanSearch.toLowerCase();

  const isMatching = React.useCallback(
    (c: Country) => {
      if (!cleanSearch) return true;
      return (
        normalizeArabic(c.demonymAr).includes(normSearchAr) ||
        normalizeArabic(c.nameAr).includes(normSearchAr) ||
        c.demonymEn.toLowerCase().includes(normSearchEn) ||
        c.nameEn.toLowerCase().includes(normSearchEn) ||
        c.code.toLowerCase() === normSearchEn
      );
    },
    [cleanSearch, normSearchAr, normSearchEn]
  );

  // Filtered countries
  const filteredPopular = React.useMemo(() => {
    if (cleanSearch) return [];
    return POPULAR_COUNTRIES;
  }, [cleanSearch]);

  const filteredAll = React.useMemo(() => {
    const list = ALL_COUNTRIES.filter(isMatching);
    return [...list].sort((a, b) => {
      if (isAr) {
        return a.demonymAr.localeCompare(b.demonymAr, "ar");
      }
      return a.demonymEn.localeCompare(b.demonymEn, "en");
    });
  }, [isMatching, isAr]);

  // Also include custom DB lookup nationalities if any
  const customDbItems = React.useMemo(() => {
    if (!dbNationalities.length) return [];
    return dbNationalities
      .filter((n: any) => n.value && !findCountry(n.value))
      .filter((n: any) => {
        if (!cleanSearch) return true;
        return (
          normalizeArabic(n.value).includes(normSearchAr) ||
          n.value.toLowerCase().includes(normSearchEn)
        );
      });
  }, [dbNationalities, cleanSearch, normSearchAr, normSearchEn]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const defaultPlaceholder = isAr ? "اختر الجنسية..." : "Select nationality...";

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-9 px-3 font-normal text-start bg-background hover:bg-muted/50 border-input",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate flex items-center gap-1.5 flex-1 min-w-0">
            {displayLabel ? (
              displayLabel
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 opacity-50 shrink-0" />
                <span className="truncate">{placeholder || defaultPlaceholder}</span>
              </>
            )}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                className="hover:bg-muted p-0.5 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                title={isAr ? "إلغاء التحديد" : "Clear selection"}
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] sm:w-[360px] p-0 shadow-lg border border-border bg-popover z-[150]"
        align="start"
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="p-2 border-b bg-muted/30">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 rtl:right-2.5 rtl:left-auto top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isAr
                  ? "ابحث عن الدولة أو الجنسية..."
                  : "Search country or nationality..."
              }
              className="h-8 pl-8 rtl:pr-8 rtl:pl-2 text-xs bg-background"
              autoFocus
            />
          </div>
        </div>

        <div
          className="max-h-[300px] overflow-y-auto p-1 text-xs divide-y divide-border/40 overscroll-contain"
          onWheel={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Custom DB items if present */}
          {customDbItems.length > 0 && (
            <div className="py-1">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {isAr ? "جنسيات مخصصة" : "Custom Nationalities"}
              </div>
              {customDbItems.map((n: any) => {
                const isSelected = value === n.value;
                return (
                  <button
                    key={n.id || n.value}
                    type="button"
                    onClick={() => handleSelect(n.value)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded text-start hover:bg-accent hover:text-accent-foreground transition-colors",
                      isSelected && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span>🏷️</span>
                      <span className="truncate">{n.value}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Popular / Regional Countries (when not searching) */}
          {filteredPopular.length > 0 && (
            <div className="py-1">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {isAr ? "الأكثر استخداماً" : "Frequently Used"}
              </div>
              {filteredPopular.map((c) => {
                const isSelected = value === c.value;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelect(c.value)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded text-start hover:bg-accent hover:text-accent-foreground transition-colors",
                      isSelected && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="truncate">
                        {isAr ? c.demonymAr : c.demonymEn}
                      </span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* All Countries */}
          <div className="py-1">
            {!cleanSearch && (
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {isAr ? "جميع الدول والجنسيات" : "All Countries"}
              </div>
            )}
            {filteredAll.length > 0 ? (
              filteredAll.map((c) => {
                const isSelected = value === c.value;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelect(c.value)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded text-start hover:bg-accent hover:text-accent-foreground transition-colors",
                      isSelected && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="truncate">
                        {isAr ? c.demonymAr : c.demonymEn}
                      </span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-muted-foreground text-xs">
                {isAr ? "لا توجد نتائج مطابقة" : "No matching countries found"}
              </div>
            )}
          </div>

          {/* Allow custom entry if user typed something not matched */}
          {allowCustom && cleanSearch && !filteredAll.some((c) => c.value.toLowerCase() === cleanSearch.toLowerCase()) && (
            <div className="p-1 pt-1.5">
              <button
                type="button"
                onClick={() => handleSelect(cleanSearch)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-start bg-primary/5 hover:bg-primary/10 text-primary font-medium transition-colors"
              >
                <span>➕</span>
                <span className="truncate">
                  {isAr ? `استخدام "${cleanSearch}" كجنسية مخصصة` : `Use "${cleanSearch}" as custom nationality`}
                </span>
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
