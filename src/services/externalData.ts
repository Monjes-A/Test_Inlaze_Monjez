import { getEnv } from '../config/env'
import axios from 'axios'
import { z } from 'zod'
import { getLogger } from '../lib/logger'
import { CampaignReport } from '../types/CampaignReport'

const campaignReportSchema = z.object({
  id: z.string(),
  name: z.string(),
  metric: z.number().min(0).max(5),
  evaluatedAt: z.coerce.date()
})

const campaignReportListSchema = z.array(campaignReportSchema)

export type CampaignExternalData = z.infer<typeof campaignReportSchema>

export async function getExternalData(
  count: number = 1
): Promise<CampaignReport[]> {
  const url = getEnv().EXTERNAL_API_URL

  const result = await axios.get(url, {
    params: {
      count,
      key: '83daa100'
    }
  })

  const parsed = campaignReportListSchema.safeParse(result.data)
  if (!parsed.success) {
    getLogger().error(
      { error: parsed.error },
      'Error parsing campaign report list'
    )
    throw new Error('Error parsing campaign report list')
  }

  const campaigns = parsed.data.map((campaign) => {
    const status: 'critical' | 'warning' | 'ok' =
      campaign.metric < 1.0
        ? 'critical'
        : campaign.metric < 2.5
          ? 'warning'
          : 'ok'

    return {
      status,
      ...campaign
    }
  })

  return campaigns
}
