// Shared language + send-time controls for the nightly report cards
// (maintenance and housing). The time is Cairo wall-clock; minutes step by 5
// to match the dispatcher that checks every five minutes.
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const pad = (n: number) => String(n).padStart(2, "0");

export function ReportDeliveryControls({
  ar,
  lang,
  hour,
  minute,
  onLang,
  onHour,
  onMinute,
  idPrefix,
}: {
  ar: boolean;
  lang: "ar" | "en";
  hour: number;
  minute: number;
  onLang: (v: "ar" | "en") => void;
  onHour: (v: number) => void;
  onMinute: (v: number) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-lang`} className="text-sm">
          {ar ? "لغة التقرير" : "Report language"}
        </Label>
        <Select value={lang} onValueChange={(v) => onLang(v as "ar" | "en")}>
          <SelectTrigger id={`${idPrefix}-lang`} className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="ar">العربية</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-hour`} className="text-sm">
          {ar ? "الساعة (القاهرة)" : "Hour (Cairo)"}
        </Label>
        <Select value={String(hour)} onValueChange={(v) => onHour(Number(v))}>
          <SelectTrigger id={`${idPrefix}-hour`} className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {Array.from({ length: 24 }, (_, h) => (
              <SelectItem key={h} value={String(h)}>
                {pad(h)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-minute`} className="text-sm">
          {ar ? "الدقيقة" : "Minute"}
        </Label>
        <Select
          value={String(minute)}
          onValueChange={(v) => onMinute(Number(v))}
        >
          <SelectTrigger id={`${idPrefix}-minute`} className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {Array.from({ length: 12 }, (_, i) => i * 5).map((mm) => (
              <SelectItem key={mm} value={String(mm)}>
                {pad(mm)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
