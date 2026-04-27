import type { Job } from 'bullmq'
import { getLogger } from '../lib/logger'
import { getExternalData } from './externalData'
import { sendToN8N } from './n8n'
import { CampaignReport } from '../types/CampaignReport'
import { generateCampaignSummary, CampaignAnalysis } from './OpenRouter'

export type DemoJobData = { source: 'http' | 'cron' | 'n8n' }
export type DemoJobResult = {
  ok: true
  message: string
  campaigns: CampaignReport[]
  analysis?: CampaignAnalysis
}

export async function processDemoJob(
  job: Job<DemoJobData>
): Promise<DemoJobResult> {
  const log = getLogger().child({
    jobId: job.id,
    attemptsMade: job.attemptsMade,
    source: job.data.source
  })
  try {
    const campaigns = await getExternalData(50)
    await sendToN8N(campaigns)
    const analysis = await generateCampaignSummary(campaigns)

    log.info({ campaigns, analysis }, 'RESULT')

    return {
      ok: true,
      message: 'Campaigns processed successfully',
      campaigns,
      analysis
    }
  } catch (err) {
    log.error({ err }, 'Error en processDemoJob')
    throw err
  }
}
