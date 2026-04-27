import { getPrismaClient } from '../../lib/prisma'
import { DateTime } from 'luxon'

export type CampaignRoasRow = {
  campaignId: string
  campaignName: string
  avgRoas: number
}

export type OperatorWorstRoasGroup = {
  operatorId: string
  operatorName: string
  campaigns: CampaignRoasRow[]
}

export async function getWorstRoasByOperatorLast7Days(
  baseDate: Date
): Promise<OperatorWorstRoasGroup[]> {
  const prisma = getPrismaClient()
  const Date = DateTime.fromJSDate(baseDate)
  const sevenDaysAgo = Date.minus({ days: 7 })

  const campaignAverages = await prisma.campaignMetric.groupBy({
    by: ['campaignId'],
    where: {
      recordedAt: {
        gte: sevenDaysAgo.toJSDate(),
        lte: Date.toJSDate()
      }
    },
    _avg: {
      roas: true
    },
    orderBy: {
      _avg: {
        roas: 'asc'
      }
    }
  })

  if (campaignAverages.length === 0) return []

  const campaigns = await prisma.campaign.findMany({
    where: {
      id: {
        in: campaignAverages.map((row) => row.campaignId)
      }
    },
    select: {
      id: true,
      name: true,
      operator: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  const campaignById = new Map(
    campaigns.map((campaign) => [campaign.id, campaign])
  )
  const groupedByOperator = new Map<string, OperatorWorstRoasGroup>()

  for (const row of campaignAverages) {
    const campaign = campaignById.get(row.campaignId)
    if (!campaign || row._avg.roas === null) continue

    const existing = groupedByOperator.get(campaign.operator.id)
    if (!existing) {
      groupedByOperator.set(campaign.operator.id, {
        operatorId: campaign.operator.id,
        operatorName: campaign.operator.name,
        campaigns: [
          {
            campaignId: campaign.id,
            campaignName: campaign.name,
            avgRoas: row._avg.roas
          }
        ]
      })
      continue
    }

    existing.campaigns.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      avgRoas: row._avg.roas
    })
  }

  return [...groupedByOperator.values()].sort(
    (a, b) => a.campaigns[0].avgRoas - b.campaigns[0].avgRoas
  )
}
