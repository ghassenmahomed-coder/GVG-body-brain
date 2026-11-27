import { NextResponse } from "next/server";
import { GOOGLE_SCOPES } from "@/lib/google";

// Step 1 of connecting Google: send you to Google's own sign-in screen (read-only Gmail + Sheets).
export async function GET(req: Request) {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) return NextResponse.json({ error: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel first." }, { status: 400 });
  const redirect = new URL("/api/google/callback", req.url).toString();
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({ client_id: id, redirect_uri: redirect, response_type: "code", scope: GOOGLE_SCOPES.join(" "), access_type: "offline", prompt: "consent" }).toString();
  return NextResponse.redirect(u);
}
