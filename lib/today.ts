// Turns raw Todoist + Notion data into the items each body part shows, with a severity:
// 2 = red (overdue, lapsed), 1 = amber (close, waiting, quiet), 0 = calm.
import { AREA_ORDER, WEEK, type AreaId } from "./config";
import { dayDiff, fmt, parseDue, relDue, sod } from "./dates";
import { MUSCLES, MUSCLE_KEYS, type GymSet, type MuscleStat, type Muscle } from "./gym";

export type TaskDTO = { id: string; content: string; description: string; due: null | { date: string; recurring: boolean; string: string }; labels: string[]; area: AreaId; project: string; addedAt: string | null; url: string };
export type ExpiryDTO = { id: string; url: string; document: string; expires: string | null; type: string; person: string; car: string; notes: string };
export type PageDTO = { id: string; name: string; area: AreaId; quietDays: number; lastEdited: string | null; url: string | null };
export type TodoDTO = { id: string; text: string; due: string | null; pageId: string; page: string; area: AreaId; url: string };
export type TodayDTO = { tasks: TaskDTO[]; expiry: ExpiryDTO[]; pages: PageDTO[]; todos?: TodoDTO[]; todosPartial?: boolean; errors: string[]; fetchedAt: string };

export type Item = {
  key: string; area: AreaId; title: string; detail: string; sev: 0 | 1 | 2; when: string; sortDate?: number; source: string;
  kind: "task" | "expiry" | "page" | "gym" | "todo";
  task?: TaskDTO; expiry?: ExpiryDTO; todo?: TodoDTO; url?: string;
};

export function buildItems(data: TodayDTO | null, sets: GymSet[], stats: Record<Muscle, MuscleStat> | null, now = new Date()): Item[] {
  const items: Item[] = [];
  data?.tasks.forEach((t) => {
    let sev: 0 | 1 | 2 = 0, when = "", sortDate: number | undefined;
    if (t.due) {
      const d = parseDue(t.due.date); const n = dayDiff(d, now);
      sev = n < 0 ? 2 : n <= 1 ? 1 : 0; when = relDue(d, now); sortDate = d.getTime();
      if (t.due.date.includes("T") && n === 0) when = "today " + d.toTimeString().slice(0, 5);
    } else if (t.area === "heart" && t.addedAt) {
      const n = -dayDiff(new Date(t.addedAt), now);
      sev = n >= 14 ? 2 : n >= 3 ? 1 : 0; when = n === 0 ? "new" : `${n}d waiting`;
    }
    items.push({ key: "t" + t.id, area: t.area, title: t.content, detail: t.description.split("\n")[0].slice(0, 140) || t.project, sev, when, sortDate, source: "Todoist", kind: "task", task: t, url: t.url });
  });
  // Open to-dos from any Notion page: they always count as "to do"; a date in the to-do makes it red when late.
  data?.todos?.forEach((t) => {
    let sev: 0 | 1 | 2 = 1, when = "to do", sortDate: number | undefined;
    if (t.due) {
      const d = parseDue(t.due); const n = dayDiff(d, now);
      sev = n < 0 ? 2 : 1; when = relDue(d, now); sortDate = d.getTime();
    }
    items.push({ key: "n" + t.id, area: t.area, title: t.text, detail: t.page, sev, when, sortDate, source: "Notion", kind: "todo", todo: t, url: t.url });
  });
  data?.expiry.forEach((e) => {
    let sev: 0 | 1 | 2 = 0, when = "", sortDate: number | undefined;
    if (!e.expires) { sev = 1; when = "no date"; }
    else {
      const d = parseDue(e.expires); const n = dayDiff(d, now); sortDate = d.getTime();
      sev = n < 0 ? 2 : n <= 30 ? 1 : 0; when = n < 0 ? "lapsed " + fmt(d) : n <= 60 ? `in ${n}d` : fmt(d);
    }
    if (sev === 0) return; // calm documents stay in Notion, not on the body
    items.push({ key: "e" + e.id, area: "feet", title: e.document, detail: e.notes.slice(0, 140), sev, when, sortDate, source: "Notion", kind: "expiry", expiry: e, url: e.url });
  });
  data?.pages.forEach((p) => {
    if (!p.lastEdited) return;
    const n = -dayDiff(new Date(p.lastEdited), now);
    if (n < p.quietDays) return;
    items.push({ key: "p" + p.id, area: p.area, title: `${p.name} untouched for ${Math.floor(n / 7)} weeks`, detail: "Open it and decide: next step, park it, or archive it", sev: 1, when: `${Math.floor(n / 7)}w quiet`, source: "Notion", kind: "page", url: p.url || undefined });
  });
  if (stats) {
    const ws = sod(now).getTime();
    if (WEEK.gymDays.includes(now.getDay()) && !sets.some((s) => s.ts >= ws))
      items.push({ key: "g-day", area: "muscles", title: "Gym day", detail: "Today's plan is ready in the Gym tab", sev: 1, when: "today", source: "Weekschema", kind: "gym" });
    const faded = MUSCLE_KEYS.filter((m) => stats[m].faded);
    if (faded.length) items.push({ key: "g-fade", area: "muscles", title: "Fading: " + faded.map((m) => MUSCLES[m].toLowerCase()).join(", "), detail: "Not trained in 10+ days", sev: 1, when: "fading", source: "Workout log", kind: "gym" });
  }
  return items;
}

export function areaSeverity(items: Item[]) {
  const out = {} as Record<AreaId, 0 | 1 | 2>;
  AREA_ORDER.forEach((a) => (out[a] = 0));
  items.forEach((i) => { if (i.sev > out[i.area]) out[i.area] = i.sev; });
  return out;
}
