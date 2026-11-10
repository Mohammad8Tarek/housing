// Tab → row builder registry for the Reports page.
import type { Tab } from "../../types";
import type { ReportProcessorContext } from "./context";
import {
  processManagerFlash,
  processArrivalsManifest,
  processDeparturesManifest,
  processHousekeepingSheet,
  processRoomDiscrepancy,
  processDailyMovement,
} from "./operations";
import {
  processOccupancyForecast,
  processAssignments,
  processVacantRooms,
  processDepartmentOccupancy,
} from "./occupancy";
import { processHousing, processHousingMap } from "./rooms";
import {
  processProfiles,
  processExpiringContracts,
  processReservations,
  processHostings,
  processVacations,
} from "./residents";
import {
  processMaintenance,
  processHousekeeping,
  processEquipmentInventory,
  processWaterDistribution,
} from "./services";
import { processGateLogs, processPoliceReport } from "./security";
import { processPolicyExceptions } from "./policy-exceptions";

export type { ReportProcessorContext } from "./context";
export { matchesRoomType, matchesGender } from "./context";

export const REPORT_PROCESSORS: Partial<
  Record<Tab, (ctx: ReportProcessorContext) => any[]>
> = {
  manager_flash: processManagerFlash,
  arrivals_manifest: processArrivalsManifest,
  departures_manifest: processDeparturesManifest,
  housekeeping_sheet: processHousekeepingSheet,
  room_discrepancy: processRoomDiscrepancy,
  daily_movement: processDailyMovement,
  occupancy_forecast: processOccupancyForecast,
  assignments: processAssignments,
  vacant_rooms: processVacantRooms,
  housing: processHousing,
  department_occupancy: processDepartmentOccupancy,
  housing_map: processHousingMap,
  profiles: processProfiles,
  expiring_contracts: processExpiringContracts,
  reservations: processReservations,
  hostings: processHostings,
  vacations: processVacations,
  maintenance: processMaintenance,
  housekeeping: processHousekeeping,
  equipment_inventory: processEquipmentInventory,
  water_distribution: processWaterDistribution,
  gate_logs: processGateLogs,
  police_report: processPoliceReport,
  policy_exceptions: processPolicyExceptions,
};
