import { NextResponse } from "next/server";
import { addPerson } from "@/lib/notion";
import { fail } from "@/lib/http";
import { cleanPerson } from "./clean";

// Heart: a new person or organisation in Notion People.
export async function POST(req: Request) {
  try {
    const p = cleanPerson(await req.json());
    if (!p.name) return fail(new Error("Give the person a name."), 400);
    return NextResponse.json({ id: await addPerson({ kind: "Persoon", status: "Nu mee bezig", ...p }) });
  } catch (e) {
    return fail(e);
  }
}
