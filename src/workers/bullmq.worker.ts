import type { Job } from 'bullmq'
import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { getEnv } from '../config/env'
import { DEMO_JOB_NAME, DEMO_QUEUE_NAME } from '../config/queue'
import { processDemoJob, type DemoJobData } from '../services/demo_job'
import { getLogger } from '../lib/logger'

let worker: Worker | null = null
let workerConnection: Redis | null = null

function createRedis(): Redis {
  const env = getEnv()
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })
}

export function startDemoWorker(): Worker {
  if (worker) return worker
  workerConnection = createRedis()
  worker = new Worker(
    DEMO_QUEUE_NAME,
    async (job: Job) => {
      if (job.name === DEMO_JOB_NAME) {
        return processDemoJob(job as Job<DemoJobData>)
      }
      getLogger().warn({ jobName: job.name }, 'Job desconocido, ignorado')
      return null
    },
    {
      connection: workerConnection,
      concurrency: 1
    }
  )

  worker.on('failed', (job, err) => {
    getLogger().error({ jobId: job?.id, err }, 'Worker: job fallido')
  })
  worker.on('completed', (job) => {
    getLogger().info({ jobId: job.id }, 'Worker: job completado')
  })

  return worker
}

export async function closeDemoWorker(): Promise<void> {
  if (worker) {
    await worker.close()
    worker = null
  }
  if (workerConnection) {
    await workerConnection.quit()
    workerConnection = null
  }
}
