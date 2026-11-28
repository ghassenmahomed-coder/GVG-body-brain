import { NextResponse } from "next/server";
import { addExpiry, EXPIRY_TYPES } from "@/lib/notion";
import { fail } from "@/lib/http";

// Feet: a new document or vehicle with an expiry date.
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const document = String(b.document || "").trim();
    if (!document) return fail(new Error("Give the document a name."), 400);
    const id = await addExpiry({
      document,
      type: (EXPIRY_TYPES as readonly string[]).includes(b.type) ? b.type : "",
      person: ["Galayn", "Mama"].includes(b.person) ? b.person : "",
      expires: /^\d{4}-\d{2}-\d{2}$/.test(b.expires || "") ? b.expires : null,
      notes: String(b.notes || "").slice(0, 1900),
    });
    return NextResponse.json({ id });
  } catch (e) {
    return fail(e);
  }
}
