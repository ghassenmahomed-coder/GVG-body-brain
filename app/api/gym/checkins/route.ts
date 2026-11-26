import { NextResponse } from "next/server";
import { addCheckin, listCheckins, updateCheckinReview } from "@/lib/notion";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";
const MUSCLES = new Set(["chest", "shoulders", "biceps", "triceps", "forearms", "abs", "back", "glutes", "quads", "hamstrings", "calves"]);
const GOALS = new Set(["mass", "strength", "both"]);
const lvl = (v: unknown) => (v === 0 || v === 1 || v === 2 ? v : 1);

export async function GET() {
  try {
    return NextResponse.json({ checkins: await listCheckins() });
  } catch (e) {
    return fail(e);
  }
}

// The check-in before a workout.
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ? String(b.date) : new Date().toISOString().slice(0, 10);
    const minutes = Math.max(10, Math.min(180, Math.round(Number(b.minutes) || 45)));
    const id = await addCheckin({
      date, minutes,
      sleep: lvl(b.sleep), energy: lvl(b.energy),
      sore: Array.isArray(b.sore) ? b.sore.map(String).filter((m: string) => MUSCLES.has(m)) : [],
      goal: GOALS.has(b.goal) ? b.goal : "mass",
    });
    return NextResponse.json({ id });
  } catch (e) {
    return fail(e);
  }
}

// The review after a workout, per muscle.
export async function PATCH(req: Request) {
  try {
    const b = await req.json();
    if (!b.id || typeof b.review !== "string") return fail(new Error("Missing review."), 400);
    await updateCheckinReview(String(b.id), b.review);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
