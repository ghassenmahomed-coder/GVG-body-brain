"use client";
// Full-screen camera with a faint "ghost" of last month's photo, so you stand in the same spot and pose.
// Falls back to the phone's own camera app (file input) when live camera isn't allowed, e.g. inside the Notion embed.
import { useEffect, useRef, useState } from "react";
import { compress } from "@/lib/image";

export function Camera({ title, ghostUrl, facing = "user", onShot, onClose }: { title: string; ghostUrl?: string | null; facing?: "user" | "environment"; onShot: (b: Blob) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState(facing);
  const [failed, setFailed] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [timer, setTimer] = useState(10);

  useEffect(() => {
    let s: MediaStream | null = null; let cancelled = false;
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        setStream(s);
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
      } catch { setFailed(true); }
    })();
    return () => { cancelled = true; s?.getTracks().forEach((t) => t.stop()); };
  }, [mode]);

  async function snap() {
    const v = video.current; if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    if (mode === "user") { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0);
    const raw = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    if (raw) onShot(await compress(raw));
  }
  function start() {
    if (timer === 0) { snap(); return; }
    let n = timer; setCount(n);
    const id = setInterval(() => { n--; if (n <= 0) { clearInterval(id); setCount(null); snap(); } else setCount(n); }, 1000);
  }
  async function picked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) onShot(await compress(f));
  }

  return (
    <div className="cam" role="dialog" aria-label={title}>
      <div className="stage">
        <video ref={video} playsInline muted className={mode === "user" ? "mirror" : ""} hidden={failed} />
        {ghostUrl && !failed && <img src={ghostUrl} alt="" className="ghost" />}
        <div className="top"><span>{title}</span><span>{ghostUrl ? "Line up with last month" : ""}</span></div>
        {count !== null && <div className="count">{count}</div>}
        {failed && (
          <div className="count" style={{ fontSize: "1rem", padding: 24, textAlign: "center" }}>
            Live camera isn&apos;t available here. Use your phone&apos;s camera instead.
          </div>
        )}
      </div>
      <div className="bar">
        <button className="btn" onClick={onClose}>Cancel</button>
        {stream && !failed ? (
          <button className="shutter" aria-label={timer ? `Take photo in ${timer} seconds` : "Take photo"} onClick={start} disabled={count !== null} />
        ) : (
          <button className="btn" onClick={() => fileRef.current?.click()}>Open camera</button>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          {stream && <button className="btn small" onClick={() => setTimer(timer === 10 ? 3 : timer === 3 ? 0 : 10)}>{timer ? `${timer}s` : "No timer"}</button>}
          {stream && <button className="btn small" onClick={() => { stream.getTracks().forEach((t) => t.stop()); setStream(null); setMode(mode === "user" ? "environment" : "user"); }}>Flip</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture={mode} hidden onChange={picked} />
      </div>
    </div>
  );
}

// Small inline "Add photo" for tasks and documents: opens the phone camera, compresses, hands back a Blob.
export function PhotoButton({ onPhoto, label = "Add photo", busy }: { onPhoto: (b: Blob) => void; label?: string; busy?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Uploading…" : label}</button>
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPhoto(await compress(f)); }} />
    </>
  );
}
