"use client";
import { useEffect, useMemo, useState } from "react";
import { EXERCISES, MUSCLES, MUSCLE_KEYS, bestFor, e1rm, nextTarget, photoDays, quests, recLabel, weekStart, type GymSet, type Muscle, type MuscleStat, type PlannedSet } from "@/lib/gym";
import { WD, fmt, isoDay, dayDiff } from "@/lib/dates";
import { GymBody3D } from "./Body3D";
import { sound } from "@/lib/sound";
import { GOALS, adjustAfterSet, blockWeek, coachPlan, helpersOf, parseReview, reviewText, type CheckIn, type Goal, type Review } from "@/lib/coach";
import { Camera } from "./Camera";
import { Sheet, Stepper, api, json, type ToastMsg } from "./ui";

type Photo = { id: string; date: string | null; pose: string; hasPhoto: boolean };
type Props = {
  sets: GymSet[]; setSets: React.Dispatch<React.SetStateAction<GymSet[]>>; stats: Record<Muscle, MuscleStat>; loading: boolean; toast: (t: ToastMsg) => void;
  checkins: CheckIn[]; setCheckins: React.Dispatch<React.SetStateAction<CheckIn[]>>; todayCheck: CheckIn | null;
};
const GOAL_KEY = "gvg-goal";
function loadGoal(): Goal { try { const g = localStorage.getItem(GOAL_KEY); return g === "strength" || g === "both" ? g : "mass"; } catch { return "mass"; } }
const RIR_LABEL = ["0", "1", "2", "3", "4+"];

const PLAN_KEY = "gvg-plan-" + isoDay();
function loadPlan(): PlannedSet[] | null { try { const s = localStorage.getItem(PLAN_KEY); return s ? JSON.parse(s) : null; } catch { return null; } }
function savePlan(p: PlannedSet[]) { try { localStorage.setItem(PLAN_KEY, JSON.stringify(p)); } catch { /* private mode */ } }
const amount = (w: number, r: number) => (w ? `${w} kg × ${r}` : `${r} reps`);

export default function GymView({ sets, setSets, stats, loading, toast, checkins, setCheckins, todayCheck }: Props) {
  const [side, setSide] = useState<"front" | "back">("front");
  const [plan, setPlan] = useState<PlannedSet[] | null>(null);
  const [editing, setEditing] = useState<{ row?: PlannedSet; muscle?: Muscle } | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [shooting, setShooting] = useState<"Front" | "Side" | "Back" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [goal, setGoalState] = useState<Goal>("mass");
  const [skipped, setSkipped] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => setGoalState(loadGoal()), []);
  const setGoal = (g: Goal) => { setGoalState(g); try { localStorage.setItem(GOAL_KEY, g); } catch {} };

  const week = blockWeek(sets);
  const levels = Object.fromEntries(MUSCLE_KEYS.map((m) => [m, stats[m].level])) as Record<Muscle, number>;
  const reviews: Review[] = checkins.filter((c) => Date.parse(c.date) >= Date.now() - (week - 1) * 7 * 86400000 - 86400000).map((c) => parseReview(c.review));
  const check: CheckIn | null = todayCheck ? { ...todayCheck, goal } : skipped ? { date: isoDay(), sleep: 1, energy: 1, minutes: 45, sore: [], goal } : null;
  const coach = useMemo(() => (check ? coachPlan(sets, check, reviews, levels) : null), [check?.date, check?.minutes, check?.sleep, check?.energy, check?.sore.join(), goal, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build today's plan once the lift history has loaded; keep it for the day so ticks survive a reload.
  useEffect(() => {
    if (loading || plan || !coach) return;
    const p = loadPlan() ?? coach.rows;
    setPlan(p); savePlan(p);
  }, [loading, plan, coach]);
  const updatePlan = (p: PlannedSet[]) => { setPlan(p); savePlan(p); };

  useEffect(() => { api<{ photos: Photo[] }>("/api/gym/photos").then((r) => setPhotos(r.photos)).catch(() => {}); }, []);

  // Confirming is the only way a set counts. Saves to the Notion Workout log.
  async function confirm(row: PlannedSet, weight: number, reps: number) {
    setBusyKey(row.key);
    const pb = bestFor(sets, row.exercise) > 0 && e1rm(weight, reps) > bestFor(sets, row.exercise) + 0.01;
    try {
      const { id } = await api<{ id: string }>("/api/gym/sets", json("POST", { muscle: row.muscle, exercise: row.exercise, weight, reps, plannedWeight: row.weight, plannedReps: row.reps, pb, at: new Date().toISOString(), helpers: helpersOf(row.exercise), blockWeek: week }));
      const set: GymSet = { id, ts: Date.now(), muscle: row.muscle, exercise: row.exercise, weight, reps, pb, rir: null, helpers: helpersOf(row.exercise) };
      setSets((s) => [...s, set]);
      const next = (plan || []).some((r) => r.key === row.key) ? (plan || []).map((r) => (r.key === row.key ? { ...r, done: { id, weight, reps, pb } } : r)) : [...(plan || []), { ...row, done: { id, weight, reps, pb } }];
      updatePlan(next);
      if (pb) sound.record(); else sound.done();
      toast({ text: pb ? `New personal best: ${row.exercise} ${amount(weight, reps)}` : `Logged ${row.exercise} ${amount(weight, reps)}`, kind: pb ? "pb" : undefined, undo: () => undo(row.key, id, next) });
    } catch (e) { toast({ text: (e as Error).message, kind: "bad" }); }
    setBusyKey("");
  }
  // How hard was it? Saved on the set, and the next set of the same exercise adapts.
  async function rate(row: PlannedSet, rir: number) {
    if (!row.done?.id) return;
    const withRir = (plan || []).map((r) => (r.key === row.key && r.done ? { ...r, done: { ...r.done, rir } } : r));
    const next = adjustAfterSet(withRir, row.key, rir);
    updatePlan(next);
    setSets((s) => s.map((x) => (x.id === row.done!.id ? { ...x, rir } : x)));
    const moved = next.find((r, i) => r.adjusted && !(plan || [])[i]?.adjusted);
    if (moved) toast({ text: moved.adjusted === "up" ? `That was easy: next ${moved.exercise} set goes up` : `That was a grind: next ${moved.exercise} set goes down` });
    sound.tap();
    try { await api("/api/gym/sets", json("PATCH", { id: row.done.id, rir })); } catch (e) { toast({ text: (e as Error).message, kind: "bad" }); }
  }

  async function startCheckIn(c: Omit<CheckIn, "goal" | "date">) {
    const full: CheckIn = { ...c, date: isoDay(), goal };
    try {
      const { id } = await api<{ id: string }>("/api/gym/checkins", json("POST", full));
      setCheckins((x) => [...x, { ...full, id }]);
      try { localStorage.removeItem(PLAN_KEY); } catch {}
      setPlan(null); sound.done();
    } catch (e) { toast({ text: (e as Error).message, kind: "bad" }); }
  }

  async function saveReview(r: Review) {
    setReviewing(false);
    if (!todayCheck?.id) { toast({ text: "Do the check-in first so the review has somewhere to go." }); return; }
    const text = reviewText(r);
    try {
      await api("/api/gym/checkins", json("PATCH", { id: todayCheck.id, review: text }));
      setCheckins((x) => x.map((c) => (c.id === todayCheck.id ? { ...c, review: text } : c)));
      sound.record(); toast({ text: "Review saved. Next week's sets adjust to it." });
    } catch (e) { toast({ text: (e as Error).message, kind: "bad" }); }
  }

  async function undo(key: string, id: string, current?: PlannedSet[]) {
    setBusyKey(key);
    try {
      await api(`/api/gym/sets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setSets((s) => s.filter((x) => x.id !== id));
      updatePlan((current || plan || []).map((r) => (r.key === key ? { ...r, done: undefined } : r)));
      sound.undo();
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
        <GymBody3D side={side} stats={stats} onPick={(m) => setEditing({ muscle: m })} />
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
          <div className="coachbar">
            <span className="note">Block week {week} of 6{week === 6 ? " · deload" : ""} · Goal</span>
            <div className="seg" role="group" aria-label="Training goal">
              {(Object.keys(GOALS) as Goal[]).map((g) => <button key={g} aria-pressed={goal === g} onClick={() => { setGoal(g); try { localStorage.removeItem(PLAN_KEY); } catch {} setPlan(null); }}>{GOALS[g]}</button>)}
            </div>
          </div>
          {!check && !loading && <CheckInCard onStart={startCheckIn} onSkip={() => setSkipped(true)} />}
          {check && <>
          {coach?.notes.map((n) => <p key={n} className="coachnote">{n}</p>)}
          <p className="note" style={{ margin: 0 }}>Tick ✓ only when you did it, then tap how many more reps you could have done. Did more or less? Tap the amount first.</p>
          <div className="plan">
            {(plan || []).map((r) => (
              <div key={r.key} className={"prow" + (r.done ? " done" : "")}>
                <button className="tick" disabled={busyKey === r.key} aria-label={r.done ? `Undo ${r.exercise}` : `Confirm ${r.exercise} ${amount(r.weight, r.reps)}`} onClick={() => (r.done ? undo(r.key, r.done.id!) : confirm(r, r.weight, r.reps))}>{r.done ? "✓" : ""}</button>
                <div>
                  <div className="ex">{r.exercise}{r.done?.pb && <span className="pbmark">PB</span>}</div>
                  <div className="note">{MUSCLES[r.muscle]} · {recLabel(stats[r.muscle]).toLowerCase()}{r.rir !== undefined && !r.done ? ` · stop with ${r.rir}${r.rir >= 1 ? "–" + (r.rir + 1) : ""} left` : ""}{r.adjusted && !r.done ? (r.adjusted === "up" ? " · raised" : " · lowered") : ""}</div>
                  {r.why && !r.done && <div className="why">{r.why}</div>}
                  {r.done && r.done.rir == null && r.done.id && (
                    <div className="rir" role="group" aria-label="Reps left in the tank">
                      <span className="note">Could have done more?</span>
                      {RIR_LABEL.map((l, i) => <button key={l} onClick={() => rate(r, i)}>{l}</button>)}
                    </div>
                  )}
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
            <button className="btn" onClick={() => { if (!check) return; const p = coachPlan(sets, check, reviews, levels).rows.filter((n) => !(plan || []).some((o) => o.key === n.key && o.done)); updatePlan([...(plan || []).filter((r) => r.done), ...p]); }}>Rebuild plan</button>
            {doneCount > 0 && <button className="btn primary" onClick={() => setReviewing(true)}>Finish workout</button>}
          </div>
          </>}
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
      {reviewing && <ReviewSheet muscles={[...new Set((plan || []).filter((r) => r.done).map((r) => r.muscle))]} onClose={() => setReviewing(false)} onSave={saveReview} />}
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

function CheckInCard({ onStart, onSkip }: { onStart: (c: Omit<CheckIn, "goal" | "date">) => void; onSkip: () => void }) {
  const [sleep, setSleep] = useState<0 | 1 | 2>(1);
  const [energy, setEnergy] = useState<0 | 1 | 2>(1);
  const [minutes, setMinutes] = useState(45);
  const [sore, setSore] = useState<Muscle[]>([]);
  const [busy, setBusy] = useState(false);
  const three = (v: 0 | 1 | 2, set: (x: 0 | 1 | 2) => void, labels: string[], name: string) => (
    <div className="seg" role="group" aria-label={name}>{labels.map((l, i) => <button key={l} aria-pressed={v === i} onClick={() => set(i as 0 | 1 | 2)}>{l}</button>)}</div>
  );
  return (
    <div className="checkin">
      <h3>Quick check-in</h3>
      <div className="ci-row"><span>Sleep</span>{three(sleep, setSleep, ["Bad", "OK", "Good"], "Sleep")}</div>
      <div className="ci-row"><span>Energy</span>{three(energy, setEnergy, ["Low", "Normal", "High"], "Energy")}</div>
      <div className="ci-row"><span>Time</span><div className="seg" role="group" aria-label="Minutes available">{[30, 45, 60, 75].map((m) => <button key={m} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m} min</button>)}</div></div>
      <div className="field"><span className="note">Anything still sore? Tap it and the coach leaves it alone today.</span>
        <div className="exs">{MUSCLE_KEYS.map((m) => <button key={m} aria-pressed={sore.includes(m)} onClick={() => setSore((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]))}>{MUSCLES[m]}</button>)}</div>
      </div>
      <div className="actions">
        <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await onStart({ sleep, energy, minutes, sore }); setBusy(false); }}>Build my workout</button>
        <button className="btn" onClick={onSkip}>Skip</button>
      </div>
    </div>
  );
}

function ReviewSheet({ muscles, onClose, onSave }: { muscles: Muscle[]; onClose: () => void; onSave: (r: Review) => void }) {
  const [r, setR] = useState<Review>(() => Object.fromEntries(muscles.map((m) => [m, 0])) as Review);
  const opts: [string, -1 | 0 | 1][] = [["Too little", 1], ["Good", 0], ["Too much", -1]];
  return (
    <Sheet title="How was it?" eyebrow="Workout review" onClose={onClose}>
      <div className="form">
        <p className="note" style={{ margin: 0 }}>Per muscle: was today&apos;s work too little, about right, or too much? Next week&apos;s sets adjust to it.</p>
        {muscles.map((m) => (
          <div key={m} className="ci-row"><span>{MUSCLES[m]}</span>
            <div className="seg" role="group" aria-label={MUSCLES[m]}>{opts.map(([l, v]) => <button key={l} aria-pressed={r[m] === v} onClick={() => setR((x) => ({ ...x, [m]: v }))}>{l}</button>)}</div>
          </div>
        ))}
        <button className="btn ok big" onClick={() => onSave(r)}>Save review</button>
      </div>
    </Sheet>
  );
}
