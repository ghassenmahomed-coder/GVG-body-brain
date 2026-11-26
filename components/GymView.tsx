"use client";
import { useEffect, useMemo, useState } from "react";
import { EXERCISES, MUSCLES, MUSCLE_KEYS, bestFor, buildPlan, e1rm, nextTarget, photoDays, quests, recLabel, weekStart, type GymSet, type Muscle, type MuscleStat, type PlannedSet } from "@/lib/gym";
import { WD, fmt, isoDay, dayDiff } from "@/lib/dates";
import { GymBody } from "./Body";
import { Camera } from "./Camera";
import { Sheet, Stepper, api, json, type ToastMsg } from "./ui";

type Photo = { id: string; date: string | null; pose: string; hasPhoto: boolean };
type Props = { sets: GymSet[]; setSets: React.Dispatch<React.SetStateAction<GymSet[]>>; stats: Record<Muscle, MuscleStat>; loading: boolean; toast: (t: ToastMsg) => void };

const PLAN_KEY = "gvg-plan-" + isoDay();
function loadPlan(): PlannedSet[] | null { try { const s = localStorage.getItem(PLAN_KEY); return s ? JSON.parse(s) : null; } catch { return null; } }
function savePlan(p: PlannedSet[]) { try { localStorage.setItem(PLAN_KEY, JSON.stringify(p)); } catch { /* private mode */ } }
const amount = (w: number, r: number) => (w ? `${w} kg × ${r}` : `${r} reps`);

export default function GymView({ sets, setSets, stats, loading, toast }: Props) {
  const [side, setSide] = useState<"front" | "back">("front");
  const [plan, setPlan] = useState<PlannedSet[] | null>(null);
  const [editing, setEditing] = useState<{ row?: PlannedSet; muscle?: Muscle } | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [shooting, setShooting] = useState<"Front" | "Side" | "Back" | null>(null);
  const [uploading, setUploading] = useState(false);

  // Build today's plan once the lift history has loaded; keep it for the day so ticks survive a reload.
  useEffect(() => {
    if (loading || plan) return;
    const p = loadPlan() ?? buildPlan(sets, stats);
    setPlan(p); savePlan(p);
  }, [loading, plan, sets, stats]);
  const updatePlan = (p: PlannedSet[]) => { setPlan(p); savePlan(p); };

  useEffect(() => { api<{ photos: Photo[] }>("/api/gym/photos").then((r) => setPhotos(r.photos)).catch(() => {}); }, []);

  // Confirming is the only way a set counts. Saves to the Notion Workout log.
  async function confirm(row: PlannedSet, weight: number, reps: number) {
    setBusyKey(row.key);
    const pb = bestFor(sets, row.exercise) > 0 && e1rm(weight, reps) > bestFor(sets, row.exercise) + 0.01;
    try {
      const { id } = await api<{ id: string }>("/api/gym/sets", json("POST", { muscle: row.muscle, exercise: row.exercise, weight, reps, plannedWeight: row.weight, plannedReps: row.reps, pb, at: new Date().toISOString() }));
      const set: GymSet = { id, ts: Date.now(), muscle: row.muscle, exercise: row.exercise, weight, reps, pb };
      setSets((s) => [...s, set]);
      const next = (plan || []).some((r) => r.key === row.key) ? (plan || []).map((r) => (r.key === row.key ? { ...r, done: { id, weight, reps, pb } } : r)) : [...(plan || []), { ...row, done: { id, weight, reps, pb } }];
      updatePlan(next);
      toast({ text: pb ? `New personal best: ${row.exercise} ${amount(weight, reps)}` : `Logged ${row.exercise} ${amount(weight, reps)}`, kind: pb ? "pb" : undefined, undo: () => undo(row.key, id, next) });
    } catch (e) { toast({ text: (e as Error).message, kind: "bad" }); }
    setBusyKey("");
  }
  async function undo(key: string, id: string, current?: PlannedSet[]) {
    setBusyKey(key);
    try {
      await api(`/api/gym/sets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setSets((s) => s.filter((x) => x.id !== id));
      updatePlan((current || plan || []).map((r) => (r.key === key ? { ...r, done: undefined } : r)));
      toast({ text: "Set removed" });
    } catch (e) { toast({ text: (e as Error).message, kind: "bad" }); }
    setBusyKey("");
  }

  const q = quests(sets);
  const maxL = Math.max(2, ...MUSCLE_KEYS.map((k) => stats[k].level));
  const weakest = [...MUSCLE_KEYS].sort((a, b) => stats[a].level - stats[b].level || stats[a].sets7 - stats[b].sets7).slice(0, 2);
  const pbs = sets.filter((s) => s.pb).slice(-6).reverse();
  const { next: nextPhoto, prev: prevPhoto } = photoDays();
  const sinceSets = sets.filter((s) => s.ts >= prevPhoto.getTime());
  const isPhotoDay = dayDiff(nextPhoto) === 0;
  const windowStart = isoDay(isPhotoDay ? nextPhoto : prevPhoto);
  const thisRound = (pose: string) => photos.find((p) => p.pose === pose && p.date && p.date >= windowStart && p.hasPhoto);
  const ghostFor = (pose: string) => photos.find((p) => p.pose === pose && p.date && p.date < windowStart && p.hasPhoto);
  const summary = useMemo(() => {
    const best: Record<string, GymSet> = {};
    sinceSets.forEach((s) => { if (!best[s.exercise] || e1rm(s.weight, s.reps) > e1rm(best[s.exercise].weight, best[s.exercise].reps)) best[s.exercise] = s; });
    const top = Object.values(best).sort((a, b) => e1rm(b.weight, b.reps) - e1rm(a.weight, a.reps)).slice(0, 5).map((s) => `${s.exercise} ${amount(s.weight, s.reps)}`);
    return `${sinceSets.length} sets, ${sinceSets.filter((s) => s.pb).length} personal bests since ${fmt(prevPhoto)}. Best: ${top.join("; ") || "none yet"}.`;
  }, [sinceSets, prevPhoto]);

  async function uploadPhoto(pose: "Front" | "Side" | "Back", b: Blob) {
    setShooting(null); setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", b, `${pose}.jpg`); fd.append("pose", pose); fd.append("date", isoDay()); fd.append("summary", summary);
      await api("/api/gym/photos", { method: "POST", body: fd });
      const r = await api<{ photos: Photo[] }>("/api/gym/photos"); setPhotos(r.photos);
      toast({ text: `${pose} photo saved to your private Notion` });
    } catch (e) { toast({ text: (e as Error).message, kind: "bad" }); }
    setUploading(false);
  }

  const doneCount = (plan || []).filter((r) => r.done).length;

  return (
    <section className="gymgrid">
      <div className="figure">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: 8 }}>
          <span className="note">{loading ? "Loading lifts…" : `${sets.length} sets logged`}</span>
          <div className="seg" role="group" aria-label="Body side">
            <button aria-pressed={side === "front"} onClick={() => setSide("front")}>Front</button>
            <button aria-pressed={side === "back"} onClick={() => setSide("back")}>Back</button>
          </div>
        </div>
        <GymBody side={side} stats={stats} onPick={(m) => setEditing({ muscle: m })} />
        <div className="legend">
          <span><i style={{ background: "var(--r1)" }} />Just trained</span>
          <span><i style={{ background: "var(--r2)" }} />Recovering</span>
          <span><i style={{ background: "var(--r3)" }} />Almost</span>
          <span><i style={{ background: "var(--r4)" }} />Ready</span>
          <span><i style={{ background: "var(--faded)" }} />Neglected 10+ days</span>
        </div>
      </div>

      <div className="panel">
        <div className="sec">
          <div className="sec-h"><h2>Today&apos;s workout</h2><span className="note">{plan ? `${doneCount} of ${plan.length} sets confirmed` : ""}</span></div>
          <p className="note" style={{ margin: 0 }}>Tick ✓ only when you did it. Did more or less? Tap the amount, change it, then confirm. Unticked sets don&apos;t count.</p>
          <div className="plan">
            {(plan || []).map((r) => (
              <div key={r.key} className={"prow" + (r.done ? " done" : "")}>
                <button className="tick" disabled={busyKey === r.key} aria-label={r.done ? `Undo ${r.exercise}` : `Confirm ${r.exercise} ${amount(r.weight, r.reps)}`} onClick={() => (r.done ? undo(r.key, r.done.id!) : confirm(r, r.weight, r.reps))}>{r.done ? "✓" : ""}</button>
                <div>
                  <div className="ex">{r.exercise}{r.done?.pb && <span className="pbmark">PB</span>}</div>
                  <div className="note">{MUSCLES[r.muscle]} · {recLabel(stats[r.muscle]).toLowerCase()}</div>
                </div>
                <button className="amt" disabled={!!r.done || busyKey === r.key} onClick={() => setEditing({ row: r })} aria-label={`Change amount for ${r.exercise}`}>
                  {r.done ? amount(r.done.weight, r.done.reps) : amount(r.weight, r.reps)}
                </button>
              </div>
            ))}
            {plan && !plan.length && <div className="empty">Everything is still recovering. Rest, or add a set below.</div>}
          </div>
          <div className="actions">
            <button className="btn" onClick={() => setEditing({ muscle: (plan?.[0]?.muscle || "chest") as Muscle })}>+ Add exercise</button>
            <button className="btn" onClick={() => { const p = buildPlan(sets, stats).filter((n) => !(plan || []).some((o) => o.key === n.key)); updatePlan([...(plan || []).filter((r) => r.done), ...p]); }}>Rebuild plan</button>
          </div>
        </div>

        <div className="sec">
          <div className="sec-h"><h2>This week&apos;s quests</h2><span className="note">Week of {fmt(weekStart())}</span></div>
          <div className="quests">
            {q.map((x) => (
              <div key={x.t} className={"quest" + (x.v >= x.goal ? " done" : "")}>
                <div className="qt">{x.v >= x.goal ? "✓ " : ""}{x.t}  {Math.min(x.v, x.goal)}/{x.goal}</div>
                <div className="qbar"><i style={{ width: `${Math.min(100, (x.v / x.goal) * 100)}%` }} /></div>
                <div className="note">{x.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="sec">
          <div className="sec-h"><h2>Muscle levels</h2><span className="note">Level rises with every 2 personal bests</span></div>
          <div className="list">
            {[...MUSCLE_KEYS].sort((a, b) => stats[b].level - stats[a].level).map((k) => {
              const o = stats[k];
              return (
                <button key={k} className="mrow" onClick={() => setEditing({ muscle: k })}>
                  <div>
                    <div className="nm"><span className="sw" style={{ background: o.faded || o.last === null ? "var(--faded)" : `var(--r${o.rec})` }} />{MUSCLES[k]}{weakest.includes(k) && <span className="weak">weak point</span>}</div>
                    <div className="note">{o.sets7} sets this week · {recLabel(o).toLowerCase()}</div>
                  </div>
                  <div className="lvl"><i style={{ width: `${Math.max(6, (o.level / maxL) * 100)}%` }} /></div>
                  <div className="mono" style={{ textAlign: "right" }}>Lv {o.level}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sec">
          <h2>Personal bests</h2>
          <div className="badges">
            {pbs.map((s) => (
              <div key={s.id} className="badge"><div className="medal">PB</div><div className="bx">{amount(s.weight, s.reps)}</div><div className="bl">{s.exercise} · {fmt(new Date(s.ts))}</div></div>
            ))}
            {!pbs.length && <div className="note">Your first personal best shows up here.</div>}
          </div>
        </div>

        <div className="photo">
          <div className="sec-h"><h2>Photo day</h2><span className="mono">{isPhotoDay ? "today" : `${WD[nextPhoto.getDay()].slice(0, 3)} ${fmt(nextPhoto)} · in ${dayDiff(nextPhoto)}d`}</span></div>
          <ul><li>Front, side, back</li><li>Same spot, same light, same time of day</li><li>Morning, before eating. The 10-second timer gives you time to step back</li></ul>
          <div className="poses">
            {(["Front", "Side", "Back"] as const).map((p) => {
              const got = thisRound(p);
              return (
                <button key={p} className={"pose" + (got ? " done" : "")} onClick={() => setShooting(p)} disabled={uploading}>
                  {got && <img src={`/api/gym/photos/${got.id}`} alt={`${p} progress photo`} />}
                  <span>{got ? `✓ ${p}` : p}</span>
                </button>
              );
            })}
          </div>
          <div className="note">Review with the lift log: {summary}</div>
          <div className="lock"><span aria-hidden="true">🔒</span><span>Photos go to the private Progress photos database in Notion and only show here behind your passcode.</span></div>
        </div>
      </div>

      {editing && (
        <SetSheet
          sets={sets} stats={stats} row={editing.row} muscle={editing.muscle}
          onClose={() => setEditing(null)}
          onConfirm={(row, w, r) => { setEditing(null); confirm(row, w, r); }}
          onUpdatePlanned={(row) => { updatePlan((plan || []).map((x) => (x.key === row.key ? row : x))); setEditing(null); }}
        />
      )}
      {shooting && (
        <Camera title={`${shooting} photo`} ghostUrl={ghostFor(shooting) ? `/api/gym/photos/${ghostFor(shooting)!.id}` : null} onClose={() => setShooting(null)} onShot={(b) => uploadPhoto(shooting, b)} />
      )}
    </section>
  );
}

function SetSheet({ sets, stats, row, muscle, onClose, onConfirm, onUpdatePlanned }: {
  sets: GymSet[]; stats: Record<Muscle, MuscleStat>; row?: PlannedSet; muscle?: Muscle;
  onClose: () => void; onConfirm: (row: PlannedSet, w: number, r: number) => void; onUpdatePlanned: (row: PlannedSet) => void;
}) {
  const [m, setM] = useState<Muscle>(row?.muscle || muscle || "chest");
  const lastEx = [...sets].reverse().find((s) => s.muscle === m)?.exercise;
  const [ex, setEx] = useState<string>(row?.exercise || lastEx || EXERCISES[m][0][0]);
  const t0 = row ? { weight: row.weight, reps: row.reps } : nextTarget(sets, m, ex);
  const [w, setW] = useState(t0.weight);
  const [r, setR] = useState(t0.reps);
  const pick = (mm: Muscle, e?: string) => {
    const name = e || [...sets].reverse().find((s) => s.muscle === mm)?.exercise || EXERCISES[mm][0][0];
    setM(mm); setEx(name); const t = nextTarget(sets, mm, name); setW(t.weight); setR(t.reps);
  };
  const best = bestFor(sets, ex);
  const last = [...sets].reverse().find((s) => s.exercise === ex);
  const willPB = best > 0 && e1rm(w, r) > best + 0.01;
  const target: PlannedSet = row || { key: `${m}-${ex}-x${Date.now()}`, muscle: m, exercise: ex, weight: w, reps: r };

  return (
    <Sheet title={row ? row.exercise : `Log ${MUSCLES[m].toLowerCase()}`} eyebrow={`Level ${stats[m].level} · ${recLabel(stats[m])}`} onClose={onClose}>
      <div className="form">
        {!row && (
          <>
            <div className="field"><label>Muscle</label><div className="exs">{MUSCLE_KEYS.map((k) => <button key={k} aria-pressed={k === m} onClick={() => pick(k)}>{MUSCLES[k]}</button>)}</div></div>
            <div className="field"><label>Exercise</label><div className="exs">{EXERCISES[m].map(([n]) => <button key={n} aria-pressed={n === ex} onClick={() => pick(m, n)}>{n}</button>)}</div></div>
          </>
        )}
        {row && <p className="note" style={{ margin: 0 }}>Planned {amount(row.weight, row.reps)}. Set what you actually did.</p>}
        <div className="steppers">
          <Stepper id="sw" label="Weight kg" value={w} step={w === 0 ? 1 : 2.5} onChange={setW} />
          <Stepper id="sr" label="Reps" value={r} step={1} onChange={setR} />
        </div>
        <div className="note">
          {last ? `Last time: ${amount(last.weight, last.reps)} · best ${last.weight ? `estimated max ${best.toFixed(1)} kg` : `${best} reps`}` : "First time logging this one."}
          {willPB && <strong style={{ color: "var(--warn)" }}> · this would be a personal best</strong>}
        </div>
        <button className="btn ok big" disabled={r <= 0} onClick={() => onConfirm({ ...target, muscle: m, exercise: ex }, w, r)}>✓ I did {amount(w, r)}</button>
        {row && <button className="btn" onClick={() => onUpdatePlanned({ ...row, weight: w, reps: r })}>Just change the plan</button>}
      </div>
    </Sheet>
  );
}
