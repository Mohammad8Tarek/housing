import { Redis } from 'ioredis';

let redisInstance: Redis | null = null;

export interface RedisConnectionOptions {
  url?: string;
}

export function createRedisConnection(opts?: RedisConnectionOptions): Redis | null {
  const url = opts?.url || process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  const connection = new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy: (times) => {
      // Exponential backoff, max 5s
      return Math.min(times * 50, 5000);
    }
  });

  connection.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  return connection;
}

export function getRedisConnection(): Redis | null {
  if (!redisInstance) {
    redisInstance = createRedisConnection();
  }
  return redisInstance;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}

export async function redisHealthCheck(): Promise<number | null> {
  const conn = getRedisConnection();
  if (!conn) return null;
  
  const start = Date.now();
  try {
    await conn.ping();
    return Date.now() - start;
  } catch (err) {
    console.error('Redis health check failed:', err);
    return null;
  }
}
