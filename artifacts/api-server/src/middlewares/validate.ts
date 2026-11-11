import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

/**
 * validate — Zod request validation middleware.
 *
 * Parses `req.body`, `req.query` and/or `req.params` against the supplied
 * schemas and replaces them with the parsed (coerced, trimmed, defaulted)
 * values. A failed parse throws a ZodError which the global errorHandler
 * turns into a bilingual HTTP 400 response.
 *
 * Usage:
 *   router.post("/x", requirePermission(...), validate({ body: CreateXBody }), handler)
 */
export interface ValidateSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: ValidateSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body ?? {});
      }
      if (schemas.params) {
        req.params = schemas.params.parse(
          req.params ?? {},
        ) as typeof req.params;
      }
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query ?? {});
        // Express 5 exposes req.query through a prototype getter, so shadow it
        // on the instance instead of assigning through the getter.
        Object.defineProperty(req, "query", {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
