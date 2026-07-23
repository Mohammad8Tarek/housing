import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";
import { formatZodError } from "../utils/error-response.js";

export interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

function getLang(req: Request): boolean {
  const lang = (req.headers["accept-language"] ?? "").toLowerCase();
  return lang.startsWith("ar");
}

export function notFoundHandler(req: Request, res: Response): void {
  const ar = getLang(req);
  res
    .status(404)
    .json({
      success: false,
      message: ar ? "المسار غير موجود" : "Route not found",
    });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const ar = getLang(req);

  if (err instanceof ZodError) {
    const message = formatZodError(err, ar);
    logger.warn({ url: req.url, errors: err.errors }, "Zod validation error");
    res.status(400).json({ success: false, message });
    return;
  }

  const error = err instanceof Error ? err : new Error(String(err));
  const status =
    (err as HttpError).status ?? (err as HttpError).statusCode ?? 500;

  logger.error(
    {
      err: { message: error.message, stack: error.stack, status },
      url: req.url,
      method: req.method,
    },
    status >= 500 ? "Internal server error" : "Request error",
  );

  if (status >= 500) {
    res.status(status).json({
      success: false,
      message: ar ? "حدث خطأ في السيرفر" : "Internal server error",
    });
    return;
  }

  res.status(status).json({
    success: false,
    message: error.message || (ar ? "حدث خطأ" : "Request error"),
  });
}
