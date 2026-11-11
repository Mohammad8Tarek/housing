import type { Property } from "@workspace/api-client-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

/** محدد فندق التسكين المستهدف */
export function TargetPropertySelect({
  ar,
  allProperties,
  activePropertyId,
  targetPropertyId,
  onChange,
}: {
  ar: boolean;
  allProperties: Property[];
  activePropertyId: number | "all" | undefined;
  targetPropertyId: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
        {ar ? "فندق التسكين:" : "Target Hotel:"}
      </span>
      <Select
        value={targetPropertyId || String(activePropertyId ?? "")}
        onValueChange={onChange}
      >
        <SelectTrigger className="h-8 w-48 text-xs font-semibold">
          <SelectValue
            placeholder={ar ? "اختر الفندق..." : "Select Hotel..."}
          />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={4}>
          {allProperties.map((p) => (
            <SelectItem key={p.id} value={String(p.id)} className="text-xs">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>{p.name}</span>
                {p.id === activePropertyId && (
                  <Badge
                    variant="secondary"
                    className="text-[9px] py-0 px-1 ml-1 rtl:mr-1"
                  >
                    {ar ? "الحالي" : "Current"}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
