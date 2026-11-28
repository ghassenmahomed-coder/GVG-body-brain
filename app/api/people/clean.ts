import { PEOPLE_STATUS } from "@/lib/notion";

// Only known fields, trimmed, from the browser.
export function cleanPerson(b: Record<string, unknown>) {
  const s = (v: unknown, n = 300) => (typeof v === "string" ? v.trim().slice(0, n) : undefined);
  const out: Record<string, unknown> = {};
  for (const k of ["name", "role", "phone", "notes"] as const) { const v = s(b[k], k === "notes" ? 1900 : 300); if (v !== undefined) out[k] = v; }
  const email = s(b.email); if (email !== undefined) out.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
  if (b.kind === "Persoon" || b.kind === "Organisatie") out.kind = b.kind;
  if (Array.isArray(b.links)) out.links = b.links.filter((x) => typeof x === "string");
  if (b.status === "" || (PEOPLE_STATUS as readonly string[]).includes(String(b.status))) out.status = b.status;
  if (b.followUp === null || b.followUp === "" || /^\d{4}-\d{2}-\d{2}$/.test(String(b.followUp))) out.followUp = b.followUp || null;
  return out;
}
