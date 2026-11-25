import { NextResponse } from "next/server";
import { todoist } from "@/lib/todoist";
import { AREAS, type AreaId } from "@/lib/config";
import { fail } from "@/lib/http";

// Add a task. The body part becomes a Todoist label, so it lands in the right place next time.
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const content = String(b.content || "").trim().slice(0, 500);
    if (!content) return fail(new Error("Give the task a name."), 400);
    const area = (b.area in AREAS ? b.area : "brain") as AreaId;
    const t = await todoist.add({
      content,
      description: String(b.description || "").slice(0, 4000),
      due_string: b.due ? String(b.due).slice(0, 100) : undefined,
      labels: [AREAS[area].label],
    });
    return NextResponse.json({ id: t.id });
  } catch (e) {
    return fail(e);
  }
}
