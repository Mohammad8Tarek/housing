// @ts-nocheck
import type { ReactNode } from "react";
import { usePermission } from "@/hooks/use-permission";
import type { Module, Action } from "@/lib/permissions";

interface PermissionGateProps {
  module: Module;
  action: Action;
  /** Fallback to render if permission is denied. Defaults to null. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders `children` only when the current user has `module.action` permission.
 * Use `fallback` to show a disabled state or nothing.
 *
 * @example
 * <PermissionGate module="users" action="create">
 *   <Button>Add User</Button>
 * </PermissionGate>
 */
export function PermissionGate({
  module,
  action,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can } = usePermission();
  if (!can(module, action)) return <>{fallback}</>;
  return <>{children}</>;
}
