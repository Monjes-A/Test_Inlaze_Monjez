import { spawn, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import pino from 'pino'
import type { Logger } from 'pino'
import { getEnv } from '../config/env'

const nodeRequire = createRequire(__filename)

/** El driver `postgres` de `pino-postgres` no acepta `?schema=` como parámetro de conexión PG. */
function connectionStringForPinoPostgres(databaseUrl: string): string {
  try {
    const u = new URL(databaseUrl)
    u.searchParams.delete('schema')
    return u.toString()
  } catch {
    return databaseUrl
  }
}

let pgChild: ChildProcess | null = null
let rootLogger: Logger | null = null

/**
 * `pino-postgres` se publica como CLI (lee stdin). Aquí se lanza como proceso hijo
 * y Pino escribe líneas JSON a su stdin, además de stdout para `docker logs`.
 */
export function getLogger(): Logger {
  if (rootLogger) return rootLogger

  const env = getEnv()
  const pinoPostgresEntry = nodeRequire.resolve('pino-postgres')

  const child = spawn(
    process.execPath,
    [
      pinoPostgresEntry,
      '--connection',
      connectionStringForPinoPostgres(env.DATABASE_URL),
      '--table',
      'logs',
      '--schema',
      'public',
      '--column',
      'content',
      '--flush-interval',
      '2000',
      '--buffer-size',
      '50',
      '--max-connections',
      '2'
    ],
    {
      stdio: ['pipe', 'inherit', 'inherit'],
      env: process.env
    }
  )

  pgChild = child

  child.on('error', (err) => {
    console.error('Error arrancando proceso pino-postgres:', err)
  })

  if (!child.stdin) {
    throw new Error('pino-postgres: stdin no disponible')
  }

  const level = env.LOG_LEVEL as pino.Level
  const multistream = pino.multistream([
    { level, stream: process.stdout },
    { level, stream: child.stdin }
  ])

  rootLogger = pino({ level: env.LOG_LEVEL }, multistream)
  return rootLogger
}

export async function shutdownLogger(): Promise<void> {
  const child = pgChild
  if (child?.stdin && !child.stdin.destroyed) {
    child.stdin.end()
  }
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 3500)
    child?.once('exit', () => {
      clearTimeout(t)
      resolve()
    })
    child?.kill('SIGTERM')
  })
  pgChild = null
  rootLogger = null
}
