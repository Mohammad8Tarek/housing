import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DebouncedSearchInputProps {
  /** External/authoritative value — used to seed the field and to reflect
   *  programmatic resets (e.g. "clear filters"). It is NOT written on every
   *  keystroke, so typing stays local and the parent re-renders only after the
   *  debounce fires. */
  value?: string;
  /** Called with the trimmed-friendly raw text after `delay` ms of no typing. */
  onDebouncedChange: (value: string) => void;
  delay?: number;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  "aria-label"?: string;
  autoFocus?: boolean;
}

/**
 * A search box that debounces internally. The text being typed lives in this
 * component's own state, so keystrokes re-render only the input — the heavy
 * parent (its data table) re-renders once, after the user stops typing. This
 * removes the per-keystroke jank that a page-level `useState` + `useDebounce`
 * causes, while keeping the field fully responsive while typing.
 */
export function DebouncedSearchInput({
  value = "",
  onDebouncedChange,
  delay = 300,
  placeholder,
  className,
  inputClassName,
  autoFocus,
  ...rest
}: DebouncedSearchInputProps) {
  const [text, setText] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onDebouncedChange);
  const lastEmitted = useRef(value);

  useEffect(() => {
    onChangeRef.current = onDebouncedChange;
  }, [onDebouncedChange]);

  // Reflect an external change (reset, URL sync) without clobbering what the
  // user is actively typing: only adopt `value` when it differs from the last
  // value we emitted ourselves.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const schedule = (next: string) => {
    setText(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastEmitted.current = next;
      onChangeRef.current(next);
    }, delay);
  };

  const clearNow = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setText("");
    lastEmitted.current = "";
    onChangeRef.current("");
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        value={text}
        onChange={(e) => schedule(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn("px-9", inputClassName)}
        aria-label={rest["aria-label"] ?? placeholder}
      />
      {text && (
        <button
          type="button"
          onClick={clearNow}
          aria-label="Clear search"
          className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
