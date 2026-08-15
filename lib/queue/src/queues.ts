import { Queue, DefaultJobOptions } from 'bullmq';
import { getRedisConnection } from './connection.js';

const baseJobOptions: DefaultJobOptions = {
  removeOnComplete: { age: 3600 },
  removeOnFail: { age: 86400 },
};

function createQueue(name: string, customOptions?: DefaultJobOptions): Queue | null {
  const connection = getRedisConnection();
  if (!connection) {
    console.warn(`Cannot create queue ${name}, Redis connection is missing`);
    return null;
  }
  return new Queue(name, {
    connection,
    defaultJobOptions: { ...baseJobOptions, ...customOptions }
  });
}

export const exportQueue = createQueue('exportQueue', {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 }
});
export const bulkOpsQueue = createQueue('bulkOpsQueue');
export const auditQueue = createQueue('auditQueue', { attempts: 0 });
export const notificationQueue = createQueue('notificationQueue', { attempts: 2 });

export async function closeAllQueues(): Promise<void> {
  const queues = [exportQueue, bulkOpsQueue, auditQueue, notificationQueue];
  for (const q of queues) {
    if (q) {
      await q.close();
    }
  }
}
