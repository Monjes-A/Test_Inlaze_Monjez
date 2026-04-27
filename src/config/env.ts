import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.string().optional().default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  REDIS_URL: z.string().min(1, 'REDIS_URL es obligatoria'),
  LOG_LEVEL: z.string().optional().default('info'),
  EXTERNAL_API_URL: z.string().min(1, 'EXTERNAL_API_URL es obligatoria'),
  N8N_URL: z.string().min(1, 'N8N_URL es obligatoria')
})

export type Env = z.infer<typeof envSchema>

let cached: Env | null = null

export function getEnv(): Env {
  if (cached) return cached
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors
    throw new Error(`Variables de entorno inválidas: ${JSON.stringify(msg)}`)
  }
  cached = parsed.data
  return cached
}
