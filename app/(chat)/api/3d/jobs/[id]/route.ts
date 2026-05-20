import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { syncModel3DJob } from "@/lib/3d/orchestrator";
import { getModel3DJobById, updateDocumentContent } from "@/lib/db/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const job = await getModel3DJobById({ id });

  if (!job || job.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content = await syncModel3DJob(id);

  if (!content) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await updateDocumentContent({
    id: job.documentId,
    content: JSON.stringify(content),
  });

  return NextResponse.json(content);
}
