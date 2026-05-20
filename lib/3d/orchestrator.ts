import { blenderProvider } from "./providers/blender";
import type { CreateModel3DJobInput } from "./types";

const providers = {
  blender: blenderProvider,
};

export function createModel3DJob(input: CreateModel3DJobInput) {
  return providers.blender.createJob(input);
}

export function syncModel3DJob(jobId: string) {
  return providers.blender.syncJob(jobId);
}
