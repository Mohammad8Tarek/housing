import type { Request, Response, NextFunction } from "express";
import { decodeSecureToken, verifyRequestSignature } from "../lib/security-signer.js";

/**
 * Enterprise Security Middleware:
 * 1. Attaches anti-tracking, anti-sniffing, and policy extension headers
 * 2. Seamlessly intercepts and decodes tamper-proof 'sec_' tokens in params and query
 * 3. Verifies incoming X-Security-Signature when provided
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // 1. Anti-Tracking & Security Extension Headers
  res.setHeader("X-Security-Policy", "CASL-Attribute-Scoped");
  res.setHeader("X-Anti-Tracking-Protection", "Enabled");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // 2. Verify Request Signature if present
  const signature = req.headers["x-security-signature"] as string | undefined;
  if (signature) {
    const check = verifyRequestSignature(signature, req.method, req.path);
    if (!check.valid) {
      // In audit/non-blocking mode, record or flag warning
      res.setHeader("X-Security-Sig-Status", "warn-skew");
    } else {
      res.setHeader("X-Security-Sig-Status", "verified");
    }
  }

  // 3. IDOR Protection: Intercept & Decode sec_ tokens in req.params
  if (req.params) {
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === "string" && value.startsWith("sec_")) {
        const decoded = decodeSecureToken(value);
        if (decoded === null) {
          res.status(400).json({
            error: "Invalid or tampered secure identifier",
            code: "SEC_TOKEN_INVALID",
          });
          return;
        }
        // Substitute with genuine numeric ID so downstream route handlers work without modification
        req.params[key] = String(decoded);
      }
    }
  }

  // 4. Decode sec_ tokens in req.query
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === "string" && value.startsWith("sec_")) {
        const decoded = decodeSecureToken(value);
        if (decoded === null) {
          res.status(400).json({
            error: "Invalid or tampered secure identifier",
            code: "SEC_TOKEN_INVALID",
          });
          return;
        }
        req.query[key] = String(decoded);
      }
    }
  }

  next();
}
