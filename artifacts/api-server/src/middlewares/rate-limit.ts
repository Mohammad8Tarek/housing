/**
 * middlewares/rate-limit.ts
 *
 * الإضافات:
 * 1. resetLoginAttempts() — تُستدعى بعد نجاح الدخول
 * 2. تنظيف دوري للـ store
 * 3. Redis integration for distributed rate limiting across instances
 */

import type { Request, Response, NextFunction } from "express";
import { getRedisConnection } from "@workspace/queue";
import { logger } from "../lib/logger.js";

interface StoreEntry {
  count: number;
  resetTime: number;
  blocked?: boolean;
}
const store = new Map<string, StoreEntry>();

// تنظيف كل 5 دقائق مع cleanup على shutdown
const cleanupInterval = setInterval(
  () => {
    const now = Date.now();
    for (const [key, val] of store.entries()) {
      if (val.resetTime < now) store.delete(key);
    }
  },
  5 * 60 * 1000,
);

export function clearRateLimitStore(): void {
  clearInterval(cleanupInterval);
  store.clear();
}

function getIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

function createRateLimiter(opts: {
  windowMs: number;
  max: number;
  message?: string;
  keyFn?: (req: Request) => string;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = opts.keyFn ? opts.keyFn(req) : getIp(req);
    const now = Date.now();
    const redis = getRedisConnection();

    if (redis) {
      try {
        const redisKey = `ratelimit:${key}`;
        // Increment the key
        const currentCount = await redis.incr(redisKey);
        
        // If it's the first request in the window, set the expiry
        if (currentCount === 1) {
          await redis.pexpire(redisKey, opts.windowMs);
        } else {
          // If the key has no expiry (shouldn't happen, but just in case), set it
          const ttl = await redis.pttl(redisKey);
          if (ttl === -1) {
            await redis.pexpire(redisKey, opts.windowMs);
          }
        }

        if (currentCount > opts.max) {
          const ttl = await redis.pttl(redisKey);
          const retryAfter = Math.ceil(ttl / 1000);
          res.set("Retry-After", String(Math.max(1, retryAfter)));
          res.status(429).json({ error: opts.message ?? "Too many requests.", retryAfter: Math.max(1, retryAfter) });
          return;
        }

        next();
        return;
      } catch (err) {
        // Fallback to in-memory if Redis errors out
        logger.warn({ err }, "Redis rate limit failed, falling back to memory");
      }
    }

    // In-Memory Fallback
    const entry = store.get(key);

    if (!entry || entry.resetTime < now) {
      store.set(key, { count: 1, resetTime: now + opts.windowMs });
      next();
      return;
    }
    
    entry.count++;
    if (entry.count > opts.max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({ error: opts.message ?? "Too many requests.", retryAfter });
      return;
    }
    
    next();
  };
}

export const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Try again after 15 minutes.",
  keyFn: (req) => `login:${getIp(req)}`,
});

export const portalLoginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message:
    "Too many employee portal login attempts. Try again after 15 minutes.",
  keyFn: (req) => `portal_login:${getIp(req)}`,
});

export const apiRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  keyFn: (req) => {
    const userId = (req.session as any)?.userId;
    return userId ? `api:user:${userId}` : `api:ip:${getIp(req)}`;
  },
});

export const changePasswordRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many password change attempts. Try again after 1 minute.",
  keyFn: (req) =>
    `change_pw:${getIp(req)}:${(req.session as any)?.userId ?? "anon"}`,
});

export const hrSyncRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: "HR sync rate limit exceeded. Max 5 syncs per minute.",
  keyFn: (req) => `hr_sync:${(req.session as any)?.propertyId ?? "unknown"}`,
});

export const portalRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: "Too many portal requests.",
  keyFn: (req) => {
    const empId = (req.session as any)?.portal?.employeeId;
    return empId ? `portal:emp:${empId}` : `portal:ip:${getIp(req)}`;
  },
});

/**
 * resetLoginAttempts — يمسح عداد login بعد نجاح الدخول.
 */
export async function resetLoginAttempts(req: Request): Promise<void> {
  const key = `login:${getIp(req)}`;
  
  const redis = getRedisConnection();
  if (redis) {
    try {
      await redis.del(`ratelimit:${key}`);
    } catch (err) {
      logger.warn({ err }, "Failed to clear Redis rate limit on login success");
    }
  }
  
  store.delete(key);
}
