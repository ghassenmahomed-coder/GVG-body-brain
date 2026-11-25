import { NextResponse } from "next/server";
import { updateExpiry } from "@/lib/notion";
import { fail } from "@/lib/http";

// Renewed a document? Set the new expiry date (and optionally a note) on the Notion row.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const b = await req.json();
    const patch: { expires?: string | null; notes?: string } = {};
    if (b.expires === null || (typeof b.expires === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.expires))) patch.expires = b.expires;
    if (typeof b.notes === "string") patch.notes = b.notes;
    await updateExpiry(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
