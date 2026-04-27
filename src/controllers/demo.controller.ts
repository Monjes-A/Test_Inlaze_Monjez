import type { Request, Response } from 'express'
import { enqueueDemo, getDemoQueueEvents } from '../services/queue'
import { getLogger } from '../lib/logger'
import { CampaignReport } from '../types/CampaignReport'

export async function postEnqueueDemo(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    getLogger().info('Enviando job demo por http')
    const job = await enqueueDemo({ source: 'http' })
    const queueEvents = getDemoQueueEvents()
    await queueEvents.waitUntilReady()
    const result = await job.waitUntilFinished(queueEvents, 15000)

    res.json({ jobId: job.id, result })
  } catch (err) {
    const isTimeout =
      err instanceof Error && err.message.toLowerCase().includes('timed out')
    getLogger().error({ err }, 'Error esperando resultado del job demo')
    if (isTimeout) {
      res.status(504).json({ error: 'Timeout esperando resultado del job' })
      return
    }
    res.status(500).json({ error: 'No se pudo procesar el job' })
  }
}

export async function postLoggerDemo(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const data = req.body
    const type = data?.type ?? 'warning'

    getLogger().warn(data, `LOG_POST_${type.toUpperCase()}`)

    res.json({ message: 'OK' })
  } catch (err) {
    getLogger().error({ err }, 'Error sending log demo')
    res.status(500).json({ message: 'Error sending log demo' })
  }
}
