import * as React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import { arEG } from "date-fns/locale";
import {
  addDays,
  addMonths,
  addYears,
  subMonths,
  subYears,
  setMonth as setMonthIndex,
  setYear as setYearValue,
} from "date-fns";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatDate,
  isoToDate,
  parseDMY,
  toISODate,
  todayISO,
} from "@/lib/date-utils";
import { useLanguage } from "@/context/LanguageContext";

export type DateInputProps = {
  /** ISO calendar date "YYYY-MM-DD" (or "" when empty). */
  value?: string;
  onChange?: (iso: string) => void;
  /** ISO bounds "YYYY-MM-DD". */
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
};

const MONTHS_AR = [
  "يناير (01)",
  "فبراير (02)",
  "مارس (03)",
  "أبريل (04)",
  "مايو (05)",
  "يونيو (06)",
  "يوليو (07)",
  "أغسطس (08)",
  "سبتمبر (09)",
  "أكتوبر (10)",
  "نوفمبر (11)",
  "ديسمبر (12)",
];

const MONTHS_EN = [
  "Jan (01)",
  "Feb (02)",
  "Mar (03)",
  "Apr (04)",
  "May (05)",
  "Jun (06)",
  "Jul (07)",
  "Aug (08)",
  "Sep (09)",
  "Oct (10)",
  "Nov (11)",
  "Dec (12)",
];

function useSafeLanguage() {
  try {
    return useLanguage();
  } catch {
    const isRtl =
      typeof document !== "undefined" &&
      (document.documentElement.dir === "rtl" ||
        document.documentElement.lang === "ar");
    return {
      language: (isRtl ? "ar" : "en") as "ar" | "en",
      dir: (isRtl ? "rtl" : "ltr") as "rtl" | "ltr",
      setLanguage: () => {},
    };
  }
}

/**
 * Format mask helper for date typing:
 * Auto inserts '/' while typing digits and handles pasted formats (ISO, dots, dashes).
 */
function applyDateMask(nextVal: string, prevVal: string): string {
  // If user is deleting, allow clean deletion
  if (nextVal.length < prevVal.length) {
    if (prevVal.endsWith("/") && !nextVal.endsWith("/")) {
      return nextVal.slice(0, -1);
    }
    return nextVal;
  }

  const trimmed = nextVal.trim();

  // If pasted ISO format YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  // If pasted with dots/dashes DD.MM.YYYY or DD-MM-YYYY
  const altMatch = /^(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})$/.exec(trimmed);
  if (altMatch) {
    return `${altMatch[1].padStart(2, "0")}/${altMatch[2].padStart(2, "0")}/${altMatch[3]}`;
  }

  // Pure digits auto-slashing
  const digits = trimmed.replace(/\D/g, "").slice(0, 8);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Enhanced Canonical DateInput for the Housing & Accommodation ERP.
 * - Bilingual (Arabic RTL & English)
 * - Auto-masking & intelligent typing (DD/MM/YYYY)
 * - Quick Action Presets (Today, Tomorrow, +7d, +30d, Clear)
 * - Month & Year Fast Selector & Steppers
 * - 1-Click Clear Button
 */
export function DateInput({
  value = "",
  onChange,
  min,
  max,
  placeholder,
  className,
  disabled,
  required,
  id,
}: DateInputProps) {
  const { language, dir } = useSafeLanguage();
  const ar = language === "ar" || dir === "rtl";

  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(() =>
    value ? formatDate(value, "") : "",
  );

  const selected = isoToDate(value) ?? undefined;
  const minDate = isoToDate(min);
  const maxDate = isoToDate(max);

  // Keep displayed text in sync with value prop
  React.useEffect(() => {
    setText(value ? formatDate(value, "") : "");
  }, [value]);

  // Track the month currently displayed in the calendar
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() => {
    if (selected) return selected;
    if (minDate && minDate > new Date()) return minDate;
    if (maxDate && maxDate < new Date()) return maxDate;
    return new Date();
  });

  // Sync displayed month when value changes
  React.useEffect(() => {
    if (value) {
      const d = isoToDate(value);
      if (d) setCurrentMonth(d);
    }
  }, [value]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const d = isoToDate(value);
      if (d) {
        setCurrentMonth(d);
      } else if (minDate && minDate > new Date()) {
        setCurrentMonth(minDate);
      } else if (maxDate && maxDate < new Date()) {
        setCurrentMonth(maxDate);
      }
    }
    setOpen(nextOpen);
  };

  const applyISO = (iso: string) => {
    onChange?.(iso);
    setText(iso ? formatDate(iso, "") : "");
    if (iso) {
      const d = isoToDate(iso);
      if (d) setCurrentMonth(d);
    }
  };

  const handleClear = () => {
    applyISO("");
  };

  const handleInputChange = (raw: string) => {
    const next = applyDateMask(raw, text);
    setText(next);

    if (!next.trim()) {
      onChange?.("");
      return;
    }

    // When fully typed (DD/MM/YYYY), validate and commit
    if (next.length === 10) {
      const iso = parseDMY(next, min, max);
      if (iso) {
        onChange?.(iso);
        const d = isoToDate(iso);
        if (d) setCurrentMonth(d);
      }
    }
  };

  const handleBlur = () => {
    if (!text.trim()) {
      setText("");
      if (value) onChange?.("");
      return;
    }
    const iso = parseDMY(text, min, max);
    if (iso) {
      onChange?.(iso);
      setText(formatDate(iso, ""));
      const d = isoToDate(iso);
      if (d) setCurrentMonth(d);
    } else {
      // Revert incomplete or invalid date to previous valid value
      setText(value ? formatDate(value, "") : "");
    }
  };

  // Quick Preset Shortcuts
  const today = new Date();
  const todayIso = todayISO();
  const tomorrowIso = toISODate(addDays(today, 1));
  const plus7Iso = toISODate(addDays(today, 7));
  const plus30Iso = toISODate(addDays(today, 30));

  const isAllowed = (isoStr: string) => {
    if (min && isoStr < min) return false;
    if (max && isoStr > max) return false;
    return true;
  };

  const presets: { key: string; label: string; iso: string }[] = [];
  if (isAllowed(todayIso)) {
    presets.push({ key: "today", label: ar ? "اليوم" : "Today", iso: todayIso });
  }
  if (isAllowed(tomorrowIso)) {
    presets.push({ key: "tomorrow", label: ar ? "غداً" : "Tomorrow", iso: tomorrowIso });
  }
  if (isAllowed(plus7Iso)) {
    presets.push({ key: "plus7", label: ar ? "+7 أيام" : "+7 Days", iso: plus7Iso });
  }
  if (isAllowed(plus30Iso)) {
    presets.push({ key: "plus30", label: ar ? "+30 يوم" : "+30 Days", iso: plus30Iso });
  }

  // Year options for the year selector
  const yearOptions = React.useMemo(() => {
    const cYear = new Date().getFullYear();
    const start = minDate ? minDate.getFullYear() : cYear - 80;
    const end = maxDate ? maxDate.getFullYear() : cYear + 15;
    const list: number[] = [];
    const high = Math.max(end, cYear + 10);
    const low = Math.min(start, cYear - 70);
    for (let y = high; y >= low; y--) {
      list.push(y);
    }
    return list;
  }, [minDate, maxDate]);

  const monthsList = ar ? MONTHS_AR : MONTHS_EN;

  return (
    <div className={cn("relative inline-block w-full min-w-[140px]", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverAnchor asChild>
          <div className="relative flex items-center w-full group/dateinput">
            {/* Native text input with auto-formatting */}
            <Input
              id={id}
              value={text}
              disabled={disabled}
              required={required}
              placeholder={placeholder || (ar ? "يوم/شهر/سنة" : "dd/mm/yyyy")}
              inputMode="numeric"
              dir="ltr"
              className={cn(
                "w-full h-9 rounded-xl border border-input bg-background pl-9 pr-14 text-sm font-mono tabular-nums transition-all duration-150",
                "hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary shadow-xs",
                disabled && "opacity-50 cursor-not-allowed",
                value && "font-semibold text-foreground",
              )}
              onClick={() => {
                if (!disabled) setOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const iso = parseDMY(text, min, max);
                  if (iso) {
                    onChange?.(iso);
                    setOpen(false);
                  }
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={handleBlur}
            />

            {/* Left Calendar Trigger Button */}
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              onClick={() => {
                if (!disabled) setOpen((prev) => !prev);
              }}
              className="absolute left-2.5 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors cursor-pointer disabled:cursor-not-allowed"
              title={ar ? "فتح التقويم" : "Open calendar"}
              aria-label="Open calendar"
            >
              <CalendarIcon className="w-4 h-4 text-primary/70 group-hover/dateinput:text-primary transition-colors" />
            </button>

            {/* Right Quick Controls: Clear (X) + Toggle */}
            <div className="absolute right-1.5 flex items-center gap-0.5">
              {value && !disabled && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title={ar ? "مسح التاريخ" : "Clear date"}
                  aria-label="Clear date"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                tabIndex={-1}
                disabled={disabled}
                onClick={() => {
                  if (!disabled) setOpen((prev) => !prev);
                }}
                className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
                title={ar ? "عرض التقويم" : "Toggle calendar"}
                aria-label="Toggle calendar"
              >
                <ChevronRight className={cn("w-3.5 h-3.5 rotate-90 text-muted-foreground", open && "-rotate-90")} />
              </button>
            </div>
          </div>
        </PopoverAnchor>

        <PopoverContent
          className="w-auto p-0 rounded-2xl shadow-2xl border border-border/70 bg-popover overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 select-none"
          align="start"
          sideOffset={6}
        >
          {/* 1. Quick Presets Pills Bar */}
          {presets.length > 0 && (
            <div className="flex items-center gap-1.5 p-2 bg-muted/40 border-b border-border/50 overflow-x-auto scrollbar-none">
              {presets.map((p) => {
                const isSelected = value === p.iso;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      applyISO(p.iso);
                      setOpen(false);
                    }}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-150 shrink-0",
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs shadow-primary/25"
                        : "bg-background/90 hover:bg-primary/10 hover:text-primary text-muted-foreground border border-border/60",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    handleClear();
                    setOpen(false);
                  }}
                  className="px-2 py-1 text-xs font-medium rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 transition-all shrink-0 ms-auto"
                >
                  {ar ? "مسح" : "Clear"}
                </button>
              )}
            </div>
          )}

          {/* 2. Sleek Month & Year Navigation Header with Steppers */}
          <div className="flex items-center justify-between gap-1 px-3 py-2 border-b border-border/40 bg-background/50">
            {/* Previous Year & Month Steppers */}
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                onClick={() => setCurrentMonth((prev) => subYears(prev, 1))}
                title={ar ? "السنة السابقة (-1)" : "Previous Year (-1)"}
              >
                <ChevronsLeft className={cn("w-4 h-4", ar && "rotate-180")} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                title={ar ? "الشهر السابق (-1)" : "Previous Month (-1)"}
              >
                <ChevronLeft className={cn("w-4 h-4", ar && "rotate-180")} />
              </Button>
            </div>

            {/* Centered Month & Year Dropdowns */}
            <div className="flex items-center gap-1.5 font-medium text-xs">
              {/* Month Selector */}
              <select
                value={currentMonth.getMonth()}
                onChange={(e) => {
                  const m = parseInt(e.target.value, 10);
                  setCurrentMonth((prev) => setMonthIndex(prev, m));
                }}
                className="h-7 px-1.5 rounded-lg border border-border/70 bg-background text-foreground font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:border-primary/50 transition-colors"
              >
                {monthsList.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Year Selector */}
              <select
                value={currentMonth.getFullYear()}
                onChange={(e) => {
                  const y = parseInt(e.target.value, 10);
                  setCurrentMonth((prev) => setYearValue(prev, y));
                }}
                className="h-7 px-1.5 rounded-lg border border-border/70 bg-background text-foreground font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:border-primary/50 transition-colors"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Next Month & Year Steppers */}
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                title={ar ? "الشهر القادم (+1)" : "Next Month (+1)"}
              >
                <ChevronRight className={cn("w-4 h-4", ar && "rotate-180")} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                onClick={() => setCurrentMonth((prev) => addYears(prev, 1))}
                title={ar ? "السنة القادمة (+1)" : "Next Year (+1)"}
              >
                <ChevronsRight className={cn("w-4 h-4", ar && "rotate-180")} />
              </Button>
            </div>
          </div>

          {/* 3. DayPicker Calendar Grid */}
          <div className="p-2 flex justify-center">
            <Calendar
              mode="single"
              selected={selected}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={ar ? arEG : undefined}
              dir={ar ? "rtl" : "ltr"}
              disabled={(date) =>
                (minDate ? date < minDate : false) ||
                (maxDate ? date > maxDate : false)
              }
              onSelect={(d) => {
                if (!d) return;
                applyISO(toISODate(d));
                setOpen(false);
              }}
              components={{
                Nav: () => <span className="hidden" />,
                MonthCaption: () => <span className="hidden" />,
              }}
              className="p-1"
            />
          </div>

          {/* 4. Bottom Information & Jump-to-Today Footer */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-t border-border/40 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground truncate">
              <span className="font-semibold text-foreground/80">
                {ar ? "المحدد:" : "Selected:"}
              </span>
              <span className="font-mono font-medium text-foreground">
                {value ? formatDate(value, "—") : (ar ? "لم يحدد" : "None")}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 rounded-md"
              onClick={() => {
                const now = new Date();
                setCurrentMonth(now);
                if (isAllowed(todayIso)) {
                  applyISO(todayIso);
                  setOpen(false);
                }
              }}
            >
              {ar ? "اليوم" : "Today"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

