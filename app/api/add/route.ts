import { NextResponse } from "next/server";
import { addIdea, addToWatch, addProjectStep } from "@/lib/notion";
import { fail } from "@/lib/http";

// Brain (idea), Eyes (something to watch or read) and Hands (a project's next step) write onto Notion pages.
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const s = (v: unknown, n = 500) => (typeof v === "string" ? v.trim().slice(0, n) : "");
    if (b.kind === "idea") {
      if (!s(b.idea)) return fail(new Error("Write the idea first."), 400);
      await addIdea(s(b.idea), s(b.note, 1900));
    } else if (b.kind === "watch") {
      if (!s(b.title) && !s(b.link)) return fail(new Error("Give a title or a link."), 400);
      await addToWatch({ title: s(b.title, 300), link: s(b.link, 1000), kind: s(b.type, 30), why: s(b.why, 300) });
    } else if (b.kind === "step") {
      if (!s(b.step) || !s(b.projectId, 64)) return fail(new Error("Pick a project and write the step."), 400);
      await addProjectStep(s(b.projectId, 64), s(b.step), /^\d{4}-\d{2}-\d{2}$/.test(b.due || "") ? b.due : null);
    } else return fail(new Error("Unknown kind."), 400);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
