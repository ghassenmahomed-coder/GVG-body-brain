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

export type SetRow = { id: string; ts: number; muscle: string; exercise: string; weight: number; reps: number; pb: boolean };
export type ExpiryRow = { id: string; url: string; document: string; expires: string | null; type: string; person: string; car: string; notes: string };

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
  }));
}

export async function addSet(s: { muscle: string; exercise: string; weight: number; reps: number; plannedWeight?: number; plannedReps?: number; pb: boolean; at: string }) {
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
    },
  } as any);
  return page.id as string;
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
  }));
}

export async function updateExpiry(id: string, patch: { expires?: string | null; notes?: string }) {
  const properties: any = {};
  if (patch.expires !== undefined) properties.Expires = { date: patch.expires ? { start: patch.expires } : null };
  if (patch.notes !== undefined) properties.Notes = { rich_text: [{ text: { content: patch.notes.slice(0, 1900) } }] };
  await notion().pages.update({ page_id: id, properties } as any);
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
