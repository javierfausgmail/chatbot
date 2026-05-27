import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createModel3DJob,
  getModel3DFilesByJobId,
  getModel3DJobById,
  replaceModel3DFiles,
  updateModel3DJobProviderData,
  updateModel3DJobStatus,
} from "@/lib/db/queries";
import {
  createGenerated3DFile,
  getModel3DOutputPath,
} from "../storage";
import type {
  CreateModel3DJobInput,
  Generated3DFile,
  Model3DArtifactContent,
  Model3DProvider,
} from "../types";

const TRIPO3D_API_BASE_URL =
  process.env.TRIPO3D_API_BASE_URL ?? "https://api.tripo3d.ai/v2/openapi";
const TRIPO3D_FACE_LIMIT = Number(process.env.TRIPO3D_FACE_LIMIT ?? 3000);
const TRIPO3D_TEXTURE = ["1", "true"].includes(
  process.env.TRIPO3D_TEXTURE ?? ""
);

type Tripo3DTaskStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "cancelled";

type Tripo3DTaskResponse = {
  code: number;
  message?: string;
  data?: {
    task_id: string;
    status?: Tripo3DTaskStatus;
    output?: {
      model?: string;
      rendered_image?: string;
      generated_image?: string;
    };
    progress?: number;
    consumed_credit?: number;
    result?: unknown;
  };
};

function toArtifactContent({
  job,
  files,
}: {
  job: NonNullable<Awaited<ReturnType<typeof getModel3DJobById>>>;
  files: Generated3DFile[];
}): Model3DArtifactContent {
  return {
    jobId: job.id,
    status: job.status,
    provider: job.provider,
    title: job.title,
    prompt: job.prompt,
    units: "mm",
    printable: true,
    files,
    scene: job.sceneJson as Model3DArtifactContent["scene"],
    error: job.error,
  };
}

function getApiKey() {
  return process.env.TRIPO3D_API_KEY;
}

function mapTripo3DStatus(status?: Tripo3DTaskStatus) {
  if (status === "success") {
    return "completed" as const;
  }
  if (status === "failed" || status === "cancelled") {
    return "failed" as const;
  }
  if (status === "running") {
    return "running" as const;
  }
  return "queued" as const;
}

async function createRemoteTask(input: CreateModel3DJobInput) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("TRIPO3D_API_KEY is not configured");
  }

  const body: Record<string, unknown> = {
    type: "text_to_model",
    prompt: input.prompt,
    texture: TRIPO3D_TEXTURE,
    pbr: false,
    geometry_quality: "standard",
    face_limit: Number.isFinite(TRIPO3D_FACE_LIMIT) ? TRIPO3D_FACE_LIMIT : 3000,
  };

  if (TRIPO3D_TEXTURE) {
    body.texture_quality = "standard";
  }

  if (process.env.TRIPO3D_MODEL_VERSION) {
    body.model_version = process.env.TRIPO3D_MODEL_VERSION;
  }

  const response = await fetch(`${TRIPO3D_API_BASE_URL}/task`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as
    | Tripo3DTaskResponse
    | null;

  if (!(response.ok && payload?.code === 0 && payload.data?.task_id)) {
    throw new Error(payload?.message ?? "Failed to create Tripo3D task");
  }

  return { taskId: payload.data.task_id, request: body, response: payload.data };
}

async function getRemoteTask(taskId: string) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("TRIPO3D_API_KEY is not configured");
  }

  const response = await fetch(`${TRIPO3D_API_BASE_URL}/task/${taskId}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | Tripo3DTaskResponse
    | null;

  if (!(response.ok && payload?.code === 0 && payload.data)) {
    throw new Error(payload?.message ?? "Failed to get Tripo3D task");
  }

  return payload.data;
}

async function downloadModel({
  jobId,
  modelUrl,
  scene,
}: {
  jobId: string;
  modelUrl: string;
  scene: unknown;
}) {
  const outputPath = getModel3DOutputPath(jobId);
  await mkdir(outputPath, { recursive: true });

  const response = await fetch(modelUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to download Tripo3D GLB output");
  }

  const filePath = path.join(outputPath, "model.glb");
  await writeFile(filePath, Buffer.from(await response.arrayBuffer()));

  const scenePath = path.join(outputPath, "scene.json");
  await writeFile(scenePath, JSON.stringify(scene, null, 2));

  const glbStats = await stat(filePath);
  const sceneStats = await stat(scenePath);

  return [
    createGenerated3DFile({
      jobId,
      format: "glb",
      filename: "model.glb",
      size: glbStats.size,
    }),
    createGenerated3DFile({
      jobId,
      format: "scene",
      filename: "scene.json",
      size: sceneStats.size,
    }),
  ];
}

export const tripo3DProvider: Model3DProvider = {
  id: "tripo3d",
  async createJob(input: CreateModel3DJobInput) {
    let job = await createModel3DJob({
      id: input.documentId,
      chatId: input.chatId,
      userId: input.userId,
      documentId: input.documentId,
      title: input.title,
      prompt: input.prompt,
      provider: this.id,
      sceneJson: input.scene,
      sourceJobId: input.sourceJobId,
    });

    try {
      const remoteTask = await createRemoteTask(input);
      job =
        (await updateModel3DJobProviderData({
          id: job.id,
          externalJobId: remoteTask.taskId,
          providerData: remoteTask,
        })) ?? job;
      job =
        (await updateModel3DJobStatus({
          id: job.id,
          status: "running",
          error: null,
        })) ?? job;
    } catch (error) {
      job =
        (await updateModel3DJobStatus({
          id: job.id,
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : "Failed to contact Tripo3D",
        })) ?? job;
    }

    return toArtifactContent({ job, files: [] });
  },
  async syncJob(jobId: string) {
    const job = await getModel3DJobById({ id: jobId });
    if (!job) {
      return null;
    }

    let currentJob = job;

    try {
      if (!job.externalJobId) {
        throw new Error("Tripo3D task id is missing");
      }

      const remoteTask = await getRemoteTask(job.externalJobId);
      const status = mapTripo3DStatus(remoteTask.status);

      currentJob =
        (await updateModel3DJobStatus({
          id: jobId,
          status,
          error: status === "failed" ? "Tripo3D generation failed" : null,
        })) ?? currentJob;

      await updateModel3DJobProviderData({
        id: jobId,
        externalJobId: remoteTask.task_id,
        providerData: remoteTask,
      });

      const modelUrl = remoteTask.output?.model;

      if (status === "completed" && !modelUrl) {
        currentJob =
          (await updateModel3DJobStatus({
            id: jobId,
            status: "failed",
            error: "Tripo3D completed without a GLB output",
          })) ?? currentJob;
      } else if (status === "completed" && modelUrl) {
        const existingFiles = await getModel3DFilesByJobId({ jobId });
        if (!existingFiles.some((file) => file.format === "glb")) {
          await replaceModel3DFiles({
            jobId,
            files: await downloadModel({
              jobId,
              modelUrl,
              scene: job.sceneJson,
            }),
          });
        }
      }
    } catch (error) {
      currentJob =
        (await updateModel3DJobStatus({
          id: jobId,
          status: "failed",
          error:
            error instanceof Error ? error.message : "Failed to sync Tripo3D job",
        })) ?? currentJob;
    }

    const files = await getModel3DFilesByJobId({ jobId });

    return toArtifactContent({
      job: currentJob,
      files: files.map((file) => ({
        format: file.format,
        pathname: file.pathname,
        url: file.url,
        size: typeof file.size === "number" ? file.size : undefined,
      })),
    });
  },
};
