import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { DataPagination } from "@/components/DataPagination";
import { InHouseTableRow, type RowActions } from "./InHouseTableRow";
import type { LookupMaps } from "../utils/profile-helpers";

type Props = LookupMaps & {
  ar: boolean;
  isLoading: boolean;
  assignments: any[];
  total: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  selectedRows: Set<number>;
  allPageSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleRow: (id: number) => void;
  visibleColumns: Set<string>;
  isIHVisible: (key: string) => boolean;
  actions: RowActions;
};

export function InHouseTable({
  ar,
  isLoading,
  assignments,
  total,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
  selectedRows,
  allPageSelected,
  onToggleSelectAll: toggleSelectAll,
  onToggleRow,
  visibleColumns: ihVisible,
  isIHVisible,
  empMap,
  roomMap,
  buildingMap,
  floorMap,
  actions,
}: Props) {
  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="border rounded-xl bg-card overflow-hidden overflow-x-auto shadow-xs">
      <Table className="w-full">
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-10 px-3">
              <Checkbox
                checked={allPageSelected}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            {isIHVisible("profile") && (
              <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider min-w-[200px]">
                {ar ? "الموظف" : "Resident"}
              </TableHead>
            )}
            {isIHVisible("building") && (
              <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider min-w-[130px]">
                {ar ? "المبنى والدور" : "Building & Floor"}
              </TableHead>
            )}
            {isIHVisible("room") && (
              <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider min-w-[120px]">
                {ar ? "الغرفة والسرير" : "Room & Bed"}
              </TableHead>
            )}
            {isIHVisible("checkin") && (
              <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider min-w-[110px]">
                {ar ? "تاريخ الدخول" : "Check-in"}
              </TableHead>
            )}
            {isIHVisible("expected") && (
              <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider min-w-[130px]">
                {ar ? "المغادرة المتوقعة" : "Expected Out"}
              </TableHead>
            )}
            {isIHVisible("personStatus") && (
              <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider min-w-[110px]">
                {ar ? "الحالة" : "Status"}
              </TableHead>
            )}
            {isIHVisible("actions") && (
              <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider w-24 text-center">
                {ar ? "إجراءات" : "Actions"}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((a: any) => (
            <InHouseTableRow
              key={a.id}
              a={a}
              ar={ar}
              isSelected={selectedRows.has(a.id)}
              onToggleRow={onToggleRow}
              isIHVisible={isIHVisible}
              empMap={empMap}
              roomMap={roomMap}
              buildingMap={buildingMap}
              floorMap={floorMap}
              actions={actions}
            />
          ))}
          {assignments.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={ihVisible.size + 1}
                className="py-12 text-center"
              >
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium text-muted-foreground">
                  {ar ? "لا توجد تعيينات نشطة" : "No active assignments"}
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {/* Total row */}
        {assignments.length > 0 && (
          <tfoot>
            <tr className="bg-muted/40 border-t font-semibold text-sm">
              <td colSpan={2} className="px-4 py-2 text-muted-foreground">
                {ar ? "الإجمالي" : "Total"}
              </td>
              <td
                colSpan={ihVisible.size}
                className="px-4 py-2 text-muted-foreground"
              >
                {assignments.length} {ar ? "مقيم" : "residents"}
                {selectedRows.size > 0 && (
                  <span className="ml-3 text-primary">
                    · {selectedRows.size} {ar ? "محدد" : "selected"}
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        )}
      </Table>
      {total > 0 && (
        <DataPagination
          total={total}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
