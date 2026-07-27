import { ReactNode } from "react";

export type Tab =
  | "analytics"
  | "housing"
  | "employees"
  | "assignments"
  | "hostings"
  | "maintenance"
  | "reservations";

export interface TabConfig {
  id: Tab;
  label: string;
  labelAr: string;
  icon: ReactNode;
}
