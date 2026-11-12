"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  animate as animateValue,
  useAnimate,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "framer-motion";

// Intro timeline for the hero stage, replayed each time it comes back after
// fully leaving the viewport:
// the title fades in with a neon glow, the table light flickers on (as the glow
// fades), then the cue slides in. Targets are marked in Hero and TableScene
// with data-hero-text / -glow-title / -glow-dot / -light / -dim / -cue. Once the cue
// is in, the stage gets data-hero-ready so PoolShot can take the shot.

// Flicker sequence as [duration in ms, light level]. Level 0 is "off".
// Dark gaps shrink (260 → 160 → 90 → 50) before the light catches for good.
const FLICKER: [number, number][] = [
  [120, 0],
  [60, 0.6],
  [260, 0],
  [50, 0.75],
  [160, 0],
  [60, 0.85],
  [90, 0],
  [50, 0.7],
  [50, 0],
];

// Off, the scene shows at OFF_OPACITY and OFF_BRIGHTNESS. Brightness b is a
// black overlay ([data-hero-dim]) at opacity 1 − b: on the black hero that
// matches brightness(b), but opacity stays on the compositor and leaves no
// filter on the scene once the light is on. Initial values live in Hero.
const OFF_OPACITY = 0.08;
const OFF_BRIGHTNESS = 0.3;
const dim = (brightness: number) => 1 - brightness;

const OFF = { light: OFF_OPACITY, dim: dim(OFF_BRIGHTNESS) };
const ON = { light: 1, dim: 0 };

// The cue slides in along its 3D axis via the scene's --slide (in ball
// radii, see .table-cue in globals.css). On screen it runs nearly level, at
// 0.98 of a radius per unit, so this many px of slide clear the viewport.
const CUE_SCREEN_PER_SLIDE = 0.98049;
const CUE_OFFSCREEN_MARGIN = 40;

// The intro starts once this share of the hero is visible, but only resets
// once none of it is. Between the two it holds, so the hero never blanks
// while any of it is still on screen and scrolling near the edge can't
// retrigger it. Ratios are of the hero itself, so this holds at every size.
const START_AMOUNT = 0.3;

const TITLE_PAUSE = 1; // s between title and flicker
export const CUE_PAUSE = 0.5; // s between flicker and cue
const TEXT_FADE = 0.6;
const CUE_SLIDE = 1.1;
const CUE_EASE = [0.16, 1, 0.3, 1] as const;

// Neon glow: on/off pairs keep the same layers so they interpolate. Written
// color-first like computed styles, so a title's resting glow can take the
// first layer (see restGlow).
const titleGlowLayers = (a: number) => [
  `rgba(252,255,242,${0.9 * a}) 0px 0px 4px`,
  `rgba(252,255,242,${0.55 * a}) 0px 0px 12px`,
  `rgba(252,255,242,${0.35 * a}) 0px 0px 32px`,
];
const titleGlow = (a: number) => titleGlowLayers(a).join(", ");
const dotGlow = (a: number) =>
  `drop-shadow(0 0 4px rgba(164,205,249,${0.9 * a})) drop-shadow(0 0 12px rgba(164,205,249,${0.5 * a}))`;
const GLOW_ON = { title: titleGlow(1), dot: dotGlow(1) };
const GLOW_OFF = { title: titleGlow(0), dot: dotGlow(0) };

// The glow a title settles back to: its own single-layer text-shadow (the
// desktop frame has one), padded to the neon glow's layers.
const restGlow = (computed: string) =>
  computed === "none" ? GLOW_OFF.title : [computed, ...titleGlowLayers(0).slice(1)].join(", ");

// Builds keyframes with hard cuts: each level is held for its duration, then
// jumps to the next level over a near-zero interval.
function buildKeyframes() {
  const total = FLICKER.reduce((sum, [ms]) => sum + ms, 0);
  const EPS = 0.001;
  const levels: number[] = [];
  const times: number[] = [];
  let t = 0;
  for (const [ms, level] of FLICKER) {
    levels.push(level, level);
    times.push(t === 0 ? 0 : t / total + EPS, (t + ms) / total);
    t += ms;
  }
  levels.push(1);
  times[times.length - 1] -= EPS;
  times.push(1);

  return {
    light: levels.map((l) => (l === 0 ? OFF_OPACITY : l)),
    dim: levels.map((l) => dim(l === 0 ? OFF_BRIGHTNESS : l)),
    times,
    duration: total / 1000,
  };
}

export const KEYFRAMES = buildKeyframes();
const GLOW_FADE = KEYFRAMES.duration; // fades out alongside the flicker

export default function HeroIntro({ children }: { children: ReactNode }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [inView, setInView] = useState(false);
  const reduce = useReducedMotion();
  const titleRest = useRef(new Map<HTMLElement, string>());

  // One observer, firing only when the ratio crosses 0 or START_AMOUNT (no
  // scroll listeners). Same-value sets don't re-render.
  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        // a quick jump away and back arrives as one batch: the newest entry is the truth
        const entry = entries[entries.length - 1];
        // the reported ratio can land just under the threshold it crossed
        if (entry.isIntersecting && entry.intersectionRatio >= START_AMOUNT - 0.01) setInView(true);
        else if (!entry.isIntersecting) setInView(false);
      },
      { threshold: [0, START_AMOUNT] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scope]);

  useEffect(() => {
    if (!scope.current) return;
    let cancelled = false;
    const running: AnimationPlaybackControls[] = [];
    const track = (controls: AnimationPlaybackControls) => {
      running.push(controls);
      return controls;
    };

    // --slide goes on the cue and its shadow, the only parts that read it, so
    // a frame of the slide doesn't restyle the rest of the scene.
    const cueParts = scope.current.querySelectorAll<SVGElement>("[data-hero-cue]");
    const setSlide = (v: number) => cueParts.forEach((el) => el.style.setProperty("--slide", String(v)));

    // The glow runs per frame in JS (text-shadow isn't compositor-animatable),
    // so only the shown stage gets it; the hidden stages already sit at their
    // resting glow from the reset below.
    const shown = (selector: string) =>
      Array.from(scope.current!.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.getClientRects().length > 0,
      );

    // Read each title's own glow before any inline one replaces it.
    scope.current.querySelectorAll<HTMLElement>("[data-hero-glow-title]").forEach((el) => {
      if (!titleRest.current.has(el)) {
        titleRest.current.set(el, restGlow(getComputedStyle(el).textShadow));
      }
    });
    const glowTitleOff = (
      options: { duration: number; delay?: number; ease?: "easeInOut" },
      only?: HTMLElement[],
    ) =>
      titleRest.current.forEach((rest, el) => {
        if (!only || only.includes(el)) track(animate(el, { textShadow: rest }, options));
      });

    const stage = scope.current;
    const setReady = (ready: boolean) => stage.toggleAttribute("data-hero-ready", ready);

    if (!inView) {
      setReady(false);
      animate("[data-hero-light]", { opacity: OFF.light }, { duration: 0 });
      animate("[data-hero-dim]", { opacity: OFF.dim }, { duration: 0 });
      animate("[data-hero-text]", { opacity: 0 }, { duration: 0 });
      animate("[data-hero-cue]", { opacity: 0 }, { duration: 0 });
      glowTitleOff({ duration: 0 });
      animate("[data-hero-glow-dot]", { filter: GLOW_OFF.dot }, { duration: 0 });
    } else if (reduce) {
      animate("[data-hero-light]", { opacity: ON.light }, { duration: 0 });
      animate("[data-hero-dim]", { opacity: ON.dim }, { duration: 0 });
      setSlide(0);
      animate("[data-hero-cue]", { opacity: 1 }, { duration: 0 });
      setReady(true);
      track(animate("[data-hero-text]", { opacity: 1 }, { duration: 0.3 }));
    } else {
      (async () => {
        // 1. title fades in, glow ramps up with it
        const titles = shown("[data-hero-glow-title]");
        const dots = shown("[data-hero-glow-dot]");
        const fadeIn = { duration: TEXT_FADE, ease: "easeOut" } as const;
        if (titles.length) track(animate(titles, { textShadow: GLOW_ON.title }, fadeIn));
        if (dots.length) track(animate(dots, { filter: GLOW_ON.dot }, fadeIn));
        await track(animate("[data-hero-text]", { opacity: 1 }, fadeIn));
        if (cancelled) return;

        // 2. pause, then the light flickers on while the glow fades out
        const fadeOut = { delay: TITLE_PAUSE, duration: GLOW_FADE, ease: "easeInOut" } as const;
        glowTitleOff(fadeOut, titles);
        if (dots.length) track(animate(dots, { filter: GLOW_OFF.dot }, fadeOut));
        const flicker = {
          delay: TITLE_PAUSE,
          duration: KEYFRAMES.duration,
          times: KEYFRAMES.times,
          ease: "linear",
        } as const;
        track(animate("[data-hero-dim]", { opacity: KEYFRAMES.dim }, flicker));
        await track(animate("[data-hero-light]", { opacity: KEYFRAMES.light }, flicker));
        if (cancelled || !scope.current) return;

        // 3. pause, then the cue slides in

        // Start the cue's tip just past the viewport's right edge, back along
        // its axis. The cue ball's on-screen width gives px per radius.
        const cue = scope.current.querySelector(".table-cue");
        const ball = scope.current.querySelector('[data-ball="white"]');
        if (!cue || !ball) return;
        setSlide(0);
        const pxPerRadius = ball.getBoundingClientRect().width / 2;
        const dx = window.innerWidth - cue.getBoundingClientRect().left + CUE_OFFSCREEN_MARGIN;
        const transition = { delay: CUE_PAUSE, duration: CUE_SLIDE, ease: CUE_EASE };
        const offscreen = dx / (pxPerRadius * CUE_SCREEN_PER_SLIDE);
        setSlide(offscreen);
        // Explicit start keyframes: the cue stays hidden through the delay,
        // then appears off-screen and slides to rest.
        track(animate("[data-hero-cue]", { opacity: [1, 1] }, transition));
        await track(animateValue(offscreen, 0, { ...transition, onUpdate: setSlide }));
        if (!cancelled) setReady(true);
      })();
    }

    return () => {
      cancelled = true;
      running.forEach((c) => c.stop());
    };
  }, [inView, reduce, animate, scope]);

  return (
    <div ref={scope} data-hero-intro className="absolute inset-0">
      {children}
    </div>
  );
}
