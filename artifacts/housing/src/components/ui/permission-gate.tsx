// @ts-nocheck
import type { ReactNode } from "react";
import { usePermission } from "@/hooks/use-permission";
import type { Module, Action } from "@/lib/permissions";

interface PermissionGateProps {
  module?: Module;
  action?: Action;
  anyPermission?: [Module, Action][];
  /** Fallback to render if permission is denied. Defaults to null. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders `children` only when the current user has `module.action` permission
 * or any permission listed in `anyPermission`.
 * Use `fallback` to show a disabled state or nothing.
 *
 * @example
 * <PermissionGate module="users" action="create">
 *   <Button>Add User</Button>
 * </PermissionGate>
 * 
 * <PermissionGate anyPermission={[["maintenance", "delete"], ["housekeeping", "delete"]]}>
 *   <Button>Delete</Button>
 * </PermissionGate>
 */
export function PermissionGate({
  module,
  action,
  anyPermission,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can } = usePermission();
  if (anyPermission && anyPermission.length > 0) {
    if (!anyPermission.some(([m, a]) => can(m, a))) return <>{fallback}</>;
    return <>{children}</>;
  }
  if (module && action) {
    if (!can(module, action)) return <>{fallback}</>;
  }
  return <>{children}</>;
}
