// Values each report's header/cell renderers can read from ReportTable.
import type { ReactNode } from "react";

export interface ReportTableCtx {
  ar: any;
  H: (sortKey: string, label: ReactNode, className?: string) => ReactNode;
  isVis: (key: string) => boolean;
  activeTab: any;
  inventoryViewMode: any;
  floorMap: any;
  buildingMap: any;
  empMap: any;
  roomMap: any;
  waterCheckState: any;
  toggleWaterCheck: (key: string, val: boolean) => void;
  setSelectedItemRooms: any;
  selectedRows: any;
  allData: any;
  paginatedData: any;
  sort: any;
  visibleCols: any;
}

export interface ReportRowCtx extends ReportTableCtx {
  row: any;
  idx: number;
  isSelected: boolean;
}
