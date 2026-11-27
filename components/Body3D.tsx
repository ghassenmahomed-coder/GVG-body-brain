"use client";
// 3D body from the Z-Anatomy atlas (CC BY-SA 4.0, based on BodyParts3D). Glass skin with glowing hotspots
// on Today, recovery-coloured muscles on Gym. Falls back to the flat SVG body when WebGL or the model fails.
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import type { AreaId } from "@/lib/config";
import { MUSCLES, recLabel, type Muscle, type MuscleStat } from "@/lib/gym";
import { sound } from "@/lib/sound";
import { HomeBody, GymBody } from "./Body";

type Engine = {
  setHome: (sev: Record<AreaId, 0 | 1 | 2>) => void;
  setGym: (stats: Record<Muscle, MuscleStat>) => void;
  face: (side: "front" | "back") => void;
  dispose: () => void;
};

const MODEL = "/models/body.glb";
// Hotspots in model space after normalising: feet at y=0, head top at y=2, facing +z.
const HOTSPOTS: Record<AreaId, [number, number, number][]> = {
  brain: [[0, 1.93, 0.02]],
  eyes: [[0, 1.85, 0.1]],
  heart: [[0.05, 1.5, 0.12]],
  hands: [[-0.36, 0.95, 0.03], [0.36, 0.95, 0.03]],
  belly: [[0, 1.15, 0.13]],
  muscles: [[-0.2, 1.42, 0], [0.2, 1.42, 0]],
  feet: [[-0.1, 0.05, 0.06], [0.1, 0.05, 0.06]],
};

async function createEngine(
  el: HTMLDivElement,
  mode: "home" | "gym",
  onPick: (key: string) => void,
): Promise<Engine> {
  const T = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");

  const css = (v: string) => getComputedStyle(el).getPropertyValue(v).trim() || "#888";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  el.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0, 1.05, 5.2);
  scene.add(new T.HemisphereLight(0xffffff, 0x1b2a30, 1.4));
  const key = new T.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 4); scene.add(key);
  const rim = new T.DirectionalLight(0x9fe8ff, 1.4); rim.position.set(-3, 2, -3); scene.add(rim);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.0, 0);
  controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = true;
  controls.minPolarAngle = Math.PI / 2 - 0.35; controls.maxPolarAngle = Math.PI / 2 + 0.2;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.7;
  let idleTimer = 0;
  controls.addEventListener("start", () => { controls.autoRotate = false; clearTimeout(idleTimer); });
  controls.addEventListener("end", () => { idleTimer = window.setTimeout(() => (controls.autoRotate = !reduce), 4000); });

  const gltf = await new GLTFLoader().loadAsync(MODEL);
  const root = gltf.scene;
  const skin = root.getObjectByName("skin") as THREE.Mesh | undefined;
  if (!skin) throw new Error("Model has no skin");
  const box = new T.Box3().setFromObject(skin);
  const size = box.getSize(new T.Vector3());
  const s = 2 / size.y;
  root.scale.setScalar(s);
  root.position.set(-(box.min.x + size.x / 2) * s, -box.min.y * s, -(box.min.z + size.z / 2) * s);
  scene.add(root);

  // Glass / hologram skin: bright at the silhouette, almost clear in the middle.
  const holo = new T.ShaderMaterial({
    uniforms: { uColor: { value: new T.Color(css("--accent")) }, uOpacity: { value: mode === "home" ? 1 : 0.22 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        gl_FragColor = vec4(uColor * (0.25 + f * 1.2), (0.06 + f * 0.8) * uOpacity); }`,
    transparent: true, depthWrite: false,
  });
  skin.material = holo; skin.renderOrder = 2;

  const muscleMeshes: THREE.Mesh[] = [];
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m === skin) return;
    const mat = new T.MeshStandardMaterial({ color: css("--faded"), roughness: 0.5, metalness: 0.05, transparent: true, opacity: mode === "gym" ? 1 : 0 });
    m.material = mat; m.visible = mode === "gym";
    mats.set(m.name, mat);
    if (m.name !== "other") muscleMeshes.push(m);
  });

  // Glowing hotspots for Today.
  const glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d")!; const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
  })();
  const spots: { area: AreaId; sprite: THREE.Sprite; hit: THREE.Mesh }[] = [];
  const hitMat = new T.MeshBasicMaterial({ visible: false });
  if (mode === "home") {
    (Object.keys(HOTSPOTS) as AreaId[]).forEach((area) => HOTSPOTS[area].forEach((p) => {
      const sprite = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: css("--muted"), transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      sprite.position.set(...p); sprite.scale.setScalar(0.16); sprite.renderOrder = 3; scene.add(sprite);
      const hit = new T.Mesh(new T.SphereGeometry(0.12, 8, 8), hitMat); hit.position.set(...p); hit.userData.area = area; scene.add(hit);
      spots.push({ area, sprite, hit });
    }));
  }
  let sev: Record<AreaId, 0 | 1 | 2> | null = null;

  // Tap (not drag) picks a part.
  const ray = new T.Raycaster(); let down: [number, number] | null = null;
  const flash = new Map<string, number>();
  const onDown = (e: PointerEvent) => (down = [e.clientX, e.clientY]);
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const targets = mode === "home" ? spots.map((x) => x.hit) : muscleMeshes;
    const hit = ray.intersectObjects(targets, false)[0];
    if (!hit) return;
    const k = mode === "home" ? (hit.object.userData.area as string) : hit.object.name;
    flash.set(k, performance.now());
    sound.tap(); onPick(k);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(el); resize();

  let raf = 0; const t0 = performance.now(); let faceTo: number | null = null;
  const loop = () => {
    const now = performance.now(), t = (now - t0) / 1000;
    if (faceTo !== null) {
      const cur = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
      let d = faceTo - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 0.01) faceTo = null;
      else {
        const a = cur + d * 0.15, dx = camera.position.x - controls.target.x, dz = camera.position.z - controls.target.z, r = Math.hypot(dx, dz);
        camera.position.x = controls.target.x + r * Math.sin(a); camera.position.z = controls.target.z + r * Math.cos(a);
      }
    }
    controls.update();
    // Gym: skin fades out and muscles fade in over the first 0.9 s.
    if (mode === "gym") {
      const k = Math.min(1, t / 0.9);
      holo.uniforms.uOpacity.value = 1 - 0.78 * k;
      mats.forEach((m) => (m.opacity = k));
    }
    spots.forEach(({ area, sprite }) => {
      const lvl = sev?.[area] ?? 0;
      const pulse = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(t * (lvl === 2 ? 4 : 2.4));
      const f = flash.get(area); const pop = f ? Math.max(0, 1 - (now - f) / 400) : 0;
      sprite.scale.setScalar((lvl ? 0.2 + 0.08 * pulse : 0.12) * (1 + pop * 0.8));
      (sprite.material as THREE.SpriteMaterial).opacity = lvl ? 0.65 + 0.35 * pulse : 0.35;
    });
    mats.forEach((m, name) => {
      const f = flash.get(name); const pop = f ? Math.max(0, 1 - (now - f) / 500) : 0;
      m.emissive.copy(m.color).multiplyScalar(0.12 + pop * 0.6);
    });
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();

  return {
    setHome(next) {
      sev = next;
      spots.forEach(({ area, sprite }) => (sprite.material as THREE.SpriteMaterial).color.set(css(next[area] === 2 ? "--hot" : next[area] === 1 ? "--warn" : "--muted")));
    },
    setGym(stats) {
      mats.forEach((m, name) => {
        const o = stats[name as Muscle];
        m.color.set(css(!o ? "--body" : o.faded || o.last === null ? "--faded" : `--r${o.rec}`));
      });
    },
    face(side) { faceTo = side === "front" ? 0 : Math.PI; controls.autoRotate = false; },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); clearTimeout(idleTimer);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}

function useEngine(mode: "home" | "gym", onPick: (k: string) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [failed, setFailed] = useState(false);
  const pickRef = useRef(onPick); pickRef.current = onPick;
  useEffect(() => {
    let alive = true, eng: Engine | null = null;
    createEngine(ref.current!, mode, (k) => pickRef.current(k))
      .then((e) => { if (alive) { eng = e; setEngine(e); } else e.dispose(); })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; eng?.dispose(); };
  }, [mode]);
  return { ref, engine, failed };
}

export function HomeBody3D({ sev, onPick }: { sev: Record<AreaId, 0 | 1 | 2>; onPick: (a: AreaId) => void }) {
  const { ref, engine, failed } = useEngine("home", (k) => onPick(k as AreaId));
  useEffect(() => { engine?.setHome(sev); }, [engine, sev]);
  if (failed) return <HomeBody sev={sev} onPick={onPick} />;
  return (
    <div className="body3d" ref={ref} role="img" aria-label="3D body map. Tap a glowing spot, or use the buttons below.">
      {!engine && <span className="body3d-load">Loading body…</span>}
    </div>
  );
}

export function GymBody3D({ side, stats, onPick }: { side: "front" | "back"; stats: Record<Muscle, MuscleStat>; onPick: (m: Muscle) => void }) {
  const { ref, engine, failed } = useEngine("gym", (k) => onPick(k as Muscle));
  useEffect(() => { engine?.setGym(stats); }, [engine, stats]);
  useEffect(() => { engine?.face(side); }, [engine, side]);
  if (failed) return <GymBody side={side} stats={stats} onPick={onPick} />;
  const summary = (Object.keys(MUSCLES) as Muscle[]).map((m) => `${MUSCLES[m]}: ${recLabel(stats[m])}`).join(". ");
  return (
    <div className="body3d" ref={ref} role="img" aria-label={`3D muscle map. ${summary}`}>
      {!engine && <span className="body3d-load">Loading muscles…</span>}
    </div>
  );
}
