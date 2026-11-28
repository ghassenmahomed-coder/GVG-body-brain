import { NextResponse } from "next/server";
import { listProjects } from "@/lib/notion";
import { fail } from "@/lib/http";

// The project pages under 02 Projects, for Hands' "next step" picker.
export async function GET() {
  try {
    return NextResponse.json({ projects: await listProjects() });
  } catch (e) {
    return fail(e);
  }
}
