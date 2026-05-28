import { z } from "zod";

export const model3DFormats = ["glb", "blend", "stl", "scene"] as const;
export type Model3DFormat = (typeof model3DFormats)[number];

export const model3DProviderIds = ["blender", "tripo3d"] as const;
export type Model3DProviderId = (typeof model3DProviderIds)[number];

export const tripo3DPresets = [
  "fast",
  "balanced",
  "max_quality",
  "custom",
] as const;

export const tripo3DOptionsSchema = z.object({
  preset: z.enum(tripo3DPresets).optional(),
  model_version: z.string().min(1).max(64).optional(),
  negative_prompt: z.string().min(1).max(255).optional(),
  texture: z.boolean().optional(),
  pbr: z.boolean().optional(),
  texture_quality: z.enum(["standard", "detailed"]).optional(),
  geometry_quality: z.enum(["standard", "detailed"]).optional(),
  face_limit: z.number().int().positive().max(2_000_000).optional(),
  smart_low_poly: z.boolean().optional(),
  quad: z.boolean().optional(),
  generate_parts: z.boolean().optional(),
  auto_size: z.boolean().optional(),
  export_uv: z.boolean().optional(),
  image_seed: z.number().int().optional(),
  model_seed: z.number().int().optional(),
  texture_seed: z.number().int().optional(),
  compress: z.enum(["geometry"]).optional(),
});

export type Tripo3DOptions = z.infer<typeof tripo3DOptionsSchema>;

export const primitive3DObjectSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(["box", "cylinder", "sphere", "wedge", "text"]),
  size: z
    .tuple([
      z.number().positive(),
      z.number().positive(),
      z.number().positive(),
    ])
    .optional(),
  radius: z.number().positive().optional(),
  depth: z.number().positive().optional(),
  text: z.string().min(1).max(80).optional(),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  fillet: z.number().min(0).max(20).optional(),
  material: z.string().max(64).optional(),
});

export const model3DOperationSchema = z.object({
  type: z.enum(["union", "difference"]),
  objects: z.array(z.string().min(1)).min(1),
  target: z.string().min(1).optional(),
});

export const printable3DSceneSchema = z.object({
  version: z.literal("1"),
  units: z.literal("mm"),
  metadata: z.object({
    title: z.string().min(1).max(120),
    printable: z.literal(true),
    description: z.string().max(500).optional(),
  }),
  objects: z.array(primitive3DObjectSchema).min(1).max(40),
  operations: z.array(model3DOperationSchema).max(40).default([]),
  exports: z
    .array(z.enum(["glb", "blend", "stl"]))
    .default(["glb", "blend", "stl"]),
});

export type Printable3DScene = z.infer<typeof printable3DSceneSchema>;

export type Generated3DFile = {
  format: Model3DFormat;
  pathname: string;
  url: string;
  size?: number;
};

export type Model3DArtifactContent = {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  provider: string;
  title: string;
  prompt: string;
  units: "mm";
  printable: true;
  files: Generated3DFile[];
  scene: Printable3DScene;
  error?: string | null;
};

export type CreateModel3DJobInput = {
  chatId: string;
  userId: string;
  documentId: string;
  provider: Model3DProviderId;
  title: string;
  prompt: string;
  scene: Printable3DScene;
  tripo3dOptions?: Tripo3DOptions;
  sourceJobId?: string;
};

export type Model3DProvider = {
  id: Model3DProviderId;
  createJob(input: CreateModel3DJobInput): Promise<Model3DArtifactContent>;
  syncJob(jobId: string): Promise<Model3DArtifactContent | null>;
};
