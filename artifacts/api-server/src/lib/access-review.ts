// What the server really grants a user, expressed as catalogue permission
// keys ("module.action"). Used by the access review screen.
import {
  MODULE_ACTIONS,
  PERMISSION_MODULES,
  effectivePermissions,
} from "../middlewares/permissions.js";
import { isRootUser } from "./user-access.js";

/** Every permission key the system knows, in catalogue order. */
export const ALL_PERMISSIONS: string[] = PERMISSION_MODULES.flatMap((m) =>
  (MODULE_ACTIONS[m] ?? []).map((a) => `${m}.${a}`),
);

export function grantedPermissions(u: {
  id: number;
  username: string;
  roles: string[] | null;
  permissions: string[] | null;
  propertyId: number | null;
  propertyIds: number[] | null;
}): { root: boolean; granted: string[] } {
  const root = isRootUser(u);
  const eff = effectivePermissions({
    ...u,
    roles: (u.roles ?? []).map((r) => String(r).trim().toLowerCase()),
    permissions: u.permissions ?? [],
    propertyIds: u.propertyIds ?? [],
    isSystemAdmin: root,
  });
  if (eff.has("*")) return { root: true, granted: ALL_PERMISSIONS };
  return { root, granted: ALL_PERMISSIONS.filter((p) => eff.has(p)) };
}
