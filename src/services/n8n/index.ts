import axios from 'axios'
import { getEnv } from '../../config/env'
import { getLogger } from '../../lib/logger'
import { CampaignReport } from '../../types/CampaignReport'

export async function sendToN8N(campaigns: CampaignReport[]): Promise<void> {
  const webhookUrl = getEnv().N8N_URL

  try {
    await axios.post(`${webhookUrl}/campaigns`, { campaigns })
    getLogger().info({ campaigns }, 'Successfully sent data to N8N Webhook.')
  } catch (error: any) {
    getLogger().error('Failed to send data to N8N Webhook:', error.message)
  }
}
