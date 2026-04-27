import type { CampaignMetric, Prisma } from '@prisma/client';
import { getPrismaClient } from '../../lib/prisma';

export async function createCampaignMetric(
  data: Prisma.CampaignMetricCreateInput,
): Promise<CampaignMetric> {
  return getPrismaClient().campaignMetric.create({ data });
}

export async function listMetricsByCampaign(campaignId: string): Promise<CampaignMetric[]> {
  return getPrismaClient().campaignMetric.findMany({
    where: { campaignId },
    orderBy: { recordedAt: 'desc' },
  });
}

export async function getCampaignMetricById(id: string): Promise<CampaignMetric | null> {
  return getPrismaClient().campaignMetric.findUnique({ where: { id } });
}

export async function updateCampaignMetric(
  id: string,
  data: Prisma.CampaignMetricUpdateInput,
): Promise<CampaignMetric> {
  return getPrismaClient().campaignMetric.update({
    where: { id },
    data,
  });
}

export async function deleteCampaignMetric(id: string): Promise<CampaignMetric> {
  return getPrismaClient().campaignMetric.delete({ where: { id } });
}
