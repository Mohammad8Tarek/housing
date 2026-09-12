import { ReactNode } from "react";

export type Tab =
  | "manager_flash"
  | "arrivals_manifest"
  | "departures_manifest"
  | "housekeeping_sheet"
  | "room_discrepancy"
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
  | "equipment_inventory";

export interface TabConfig {
  id: Tab;
  label: string;
  labelAr: string;
  icon: ReactNode;
}
