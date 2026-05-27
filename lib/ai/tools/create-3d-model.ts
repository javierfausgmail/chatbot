import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { createModel3DJob } from "@/lib/3d/orchestrator";
import { model3DProviderIds, printable3DSceneSchema } from "@/lib/3d/types";
import { saveDocument } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type Create3DModelProps = {
  chatId: string;
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const create3DModel = ({
  chatId,
  session,
  dataStream,
}: Create3DModelProps) =>
  tool({
    description:
      "Create a 3D model artifact after the user has explicitly chosen a provider. If the user asks for a 3D model but has not selected a provider, ask them to choose Blender or Tripo3D and do not call this tool yet. Use Blender for precise printable CAD-like parts in real millimeters. Use Tripo3D for organic/visual text-to-3D models; it uses external API credits, so keep requests concise and low complexity.",
    inputSchema: z.object({
      provider: z
        .enum(model3DProviderIds)
        .describe(
          "The user-selected generation provider. Must be 'blender' or 'tripo3d'."
        ),
      title: z.string().min(1).max(120).describe("Short model title"),
      prompt: z
        .string()
        .min(1)
        .max(2000)
        .describe("Original user request and relevant assumptions"),
      scene: printable3DSceneSchema.describe(
        "Validated scene JSON in millimeters. Blender uses this scene directly; Tripo3D uses the prompt but the scene is kept as reproducible metadata."
      ),
      sourceJobId: z
        .string()
        .uuid()
        .optional()
        .describe("Previous 3D job id when creating a new revision"),
    }),
    execute: async ({ provider, title, prompt, scene, sourceJobId }) => {
      if (!session.user?.id) {
        throw new Error("Unauthorized");
      }

      const id = generateUUID();

      dataStream.write({ type: "data-kind", data: "model3d", transient: true });
      dataStream.write({ type: "data-id", data: id, transient: true });
      dataStream.write({ type: "data-title", data: title, transient: true });
      dataStream.write({ type: "data-clear", data: null, transient: true });

      const content = await createModel3DJob({
        chatId,
        userId: session.user.id,
        documentId: id,
        provider,
        title,
        prompt,
        scene,
        sourceJobId,
      });

      await saveDocument({
        id,
        title,
        kind: "model3d",
        content: JSON.stringify(content),
        userId: session.user.id,
      });

      dataStream.write({
        type: "data-model3dDelta",
        data: JSON.stringify(content),
        transient: true,
      });
      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title,
        kind: "model3d",
        content:
          "A 3D model job was created and is now visible to the user. The artifact will update when the selected provider finishes exporting files.",
      };
    },
  });
