// The gym coach. Pure functions, no network. It decides today's workout from:
// - how recovered each muscle is (fatigue from recent sets, scaled by how hard they were),
// - how many sets each muscle still needs this week (a weekly target that grows through a 6-week block),
// - how you feel today (sleep, energy, sore muscles, time available),
// - what you lifted last time (double progression: add reps up to the top of the range, then add weight).
import { WEEK } from "./config";
import { EXERCISES, MUSCLES, MUSCLE_KEYS, e1rm, weekStart, type GymSet, type Muscle, type PlannedSet } from "./gym";

export type Goal = "mass" | "strength" | "both";
export const GOALS: Record<Goal, string> = { mass: "Muscle mass", strength: "Strength", both: "Both" };
export type CheckIn = { id?: string | null; date: string; sleep: 0 | 1 | 2; energy: 0 | 1 | 2; minutes: number; sore: Muscle[]; goal: Goal; review?: string };
export type Review = Partial<Record<Muscle, -1 | 0 | 1>>; // -1 too much, 0 good, +1 too little

const HOUR = 3600000, DAY = 86400000;
const BIG: Muscle[] = ["chest", "back", "quads", "hamstrings", "glutes"];
const SMALL: Muscle[] = ["forearms", "calves", "abs"];

// Exercise facts: helper muscles (count half a set) and whether it's a compound lift.
const INFO: Record<string, { helpers: Muscle[]; compound: boolean }> = {
  "Bench press": { helpers: ["shoulders", "triceps"], compound: true },
  "Incline dumbbell press": { helpers: ["shoulders", "triceps"], compound: true },
  "Push-up": { helpers: ["shoulders", "triceps"], compound: true },
  "Overhead press": { helpers: ["triceps"], compound: true },
  "Lateral raise": { helpers: [], compound: false },
  "Barbell curl": { helpers: ["forearms"], compound: false },
  "Hammer curl": { helpers: ["forearms"], compound: false },
  "Rope pushdown": { helpers: [], compound: false },
  "Dips": { helpers: ["chest", "shoulders"], compound: true },
  "Wrist curl": { helpers: [], compound: false },
  "Farmer carry": { helpers: ["back"], compound: true },
  "Hanging knee raise": { helpers: [], compound: false },
  "Cable crunch": { helpers: [], compound: false },
  "Lat pulldown": { helpers: ["biceps"], compound: true },
  "Barbell row": { helpers: ["biceps", "forearms"], compound: true },
  "Pull-up": { helpers: ["biceps", "forearms"], compound: true },
  "Hip thrust": { helpers: ["hamstrings"], compound: true },
  "Squat": { helpers: ["glutes"], compound: true },
  "Leg press": { helpers: ["glutes"], compound: true },
  "Romanian deadlift": { helpers: ["glutes", "back"], compound: true },
  "Leg curl": { helpers: [], compound: false },
  "Standing calf raise": { helpers: [], compound: false },
};
export const helpersOf = (exercise: string): Muscle[] => INFO[exercise]?.helpers ?? [];
const isCompound = (exercise: string) => INFO[exercise]?.compound ?? true;

export function repRange(goal: Goal, exercise: string): [number, number] {
  const c = isCompound(exercise);
  if (goal === "strength") return c ? [4, 6] : [8, 12];
  if (goal === "both") return c ? [5, 8] : [8, 12];
  return c ? [6, 10] : [10, 15];
}
const step = (w: number) => (w >= 20 ? 2.5 : 1);
// A set at 0 to 1 reps in reserve counts fully; easier sets count less.
const hardness = (rir?: number | null) => (rir == null ? 0.9 : rir <= 1 ? 1 : rir === 2 ? 0.9 : rir === 3 ? 0.75 : 0.6);

/** Recovery per muscle, 0 (wrecked) to 100 (fresh). */
export function recovery(sets: GymSet[], now = Date.now(), sore: Muscle[] = []): Record<Muscle, number> {
  const fatigue = Object.fromEntries(MUSCLE_KEYS.map((m) => [m, 0])) as Record<Muscle, number>;
  for (const s of sets) {
    const hours = (now - s.ts) / HOUR;
    if (hours < 0 || hours > 24 * 7) continue;
    const h = hardness(s.rir);
    const add = (m: Muscle, w: number) => { const tau = BIG.includes(m) ? 36 : 24; fatigue[m] += w * h * Math.exp(-hours / tau); };
    if (s.muscle in fatigue) add(s.muscle as Muscle, 1);
    (s.helpers ?? helpersOf(s.exercise)).forEach((m) => add(m, 0.5));
  }
  const out = {} as Record<Muscle, number>;
  MUSCLE_KEYS.forEach((m) => {
    let r = Math.max(0, Math.min(100, 100 - fatigue[m] * 20));
    if (sore.includes(m)) r = Math.min(r, 40);
    out[m] = Math.round(r);
  });
  return out;
}

/** Week of the current 6-week block (week 6 is a lighter deload week). Counted from the first logged set. */
export function blockWeek(sets: GymSet[], now = new Date()) {
  if (!sets.length) return 1;
  const first = weekStart(new Date(Math.min(...sets.map((s) => s.ts)))).getTime();
  const weeks = Math.floor((weekStart(now).getTime() - first) / (7 * DAY));
  return (weeks % 6) + 1;
}

/** Sum of reviews in this block: + means you asked for more sets, - for fewer. */
export function parseReview(text: string | undefined): Review {
  const out: Review = {};
  (text || "").split(/[;,]/).forEach((part) => {
    const [k, v] = part.split(":").map((x) => x.trim().toLowerCase());
    if (!(k in MUSCLES)) return;
    out[k as Muscle] = v === "too little" || v === "te weinig" ? 1 : v === "too much" || v === "te veel" ? -1 : 0;
  });
  return out;
}
export const reviewText = (r: Review) => (Object.entries(r) as [Muscle, number][]).map(([m, v]) => `${m}: ${v > 0 ? "too little" : v < 0 ? "too much" : "good"}`).join("; ");

/** Weekly set target per muscle. Grows 2 sets a week through the block, halves in the deload week. */
export function weeklyTargets(goal: Goal, week: number, reviews: Review[]): Record<Muscle, number> {
  const out = {} as Record<Muscle, number>;
  MUSCLE_KEYS.forEach((m) => {
    const base = goal === "strength" ? 6 : goal === "both" ? 8 : 10;
    let t = base + Math.min(week - 1, 4) * (goal === "strength" ? 1 : 2) - (SMALL.includes(m) ? 2 : 0);
    t += Math.max(-4, Math.min(4, reviews.reduce((a, r) => a + (r[m] ?? 0), 0)));
    if (week === 6) t = Math.round(t / 2);
    out[m] = Math.max(4, Math.min(22, t));
  });
  return out;
}

/** Hard sets done this week per muscle; helper muscles count half. */
export function setsThisWeek(sets: GymSet[], now = new Date()): Record<Muscle, number> {
  const ws = weekStart(now).getTime();
  const out = Object.fromEntries(MUSCLE_KEYS.map((m) => [m, 0])) as Record<Muscle, number>;
  sets.filter((s) => s.ts >= ws).forEach((s) => {
    if (s.muscle in out) out[s.muscle as Muscle] += 1;
    (s.helpers ?? helpersOf(s.exercise)).forEach((m) => (out[m] += 0.5));
  });
  return out;
}

/** Gym days left this week, today included. */
export function gymDaysLeft(now = new Date()) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const idx = order.indexOf(now.getDay());
  return Math.max(1, order.slice(idx).filter((d) => WEEK.gymDays.includes(d)).length);
}

/** What to lift next time on this exercise, with the reason. */
export function progression(sets: GymSet[], muscle: Muscle, exercise: string, goal: Goal, deload: boolean) {
  const [lo, hi] = repRange(goal, exercise);
  const base = EXERCISES[muscle].find((e) => e[0] === exercise)?.[1] ?? 0;
  const mine = sets.filter((s) => s.exercise === exercise);
  if (!mine.length) return { weight: base, reps: lo + 2, rirTarget: 2, why: `First time: start light at ${lo + 2} reps and note how hard it felt` };
  const lastDay = new Date(mine[mine.length - 1].ts).toDateString();
  const session = mine.filter((s) => new Date(s.ts).toDateString() === lastDay);
  const top = session.reduce((a, b) => (e1rm(b.weight, b.reps) > e1rm(a.weight, a.reps) ? b : a));
  const days = Math.round((Date.now() - top.ts) / DAY);
  let weight = top.weight, reps = top.reps, why: string;
  const allTop = session.every((s) => s.reps >= hi && (s.rir == null || s.rir >= 1));
  const failedLow = session.some((s) => s.rir === 0 && s.reps < lo);
  const amt = (w: number, r: number) => (w ? `${w} kg × ${r}` : `${r} reps`);
  if (weight === 0) {
    reps = allTop ? top.reps + 1 : Math.min(top.reps + 1, 30);
    why = `Last time ${top.reps} reps, so aim for ${reps}`;
  } else if (allTop) {
    weight = top.weight + step(top.weight); reps = lo;
    why = `Hit ${hi} reps on every set last time, so +${step(top.weight)} kg and back to ${lo}`;
  } else if (failedLow) {
    weight = Math.max(0, top.weight - step(top.weight)); reps = lo;
    why = `Last time was too heavy (${amt(top.weight, top.reps)} with nothing left), so a bit lighter`;
  } else {
    reps = Math.max(lo, Math.min(hi, top.reps + 1));
    why = `Last time ${amt(top.weight, top.reps)}, so try ${reps} reps before adding weight`;
  }
  if (days > 14 && weight > 0) { weight = Math.max(base, Math.round((weight * 0.9) / step(weight)) * step(weight)); why = `${days} days since you last did this, so 10% lighter to ease back in`; }
  if (deload && weight > 0) { weight = Math.round((weight * 0.85) / step(weight)) * step(weight); why = "Deload week: lighter weight, fewer sets, so you come back stronger"; }
  return { weight, reps, rirTarget: deload ? 3 : goal === "strength" ? 2 : 1, why };
}

export type CoachPlan = { rows: PlannedSet[]; notes: string[]; week: number; targets: Record<Muscle, number>; done: Record<Muscle, number>; rec: Record<Muscle, number> };

/** Today's workout. */
export function coachPlan(sets: GymSet[], check: CheckIn, reviews: Review[], levels: Record<Muscle, number>, now = new Date()): CoachPlan {
  const goal = check.goal;
  const week = blockWeek(sets, now);
  const deload = week === 6;
  const targets = weeklyTargets(goal, week, reviews);
  const done = setsThisWeek(sets, now);
  const rec = recovery(sets, now.getTime(), check.sore);
  const daysLeft = gymDaysLeft(now);
  const tired = check.sleep === 0 || check.energy === 0;
  const perSet = goal === "strength" ? 4 : 3; // minutes per set including rest
  let budget = Math.max(4, Math.floor(check.minutes / perSet));
  if (tired) budget = Math.round(budget * 0.75);
  const notes: string[] = [];
  if (deload) notes.push("Deload week: half the sets and lighter weights. Next week a new block starts.");
  if (tired) notes.push("You slept badly or have low energy, so today is shorter and stays a rep or two away from failure.");
  if (check.sore.length) notes.push(`Skipping sore muscles: ${check.sore.map((m) => MUSCLES[m]).join(", ")}.`);

  const top = Math.max(...MUSCLE_KEYS.map((m) => levels[m]));
  const weakest = [...MUSCLE_KEYS].filter((m) => levels[m] < top).sort((a, b) => levels[a] - levels[b]).slice(0, 2);
  const cand = MUSCLE_KEYS.map((m) => {
    const need = Math.max(0, targets[m] - done[m]);
    const lastTs = Math.max(0, ...sets.filter((s) => s.muscle === m).map((s) => s.ts));
    const faded = lastTs > 0 && now.getTime() - lastTs >= 10 * DAY;
    const score = need / targets[m] + (faded ? 0.4 : 0) + (weakest.includes(m) ? 0.2 : 0) + (BIG.includes(m) ? 0.1 : 0) + (rec[m] - 70) / 100;
    return { m, need, faded, score };
  }).filter((c) => c.need >= 1 && rec[c.m] >= 70 && !check.sore.includes(c.m)).sort((a, b) => b.score - a.score);

  const rows: PlannedSet[] = [];
  for (const c of cand) {
    if (budget < 2) break;
    const today = Math.min(Math.ceil(c.need / daysLeft) + (c.faded ? 1 : 0), deload ? 3 : 6, budget);
    if (today < 2) continue;
    // Main exercise: the one you used last for this muscle, else the first in the library.
    const used = [...sets].reverse().filter((s) => s.muscle === c.m).map((s) => s.exercise);
    const main = used[0] || EXERCISES[c.m][0][0];
    const second = EXERCISES[c.m].map((e) => e[0]).find((e) => e !== main);
    const split: [string, number][] = today >= 4 && second ? [[main, Math.ceil(today / 2)], [second, Math.floor(today / 2)]] : [[main, today]];
    const reason = c.faded ? `${MUSCLES[c.m]} hasn't been trained in 10+ days` : `${MUSCLES[c.m]}: ${Math.round(done[c.m])} of ${targets[c.m]} sets this week`;
    for (const [ex, n] of split) {
      const p = progression(sets, c.m, ex, goal, deload);
      const rir = tired ? p.rirTarget + 1 : p.rirTarget;
      for (let i = 1; i <= n; i++) rows.push({ key: `${c.m}-${ex}-${i}`, muscle: c.m, exercise: ex, weight: p.weight, reps: p.reps, rir, why: i === 1 ? `${reason}. ${p.why}.` : undefined });
    }
    budget -= today;
  }
  // Big muscles and compound lifts first, while you're fresh.
  const rank = (r: PlannedSet) => (BIG.includes(r.muscle) ? 0 : 1) * 2 + (isCompound(r.exercise) ? 0 : 1);
  rows.sort((a, b) => rank(a) - rank(b));
  if (!rows.length) notes.push("Everything you still need this week is recovering. Rest today, or log something light.");
  return { rows, notes, week, targets, done, rec };
}

/** After a set: adjust the next planned set of the same exercise based on how hard it felt. */
export function adjustAfterSet(rows: PlannedSet[], key: string, rir: number): PlannedSet[] {
  const i = rows.findIndex((r) => r.key === key);
  if (i < 0) return rows;
  const cur = rows[i];
  const target = cur.rir ?? 1;
  return rows.map((r, j) => {
    if (j <= i || r.done || r.exercise !== cur.exercise) return r;
    if (rir >= target + 2) return r.weight > 0 ? { ...r, weight: r.weight + step(r.weight), adjusted: "up" } : { ...r, reps: r.reps + 2, adjusted: "up" };
    if (rir === 0 && (cur.done?.reps ?? cur.reps) < cur.reps) return r.weight > 0 ? { ...r, weight: Math.max(0, r.weight - step(r.weight)), adjusted: "down" } : { ...r, reps: Math.max(1, r.reps - 2), adjusted: "down" };
    return r;
  });
}
