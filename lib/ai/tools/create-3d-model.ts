import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { createModel3DJob } from "@/lib/3d/orchestrator";
import { printable3DSceneSchema } from "@/lib/3d/types";
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
      "Create a printable 3D model artifact in real millimeters. Use this when the user asks for a 3D model, STL, 3D printing part, CAD-like object, holder, bracket, enclosure, organizer, adapter, sign, or physical object. Generate a safe structured scene JSON using only allowed primitives. Prefer practical printable parts with simple geometry, real dimensions, and millimeter units.",
    inputSchema: z.object({
      title: z.string().min(1).max(120).describe("Short model title"),
      prompt: z
        .string()
        .min(1)
        .max(2000)
        .describe("Original user request and relevant assumptions"),
      scene: printable3DSceneSchema.describe(
        "Validated scene JSON. Units must be mm and exports must include glb, blend, and stl."
      ),
      sourceJobId: z
        .string()
        .uuid()
        .optional()
        .describe("Previous 3D job id when creating a new revision"),
    }),
    execute: async ({ title, prompt, scene, sourceJobId }) => {
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
          "A printable 3D model job was created and is now visible to the user. The artifact will update when Blender finishes exporting GLB, BLEND, and STL files.",
      };
    },
  });
