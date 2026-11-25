"use client";
// Original body outline, drawn from simple shapes. viewBox 200 x 445.
import type { AreaId } from "@/lib/config";
import { MUSCLES, recLabel, type Muscle, type MuscleStat } from "@/lib/gym";

function Silhouette() {
  return (
    <g>
      <ellipse cx={100} cy={42} rx={26} ry={31} className="sil" />
      <rect x={90} y={68} width={20} height={20} rx={6} className="sil" />
      <path d="M62,92 Q100,80 138,92 L147,112 Q141,170 131,228 L69,228 Q59,170 53,112 Z" className="sil" />
      <path d="M69,222 L131,222 L136,252 L64,252 Z" className="sil" />
      <path d="M56,104 L45,175 L36,244" className="sil-limb" strokeWidth={17} />
      <path d="M144,104 L155,175 L164,244" className="sil-limb" strokeWidth={17} />
      <path d="M86,240 L83,330 L81,414" className="sil-limb" strokeWidth={25} />
      <path d="M114,240 L117,330 L119,414" className="sil-limb" strokeWidth={25} />
      <circle cx={33} cy={258} r={10} className="sil" />
      <circle cx={167} cy={258} r={10} className="sil" />
      <ellipse cx={78} cy={426} rx={13} ry={7} className="sil" />
      <ellipse cx={122} cy={426} rx={13} ry={7} className="sil" />
    </g>
  );
}

const keyAct = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };

export function HomeBody({ sev, onPick }: { sev: Record<AreaId, 0 | 1 | 2>; onPick: (a: AreaId) => void }) {
  const cls = (a: AreaId) => "part" + (sev[a] === 2 ? " st-hot" : sev[a] === 1 ? " st-warn" : "");
  const P = ({ a, label, children }: { a: AreaId; label: string; children: React.ReactNode }) => (
    <g className={cls(a)} tabIndex={0} role="button" aria-label={label} onClick={() => onPick(a)} onKeyDown={keyAct(() => onPick(a))}>{children}</g>
  );
  return (
    <svg viewBox="0 0 200 445" role="group" aria-label="Body map. Tap a body part to open that area of your life.">
      <Silhouette />
      <P a="brain" label="Brain">
        <path d="M76,40 C76,18 124,18 124,40 Q112,46 100,42 Q88,46 76,40 Z" className="shape" />
        <path d="M100,20 L100,42 M86,26 Q92,32 88,38 M114,26 Q108,32 112,38" stroke="var(--body)" strokeWidth={1.6} fill="none" />
      </P>
      <P a="eyes" label="Eyes">
        <rect x={78} y={46} width={44} height={14} fill="transparent" />
        <ellipse cx={90} cy={53} rx={6} ry={4} className="shape" />
        <ellipse cx={110} cy={53} rx={6} ry={4} className="shape" />
      </P>
      <P a="heart" label="Heart">
        <path d="M114,122 C114,114 104,112 104,120 C104,128 114,134 114,140 C114,134 124,128 124,120 C124,112 114,114 114,122 Z" className="shape" />
      </P>
      <P a="hands" label="Hands">
        <circle cx={33} cy={258} r={10} className="shape" />
        <circle cx={167} cy={258} r={10} className="shape" />
      </P>
      <P a="muscles" label="Muscles">
        <path d="M56,108 L46,170" className="shape-l" strokeWidth={9} />
        <path d="M144,108 L154,170" className="shape-l" strokeWidth={9} />
        <path d="M86,246 L84,320" className="shape-l" strokeWidth={13} />
        <path d="M114,246 L116,320" className="shape-l" strokeWidth={13} />
      </P>
      <P a="feet" label="Feet">
        <ellipse cx={78} cy={426} rx={13} ry={7} className="shape" />
        <ellipse cx={122} cy={426} rx={13} ry={7} className="shape" />
      </P>
      {([["BRAIN", 132, 24, "start"], ["EYES", 132, 56, "start"], ["HEART", 114, 156, "middle"], ["MUSCLES", 40, 96, "end"], ["HANDS", 33, 284, "middle"], ["FEET", 100, 444, "middle"]] as const).map(([t, x, y, a]) => (
        <text key={t} x={x} y={y} className="svg-label" textAnchor={a}>{t}</text>
      ))}
    </svg>
  );
}

type Shape = [Muscle, "circle" | "path" | "rect" | "ellipse" | "line", Record<string, number | string>];
const GYM_SHAPES: Record<"front" | "back", Shape[]> = {
  front: [
    ["shoulders", "circle", { cx: 60, cy: 101, r: 12 }], ["shoulders", "circle", { cx: 140, cy: 101, r: 12 }],
    ["chest", "path", { d: "M99,100 Q78,96 70,108 Q70,132 86,138 Q98,138 99,128 Z" }], ["chest", "path", { d: "M101,100 Q122,96 130,108 Q130,132 114,138 Q102,138 101,128 Z" }],
    ["abs", "rect", { x: 87, y: 144, width: 26, height: 72, rx: 8 }],
    ["biceps", "line", { d: "M54,114 L47,168", w: 12 }], ["biceps", "line", { d: "M146,114 L153,168", w: 12 }],
    ["forearms", "line", { d: "M45,182 L37,238", w: 11 }], ["forearms", "line", { d: "M155,182 L163,238", w: 11 }],
    ["quads", "line", { d: "M86,250 L84,318", w: 20 }], ["quads", "line", { d: "M114,250 L116,318", w: 20 }],
    ["calves", "line", { d: "M82,346 L81,400", w: 14 }], ["calves", "line", { d: "M118,346 L119,400", w: 14 }],
  ],
  back: [
    ["shoulders", "circle", { cx: 60, cy: 101, r: 12 }], ["shoulders", "circle", { cx: 140, cy: 101, r: 12 }],
    ["back", "path", { d: "M72,96 Q100,88 128,96 L136,120 Q126,170 110,204 L90,204 Q74,170 64,120 Z" }],
    ["triceps", "line", { d: "M54,114 L47,168", w: 12 }], ["triceps", "line", { d: "M146,114 L153,168", w: 12 }],
    ["forearms", "line", { d: "M45,182 L37,238", w: 11 }], ["forearms", "line", { d: "M155,182 L163,238", w: 11 }],
    ["glutes", "ellipse", { cx: 88, cy: 238, rx: 13, ry: 14 }], ["glutes", "ellipse", { cx: 112, cy: 238, rx: 13, ry: 14 }],
    ["hamstrings", "line", { d: "M86,264 L84,320", w: 19 }], ["hamstrings", "line", { d: "M114,264 L116,320", w: 19 }],
    ["calves", "line", { d: "M82,346 L81,400", w: 15 }], ["calves", "line", { d: "M118,346 L119,400", w: 15 }],
  ],
};

export function GymBody({ side, stats, onPick }: { side: "front" | "back"; stats: Record<Muscle, MuscleStat>; onPick: (m: Muscle) => void }) {
  const byMuscle = new Map<Muscle, Shape[]>();
  GYM_SHAPES[side].forEach((s) => byMuscle.set(s[0], [...(byMuscle.get(s[0]) || []), s]));
  return (
    <svg viewBox="0 0 200 445" role="group" aria-label="Muscle recovery map. Tap a muscle to log a set.">
      <Silhouette />
      {[...byMuscle.entries()].map(([m, shapes]) => {
        const o = stats[m];
        const cls = "m " + (o.faded || o.last === null ? "fade" : "rec" + o.rec);
        return (
          <g key={m} tabIndex={0} role="button" aria-label={`${MUSCLES[m]}: ${recLabel(o)}. Tap to log a set.`} onClick={() => onPick(m)} onKeyDown={keyAct(() => onPick(m))}>
            <title>{`${MUSCLES[m]} · ${recLabel(o)}`}</title>
            {shapes.map(([, tag, a], i) =>
              tag === "line" ? <path key={i} d={String(a.d)} strokeWidth={Number(a.w)} className={cls + " l"} />
              : tag === "circle" ? <circle key={i} {...(a as object)} className={cls + " f"} />
              : tag === "rect" ? <rect key={i} {...(a as object)} className={cls + " f"} />
              : tag === "ellipse" ? <ellipse key={i} {...(a as object)} className={cls + " f"} />
              : <path key={i} d={String(a.d)} className={cls + " f"} />,
            )}
          </g>
        );
      })}
      <text x={100} y={442} className="svg-label" textAnchor="middle">{side === "front" ? "FRONT" : "BACK"}</text>
    </svg>
  );
}
