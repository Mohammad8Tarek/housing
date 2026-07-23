import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

const SUSPICIOUS_PATHS = [
  "/.env",
  "/.git",
  "/.git/config",
  "/wp-admin",
  "/wp-login",
  "/phpmyadmin",
  "/admin",
  "/administrator",
  "/backup",
  "/config",
  "/db",
  "/sql",
  "/mysql",
  "/server-status",
  "/vendor/phpunit",
  "/actuator",
  "/api/swagger",
];

const BOT_USER_AGENTS = [
  "curl",
  "wget",
  "python-requests",
  "go-http-client",
  "java/",
  "libwww-perl",
  "scrapy",
  "httpclient",
  "nikto",
  "sqlmap",
  "nmap",
  "zgrab",
  "masscan",
];

function scoreRequest(req: Request): number {
  let score = 0;
  const ua = (req.headers["user-agent"] ?? "").toLowerCase();

  if (!ua || ua.length < 10) score += 30;
  if (BOT_USER_AGENTS.some((b) => ua.includes(b))) score += 40;
  if (!req.headers["accept"]) score += 10;
  if (!req.headers["accept-language"]) score += 10;
  if (req.headers["accept"] === "*/*") score += 5;

  const path = req.path.toLowerCase();
  if (SUSPICIOUS_PATHS.some((p) => path === p || path.startsWith(`${p}/`)))
    score += 50;
  if (path.includes("..") || path.includes("%00")) score += 50;
  if (Object.keys(req.query).length > 20) score += 20;

  return score;
}

export function botDetection(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const score = scoreRequest(req);
  if (score >= 50) {
    res.status(403).end();
    return;
  }
  if (score >= 20) {
    logger.warn(
      { url: req.url, ip: req.ip, ua: req.headers["user-agent"], score },
      "Suspicious request",
    );
  }
  next();
}
