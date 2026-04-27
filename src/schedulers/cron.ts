import cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import { enqueueDemo } from '../services/queue'
import { getLogger } from '../lib/logger'

export function startDemoCron(): ScheduledTask {
  const task = cron.schedule(
    '*/2 * * * *',
    async () => {
      try {
        await enqueueDemo({ source: 'cron' })
        getLogger().info('Cron: job demo encolado')
      } catch (err) {
        getLogger().error({ err }, 'Cron: error al encolar')
      }
    },
    { timezone: 'UTC' }
  )
  return task
}
