# Diseño: agente de IA con acciones automáticas sobre datos

Un agente que lee Postgres (y vectores si hace falta) para pausar campañas o enviar alertas encajaría en la misma base que este repo: **Express**, **BullMQ/Redis** para jobs y reintentos, **Postgres** como verdad y workers que leen contexto, llaman al LLM y persisten el resultado. Encima: runtime con tools y un **dashboard** para aprobar lo sensible.

**Cuándo actúa:** lo disparan reglas deterministas (cron, umbrales, webhooks). El modelo no sustituye eso; dentro del turno **elige si usa tools**. **Skills** y **system prompt** orientan cuáles herramientas tocar y con qué cautela.

**Tools:** **callFunctions** en proceso si hay credenciales compartidas o un solo tenant; **MCP** en multi-tenant o cuando aporta documentación clara de cómo y cuándo usar cada tool. Se pueden combinar.

**Auditoría:** `correlation id`, datos referenciados, salida del modelo, `tool_calls` y resultado de cada tool; **Pino → Postgres** como ya se hace, más tablas de traza si hace falta consulta fina.

**Humano en el bucle:** crear o cancelar campañas puede ir **preparado por el agente** y quedar **pendiente**; un humano confirma en el panel y el backend muta con permisos habituales. Alertas de bajo riesgo pueden ir directas si la política lo permite.

## Diagrama de arquitectura (ASCII)

```
                    +------------------+
  Cron / Webhook -->| BullMQ (Redis)   |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    | Worker: agent job |
                    +--------+---------+
                             |
         +-------------------+-------------------+
         |                   |                   |
         v                   v                   v
  +-------------+    +---------------+    +----------------+
  | Postgres    |    | LLM + tools   |    | Pino -> PG     |
  | (datos +    |    | (skills/      |    | (logs +        |
  |  vectores?) |    |  prompt)      |    |  trace tablas) |
  +-------------+    +-------+-------+    +----------------+
                             |
              +--------------+--------------+
              |                             |
              v                             v
     +----------------+            +------------------+
     | callFunctions  |            | MCP (multi-      |
     | (mono-tenant)  |            |  tenant / ext.)  |
     +--------+-------+            +---------+--------+
              |                              |
              v                              v
     +----------------+            +------------------+
     | APIs internas  |            | Sistemas por     |
     | mutaciones     |            | cliente          |
     +----------------+            +------------------+
              |
              v
     +------------------+     humano aprueba
     | Dashboard        |<---- acciones de alto riesgo
     +------------------+
```
