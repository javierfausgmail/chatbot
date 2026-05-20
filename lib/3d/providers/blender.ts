import { mkdir } from "node:fs/promises";
import {
  createModel3DJob,
  getModel3DFilesByJobId,
  getModel3DJobById,
  replaceModel3DFiles,
  updateModel3DJobStatus,
} from "@/lib/db/queries";
import {
  createGenerated3DFile,
  getModel3DOutputPath,
  getModel3DWorkerOutputPath,
} from "../storage";
import type {
  CreateModel3DJobInput,
  Generated3DFile,
  Model3DArtifactContent,
  Model3DProvider,
} from "../types";

const BLENDER_WORKER_URL =
  process.env.BLENDER_WORKER_URL ?? "http://localhost:8010";

type BlenderWorkerFile = {
  format: Generated3DFile["format"];
  filename: string;
  size?: number;
};

type BlenderWorkerJob = {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  files?: BlenderWorkerFile[];
  error?: string | null;
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

async function syncWorkerJob(jobId: string): Promise<BlenderWorkerJob | null> {
  const response = await fetch(`${BLENDER_WORKER_URL}/jobs/${jobId}`, {
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  return (await response.json()) as BlenderWorkerJob;
}

export const blenderProvider: Model3DProvider = {
  id: "blender",
  async createJob(input: CreateModel3DJobInput) {
    await mkdir(getModel3DOutputPath(input.documentId), { recursive: true });

    const job = await createModel3DJob({
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

    await fetch(`${BLENDER_WORKER_URL}/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        scene: input.scene,
        outputDir: getModel3DWorkerOutputPath(job.id),
      }),
    }).catch(async (error) => {
      await updateModel3DJobStatus({
        id: job.id,
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Failed to contact Blender worker",
      });
    });

    return toArtifactContent({ job, files: [] });
  },
  async syncJob(jobId: string) {
    const job = await getModel3DJobById({ id: jobId });
    if (!job) {
      return null;
    }

    const workerJob = await syncWorkerJob(jobId);
    let currentJob = job;

    if (workerJob) {
      const updatedJob = await updateModel3DJobStatus({
        id: jobId,
        status: workerJob.status,
        error: workerJob.error,
      });
      currentJob = updatedJob ?? job;

      if (workerJob.files?.length) {
        await replaceModel3DFiles({
          jobId,
          files: workerJob.files.map((file) =>
            createGenerated3DFile({
              jobId,
              format: file.format,
              filename: file.filename,
              size: file.size,
            })
          ),
        });
      }
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
