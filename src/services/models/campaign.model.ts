import type { Campaign, Prisma } from '@prisma/client';
import { getPrismaClient } from '../../lib/prisma';

export async function createCampaign(data: Prisma.CampaignCreateInput): Promise<Campaign> {
  return getPrismaClient().campaign.create({ data });
}

export async function listCampaignsByOperator(operatorId: string): Promise<Campaign[]> {
  return getPrismaClient().campaign.findMany({
    where: { operatorId },
    orderBy: { name: 'asc' },
  });
}

export async function getCampaignById(id: string): Promise<Campaign | null> {
  return getPrismaClient().campaign.findUnique({ where: { id } });
}

export async function updateCampaign(
  id: string,
  data: Prisma.CampaignUpdateInput,
): Promise<Campaign> {
  return getPrismaClient().campaign.update({
    where: { id },
    data,
  });
}

export async function deleteCampaign(id: string): Promise<Campaign> {
  return getPrismaClient().campaign.delete({ where: { id } });
}
