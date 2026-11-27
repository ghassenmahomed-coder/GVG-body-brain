import { NextResponse } from "next/server";
import { checkTodo } from "@/lib/notion";
import { fail } from "@/lib/http";

// Tick a Notion to-do from the app.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{32,36}$/i.test(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
    await checkTodo(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
