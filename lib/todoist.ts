// Thin wrapper around the Todoist API v1. Server-only: the token never reaches the browser.
import "server-only";

const BASE = "https://api.todoist.com/api/v1";

function token() {
  const t = process.env.TODOIST_TOKEN;
  if (!t) throw new Error("TODOIST_TOKEN is not set");
  return t;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Todoist ${res.status}: ${(await res.text()).slice(0, 200)}`);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export type TodoistTask = {
  id: string;
  content: string;
  description: string;
  project_id: string;
  labels: string[];
  priority: number;
  added_at?: string;
  due: null | { date: string; string?: string; is_recurring?: boolean; datetime?: string | null };
};
export type TodoistProject = { id: string; name: string };

async function paged<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const sep = path.includes("?") ? "&" : "?";
    const page: { results: T[]; next_cursor: string | null } = await call(path + sep + "limit=200" + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""));
    out.push(...page.results);
    cursor = page.next_cursor;
    if (!cursor) break;
  }
  return out;
}

export const todoist = {
  tasks: () => paged<TodoistTask>("/tasks"),
  projects: () => paged<TodoistProject>("/projects"),
  add: (t: { content: string; description?: string; due_string?: string; labels?: string[]; project_id?: string }) =>
    call<TodoistTask>("/tasks", { method: "POST", body: JSON.stringify(t) }),
  update: (id: string, t: { content?: string; description?: string; due_string?: string; labels?: string[] }) =>
    call<TodoistTask>(`/tasks/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify(t) }),
  close: (id: string) => call<void>(`/tasks/${encodeURIComponent(id)}/close`, { method: "POST" }),
  async attachPhoto(taskId: string, file: Blob, filename: string, note: string) {
    const fd = new FormData();
    fd.append("file", file, filename);
    fd.append("file_name", filename);
    const upload = await call<Record<string, unknown>>("/uploads", { method: "POST", body: fd });
    return call("/comments", { method: "POST", body: JSON.stringify({ task_id: taskId, content: note || "Photo", attachment: upload }) });
  },
};
