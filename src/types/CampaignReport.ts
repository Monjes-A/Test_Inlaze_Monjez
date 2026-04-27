export type CampaignReport = {
  id: string
  name: string
  metric: number
  evaluatedAt: Date
  status: 'critical' | 'warning' | 'ok'
}
