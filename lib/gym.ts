// Gym logic shared by the client views. Pure functions, no network.
import { WEEK } from "./config";

export type Muscle = "chest" | "shoulders" | "biceps" | "triceps" | "forearms" | "abs" | "back" | "glutes" | "quads" | "hamstrings" | "calves";
export type GymSet = { id: string; ts: number; muscle: string; exercise: string; weight: number; reps: number; pb: boolean; rir?: number | null; helpers?: Muscle[] };

export const MUSCLES: Record<Muscle, string> = {
  chest: "Chest", shoulders: "Shoulders", biceps: "Biceps", triceps: "Triceps", forearms: "Forearms", abs: "Abs",
  back: "Back", glutes: "Glutes", quads: "Quads", hamstrings: "Hamstrings", calves: "Calves",
};
export const MUSCLE_KEYS = Object.keys(MUSCLES) as Muscle[];

// Starter library: [name, starting kg]. 0 kg = bodyweight, counted in reps.
export const EXERCISES: Record<Muscle, [string, number][]> = {
  chest: [["Bench press", 40], ["Incline dumbbell press", 14], ["Push-up", 0]],
  shoulders: [["Overhead press", 25], ["Lateral raise", 6]],
  biceps: [["Barbell curl", 20], ["Hammer curl", 10]],
  triceps: [["Rope pushdown", 15], ["Dips", 0]],
  forearms: [["Wrist curl", 10], ["Farmer carry", 20]],
  abs: [["Hanging knee raise", 0], ["Cable crunch", 20]],
  back: [["Lat pulldown", 40], ["Barbell row", 40], ["Pull-up", 0]],
  glutes: [["Hip thrust", 50]],
  quads: [["Squat", 50], ["Leg press", 90]],
  hamstrings: [["Romanian deadlift", 40], ["Leg curl", 25]],
  calves: [["Standing calf raise", 40]],
};
// Muscles that go well together on one day.
const GROUPS: Muscle[][] = [
  ["chest", "shoulders", "triceps"],
  ["back", "biceps", "forearms"],
  ["quads", "hamstrings", "glutes", "calves"],
];

export const e1rm = (w: number, r: number) => (w > 0 ? w * (1 + r / 30) : r);
const DAY = 86400000;

export type MuscleStat = { last: number | null; hours: number; rec: 1 | 2 | 3 | 4; faded: boolean; pbs: number; level: number; sets7: number };

// recov: recovery % per muscle from the coach (lib/coach.ts). Without it, recovery falls back to hours since last trained.
export function muscleStats(sets: GymSet[], now = Date.now(), recov?: Record<Muscle, number>): Record<Muscle, MuscleStat> {
  const out = {} as Record<Muscle, MuscleStat>;
  MUSCLE_KEYS.forEach((m) => (out[m] = { last: null, hours: Infinity, rec: 4, faded: false, pbs: 0, level: 1, sets7: 0 }));
  const best: Record<string, number> = {};
  [...sets].sort((a, b) => a.ts - b.ts).forEach((s) => {
    const o = out[s.muscle as Muscle];
    if (!o) return;
    o.last = Math.max(o.last ?? 0, s.ts);
    if (now - s.ts < 7 * DAY) o.sets7++;
    const v = e1rm(s.weight, s.reps);
    if (best[s.exercise] !== undefined && v > best[s.exercise] + 0.01) o.pbs++;
    best[s.exercise] = Math.max(best[s.exercise] ?? -1, v);
  });
  MUSCLE_KEYS.forEach((m) => {
    const o = out[m];
    o.hours = o.last ? (now - o.last) / 3600000 : Infinity;
    const r = recov?.[m];
    o.rec = r !== undefined ? (r < 40 ? 1 : r < 65 ? 2 : r < 80 ? 3 : 4) : o.hours < 24 ? 1 : o.hours < 48 ? 2 : o.hours < 72 ? 3 : 4;
    o.faded = o.last !== null && o.hours >= 240;
    o.level = 1 + Math.floor(o.pbs / 2);
  });
  return out;
}

export function recLabel(o: MuscleStat) {
  if (o.last === null) return "Not trained yet";
  if (o.faded) return `${Math.floor(o.hours / 24)} days since last trained`;
  return ["", "Just trained", "Recovering", "Almost ready", "Ready"][o.rec];
}

export function bestFor(sets: GymSet[], exercise: string) {
  return sets.filter((s) => s.exercise === exercise).reduce((b, s) => Math.max(b, e1rm(s.weight, s.reps)), 0);
}

export type PlannedSet = { key: string; muscle: Muscle; exercise: string; weight: number; reps: number; rir?: number; why?: string; adjusted?: "up" | "down"; done?: { id: string | null; weight: number; reps: number; pb: boolean; rir?: number | null } };

// Today's plan: the readiest muscle group, one main exercise per muscle, 3 sets at last session's top set.
// If you hit 10+ reps on every set last time, the weight goes up a step.
export function buildPlan(sets: GymSet[], stats: Record<Muscle, MuscleStat>): PlannedSet[] {
  const score = (g: Muscle[]) => g.reduce((s, m) => s + (stats[m].faded ? 3 : stats[m].rec === 4 ? 2 : stats[m].rec === 3 ? 1 : -3), 0);
  const group = [...GROUPS].sort((a, b) => score(b) - score(a))[0];
  const plan: PlannedSet[] = [];
  group.forEach((m) => {
    if (stats[m].rec <= 2 && !stats[m].faded) return; // still recovering: skip it today
    const lastSet = [...sets].reverse().find((s) => s.muscle === m);
    const exercise = lastSet?.exercise || EXERCISES[m][0][0];
    const target = nextTarget(sets, m, exercise);
    for (let i = 1; i <= 3; i++) plan.push({ key: `${m}-${exercise}-${i}`, muscle: m, exercise, weight: target.weight, reps: target.reps });
  });
  return plan;
}

export function nextTarget(sets: GymSet[], m: Muscle, exercise: string) {
  const base = EXERCISES[m].find((e) => e[0] === exercise)?.[1] ?? 0;
  const mine = sets.filter((s) => s.exercise === exercise);
  if (!mine.length) return { weight: base, reps: 8 };
  const lastDay = new Date(mine[mine.length - 1].ts).toDateString();
  const session = mine.filter((s) => new Date(s.ts).toDateString() === lastDay);
  const top = session.reduce((a, b) => (e1rm(b.weight, b.reps) > e1rm(a.weight, a.reps) ? b : a));
  const allTen = session.length >= 2 && session.every((s) => s.reps >= 10);
  if (top.weight > 0 && allTen) return { weight: top.weight + (top.weight >= 40 ? 2.5 : 1), reps: 8 };
  if (top.weight === 0) return { weight: 0, reps: top.reps + (allTen ? 1 : 0) };
  return { weight: top.weight, reps: top.reps };
}

export function weekStart(now = new Date()) {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() - ((d.getDay() + 6) % 7) * DAY);
}

export function quests(sets: GymSet[], now = new Date()) {
  const ws = weekStart(now).getTime();
  const wk = sets.filter((s) => s.ts >= ws);
  const dayKey = (t: number) => new Date(t).toDateString();
  const days = new Set(wk.map((s) => dayKey(s.ts))).size;
  const legDays = new Set(wk.filter((s) => ["quads", "hamstrings", "glutes", "calves"].includes(s.muscle)).map((s) => dayKey(s.ts))).size;
  const pbWeek = wk.filter((s) => s.pb).length;
  const fadedAtStart = MUSCLE_KEYS.filter((m) => {
    const prev = sets.filter((s) => s.muscle === m && s.ts < ws);
    const last = prev.length ? Math.max(...prev.map((s) => s.ts)) : 0;
    return last > 0 && ws - last >= 10 * DAY;
  });
  const woke = fadedAtStart.filter((m) => wk.some((s) => s.muscle === m)).length;
  return [
    { t: "Show up 4 days", v: days, goal: WEEK.gymDays.length, d: "Wed, Fri, Sat, Sun on your schedule" },
    { t: "Legs twice", v: legDays, goal: 2, d: "Quads, hamstrings, glutes or calves" },
    // Nothing faded means there is nothing to wake: count the quest as done.
    { t: "Wake a faded muscle", v: fadedAtStart.length ? Math.min(woke, 1) : 1, goal: 1, d: fadedAtStart.length ? fadedAtStart.map((m) => MUSCLES[m]).join(", ") : "Nothing faded this week" },
    { t: "Beat one personal best", v: Math.min(pbWeek, 1), goal: 1, d: "Any lift, any muscle" },
  ];
}

export function firstSunday(y: number, m: number) {
  const d = new Date(y, m, 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  return d;
}
export function photoDays(now = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  let next = firstSunday(now.getFullYear(), now.getMonth());
  if (next < today) next = firstSunday(now.getFullYear(), now.getMonth() + 1);
  let prev = firstSunday(now.getFullYear(), now.getMonth());
  if (prev > today) prev = firstSunday(now.getFullYear(), now.getMonth() - 1);
  return { next, prev };
}
