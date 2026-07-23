import type { Request } from "express";

export function getTenantId(req: any): number {
  return (
    Number(req.query?.propertyId) ||
    Number(req.body?.propertyId) ||
    Number(req.session?.propertyId) ||
    0
  );
}

export function su(req: any) {
  return {
    username: req.session?.username ?? "system",
    userId: req.session?.userId,
    userRole: req.session?.userRole,
  };
}
