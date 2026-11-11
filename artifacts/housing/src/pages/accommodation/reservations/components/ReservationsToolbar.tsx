import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColumnChooser } from "@/components/ui/column-chooser";
import { Search } from "lucide-react";
import { RES_COLS } from "../utils";

interface ReservationsToolbarProps {
  ar: boolean;
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  resVisible: Set<string>;
  resToggle: (key: string, checked: boolean) => void;
  resShowAll: () => void;
  resHideAll: () => void;
  exportResExcel: () => void;
}

export function ReservationsToolbar({
  ar,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  resVisible,
  resToggle,
  resShowAll,
  resHideAll,
  exportResExcel,
}: ReservationsToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
        <Input
          className="pl-9 rtl:pr-9 rtl:pl-3"
          placeholder={ar ? "بحث..." : "Search..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder={ar ? "حالة الحجز" : "Reservation Status"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="UPCOMING">
            {ar ? "الحجوزات المستقبلية" : "Future Reservations"}
          </SelectItem>
          <SelectItem value="CHECKED_IN">
            {ar ? "تم التسكين" : "Checked In"}
          </SelectItem>
          <SelectItem value="COMPLETED">
            {ar ? "منتهي" : "Completed"}
          </SelectItem>
          <SelectItem value="CANCELLED">{ar ? "ملغي" : "Cancelled"}</SelectItem>
          <SelectItem value="all">
            {ar ? "كل الحالات" : "All Statuses"}
          </SelectItem>
        </SelectContent>
      </Select>
      <ColumnChooser
        cols={RES_COLS}
        visible={resVisible}
        onToggle={resToggle}
        onShowAll={resShowAll}
        onHideAll={resHideAll}
        ar={ar}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={exportResExcel}
        className="h-10"
      >
        {ar ? "تصدير" : "Export"}
      </Button>
    </div>
  );
}
