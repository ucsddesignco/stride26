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
import { TABLE_RADIUS, cueBall } from "./TableScene";

// Click the cue (or the cue ball) to take the shot. TableScene stays a server
// component: this wraps it and drives its CSS variables (see .table-cue and
// .table-ball in globals.css), so the shot follows the camera at every width.
// Inside HeroIntro it waits until the intro has slid the cue in.

// Shot heading on the felt: the cue's horizontal direction, toward the tip.
const DIR_X = -0.98439;
const DIR_Z = 0.17602;

// Cue travel along its axis in ball radii (+ draws back toward the butt).
// The tip touches the ball at CONTACT: it's aimed 0.32 radii above center
// from 2.42 radii out, so it meets the surface 0.95 radii short of that point.
const DRAWBACK = 0.75;
const CONTACT = -1.47;
const FOLLOW_THROUGH = -1.75;
const HOVER_NUDGE = 0.18;

// Ball physics in world px, px/s and px/s².
const V0 = 460;
const FRICTION = 300;
const V_MIN = 220;
const GRAVITY = 2600;
const FALL_DEPTH = 600; // drop below the felt that clears the hero

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type BallVar = "--bx" | "--bz" | "--bh" | "--bs" | "--spin" | "--sq";

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
    const ball = root?.querySelector<SVGElement>("[data-cue-ball]");
    const shadow = root?.querySelector<SVGElement>("[data-cue-ball-shadow]");
    if (!root || !cue || !ball || !shadow) return;
    // the cue and its shadow: the only parts that read --slide
    const cueParts = root.querySelectorAll<SVGElement>("[data-hero-cue]");

    let mounted = true;
    let busy = false;
    let raf: number | null = null;
    const running: AnimationPlaybackControls[] = [];
    let hoverAnim: AnimationPlaybackControls | null = null;

    // cue: shot travel + hover nudge, both along the cue axis
    const shot = motionValue(0);
    const hover = motionValue(0);
    const setSlide = () => {
      const slide = String(shot.get() + hover.get());
      cueParts.forEach((el) => el.style.setProperty("--slide", slide));
    };
    const unsubscribe = [shot.on("change", setSlide), hover.on("change", setSlide)];

    const setBall = (name: BallVar, v: number) => {
      ball.style.setProperty(name, String(v));
      shadow.style.setProperty(name, String(v));
    };
    const setOpacity = (el: SVGElement, v: number) => (el.style.opacity = String(v));

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

    // Roll along the heading with friction, then drop off the rim under gravity.
    const rollBall = () =>
      new Promise<void>((resolve) => {
        let s = 0;
        let v = V0;
        let fallV = 0;
        let drop = 0;
        let falling = false;
        let last = performance.now();

        const tick = (now: number) => {
          const dt = Math.min((now - last) / 1000, 1 / 30);
          last = now;

          if (!falling) v = Math.max(v - FRICTION * dt, V_MIN);
          s += v * dt; // speed carries over the edge; also drives spin
          setBall("--bx", s * DIR_X);
          setBall("--bz", s * DIR_Z);
          setBall("--spin", (-s / cueBall.rTablet) * (180 / Math.PI));

          if (!falling && Math.hypot(cueBall.x + s * DIR_X, cueBall.z + s * DIR_Z) >= TABLE_RADIUS) {
            falling = true;
            // seen top-down a drop doesn't move on screen, so it also shrinks and fades
            tween(1, 0, { duration: 0.2, ease: "easeOut" }, (o) => setOpacity(shadow, o));
            tween(1, 0.6, { duration: 0.45, ease: "easeIn" }, (b) => setBall("--bs", b));
            tween(1, 0, { duration: 0.45, ease: "easeIn" }, (o) => setOpacity(ball, o));
          }
          if (falling) {
            fallV += GRAVITY * dt;
            drop += fallV * dt;
            setBall("--bh", -drop);
          }

          if (drop > FALL_DEPTH) {
            raf = null;
            resolve();
            return;
          }
          raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
      });

    const respawnBall = async () => {
      (["--bx", "--bz", "--bh", "--spin", "--sq"] as const).forEach((name) => setBall(name, 0));
      setBall("--bs", 0.85);
      setOpacity(ball, 0);
      tween(0, 1, { duration: 0.35, ease: "easeOut" }, (o) => setOpacity(shadow, o));
      tween(0, 1, { duration: 0.3, ease: "easeOut" }, (o) => setOpacity(ball, o));
      await tween(0.85, 1, { type: "spring", stiffness: 260, damping: 18 }, (b) => setBall("--bs", b));
    };

    // The intro slides the cue in first; until then it's hidden.
    const ready = () => !root.closest("[data-hero-intro]:not([data-hero-ready])");

    const shoot = async () => {
      if (busy || !ready()) return;
      busy = true;
      run(hover, 0, { duration: 0.15 });

      if (reduceRef.current) {
        await run(shot, -0.25, { duration: 0.12 });
        run(shot, 0, { duration: 0.2 });
        await tween(1, 0, { duration: 0.3 }, (o) => {
          setOpacity(ball, o);
          setOpacity(shadow, o);
        });
        await sleep(400);
        if (!mounted) return;
        await respawnBall();
      } else {
        // drawback + hold
        await run(shot, DRAWBACK, { duration: 0.42, ease: [0.33, 0, 0.2, 1] });
        await sleep(90);
        if (!mounted) return;

        // strike: the ball launches the frame the tip reaches it
        let ballDone: Promise<void> = Promise.resolve();
        let hit = false;
        const stopWatch = shot.on("change", (s) => {
          if (hit || s > CONTACT) return;
          hit = true;
          tween(0, [0, 1, 0], { duration: 0.14, times: [0, 0.5, 1] }, (q) => setBall("--sq", q));
          ballDone = rollBall();
        });
        await run(shot, FOLLOW_THROUGH, { duration: 0.12, ease: [0.55, 0, 1, 0.6] });
        stopWatch();

        // follow-through hold, then the cue eases back to rest
        await sleep(180);
        if (!mounted) return;
        const cueBack = run(shot, 0, { duration: 0.7, ease: [0.4, 0, 0.2, 1] });

        await Promise.all([ballDone, cueBack]);
        await sleep(500);
        if (!mounted) return;
        await respawnBall();
      }

      running.length = 0;
      busy = false;
    };

    // Hover springs live outside `running`, which is only cleared after a
    // shot, so hovering without shooting doesn't pile up controls.
    const nudge = (to: number) => {
      if (busy || !ready()) return;
      hoverAnim?.stop();
      hoverAnim = animate(hover, to, { type: "spring", stiffness: 300, damping: 20 });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      shoot();
    };
    const onEnter = () => nudge(HOVER_NUDGE);
    const onLeave = () => nudge(0);

    for (const el of [cue, ball]) {
      el.addEventListener("click", shoot);
      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointerleave", onLeave);
    }
    cue.addEventListener("keydown", onKey);

    return () => {
      mounted = false;
      if (raf !== null) cancelAnimationFrame(raf);
      running.forEach((c) => c.stop());
      hoverAnim?.stop();
      unsubscribe.forEach((u) => u());
      for (const el of [cue, ball]) {
        el.removeEventListener("click", shoot);
        el.removeEventListener("pointerenter", onEnter);
        el.removeEventListener("pointerleave", onLeave);
      }
      cue.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={scope} className="contents">
      {children}
    </div>
  );
}
