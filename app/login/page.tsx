"use client";
import { useEffect, useRef, useState } from "react";
import { sound } from "@/lib/sound";

// Dragon-eye login (GVG theme). The eye follows your finger, the pupil widens per digit,
// a G shows in the pupil, and on the right code you dive through the pupil into the app.
// Works with any passcode: digits on the keypad, or "abc" for a passcode with letters.

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "abc", "0", "del"] as const;

function greeting(h: number) {
  if (h < 5) return "Nog wakker, Galayn?";
  if (h < 12) return "Goedemorgen, Galayn";
  if (h < 18) return "Goedemiddag, Galayn";
  return "Goedenavond, Galayn";
}

export default function Login() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"" | "no" | "zoom">("");
  const [text, setText] = useState(false);
  const [hello, setHello] = useState("Welkom, Galayn");
  const [blink, setBlink] = useState(false);
  const pupil = useRef<SVGGElement>(null);
  const shell = useRef<HTMLElement>(null);

  useEffect(() => setHello(greeting(new Date().getHours())), []);

  // The pupil follows the pointer (finger or mouse).
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (shell.current?.classList.contains("zoom")) return;
      const el = shell.current, p = pupil.current; if (!el || !p) return;
      const r = el.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      const y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.3) * 2));
      p.setAttribute("transform", `translate(${x * 46} ${y * 10})`);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", move);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerdown", move); };
  }, []);

  // Blinks now and then.
  useEffect(() => {
    const t = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 180); }, 4200);
    return () => clearInterval(t);
  }, []);

  async function submit(value = code) {
    if (!value || busy) return;
    setBusy(true); setErr("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: value }) }).catch(() => null);
    if (r?.ok) {
      sound.record();
      pupil.current?.setAttribute("transform", "translate(0 0)");
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setState("zoom");
      setTimeout(() => { location.href = "/"; }, calm ? 150 : 1050);
      return;
    }
    const j = await r?.json().catch(() => null);
    setErr(r?.status === 401 ? "Verkeerde code." : j?.error || (r ? `De app gaf een fout (${r.status}). Check de instellingen in Vercel.` : "Kan de app niet bereiken. Check je verbinding."));
    sound.undo();
    setState("no"); setCode("");
    setTimeout(() => setState(""), 650);
    setBusy(false);
  }

  function press(k: (typeof KEYS)[number]) {
    if (busy) return;
    if (k === "abc") { setText(true); return; }
    if (k === "del") { setCode((c) => c.slice(0, -1)); return; }
    sound.tap();
    setCode((c) => c + k);
  }

  // Physical keyboard: digits, backspace, enter.
  useEffect(() => {
    if (text) return;
    const key = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key as (typeof KEYS)[number]);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") void submit();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const n = code.length;
  const rx = Math.min(7 + n * 7, 40);
  const dots = Math.max(4, n);

  return (
    <main ref={shell} className={`dragon ${state} ${blink && !state ? "blink" : ""}`}>
      <div className="wm dragon-wm" aria-label="GVG">GVG</div>
      <div className="eyewrap" aria-hidden="true">
        <svg className="eye" viewBox="0 -4 200 112">
          <defs>
            <clipPath id="alm"><path d="M8 66 Q100 -6 192 66 Q100 120 8 66Z" /></clipPath>
            <pattern id="scale" width="14" height="10" patternUnits="userSpaceOnUse"><path d="M0 10 Q7 -2 14 10" fill="#2a2a33" stroke="#0e0e12" strokeWidth="1.6" /></pattern>
            <radialGradient id="scl" cx="50%" cy="45%" r="60%"><stop offset="0" stopColor="#fffdf2" /><stop offset=".7" stopColor="#ece6d2" /><stop offset="1" stopColor="#b9b29c" /></radialGradient>
          </defs>
          <path d="M-20 70 Q100 40 220 70 L220 140 L-20 140Z" fill="url(#scale)" />
          <path d="M-20 74 Q100 46 220 74" fill="none" stroke="var(--leaf)" strokeWidth="5" />
          <path d="M8 66 Q100 -6 192 66 Q100 120 8 66Z" fill="url(#scl)" stroke="var(--ink)" strokeWidth="5" />
          <g clipPath="url(#alm)">
            <g ref={pupil} className="pupil-g">
              <ellipse className="pupil" cx="100" cy="56" rx={rx} ry="44" fill="var(--ink)" />
              <text className={`gin ${n >= 3 || state === "zoom" ? "on" : ""}`} x="100" y="68" textAnchor="middle" fill="var(--accent)">G</text>
            </g>
            <path className="lid" d="M0 -60 L200 -60 L200 66 Q100 -6 0 66Z" fill="var(--plum)" />
          </g>
          <path d="M2 64 Q100 -14 198 64" fill="none" stroke="var(--plum)" strokeWidth="12" strokeLinecap="round" />
          <path d="M2 64 Q100 -14 198 64" fill="none" stroke="var(--ink)" strokeWidth="3" />
        </svg>
      </div>

      <div className="dragon-bottom">
        <div>
          <h1 className="dragon-hello">{hello}</h1>
          <p className="dragon-sub">{busy ? "Even kijken…" : "Tik je code."}</p>
        </div>

        {text ? (
          <form className="dragon-text" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <label htmlFor="pc" className="sr-only">Code</label>
            <input id="pc" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            <button className="dragon-go" disabled={busy || !code}>Open</button>
            <button type="button" className="dragon-link" onClick={() => { setText(false); setCode(""); }}>Cijfers</button>
          </form>
        ) : (
          <>
            <div className="dragon-dots" aria-label={`${n} tekens ingevoerd`}>
              {Array.from({ length: dots }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}
            </div>
            <div className="dragon-pad">
              {KEYS.map((k) => (
                <button key={k} type="button" onClick={() => press(k)} aria-label={k === "del" ? "Wissen" : k === "abc" ? "Letters typen" : k}
                  className={k === "abc" ? "small" : ""} disabled={busy}>
                  {k === "del" ? "⌫" : k}
                </button>
              ))}
            </div>
            <button className="dragon-go" onClick={() => void submit()} disabled={busy || !code}>Open</button>
          </>
        )}
        {err && <p className="dragon-err" role="alert">{err}</p>}
      </div>
    </main>
  );
}
