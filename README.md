# Prueba técnica — Automatizaciones e IA (Inlaze)

Backend en **TypeScript** que simula el monitoreo de campañas: consume una API externa tipada, aplica umbrales, persiste trazas en logs, encola procesamiento con **BullMQ**, dispara un flujo **N8N** y genera análisis con **OpenRouter**. Incluye la **Parte 3A** (refactor del fragmento del enunciado), **Parte 3B** (consulta Prisma) y el diseño conceptual de agente en **[DESIGN.md](./DESIGN.md)**.

---

## Requisitos

- [Docker](https://docs.docker.com/get-docker/) y Docker Compose v2  
- Cuenta en [Mockaroo](https://www.mockaroo.com/) (API gratuita) para definir el esquema de campañas  
- Clave de [OpenRouter](https://openrouter.ai/) para la Parte 4  
- (Opcional) Webhook de **Discord** para la rama `critical` del flujo N8N  

---

## Puesta en marcha (recomendado)

1. Clona el repositorio y copia variables de entorno:

   ```bash
   cp .env.example .env
   ```

2. Edita `.env`:

   - `EXTERNAL_API_URL`: URL de tu API Mockaroo (incluye tu clave en la query si Mockaroo la exige).  
   - `OPENROUTER_API_KEY`: tu clave (sin espacios tras `=`).  
   - `N8N_URL`: en local con Compose suele ser `http://n8n:5678/webhook-test` (webhook de **test**). En un despliegue real, cámbiala al webhook de **producción** de N8N.

3. Levanta todo:

   ```bash
   docker compose up -d --build
   ```

   El contenedor `app` ejecuta `pnpm prisma db push` al arrancar y luego el servidor (API + worker BullMQ + cron).

4. **N8N** (http://localhost:5678): importa el flujo desde [`src/services/n8n/My workflow.json`](./src/services/n8n/My%20workflow.json). Configura el nodo de **Discord** con tu webhook y asegúrate de que la URL del webhook que usa la app (`N8N_URL` + ruta del flujo) coincida con el modo test o producción que estés usando.

5. Dispara un ciclo manual (espera hasta ~15 s por el `waitUntilFinished` del job):

   ```bash
   curl -X POST http://localhost:3000/api/demo/enqueue
   ```

Además, un **cron** encola el mismo job **cada 2 minutos** (ajustado para pruebas rápidas).

---

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto HTTP (por defecto 3000) |
| `DATABASE_URL` | Postgres (en Compose: usuario `app`, BD `app`) |
| `REDIS_URL` | Redis para BullMQ |
| `EXTERNAL_API_URL` | Endpoint Mockaroo que devuelve el listado de campañas |
| `N8N_URL` | Base del webhook N8N **sin** path final; la app publica en `${N8N_URL}/campaigns` |
| `OPENROUTER_API_KEY` | Clave OpenRouter (usada en código; no está validada en `getEnv`, pero es obligatoria para el resumen con IA) |
| `LOG_LEVEL` | Nivel Pino (opcional) |

Los nombres están en [`.env.example`](./.env.example) sin secretos reales.

---

## Parte 1 — API REST, tipado y umbrales

### Elección de API: Mockaroo

Se usa **[Mockaroo](https://www.mockaroo.com/)** como API REST gratuita y **personalizable**: permite fijar el tipo de respuesta y datos simulados parecidos a métricas de ads (sin usar Google Ads real). Cambiar a otra fuente se facilita validando la respuesta con **Zod** en [`src/services/externalData.ts`](./src/services/externalData.ts): el contrato queda explícito y falla de forma controlada si la forma del JSON no coincide.

### Métrica y umbrales

- `metric` se genera en Mockaroo como **número aleatorio entre 0 y 5 con dos decimales** (configuración de referencia: imagen en [`medias/config_mockaroo.png`](./medias/config_mockaroo.png)).  
- Los **umbrales son los del PDF**: `metric < 1.0` → `critical`; `metric < 2.5` → `warning`; `metric >= 2.5` → `ok`.

### Persistencia y uso del resultado

El resultado **no se guarda como archivo JSON** para encadenar el resto del flujo: los `CampaignReport[]` se pasan en memoria a N8N y al LLM. El **objeto completo** (campañas y, cuando existe, el análisis) queda además en **logs estructurados** vía Pino (y opcionalmente en la tabla `logs` de Postgres con `pino-postgres`), lo que deja trazabilidad sin depender de un fichero intermedio.

### Reintentos

La petición a Mockaroo vive dentro del **job de BullMQ**. Si el proceso falla, el job se **reintenta hasta 3 veces** con **backoff exponencial** (configuración en [`src/services/queue.ts`](./src/services/queue.ts)).

---

## Parte 2 — N8N

- **Exportación del flujo:** [`src/services/n8n/My workflow.json`](./src/services/n8n/My%20workflow.json) (obligatorio para evaluación).  
- **Trigger:** la app envía `POST` a `${N8N_URL}/campaigns` con `{ campaigns: CampaignReport[] }` (ver [`src/services/n8n/index.ts`](./src/services/n8n/index.ts)).  
- **Critical:** mensaje a **Discord** (configurar credenciales/webhook en el nodo correspondiente en N8N).  
- **Warning:** en lugar de montar Google Sheets para la demo, el flujo llama por **HTTP al backend** (`POST /api/demo/logger`), que registra el payload con Pino y persiste en la misma tubería de logs. En Compose el JSON exportado apunta a **`http://app:3000/api/demo/logger`** (red Docker entre contenedores `n8n` y `app`). Se priorizó **menos fricción** al probar sin perder el criterio de “acción distinta” frente a `critical`.  
- **Errores:** el flujo exportado incluye manejo de error (p. ej. nodo de captura / ramas de error) para no romper la ejecución completa.

---

## Parte 3A — Diagnóstico y refactor

Fragmento original (problemas típicos que aborda esta solución):

1. **División por cero:** si `impressions === 0`, `clicks / impressions` es `Infinity` o `NaN`. Se corrige devolviendo CTR `0` cuando no hay impresiones.  
2. **Errores de red / HTTP sin captura:** faltaba `try/catch` y registro claro de fallos por `campaignId`. Se añadió manejo de errores y logs.  
3. **Rendimiento:** el bucle `for` secuencial era lento con muchos IDs. Se sustituyó por **concurrencia controlada** con **`p-limit(3)`** y **`Promise.all`**, cumpliendo el diferencial de máximo **3** peticiones simultáneas.  
4. (Opcional en README) Tipado débil de `response.data`: el núcleo sigue siendo el del enunciado; la mejora se centró en lo anterior sin reescribir todo el módulo.

Código: [`src/services/Test_3/processCampaigns.ts`](./src/services/Test_3/processCampaigns.ts).

---

## Parte 3B — Query Prisma

Implementación: [`src/services/Test_3/get_prisma.ts`](./src/services/Test_3/get_prisma.ts).

**Idea:** primero se obtienen promedios de **ROAS** por `campaignId` en los **últimos 7 días** con `groupBy` + `_avg.roas` y **orden ascendente** (peor ROAS primero). Así se filtra por ventana temporal y se rankea en una consulta acotada. Después se hace un `findMany` de campañas (y operador) solo para los IDs resultantes y se **agrupa en memoria** por operador. Esto evita una única consulta SQL muy densa con agregaciones anidadas y mantiene el requisito de **no usar raw SQL**, solo la API de Prisma.

> **Nota:** si la tabla de métricas está vacía, la función devuelve `[]`. Puedes insertar datos de prueba con Prisma Studio o SQL según tu entorno.

---

## Parte 4 — OpenRouter y resumen ejecutivo

- **Proveedor:** [OpenRouter](https://openrouter.ai/) con el **SDK oficial** `@openrouter/sdk` en TypeScript ([`src/services/OpenRouter/index.ts`](./src/services/OpenRouter/index.ts)). Centraliza modelos y facturación/cuotas en un solo sitio frente a integrar varios proveedores a mano.  
- **Modelo:** `openai/gpt-4o-mini` (equilibrio coste/calidad para JSON estructurado).  
- **Salida:** además del criterio del enunciado, se usa **`response_format` con JSON Schema** y validación con **Zod** (`CampaignAnalysis`: campañas críticas, resumen de warnings, acciones sugeridas).  
- **Streaming:** **no** implementado: para respuestas **JSON completas** y parseo fiable, el streaming suele complicar el consumo hasta el cierre del mensaje; se prefiere respuesta única (`stream: false`).  
- **Errores:** ante fallo de API, clave ausente, JSON inválido o validación Zod, se registra con el logger y la función devuelve `undefined` sin tumbar el proceso del worker.

---

## Parte 5 — Diseño de agente con herramientas

Respuesta acotada (~200 palabras) + diagrama en **[DESIGN.md](./DESIGN.md)**.

---

## Arquitectura y decisiones transversales

- **Express:** expone endpoints de demo (`/api/demo/enqueue`, `/api/demo/logger`) y permite probar el flujo **sin scripts sueltos**, alineado con un servicio HTTP real.  
- **Docker Compose:** levanta **Postgres**, **Redis**, la **app** (API + worker + cron) y **n8n** para que un evaluador reproduzca el e2e con un solo comando.  
- **Pino + `pino-postgres`:** logs estructurados en consola y, cuando la BD está disponible, filas en la tabla `logs` ([`src/lib/logger.ts`](./src/lib/logger.ts)), útil para auditoría y para ver el `RESULT` del job con campañas y análisis.

---

## Scripts útiles (desarrollo local sin Docker)

Si trabajas fuera de Compose, necesitas Postgres y Redis accesibles y las mismas variables en `.env`:

```bash
pnpm install
pnpm prisma generate
pnpm prisma db push
pnpm dev
```

---

## Licencia

ISC (ver `package.json`).
