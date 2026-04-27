import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { getEnv } from '../config/env';
import { DEMO_JOB_NAME, DEMO_QUEUE_NAME } from '../config/queue';
import { getLogger } from '../lib/logger';

let queue: Queue | null = null;
let queueConnection: Redis | null = null;
let queueEvents: QueueEvents | null = null;
let queueEventsConnection: Redis | null = null;

function createRedis(): Redis {
  const env = getEnv();
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export function getDemoQueue(): Queue {
  if (queue) return queue;
  queueConnection = createRedis();
  queue = new Queue(DEMO_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });
  return queue;
}

export function getDemoQueueEvents(): QueueEvents {
  if (queueEvents) return queueEvents;
  queueEventsConnection = createRedis();
  queueEvents = new QueueEvents(DEMO_QUEUE_NAME, {
    connection: queueEventsConnection,
  });
  return queueEvents;
}

export async function enqueueDemo(payload: { source: 'http' | 'cron' }) {
  const q = getDemoQueue();
  const job = await q.add(DEMO_JOB_NAME, payload);
  getLogger().info({ jobId: job.id, source: payload.source }, 'Job encolado');
  return job;
}

export async function closeDemoQueue(): Promise<void> {
  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
  }
  if (queueEventsConnection) {
    await queueEventsConnection.quit();
    queueEventsConnection = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (queueConnection) {
    await queueConnection.quit();
    queueConnection = null;
  }
}
