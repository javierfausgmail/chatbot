import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const jobIdRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const contentTypes = new Map([
  ["model.glb", "model/gltf-binary"],
  ["model.blend", "application/octet-stream"],
  ["model.stl", "model/stl"],
  ["scene.json", "application/json"],
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string; filename: string }> }
) {
  const { jobId, filename } = await params;
  const contentType = contentTypes.get(filename);

  if (!(jobIdRegex.test(jobId) && contentType)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(
    process.cwd(),
    "public",
    "generated-3d",
    jobId,
    filename
  );

  try {
    const [{ size }, file] = await Promise.all([
      stat(filePath),
      readFile(filePath),
    ]);

    return new NextResponse(file, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Length": String(size),
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
