import { NextResponse } from "next/server";
import { appendPhotoToPage } from "@/lib/notion";
import { fail, readPhoto } from "@/lib/http";

// A scan of the renewed card, the keuring paper... added to that row's Notion page.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { file, fields } = await readPhoto(req);
    const today = new Date().toISOString().slice(0, 10);
    await appendPhotoToPage(id, file, `${today}_scan_document.jpg`, String(fields.get("note") || ""));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e, (e as { status?: number }).status || 500);
  }
}
