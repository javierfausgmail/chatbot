# Debugging

This project has four main debugging surfaces: the Next.js app, browser UI, Playwright tests, and the Blender worker used for printable 3D model generation.

## Local Stack

Start the local services:

```bash
pnpm docker:up
```

Rebuild and restart the Blender worker after worker changes:

```bash
pnpm worker:build
pnpm worker:restart
```

Follow worker logs:

```bash
pnpm docker:logs:blender
```

## Next.js Server

Start Next.js with the Node inspector enabled:

```bash
pnpm dev:debug
```

Use VS Code configuration `Next.js: attach server` or launch `Next.js: debug server` directly.

Useful breakpoints:

- `app/(chat)/api/chat/route.ts`
- `lib/ai/tools/create-3d-model.ts`
- `lib/3d/providers/blender.ts`
- `app/(chat)/api/3d/jobs/[id]/route.ts`

## Browser UI

Use VS Code configuration `Chrome: attach frontend` while the app is running at `http://localhost:3000`.

Useful breakpoints:

- `artifacts/model3d/client.tsx`
- `components/chat/artifact.tsx`
- `components/chat/data-stream-handler.tsx`

## Blender Worker

The worker supports optional Python debugging through `debugpy`.

Enable it by setting these environment variables before restarting the worker:

```bash
BLENDER_DEBUGPY=1
BLENDER_DEBUGPY_WAIT=1
```

Then run:

```bash
pnpm worker:restart
```

Use VS Code configuration `Blender Worker: attach Python`. The worker listens on port `5678` and maps local `workers/blender` to remote `/worker`.

Useful breakpoints:

- `workers/blender/server.py`
- `workers/blender/generate_scene.py`

## 3D Smoke Test

Run the default cube fixture:

```bash
pnpm debug:3d:smoke
```

Run a specific fixture:

```bash
pnpm debug:3d:smoke workers/blender/fixtures/phone-stand.scene.json
```

The smoke test posts a job to `BLENDER_WORKER_URL`, polls until completion, and verifies that `model.glb`, `model.blend`, `model.stl`, and `scene.json` were generated.

## Playwright

Run tests:

```bash
pnpm test
```

Open the Playwright UI:

```bash
pnpm test:ui
```

Debug tests:

```bash
pnpm test:debug
```

## Database And Redis

Open Drizzle Studio:

```bash
pnpm db:studio
```

Inspect Postgres:

```bash
docker exec -it chatbot-postgres16 psql -U chatbot -d chatbot
```

Inspect Redis:

```bash
docker exec -it chatbot-redis redis-cli
```

## 3D Pipeline Checklist

- The chat route calls `create3DModel`.
- The tool creates a `Model3DJob` row.
- `lib/3d/providers/blender.ts` posts the scene to `BLENDER_WORKER_URL`.
- The worker writes files under `/outputs`, mounted to `public/generated-3d`.
- `GET /api/3d/jobs/[id]` syncs worker status back into the database.
- `artifacts/model3d/client.tsx` polls and renders/downloads generated files.

## Common Issues

- If `pnpm test` fails to start on Windows, confirm `cross-env` is installed and the script uses `cross-env PLAYWRIGHT=True`.
- If VS Code cannot attach to the worker, confirm `BLENDER_DEBUGPY=1`, port `5678` is exposed, and the worker was recreated.
- If the smoke test cannot connect, confirm `pnpm docker:up` is running and `BLENDER_WORKER_URL` points to `http://localhost:8010`.
- If generated files are missing, inspect `pnpm docker:logs:blender` first.
