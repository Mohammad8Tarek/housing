import type { Request, Response, NextFunction } from "express";
import { filterXSS } from "xss";

const xssOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "noscript"],
};

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return filterXSS(value, xssOptions);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) sanitized[k] = sanitizeValue(v);
    return sanitized;
  }
  return value;
}

export function xssSanitize(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.body && typeof req.body === "object")
    req.body = sanitizeValue(req.body);
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      req.query[key] = sanitizeValue(req.query[key]) as any;
    }
  }
  if (req.params) {
    for (const key of Object.keys(req.params)) {
      req.params[key] = sanitizeValue(req.params[key]) as any;
    }
  }
  next();
}
