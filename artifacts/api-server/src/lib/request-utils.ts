export function getTenantId(req: any): number {
  return (
    Number(req.query?.propertyId) ||
    Number(req.body?.propertyId) ||
    Number(req.session?.propertyId) ||
    Number(req.session?.portal?.propertyId) ||
    0
  );
}

export function su(req: any) {
  return {
    username: req?.session?.username ?? "system",
    userId: req?.session?.userId,
    userRole: req?.session?.userRole,
  };
}

/**
 * Block a non-system-admin from acting on a record that lives in a hotel they
 * are not a member of. Handlers that resolve the owning property from a record
 * id (find*AcrossAllProperties) MUST call this with the resolved propertyId
 * before reading or writing it — otherwise `requirePermission` only checks the
 * caller's OWN property and cross-tenant access slips through.
 *
 * Returns false (and sends HTTP 403) when access is denied; true otherwise.
 * System admins and sessions with no explicit propertyIds are allowed through,
 * matching the existing reservations/assignments guards.
 */
export function assertPropertyAccess(
  req: any,
  res: any,
  propertyId: number,
): boolean {
  const authUser = req?.authUser;
  if (
    authUser &&
    !authUser.isSystemAdmin &&
    Array.isArray(authUser.propertyIds) &&
    authUser.propertyIds.length > 0 &&
    !authUser.propertyIds.includes(Number(propertyId))
  ) {
    res.status(403).json({ error: "Access denied to this hotel's data" });
    return false;
  }
  return true;
}
