# Agent Lab

[![CI](https://github.com/TatooCollado/agent-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/TatooCollado/agent-lab/actions/workflows/ci.yml)
[![Production Smoke](https://github.com/TatooCollado/agent-lab/actions/workflows/production-smoke.yml/badge.svg)](https://github.com/TatooCollado/agent-lab/actions/workflows/production-smoke.yml)

Aplicación educativa para inspeccionar el flujo técnico de agentes de IA sobre datos empresariales. El proyecto muestra contratos, protocolos, llamadas a herramientas, resultados estructurados y trazas sanitizadas.

## Estado

Etapas 1 a 8 — Fundación, MCP, Agent Runtime, Auth/RBAC, A2A, evaluaciones, cloud y entrega automatizada:

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

La aplicación está desplegada con frontend estático en Render, backend serverless en Vercel y PostgreSQL en Neon. GitHub Actions aplica quality gates y smoke tests contra producción.

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

El repositorio conserva `frontend/` y `backend/` separados, con dos superficies de despliegue:

- `agent-lab-ignac`: frontend Vite como Render Static Site;
- `agent-lab-api-ignac`: backend Express como una Vercel Function con Fluid Compute.

URLs de producción:

- aplicación: `https://agent-lab-ignac.onrender.com`;
- API: `https://agent-lab-api-ignac.vercel.app`;
- health check directo: `https://agent-lab-api-ignac.vercel.app/api/health`.

`render.yaml` sólo administra el frontend y reescribe `/api/*` hacia `https://agent-lab-api-ignac.vercel.app`. Para el navegador, autenticación y cookies continúan bajo el origen del frontend; el token de sesión permanece `HttpOnly` y no se expone a React.

`backend/vercel.json` declara Express, un máximo de 300 segundos y la región `gru1` (São Paulo), cercana a la base Neon. Vercel detecta el handler lazy exportado por `src/app.ts`; la aplicación y sus pools se inicializan al recibir la primera request de una instancia. `src/server.ts` conserva `app.listen()` para desarrollo local.

El transporte MCP se selecciona mediante `MCP_TRANSPORT`:

- `stdio`: desarrollo local; el cliente inicia un proceso MCP independiente;
- `in_process`: Vercel; cliente y servidor MCP se conectan con un par de transportes en memoria, sin perder el protocolo, contratos, validación ni tool discovery.

En desarrollo local, `LLM_PROVIDER=ollama` conserva `qwen3:8b`. En Vercel, `LLM_PROVIDER=groq` usa `openai/gpt-oss-20b`, que soporta function calling. El adaptador Groq fuerza al menos una herramienta y devuelve su resultado al modelo para producir la respuesta grounded.

Variables de producción requeridas en el proyecto Vercel:

```text
NODE_ENV=production
FRONTEND_ORIGIN=https://agent-lab-ignac.onrender.com
APP_TIMEZONE=America/Argentina/Buenos_Aires
SESSION_TTL_HOURS=8
PUBLIC_BASE_URL=https://agent-lab-api-ignac.vercel.app
MCP_TRANSPORT=in_process
LLM_PROVIDER=groq
GROQ_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=<secret>
DATABASE_READONLY_URL=<secret>
DATABASE_ADMIN_URL=<secret>
A2A_INTERNAL_TOKEN=<secret-aleatorio-de-32-o-mas-caracteres>
```

El backend público añade headers con Helmet, rate limits, manejo explícito de errores y `GET /api/health`. Los límites en memoria son demostrativos y operan por instancia caliente; una aplicación productiva distribuida usaría un store compartido. PostgreSQL conserva usuarios, sesiones y datos, por lo que el filesystem serverless permanece descartable.

## CI/CD y quality gates

Cada `push` a `main` y cada pull request ejecutan `.github/workflows/ci.yml`. Backend y frontend se validan en jobs independientes y reproducibles sobre Node.js 22:

```text
checkout → npm ci → typecheck → build → tests → audit de dependencias productivas
```

`npm ci` instala exactamente el árbol fijado por cada `package-lock.json`. Los jobs sólo poseen permiso de lectura del repositorio, tienen timeout y cancelan ejecuciones anteriores de la misma rama. Ninguna credencial de producción se entrega al workflow de CI.

Vercel está conectado al repositorio con `backend/` como Root Directory; un commit aceptado en `main` genera el despliegue serverless. Render mantiene el frontend estático desde `frontend/`. Esta separación distingue dos controles:

- **quality gate previo al runtime:** tipos, compilación, tests y auditoría;
- **smoke test posterior al deployment:** contrato HTTP público realmente desplegado.

`.github/workflows/production-smoke.yml` escucha estados exitosos de deployment y también permite ejecución manual. `scripts/production-smoke.mjs` comprueba:

- health directo del backend Vercel;
- contrato de `/api/system` y etapa vigente;
- proxy `/api/*` servido bajo el origen Render;
- disponibilidad del documento HTML del frontend.

Ejecución local del mismo contrato de producción:

```bash
node scripts/production-smoke.mjs
```
