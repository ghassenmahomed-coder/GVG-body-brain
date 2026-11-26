// Passcode login. The cookie holds "<expiry>.<hmac>", signed with AUTH_SECRET.
// AUTH_SECRET is optional: without it, the key is built from the server-only tokens and
// the passcode, which never reach the browser. Changing any of them logs every device out.
// Works in middleware (edge) and route handlers (node) because it only uses Web Crypto.

export const COOKIE = "gvg_session";
const DAYS = 60;

async function hmac(data: string): Promise<string> {
  const own = (process.env.AUTH_SECRET || "").trim();
  const secret = own.length >= 16 ? own
    : ["gvg-session", process.env.APP_PASSCODE, process.env.NOTION_TOKEN, process.env.TODOIST_TOKEN].map((x) => (x || "").trim()).join("|");
  if (own.length < 16 && secret.length < 40) throw new Error("No signing key: set NOTION_TOKEN and TODOIST_TOKEN (or AUTH_SECRET)");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeSession(): Promise<{ value: string; maxAge: number }> {
  const exp = Date.now() + DAYS * 86400000;
  return { value: `${exp}.${await hmac(String(exp))}`, maxAge: DAYS * 86400 };
}

export async function validSession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = await hmac(exp);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export function passcodeMatches(input: string): boolean {
  const real = process.env.APP_PASSCODE || "";
  if (!real) return false;
  if (input.length !== real.length) return false;
  let diff = 0;
  for (let i = 0; i < real.length; i++) diff |= input.charCodeAt(i) ^ real.charCodeAt(i);
  return diff === 0;
}
