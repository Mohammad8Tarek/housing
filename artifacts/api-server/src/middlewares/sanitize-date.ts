import { Request, Response, NextFunction } from "express";
import { toDate } from "../utils/date.js";

const DATE_FIELDS = [
  "createdAt",
  "updatedAt",
  "completedAt",
  "reportedAt",
  "startedAt",
  "resolvedAt",
];

export function sanitizeDates(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.body) return next();

  for (const key of DATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, key) && req.body[key]) {
      req.body[key] = toDate(req.body[key]);
    }
  }

  next();
}
