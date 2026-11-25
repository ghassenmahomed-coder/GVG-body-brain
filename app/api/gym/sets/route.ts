import { NextResponse } from "next/server";
import { addSet, deleteSet, listSets } from "@/lib/notion";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";
const MUSCLES = new Set(["chest", "shoulders", "biceps", "triceps", "forearms", "abs", "back", "glutes", "quads", "hamstrings", "calves"]);

export async function GET() {
  try {
    return NextResponse.json({ sets: await listSets() });
  } catch (e) {
    return fail(e);
  }
}

// Only called when you confirm a set. Planned sets you never tick are never saved.
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const muscle = String(b.muscle || "").toLowerCase();
    const weight = Number(b.weight), reps = Number(b.reps);
    if (!MUSCLES.has(muscle)) return fail(new Error("Unknown muscle."), 400);
    if (!(weight >= 0 && weight < 1000) || !(reps > 0 && reps < 1000)) return fail(new Error("Check the weight and reps."), 400);
    const id = await addSet({
      muscle,
      exercise: String(b.exercise || "").slice(0, 120) || "Exercise",
      weight,
      reps,
      plannedWeight: typeof b.plannedWeight === "number" ? b.plannedWeight : undefined,
      plannedReps: typeof b.plannedReps === "number" ? b.plannedReps : undefined,
      pb: !!b.pb,
      at: typeof b.at === "string" ? b.at : new Date().toISOString(),
    });
    return NextResponse.json({ id });
  } catch (e) {
    return fail(e);
  }
}

// Undo a tick: moves that set's row to the Notion trash.
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail(new Error("Missing id."), 400);
    await deleteSet(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
