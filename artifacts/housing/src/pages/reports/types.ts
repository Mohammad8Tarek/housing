import { ReactNode } from "react";

export type Tab =
  | "manager_flash"
  | "arrivals_manifest"
  | "departures_manifest"
  | "housekeeping_sheet"
  | "room_discrepancy"
  | "occupancy_forecast"
  | "analytics"
  | "assignments"
  | "vacant_rooms"
  | "housing"
  | "profiles"
  | "expiring_contracts"
  | "reservations"
  | "hostings"
  | "maintenance"
  | "housekeeping"
  | "equipment_inventory"
  | "daily_movement"
  | "department_occupancy"
  | "gate_logs"
  | "service_ratings"
  | "housing_map"
  | "water_distribution"
  | "police_report";

export interface TabConfig {
  id: Tab;
  label: string;
  labelAr: string;
  icon: ReactNode;
}
