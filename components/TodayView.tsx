"use client";
import { useState } from "react";
import { AREAS, AREA_ORDER, type AreaId } from "@/lib/config";
import { areaSeverity, type Item, type TaskDTO, type ExpiryDTO, type TodoDTO } from "@/lib/today";
import { HomeBody3D } from "./Body3D";
import { sound } from "@/lib/sound";
import { Sheet, api, json, type ToastMsg } from "./ui";
import { PhotoButton } from "./Camera";

type Props = { items: Item[]; loading: boolean; onGym: () => void; reload: () => Promise<void>; toast: (t: ToastMsg) => void; gymDaysWeek: number };

function Row({ it, onOpen }: { it: Item; onOpen: (it: Item) => void }) {
  return (
    <button className={"row" + (it.sev === 2 ? " sev-hot" : it.sev === 1 ? " sev-warn" : "")} onClick={() => onOpen(it)}>
      <span className="bar" />
      <div>
        <div className="t">{it.title}</div>
        <div className="d"><span className="tag">{AREAS[it.area].name}</span>{it.detail}</div>
      </div>
      <span className="when">{it.when}</span>
    </button>
  );
}

export default function TodayView({ items, loading, onGym, reload, toast, gymDaysWeek }: Props) {
  const [area, setArea] = useState<AreaId | null>(null);
  const [open, setOpen] = useState<Item | null>(null);
  const [adding, setAdding] = useState<AreaId | null>(null);
  const sev = areaSeverity(items);
  const sheetUrl = items.find((i) => i.kind === "money" && i.url)?.url;

  const needs = items.filter((i) => i.sev > 0).sort((a, b) => b.sev - a.sev || (a.sortDate ?? Infinity) - (b.sortDate ?? Infinity));
  const now = Date.now();
  const upcoming = items.filter((i) => (i.kind === "task" || i.kind === "todo") && i.sev === 0 && i.sortDate && i.sortDate - now < 8 * 86400000).sort((a, b) => a.sortDate! - b.sortDate!);
  const openItem = (it: Item) => (it.kind === "gym" ? onGym() : setOpen(it));
  const pick = (a: AreaId) => (a === "muscles" ? onGym() : setArea(a));

  return (
    <section className="grid">
      <div className="figure">
        <HomeBody3D sev={sev} onPick={pick} />
        <div className="chips">
          {AREA_ORDER.map((a) => {
            const n = items.filter((i) => i.area === a && i.sev > 0).length;
            return (
              <button key={a} className={"chip" + (sev[a] === 2 ? " st-hot" : sev[a] === 1 ? " st-warn" : "")} onClick={() => pick(a)} aria-label={`${AREAS[a].name}${n ? `, ${n} need attention` : ", all calm"}`}>
                <span className="dot" /><span className="n">{AREAS[a].name}</span><small>{n || ""}</small>
              </button>
            );
          })}
        </div>
      </div>
      <div className="panel">
        <div className="stats">
          <div className="stat"><div className="v">{items.filter((i) => i.sev === 2).length}</div><div className="k">overdue or lapsed</div></div>
          <div className="stat"><div className="v">{items.filter((i) => i.area === "heart" && i.sev > 0).length}</div><div className="k">people waiting on you</div></div>
          <div className="stat"><div className="v">{gymDaysWeek}/4</div><div className="k">gym days this week</div></div>
        </div>
        <div className="sec">
          <div className="sec-h"><h2>Needs you</h2><span className="note">{loading ? "Loading…" : `${needs.length} item${needs.length === 1 ? "" : "s"}`}</span></div>
          <div className="list">
            {needs.map((it) => <Row key={it.key} it={it} onOpen={openItem} />)}
            {!loading && !needs.length && <div className="empty">Nothing glowing. Every area is calm.</div>}
          </div>
        </div>
        <div className="sec">
          <div className="sec-h"><h2>Coming up</h2><span className="note">Next 7 days</span></div>
          <div className="list">
            {upcoming.map((it) => <Row key={it.key} it={it} onOpen={openItem} />)}
            {!loading && !upcoming.length && <div className="empty">Nothing else dated this week.</div>}
          </div>
        </div>
      </div>

      <button className="fab" aria-label="Add a task" onClick={() => setAdding("brain")}>+</button>

      {area && (
        <Sheet title={AREAS[area].name} eyebrow={AREAS[area].sub} onClose={() => setArea(null)}>
          <div className="list">
            {items.filter((i) => i.area === area).sort((a, b) => b.sev - a.sev || (a.sortDate ?? Infinity) - (b.sortDate ?? Infinity)).map((it) => (
              <Row key={it.key} it={it} onOpen={(x) => { setArea(null); openItem(x); }} />
            ))}
            {!items.some((i) => i.area === area) && <div className="empty">Nothing here yet. Add a task with the {AREAS[area].name.toLowerCase()} label.</div>}
          </div>
          <div className="actions" style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={() => { setAdding(area); setArea(null); }}>Add to {AREAS[area].name}</button>
            {area === "belly" && sheetUrl && <a className="btn" href={sheetUrl} target="_blank" rel="noopener noreferrer">Open money sheet</a>}
            <a className="btn" href={AREAS[area].link} target="_blank" rel="noopener noreferrer">Open {AREAS[area].linkName} in Notion</a>
          </div>
        </Sheet>
      )}
      {open?.task && <TaskSheet task={open.task} onClose={() => setOpen(null)} reload={reload} toast={toast} />}
      {open?.expiry && <ExpirySheet doc={open.expiry} onClose={() => setOpen(null)} reload={reload} toast={toast} />}
      {open?.todo && <TodoSheet todo={open.todo} onClose={() => setOpen(null)} reload={reload} toast={toast} />}
      {(open?.kind === "page" || open?.kind === "mail" || open?.kind === "money") && (
        <Sheet title={open.title} eyebrow={AREAS[open.area].name} onClose={() => setOpen(null)}>
          <p className="note">{open.detail}</p>
          {open.url && <a className="btn primary" href={open.url} target="_blank" rel="noopener noreferrer">Open in {open.source === "Gmail" ? "Gmail" : open.source === "Sheets" ? "the sheet" : "Notion"}</a>}
        </Sheet>
      )}
      {adding && <AddSheet initial={adding} onClose={() => setAdding(null)} reload={reload} toast={toast} />}
    </section>
  );
}

function TodoSheet({ todo, onClose, reload, toast }: { todo: TodoDTO; onClose: () => void; reload: () => Promise<void>; toast: (t: ToastMsg) => void }) {
  const [busy, setBusy] = useState(false);
  async function done() {
    setBusy(true);
    try {
      await api(`/api/todos/${todo.id}`, json("POST", {}));
      sound.done(); toast({ text: "Ticked off in Notion" }); onClose(); await reload();
    } catch (e) { toast({ text: (e as Error).message, kind: "bad" }); setBusy(false); }
  }
  return (
    <Sheet title={todo.text.length > 120 ? todo.text.slice(0, 117) + "…" : todo.text} eyebrow={`Notion · ${todo.page}`} onClose={onClose}>
      {todo.next
        ? <p className="note">This is the Next step on your Notion page "{todo.page}". When it's done, write the new next step there (or clear it) and it updates here.</p>
        : <p className="note">This is an open to-do on your Notion page "{todo.page}". Tick it here or open the page.</p>}
      {todo.next && todo.text.length > 120 && <p>{todo.text}</p>}
      <div className="actions">
        {!todo.next && <button className="btn primary" disabled={busy} onClick={done}>{busy ? "Ticking…" : "Done"}</button>}
        <a className="btn" href={todo.url} target="_blank" rel="noopener noreferrer">Open in Notion</a>
      </div>
    </Sheet>
  );
}

function AreaPick({ value, onChange }: { value: AreaId; onChange: (a: AreaId) => void }) {
  return (
    <div className="areapick" role="group" aria-label="Body part">
      {AREA_ORDER.map((a) => <button type="button" key={a} aria-pressed={value === a} onClick={() => onChange(a)}>{AREAS[a].name}</button>)}
    </div>
  );
}

function AddSheet({ initial, onClose, reload, toast }: { initial: AreaId; onClose: () => void; reload: () => Promise<void>; toast: (t: ToastMsg) => void }) {
  const [content, setContent] = useState("");
  const [due, setDue] = useState("");
  const [area, setArea] = useState<AreaId>(initial);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await api("/api/tasks", json("POST", { content, due, area, description: desc }));
      toast({ text: "Added to Todoist" }); onClose(); reload();
    } catch (err) { toast({ text: (err as Error).message, kind: "bad" }); setBusy(false); }
  }
  return (
    <Sheet title="Add a task" eyebrow="Goes to Todoist" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="field"><label htmlFor="nt">What</label><input id="nt" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Follow up with Claire about Clark Accord" autoFocus /></div>
        <div className="field"><label htmlFor="nd">When (plain words work)</label><input id="nd" value={due} onChange={(e) => setDue(e.target.value)} placeholder="friday 5pm, tomorrow, every monday" /></div>
        <div className="field"><label>Body part</label><AreaPick value={area} onChange={setArea} /></div>
        <div className="field"><label htmlFor="nn">Notes</label><textarea id="nn" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <button className="btn primary big" disabled={busy || !content.trim()}>{busy ? "Adding…" : "Add task"}</button>
      </form>
    </Sheet>
  );
}

function TaskSheet({ task, onClose, reload, toast }: { task: TaskDTO; onClose: () => void; reload: () => Promise<void>; toast: (t: ToastMsg) => void }) {
  const [content, setContent] = useState(task.content);
  const [due, setDue] = useState(task.due?.string || "");
  const [area, setArea] = useState<AreaId>(task.area);
  const [desc, setDesc] = useState(task.description);
  const [busy, setBusy] = useState<"" | "save" | "done" | "photo">("");
  const changed = content !== task.content || due !== (task.due?.string || "") || area !== task.area || desc !== task.description;

  async function save() {
    setBusy("save");
    try {
      await api(`/api/tasks/${task.id}`, json("PATCH", { content, description: desc, due: due !== (task.due?.string || "") ? due : undefined, area: area !== task.area ? area : undefined, labels: task.labels }));
      toast({ text: "Saved to Todoist" }); onClose(); reload();
    } catch (e) { toast({ text: (e as Error).message, kind: "bad" }); setBusy(""); }
  }
  async function done() {
    setBusy("done");
    try {
      await api(`/api/tasks/${task.id}`, json("POST", { action: "close" }));
      sound.done();
      toast({ text: task.due?.recurring ? "Done. Moved to its next date" : "Done in Todoist" }); onClose(); reload();
    } catch (e) { toast({ text: (e as Error).message, kind: "bad" }); setBusy(""); }
  }
  async function photo(b: Blob) {
    setBusy("photo");
    try {
      const fd = new FormData(); fd.append("file", b, "photo.jpg"); fd.append("note", "Photo from Body Map");
      await api(`/api/tasks/${task.id}/photo`, { method: "POST", body: fd });
      toast({ text: "Photo added to the task" });
    } catch (e) { toast({ text: (e as Error).message, kind: "bad" }); }
    setBusy("");
  }
  return (
    <Sheet title={task.content} eyebrow={`Todoist${task.project ? " · " + task.project : ""}${task.due?.recurring ? " · repeats" : ""}`} onClose={onClose}>
      <div className="form">
        <button className="btn ok big" onClick={done} disabled={!!busy}>{busy === "done" ? "Completing…" : "✓ Done"}</button>
        <div className="field"><label htmlFor="et">Task</label><input id="et" value={content} onChange={(e) => setContent(e.target.value)} /></div>
        <div className="field"><label htmlFor="ed">When (plain words work, empty = no date)</label><input id="ed" value={due} onChange={(e) => setDue(e.target.value)} placeholder="tomorrow 9am" /></div>
        <div className="field"><label>Body part</label><AreaPick value={area} onChange={setArea} /></div>
        <div className="field"><label htmlFor="en">Notes</label><textarea id="en" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div className="actions">
          <button className="btn primary" onClick={save} disabled={!changed || !!busy}>{busy === "save" ? "Saving…" : "Save changes"}</button>
          <PhotoButton onPhoto={photo} busy={busy === "photo"} />
          <a className="btn" href={task.url} target="_blank" rel="noopener noreferrer">Open in Todoist</a>
        </div>
      </div>
    </Sheet>
  );
}

function ExpirySheet({ doc, onClose, reload, toast }: { doc: ExpiryDTO; onClose: () => void; reload: () => Promise<void>; toast: (t: ToastMsg) => void }) {
  const [date, setDate] = useState(doc.expires || "");
  const [notes, setNotes] = useState(doc.notes);
  const [busy, setBusy] = useState<"" | "save" | "photo">("");
  async function save() {
    setBusy("save");
    try {
      await api(`/api/expiry/${doc.id}`, json("PATCH", { expires: date || null, notes }));
      toast({ text: "Updated in Notion" }); onClose(); reload();
    } catch (e) { toast({ text: (e as Error).message, kind: "bad" }); setBusy(""); }
  }
  async function photo(b: Blob) {
    setBusy("photo");
    try {
      const fd = new FormData(); fd.append("file", b, "scan.jpg"); fd.append("note", doc.document);
      await api(`/api/expiry/${doc.id}/photo`, { method: "POST", body: fd });
      toast({ text: "Photo added to the Notion page" });
    } catch (e) { toast({ text: (e as Error).message, kind: "bad" }); }
    setBusy("");
  }
  return (
    <Sheet title={doc.document} eyebrow={["Expiry Dates", doc.type, doc.person || doc.car].filter(Boolean).join(" · ")} onClose={onClose}>
      <div className="form">
        <p className="note" style={{ margin: 0 }}>Renewed it? Set the new expiry date. The glow goes away once it&apos;s more than 30 days out.</p>
        <div className="field"><label htmlFor="xd">Expires</label><input id="xd" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label htmlFor="xn">Notes</label><textarea id="xn" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="actions">
          <button className="btn primary" onClick={save} disabled={!!busy}>{busy === "save" ? "Saving…" : "Save to Notion"}</button>
          <PhotoButton onPhoto={photo} busy={busy === "photo"} label="Add photo of the document" />
          <a className="btn" href={doc.url} target="_blank" rel="noopener noreferrer">Open in Notion</a>
        </div>
      </div>
    </Sheet>
  );
}
