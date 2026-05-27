import { getModel3DJobById } from "@/lib/db/queries";
import { blenderProvider } from "./providers/blender";
import { tripo3DProvider } from "./providers/tripo3d";
import type { CreateModel3DJobInput } from "./types";

const providers = {
  blender: blenderProvider,
  tripo3d: tripo3DProvider,
};

export function createModel3DJob(input: CreateModel3DJobInput) {
  return providers[input.provider].createJob(input);
}

export async function syncModel3DJob(jobId: string) {
  const job = await getModel3DJobById({ id: jobId });
  const provider = job?.provider as keyof typeof providers | undefined;

  if (!provider || !(provider in providers)) {
    return null;
  }

  return providers[provider].syncJob(jobId);
}
