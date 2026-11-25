"use client";
import { useEffect, useRef } from "react";

export function Sheet({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("keydown", k); prev?.focus?.(); };
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        <div className="sheet-head">
          <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2></div>
          <button className="x" aria-label="Close" ref={ref} onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </>
  );
}

export function Stepper({ id, label, value, step, onChange }: { id: string; label: string; value: number; step: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.max(0, Math.round(v * 10) / 10));
  return (
    <div className="step">
      <label className="lab" htmlFor={id}>{label}</label>
      <div className="ctl">
        <button type="button" aria-label={`Less ${label}`} onClick={() => set(value - step)}>−</button>
        <input id={id} inputMode="decimal" value={value} onChange={(e) => set(parseFloat(e.target.value.replace(",", ".")) || 0)} />
        <button type="button" aria-label={`More ${label}`} onClick={() => set(value + step)}>+</button>
      </div>
    </div>
  );
}

export type ToastMsg = { text: string; kind?: "pb" | "bad"; undo?: () => void } | null;
export function Toast({ msg, clear }: { msg: ToastMsg; clear: () => void }) {
  useEffect(() => { if (!msg) return; const t = setTimeout(clear, msg.undo ? 5000 : 2800); return () => clearTimeout(t); }, [msg, clear]);
  return (
    <div aria-live="polite">
      {msg && (
        <div className={"toast" + (msg.kind ? " " + msg.kind : "")}>
          <span>{msg.text}</span>
          {msg.undo && <button onClick={() => { msg.undo!(); clear(); }}>Undo</button>}
        </div>
      )}
    </div>
  );
}

export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (r.status === 401) { location.href = "/login"; throw new Error("Locked"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j as T;
}
export const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
