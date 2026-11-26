"use client";
import { useState } from "react";

export default function Login() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: code }) }).catch(() => null);
    if (r?.ok) { location.href = "/"; return; }
    const j = await r?.json().catch(() => null);
    setErr(j?.error || (r ? `The app hit an error (${r.status}). Check the settings in Vercel.` : "Could not reach the app. Check your connection."));
    setBusy(false);
  }
  return (
    <main className="login">
      <form onSubmit={submit} className="login-card">
        <div className="eyebrow">GVG Brain</div>
        <h1>Body Map</h1>
        <label htmlFor="pc" className="note">Passcode</label>
        <input id="pc" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary big" disabled={busy || !code}>{busy ? "Unlocking…" : "Unlock"}</button>
      </form>
    </main>
  );
}
