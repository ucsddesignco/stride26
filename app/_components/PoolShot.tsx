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
import { TABLE_RADIUS, blueBall, cueBall, eightBall } from "./TableScene";

// Two shots on a table that carries on past the light. Click the table or the
// cue: the white ball fades out at the left edge, bounces off a wall
// nobody can see, fades back in on the top edge and smacks the blue ball, which
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
// straight on. The exit and entry don't form a true reflection (the cue's heading
// can't reach the balls with a real bank), but they read as one, and nobody can
// see the walls.
const FIRST_EXIT: Point = { x: -0.98439, z: 0.17602 }; // the cue's rest heading, toward the tip
const FIRST_ENTRY = unit(0.906, 0.423);
const FIRST_WALL: Point = { x: -540, z: -120 };
const SECOND_EXIT = unit(0.995, 0.1); // flat enough that the cue clears the desktop text
const SECOND_ENTRY = unit(-0.5, -0.87); // about 120° on the table seen from above; steeper puts the white ball off the felt on a flat camera
const SECOND_WALL: Point = { x: 590, z: 190 };

// One rolling ball's physics, in world px and seconds. Every speed is worked
// backward from GONE_SPEED, so the whole path decelerates like one ball.
const FRICTION = 180; // px/s²
const BOUNCE_KEEP = 0.85; // share of its speed a ball keeps off a wall
const GONE_SPEED = 140; // px/s a struck ball still has as it leaves the light
const EIGHT_GONE_SPEED = 640; // the eight ball is hit much harder, and is still flying as it leaves

// A ball fades over this much of its path, finishing RIM_PAST beyond the rim.
// On a short way in, it's solid by ENTRY_FADE_SHARE of the path, so before contact.
const FADE_BAND = 110;
const RIM_PAST = 15;
const ENTRY_FADE_SHARE = 0.75;

// Cue travel along its axis in ball radii (+ draws back toward the butt). It
// rests TIP_REST radii from the ball's center, aimed 0.32 radii above it, so the
// tip touches the surface TIP_TOUCH radii out (see strike).
const DRAWBACK = 0.75;
const TIP_REST = 2.4205;
const TIP_TOUCH = 0.95;
const FOLLOW_THROUGH = 0.28;
const HOVER_NUDGE = 0.18;
const SQUASH_STRIKE = 1;
const SQUASH_SMACK = 1.6;

// At the tilted angles balls are drawn bigger toward the viewer. This is that
// growth in world px of radius per world px of depth (blue → white in the frame).
const DEPTH_SLOPE = 0.0176;
// cos of the tablet camera's elevation, where the perspective sizing is 1
const COS_TABLET = 0.97347;

const CUE_OFFSCREEN_MARGIN = 40;
const CUE_PARKED_SLIDE = 300; // over 9,000px at any camera, so no resize can bring the cue back
const CUE_ENTER = 1.1;
const CUE_ENTER_EASE = [0.16, 1, 0.3, 1] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.z - a.z);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
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

type BallVar = "--bx" | "--bz" | "--bs" | "--spin" | "--sq";
const BALL_VARS: BallVar[] = ["--bx", "--bz", "--bs", "--spin", "--sq"];
const CUE_VARS = ["--ox", "--oz", "--hx", "--hz", "--hs"];

type BallSpec = typeof cueBall;
type SceneBall = {
  spec: BallSpec;
  el: SVGElement;
  shadow: SVGElement;
  x: number;
  z: number;
  spin: number;
};

type Leg = Point & { v0: number; v1: number; fade: "in" | "out" | "dark" | "solid" };
type Roll = {
  ball: SceneBall;
  legs: Leg[];
  index: number;
  time: number;
  from: Point;
  done: () => void;
};

// Out to the rim, off a wall in the dark, back in from the rim to contact,
// arriving at `contactSpeed`. Worked backward so friction and the bounce's loss
// make one continuous slowdown.
function bankLegs(
  start: Point,
  exit: Point,
  wall: Point,
  entry: Point,
  contact: Point,
  contactSpeed: number,
): Leg[] {
  const atEntry = speedBefore(contactSpeed, distance(entry, contact));
  const offWall = speedBefore(atEntry, distance(wall, entry));
  const atWall = offWall / BOUNCE_KEEP;
  const atExit = speedBefore(atWall, distance(exit, wall));
  const atStart = speedBefore(atExit, distance(start, exit));
  return [
    { ...exit, v0: atStart, v1: atExit, fade: "out" },
    { ...wall, v0: atExit, v1: atWall, fade: "dark" },
    { ...entry, v0: offWall, v1: atEntry, fade: "dark" },
    { ...contact, v0: atEntry, v1: contactSpeed, fade: "in" },
  ];
}

const legOpacity = (fade: Leg["fade"], travelled: number, length: number) => {
  if (fade === "dark") return 0;
  if (fade === "solid") return 1;
  if (fade === "out") return smoothstep((length - travelled) / Math.min(FADE_BAND, length));
  return smoothstep(travelled / Math.min(FADE_BAND, length * ENTRY_FADE_SHARE));
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
    const cueShadow = root.querySelector<SVGElement>("[data-hero-cue]:not([data-pool-cue])");
    const tableParts = root.querySelectorAll<SVGElement>(".table-plane, .table-ball");

    const makeBall = (spec: BallSpec): SceneBall | null => {
      const el = root.querySelector<SVGElement>(`[data-ball="${spec.kind}"]`);
      const shadow = root.querySelector<SVGElement>(`[data-ball-shadow="${spec.kind}"]`);
      return el && shadow ? { spec, el, shadow, x: spec.x, z: spec.z, spin: 0 } : null;
    };
    const white = makeBall(cueBall);
    const blue = makeBall(blueBall);
    const eight = makeBall(eightBall);
    if (!white || !blue || !eight) return;
    const movingBalls = [white, blue, eight];

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
      const controls = animate(value, to, options);
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
      ball.shadow.style.setProperty(name, String(v));
    };
    const setBallOpacity = (ball: SceneBall, v: number) => {
      ball.el.style.opacity = String(v);
      ball.shadow.style.opacity = String(v);
    };

    const placeBall = ({ x, z }: Point, ball: SceneBall) => {
      const radius = radiusAt(ball.spec, z);
      const rolled = Math.hypot(x - ball.x, z - ball.z);
      ball.spin += (Math.sign(x - ball.x) || 1) * (rolled / radius) * (180 / Math.PI);
      ball.x = x;
      ball.z = z;
      setBall(ball, "--bx", x - ball.spec.x);
      setBall(ball, "--bz", z - ball.spec.z);
      setBall(ball, "--bs", radius / baseRadius(ball.spec));
      setBall(ball, "--spin", ball.spin);
    };

    const putAway = (ball: SceneBall) => {
      ball.el.style.visibility = "hidden";
      ball.shadow.style.visibility = "hidden";
    };

    const advance = (roll: Roll, dt: number) => {
      roll.time += dt;
      for (;;) {
        const leg = roll.legs[roll.index];
        const length = distance(roll.from, leg);
        const duration = (2 * length) / (leg.v0 + leg.v1);
        if (roll.time < duration) {
          const t = roll.time;
          const s = leg.v0 * t + ((leg.v1 - leg.v0) / (2 * duration)) * t * t;
          const f = s / length;
          placeBall(
            { x: roll.from.x + (leg.x - roll.from.x) * f, z: roll.from.z + (leg.z - roll.from.z) * f },
            roll.ball,
          );
          setBallOpacity(roll.ball, legOpacity(leg.fade, s, length));
          return;
        }
        roll.time -= duration;
        roll.from = { x: leg.x, z: leg.z };
        roll.index += 1;
        if (roll.index === roll.legs.length) {
          placeBall(roll.from, roll.ball);
          setBallOpacity(roll.ball, legOpacity(leg.fade, length, length));
          rolls.delete(roll);
          roll.done();
          return;
        }
      }
    };

    // One loop for every rolling ball, running only while one is.
    const tick = (now: number) => {
      const dt = Math.min((now - lastFrame) / 1000, 1 / 30);
      lastFrame = now;
      rolls.forEach((roll) => advance(roll, dt));
      raf = rolls.size > 0 ? requestAnimationFrame(tick) : null;
    };

    const roll = (ball: SceneBall, legs: Leg[]) =>
      new Promise<void>((done) => {
        rolls.add({ ball, legs, index: 0, time: 0, from: { x: ball.x, z: ball.z }, done });
        if (raf === null) {
          lastFrame = performance.now();
          raf = requestAnimationFrame(tick);
        }
      });

    const squash = (ball: SceneBall, amount: number) =>
      tween(0, [0, amount, 0], { duration: 0.14, times: [0, 0.5, 1] }, (q) =>
        setBall(ball, "--sq", q),
      );

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
      await sleep(90);
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
      await sleep(180);
      return id === shotId;
    };

    // The cue strikes and the white ball banks round through the dark into `target`.
    // `target` rolls on along the same line out of the light, still at `goneSpeed` as
    // it leaves, and the white ball follows slowly, stopping on the spot `target` left.
    // `settled` resolves with both balls at rest, or early if `id` goes stale.
    const bankShot = (
      id: number,
      target: SceneBall,
      exitDir: Point,
      entryDir: Point,
      wall: Point,
      goneSpeed: number,
    ) => {
      const contact = contactPoint(target, entryDir);
      const targetEnd = rayToRadius(target, entryDir, TABLE_RADIUS + RIM_PAST);
      const contactSpeed = speedBefore(goneSpeed, distance(target, targetEnd));
      const legs = bankLegs(
        { x: white.x, z: white.z },
        rayToRadius(white, exitDir, TABLE_RADIUS + RIM_PAST),
        wall,
        rayToRadius(contact, opposite(entryDir), TABLE_RADIUS + RIM_PAST),
        contact,
        contactSpeed,
      );

      let settled: Promise<void> = Promise.resolve();
      const struck = strike(id, () => {
        squash(white, SQUASH_STRIKE);
        settled = (async () => {
          await roll(white, legs);
          if (id !== shotId) return;
          squash(white, SQUASH_SMACK);
          squash(target, SQUASH_SMACK);
          const { x, z } = target.spec;
          const follow = speedBefore(0, distance(contact, target.spec));
          await Promise.all([
            roll(target, [{ ...targetEnd, v0: contactSpeed, v1: goneSpeed, fade: "out" }]),
            roll(white, [{ x, z, v0: follow, v1: 0, fade: "solid" }]),
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
      // up here its shadow falls past the back rim, leaving only a speck on the felt
      if (cueShadow) cueShadow.style.visibility = "hidden";
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
      const { struck, settled } = bankShot(id, blue, FIRST_EXIT, FIRST_ENTRY, FIRST_WALL, GONE_SPEED);
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
        SECOND_WALL,
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
        for (const el of [ball.el, ball.shadow]) {
          BALL_VARS.forEach((name) => el.style.removeProperty(name));
          el.style.removeProperty("opacity");
          el.style.removeProperty("visibility");
        }
      });
      cueParts.forEach((el) => CUE_VARS.forEach((name) => el.style.removeProperty(name)));
      cueShadow?.style.removeProperty("visibility");
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
      await sleep(CUE_PAUSE * 1000);
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

    cue.addEventListener("pointerenter", onEnter);
    cue.addEventListener("pointerleave", onLeave);
    cue.addEventListener("keydown", onKey);
    root.addEventListener("click", onTableClick);

    return () => {
      offscreen.disconnect();
      root.removeEventListener("click", onTableClick);
      stopAll();
      unsubscribe.forEach((u) => u());
      cue.removeEventListener("pointerenter", onEnter);
      cue.removeEventListener("pointerleave", onLeave);
      cue.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={scope} className="contents">
      {children}
    </div>
  );
}
