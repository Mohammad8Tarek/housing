// Which users an actor may view or change. System admins (super_admin /
// system_admin / isSystemAdmin) may act on anyone. Everyone else only on
// users that share one of their properties and are not admins themselves
// (admin, super_admin, system_admin), plus themselves.

const ROOT_ROLES = ["super_admin", "system_admin"];
const ADMIN_ROLES = [...ROOT_ROLES, "admin"];

type UserLike = {
  id?: number | null;
  roles?: string[] | null;
  isSystemAdmin?: boolean | null;
  propertyId?: number | null;
  propertyIds?: number[] | null;
};

const lowerRoles = (u: UserLike) =>
  (u.roles ?? []).map((r) => String(r).trim().toLowerCase());

export const isRootUser = (u: UserLike | null | undefined): boolean =>
  !!u &&
  (!!u.isSystemAdmin || lowerRoles(u).some((r) => ROOT_ROLES.includes(r)));

const propertiesOf = (u: UserLike): number[] =>
  [...(u.propertyIds ?? []), u.propertyId]
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

/**
 * @param mode "view" ignores the target's role (a manager may see an admin of
 *             their hotel); "manage" also refuses admin targets.
 */
export function canActOnUser(
  actor: UserLike | null | undefined,
  target: UserLike,
  mode: "view" | "manage",
): boolean {
  if (!actor) return false;
  if (isRootUser(actor)) return true;
  if (actor.id != null && target.id != null && actor.id === target.id) {
    return true;
  }
  if (isRootUser(target)) return false;
  if (
    mode === "manage" &&
    lowerRoles(target).some((r) => ADMIN_ROLES.includes(r))
  ) {
    return false;
  }
  const mine = new Set(propertiesOf(actor));
  return propertiesOf(target).some((p) => mine.has(p));
}
