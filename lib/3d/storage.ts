import path from "node:path";
import type { Generated3DFile, Model3DFormat } from "./types";

const PUBLIC_BASE_URL =
  process.env.UPLOAD_PUBLIC_BASE_URL ?? "http://localhost:3000";

export function getModel3DOutputPath(jobId: string) {
  return path.join(process.cwd(), "public", "generated-3d", jobId);
}

export function getModel3DWorkerOutputPath(jobId: string) {
  return `${process.env.BLENDER_WORKER_OUTPUT_ROOT ?? "/outputs"}/${jobId}`;
}

export function getModel3DPublicPath(jobId: string, filename: string) {
  return `/generated-3d/${jobId}/${filename}`;
}

export function createGenerated3DFile({
  jobId,
  format,
  filename,
  size,
}: {
  jobId: string;
  format: Model3DFormat;
  filename: string;
  size?: number;
}): Generated3DFile {
  const pathname = getModel3DPublicPath(jobId, filename);

  return {
    format,
    pathname,
    url: `${PUBLIC_BASE_URL}${pathname}`,
    size,
  };
}
