import { NextResponse } from "next/server";
import { updatePerson } from "@/lib/notion";
import { fail } from "@/lib/http";
import { cleanPerson } from "../clean";

// Heart: change a person's status, follow-up date or details.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await updatePerson(id, cleanPerson(await req.json()));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
