import { TooltipProvider } from "@/components/ui/tooltip";
import {
  usePermissionMatrixCenterState,
  buildPermissionMatrixCenterView,
} from "./permission-matrix/usePermissionMatrixCenterState";
import { renderMatrixHeader } from "./permission-matrix/MatrixHeader";
import { renderRolePresetsBar } from "./permission-matrix/RolePresetsBar";
import { renderCardsView } from "./permission-matrix/CardsView";
import { renderTableView } from "./permission-matrix/TableView";
import { renderMatrixLegend } from "./permission-matrix/MatrixLegend";
import { PermissionMatrixCenterProps } from "./permission-matrix/PermissionMatrixCenter.constants";

export function PermissionMatrixCenter(props: PermissionMatrixCenterProps) {
  const s = usePermissionMatrixCenterState(props);
  const { ar, activeUser, viewMode } = s;

  if (!activeUser) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        {ar ? "لا يوجد مستخدمون متاحون" : "No users available"}
      </div>
    );
  }
  const v = buildPermissionMatrixCenterView(s, activeUser);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* ── Executive Header: User Combobox Selector & Diff Dashboard ── */}
        {renderMatrixHeader(s, v)}

        {/* ── Toolbar: Presets, Bulk Controls, View Mode Toggle & Search ── */}
        {renderRolePresetsBar(s, v)}

        {/* ── View 1: Visual Card Grid View ── */}
        {viewMode === "cards" && renderCardsView(s, v)}

        {/* ── View 2: Interactive Matrix Spreadsheet Table View ── */}
        {viewMode === "table" && renderTableView(s, v)}

        {/* ── Floating / Sticky Save Bar ── */}
        {renderMatrixLegend(s, v)}
      </div>
    </TooltipProvider>
  );
}
