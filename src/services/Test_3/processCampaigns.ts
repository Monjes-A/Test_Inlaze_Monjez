import axios from 'axios'
import pLimit from 'p-limit'

type CampaignData = {
  id: string
  clicks: number
  impressions: number
  ctr: number
}

async function fetchCampaignData(campaignId: string) {
  try {
    const response = await axios.get(
      `https://api.example.com/campaigns/${campaignId}`
    )
    const data = response.data
    return {
      id: data.id,
      clicks: data.clicks,
      impressions: data.impressions,
      ctr: data.impressions > 0 ? data.clicks / data.impressions : 0
    }
  } catch (error) {
    console.error(`Error fetching campaign data for ${campaignId}:`, error)
    throw error
  }
}

export async function processCampaigns(ids: string[]): Promise<CampaignData[]> {
  try {
    const limit = pLimit(3)
    const tasks = ids.map((id) => limit(() => fetchCampaignData(id)))
    const results = await Promise.all(tasks)
    return getLowCtrCampaigns(results)
  } catch (error) {
    console.error('Error processing campaigns:', error)
    throw error
  }
}

function getLowCtrCampaigns(campaigns: CampaignData[]) {
  return campaigns
    .filter((campaign) => campaign.ctr < 0.02)
    .sort((a, b) => a.ctr - b.ctr)
}
