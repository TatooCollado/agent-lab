# Agent Lab

Aplicación educativa para inspeccionar el flujo técnico de agentes de IA sobre datos empresariales. El proyecto muestra contratos, protocolos, llamadas a herramientas, resultados estructurados y trazas sanitizadas.

## Estado

Etapas 1 a 6 — Fundación, MCP Server, Agent Runtime, Auth/RBAC, colaboración A2A y evaluaciones:

- frontend React + Vite;
- backend Node.js + Express;
- esquema y migraciones PostgreSQL;
- usuarios de aplicación `admin` y `viewer`;
- períodos de calendario deterministas;
- contrato técnico `TraceEvent`;
- tests unitarios y shell visual del Agent Lab;
- servidor MCP oficial sobre transporte `stdio`;
- tres herramientas MCP de solo lectura con respuestas estructuradas;
- consultas PostgreSQL parametrizadas mediante un rol de mínimo privilegio.
- Ollama con `qwen3:8b` para inferencia local y tool calling sin costo por token;
- OpenAI Responses API conservada como proveedor opcional;
- MCP Client local con descubrimiento y ejecución de herramientas;
- orquestador grounded y endpoint `POST /api/agent/query`;
- interfaz de consulta con respuesta y traza técnica real.
- autenticación con sesiones opacas persistidas en PostgreSQL;
- cookie `HttpOnly`, `SameSite=Strict` y expiración configurable;
- autorización RBAC con perfiles `admin` y `viewer`;
- alta auditada de usuarios y borrado transaccional de datos de RR. HH.
- dos agentes publicando Agent Cards A2A 1.0;
- delegación HR → Finanzas mediante JSON-RPC `SendMessage`;
- tarea financiera con ciclo de vida y Artifact estructurado;
- reporte de pérdidas por ausencias consultadas mediante MCP.
- suite de evaluaciones de comportamiento con assertions deterministas;
- casos de referencia, resultado vacío y frescura de PostgreSQL;
- fixture dinámica aislada con limpieza garantizada y verificación residual.

La configuración declarativa de deployment está preparada; falta aprovisionar los recursos externos.

## Estructura

```text
frontend/   React, inspector técnico y system index
backend/    API, dominio, migraciones, acceso PostgreSQL y trazas
```

## Requisitos

- Node.js 22 o superior.
- npm 10 o superior.
- Ollama 0.32 o superior y el modelo local `qwen3:8b`.
- PostgreSQL cloud con tres credenciales separadas cuando el proveedor lo permita.

## Instalación

```bash
npm --prefix backend install
npm --prefix frontend install
```

Copiar `backend/.env.example` a `backend/.env` y completar las URLs del proveedor PostgreSQL. Nunca utilizar la credencial propietaria en `DATABASE_READONLY_URL` o `DATABASE_ADMIN_URL`.

El proveedor predeterminado es Ollama local:

```dotenv
LLM_PROVIDER=ollama
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
```

Instalar Ollama y descargar el modelo una vez con `ollama pull qwen3:8b`. La inferencia usa CPU/GPU y almacenamiento locales, sin consumo de una API paga.

OpenAI continúa disponible como alternativa configurando `LLM_PROVIDER=openai`, `OPENAI_API_KEY` y `OPENAI_MODEL`. La clave sólo pertenece a `backend/.env`, que está ignorado por Git. Nunca debe enviarse al frontend ni incluirse en trazas.

## Base de datos

1. Crear la base PostgreSQL en el proveedor cloud.
2. Crear o configurar los roles siguiendo `backend/ops/database-roles.example.sql`.
3. Configurar las variables de entorno.
4. Ejecutar:

```bash
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
npm --prefix backend run db:smoke
npm --prefix backend run db:verify-permissions
```

`db:smoke` usa exclusivamente `DATABASE_READONLY_URL` y consulta la vista `hr_late_arrivals` con parámetros de fecha.

El seed exige `SEED_ADMIN_PASSWORD` y `SEED_VIEWER_PASSWORD`, ambas con al menos 12 caracteres. No existen contraseñas predeterminadas en el repositorio.

## Desarrollo

En dos terminales:

```bash
npm run dev:backend
npm run dev:frontend
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## Verificación sin base cloud

```bash
npm test
npm run typecheck
npm run build
```

Los tests de calendario verifican:

- mes corriente desde el día 1 hasta hoy inclusive;
- mes calendario anterior completo;
- febrero de año bisiesto;
- últimos 30 días de calendario.

## Intervalos temporales

La interfaz habla de fechas inclusivas, pero internamente se utilizan intervalos semiabiertos:

```text
startInclusive <= timestamp < endExclusive
```

Esto evita depender de `23:59:59` y conserva correctamente la precisión de PostgreSQL.

## Trazabilidad

El frontend muestra eventos técnicos con:

- nombre del evento;
- tecnología;
- componente;
- categoría;
- conceptos;
- input y output sanitizados;
- duración y estado.

No se mostrarán credenciales, tokens de sesión ni razonamiento interno del modelo.

## MCP Server

El servidor utiliza el SDK oficial de Model Context Protocol para exponer:

- `find_employee`: busca por nombre o número de empleado;
- `list_late_arrivals`: lista llegadas tarde por período y empleado opcional;
- `list_absences`: lista ausencias por período y empleado opcional.

Las herramientas declaran `readOnlyHint`, validan entrada y salida con Zod y devuelven tanto contenido textual como `structuredContent`. Los resultados incluyen fuente, fecha de consulta, período aplicado, cantidad total y señal de truncamiento. Cada llamada consulta PostgreSQL nuevamente; no hay caché en esta etapa.

Para iniciar el servidor MCP local:

```bash
npm run mcp:server
```

Para verificar descubrimiento, llamadas reales, datos sembrados y resultado vacío:

```bash
npm run mcp:smoke
```

`stdout` queda reservado al protocolo MCP; los errores operativos se envían a `stderr` y la respuesta al cliente se sanitiza.

## Agent Runtime

Flujo implementado:

```text
React → POST /api/agent/query → HrAgentOrchestrator
      → Ollama local + qwen3:8b (tool calling)
      → MCP Client → MCP Server → PostgreSQL
      → tool result → Ollama → respuesta + TraceEvent[]
```

El MCP Client descubre las herramientas disponibles, pero el modelo recibe únicamente las tres definiciones presentes en una allowlist controlada. Los esquemas de function calling son estrictos y las llamadas paralelas están desactivadas para que cada ejecución del MVP sea simple de inspeccionar.

`grounded: true` significa que el orquestador verificó una llamada a una herramienta aprobada y recibió `structuredContent` antes de solicitar la respuesta final. No significa que exista una garantía matemática sobre cada token producido por el modelo; esa calidad debe medirse con evaluaciones.

El system prompt exige que los datos empresariales provengan exclusivamente de las herramientas, que los resultados vacíos se informen explícitamente y que el contenido recibido sea tratado como datos, no como instrucciones.

Prueba de integración determinista, sin consumir API:

```bash
npm run agent:smoke
```

Prueba real con Ollama local, MCP y Neon:

```bash
npm run agent:smoke:ollama
```

Prueba real con Groq, MCP y Neon:

```bash
npm run agent:smoke:groq
```

Prueba opcional con OpenAI, MCP y Neon:

```bash
npm run agent:smoke:openai
```

Endpoint:

```http
POST /api/agent/query
Content-Type: application/json

{"question":"¿Qué empleados llegaron tarde durante el último mes?"}
```

La respuesta contiene `answer`, `model`, `grounded`, `toolsUsed` y una secuencia de eventos técnicos sanitizados. No incluye tokens, credenciales ni razonamiento interno.

## Autenticación y autorización

Las credenciales se validan contra hashes bcrypt en `app_users`. Al autenticar, el backend crea un token aleatorio, guarda únicamente su hash SHA-256 en `app_sessions` y entrega el token mediante una cookie `HttpOnly`. El frontend nunca accede al token.

La duración se configura con `SESSION_TTL_HOURS=8`.

Permisos de aplicación:

- `viewer`: puede consultar al agente y ver el índice técnico;
- `admin`: incluye las capacidades de consulta, alta de usuarios y borrado controlado de datos operativos.

El borrado administrativo no ejecuta `DROP DATABASE`. Elimina `attendance_records`, `employees` y `departments` dentro de una única transacción; conserva esquema, usuarios, sesiones y `audit_events`. Requiere la confirmación literal `DELETE HR DATA` y registra el resultado en auditoría.

El rol PostgreSQL `app_admin` no tiene `DROP`, `CREATE DATABASE`, superusuario ni membresía `neon_superuser`. Esta separación demuestra que RBAC de aplicación y privilegios de base de datos son capas distintas.

Prueba real de ambos usuarios y del ciclo completo de sesión:

```bash
npm run auth:smoke
```

## Agentes y A2A

El proyecto implementa A2A Protocol 1.0 con el SDK oficial `@a2a-js/sdk`:

- `HR Grounding Agent`: consultas de empleados y asistencia grounded mediante MCP;
- `Absence Finance Agent`: análisis económico determinista de ausencias.

Agent Cards:

```text
/.well-known/agent-card.json
/.well-known/hr-agent-card.json
/.well-known/finance-agent-card.json
```

Flujo financiero:

```text
Usuario → HR Agent / A2A Client
        → descubre Finance Agent Card
        → JSON-RPC SendMessage
        → Finance Agent Task: submitted → working
        → MCP list_absences → PostgreSQL
        → calculadora determinista
        → A2A Artifact application/json
        → Task completed → reporte + TraceEvent[]
```

Los endpoints A2A usan un bearer token interno aleatorio. La Agent Card describe el esquema de seguridad pero nunca contiene la credencial.

La base no contiene salarios. Por eso el reporte exige parámetros explícitos: moneda, costo diario, prima de reemplazo e impacto de productividad. La fórmula es:

```text
días × costo diario × (1 + prima de reemplazo + impacto de productividad)
```

El LLM no realiza la aritmética. Una función TypeScript determinista calcula importes redondeados a dos decimales. Si MCP indica que el resultado fue truncado, el agente rechaza el cálculo para evitar un reporte incompleto.

La implementación utiliza tareas A2A en memoria porque el flujo es breve y síncrono. Para múltiples instancias o tareas largas, el `TaskStore` deberá migrarse a almacenamiento persistente.

Prueba real de Agent Card, A2A, MCP y Neon:

```bash
npm run a2a:smoke
```

## Evaluaciones del agente

Los tests unitarios validan funciones y contratos con dependencias controladas. La suite de evaluaciones mide el comportamiento completo del agente real con el modelo configurado, MCP y PostgreSQL.

Casos implementados:

- `known-late-arrivals`: compara herramienta, grounding y cantidad contra el dataset sembrado;
- `unknown-employee`: exige resultado PostgreSQL vacío y una respuesta explícita sin datos inventados;
- `source-of-truth-freshness`: inserta un empleado temporal único y una llegada tarde, consulta el registro recién creado y comprueba que el agente observa la actualización.

La fixture dinámica usa el rol administrativo sólo durante la preparación y limpieza. La consulta del agente continúa usando el rol read-only. Un bloque `finally` elimina por UUID y número de empleado exactos; al finalizar, una consulta adicional exige que no existan empleados `EVAL-%` ni asistencias con fuente `agent-evaluation`.

Ejecución real con Ollama local, MCP y Neon:

```bash
npm run evals:run
```

El comando devuelve un JSON reproducible con `passRate`, duración, checks esperados/reales y evidencia grounded por caso. Finaliza con código distinto de cero si falla una evaluación o si queda alguna fixture temporal. El caso de referencia presupone que el seed de demostración está presente.

## Deployment cloud

`render.yaml` define dos servicios independientes desde el mismo repositorio:

- `agent-lab-ignac`: frontend Vite como Static Site gratuito;
- `agent-lab-api-ignac`: backend Express como Web Service gratuito en Virginia.

El static site reescribe `/api/*` hacia el backend. Para el navegador, autenticación y cookies continúan bajo el origen del frontend; el token de sesión permanece `HttpOnly` y no se expone a React.

En desarrollo local, `LLM_PROVIDER=ollama` conserva `qwen3:8b`. En Render, el Blueprint configura `LLM_PROVIDER=groq` y `openai/gpt-oss-20b`, que soporta function calling. El adaptador Groq usa el endpoint compatible con OpenAI Chat Completions, fuerza al menos una herramienta y devuelve su resultado al modelo para producir la respuesta grounded.

El backend público añade:

- headers HTTP de seguridad mediante Helmet;
- límite de 10 intentos de login cada 15 minutos por IP;
- límite de 30 ejecuciones de agente o finanzas por minuto por IP;
- health check `GET /api/health`;
- secretos declarados con `sync: false` o generados por Render.

El build del backend usa `npm ci --include=dev` porque TypeScript y `@types/node` son dependencias de compilación. Render configura `NODE_ENV=production` para el servicio; sin esa opción, npm omitiría las herramientas necesarias antes de ejecutar `tsc`.

Render Free es apropiado para esta demostración. El Web Service se suspende luego de 15 minutos sin tráfico y el primer acceso posterior puede tardar aproximadamente un minuto. El filesystem es efímero; el estado persistente continúa en Neon.
