// Module-level constants/types of UserDetailPage (moved verbatim).
import { SYSTEM_ROLES, WORKFLOW_ROLES } from "../utils";

export const ALL_ROLES = [...SYSTEM_ROLES, ...WORKFLOW_ROLES];

export type ActiveTab =
  | "profile"
  | "permissions"
  | "properties"
  | "signature"
  | "audit";
