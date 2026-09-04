import * as React from "react";
import {
  formatDMY,
  isoToDate,
  parseDMY,
  toISODate,
} from "@workspace/dates";
import MaterialIcon from "./MaterialIcon";

type PortalDateInputProps = {
  /** ISO calendar date "YYYY-MM-DD" (or "" when empty). */
  value?: string;
  onChange?: (iso: string) => void;
  /** ISO bounds "YYYY-MM-DD". */
  min?: string;
  max?: string;
  placeholder?: string;
  /** Classes for the visible text field. */
  className?: string;
  disabled?: boolean;
  required?: boolean;
};

/**
 * Canonical date input for the employee portal.
 * Always displays Day/Month/Year (DD/MM/YYYY) while storing ISO "YYYY-MM-DD".
 * Typing is parsed locally; the calendar icon opens the native picker
 * (best calendar UX on mobile) reusing the same canonical logic.
 */
export default function PortalDateInput({
  value = "",
  onChange,
  min,
  max,
  placeholder = "DD/MM/YYYY",
  className = "",
  disabled,
  required,
}: PortalDateInputProps) {
  const [text, setText] = React.useState(() =>
    value ? formatDMY(value, "") : "",
  );
  const nativeRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setText(value ? formatDMY(value, "") : "");
  }, [value]);

  const commitText = (next: string) => {
    setText(next);
    if (!next.trim()) {
      onChange?.("");
      return;
    }
    const iso = parseDMY(next, min, max);
    if (iso) onChange?.(iso);
  };

  const openPicker = () => {
    const el = nativeRef.current;
    if (!el || disabled) return;
    try {
      if (typeof el.showPicker === "function") el.showPicker();
      else {
        el.focus();
        el.click();
      }
    } catch {
      el.focus();
    }
  };

  return (
    <div className="relative">
      <input
        value={text}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        inputMode="numeric"
        dir="ltr"
        onChange={(e) => commitText(e.target.value)}
        onBlur={() => setText(value ? formatDMY(value, "") : "")}
        className={`${className} text-left tabular-nums pe-11`}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label="Pick a date"
        className="absolute end-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity"
      >
        <MaterialIcon icon="calendar_month" size={20} />
      </button>
      <input
        ref={nativeRef}
        type="date"
        aria-hidden
        tabIndex={-1}
        value={isoToDate(value) ? value : ""}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const iso = (e.target.value || "").slice(0, 10);
          if (!iso) return;
          if (min && iso < min) return;
          if (max && iso > max) return;
          onChange?.(iso);
        }}
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          width: 1,
          height: 1,
        }}
      />
    </div>
  );
}
