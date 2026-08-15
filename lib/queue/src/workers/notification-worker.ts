import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../connection.js';

export function createNotificationWorker(): Worker | null {
  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  const worker = new Worker(
    'notificationQueue',
    async (job: Job) => {
      console.log(`Processing notification job ${job.id}`);
      return Promise.resolve();
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err);
  });

  return worker;
}
