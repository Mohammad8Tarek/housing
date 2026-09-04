import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatDate,
  isoToDate,
  parseDMY,
  toISODate,
} from "@/lib/date-utils";

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

/**
 * Year jump field replacing the endless native years <select> (~130 options).
 * Type any year (e.g. 1960) + Enter/blur to jump straight to it.
 * Receives the same props DayPicker gives its default YearsDropdown
 * ({ value, onChange }) — onChange consumes e.target.value like a select.
 */
function YearJump(props: any) {
  const currentYear = () => {
    const y = Number(props?.value ?? new Date().getFullYear());
    return Number.isFinite(y) ? y : new Date().getFullYear();
  };
  const [text, setText] = React.useState(String(currentYear()));

  React.useEffect(() => {
    setText(String(currentYear()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props?.value]);

  const commit = () => {
    const y = parseInt(text.replace(/\D/g, ""), 10);
    if (Number.isFinite(y) && y >= 1900 && y <= 2100) {
      props?.onChange?.({ target: { value: String(y) } });
    } else {
      setText(String(currentYear()));
    }
  };

  return (
    <input
      value={text}
      inputMode="numeric"
      dir="ltr"
      aria-label="Year"
      disabled={props?.disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      className="h-8 w-[4.5rem] rounded-md border border-input bg-transparent px-2 text-sm text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
    />
  );
}

/**
 * Canonical date input for the whole system.
 * Always displays Day/Month/Year (DD/MM/YYYY) while storing ISO "YYYY-MM-DD".
 * Users can type DD/MM/YYYY or pick from the calendar popup.
 */
export function DateInput({
  value = "",
  onChange,
  min,
  max,
  placeholder = "dd/mm/yyyy",
  className,
  disabled,
  required,
  id,
}: DateInputProps) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(() =>
    value ? formatDate(value, "") : "",
  );

  // Keep the text in sync when the value changes externally.
  React.useEffect(() => {
    setText(value ? formatDate(value, "") : "");
  }, [value]);

  const selected = isoToDate(value) ?? undefined;
  const minDate = isoToDate(min);
  const maxDate = isoToDate(max);

  const commitText = (next: string) => {
    setText(next);
    if (!next.trim()) {
      onChange?.("");
      return;
    }
    const iso = parseDMY(next, min, max);
    if (iso) onChange?.(iso);
  };

  return (
    <div className={cn("flex gap-1.5", className)}>
      <Input
        id={id}
        value={text}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        inputMode="numeric"
        dir="ltr"
        className="flex-1 text-left tabular-nums"
        onChange={(e) => commitText(e.target.value)}
        onBlur={() => setText(value ? formatDate(value, "") : "")}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            className="shrink-0"
            aria-label="Pick a date"
          >
            <CalendarIcon className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? minDate ?? maxDate ?? new Date()}
            captionLayout="dropdown"
            startMonth={new Date(new Date().getFullYear() - 120, 0)}
            endMonth={new Date(new Date().getFullYear() + 10, 11)}
            components={{ YearsDropdown: YearJump }}
            disabled={(date) =>
              (minDate ? date < minDate : false) ||
              (maxDate ? date > maxDate : false)
            }
            onSelect={(d) => {
              if (!d) return;
              onChange?.(toISODate(d));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
