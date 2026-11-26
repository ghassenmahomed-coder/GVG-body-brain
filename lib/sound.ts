// Small synthesized UI sounds (no audio files). Browsers only allow sound after a tap, which is when these play.
const KEY = "gvg-sound";
let ctx: AudioContext | null = null;

function enabled() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
function tone(freq: number, at: number, dur: number, type: OscillatorType = "sine", vol = 0.14) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
function play(fn: () => void) {
  if (typeof window === "undefined" || !enabled()) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    fn();
  } catch { /* no audio on this device */ }
}

export const sound = {
  enabled,
  set(on: boolean) { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {} },
  tap: () => play(() => { tone(740, 0, 0.07); tone(1110, 0.02, 0.06, "sine", 0.06); }),
  done: () => play(() => { tone(660, 0, 0.09, "triangle"); tone(990, 0.08, 0.14, "triangle"); }),
  record: () => play(() => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.18, "triangle", 0.12))),
  undo: () => play(() => tone(330, 0, 0.12, "sine", 0.1)),
};
