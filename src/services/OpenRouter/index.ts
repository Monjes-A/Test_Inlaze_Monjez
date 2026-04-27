import { OpenRouter } from '@openrouter/sdk'
import { z } from 'zod'
import type { CampaignReport } from '../../types/CampaignReport'
import { getLogger } from '../../lib/logger'

const CampaignAnalysisSchema = z.object({
  criticalCampaigns: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      metric: z.number(),
      reason: z.string()
    })
  ),
  warningSummary: z.object({
    total: z.number(),
    highlights: z.array(z.string())
  }),
  suggestedActions: z.array(z.string()).min(1)
})

export type CampaignAnalysis = z.infer<typeof CampaignAnalysisSchema>

const responseJsonSchema = {
  name: 'campaign_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      criticalCampaigns: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            metric: { type: 'number' },
            reason: { type: 'string' }
          },
          required: ['id', 'name', 'metric', 'reason']
        }
      },
      warningSummary: {
        type: 'object',
        additionalProperties: false,
        properties: {
          total: { type: 'number' },
          highlights: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['total', 'highlights']
      },
      suggestedActions: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1
      }
    },
    required: ['criticalCampaigns', 'warningSummary', 'suggestedActions']
  }
} as const

export async function generateCampaignSummary(
  reports: CampaignReport[]
): Promise<CampaignAnalysis | undefined> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY no está definida')
    }

    const client = new OpenRouter({ apiKey })

    const systemPrompt = `
  Eres un Senior Performance Marketer especializado en optimización de ROAS y CPA. 
  Tu misión es procesar un listado de informes de campañas y generar un análisis ejecutivo preciso en español.
  
  Sigue estas reglas estrictas para el análisis:
  1. **Identificación Crítica**: Filtra campañas con status "critical". Para 'reason', explica brevemente qué métrica falló (CTR, Conversion Rate o CPA) y su impacto negativo.
  2. **Resumen de Advertencias (Warning)**: Agrupa los problemas comunes detectados en las campañas "warning". En 'highlights', menciona tendencias específicas observadas (ej: "Incremento de fatiga de anuncios en 3 campañas").
  3. **Sugerencias Accionables**: Deben ser propuestas técnico-estratégicas (ej: "Pausar creatividades con CTR < 0.5%", "Aumentar presupuesto un 20% en campañas con ROAS positivo", "Revisar el tracking de eventos en landing pages"). 
  4. **Formato**: Devuelve ÚNICAMENTE el JSON que cumpla con el esquema definido. No incluyas explicaciones adicionales fuera del objeto.
  `.trim()

    const response = await client.chat.send({
      chatRequest: {
        model: 'openai/gpt-4o-mini',
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(reports) }
        ],
        responseFormat: {
          type: 'json_schema',
          jsonSchema: responseJsonSchema
        }
      }
    })

    const content = response.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('El modelo no devolvió contenido')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error('La respuesta no es JSON válido')
    }

    const validation = CampaignAnalysisSchema.safeParse(parsed)
    if (!validation.success) {
      throw new Error(
        `Respuesta inválida del modelo: ${validation.error.message}`
      )
    }

    return validation.data
  } catch (error) {
    getLogger().error({ error }, 'Error generating campaign summary')

    return undefined
  }
}
