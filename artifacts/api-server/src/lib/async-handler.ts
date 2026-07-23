import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * asyncHandler — wraps an async Express route handler to forward errors to next().
 *
 * Usage:
 *   router.get("/path", asyncHandler(async (req, res) => {
 *     const data = await fetchSomething();
 *     res.json(data);
 *   }));
 *
 * Any thrown error (including DB errors) is automatically forwarded to the global
 * error handler instead of crashing the server or hanging the request.
 */
export const asyncHandler =
  (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
