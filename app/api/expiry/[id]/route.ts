import { NextResponse } from "next/server";
import { updateExpiry, EXPIRY_STATUS } from "@/lib/notion";
import { fail } from "@/lib/http";

// Renewed a document, or waiting on one? Update its date, status, what you wait on, or a note.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const b = await req.json();
    const patch: { expires?: string | null; notes?: string; status?: string; waitingOn?: string } = {};
    if (b.expires === null || (typeof b.expires === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.expires))) patch.expires = b.expires;
    if (typeof b.notes === "string") patch.notes = b.notes;
    if (b.status === "" || (EXPIRY_STATUS as readonly string[]).includes(b.status)) patch.status = b.status;
    if (typeof b.waitingOn === "string") patch.waitingOn = b.waitingOn.slice(0, 300);
    await updateExpiry(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
