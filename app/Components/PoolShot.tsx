"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  animate,
  motionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
  type MotionValue,
  type ValueAnimationTransition,
} from "framer-motion";
import { CUE_PAUSE, KEYFRAMES } from "./HeroIntro";
import {
  DEPTH_SLOPE,
  LAMP_H,
  LAMP_X,
  TABLE_RADIUS,
  blueBall,
  cueBall,
  eightBall,
} from "./TableScene";

// Two shots on a table that carries on past the light. Hovering the cue or the
// white ball draws the cue back a little. Click the table or the
// cue: the white ball rolls off the front-left edge, waits out of sight,
// rolls back in at the top edge and smacks the blue ball full on, which
// rolls out of the light while the white ball follows through and stops. The
// cue then comes in from the left, and a second click sends the white ball out
// the right edge and back in from the front, cutting the eight ball, which flies
// off the back edge while the white ball kicks off sideways, bends forward and stops. A further click on the
// table cuts the light with the balls already back, flickers it on and
// slides the cue in again, so the shots can be replayed. If the hero fully leaves
// the viewport, everything is put back unseen so HeroIntro can replay.
//
// TableScene stays a server component: this wraps it and drives its CSS
// variables (see .table-cue and .table-ball in globals.css), so the shots
// follow the camera at every width. Inside HeroIntro it waits until the intro
// has slid the cue in.

type Point = { x: number; z: number };

const unit = (x: number, z: number): Point => {
  const length = Math.hypot(x, z);
  return { x: x / length, z: z / length };
};

// Where the white ball heads on each shot. Each exit is along the cue. The
// struck ball leaves along the entry turned by the shot's cut (FIRST_CUT,
// SECOND_CUT): 0 is a full hit, which sends it straight on. There's no wall: off the table the ball waits OFF_TABLE_TIME,
// then is moved to the entry line and rolls in, so the pair reads as a bank.
const FIRST_EXIT: Point = { x: -0.98439, z: 0.17602 }; // the cue's rest heading, toward the tip
const FIRST_ENTRY = unit(0.906, 0.423);
const SECOND_EXIT = unit(0.995, 0.1); // flat enough that the cue clears the desktop text
const SECOND_ENTRY = unit(-0.5, -0.87); // about 120° on the table seen from above; steeper puts the white ball off the felt on a flat camera
// degrees the struck ball leaves off the white ball's line in; + turns it
// toward +x (right on screen) when the line in heads up the table (−z)
const FIRST_CUT = 0;
const SECOND_CUT = 6;

// One rolling ball's physics, in world px and seconds. The white ball's speed in
// on shot 1 is worked backward from GONE_SPEED; on shot 2 it's SECOND_CONTACT_SPEED.
// Its speeds out are from its EXIT_SPEED.
const FRICTION = 180; // px/s²
const OFF_TABLE_TIME = 0.8; // s the white ball waits off the table on each shot
// px/s the white ball still has as it goes off the table on shots 1 and 2. Tuned by
// eye (first taken from the old wall bank), not derived from anything.
const FIRST_EXIT_SPEED = 970;
const SECOND_EXIT_SPEED = 1000;
const GONE_SPEED = 140; // px/s the blue ball still has as it leaves the light
// px/s the eight still has as it leaves the light: about 640 off the hit, 1.87s to
// the light's edge. Tuned by eye.
const EIGHT_GONE_SPEED = 300;
// px/s the white ball hits the eight at, set by hand instead of worked back from the
// eight's speed (which would be about 641). Picked so the white ball comes to rest
// about 150 world px past contact (slide plus roll, see afterContact); the roll
// grows with its square. Not physical: a head-on hit this hard should send the
// eight off a little faster.
const SECOND_CONTACT_SPEED = 730;
// After contact the white ball, rolling with topspin, leaves along the tangent and
// slides this long while its velocity blends to (5/7)·tangent part + (2/7)·its
// speed in along its line in (the 30° rule), then rolls on straight to a stop.
// The slide gives shot 2's curve and shot 1's stop-then-creep. Its length is fixed
// rather than worked out from sliding friction, and rolling friction is left out
// during it on purpose: that would move the ball about 1px.
const SLIDE_TIME = 0.12;

// Balls go dark by leaving the lamp's light (see drawLight), not by fading,
// or, in the table's front half, slide behind the front rim. They turn, are
// hidden and reappear this far past the rim. The largest ball
// (58, top-down) is all dark once its center is 541 from the lamp, and its
// dark side has ramped to black and it's hidden DARK_RAMP (40) further on, at
// 581. Past the rim by this much, a ball is at least 581.9 from the lamp (it
// hangs 12.6 off the table's center), so the ramp has always ended by then.
const OFF_TABLE_PAST = 86;
// The white ball rolls on until its shadow is off the felt too (see shadowClear):
// points sampled around the shadow's outline, and how far past the rim they must be.
// 32 samples miss the true ellipse by at most a·(1 − cos(π/32)) ≈ 0.005 of its
// semi-axis, well inside the margin.
const SHADOW_STEPS = 32;
const SHADOW_MARGIN = 2;
// the reach is re-worked until it moves less than this (px), at most this many times
const SHADOW_SETTLE = 0.01;
const SHADOW_MAX_PASSES = 10;
// the tablet table's squash, which .table-ball-shadow's --unsquash is relative to
const SQUASH_TABLET = 0.2288;

// The light cone's slant side, lamp to rim (world px).
const CONE_SIDE = Math.hypot(LAMP_H, TABLE_RADIUS);
// A ball's unlit side over the felt is its own colour times this, not black: a
// black ball over the lit felt read as a hole. Off the felt it's black, lost in
// the page. Once all of it is dark, the dim side dims to black over DARK_RAMP
// world px further from the lamp, and then the ball is hidden.
const AMBIENT = 0.12;
const DARK_RAMP = 40;

// Cue travel along its axis in ball radii (+ draws back toward the butt). It
// rests TIP_REST radii from the ball's center, aimed 0.32 radii above it, so the
// tip touches the surface TIP_TOUCH radii out (see strike).
const DRAWBACK = 0.75;
const TIP_REST = 2.4205;
const TIP_TOUCH = 0.95;
const FOLLOW_THROUGH = 0.28;
// s the cue's stroke takes from drawn back to its follow-through. Shot 2's is 20%
// slower, to match its slower SECOND_EXIT_SPEED.
const STROKE_TIME = 0.12;
const SECOND_STROKE_TIME = 0.15;
const HOVER_NUDGE = 0.18;

// cos of the tablet camera's elevation, where the perspective sizing is 1
const COS_TABLET = 0.97347;

const CUE_OFFSCREEN_MARGIN = 40;
const CUE_PARKED_SLIDE = 300; // over 9,000px at any camera, so no resize can bring the cue back
const CUE_ENTER = 1.1;
const CUE_ENTER_EASE = [0.16, 1, 0.3, 1] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Test hook: the Playwright tests set window.__poolShotSpeed before the page
// loads to play the shots faster than real time. Nothing else sets it, so it
// is 1 for visitors. It scales the cue, the rolls and the pauses; the table
// reset's light flicker always runs at its real speed.
type PoolWindow = Window & { __poolShotSpeed?: number };
const speed = () => {
  const s = (window as PoolWindow).__poolShotSpeed;
  return typeof s === "number" && s > 0 ? s : 1;
};
const pause = (ms: number) => sleep(ms / speed());
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.z - a.z);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const opposite = ({ x, z }: Point): Point => ({ x: -x, z: -z });
// `dir` turned by `deg` on the table, + from +x toward +z
const rotate = ({ x, z }: Point, deg: number): Point => {
  const a = (deg * Math.PI) / 180;
  return { x: x * Math.cos(a) - z * Math.sin(a), z: x * Math.sin(a) + z * Math.cos(a) };
};

// Where a ray from `from` along the unit `dir` crosses a circle around the table center.
function rayToRadius(from: Point, dir: Point, radius: number): Point {
  const b = from.x * dir.x + from.z * dir.z;
  const c = from.x * from.x + from.z * from.z - radius * radius;
  const s = -b + Math.sqrt(Math.max(0, b * b - c));
  return { x: from.x + dir.x * s, z: from.z + dir.z * s };
}

// How far a point at `from` must go along the unit `dir` to be `radius` or more
// from the table center for good (0 if it already is).
const leaveDistance = (from: Point, dir: Point, radius: number) => {
  const b = from.x * dir.x + from.z * dir.z;
  const disc = b * b - (from.x * from.x + from.z * from.z - radius * radius);
  return disc <= 0 ? 0 : Math.max(0, -b + Math.sqrt(disc));
};

// The speed a ball needs at the start of a leg to reach `endSpeed` at its end.
const speedBefore = (endSpeed: number, length: number) =>
  Math.sqrt(endSpeed * endSpeed + 2 * FRICTION * length);

type BallVar = "--bx" | "--bz" | "--bs" | "--spin";
// --lit is on the shadow only and --behind on the haze twin only (see drawLight)
const BALL_VARS = ["--bx", "--bz", "--bs", "--spin", "--lit", "--behind"];
const CUE_VARS = ["--ox", "--oz", "--hx", "--hz", "--hs"];

// The white ball's face turns flat on the screen rather than rolling, so it never
// rolls out of sight. At the true rate (distance / radius) it whirled like a
// pinwheel; this slows it so it reads as a gentle turn. After contact it's
// slow, so it turns at the true rate (AFTER_CONTACT_SPIN) and reads as rolling.
const SPIN_SCALE = 0.3;
const AFTER_CONTACT_SPIN = 1;

// 3×3 rotation matrices, row-major, in world axes (x right, z toward the
// viewer, h up; see TableScene.tsx).
type Mat3 = number[];
const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mul3 = (a: Mat3, b: Mat3): Mat3 => {
  const out = new Array<number>(9);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return out;
};
// `m` snapped back to a pure rotation (Gram–Schmidt on its rows), so the float
// error from multiplying a step in every frame can't build up into a skew.
const orthonormalize = (m: Mat3): Mat3 => {
  const r0 = m.slice(0, 3);
  const r1 = m.slice(3, 6);
  const norm = (v: number[]) => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return v.map((x) => x / l);
  };
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const a = norm(r0);
  const d = dot(a, r1);
  const b = norm(r1.map((x, i) => x - d * a[i]));
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return [...a, ...b, ...c];
};
// Rotation by `angle` around the unit axis (kx, kz, kh) (Rodrigues).
const axisAngle = (kx: number, kz: number, kh: number, angle: number): Mat3 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const t = 1 - cos;
  return [
    cos + kx * kx * t, kx * kz * t - kh * sin, kx * kh * t + kz * sin,
    kz * kx * t + kh * sin, cos + kz * kz * t, kz * kh * t - kx * sin,
    kh * kx * t - kz * sin, kh * kz * t + kx * sin, cos + kh * kh * t,
  ];
};

type BallSpec = typeof cueBall;
type SceneBall = {
  spec: BallSpec;
  el: SVGElement;
  shadow: SVGElement;
  /** the twin that draws the unlit side in the cone's haze (see TableScene) */
  haze: SVGElement;
  /** the twin that draws the unlit side dim where it's over the felt */
  feltTwin: SVGElement;
  /** the unlit side: in the ball (black), its felt twin (dim) and its haze twin */
  dark: SVGPathElement[];
  /** the ball's colour as RGB 0–255, read from its art (its unlit side is a dim copy) */
  base: number[];
  /** the felt twin's unlit side's current fill */
  fill: string;
  x: number;
  z: number;
  /** white only: the flat turn of its face (deg) */
  spin: number;
  /** white only: its turn as a share of the true rolling rate */
  spinRate: number;
  /** blue and eight: the ball's 3D orientation, and its off-white spot */
  orient: Mat3;
  spot: { el: SVGPathElement; u: number; v: number; r: number; rest: string } | null;
  /** put away off the table until the next reset (see putAway) */
  gone: boolean;
};

// One straight roll to (x, z), from v0 to v1 px/s.
type Leg = Point & { v0: number; v1: number };
// Any motion: where the ball is `t` s in, for `duration` s.
type Path = { duration: number; at: (t: number) => Point };
type Roll = {
  ball: SceneBall;
  path: Path;
  time: number;
  done: () => void;
};

// A leg from `from`, slowing evenly from v0 to v1.
const legPath = (from: Point, leg: Leg): Path => {
  const length = distance(from, leg);
  const duration = length > 0 ? (2 * length) / (leg.v0 + leg.v1) : 0;
  return {
    duration,
    at: (t) => {
      if (t >= duration) return { x: leg.x, z: leg.z };
      const f = (leg.v0 * t + ((leg.v1 - leg.v0) / (2 * duration)) * t * t) / length;
      return { x: from.x + (leg.x - from.x) * f, z: from.z + (leg.z - from.z) * f };
    },
  };
};

// The white ball just after contact at `from`, coming in along unit `u` at `v`
// with the struck ball leaving along unit `n`: it leaves along the tangent at
// v·sin(cut), slides SLIDE_TIME blending linearly to the rolling velocity Vf
// (without friction, see SLIDE_TIME), then rolls straight along Vf under FRICTION
// to a stop.
const afterContact = (from: Point, u: Point, n: Point, v: number) => {
  const along = u.x * n.x + u.z * n.z; // cos(cut)
  const tx = u.x - along * n.x;
  const tz = u.z - along * n.z;
  const tLen = Math.hypot(tx, tz);
  const sin = tLen; // |u − (u·n)n| = sin(cut), with u and n unit
  const t = tLen > 1e-9 ? { x: tx / tLen, z: tz / tLen } : { x: 0, z: 0 };
  const v0 = { x: v * sin * t.x, z: v * sin * t.z };
  const vf = {
    x: (5 / 7) * v0.x + (2 / 7) * v * u.x,
    z: (5 / 7) * v0.z + (2 / 7) * v * u.z,
  };
  const slide: Path = {
    duration: SLIDE_TIME,
    at: (time) => {
      const τ = Math.min(time, SLIDE_TIME);
      const k = (τ * τ) / (2 * SLIDE_TIME);
      return {
        x: from.x + v0.x * τ + (vf.x - v0.x) * k,
        z: from.z + v0.z * τ + (vf.z - v0.z) * k,
      };
    },
  };
  const slideEnd = slide.at(SLIDE_TIME);
  const speed = Math.hypot(vf.x, vf.z);
  const rollLength = (speed * speed) / (2 * FRICTION);
  const rest =
    speed > 1e-9
      ? { x: slideEnd.x + (vf.x / speed) * rollLength, z: slideEnd.z + (vf.z / speed) * rollLength }
      : slideEnd;
  return { slide, slideEnd, rollOut: { ...rest, v0: speed, v1: 0 }, rest };
};

// How far a ball's center is outside the light cone's side, in its radii
// (− inside), `reach` from under the lamp. `radius` is the ball's drawn radius;
// `height` is its center's height, where the cone is narrower. The CSS lifts
// the center by the unscaled --r, not the drawn radius (see .table-ball).
const lampOut = (reach: number, radius: number, height: number) =>
  ((reach - TABLE_RADIUS * (1 - height / LAMP_H)) * LAMP_H) / CONE_SIDE / radius;

// all of the ball, once it's all dark (the clip trims it to the outline)
const ALL_DARK = "M-2,-2H2V2H-2Z";

// The part of a ball out of the lamp's light, as a path on its unit circle
// (clipped just past it): "" while it's all lit. It's drawn like a phase of the
// moon: the dark side is the half of the outline facing away from the light's
// center on screen, and the light's edge is a half-ellipse that always ends on
// the outline, sweeping across the ball as `out` goes from −1 (all lit) to 1
// (all dark). `s` is the felt's squash on screen (see TableScene).
function darkSide(x: number, z: number, out: number, s: number): string {
  if (out <= -1) return "";
  if (out >= 1) return ALL_DARK;
  // Work in a frame turned so the dark side is toward +X on screen: away from
  // the light's center, so the left rim darkens the left side, the front rim
  // the bottom and the back rim the top.
  const vx = x - LAMP_X;
  const vy = z * s;
  const length = Math.hypot(vx, vy);
  const ex = length > 1e-6 ? vx / length : 1;
  const ey = length > 1e-6 ? vy / length : 0;
  const pt = (X: number, Y: number) =>
    `${(X * ex - Y * ey).toFixed(4)},${(X * ey + Y * ex).toFixed(4)}`;
  // The edge is the half-ellipse (d·sin θ, cos θ), θ 0 → π, from the outline's
  // bottom to its top: an SVG arc with radii |d| and 1, turned with the frame.
  // It bulges toward +X (SVG's negative sweep) when d > 0. It's drawn as two
  // quarter arcs through (d, 0): SVG works out an arc's center from its ends,
  // and for a half-ellipse rounding the ends moves that center visibly. Then
  // close round the outline's dark side from outside the circle.
  const d = -out;
  const turn = ((Math.atan2(ey, ex) * 180) / Math.PI).toFixed(4);
  const quarter = (X: number, Y: number) =>
    `A${Math.abs(d).toFixed(4)},1 ${turn} 0 ${d > 0 ? 0 : 1} ${pt(X, Y)}`;
  const edge = `M${pt(0, 1)}${quarter(d, 0)}${quarter(0, -1)}`;
  const outside = [-0.5, -0.25, 0, 0.25, 0.5].map((k) =>
    pt(2 * Math.cos(Math.PI * k), 2 * Math.sin(Math.PI * k)),
  );
  return `${edge}L${outside.join("L")}Z`;
}

// The outline of a circle of angular radius α on a unit sphere, as seen, around
// the unit direction that shows at (a, b) and faces the camera by f. Seen
// head-on a circle on the sphere is an ellipse: centered at cos α·(a, b), sin α
// across (a, b) on screen and sin α·|f| along it. Where it wraps round the
// back, only its arc in front shows, closed along the ball's edge, where that
// arc's ends lie. "" when it's all round the back.
function spotOutline(a: number, b: number, f: number, sinA: number, cosA: number): string {
  const L = Math.hypot(a, b);
  // m along (a, b) on screen, e across it
  const mx = L > 1e-9 ? a / L : 0;
  const my = L > 1e-9 ? b / L : 1;
  const ex = -my;
  const ey = mx;
  // The circle is cos α·p + sin α·(cos θ·e + sin θ·(p × e)): on screen p × e
  // is −f·m, and it faces the camera by L, so a point's facing is
  // f·cos α + L·sin α·sin θ.
  const at = (θ: number) => [
    cosA * a + sinA * (Math.cos(θ) * ex - f * Math.sin(θ) * mx),
    cosA * b + sinA * (Math.cos(θ) * ey - f * Math.sin(θ) * my),
  ];
  const n = (v: number) => v.toFixed(4);
  const pt = ([x, y]: number[]) => `${n(x)},${n(y)}`;
  const rot = n((Math.atan2(ey, ex) * 180) / Math.PI);
  // θ increasing turns e toward −f·m: SVG's positive sweep when f > 0
  const sweep = f > 0 ? 1 : 0;
  // The arc from θ0 to θ1 in quarters: SVG works out an arc's center from its
  // ends, and near a half-ellipse rounding the ends moves that center visibly.
  const arcs = (θ0: number, θ1: number) => {
    let path = "";
    for (let i = 1; i <= 4; i++) {
      const to = at(θ0 + ((θ1 - θ0) * i) / 4);
      path += `A${n(sinA)},${n(sinA * Math.abs(f))} ${rot} 0 ${sweep} ${pt(to)}`;
    }
    return path;
  };

  // all in front: the whole ellipse
  if (f * cosA >= L * sinA) return `M${pt(at(0))}${arcs(0, 2 * Math.PI)}Z`;
  if (f * cosA <= -L * sinA) return "";
  // in front for sin θ ≥ t0, from θ1 to π − θ1; both ends are on the edge
  const θ1 = Math.asin((-f * cosA) / (L * sinA));
  const start = at(θ1);
  const end = at(Math.PI - θ1);
  // back along the edge the short way, which passes the spot's side
  const edgeSweep = end[0] * start[1] - end[1] * start[0] > 0 ? 1 : 0;
  return `M${pt(start)}${arcs(θ1, Math.PI - θ1)}A1,1 0 0 ${edgeSweep} ${pt(start)}Z`;
}

// "#RRGGBB" or "black" as RGB 0–255
const parseColour = (colour: string | null) =>
  colour?.startsWith("#") ? [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16)) : [0, 0, 0];

export default function PoolShot({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const reduceRef = useRef(reduceMotion);
  useEffect(() => {
    reduceRef.current = reduceMotion;
  }, [reduceMotion]);

  useEffect(() => {
    const root = scope.current;
    const cue = root?.querySelector<SVGElement>("[data-pool-cue]");
    const felt = root?.querySelector<SVGElement>(".table-plane > circle");
    const stageEl = root?.closest("[data-hero-intro]");
    const lightEl = stageEl?.querySelector<HTMLElement>("[data-hero-light]");
    const dimEl = stageEl?.querySelector<HTMLElement>("[data-hero-dim]");
    if (!root || !cue || !felt || !stageEl || !lightEl || !dimEl) return;
    // the cue and its shadow: the only parts that read --slide
    const cueParts = root.querySelectorAll<SVGElement>("[data-hero-cue]");
    const tableParts = root.querySelectorAll<SVGElement>(".table-plane, .table-ball");

    const makeBall = (spec: BallSpec): SceneBall | null => {
      const el = root.querySelector<SVGElement>(`[data-ball="${spec.kind}"]`);
      const shadow = root.querySelector<SVGElement>(`[data-ball-shadow="${spec.kind}"]`);
      // the spot's resting center in ball radii, read from the art itself
      const spotEl = el?.querySelector<SVGPathElement>("[data-ball-spot]");
      const spot = spotEl
        ? {
            el: spotEl,
            u: Number(spotEl.dataset.u),
            v: Number(spotEl.dataset.v),
            r: Number(spotEl.dataset.r),
            rest: spotEl.getAttribute("d") ?? "",
          }
        : null;
      const haze = root.querySelector<SVGElement>(`[data-ball-haze="${spec.kind}"]`);
      const feltTwin = root.querySelector<SVGElement>(`[data-ball-felt="${spec.kind}"]`);
      const dark = [el, feltTwin, haze].map((g) =>
        g?.querySelector<SVGPathElement>("[data-ball-dark]"),
      );
      if (!el || !shadow || !haze || !feltTwin || dark.some((d) => !d)) return null;
      return {
        spec,
        el,
        shadow,
        haze,
        feltTwin,
        dark: dark as SVGPathElement[],
        // every ball's art starts with its base circle
        base: parseColour(el.querySelector("circle")?.getAttribute("fill") ?? null),
        fill: "",
        x: spec.x,
        z: spec.z,
        spin: 0,
        spinRate: SPIN_SCALE,
        orient: IDENTITY,
        spot,
        gone: false,
      };
    };
    const white = makeBall(cueBall);
    const blue = makeBall(blueBall);
    const eight = makeBall(eightBall);
    if (!white || !blue || !eight) return;
    const movingBalls = [white, blue, eight];
    // the white ball's own front clip (see placeBall)
    const whiteClip = root.querySelector<SVGElement>("[data-front-clip-white]");
    // "Click me": gone for good once the first shot is taken
    const hint = root.querySelector<SVGElement>("[data-pool-hint]");

    let stage: "first" | "second" | "done" = "first";
    const isDone = () => stage === "done";
    let busy = false;
    // bumped by a reset: a shot still awaiting something sees it and gives up
    let shotId = 0;
    let raf: number | null = null;
    let lastFrame = 0;
    let stopWatch: (() => void) | null = null;
    const rolls = new Set<Roll>();
    const running: AnimationPlaybackControls[] = [];
    let hoverAnim: AnimationPlaybackControls | null = null;

    // cue: shot travel + hover nudge, both along the cue axis
    const shot = motionValue(0);
    const hover = motionValue(0);
    const writeSlide = (slide: number) =>
      cueParts.forEach((el) => el.style.setProperty("--slide", String(slide)));
    const setSlide = () => writeSlide(shot.get() + hover.get());
    const unsubscribe = [shot.on("change", setSlide), hover.on("change", setSlide)];

    const run = (
      value: MotionValue<number>,
      to: number | number[],
      options: ValueAnimationTransition<number>,
    ) => {
      const controls = animate(
        value,
        to,
        options.duration === undefined ? options : { ...options, duration: options.duration / speed() },
      );
      running.push(controls);
      return controls;
    };
    // a one-off tween that writes each frame through `set`
    const tween = (
      from: number,
      to: number | number[],
      options: ValueAnimationTransition<number>,
      set: (v: number) => void,
    ) => run(motionValue(from), to, { ...options, onUpdate: set });

    // The camera follows the viewport width, so read it from the felt's drawn
    // size: table scale (px per world px) and perspective sizing (see --p).
    const measure = () => {
      const rect = felt.getBoundingClientRect();
      const s = rect.height / rect.width;
      return {
        scale: rect.width / (2 * TABLE_RADIUS),
        squash: s,
        perspective: Math.sqrt(Math.max(0, 1 - s * s)) / COS_TABLET,
      };
    };
    let view = measure();

    const baseRadius = ({ rTablet, rMobile }: BallSpec) =>
      rMobile + (rTablet - rMobile) * view.perspective;
    const radiusAt = (spec: BallSpec, z: number) =>
      Math.max(
        baseRadius(spec) * 0.5,
        baseRadius(spec) + view.perspective * DEPTH_SLOPE * (z - spec.z),
      );

    // A ball's shadow outline on the felt, as world-px offsets from its center, for
    // a ball drawn `radius` wide: .table-ball-shadow's transform, in JS.
    const shadowOutline = ({ shadow }: BallSpec, radius: number): Point[] => {
      const p = view.perspective;
      const unsquash = SQUASH_TABLET / view.squash;
      const [sa, sb, sc, sd] = shadow.m;
      const ox = 0.25 + (shadow.x - 0.25) * p;
      const oz = shadow.z * unsquash * p;
      const a = 1.0308 + (sa - 1.0308) * p;
      const b = sb * unsquash * p;
      const c = sc * p;
      const d = 1 + (sd * unsquash - 1) * p;
      return Array.from({ length: SHADOW_STEPS }, (_, i) => {
        const u = Math.cos((2 * Math.PI * i) / SHADOW_STEPS);
        const v = Math.sin((2 * Math.PI * i) / SHADOW_STEPS);
        return { x: radius * (ox + a * u + c * v), z: radius * (oz + b * u + d * v) };
      });
    };

    // Where a ball rolling from `from` along `dir` is OFF_TABLE_PAST past the rim
    // and its shadow is all off the felt, so none of it is left clipped at the rim
    // while the ball waits off the table. The shadow lies mostly behind the ball,
    // so at the tablet angle it can still be on the felt when the ball is past the rim.
    // The shadow's size depends on the ball's depth where it stops, which depends on
    // the reach, so the reach is re-worked until it settles (SHADOW_SETTLE).
    const shadowClear = (from: Point, dir: Point, spec: BallSpec): Point => {
      const base = leaveDistance(from, dir, TABLE_RADIUS + OFF_TABLE_PAST);
      let reach = base;
      for (let pass = 0; pass < SHADOW_MAX_PASSES; pass++) {
        const radius = radiusAt(spec, from.z + dir.z * reach);
        let next = base;
        for (const q of shadowOutline(spec, radius)) {
          const point = { x: from.x + q.x, z: from.z + q.z };
          next = Math.max(next, leaveDistance(point, dir, TABLE_RADIUS + SHADOW_MARGIN));
        }
        const settled = Math.abs(next - reach) < SHADOW_SETTLE;
        reach = next;
        if (settled) break;
      }
      return { x: from.x + dir.x * reach, z: from.z + dir.z * reach };
    };

    const ballParts = (ball: SceneBall) => [ball.el, ball.feltTwin, ball.haze, ball.shadow];
    const setBall = (ball: SceneBall, name: BallVar, v: number) => {
      for (const el of ballParts(ball)) el.style.setProperty(name, String(v));
    };
    // reduced motion only: with full motion, balls go dark by leaving the light
    const setBallOpacity = (ball: SceneBall, v: number) => {
      for (const el of ballParts(ball)) el.style.opacity = String(v);
    };

    // Shades the ball's side out of the light: black, and over the felt a dim
    // copy of its colour (the felt twin), which dims to black once all of it is
    // dark. The ball and its twins are then hidden: they'd look the same, but the ball's edge would show through the
    // dark side's as a faint ring. Its shadow fades with how lit it is (--lit),
    // and past the back rim the haze twin covers the whole ball (--behind),
    // since it's behind the cone of light.
    // In the table's front half the lamp doesn't apply: the ball stays lit and
    // the front rim's clip hides it as it goes over (see TableScene). The two
    // blend over a ball's radius in front of z = 0, so a ball crossing there by
    // a side rim doesn't jump from lit to dark. Behind z = 0 it's the lamp alone:
    // a band there kept blue lit as it left by the right rim at phone widths,
    // and the clip's side wiped off the lit part.
    const drawLight = (ball: SceneBall, radius: number) => {
      const reach = Math.hypot(ball.x - LAMP_X, ball.z);
      const lamp = lampOut(reach, radius, baseRadius(ball.spec));
      const front = clamp(ball.z / radius, 0, 1);
      const out = lamp + (Math.min(lamp, -1) - lamp) * front;
      // world px further from the lamp than where it's all dark
      const past = ((out - 1) * radius * CONE_SIDE) / LAMP_H;
      const visibility = past >= DARK_RAMP ? "hidden" : "";
      ball.el.style.visibility = visibility;
      ball.feltTwin.style.visibility = visibility;
      ball.haze.style.visibility = visibility;
      const d = darkSide(ball.x, ball.z, out, view.squash);
      ball.dark.forEach((el) => {
        if (el.getAttribute("d") !== d) el.setAttribute("d", d);
      });
      const level = AMBIENT * clamp(1 - past / DARK_RAMP, 0, 1);
      const fill = `rgb(${ball.base.map((v) => Math.round(v * level)).join(",")})`;
      if (fill !== ball.fill) {
        ball.fill = fill;
        ball.dark[1].style.fill = fill;
      }
      ball.shadow.style.setProperty("--lit", String(clamp((1 - out) / 2, 0, 1)));
      const behind =
        ball.z < 0 ? clamp((reach - (TABLE_RADIUS - radius)) / (2 * radius), 0, 1) : 0;
      ball.haze.style.setProperty("--behind", String(behind));
    };

    // Draws a ball's spot where its orientation has rolled it: a circle on the
    // sphere of angular radius α (sin α = the art's radius), around the direction
    // that at rest puts its outline's center on the art's. On a unit sphere,
    // (x, z, h) shows at (x, z·s − h·c) and faces the camera by z·c + h·s.
    const drawSpot = (ball: SceneBall) => {
      if (!ball.spot) return;
      const { el, u: u0, v: v0, r } = ball.spot;
      const s = view.squash;
      const c = Math.sqrt(Math.max(0, 1 - s * s));
      const sinA = r;
      const cosA = Math.sqrt(1 - r * r);
      const a0 = u0 / cosA;
      const b0 = v0 / cosA;
      const f0 = Math.sqrt(Math.max(0, 1 - a0 * a0 - b0 * b0));
      const p0 = [a0, b0 * s + f0 * c, -b0 * c + f0 * s];
      const m = ball.orient;
      const [px, pz, ph] = [0, 1, 2].map(
        (row) => m[row * 3] * p0[0] + m[row * 3 + 1] * p0[1] + m[row * 3 + 2] * p0[2],
      );
      const d = spotOutline(px, pz * s - ph * c, pz * c + ph * s, sinA, cosA);
      if (el.getAttribute("d") !== d) el.setAttribute("d", d);
    };

    const placeBall = ({ x, z }: Point, ball: SceneBall) => {
      const radius = radiusAt(ball.spec, z);
      const dx = x - ball.x;
      const dz = z - ball.z;
      const rolled = Math.hypot(dx, dz);
      if (ball.spot) {
        // rolling without slipping: turn by rolled / radius around the table-plane
        // axis at right angles to the step, so the top moves the way the ball does
        if (rolled > 0)
          ball.orient = orthonormalize(
            mul3(axisAngle(-dz / rolled, dx / rolled, 0, rolled / radius), ball.orient),
          );
        drawSpot(ball);
      } else {
        ball.spin += (Math.sign(dx) || 1) * (rolled / radius) * (180 / Math.PI) * ball.spinRate;
        setBall(ball, "--spin", ball.spin);
      }
      ball.x = x;
      ball.z = z;
      setBall(ball, "--bx", x - ball.spec.x);
      setBall(ball, "--bz", z - ball.spec.z);
      setBall(ball, "--bs", radius / baseRadius(ball.spec));
      if (ball === white && whiteClip) {
        // Its drawn bottom is radius below its center on screen, and the center
        // sits --r·c above where it touches the felt (see .table-ball).
        const c = Math.sqrt(Math.max(0, 1 - view.squash * view.squash));
        whiteClip.style.setProperty("--overhang", String(radius - baseRadius(ball.spec) * c));
      }
      drawLight(ball, radius);
    };

    const putAway = (ball: SceneBall) => {
      ball.gone = true;
      for (const el of ballParts(ball)) el.style.visibility = "hidden";
    };

    // The camera changes with the viewport, and a ball's spot, size and unlit
    // side are drawn for the camera they were placed under. On a resize, take
    // the new camera and redraw every ball that has moved, at rest or mid-roll.
    const onResize = () => {
      view = measure();
      for (const ball of movingBalls) {
        const moved = ball.x !== ball.spec.x || ball.z !== ball.spec.z || ball.orient !== IDENTITY;
        if (moved && !ball.gone) placeBall({ x: ball.x, z: ball.z }, ball);
      }
    };
    const resized = new ResizeObserver(onResize);
    resized.observe(felt);

    const advance = (roll: Roll, dt: number) => {
      roll.time += dt;
      const { path } = roll;
      placeBall(path.at(Math.min(roll.time, path.duration)), roll.ball);
      if (roll.time < path.duration) return;
      rolls.delete(roll);
      roll.done();
    };

    // One loop for every rolling ball, running only while one is.
    const tick = (now: number) => {
      const dt = Math.min((now - lastFrame) / 1000, 1 / 30) * speed();
      lastFrame = now;
      rolls.forEach((roll) => advance(roll, dt));
      raf = rolls.size > 0 ? requestAnimationFrame(tick) : null;
    };

    const move = (ball: SceneBall, path: Path) =>
      new Promise<void>((done) => {
        rolls.add({ ball, path, time: 0, done });
        if (raf === null) {
          lastFrame = performance.now();
          raf = requestAnimationFrame(tick);
        }
      });
    const roll = (ball: SceneBall, leg: Leg) => move(ball, legPath({ x: ball.x, z: ball.z }, leg));

    // Where the white ball touches `target`, sitting against it along −n, the
    // line between the centres. Balls are drawn round on a squashed table, so they
    // touch when they're this far apart on screen: on a flat camera, depth covers
    // little of it.
    const contactPoint = (target: SceneBall, n: Point): Point => {
      const onScreen = radiusAt(cueBall, target.spec.z) + baseRadius(target.spec);
      const reach = onScreen / Math.hypot(n.x, n.z * view.squash);
      return { x: target.x - n.x * reach, z: target.z - n.z * reach };
    };

    // A shot's geometry: where the white ball meets `target` coming in along
    // `entryDir`, the struck ball's line out n (entryDir turned by `cut`) and end,
    // the speeds, and what the white ball does after contact. The white ball's speed
    // at contact is worked back from the struck ball's, unless `hitSpeed` sets it.
    const planShot = (
      target: SceneBall,
      entryDir: Point,
      cut: number,
      goneSpeed: number,
      hitSpeed?: number,
    ) => {
      const n = rotate(entryDir, cut);
      const contact = contactPoint(target, n);
      const targetEnd = rayToRadius(target, n, TABLE_RADIUS + OFF_TABLE_PAST);
      const targetSpeed = speedBefore(goneSpeed, distance(target, targetEnd));
      const contactSpeed = hitSpeed ?? targetSpeed / Math.cos((cut * Math.PI) / 180);
      return {
        n,
        contact,
        targetEnd,
        targetSpeed,
        contactSpeed,
        after: afterContact(contact, entryDir, n, contactSpeed),
      };
    };

    // Draw back, hold, strike. `onHit` fires the frame the tip reaches the ball,
    // which is drawn smaller farther from the viewer, so the tip travels further.
    const strike = async (id: number, onHit: () => void, strokeTime = STROKE_TIME) => {
      const ballScale = radiusAt(cueBall, white.z) / baseRadius(cueBall);
      const touch = TIP_TOUCH * ballScale - TIP_REST;

      await run(shot, DRAWBACK, { duration: 0.42, ease: [0.33, 0, 0.2, 1] });
      await pause(90);
      if (id !== shotId) return false;

      let hit = false;
      stopWatch = shot.on("change", (s) => {
        if (hit || s > touch) return;
        hit = true;
        onHit();
      });
      await run(shot, touch - FOLLOW_THROUGH, { duration: strokeTime, ease: [0.55, 0, 1, 0.6] });
      stopWatch?.();
      stopWatch = null;
      if (id !== shotId) return false;

      // follow-through hold
      await pause(180);
      return id === shotId;
    };

    // The cue strikes over `strokeTime` and the white ball rolls off the table at `exitSpeed`, waits
    // OFF_TABLE_TIME out of sight, then is moved onto the line in and rolls into `target`.
    // `target` leaves `cut` degrees off that line, out of the light, still at
    // `goneSpeed` as it leaves, and the white ball plays out the cut (see afterContact).
    // `settled` resolves with both balls at rest, or early if `id` goes stale.
    const bankShot = (
      id: number,
      target: SceneBall,
      exitDir: Point,
      entryDir: Point,
      cut: number,
      exitSpeed: number,
      goneSpeed: number,
      hitSpeed?: number,
      strokeTime = STROKE_TIME,
    ) => {
      const { contact, targetEnd, targetSpeed, contactSpeed, after } = planShot(
        target,
        entryDir,
        cut,
        goneSpeed,
        hitSpeed,
      );
      const exit = shadowClear(white, exitDir, cueBall);
      const entry = shadowClear(contact, opposite(entryDir), cueBall);
      const entrySpeed = speedBefore(contactSpeed, distance(entry, contact));

      let settled: Promise<void> = Promise.resolve();
      const struck = strike(id, () => {
        white.spinRate = SPIN_SCALE;
        settled = (async () => {
          await roll(white, { ...exit, v0: speedBefore(exitSpeed, distance(white, exit)), v1: exitSpeed });
          if (id !== shotId) return;
          await pause(OFF_TABLE_TIME * 1000);
          if (id !== shotId) return;
          // set its position first, so placeBall doesn't roll it across the gap
          white.x = entry.x;
          white.z = entry.z;
          placeBall(entry, white);
          await roll(white, { ...contact, v0: entrySpeed, v1: contactSpeed });
          if (id !== shotId) return;
          white.spinRate = AFTER_CONTACT_SPIN;
          const whiteDone = (async () => {
            await move(white, after.slide);
            if (id !== shotId) return;
            await roll(white, after.rollOut);
          })();
          await Promise.all([
            roll(target, { ...targetEnd, v0: targetSpeed, v1: goneSpeed }),
            whiteDone,
          ]);
          if (id === shotId) putAway(target);
        })();
      }, strokeTime);
      return { struck, settled: () => settled };
    };

    // Horizontal screen px per unit of --slide, for the cue's current heading.
    const cueScreenRate = (hx: number) =>
      baseRadius(cueBall) * view.scale * Math.abs(hx) * 0.99604;

    // Re-aims the cue at the white ball from the left, so a hit sends the ball
    // along `heading`. Returns the slide that starts it just past the viewport's
    // left edge. It's off-screen when this runs, so the jump never shows.
    const aimCueFromLeft = (heading: Point) => {
      const { x: hx, z: hz } = opposite(heading);
      cueParts.forEach((el) => {
        el.style.setProperty("--ox", String(white.x - cueBall.x));
        el.style.setProperty("--oz", String(white.z - cueBall.z));
        el.style.setProperty("--hx", String(hx));
        el.style.setProperty("--hz", String(hz));
        el.style.setProperty("--hs", "-1");
      });
      writeSlide(0);
      const tipEdge = cue.getBoundingClientRect().right;
      return (tipEdge + CUE_OFFSCREEN_MARGIN) / cueScreenRate(hx);
    };

    // The slide that takes the cue's tip past the viewport's edge, on the side
    // away from `heading`.
    const cueClearance = (heading: Point) => {
      const rect = cue.getBoundingClientRect();
      const tipToEdge =
        heading.x < 0 ? window.innerWidth - rect.left : rect.right;
      return (tipToEdge + CUE_OFFSCREEN_MARGIN) / cueScreenRate(heading.x);
    };

    // Pulls the cue back along its axis until it's off-screen, the opposite way
    // to where it just sent the ball, then parks it far enough away for any width.
    const pullCueAway = async (id: number, heading: Point) => {
      await run(shot, shot.get() + cueClearance(heading), { duration: 0.6, ease: [0.4, 0, 1, 1] });
      if (id === shotId) shot.jump(CUE_PARKED_SLIDE);
    };

    const firstShot = async (id: number) => {
      const { struck, settled } = bankShot(
        id,
        blue,
        FIRST_EXIT,
        FIRST_ENTRY,
        FIRST_CUT,
        FIRST_EXIT_SPEED,
        GONE_SPEED,
      );
      if (!(await struck)) return;

      const cueGone = pullCueAway(id, FIRST_EXIT);
      await Promise.all([settled(), cueGone]);
      if (id !== shotId) return;

      // It comes back in from the left and sets up on the white ball.
      shot.jump(aimCueFromLeft(SECOND_EXIT));
      await run(shot, 0, { duration: CUE_ENTER, ease: CUE_ENTER_EASE });
      if (id === shotId) stage = "second";
    };

    const secondShot = async (id: number) => {
      const { struck, settled } = bankShot(
        id,
        eight,
        SECOND_EXIT,
        SECOND_ENTRY,
        SECOND_CUT,
        SECOND_EXIT_SPEED,
        EIGHT_GONE_SPEED,
        SECOND_CONTACT_SPEED,
        SECOND_STROKE_TIME,
      );
      if (!(await struck)) return;

      const cueGone = pullCueAway(id, SECOND_EXIT);
      await Promise.all([settled(), cueGone]);
      if (id === shotId) stage = "done";
    };

    // Reduced motion: nothing rolls. A small cue nudge, then parts cross-fade
    // to where the full version leaves them.
    const nudgeCue = async () => {
      await run(shot, -0.25, { duration: 0.12 });
      run(shot, 0, { duration: 0.2 });
    };
    const fadeBall = (ball: SceneBall, from: number, to: number) =>
      tween(from, to, { duration: 0.3 }, (o) => setBallOpacity(ball, o));

    const fadeCue = (from: number, to: number) =>
      tween(from, to, { duration: 0.3 }, (o) =>
        cueParts.forEach((el) => (el.style.opacity = String(o))),
      );

    const firstShotReduced = async (id: number) => {
      await nudgeCue();
      await Promise.all([fadeBall(blue, 1, 0), fadeBall(white, 1, 0), fadeCue(1, 0)]);
      if (id !== shotId) return;
      putAway(blue);
      placeBall(planShot(blue, FIRST_ENTRY, FIRST_CUT, GONE_SPEED).after.rest, white);
      setBallOpacity(white, 0);
      aimCueFromLeft(SECOND_EXIT);
      await Promise.all([fadeBall(white, 0, 1), fadeCue(0, 1)]);
      if (id === shotId) stage = "second";
    };

    const secondShotReduced = async (id: number) => {
      await nudgeCue();
      await Promise.all([fadeBall(eight, 1, 0), fadeBall(white, 1, 0), fadeCue(1, 0)]);
      if (id !== shotId) return;
      putAway(eight);
      placeBall(planShot(eight, SECOND_ENTRY, SECOND_CUT, EIGHT_GONE_SPEED, SECOND_CONTACT_SPEED).after.rest, white);
      setBallOpacity(white, 0);
      await fadeBall(white, 0, 1);
      if (id === shotId) stage = "done";
    };

    // Once both shots have played, the table is what you click, and the cue's
    // keyboard action does the same.
    const setFinished = (finished: boolean) => {
      tableParts.forEach((el) => (el.style.cursor = finished ? "pointer" : ""));
      cue.setAttribute("aria-label", finished ? "Reset the table" : "Take the shot");
    };

    // The intro slides the cue in first; until then it's hidden.
    const ready = () => !root.closest("[data-hero-intro]:not([data-hero-ready])");

    const shoot = async () => {
      if (busy || stage === "done" || !ready()) return;
      busy = true;
      const id = shotId;
      hint?.setAttribute("data-dismissed", "");
      hoverAnim?.stop();
      run(hover, 0, { duration: 0.15 });
      view = measure();

      if (stage === "first") {
        await (reduceRef.current ? firstShotReduced(id) : firstShot(id));
      } else {
        await (reduceRef.current ? secondShotReduced(id) : secondShot(id));
      }
      if (id !== shotId) return;

      running.length = 0;
      busy = false;
      setFinished(isDone());
    };

    const stopAll = () => {
      shotId += 1;
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      rolls.clear();
      stopWatch?.();
      stopWatch = null;
      running.forEach((c) => c.stop());
      running.length = 0;
      hoverAnim?.stop();
    };
    // Puts everything back in its starting pose. Callers make sure it isn't seen.
    const restorePoses = () => {
      stage = "first";
      shot.jump(0);
      hover.jump(0);
      movingBalls.forEach((ball) => {
        ball.x = ball.spec.x;
        ball.z = ball.spec.z;
        ball.spin = 0;
        ball.spinRate = SPIN_SCALE;
        ball.orient = IDENTITY;
        ball.gone = false;
        if (ball.spot) ball.spot.el.setAttribute("d", ball.spot.rest);
        ball.dark.forEach((el) => el.removeAttribute("d"));
        ball.dark[1].style.removeProperty("fill");
        ball.fill = "";
        for (const el of ballParts(ball)) {
          BALL_VARS.forEach((name) => el.style.removeProperty(name));
          el.style.removeProperty("opacity");
          el.style.removeProperty("visibility");
        }
      });
      cueParts.forEach((el) => CUE_VARS.forEach((name) => el.style.removeProperty(name)));
      whiteClip?.style.removeProperty("--overhang");
      setFinished(false);
    };

    // Runs only while the hero is fully out of view.
    const reset = () => {
      stopAll();
      busy = false;
      restorePoses();
    };

    // The intro's flicker on the table alone, then the cue slides in from the right.
    // The light cuts and the balls go back together, written here in the click's own
    // task: the animation can start a frame late, which would show them jump.
    const rerackFull = async (id: number) => {
      lightEl.style.opacity = String(KEYFRAMES.light[0]);
      dimEl.style.opacity = String(KEYFRAMES.dim[0]);
      restorePoses();
      shot.jump(cueClearance(FIRST_EXIT));

      const flicker = {
        duration: KEYFRAMES.duration,
        times: KEYFRAMES.times,
        ease: "linear",
      } as const;
      const lit = animate(lightEl, { opacity: KEYFRAMES.light }, flicker);
      const dimmed = animate(dimEl, { opacity: KEYFRAMES.dim }, flicker);
      running.push(lit, dimmed);

      await lit;
      if (id !== shotId) return;
      await pause(CUE_PAUSE * 1000);
      if (id !== shotId) return;
      await run(shot, 0, { duration: CUE_ENTER, ease: CUE_ENTER_EASE });
    };

    // Reduced motion: no flicker, as in the intro. The parts cross-fade back.
    // (The cue is already faded out, from the second shot.)
    const rerackReduced = async (id: number) => {
      await fadeBall(white, 1, 0);
      if (id !== shotId) return;
      restorePoses();
      movingBalls.forEach((ball) => setBallOpacity(ball, 0));
      await Promise.all([...movingBalls.map((ball) => fadeBall(ball, 0, 1)), fadeCue(0, 1)]);
    };

    const rerack = async () => {
      if (busy || stage !== "done" || !ready()) return;
      busy = true;
      const id = shotId;
      view = measure();

      await (reduceRef.current ? rerackReduced(id) : rerackFull(id));
      if (id !== shotId) return;

      running.length = 0;
      busy = false;
    };

    const playNext = () => {
      if (isDone()) rerack();
      else shoot();
    };

    // The cue counts too: it can stick out past the felt, and with reduced motion
    // it's left faded out over the table.
    const onTableClick = (e: MouseEvent) => {
      if ((e.target as Element).closest(".table-plane, .table-ball, [data-pool-cue]")) playNext();
    };

    const offscreen = new IntersectionObserver((entries) => {
      if (!entries[entries.length - 1].isIntersecting) reset();
    });
    offscreen.observe(stageEl);

    // Hover springs live outside `running`, which is only cleared after a
    // shot, so hovering without shooting doesn't pile up controls.
    const nudge = (to: number) => {
      if (busy || stage === "done" || !ready()) return;
      hoverAnim?.stop();
      hoverAnim = animate(hover, to, { type: "spring", stiffness: 300, damping: 20 });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      playNext();
    };
    const onEnter = () => nudge(HOVER_NUDGE);
    const onLeave = () => nudge(0);

    // hovering the white ball draws the cue back too
    const hoverParts = [cue, white.el];
    hoverParts.forEach((el) => {
      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointerleave", onLeave);
    });
    cue.addEventListener("keydown", onKey);
    root.addEventListener("click", onTableClick);

    return () => {
      offscreen.disconnect();
      resized.disconnect();
      root.removeEventListener("click", onTableClick);
      stopAll();
      unsubscribe.forEach((u) => u());
      hoverParts.forEach((el) => {
        el.removeEventListener("pointerenter", onEnter);
        el.removeEventListener("pointerleave", onLeave);
      });
      cue.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={scope} className="contents">
      {children}
    </div>
  );
}
