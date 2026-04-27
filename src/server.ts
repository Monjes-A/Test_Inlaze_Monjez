import 'dotenv/config'
import { getEnv } from './config/env'
import { createApp } from './app'
import { startDemoWorker, closeDemoWorker } from './workers/bullmq.worker'
import { startDemoCron } from './schedulers/cron'
import { getLogger, shutdownLogger } from './lib/logger'
import { disconnectPrismaClient } from './lib/prisma'
import { closeDemoQueue } from './services/queue'

async function main() {
  const env = getEnv()
  getLogger().info({ port: env.PORT }, 'Iniciando servidor')

  const app = createApp()
  startDemoWorker()
  startDemoCron()

  const server = app.listen(env.PORT, () => {
    getLogger().info(`HTTP escuchando en puerto ${env.PORT}`)
  })

  const shutdown = async (signal: string) => {
    getLogger().info({ signal }, 'Apagado solicitado')
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
    await closeDemoWorker()
    await closeDemoQueue()
    await disconnectPrismaClient()
    await shutdownLogger()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
