"use client";
// The Add button, one form per body part. Each one writes to the place that body part reads from,
// so whatever you add lights the body up on the next refresh.
import { useEffect, useState } from "react";
import { AREAS, AREA_ORDER, type AreaId } from "@/lib/config";
import type { PersonDTO } from "@/lib/today";
import { Sheet, api, json, type ToastMsg } from "./ui";

type Common = { onClose: () => void; reload: () => Promise<void>; toast: (t: ToastMsg) => void };

export function Pick<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T | ""; onChange: (v: T) => void }) {
  return (
    <div className="areapick" role="group" aria-label={label}>
      {options.map((o) => <button type="button" key={o} aria-pressed={value === o} onClick={() => onChange(o)}>{o}</button>)}
    </div>
  );
}

const F = ({ id, label, children }: { id?: string; label: string; children: React.ReactNode }) => (
  <div className="field">{id ? <label htmlFor={id}>{label}</label> : <label>{label}</label>}{children}</div>
);

function useSave(c: Common, ok: string) {
  const [busy, setBusy] = useState(false);
  const run = async (url: string, method: string, body: unknown) => {
    setBusy(true);
    try { await api(url, json(method, body)); c.toast({ text: ok }); c.onClose(); c.reload(); }
    catch (e) { c.toast({ text: (e as Error).message, kind: "bad" }); setBusy(false); }
  };
  return { busy, run };
}

/* Brain: an idea (Notion Ideas) or a plain task (Todoist). */
function BrainForm(c: Common) {
  const [mode, setMode] = useState<"Idee" | "Taak">("Idee");
  const [text, setText] = useState(""), [note, setNote] = useState(""), [due, setDue] = useState("");
  const { busy, run } = useSave(c, mode === "Idee" ? "Idea saved in Notion" : "Added to Todoist");
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); if (mode === "Idee") run("/api/add", "POST", { kind: "idea", idea: text, note }); else run("/api/tasks", "POST", { content: text, due, area: "brain", description: note }); }}>
      <Pick label="Soort" options={["Idee", "Taak"] as const} value={mode} onChange={setMode} />
      <F id="a1" label={mode === "Idee" ? "Het idee, in één zin" : "Wat"}><input id="a1" value={text} onChange={(e) => setText(e.target.value)} autoFocus /></F>
      {mode === "Taak" && <F id="a2" label="Wanneer (gewone woorden mag)"><input id="a2" value={due} onChange={(e) => setDue(e.target.value)} placeholder="morgen, vrijdag 17:00" /></F>}
      <F id="a3" label="Notitie (mag leeg)"><textarea id="a3" value={note} onChange={(e) => setNote(e.target.value)} /></F>
      <button className="btn primary big" disabled={busy || !text.trim()}>{busy ? "Bezig…" : mode === "Idee" ? "Idee bewaren" : "Taak toevoegen"}</button>
      <p className="note">{mode === "Idee" ? "Gaat naar Notion · Ideas" : "Gaat naar Todoist met @brain"}</p>
    </form>
  );
}

/* Eyes: something to watch or read, as an open to-do on 03 Reference. */
const WATCH = ["Film", "Serie", "Boek", "Artikel", "Video"] as const;
function EyesForm(c: Common) {
  const [link, setLink] = useState(""), [title, setTitle] = useState(""), [type, setType] = useState<(typeof WATCH)[number] | "">(""), [why, setWhy] = useState("");
  const { busy, run } = useSave(c, "On your list in Notion");
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); run("/api/add", "POST", { kind: "watch", link, title, type, why }); }}>
      <F id="e1" label="Link (mag leeg)"><input id="e1" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" autoFocus /></F>
      <F id="e2" label="Titel"><input id="e2" value={title} onChange={(e) => setTitle(e.target.value)} /></F>
      <F label="Soort"><Pick label="Soort" options={WATCH} value={type} onChange={setType} /></F>
      <F id="e3" label="Waarom (mag leeg)"><input id="e3" value={why} onChange={(e) => setWhy(e.target.value)} /></F>
      <button className="btn primary big" disabled={busy || (!title.trim() && !link.trim())}>{busy ? "Bezig…" : "Op mijn lijst"}</button>
      <p className="note">Gaat naar Notion · 03 Reference. Eyes licht op tot je het afvinkt.</p>
    </form>
  );
}

/* Hands: the next step on a project page under 02 Projects. */
function HandsForm(c: Common) {
  const [projects, setProjects] = useState<{ id: string; title: string }[] | null>(null);
  const [pid, setPid] = useState(""), [step, setStep] = useState(""), [due, setDue] = useState("");
  const { busy, run } = useSave(c, "Step added to the project");
  useEffect(() => { api<{ projects: { id: string; title: string }[] }>("/api/projects").then((r) => setProjects(r.projects)).catch((e) => c.toast({ text: (e as Error).message, kind: "bad" })); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); run("/api/add", "POST", { kind: "step", projectId: pid, step, due }); }}>
      <F label="Project">
        {projects ? (
          <div className="areapick" role="group" aria-label="Project">
            {projects.map((p) => <button type="button" key={p.id} aria-pressed={pid === p.id} onClick={() => setPid(p.id)}>{p.title}</button>)}
          </div>
        ) : <p className="note">Projecten laden…</p>}
      </F>
      <F id="h1" label="Volgende stap"><input id="h1" value={step} onChange={(e) => setStep(e.target.value)} /></F>
      <F id="h2" label="Wanneer (mag leeg)"><input id="h2" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></F>
      <button className="btn primary big" disabled={busy || !pid || !step.trim()}>{busy ? "Bezig…" : "Stap toevoegen"}</button>
      <p className="note">Komt als to-do op de projectpagina. Hands licht op tot je hem afvinkt.</p>
    </form>
  );
}

/* Heart: a person in Notion People, or a follow-up in Todoist. */
export const PEOPLE_LINKS = ["SuriRides", "Tru Tori", "Pulse", "Body Map", "Halliburton", "Familie", "Anders"] as const;
export const PEOPLE_STATUS = ["Nu mee bezig", "Follow-up", "Rustig"] as const;

export function PersonFields({ p, set }: { p: Partial<PersonDTO>; set: (p: Partial<PersonDTO>) => void }) {
  const links = p.links ?? [];
  return (
    <>
      <F id="p1" label="Naam"><input id="p1" value={p.name ?? ""} onChange={(e) => set({ name: e.target.value })} /></F>
      <F id="p2" label="Rol of relatie"><input id="p2" value={p.role ?? ""} onChange={(e) => set({ role: e.target.value })} /></F>
      <F id="p3" label="Telefoon"><input id="p3" type="tel" inputMode="tel" value={p.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} /></F>
      <F id="p4" label="E-mail"><input id="p4" type="email" inputMode="email" value={p.email ?? ""} onChange={(e) => set({ email: e.target.value })} /></F>
      <F label="Verbonden met">
        <div className="areapick" role="group" aria-label="Verbonden met">
          {PEOPLE_LINKS.map((l) => <button type="button" key={l} aria-pressed={links.includes(l)} onClick={() => set({ links: links.includes(l) ? links.filter((x) => x !== l) : [...links, l] })}>{l}</button>)}
        </div>
      </F>
      <F label="Status"><Pick label="Status" options={PEOPLE_STATUS} value={(p.status as (typeof PEOPLE_STATUS)[number]) ?? ""} onChange={(v) => set({ status: v })} /></F>
      <F id="p5" label="Volgende follow-up (mag leeg)"><input id="p5" type="date" value={p.followUp ?? ""} onChange={(e) => set({ followUp: e.target.value || null })} /></F>
      <F id="p6" label="Notitie"><textarea id="p6" value={p.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></F>
    </>
  );
}

function HeartForm(c: Common) {
  const [mode, setMode] = useState<"Persoon" | "Follow-up">("Persoon");
  const [p, setP] = useState<Partial<PersonDTO>>({ status: "Nu mee bezig", links: [] });
  const [who, setWho] = useState(""), [what, setWhat] = useState(""), [due, setDue] = useState("");
  const { busy, run } = useSave(c, mode === "Persoon" ? "Saved in Notion People" : "Follow-up added");
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); if (mode === "Persoon") run("/api/people", "POST", p); else run("/api/tasks", "POST", { content: `Follow up: ${who}${what ? " · " + what : ""}`, due, area: "heart" }); }}>
      <Pick label="Soort" options={["Persoon", "Follow-up"] as const} value={mode} onChange={setMode} />
      {mode === "Persoon" ? <PersonFields p={p} set={(x) => setP({ ...p, ...x })} /> : (
        <>
          <F id="f1" label="Met wie"><input id="f1" value={who} onChange={(e) => setWho(e.target.value)} autoFocus /></F>
          <F id="f2" label="Waarover (mag leeg)"><input id="f2" value={what} onChange={(e) => setWhat(e.target.value)} /></F>
          <F id="f3" label="Wanneer"><input id="f3" value={due} onChange={(e) => setDue(e.target.value)} placeholder="dinsdag, over 3 dagen" /></F>
        </>
      )}
      <button className="btn primary big" disabled={busy || (mode === "Persoon" ? !p.name?.trim() : !who.trim())}>{busy ? "Bezig…" : mode === "Persoon" ? "Persoon bewaren" : "Follow-up toevoegen"}</button>
      <p className="note">{mode === "Persoon" ? "Gaat naar Notion · People. Hart toont alleen 'Nu mee bezig' en follow-ups." : "Wordt een herinnering in Todoist met @heart."}</p>
    </form>
  );
}

/* Belly: money to pay, receive or remember, as a Todoist reminder with @money. */
const MONEY = ["Betalen", "Ontvangen", "Onthouden"] as const;
const CUR = ["SRD", "USD", "EUR"] as const;
function BellyForm(c: Common) {
  const [kind, setKind] = useState<(typeof MONEY)[number]>("Betalen"), [cur, setCur] = useState<(typeof CUR)[number]>("SRD");
  const [amount, setAmount] = useState(""), [who, setWho] = useState(""), [due, setDue] = useState(""), [note, setNote] = useState("");
  const { busy, run } = useSave(c, "Added to Belly");
  const title = `${kind}: ${amount ? `${cur} ${amount} ` : ""}${who ? (kind === "Ontvangen" ? "van " : kind === "Betalen" ? "aan " : "") + who : ""}`.trim();
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); run("/api/tasks", "POST", { content: title, due, area: "belly", description: note }); }}>
      <Pick label="Soort" options={MONEY} value={kind} onChange={setKind} />
      <F id="b1" label="Bedrag"><input id="b1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></F>
      <F label="Munt"><Pick label="Munt" options={CUR} value={cur} onChange={setCur} /></F>
      <F id="b2" label={kind === "Ontvangen" ? "Van wie" : kind === "Betalen" ? "Aan wie" : "Waarover"}><input id="b2" value={who} onChange={(e) => setWho(e.target.value)} /></F>
      <F id="b3" label="Wanneer (mag leeg)"><input id="b3" value={due} onChange={(e) => setDue(e.target.value)} placeholder="vrijdag, 1 december" /></F>
      <F id="b4" label="Notitie (mag leeg)"><textarea id="b4" value={note} onChange={(e) => setNote(e.target.value)} /></F>
      <button className="btn primary big" disabled={busy || (!amount.trim() && !who.trim())}>{busy ? "Bezig…" : "Onthouden"}</button>
      <p className="note">Wordt een herinnering in Todoist met @money. Buik licht op tot je hem afvinkt.</p>
    </form>
  );
}

/* Feet: a new document or vehicle in Expiry Dates. Editing one happens on its own sheet. */
const DOC_TYPES = ["ID / passport", "Driver license", "Vehicle", "Insurance", "Keuring", "Work certificate", "Diploma", "Other"] as const;
function FeetForm(c: Common) {
  const [doc, setDoc] = useState(""), [type, setType] = useState<(typeof DOC_TYPES)[number] | "">(""), [person, setPerson] = useState<"Galayn" | "Mama" | "">("Galayn"), [expires, setExpires] = useState(""), [notes, setNotes] = useState("");
  const { busy, run } = useSave(c, "Added to Expiry Dates");
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); run("/api/expiry", "POST", { document: doc, type, person, expires, notes }); }}>
      <F id="x1" label="Document of voertuig"><input id="x1" value={doc} onChange={(e) => setDoc(e.target.value)} autoFocus /></F>
      <F label="Soort"><Pick label="Soort" options={DOC_TYPES} value={type} onChange={setType} /></F>
      <F label="Van wie"><Pick label="Van wie" options={["Galayn", "Mama"] as const} value={person} onChange={setPerson} /></F>
      <F id="x2" label="Vervalt op"><input id="x2" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></F>
      <F id="x3" label="Notitie (mag leeg)"><textarea id="x3" value={notes} onChange={(e) => setNotes(e.target.value)} /></F>
      <button className="btn primary big" disabled={busy || !doc.trim()}>{busy ? "Bezig…" : "Toevoegen"}</button>
      <p className="note">Bestaand document bewerken? Tik het aan in de lijst van Voeten.</p>
    </form>
  );
}

/* Muscles: no form, straight into the Gym tab. */
function MusclesForm({ onGym, onClose }: { onGym: () => void; onClose: () => void }) {
  const go = () => { onClose(); onGym(); };
  return (
    <div className="form">
      <p className="note">Loggen en de check-in doe je in de Gym-tab.</p>
      <button className="btn primary big" onClick={go}>Set loggen</button>
      <button className="btn big" onClick={go}>Check-in en workout van vandaag</button>
    </div>
  );
}

export function AddSheet({ initial, onGym, ...c }: Common & { initial: AreaId; onGym: () => void }) {
  const [area, setArea] = useState<AreaId>(initial);
  return (
    <Sheet title={`Add to ${AREAS[area].name}`} eyebrow={AREAS[area].sub} onClose={c.onClose}>
      <div className="areapick" role="group" aria-label="Body part" style={{ marginBottom: 14 }}>
        {AREA_ORDER.map((a) => <button type="button" key={a} aria-pressed={area === a} onClick={() => setArea(a)}>{AREAS[a].name}</button>)}
      </div>
      {area === "brain" && <BrainForm key="b" {...c} />}
      {area === "eyes" && <EyesForm key="e" {...c} />}
      {area === "hands" && <HandsForm key="h" {...c} />}
      {area === "heart" && <HeartForm key="ht" {...c} />}
      {area === "belly" && <BellyForm key="be" {...c} />}
      {area === "muscles" && <MusclesForm onGym={onGym} onClose={c.onClose} />}
      {area === "feet" && <FeetForm key="f" {...c} />}
    </Sheet>
  );
}
