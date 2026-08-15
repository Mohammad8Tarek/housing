import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Debounce delay in milliseconds. When set, onChange fires only after the user stops typing for this duration. */
  debounceMs?: number;
  autoFocus?: boolean;
}

export function SearchInput({
  placeholder = "Search...",
  value,
  onChange,
  className,
  debounceMs,
  autoFocus = false,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync external value changes (e.g. programmatic resets)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const emitChange = useCallback(
    (newValue: string) => {
      if (debounceMs && debounceMs > 0) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          onChangeRef.current(newValue);
        }, debounceMs);
      } else {
        onChangeRef.current(newValue);
      }
    },
    [debounceMs],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      emitChange(newValue);
    },
    [emitChange],
  );

  const handleClear = useCallback(() => {
    setLocalValue("");
    // Clear fires immediately (no debounce for clear action)
    if (timerRef.current) clearTimeout(timerRef.current);
    onChangeRef.current("");
  }, []);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        autoFocus={autoFocus}
        className="pl-9 pr-8"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
