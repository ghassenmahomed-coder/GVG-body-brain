"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { WEEK } from "@/lib/config";
import { WD, fmt, sod } from "@/lib/dates";
import { muscleStats, weekStart, type GymSet, type Muscle } from "@/lib/gym";
import { recovery, type CheckIn } from "@/lib/coach";
import { isoDay } from "@/lib/dates";
import { buildItems, type TodayDTO } from "@/lib/today";
import TodayView from "./TodayView";
import GymView from "./GymView";
import { Toast, api, type ToastMsg } from "./ui";
import { sound } from "@/lib/sound";

function afterWork(d: Date) {
  if (WEEK.gymDays.includes(d.getDay())) return "gym";
  if (WEEK.motorDays.includes(d.getDay())) return "motorrijles from 17:00";
  return "";
}

export default function App() {
  const [view, setView] = useState<"home" | "gym">("home");
  const [today, setToday] = useState<TodayDTO | null>(null);
  const [sets, setSets] = useState<GymSet[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [gymLoading, setGymLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastMsg>(null);
  const [now, setNow] = useState(() => new Date());
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => setSoundOn(sound.enabled()), []);

  useEffect(() => {
    const route = () => setView(location.hash === "#gym" ? "gym" : "home");
    route(); window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);

  const loadToday = useCallback(async () => {
    try {
      const d = await api<TodayDTO>("/api/today");
      setToday(d); setErrors(d.errors);
    } catch (e) { setErrors([(e as Error).message]); }
    setLoading(false); setNow(new Date());
  }, []);
  const loadSets = useCallback(async () => {
    try { const r = await api<{ sets: GymSet[] }>("/api/gym/sets"); setSets(r.sets); }
    catch (e) { setErrors((x) => [...x, "Workout log: " + (e as Error).message]); }
    setGymLoading(false);
  }, []);
  const loadCheckins = useCallback(async () => {
    try { const r = await api<{ checkins: CheckIn[] }>("/api/gym/checkins"); setCheckins(r.checkins); }
    catch (e) { setErrors((x) => [...x, "Check-ins: " + (e as Error).message]); }
  }, []);
  useEffect(() => { loadToday(); loadSets(); loadCheckins(); }, [loadToday, loadSets, loadCheckins]);
  // Refresh when you come back to the app.
  useEffect(() => {
    const v = () => { if (document.visibilityState === "visible") { loadToday(); } };
    document.addEventListener("visibilitychange", v);
    return () => document.removeEventListener("visibilitychange", v);
  }, [loadToday]);

  const todayCheck = checkins.find((c) => c.date === isoDay(now)) ?? null;
  const sore = (todayCheck?.sore ?? []) as Muscle[];
  const stats = useMemo(() => muscleStats(sets, now.getTime(), recovery(sets, now.getTime(), sore)), [sets, now, sore.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => buildItems(today, sets, gymLoading ? null : stats, now), [today, sets, stats, gymLoading, now]);
  const gymDaysWeek = new Set(sets.filter((s) => s.ts >= weekStart(now).getTime()).map((s) => sod(s.ts).getTime())).size;
  const clearToast = useCallback(() => setToast(null), []);
  const tomorrow = new Date(sod(now).getTime() + 86400000);

  async function lock() { await fetch("/api/login", { method: "DELETE" }); location.href = "/login"; }

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <div className="wm brand" aria-label="GVG">GVG</div>
          <div className="eyebrow">{WD[now.getDay()]} {fmt(now)} · Paramaribo</div>
          <h1>Fa waka, Galayn</h1>
        </div>
        <nav className="tabs" aria-label="Views">
          <a href="#home" aria-current={view === "home" ? "page" : undefined}>Today</a>
          <a href="#gym" aria-current={view === "gym" ? "page" : undefined}>Gym</a>
        </nav>
      </header>
      <div className="planline">
        {now.getDay() >= 1 && now.getDay() <= 5 && <span><b>Work</b> until {WEEK.workUntil}</span>}
        {afterWork(now) && <span><b>After work</b> {afterWork(now)}</span>}
        {afterWork(tomorrow) && <span><b>Tomorrow</b> {afterWork(tomorrow)}</span>}
      </div>
      {errors.length > 0 && (
        <div className="banner" role="alert">
          Some data didn&apos;t load: {errors.join(" · ")}. <button className="btn small" onClick={() => { setErrors([]); loadToday(); loadSets(); }}>Try again</button>
        </div>
      )}

      {view === "home" ? (
        <TodayView items={items} loading={loading} onGym={() => (location.hash = "gym")} reload={loadToday} toast={setToast} gymDaysWeek={gymDaysWeek} />
      ) : (
        <GymView sets={sets} setSets={setSets} stats={stats} loading={gymLoading} toast={setToast} checkins={checkins} setCheckins={setCheckins} todayCheck={todayCheck} />
      )}

      <footer>
        <span>{today ? `Live from Todoist and Notion · updated ${new Date(today.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting to Todoist and Notion…"}</span>
        <span style={{ display: "flex", gap: 12 }}>
          <button onClick={() => { const on = !soundOn; sound.set(on); setSoundOn(on); if (on) sound.tap(); }} aria-pressed={soundOn}>{soundOn ? "Sound on" : "Sound off"}</button>
          {today && today.google === false && <a href="/api/google/connect">Connect Google</a>}
          <button onClick={() => { loadToday(); loadSets(); }}>Refresh</button>
          <button onClick={lock}>Lock</button>
        </span>
      </footer>
      <p className="credit">3D model: <a href="https://www.z-anatomy.com" target="_blank" rel="noreferrer">Z-Anatomy</a> (CC BY-SA 4.0), based on BodyParts3D by DBCLS (CC BY-SA 2.1 JP)</p>
      <Toast msg={toast} clear={clearToast} />
    </div>
  );
}
