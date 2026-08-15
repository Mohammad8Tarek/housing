import { Worker } from 'bullmq';
import { closeRedisConnection } from './connection.js';
import { closeAllQueues } from './queues.js';
import { createExportWorker } from './workers/export-worker.js';
import { createAuditWorker } from './workers/audit-worker.js';
import { createNotificationWorker } from './workers/notification-worker.js';

export * from './connection.js';
export * from './queues.js';
export * from './workers/export-worker.js';
export * from './workers/audit-worker.js';
export * from './workers/notification-worker.js';

let activeWorkers: Worker[] = [];

export function startAllWorkers(deps?: any): void {
  console.log('Starting all queue workers...');
  
  const exportWorker = createExportWorker();
  if (exportWorker) activeWorkers.push(exportWorker);
  
  const auditWorker = createAuditWorker();
  if (auditWorker) activeWorkers.push(auditWorker);
  
  const notificationWorker = createNotificationWorker();
  if (notificationWorker) activeWorkers.push(notificationWorker);
}

export async function shutdownQueue(): Promise<void> {
  console.log('Shutting down queue system...');
  
  // Close workers first
  for (const worker of activeWorkers) {
    await worker.close();
  }
  activeWorkers = [];
  
  // Close queues
  await closeAllQueues();
  
  // Close redis connection
  await closeRedisConnection();
  
  console.log('Queue system shutdown complete.');
}
