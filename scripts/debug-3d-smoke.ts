import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

type WorkerJob = {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  files?: Array<{ format: string; filename: string; size?: number }>;
  error?: string | null;
};

const workerUrl = process.env.BLENDER_WORKER_URL ?? "http://localhost:8010";
const fixturePath = path.resolve(
  process.argv[2] ?? "workers/blender/fixtures/cube.scene.json"
);
const timeoutMs = Number(process.env.SMOKE_3D_TIMEOUT_MS ?? 180_000);
const pollMs = Number(process.env.SMOKE_3D_POLL_MS ?? 1000);
const requiredFormats = new Set(["glb", "blend", "stl", "scene"]);

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `${init?.method ?? "GET"} ${url} failed: ${response.status} ${body}`
    );
  }

  return JSON.parse(body) as T;
}

async function main() {
  const scene = JSON.parse(await readFile(fixturePath, "utf-8"));
  const safeName = path.basename(fixturePath).replace(/[^a-zA-Z0-9.-]/g, "-");
  const jobId = `smoke-${Date.now()}-${safeName}`;

  console.log(`Posting ${jobId} to ${workerUrl}`);
  await requestJson<WorkerJob>(`${workerUrl}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId, scene }),
  });

  const startedAt = Date.now();
  let job: WorkerJob | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    job = await requestJson<WorkerJob>(`${workerUrl}/jobs/${jobId}`);
    console.log(`status=${job.status}`);

    if (job.status === "completed" || job.status === "failed") {
      break;
    }

    await sleep(pollMs);
  }

  if (!job) {
    throw new Error("Worker did not return a job status");
  }

  if (job.status !== "completed") {
    throw new Error(
      `Job ${jobId} did not complete: ${job.status} ${job.error ?? ""}`
    );
  }

  const exported = new Set(job.files?.map((file) => file.format) ?? []);
  const missing = [...requiredFormats].filter(
    (format) => !exported.has(format)
  );

  if (missing.length > 0) {
    throw new Error(
      `Job ${jobId} is missing generated files: ${missing.join(", ")}`
    );
  }

  console.log(`Smoke test completed for ${jobId}`);
  for (const file of job.files ?? []) {
    console.log(`${file.format}: ${file.filename} (${file.size ?? 0} bytes)`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
