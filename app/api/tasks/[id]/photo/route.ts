import { NextResponse } from "next/server";
import { todoist } from "@/lib/todoist";
import { fail, readPhoto } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { file, fields } = await readPhoto(req);
    const today = new Date().toISOString().slice(0, 10);
    await todoist.attachPhoto(id, file, `${today}_photo_task.jpg`, String(fields.get("note") || "Photo from Body Map"));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e, (e as { status?: number }).status || 500);
  }
}
