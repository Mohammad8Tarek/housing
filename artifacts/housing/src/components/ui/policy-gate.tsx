import type { ReactNode } from "react";
import { usePolicy, type PolicyAction, type PolicySubject } from "@/hooks/use-policy";

export interface PolicyGateProps {
  action: PolicyAction;
  subject: PolicySubject;
  resource?: any;
  /** Fallback to render if policy check fails. Defaults to null. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * CASL-style PolicyGate that evaluates granular subject/resource permissions
 *
 * @example
 * <PolicyGate action="edit" subject="Ticket" resource={ticket}>
 *   <Button>Edit Ticket</Button>
 * </PolicyGate>
 */
export function PolicyGate({
  action,
  subject,
  resource,
  fallback = null,
  children,
}: PolicyGateProps) {
  const ability = usePolicy();

  if (!ability.can(action, subject, resource)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
