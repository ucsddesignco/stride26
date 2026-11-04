"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { BLUE, RED, YELLOW, type StarArt } from "./stars";

// Stars spawn at random spots, grow to a random size, then shrink away. Each
// spot is checked against the live layout (text, felt, balls, cue) when the
// star spawns, so it follows the fluid hero at any width; the light cone is
// fair game. The hero aims to hold a set number of stars per breakpoint: when
// one ends, another spawns shortly after, and the first few are staggered so
// their cycles stay out of phase. Each new star takes the valid spot farthest
// from the live stars and the last few spawn spots, so they spread out.
// Spawning waits for HeroIntro's data-hero-ready, which is only set while the
// hero is in view and the intro has finished. Reduced motion shows the static
// stages instead (Hero), so this layer stays empty.
// Add ?stars-debug to the URL to outline the keep-out shapes.

// Box sizes from the static art: red 37–48, yellow 61, blue 92.
const MIN_BOX = 37;
const MAX_BOX = 92;
// color by size, split halfway between the art's sizes
const artFor = (box: number): StarArt => (box < 54.5 ? RED : box < 76.5 ? YELLOW : BLUE);

const GROW = 1.4; // s
const SHRINK = 1.4; // s
const LIFE = (GROW + SHRINK) * 1000; // ms
const REFILL_MIN = 200; // ms from a star ending to its replacement spawning
const REFILL_MAX = 600;
const MARGIN = 8; // px kept clear of text and table, at the star's peak size
const TRIES = 30;

// Stars held at once, by the hero's breakpoints (lg 1024px, sm 640px).
const TARGET = { lg: 5, sm: 3, base: 2 };
const LG = "(min-width: 64rem)";
const SM = "(min-width: 40rem)";
const target = () => (matchMedia(LG).matches ? TARGET.lg : matchMedia(SM).matches ? TARGET.sm : TARGET.base);

// Fraction of the box the visible star covers (the insets in stars.ts) and the
// visible star's center within the box.
const INSETS = {
  sm: { l: 0.0947, r: 0.0947, t: 0.089, b: 0.1118 },
  lg: { l: 0.0882, r: 0.0882, t: 0.0823, b: 0.1056 },
};

type Pt = { x: number; y: number };
type Shape = { kind: "poly"; pts: Pt[] } | { kind: "circle"; c: Pt; r: number };
type Spawn = { id: number; left: number; top: number; box: number; art: StarArt; c: Pt; r: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function starGeometry(art: StarArt, box: number, left: number, top: number) {
  const i = art === RED ? INSETS.sm : INSETS.lg;
  const w = box * (1 - i.l - i.r);
  const h = box * (1 - i.t - i.b);
  return { c: { x: left + box * i.l + w / 2, y: top + box * i.t + h / 2 }, r: Math.max(w, h) / 2 };
}

// distance from p to segment ab
function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function insidePoly(p: Pt, pts: Pt[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// does a circle (c, r) stay at least `gap` away from the shape?
function clears(c: Pt, r: number, gap: number, s: Shape) {
  if (s.kind === "circle") return Math.hypot(c.x - s.c.x, c.y - s.c.y) >= s.r + r + gap;
  if (insidePoly(c, s.pts)) return false;
  for (let i = 0; i < s.pts.length; i++) {
    if (segDist(c, s.pts[i], s.pts[(i + 1) % s.pts.length]) < r + gap) return false;
  }
  return true;
}

const rectPoly = (r: DOMRect, o: Pt): Shape => ({
  kind: "poly",
  pts: [
    { x: r.left - o.x, y: r.top - o.y },
    { x: r.right - o.x, y: r.top - o.y },
    { x: r.right - o.x, y: r.bottom - o.y },
    { x: r.left - o.x, y: r.bottom - o.y },
  ],
});

// local SVG points → layer px, through every CSS/SVG transform on the way
function mapPts(el: SVGGraphicsElement, pts: [number, number][], o: Pt): Pt[] {
  const m = el.getScreenCTM();
  if (!m) return [];
  return pts.map(([x, y]) => ({ x: m.a * x + m.c * y + m.e - o.x, y: m.b * x + m.d * y + m.f - o.y }));
}

const shown = (el: Element) => el.getClientRects().length > 0;

// Keep-out shapes in layer coordinates, measured now.
function measure(scope: Element, o: Pt): Shape[] {
  const shapes: Shape[] = [];

  // text: the line boxes of the shown text block's text and icons, not the
  // whole block, so the gaps around short lines stay usable
  scope.querySelectorAll("[data-hero-text]").forEach((block) => {
    if (!shown(block)) return;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) {
        if (!n.textContent?.trim()) continue;
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) shapes.push(rectPoly(r, o));
      } else if (n instanceof HTMLImageElement && shown(n)) {
        shapes.push(rectPoly(n.getBoundingClientRect(), o));
      }
    }
  });

  // felt: the projected circle, as a 48-gon
  const felt = scope.querySelector<SVGCircleElement>(".table-plane > circle");
  if (felt && shown(felt)) {
    const R = felt.r.baseVal.value;
    const ring: [number, number][] = Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      return [R * Math.cos(a), R * Math.sin(a)];
    });
    shapes.push({ kind: "poly", pts: mapPts(felt, ring, o) });
  }

  // balls stay round on screen; measure each one's unit circle (BallArt), since
  // the yellow ball's stripes overhang their clip and inflate the group's box
  scope.querySelectorAll(".table-ball").forEach((ball) => {
    const r = (ball.querySelector("circle") ?? ball).getBoundingClientRect();
    if (!r.width) return;
    shapes.push({
      kind: "circle",
      c: { x: (r.left + r.right) / 2 - o.x, y: (r.top + r.bottom) / 2 - o.y },
      r: Math.max(r.width, r.height) / 2,
    });
  });

  // cue: its unit band (see CueArt), turned along its aim, not its bounding box
  const cue = scope.querySelector<SVGGElement>("[data-pool-cue]");
  if (cue && shown(cue) && getComputedStyle(cue).opacity !== "0") {
    shapes.push({ kind: "poly", pts: mapPts(cue, [[0, -0.5], [1, -0.5], [1, 0.5], [0, 0.5]], o) });
  }

  return shapes;
}

export default function StarField() {
  const layer = useRef<HTMLDivElement>(null);
  const [stars, setStars] = useState<Spawn[]>([]);
  const live = useRef<Spawn[]>([]);
  const [debug, setDebug] = useState<Shape[] | null>(null);
  const refill = useRef<() => void>(() => {});

  useEffect(() => {
    const el = layer.current;
    const intro = el?.closest("[data-hero-intro]");
    if (!el || !intro) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const debugOn = new URLSearchParams(location.search).has("stars-debug");

    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (ms: number, fn: () => void) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const ready = () => intro.hasAttribute("data-hero-ready");
    let recent: Pt[] = []; // last few spawn spots, so a star doesn't reappear where one just ended
    let nextId = 0;

    const spawn = () => {
      if (!ready() || live.current.length >= target()) return;
      const bounds = el.getBoundingClientRect();
      if (!bounds.width) return later(REFILL_MIN, spawn);
      const o = { x: bounds.left, y: bounds.top };
      const shapes = measure(intro, o);
      if (debugOn) setDebug(shapes);
      const box = rand(MIN_BOX, MAX_BOX);
      const art = artFor(box);
      const others = [...live.current.map((s) => s.c), ...recent];

      // best candidate: of the valid spots, the one farthest from the others
      let best: Spawn | null = null;
      let bestScore = -1;
      for (let i = 0; i < TRIES; i++) {
        const left = rand(0, bounds.width - box);
        const top = rand(0, bounds.height - box);
        const { c, r } = starGeometry(art, box, left, top);
        const ok =
          shapes.every((s) => clears(c, r, MARGIN, s)) &&
          live.current.every((s) => clears(c, r, MARGIN, { kind: "circle", c: s.c, r: s.r }));
        if (!ok) continue;
        const score = others.length ? Math.min(...others.map((p) => Math.hypot(p.x - c.x, p.y - c.y))) : Infinity;
        if (score > bestScore) {
          bestScore = score;
          best = { id: nextId, left, top, box, art, c, r };
        }
        if (score === Infinity) break;
      }
      // no room this time: try again soon so the count recovers
      if (!best) return later(REFILL_MIN, spawn);
      nextId++;
      recent = [...recent, best.c].slice(-target());
      live.current = [...live.current, best];
      setStars(live.current);
    };

    // Top up to the target. Missing stars are staggered across a lifetime, so
    // the first batch (and a jump up in size) doesn't all pulse together.
    const fill = () => {
      if (!ready()) return;
      const n = target();
      const missing = n - live.current.length - timers.size;
      for (let j = 0; j < missing; j++) later(rand(REFILL_MIN, REFILL_MAX) + (j * LIFE) / n, spawn);
    };
    refill.current = fill;

    // Losing ready (scrolled away) drops pending spawns; live stars finish.
    const sync = () => {
      if (ready()) return fill();
      timers.forEach(clearTimeout);
      timers.clear();
    };
    const mo = new MutationObserver(sync);
    mo.observe(intro, { attributes: true, attributeFilter: ["data-hero-ready"] });
    const mqs = [matchMedia(LG), matchMedia(SM)];
    mqs.forEach((mq) => mq.addEventListener("change", fill));
    sync();

    return () => {
      mo.disconnect();
      mqs.forEach((mq) => mq.removeEventListener("change", fill));
      timers.forEach(clearTimeout);
      refill.current = () => {};
    };
  }, []);

  const remove = (id: number) => {
    live.current = live.current.filter((s) => s.id !== id);
    setStars(live.current);
    refill.current();
  };

  return (
    <div ref={layer} aria-hidden className="pointer-events-none absolute inset-0">
      {stars.map((s) => (
        <SpawnedStar key={s.id} star={s} onDone={() => remove(s.id)} />
      ))}
      {debug && (
        <svg className="absolute inset-0 size-full overflow-visible">
          {debug.map((s, i) =>
            s.kind === "circle" ? (
              <circle key={i} cx={s.c.x} cy={s.c.y} r={s.r + MARGIN} fill="none" stroke="cyan" />
            ) : (
              <polygon key={i} points={s.pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="cyan" />
            ),
          )}
          {stars.map((s) => (
            <circle key={`s${s.id}`} cx={s.c.x} cy={s.c.y} r={s.r} fill="none" stroke="magenta" />
          ))}
        </svg>
      )}
    </div>
  );
}

function SpawnedStar({ star, onDone }: { star: Spawn; onDone: () => void }) {
  const inner = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (!inner.current) return;
    // grow to the peak, then straight back down
    const controls = animate(
      inner.current,
      { scale: [0, 1, 0] },
      { duration: GROW + SHRINK, times: [0, GROW / (GROW + SHRINK), 1], ease: ["easeOut", "easeIn"] },
    );
    controls.then(() => done.current());
    return () => controls.stop();
  }, []);

  const { art, box, left, top } = star;
  return (
    <div className="absolute" style={{ left, top, width: box, height: box }}>
      <div ref={inner} className={`absolute ${art.inset}`} style={{ transform: "scale(0)" }}>
        <Image src={art.src} alt="" width={art.w} height={art.h} className="block size-full max-w-none" />
      </div>
    </div>
  );
}
