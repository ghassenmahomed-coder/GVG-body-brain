import { NextResponse } from "next/server";
import { todoist } from "@/lib/todoist";
import { AREAS, AREA_ORDER, type AreaId } from "@/lib/config";
import { fail } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

// Edit a task: name, notes, due date (plain words like "friday 6pm"), body part.
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const b = await req.json();
    const patch: { content?: string; description?: string; due_string?: string; labels?: string[] } = {};
    if (typeof b.content === "string" && b.content.trim()) patch.content = b.content.trim().slice(0, 500);
    if (typeof b.description === "string") patch.description = b.description.slice(0, 4000);
    if (typeof b.due === "string") patch.due_string = b.due.trim() ? b.due.slice(0, 100) : "no date";
    if (typeof b.area === "string" && b.area in AREAS && Array.isArray(b.labels)) {
      const areaLabels = new Set(AREA_ORDER.map((a) => AREAS[a].label));
      patch.labels = [...b.labels.filter((l: string) => !areaLabels.has(String(l).toLowerCase())), AREAS[b.area as AreaId].label];
    }
    await todoist.update(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

// Complete a task. Recurring tasks move to their next date, as in Todoist.
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    if (b.action !== "close") return fail(new Error("Unknown action."), 400);
    await todoist.close(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
