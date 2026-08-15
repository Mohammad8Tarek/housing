import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../connection.js';

export function createAuditWorker(): Worker | null {
  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  const worker = new Worker(
    'auditQueue',
    async (job: Job) => {
      console.log(`Processing audit log job ${job.id}`);
      // Fire-and-forget logic
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
