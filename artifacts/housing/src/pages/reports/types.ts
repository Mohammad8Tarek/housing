import { ReactNode } from "react";

export type Tab =
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
