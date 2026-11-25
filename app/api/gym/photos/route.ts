import { NextResponse } from "next/server";
import { addProgressPhoto, listPhotos } from "@/lib/notion";
import { fail, readPhoto } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ photos: await listPhotos() });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const { file, fields } = await readPhoto(req);
    const pose = String(fields.get("pose") || "");
    if (!["Front", "Side", "Back"].includes(pose)) return fail(new Error("Pose must be Front, Side or Back."), 400);
    const date = String(fields.get("date") || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(new Error("Bad date."), 400);
    await addProgressPhoto({ file, pose, date, summary: String(fields.get("summary") || "") });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e, (e as { status?: number }).status || 500);
  }
}
