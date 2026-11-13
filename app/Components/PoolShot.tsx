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
// rolls back in at the top edge and smacks the blue ball, which
// rolls out of the light while the white ball slows and settles on its spot. The
// cue then comes in from the left, and a second click sends the white ball out
// the right edge and back in from the front, into the eight ball, which flies off
// the back edge while the white ball settles on its spot. A further click on the
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

// Where the white ball heads on each shot. Each exit is along the cue, and each
// entry is also the line the struck ball leaves on: a head-on hit sends it
// straight on. There's no wall: off the table the ball waits OFF_TABLE_TIME,
// then is moved to the entry line and rolls in, so the pair reads as a bank.
const FIRST_EXIT: Point = { x: -0.98439, z: 0.17602 }; // the cue's rest heading, toward the tip
const FIRST_ENTRY = unit(0.906, 0.423);
const SECOND_EXIT = unit(0.995, 0.1); // flat enough that the cue clears the desktop text
const SECOND_ENTRY = unit(-0.5, -0.87); // about 120° on the table seen from above; steeper puts the white ball off the felt on a flat camera

// One rolling ball's physics, in world px and seconds. The white ball's speeds
// in are worked backward from GONE_SPEED; its speeds out from its EXIT_SPEED.
const FRICTION = 180; // px/s²
const OFF_TABLE_TIME = 0.8; // s the white ball waits off the table on each shot
const FIRST_EXIT_SPEED = 970; // px/s the white ball still has as it goes off the table
const SECOND_EXIT_SPEED = 1138;
const GONE_SPEED = 140; // px/s a struck ball still has as it leaves the light
const EIGHT_GONE_SPEED = 640; // the eight ball is hit much harder, and is still flying as it leaves

// Balls go dark by leaving the lamp's light (see drawLight), not by fading.
// They turn, are hidden and reappear this far past the rim: more than the
// largest ball's radius (58, top-down) plus the lamp's 12.6 offset from the
// table's center, so every part of the ball is out of the light by then.
const OFF_TABLE_PAST = 80;

// The light cone's slant side, lamp to rim (world px).
const CONE_SIDE = Math.hypot(LAMP_H, TABLE_RADIUS);
// segments in the drawn edge of a ball's light
const EDGE_STEPS = 20;

// Cue travel along its axis in ball radii (+ draws back toward the butt). It
// rests TIP_REST radii from the ball's center, aimed 0.32 radii above it, so the
// tip touches the surface TIP_TOUCH radii out (see strike).
const DRAWBACK = 0.75;
const TIP_REST = 2.4205;
const TIP_TOUCH = 0.95;
const FOLLOW_THROUGH = 0.28;
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

// Where a ray from `from` along the unit `dir` crosses a circle around the table center.
function rayToRadius(from: Point, dir: Point, radius: number): Point {
  const b = from.x * dir.x + from.z * dir.z;
  const c = from.x * from.x + from.z * from.z - radius * radius;
  const s = -b + Math.sqrt(Math.max(0, b * b - c));
  return { x: from.x + dir.x * s, z: from.z + dir.z * s };
}

// The speed a ball needs at the start of a leg to reach `endSpeed` at its end.
const speedBefore = (endSpeed: number, length: number) =>
  Math.sqrt(endSpeed * endSpeed + 2 * FRICTION * length);

type BallVar = "--bx" | "--bz" | "--bs" | "--spin" | "--dsx" | "--dsz";
const BALL_VARS: BallVar[] = ["--bx", "--bz", "--bs", "--spin", "--dsx", "--dsz"];
const CUE_VARS = ["--ox", "--oz", "--hx", "--hz", "--hs"];

// The white ball's face turns flat on the screen rather than rolling, so it never
// rolls out of sight. At the true rate (distance / radius) it whirled like a
// pinwheel; this slows it so it reads as a gentle turn.
const SPIN_SCALE = 0.3;

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
  /** the unlit side: in the ball, and in its haze twin */
  dark: SVGPathElement[];
  x: number;
  z: number;
  /** white only: the flat turn of its face (deg) */
  spin: number;
  /** blue and eight: the ball's 3D orientation, and its off-white spot */
  orient: Mat3;
  spot: { el: SVGCircleElement; u: number; v: number } | null;
};

// One straight roll to (x, z), from v0 to v1 px/s.
type Leg = Point & { v0: number; v1: number };
type Roll = {
  ball: SceneBall;
  leg: Leg;
  time: number;
  from: Point;
  done: () => void;
};

// The part of a ball out of the lamp's light, as a path on its unit circle
// (clipped just past it): "" while it's all lit, null once all you can see is dark.
// The light is a cone from the lamp down to the felt, and over a ball its side
// is near enough a plane, so the edge of the light is where that plane cuts the
// sphere: a circle, which shows as an ellipse, like the moon's terminator.
// Camera (see TableScene): the screen's x and y and the way toward the viewer
// are (1, 0, 0), (0, s, −c) and (0, c, s) in world (x, z, h); this holds
// top-down (c = 0) too. `radius` is the ball's, and its center's height.
function darkSide(x: number, z: number, radius: number, s: number, c: number): string | null {
  const dx = x - LAMP_X;
  const reach = Math.hypot(dx, z);
  // how far the ball's center is outside the cone's side, in radii (− inside)
  const out = ((reach - TABLE_RADIUS * (1 - radius / LAMP_H)) * LAMP_H) / CONE_SIDE / radius;
  if (out <= -1) return "";
  if (out >= 1) return null;
  // The side's outward normal n, in screen axes: (a1, a2) on screen, nv toward
  // the viewer. On the unit sphere a point q is dark when n · q > d.
  const d = -out;
  const rx = reach > 1e-6 ? dx / reach : 1;
  const rz = reach > 1e-6 ? z / reach : 0;
  const nx = (rx * LAMP_H) / CONE_SIDE;
  const nz = (rz * LAMP_H) / CONE_SIDE;
  const nh = TABLE_RADIUS / CONE_SIDE;
  const a1 = nx;
  const a2 = nz * s - nh * c;
  const nv = nz * c + nh * s;
  const A = Math.hypot(a1, a2);
  // Work in a frame turned so the dark side is toward +X on screen.
  const ex = A > 1e-6 ? a1 / A : 1;
  const ey = A > 1e-6 ? a2 / A : 0;
  const pt = (X: number, Y: number) =>
    `${(X * ex - Y * ey).toFixed(4)},${(X * ey + Y * ex).toFixed(4)}`;
  // The edge circle: center d·n, radius rho. At angle θ it shows at
  // (A·d − rho·nv·sin θ, rho·cos θ), and faces the viewer by nv·d + rho·A·sin θ.
  const rho = Math.sqrt(1 - d * d);
  const edge = (θ: number) => pt(A * d - rho * nv * Math.sin(θ), rho * Math.cos(θ));

  if (A > Math.abs(d)) {
    // The edge meets the ball's outline: draw its front half, between the two
    // points where it turns away, then close round the outline's dark side
    // (from outside the circle; the clip trims it to the outline).
    const from = Math.asin(clamp((-nv * d) / (rho * A), -1, 1));
    const reachOutline = Math.acos(clamp(d / A, -1, 1));
    const points: string[] = [];
    for (let i = 0; i <= EDGE_STEPS; i++)
      points.push(edge(from + ((Math.PI - 2 * from) * i) / EDGE_STEPS));
    for (const k of [-1, -0.5, 0, 0.5, 1]) {
      const a = reachOutline * k;
      points.push(pt(2 * Math.cos(a), 2 * Math.sin(a)));
    }
    return `M${points.join("L")}Z`;
  }
  // The edge doesn't reach the outline: it's a whole ellipse on the front, or
  // all on the back, and the outline is all lit (d > 0) or all dark (d < 0).
  const facing = nv * d > 0;
  if (!facing) return d > 0 ? "" : null;
  const ring: string[] = [];
  for (let i = 0; i < 2 * EDGE_STEPS; i++) ring.push(edge((Math.PI * i) / EDGE_STEPS));
  const ellipse = `M${ring.join("L")}Z`;
  return d > 0 ? ellipse : `M-2,-2H2V2H-2Z${ellipse}`;
}

// Where the lamp casts a ball's shadow on the felt, from below its center:
// (P − lamp) · r / (LAMP_H − r) for a ball of radius r on the felt at P.
const castOffset = (x: number, z: number, radius: number): Point => {
  const k = radius / (LAMP_H - radius);
  return { x: (x - LAMP_X) * k, z: z * k };
};

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
      const spotEl = el?.querySelector<SVGCircleElement>("[data-ball-spot]");
      const spot = spotEl ? { el: spotEl, u: spotEl.cx.baseVal.value, v: spotEl.cy.baseVal.value } : null;
      const haze = root.querySelector<SVGElement>(`[data-ball-haze="${spec.kind}"]`);
      const dark = [el, haze].map((g) => g?.querySelector<SVGPathElement>("[data-ball-dark]"));
      if (!el || !shadow || !haze || !dark[0] || !dark[1]) return null;
      return {
        spec,
        el,
        shadow,
        haze,
        dark: dark as SVGPathElement[],
        x: spec.x,
        z: spec.z,
        spin: 0,
        orient: IDENTITY,
        spot,
      };
    };
    const white = makeBall(cueBall);
    const blue = makeBall(blueBall);
    const eight = makeBall(eightBall);
    if (!white || !blue || !eight) return;
    const movingBalls = [white, blue, eight];
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

    const setBall = (ball: SceneBall, name: BallVar, v: number) => {
      ball.el.style.setProperty(name, String(v));
      ball.haze.style.setProperty(name, String(v));
      ball.shadow.style.setProperty(name, String(v));
    };
    // reduced motion only: with full motion, balls go dark by leaving the light
    const setBallOpacity = (ball: SceneBall, v: number) => {
      for (const el of [ball.el, ball.haze, ball.shadow]) el.style.opacity = String(v);
    };

    // Shades the ball's side out of the light. Once all you can see is dark, the
    // ball and its haze twin are hidden instead: they'd look the same, but the
    // ball's edge would show through the dark side's as a faint ring.
    const drawLight = (ball: SceneBall, radius: number) => {
      const s = view.squash;
      const path = darkSide(ball.x, ball.z, radius, s, Math.sqrt(Math.max(0, 1 - s * s)));
      const visibility = path === null ? "hidden" : "";
      ball.el.style.visibility = visibility;
      ball.haze.style.visibility = visibility;
      const d = path ?? "";
      ball.dark.forEach((el) => {
        if (el.getAttribute("d") !== d) el.setAttribute("d", d);
      });
    };

    // Draws a ball's spot where its orientation has rolled it. The spot is a disc
    // on the sphere around the point that, at rest, projects to its art center.
    // On a unit sphere, (x, z, h) shows at (x, z·s − h·c) and faces the camera by
    // z·c + h·s. The disc is drawn as the art's circle moved to the new center and
    // squeezed toward the ball's center by how much it faces the camera compared
    // with at rest, so an unrolled ball is drawn exactly as the art.
    const drawSpot = (ball: SceneBall) => {
      if (!ball.spot) return;
      const { el, u: u0, v: v0 } = ball.spot;
      const s = view.squash;
      const c = Math.sqrt(Math.max(0, 1 - s * s));
      const w0 = Math.sqrt(Math.max(0, 1 - u0 * u0 - v0 * v0));
      const p0 = [u0, v0 * s + w0 * c, -v0 * c + w0 * s];
      const m = ball.orient;
      const [px, pz, ph] = [0, 1, 2].map(
        (r) => m[r * 3] * p0[0] + m[r * 3 + 1] * p0[1] + m[r * 3 + 2] * p0[2],
      );
      const u = px;
      const v = pz * s - ph * c;
      const k = Math.max(0, (pz * c + ph * s) / w0); // 0 once it faces away
      const len = Math.hypot(u, v);
      const nx = len > 1e-6 ? u / len : 1;
      const ny = len > 1e-6 ? v / len : 0;
      const a = 1 + (k - 1) * nx * nx;
      const b = (k - 1) * nx * ny;
      const d = 1 + (k - 1) * ny * ny;
      el.style.setProperty(
        "--spot",
        `matrix(${a}, ${b}, ${b}, ${d}, ${u - a * u0 - b * v0}, ${v - b * u0 - d * v0})`,
      );
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
          ball.orient = mul3(axisAngle(-dz / rolled, dx / rolled, 0, rolled / radius), ball.orient);
        drawSpot(ball);
      } else {
        ball.spin += (Math.sign(dx) || 1) * (rolled / radius) * (180 / Math.PI) * SPIN_SCALE;
        setBall(ball, "--spin", ball.spin);
      }
      ball.x = x;
      ball.z = z;
      setBall(ball, "--bx", x - ball.spec.x);
      setBall(ball, "--bz", z - ball.spec.z);
      setBall(ball, "--bs", radius / baseRadius(ball.spec));
      // the Figma shadow, swung by however far the lamp's has since the rest spot
      const cast = castOffset(x, z, radius);
      const rest = castOffset(ball.spec.x, ball.spec.z, baseRadius(ball.spec));
      setBall(ball, "--dsx", cast.x - rest.x);
      setBall(ball, "--dsz", cast.z - rest.z);
      drawLight(ball, radius);
    };

    const putAway = (ball: SceneBall) => {
      for (const el of [ball.el, ball.haze, ball.shadow]) el.style.visibility = "hidden";
    };

    const advance = (roll: Roll, dt: number) => {
      roll.time += dt;
      const { leg, from } = roll;
      const length = distance(from, leg);
      const duration = (2 * length) / (leg.v0 + leg.v1);
      if (roll.time < duration) {
        const t = roll.time;
        const s = leg.v0 * t + ((leg.v1 - leg.v0) / (2 * duration)) * t * t;
        const f = s / length;
        placeBall({ x: from.x + (leg.x - from.x) * f, z: from.z + (leg.z - from.z) * f }, roll.ball);
        return;
      }
      placeBall(leg, roll.ball);
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

    const roll = (ball: SceneBall, leg: Leg) =>
      new Promise<void>((done) => {
        rolls.add({ ball, leg, time: 0, from: { x: ball.x, z: ball.z }, done });
        if (raf === null) {
          lastFrame = performance.now();
          raf = requestAnimationFrame(tick);
        }
      });

    // Where the white ball touches `target` on its way in along `entryDir`. Balls
    // are drawn round on a squashed table, so they touch when they're this far apart
    // on screen: on a flat camera, depth covers little of it.
    const contactPoint = (target: SceneBall, entryDir: Point): Point => {
      const onScreen = radiusAt(cueBall, target.spec.z) + baseRadius(target.spec);
      const reach = onScreen / Math.hypot(entryDir.x, entryDir.z * view.squash);
      return { x: target.x - entryDir.x * reach, z: target.z - entryDir.z * reach };
    };

    // Draw back, hold, strike. `onHit` fires the frame the tip reaches the ball,
    // which is drawn smaller farther from the viewer, so the tip travels further.
    const strike = async (id: number, onHit: () => void) => {
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
      await run(shot, touch - FOLLOW_THROUGH, { duration: 0.12, ease: [0.55, 0, 1, 0.6] });
      stopWatch?.();
      stopWatch = null;
      if (id !== shotId) return false;

      // follow-through hold
      await pause(180);
      return id === shotId;
    };

    // The cue strikes and the white ball rolls off the table at `exitSpeed`, waits
    // OFF_TABLE_TIME out of sight, then is moved onto the line in and rolls into `target`.
    // `target` rolls on along the same line out of the light, still at `goneSpeed` as
    // it leaves, and the white ball follows slowly, stopping on the spot `target` left.
    // `settled` resolves with both balls at rest, or early if `id` goes stale.
    const bankShot = (
      id: number,
      target: SceneBall,
      exitDir: Point,
      entryDir: Point,
      exitSpeed: number,
      goneSpeed: number,
    ) => {
      const contact = contactPoint(target, entryDir);
      const offTable = TABLE_RADIUS + OFF_TABLE_PAST;
      const exit = rayToRadius(white, exitDir, offTable);
      const entry = rayToRadius(contact, opposite(entryDir), offTable);
      const targetEnd = rayToRadius(target, entryDir, offTable);
      const contactSpeed = speedBefore(goneSpeed, distance(target, targetEnd));
      const entrySpeed = speedBefore(contactSpeed, distance(entry, contact));

      let settled: Promise<void> = Promise.resolve();
      const struck = strike(id, () => {
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
          const { x, z } = target.spec;
          const follow = speedBefore(0, distance(contact, target.spec));
          await Promise.all([
            roll(target, { ...targetEnd, v0: contactSpeed, v1: goneSpeed }),
            roll(white, { x, z, v0: follow, v1: 0 }),
          ]);
          if (id === shotId) putAway(target);
        })();
      });
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
      const { struck, settled } = bankShot(id, blue, FIRST_EXIT, FIRST_ENTRY, FIRST_EXIT_SPEED, GONE_SPEED);
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
        SECOND_EXIT_SPEED,
        EIGHT_GONE_SPEED,
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
      placeBall(blueBall, white);
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
      placeBall(eightBall, white);
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
        ball.orient = IDENTITY;
        ball.spot?.el.style.removeProperty("--spot");
        ball.dark.forEach((el) => el.removeAttribute("d"));
        for (const el of [ball.el, ball.haze, ball.shadow]) {
          BALL_VARS.forEach((name) => el.style.removeProperty(name));
          el.style.removeProperty("opacity");
          el.style.removeProperty("visibility");
        }
      });
      cueParts.forEach((el) => CUE_VARS.forEach((name) => el.style.removeProperty(name)));
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
