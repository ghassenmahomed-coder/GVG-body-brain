// Step 2: Google sends you back here. The app shows the refresh token once so you can paste it
// into Vercel as GOOGLE_REFRESH_TOKEN. It is not stored anywhere by the app.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const page = (body: string) => new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google koppelen</title><body style="font:16px system-ui;background:#0a1450;color:#f1f0ff;padding:24px;max-width:560px;margin:auto">${body}</body>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  if (!code) return page(`<h2>Niet gekoppeld</h2><p>${url.searchParams.get("error") || "Geen code van Google."}</p>`);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", redirect_uri: new URL("/api/google/callback", req.url).toString(), grant_type: "authorization_code" }),
  });
  const j = await r.json();
  if (!j.refresh_token) return page(`<h2>Niet gelukt</h2><p>${j.error_description || j.error || "Google gaf geen refresh token."}</p>`);
  const esc = String(j.refresh_token).replace(/[<>&"]/g, "");
  return page(`<h2>Bijna klaar</h2><p>Kopieer deze sleutel en zet hem in Vercel (Settings → Environment Variables), daarna Redeploy. Deel hem met niemand.</p><p>Eerste account (met de geld-sheet): <b>GOOGLE_REFRESH_TOKEN</b>.<br>Tweede account (alleen mail): <b>GOOGLE_REFRESH_TOKEN_2</b>.</p><textarea readonly style="width:100%;height:120px;font:13px monospace">${esc}</textarea>`);
}
