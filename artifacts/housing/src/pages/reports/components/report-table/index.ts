// Tab → { header, cells } registry for ReportTable.
import type { ReactNode } from "react";
import type { Tab } from "../../types";
import type { ReportTableCtx, ReportRowCtx } from "./context";
import {
  ManagerFlashHeader,
  ManagerFlashCells,
  ArrivalsManifestHeader,
  ArrivalsManifestCells,
  DeparturesManifestHeader,
  DeparturesManifestCells,
  HousekeepingSheetHeader,
  HousekeepingSheetCells,
  RoomDiscrepancyHeader,
  RoomDiscrepancyCells,
  DailyMovementHeader,
  DailyMovementCells,
} from "./operations";
import {
  OccupancyForecastHeader,
  OccupancyForecastCells,
  AssignmentsHeader,
  AssignmentsCells,
  VacantRoomsHeader,
  VacantRoomsCells,
  DepartmentOccupancyHeader,
  DepartmentOccupancyCells,
} from "./occupancy";
import { HousingHeader, HousingCells } from "./rooms";
import {
  ProfilesHeader,
  ProfilesCells,
  ExpiringContractsHeader,
  ExpiringContractsCells,
  ReservationsHeader,
  ReservationsCells,
  HostingsHeader,
  HostingsCells,
  VacationsHeader,
  VacationsCells,
} from "./residents";
import {
  MaintenanceHeader,
  MaintenanceCells,
  HousekeepingHeader,
  HousekeepingCells,
  EquipmentInventoryHeader,
  EquipmentInventoryCells,
  WaterDistributionHeader,
  WaterDistributionCells,
} from "./services";
import {
  GateLogsHeader,
  GateLogsCells,
  PoliceReportHeader,
  PoliceReportCells,
} from "./security";
import {
  PolicyExceptionsHeader,
  PolicyExceptionsCells,
} from "./policy-exceptions";

export type { ReportTableCtx, ReportRowCtx } from "./context";

export const REPORT_TABLE_COLUMNS: Partial<
  Record<
    Tab,
    {
      header: (c: ReportTableCtx) => ReactNode;
      cells: (c: ReportRowCtx) => ReactNode;
    }
  >
> = {
  manager_flash: { header: ManagerFlashHeader, cells: ManagerFlashCells },
  arrivals_manifest: {
    header: ArrivalsManifestHeader,
    cells: ArrivalsManifestCells,
  },
  departures_manifest: {
    header: DeparturesManifestHeader,
    cells: DeparturesManifestCells,
  },
  housekeeping_sheet: {
    header: HousekeepingSheetHeader,
    cells: HousekeepingSheetCells,
  },
  room_discrepancy: {
    header: RoomDiscrepancyHeader,
    cells: RoomDiscrepancyCells,
  },
  daily_movement: { header: DailyMovementHeader, cells: DailyMovementCells },
  occupancy_forecast: {
    header: OccupancyForecastHeader,
    cells: OccupancyForecastCells,
  },
  assignments: { header: AssignmentsHeader, cells: AssignmentsCells },
  vacant_rooms: { header: VacantRoomsHeader, cells: VacantRoomsCells },
  department_occupancy: {
    header: DepartmentOccupancyHeader,
    cells: DepartmentOccupancyCells,
  },
  housing: { header: HousingHeader, cells: HousingCells },
  profiles: { header: ProfilesHeader, cells: ProfilesCells },
  expiring_contracts: {
    header: ExpiringContractsHeader,
    cells: ExpiringContractsCells,
  },
  reservations: { header: ReservationsHeader, cells: ReservationsCells },
  hostings: { header: HostingsHeader, cells: HostingsCells },
  vacations: { header: VacationsHeader, cells: VacationsCells },
  maintenance: { header: MaintenanceHeader, cells: MaintenanceCells },
  housekeeping: { header: HousekeepingHeader, cells: HousekeepingCells },
  equipment_inventory: {
    header: EquipmentInventoryHeader,
    cells: EquipmentInventoryCells,
  },
  water_distribution: {
    header: WaterDistributionHeader,
    cells: WaterDistributionCells,
  },
  gate_logs: { header: GateLogsHeader, cells: GateLogsCells },
  police_report: { header: PoliceReportHeader, cells: PoliceReportCells },
  policy_exceptions: {
    header: PolicyExceptionsHeader,
    cells: PolicyExceptionsCells,
  },
};
