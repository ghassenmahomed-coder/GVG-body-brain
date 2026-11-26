import { NextResponse } from "next/server";
import { COOKIE, makeSession, passcodeMatches } from "@/lib/auth";

const tries = new Map<string, { n: number; t: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const rec = tries.get(ip);
  if (rec && now - rec.t < 15 * 60000 && rec.n >= 8) {
    return NextResponse.json({ error: "Too many tries. Wait 15 minutes." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  if (!passcodeMatches(String(body.passcode || ""))) {
    tries.set(ip, { n: (rec && now - rec.t < 15 * 60000 ? rec.n : 0) + 1, t: rec && now - rec.t < 15 * 60000 ? rec.t : now });
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }
  tries.delete(ip);
  let s: { value: string; maxAge: number };
  try {
    s = await makeSession();
  } catch {
    return NextResponse.json({ error: "Passcode is right, but AUTH_SECRET is missing or shorter than 16 characters in Vercel. Fix it, then redeploy." }, { status: 500 });
  }
  const res = NextResponse.json({ ok: true });
  // SameSite=None + Partitioned so the cookie also works inside the Notion embed.
  res.cookies.set({ name: COOKIE, value: s.value, maxAge: s.maxAge, httpOnly: true, secure: true, sameSite: "none", path: "/", partitioned: true });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE, value: "", maxAge: 0, httpOnly: true, secure: true, sameSite: "none", path: "/", partitioned: true });
  return res;
}
