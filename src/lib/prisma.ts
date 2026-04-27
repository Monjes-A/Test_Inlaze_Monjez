import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { getEnv } from '../config/env'

let prismaClient: PrismaClient | null = null

export function getPrismaClient(): PrismaClient {
  if (prismaClient) return prismaClient
  const pool = new Pool({ connectionString: getEnv().DATABASE_URL })
  const adapter = new PrismaPg(pool)
  prismaClient = new PrismaClient({ adapter })
  return prismaClient
}

export async function disconnectPrismaClient(): Promise<void> {
  if (!prismaClient) return
  await prismaClient.$disconnect()
  prismaClient = null
}
