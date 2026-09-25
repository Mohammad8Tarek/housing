import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../connection.js';

export function createAuditWorker(handler?: (data: any) => Promise<void>): Worker | null {
  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  const worker = new Worker(
    'auditQueue',
    async (job: Job) => {
      if (handler) {
        await handler(job.data);
      }
      return Promise.resolve();
    },
    {
      connection,
      concurrency: 10,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`Audit job ${job?.id} failed:`, err);
  });

  return worker;
}
