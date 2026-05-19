<a href="https://chatbot.ai-sdk.dev/demo">
  <img alt="Chatbot" src="app/(chat)/opengraph-image.png">
  <h1 align="center">Chatbot</h1>
</a>

<p align="center">
  Chatbot (formerly AI Chatbot) is a free, open-source template built with Next.js and the AI SDK.
  Version 3.1.1 is a stable zero-vendor-lockin base: OpenAI-compatible provider instead of AI Gateway,
  local file storage instead of Vercel Blob, and standalone deployment without Vercel-specific runtime services.
</p>

<br />

## Stable Release

**Current stable version: `3.1.1`**

This release is intended as a clean base for future developments. It includes:

- Persistent chat with PostgreSQL.
- Auth.js authentication with guest access.
- Configurable OpenAI-compatible model provider.
- Local upload storage under `public/uploads`.
- Optional Redis support for resumable streams.
- Sidebar action to rename chats.
- Standalone Next.js output for self-hosted deployments.
- No runtime dependency on Vercel AI Gateway, Vercel Blob, BotID, Vercel Functions, or Vercel OTel.

Downloads for this stable base are available from the GitHub release tag `v3.1.1`.

## Requirements

- **Node.js** >= 20
- **pnpm** 10.32.1 (`corepack enable` recommended)
- **PostgreSQL** 16 (via `docker-compose.local.yml` or your own instance)
- **Redis** 7 (opcional, para streams reanudables)
- Opcional: **LM Studio**, **Ollama**, **NVIDIA NIM**, o cualquier proveedor OpenAI-compatible

## Configuración inicial

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd chatbot
corepack enable
pnpm install
```

### 2. Servicios con Docker (recomendado)

```bash
docker compose -f docker-compose.local.yml up -d
```

Esto levanta:
- **PostgreSQL 16** en puerto `5433`
- **Redis 7** en puerto `6379`
- **MinIO** (S3-compatible) en puerto `9000` (API) y `9001` (console)

### 3. Variables de entorno

Copia `.env.example` a `.env.local` y ajústalo:

```bash
cp .env.example .env.local
```

Ejemplo completo:

```env
# Autenticación — genera un secreto con: openssl rand -base64 32
AUTH_SECRET=your-secret-here

# Base de datos PostgreSQL
POSTGRES_URL=postgres://chatbot:chatbot@localhost:5433/chatbot

# Redis (opcional, para streams reanudables)
REDIS_URL=redis://localhost:6379

# Proveedor OpenAI-compatible
# Para LM Studio local:
OPENAI_COMPATIBLE_BASE_URL=http://localhost:1234/v1
OPENAI_COMPATIBLE_API_KEY=not-needed
OPENAI_COMPATIBLE_PROVIDER_NAME=lmstudio

# Para NVIDIA NIM / NVIDIA Integrate:
# OPENAI_COMPATIBLE_BASE_URL=https://integrate.api.nvidia.com/v1
# OPENAI_COMPATIBLE_API_KEY=su-api-key
# OPENAI_COMPATIBLE_PROVIDER_NAME=nvidia

# ID del modelo que usará el proveedor
CHAT_MODEL_ID=escriba-aqui-el-modelo-real
TITLE_MODEL_ID=escriba-aqui-el-modelo-real

# Base URL pública para subida de archivos
UPLOAD_PUBLIC_BASE_URL=http://localhost:3000
```

> **Nota**: No commitees `.env.local`. Contiene secretos de autenticación y acceso a proveedores.

### 4. Migrar la base de datos

```bash
pnpm db:migrate
```

### 5. Ejecutar en desarrollo

```bash
pnpm dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Inicia servidor de desarrollo con Turbopack |
| `pnpm build` | Ejecuta migraciones y construye para producción |
| `pnpm start` | Inicia servidor de producción |
| `pnpm check` | Analiza el código con Ultracite (lint + formato) |
| `pnpm fix` | Corrige automáticamente errores de lint y formato |
| `pnpm test` | Ejecuta tests E2E con Playwright |
| `pnpm db:migrate` | Ejecuta migraciones pendientes de Drizzle |
| `pnpm db:generate` | Genera nuevas migraciones tras cambiar esquemas |
| `pnpm db:studio` | Abre Drizzle Studio para explorar la BD |
| `pnpm db:push` | Pushea el esquema directamente a la BD |
| `pnpm db:pull` | Extrae el esquema desde la BD existente |

## Debugging (VS Code)

Crea `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: Debug dev",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev",
      "serverReadyAction": {
        "pattern": "Local:.+(https?://[^:]+(:\\d+)?)",
        "uriFormat": "%s",
        "action": "openExternally"
      }
    },
    {
      "name": "Next.js: Debug server-side",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

Para debugging server-side, inicia con `NODE_OPTIONS='--inspect' pnpm dev`.

## Linting y formato

Usamos [Ultracite](https://ultracite.dev) (que a su vez usa Biome) para linting y formato:

```bash
pnpm check    # Verifica errores
pnpm fix      # Corrige automáticamente
```

La configuración está en `biome.jsonc`. También puedes integrarlo en tu editor con la extensión de Biome.

## Arquitectura

```
app/
  (auth)/        → Autenticación (Auth.js)
  (chat)/        → Chat, API routes, server actions
    api/
      chat/      → POST (mensaje), DELETE (eliminar chat)
      files/     → Subida de archivos a public/uploads
      history/   → Historial paginado de chats
      vote/      → Votación de mensajes
components/
  chat/          → Componentes UI del chat
lib/
  ai/            → Proveedores, modelos, prompts y tools
  db/            → Drizzle ORM, esquemas y queries
```

## Despliegue

El proyecto genera una build autocontenida con `output: "standalone"`:

```bash
pnpm build
```

La carpeta `.next/standalone` contiene todo lo necesario para desplegar en cualquier servidor Node.js sin depender de Vercel.

## Versionado

El proyecto usa tags Git para marcar versiones estables. La versión actual está definida en `package.json` y documentada en `CHANGELOG.md`.

Para recuperar esta base estable en el futuro:

```bash
git checkout v3.1.1
```
