// Google reads for the app (Gmail follow-ups for Heart, the money sheet). Read-only, server-only.
// Needs GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN (see README: "Google").
import "server-only";

export const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/spreadsheets.readonly"];
// The money sheet id lives in an env var, not in this (public) repo.
export const moneySheetId = () => (process.env.GOOGLE_MONEY_SHEET_ID || "").trim();
export const moneySheetUrl = () => (moneySheetId() ? `https://docs.google.com/spreadsheets/d/${moneySheetId()}/edit` : "");

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);

// One or two Google accounts: GOOGLE_REFRESH_TOKEN (the one with the money sheet) and optional GOOGLE_REFRESH_TOKEN_2.
export const refreshTokens = () => [process.env.GOOGLE_REFRESH_TOKEN, process.env.GOOGLE_REFRESH_TOKEN_2].map((t) => (t || "").trim()).filter(Boolean);

const cached = new Map<string, { token: string; until: number }>();
async function accessToken(rt: string) {
  const c = cached.get(rt);
  if (c && c.until > Date.now() + 60_000) return c.token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: rt, grant_type: "refresh_token",
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google sign-in expired or wrong (${j.error || r.status}). Connect Google again.`);
  cached.set(rt, { token: j.access_token, until: Date.now() + (j.expires_in ?? 3600) * 1000 });
  return j.access_token as string;
}

async function g<T = any>(url: string, rt = refreshTokens()[0]): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const r = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken(rt)}` }, cache: "no-store" });
  if (!r.ok) throw new Error(`Google ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

/* ---------- Gmail: who is waiting on you, and who you are waiting on ---------- */
export type MailRow = { id: string; who: string; subject: string; at: string; waiting: "you" | "them"; url: string; account: string };
const header = (m: any, n: string): string => m.payload?.headers?.find((h: any) => h.name.toLowerCase() === n)?.value ?? ""; // eslint-disable-line @typescript-eslint/no-explicit-any
const nameOf = (from: string) => (from.match(/^\s*"?([^"<]+?)"?\s*</)?.[1] || from.replace(/[<>]/g, "")).trim();
// Mail sent by a system rather than a person: bulk/list headers, auto-replies, alert senders, ticket receipts.
function isAutomated(m: any, from: string, subject: string): boolean { // eslint-disable-line @typescript-eslint/no-explicit-any
  const auto = header(m, "auto-submitted").toLowerCase();
  if (auto && auto !== "no") return true;
  if (header(m, "list-unsubscribe") || header(m, "x-autoreply")) return true;
  if (/bulk|list|junk|auto_reply/i.test(header(m, "precedence"))) return true;
  if (/no-?reply|do-?not-?reply|newsletter|notif(y|ication|ications)?@|alerts?@|security@|mailer-daemon|postmaster@/i.test(from)) return true;
  return /\[##\d+##\]|automatic reply|auto(matisch)? ?(antwoord|reply)|out of (the )?office|afwezig|bedankt voor uw e-?mail|new (device|login|sign-?in)|has invited you/i.test(subject);
}

// Mail from every connected account. One account failing does not hide the others.
export async function mailFollowUps(): Promise<{ rows: MailRow[]; errors: string[] }> {
  const res = await Promise.allSettled(refreshTokens().map((rt) => mailFor(rt)));
  return {
    rows: res.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
    errors: res.flatMap((r, i) => (r.status === "rejected" ? [`Gmail account ${i + 1}: ${String((r.reason as Error)?.message || r.reason)}`] : [])),
  };
}

async function mailFor(rt: string): Promise<MailRow[]> {
  const g2 = <T = any>(url: string) => g<T>(url, rt); // eslint-disable-line @typescript-eslint/no-explicit-any
  const me = ((await g2<{ emailAddress: string }>("https://gmail.googleapis.com/gmail/v1/users/me/profile")).emailAddress || "").toLowerCase();
  const base = "https://gmail.googleapis.com/gmail/v1/users/me";
  const list = async (q: string, max: number) =>
    ((await g2<{ threads?: { id: string }[] }>(`${base}/threads?maxResults=${max}&q=${encodeURIComponent(q)}`)).threads ?? []).map((t) => t.id);
  const [inbox, sent] = await Promise.all([
    list("in:inbox category:primary newer_than:30d -from:me", 25),
    list("in:sent newer_than:30d", 25),
  ]);
  const ids = [...new Set([...inbox, ...sent])];
  const out: MailRow[] = [];
  await Promise.all(ids.map(async (id) => {
    const t = await g2<any>(`${base}/threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Auto-Submitted&metadataHeaders=List-Unsubscribe&metadataHeaders=Precedence&metadataHeaders=X-Autoreply`); // eslint-disable-line @typescript-eslint/no-explicit-any
    const msgs = t.messages ?? [];
    const last = msgs[msgs.length - 1]; if (!last) return;
    const labels: string[] = last.labelIds ?? [];
    if (labels.includes("SPAM") || labels.includes("TRASH")) return;
    const from = header(last, "from");
    const fromMe = labels.includes("SENT") || from.toLowerCase().includes(me);
    const at = new Date(Number(last.internalDate)).toISOString();
    const subject = header(msgs[0], "subject") || "(no subject)";
    // Automated mail (no-reply, newsletters, alerts, auto-replies) never waits on you.
    if (!fromMe && isAutomated(last, from, subject)) return;
    if (!fromMe && !inbox.includes(id)) return;
    out.push({ id, subject, at, waiting: fromMe ? "them" : "you", who: nameOf(fromMe ? header(last, "to") : from), url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(me)}#all/${id}`, account: me });
  }));
  return out;
}

/* ---------- Money sheet: month tracker and loans ---------- */
export type MoneyRow = { id: string; title: string; detail: string; due: string | null; kind: "month" | "loan"; url: string };
const dmy = (s: string): string | null => { const m = (s || "").trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null; };
const empty = (v: string | undefined) => !v || v.trim() === "" || v.trim() === "-";

export async function moneyChecks(now = new Date()): Promise<MoneyRow[]> {
  if (!moneySheetId()) return [];
  const sheet = moneySheetUrl();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${moneySheetId()}/values:batchGet?ranges=${encodeURIComponent("Maandtracker!A4:I40")}&ranges=${encodeURIComponent("Leningen!A9:J60")}&ranges=${encodeURIComponent("Leningen!A6:D6")}`;
  const r = await g<{ valueRanges: { values?: string[][] }[] }>(url);
  const [months, loans, openRow] = r.valueRanges.map((v) => v.values ?? []);
  // "Openstaand" totals per currency (SRD, USD, EUR), after repayments.
  const totals = ["SRD", "USD", "EUR"].map((c, i) => [c, (openRow[0]?.[i + 1] || "").trim()]).filter(([, v]) => v && !/^0([.,]0+)?$/.test(v)).map(([c, v]) => `${c} ${v}`).join(" + ");
  const out: MoneyRow[] = [];
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  // A month that has ended but has no income or buckets filled in.
  for (const row of months) {
    const start = dmy(row[8]); if (!start || start >= thisMonth) continue;
    if (empty(row[1]) || empty(row[2])) {
      const d = new Date(start); const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      out.push({ id: "m" + start, title: `Fill in ${row[0]} in the month tracker`, detail: "Income and what went into each bucket", due: end.toISOString().slice(0, 10), kind: "month", url: sheet });
    }
  }
  // Loans you gave: a repayment date that is close or passed.
  loans.forEach((row, i) => {
    const who = (row[0] || "").trim(); if (!who || !/lopend/i.test(row[8] || "")) return;
    const next = dmy(row[7] || "");
    out.push({ id: "l" + i, title: `Loan to ${who}`, detail: (totals ? `Still open in total: ${totals}` : "Open loan") + (next ? "" : " · no repayment date set"), due: next, kind: "loan", url: sheet });
  });
  return out;
}
