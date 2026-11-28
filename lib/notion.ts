// Notion reads and writes for the app. Server-only: the token never reaches the browser.
import "server-only";
import { Client } from "@notionhq/client";
import { NOTION } from "./config";

let client: Client | null = null;
function notion() {
  if (!process.env.NOTION_TOKEN) throw new Error("NOTION_TOKEN is not set");
  client ??= new Client({ auth: process.env.NOTION_TOKEN });
  return client;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const text = (p: any): string => (p?.title ?? p?.rich_text ?? []).map((t: any) => t.plain_text).join("");
const sel = (p: any): string => p?.select?.name ?? "";
const num = (p: any): number => (typeof p?.number === "number" ? p.number : 0);
const date = (p: any): string | null => p?.date?.start ?? null;

async function queryAll(dataSourceId: string, args: Record<string, unknown> = {}) {
  const out: any[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const res: any = await notion().dataSources.query({ data_source_id: dataSourceId, page_size: 100, start_cursor: cursor, ...args } as any);
    out.push(...res.results);
    if (!res.has_more) break;
    cursor = res.next_cursor;
  }
  return out;
}

export type SetRow = { id: string; ts: number; muscle: string; exercise: string; weight: number; reps: number; pb: boolean; rir: number | null; helpers?: string[] };
const multi = (p: any): string[] => (p?.multi_select ?? []).map((o: any) => o.name);
const numOrNull = (p: any): number | null => (typeof p?.number === "number" ? p.number : null);
export type ExpiryRow = { id: string; url: string; document: string; expires: string | null; type: string; person: string; car: string; notes: string; status: string; waitingOn: string; edited: string };

export async function listSets(sinceDays = 180): Promise<SetRow[]> {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const rows = await queryAll(NOTION.workoutLog, {
    filter: { property: "Date", date: { on_or_after: since } },
    sorts: [{ property: "Date", direction: "ascending" }],
  });
  return rows.map((r) => ({
    id: r.id,
    ts: Date.parse(date(r.properties.Date) || r.created_time),
    muscle: sel(r.properties.Muscle).toLowerCase(),
    exercise: text(r.properties.Exercise),
    weight: num(r.properties["Weight kg"]),
    reps: num(r.properties.Reps),
    pb: !!r.properties.PB?.checkbox,
    rir: numOrNull(r.properties.RIR),
    ...(multi(r.properties.Hulpspieren).length ? { helpers: multi(r.properties.Hulpspieren) } : {}),
  }));
}

export async function addSet(s: { muscle: string; exercise: string; weight: number; reps: number; plannedWeight?: number; plannedReps?: number; pb: boolean; at: string; helpers?: string[]; blockWeek?: number; rir?: number | null }) {
  const muscle = s.muscle.charAt(0).toUpperCase() + s.muscle.slice(1);
  const page: any = await notion().pages.create({
    parent: { type: "data_source_id", data_source_id: NOTION.workoutLog },
    properties: {
      Exercise: { title: [{ text: { content: s.exercise } }] },
      Muscle: { select: { name: muscle } },
      Date: { date: { start: s.at } },
      "Weight kg": { number: s.weight },
      Reps: { number: s.reps },
      "Planned weight kg": { number: s.plannedWeight ?? null },
      "Planned reps": { number: s.plannedReps ?? null },
      PB: { checkbox: s.pb },
      Hulpspieren: { multi_select: (s.helpers ?? []).map((name) => ({ name })) },
      "Blok-week": { number: s.blockWeek ?? null },
      RIR: { number: s.rir ?? null },
    },
  } as any);
  return page.id as string;
}

export async function updateSetRir(id: string, rir: number) {
  await assertParent(id, NOTION.workoutLog);
  await notion().pages.update({ page_id: id, properties: { RIR: { number: rir } } } as any);
}

// Only touch pages that live in the database we expect, so an id from the browser can't edit other pages.
async function assertParent(pageId: string, dataSourceId: string) {
  const page: any = await notion().pages.retrieve({ page_id: pageId });
  const parent = page.parent?.data_source_id ?? page.parent?.database_id ?? "";
  if (parent.replace(/-/g, "") !== dataSourceId.replace(/-/g, "")) throw new Error("That row isn't in the expected database.");
}

export type CheckinRow = { id: string; date: string; sleep: number; energy: number; minutes: number; sore: string[]; goal: string; review: string };
const SLEEP = ["Slecht", "Oké", "Goed"], ENERGY = ["Laag", "Normaal", "Hoog"], GOAL: Record<string, string> = { mass: "Spiermassa", strength: "Kracht", both: "Allebei" };

export async function listCheckins(sinceDays = 60): Promise<CheckinRow[]> {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString().slice(0, 10);
  const rows = await queryAll(NOTION.checkins, { filter: { property: "Date", date: { on_or_after: since } }, sorts: [{ property: "Date", direction: "ascending" }] });
  return rows.map((r) => ({
    id: r.id,
    date: date(r.properties.Date) ?? r.created_time.slice(0, 10),
    sleep: Math.max(0, SLEEP.indexOf(sel(r.properties.Slaap))),
    energy: Math.max(0, ENERGY.indexOf(sel(r.properties.Energie))),
    minutes: num(r.properties["Tijd min"]),
    sore: multi(r.properties["Pijnlijke spieren"]),
    goal: Object.keys(GOAL).find((k) => GOAL[k] === sel(r.properties.Doel)) ?? "mass",
    review: text(r.properties.Terugblik),
  }));
}

export async function addCheckin(c: { date: string; sleep: number; energy: number; minutes: number; sore: string[]; goal: string }) {
  const page: any = await notion().pages.create({
    parent: { type: "data_source_id", data_source_id: NOTION.checkins },
    properties: {
      Name: { title: [{ text: { content: `Check-in ${c.date}` } }] },
      Date: { date: { start: c.date } },
      Slaap: { select: { name: SLEEP[c.sleep] ?? "Oké" } },
      Energie: { select: { name: ENERGY[c.energy] ?? "Normaal" } },
      "Tijd min": { number: c.minutes },
      "Pijnlijke spieren": { multi_select: c.sore.map((name) => ({ name })) },
      Doel: { select: { name: GOAL[c.goal] ?? "Spiermassa" } },
    },
  } as any);
  return page.id as string;
}

export async function updateCheckinReview(id: string, review: string) {
  await assertParent(id, NOTION.checkins);
  await notion().pages.update({ page_id: id, properties: { Terugblik: { rich_text: [{ text: { content: review.slice(0, 1900) } }] } } } as any);
}

export async function deleteSet(id: string) {
  await notion().pages.update({ page_id: id, in_trash: true } as any);
}

export async function listExpiry(): Promise<ExpiryRow[]> {
  const rows = await queryAll(NOTION.expiryDates, { sorts: [{ property: "Expires", direction: "ascending" }] });
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    document: text(r.properties.Document),
    expires: date(r.properties.Expires),
    type: sel(r.properties.Type),
    person: sel(r.properties.Persoon),
    car: sel(r.properties.Auto),
    notes: text(r.properties.Notes),
    status: sel(r.properties.Status),
    waitingOn: text(r.properties["Wacht op"]),
    edited: r.last_edited_time,
  }));
}

export const EXPIRY_STATUS = ["Te doen", "Bezig", "Wacht op", "Klaar"] as const;
export const EXPIRY_TYPES = ["ID / passport", "Driver license", "Vehicle", "Insurance", "Keuring", "Work certificate", "Diploma", "Other"] as const;
const rt = (s: string) => ({ rich_text: s ? [{ text: { content: s.slice(0, 1900) } }] : [] });

export async function updateExpiry(id: string, patch: { expires?: string | null; notes?: string; status?: string; waitingOn?: string }) {
  await assertParent(id, NOTION.expiryDates);
  const properties: any = {};
  if (patch.expires !== undefined) properties.Expires = { date: patch.expires ? { start: patch.expires } : null };
  if (patch.notes !== undefined) properties.Notes = rt(patch.notes);
  if (patch.status !== undefined) properties.Status = { select: patch.status ? { name: patch.status } : null };
  if (patch.waitingOn !== undefined) properties["Wacht op"] = rt(patch.waitingOn);
  await notion().pages.update({ page_id: id, properties } as any);
}

export async function addExpiry(e: { document: string; type: string; person: string; expires: string | null; notes: string }) {
  const properties: any = { Document: { title: [{ text: { content: e.document.slice(0, 200) } }] }, Notes: rt(e.notes), Status: { select: { name: "Te doen" } } };
  if (e.type) properties.Type = { select: { name: e.type } };
  if (e.person) properties.Persoon = { select: { name: e.person } };
  if (e.expires) properties.Expires = { date: { start: e.expires } };
  const page: any = await notion().pages.create({ parent: { type: "data_source_id", data_source_id: NOTION.expiryDates }, properties } as any);
  return page.id as string;
}

/* ---------- People (Heart) ---------- */
export type PersonRow = { id: string; url: string; name: string; kind: string; role: string; links: string[]; phone: string; email: string; status: string; followUp: string | null; notes: string };
export const PEOPLE_STATUS = ["Nu mee bezig", "Follow-up", "Rustig"] as const;
export const PEOPLE_LINKS = ["SuriRides", "Tru Tori", "Pulse", "Body Map", "Halliburton", "Familie", "Anders"] as const;

const toPerson = (r: any): PersonRow => ({
  id: r.id, url: r.url, name: text(r.properties.Naam), kind: sel(r.properties.Soort), role: text(r.properties.Rol),
  links: (r.properties["Verbonden met"]?.multi_select ?? []).map((o: any) => o.name),
  phone: r.properties.Telefoon?.phone_number ?? "", email: r.properties["E-mail"]?.email ?? "",
  status: sel(r.properties.Status), followUp: date(r.properties["Volgende follow-up"]), notes: text(r.properties.Notities),
});

// Only people you are busy with or owe a follow-up: everyone else stays quiet.
export async function activePeople(): Promise<PersonRow[]> {
  const rows = await queryAll(NOTION.people, {
    filter: { or: [
      { property: "Status", select: { equals: "Nu mee bezig" } },
      { property: "Status", select: { equals: "Follow-up" } },
      { property: "Volgende follow-up", date: { is_not_empty: true } },
    ] },
  });
  return rows.map(toPerson).filter((p) => p.status !== "Rustig" || p.followUp);
}

type PersonInput = Partial<Omit<PersonRow, "id" | "url">>;
function personProps(p: PersonInput) {
  const properties: any = {};
  if (p.name !== undefined) properties.Naam = { title: [{ text: { content: p.name.slice(0, 200) } }] };
  if (p.kind !== undefined) properties.Soort = { select: p.kind ? { name: p.kind } : null };
  if (p.role !== undefined) properties.Rol = rt(p.role);
  if (p.links !== undefined) properties["Verbonden met"] = { multi_select: p.links.filter((l) => (PEOPLE_LINKS as readonly string[]).includes(l)).map((name) => ({ name })) };
  if (p.phone !== undefined) properties.Telefoon = { phone_number: p.phone || null };
  if (p.email !== undefined) properties["E-mail"] = { email: p.email || null };
  if (p.status !== undefined) properties.Status = { select: p.status ? { name: p.status } : null };
  if (p.followUp !== undefined) properties["Volgende follow-up"] = { date: p.followUp ? { start: p.followUp } : null };
  if (p.notes !== undefined) properties.Notities = rt(p.notes);
  return properties;
}

export async function addPerson(p: PersonInput) {
  const page: any = await notion().pages.create({ parent: { type: "data_source_id", data_source_id: NOTION.people }, properties: personProps(p) } as any);
  return page.id as string;
}

export async function updatePerson(id: string, p: PersonInput) {
  await assertParent(id, NOTION.people);
  await notion().pages.update({ page_id: id, properties: personProps(p) } as any);
}

/* ---------- Brain, Eyes, Hands: write onto pages ---------- */
const para = (s: string) => [{ type: "text", text: { content: s.slice(0, 1900) } }];
const withDate = (s: string, due: string | null) => (due ? [...para(s + " "), { type: "mention", mention: { type: "date", date: { start: due } } }] : para(s));

export async function addIdea(idea: string, note: string) {
  const children: any[] = [{ type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: idea.slice(0, 1900) }, annotations: { bold: true } }], children: note ? [{ type: "paragraph", paragraph: { rich_text: para(note) } }] : [] } }];
  await notion().blocks.children.append({ block_id: NOTION.ideasPage, children } as any);
}

// A thing to watch or read is an open to-do on 03 Reference, so Eyes lights up until you tick it.
export async function addToWatch(w: { title: string; link: string; kind: string; why: string }) {
  const rich: any[] = [{ type: "text", text: { content: `${w.kind ? w.kind + ": " : ""}${w.title || w.link}`.slice(0, 1900), link: /^https?:\/\//.test(w.link) ? { url: w.link } : null } }];
  if (w.why) rich.push({ type: "text", text: { content: ` · ${w.why}`.slice(0, 500) } });
  await notion().blocks.children.append({ block_id: NOTION.referencePage, children: [{ type: "to_do", to_do: { rich_text: rich, checked: false } }] } as any);
}

// Project pages are the child pages of 02 Projects.
export async function listProjects(): Promise<{ id: string; title: string }[]> {
  const out: { id: string; title: string }[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const res: any = await notion().blocks.children.list({ block_id: NOTION.projectsShelf, page_size: 100, start_cursor: cursor });
    for (const b of res.results) if (b.type === "child_page") out.push({ id: b.id, title: b.child_page.title });
    if (!res.has_more) break;
    cursor = res.next_cursor;
  }
  return out;
}

export async function addProjectStep(projectId: string, step: string, due: string | null) {
  const ok = (await listProjects()).some((p) => p.id.replace(/-/g, "") === projectId.replace(/-/g, ""));
  if (!ok) throw new Error("That is not a page under 02 Projects.");
  await notion().blocks.children.append({ block_id: projectId, children: [{ type: "to_do", to_do: { rich_text: withDate(step, due), checked: false } }] } as any);
}

export async function pageQuietness() {
  return Promise.all(
    NOTION.watchPages.map(async (p) => {
      try {
        const page: any = await notion().pages.retrieve({ page_id: p.id });
        return { ...p, lastEdited: page.last_edited_time as string, url: page.url as string };
      } catch {
        return { ...p, lastEdited: null, url: null };
      }
    }),
  );
}

async function uploadFile(file: Blob, filename: string) {
  const up: any = await notion().fileUploads.create({ mode: "single_part", filename, content_type: file.type || "image/jpeg" });
  await notion().fileUploads.send({ file_upload_id: up.id, file: { filename, data: file } } as any);
  return up.id as string;
}

// Attach a photo to any Notion page (used for Expiry Dates rows and other items).
export async function appendPhotoToPage(pageId: string, file: Blob, filename: string, caption: string) {
  const id = await uploadFile(file, filename);
  await notion().blocks.children.append({
    block_id: pageId,
    children: [{ type: "image", image: { type: "file_upload", file_upload: { id }, caption: caption ? [{ type: "text", text: { content: caption } }] : [] } } as any],
  });
}

export type PhotoRow = { id: string; date: string | null; pose: string; hasPhoto: boolean };

export async function listPhotos(): Promise<PhotoRow[]> {
  const rows = await queryAll(NOTION.progressPhotos, { sorts: [{ property: "Date", direction: "descending" }] });
  return rows.map((r) => ({ id: r.id, date: date(r.properties.Date), pose: sel(r.properties.Pose), hasPhoto: (r.properties.Photo?.files ?? []).length > 0 }));
}

export async function addProgressPhoto(p: { file: Blob; pose: string; date: string; summary: string }) {
  const filename = `${p.date}_progress_${p.pose.toLowerCase()}.jpg`; // follows date_what_detail
  const id = await uploadFile(p.file, filename);
  await notion().pages.create({
    parent: { type: "data_source_id", data_source_id: NOTION.progressPhotos },
    properties: {
      Name: { title: [{ text: { content: `${p.date} ${p.pose}` } }] },
      Date: { date: { start: p.date } },
      Pose: { select: { name: p.pose } },
      Photo: { files: [{ type: "file_upload", file_upload: { id }, name: filename }] },
      "Lift summary": { rich_text: [{ text: { content: p.summary.slice(0, 1900) } }] },
    },
  } as any);
}

// Signed Notion file URLs expire after an hour, so the image route fetches a fresh one each time.
export async function photoUrl(pageId: string): Promise<string | null> {
  const page: any = await notion().pages.retrieve({ page_id: pageId });
  if (page.parent?.data_source_id?.replace(/-/g, "") !== NOTION.progressPhotos.replace(/-/g, "")) return null;
  const f = page.properties?.Photo?.files?.[0];
  return f?.file?.url ?? null;
}

/* ---------- Open to-dos anywhere in GVG Brain ----------
   Finds every unchecked to-do block on the normal pages of the workspace (not database rows),
   works out which shelf the page is on, and maps that shelf to a body part.
   Pages are cached by last-edited time, so only changed pages are read again. */
export type TodoRow = { id: string; text: string; due: string | null; pageId: string; page: string; area: string; url: string; next?: boolean };
type PageInfo = { id: string; parent: string | null; title: string; url: string; edited: string };
const nd = (id: string) => id.replace(/-/g, "");
const pageCache = new Map<string, { edited: string; todos: Omit<TodoRow, "area">[] }>();
const CONTAINERS = new Set(["toggle", "column_list", "column", "callout", "bulleted_list_item", "numbered_list_item", "to_do", "quote", "synced_block", "heading_1", "heading_2", "heading_3"]);

async function listPages(): Promise<PageInfo[]> {
  const out: PageInfo[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 6; i++) {
    const res: any = await notion().search({ filter: { property: "object", value: "page" }, page_size: 100, start_cursor: cursor } as any);
    for (const p of res.results) {
      if (p.object !== "page" || p.archived || p.in_trash) continue;
      const pt = p.parent?.type;
      if (pt !== "page_id" && pt !== "workspace") continue; // database rows (workout log etc.) are not to-do lists
      const titleProp: any = Object.values(p.properties || {}).find((x: any) => x?.type === "title");
      out.push({ id: nd(p.id), parent: pt === "page_id" ? nd(p.parent.page_id) : null, title: text(titleProp) || "Untitled", url: p.url, edited: p.last_edited_time });
    }
    if (!res.has_more) break;
    cursor = res.next_cursor;
  }
  return out;
}

function richText(rt: any[]): { text: string; due: string | null } {
  let due: string | null = null;
  const t = (rt || []).map((r: any) => {
    if (r.type === "mention" && r.mention?.type === "date") { due ??= r.mention.date?.start ?? null; return ""; }
    return r.plain_text;
  }).join("").replace(/\s+/g, " ").trim();
  return { text: t, due };
}

const NEXT_STEP = /^(next steps?|volgende stap(pen)?)\b/i;
const HEADINGS = new Set(["heading_1", "heading_2", "heading_3"]);
const TEXTY = new Set(["paragraph", "bulleted_list_item", "numbered_list_item", "quote", "callout"]);

async function scanBlocks(blockId: string, page: PageInfo, depth: number, out: Omit<TodoRow, "area">[]) {
  let cursor: string | undefined;
  // A "Next step" heading on a page: the text under it (until the next heading) is one to-do.
  let next: { id: string; lines: string[]; due: string | null } | null = null;
  const flush = () => {
    if (next && next.lines.length) out.push({ id: next.id, text: next.lines.join(" "), due: next.due, pageId: page.id, page: page.title, url: `${page.url}#${nd(next.id)}`, next: true });
    next = null;
  };
  for (let i = 0; i < 5; i++) {
    const res: any = await notion().blocks.children.list({ block_id: blockId, page_size: 100, start_cursor: cursor });
    for (const b of res.results) {
      if (depth === 0 && HEADINGS.has(b.type)) {
        flush();
        const h = richText(b[b.type]?.rich_text).text;
        if (NEXT_STEP.test(h)) next = { id: b.id, lines: [], due: null };
      } else if (next && TEXTY.has(b.type)) {
        const rt = b[b.type]?.rich_text || [];
        const placeholder = rt.length > 0 && rt.every((r: any) => r.annotations?.italic); // e.g. "One thing. Write it here..."
        const { text: t, due } = richText(rt);
        if (t && !placeholder) { next.lines.push(t); next.due ??= due; }
      }
      if (b.type === "to_do" && !b.to_do?.checked) {
        const { text: t, due } = richText(b.to_do.rich_text);
        if (t) out.push({ id: b.id, text: t, due, pageId: page.id, page: page.title, url: `${page.url}#${nd(b.id)}` });
      }
      if (b.has_children && depth < 3 && CONTAINERS.has(b.type)) await scanBlocks(b.id, page, depth + 1, out);
    }
    if (!res.has_more) break;
    cursor = res.next_cursor;
  }
  flush();
}

export async function openTodos(budgetMs = 7000): Promise<{ todos: TodoRow[]; partial: boolean }> {
  const t0 = Date.now();
  const pages = await listPages();
  const byId = new Map(pages.map((p) => [p.id, p]));
  const watch = new Map(NOTION.watchPages.map((w) => [w.id, w.area]));
  // Walk up to the shelf (or a watched page like Contacts) to pick the body part.
  const areaOf = (p: PageInfo): string | null => {
    let cur: PageInfo | undefined = p;
    for (let i = 0; cur && i < 12; i++) {
      if (watch.has(cur.id)) return watch.get(cur.id)!;
      const byTitle = NOTION.titleAreas.find((r) => r.match.test(cur!.title.trim()));
      if (byTitle) return byTitle.area;
      const shelf = NOTION.shelves[cur.id];
      if (shelf) return shelf.area;
      if (cur.id === NOTION.root) return null; // to-dos on the home page itself are the weekly routine
      cur = cur.parent ? byId.get(cur.parent) : undefined;
    }
    return "brain";
  };
  const targets = pages.map((p) => ({ p, area: areaOf(p) })).filter((x): x is { p: PageInfo; area: string } => x.area !== null);
  let partial = false;
  const queue = targets.filter(({ p }) => pageCache.get(p.id)?.edited !== p.edited);
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      if (Date.now() - t0 > budgetMs) { partial = true; return; }
      const found: Omit<TodoRow, "area">[] = [];
      try { await scanBlocks(job.p.id, job.p, 0, found); pageCache.set(job.p.id, { edited: job.p.edited, todos: found }); }
      catch { /* page not shared or gone: skip it */ }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const todos = targets.flatMap(({ p, area }) => (pageCache.get(p.id)?.todos ?? []).map((t) => ({ ...t, area })));
  return { todos, partial };
}

// Tick a to-do in Notion. Only to-do blocks can be changed this way.
export async function checkTodo(blockId: string) {
  const b: any = await notion().blocks.retrieve({ block_id: blockId });
  if (b.type !== "to_do") throw new Error("That item is not a Notion to-do.");
  await notion().blocks.update({ block_id: blockId, to_do: { checked: true } } as any);
}
