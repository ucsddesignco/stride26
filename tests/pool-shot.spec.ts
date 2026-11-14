import { expect, test, type Page } from "@playwright/test";

// The two pool shots, checked frame by frame against the "done when" list for
// fix/zach/pool-animation (Plan.md), at 1280, 744 and 390 wide. Each test plays
// both shots with an in-page recorder that reads every ball once a frame:
// where it is on the table, how it's drawn on screen, how much of it the lamp
// lights, and how much of it actually shows (hit-testing respects the clip
// paths, so a point clipped at the front rim doesn't count as showing).
//
// Values copied from PoolShot.tsx; each test says what it uses them for.
const OFF_TABLE_PAST = 86; // world px past the rim where a ball waits or ends off the table
const SHADOW_MARGIN = 2; // world px the white ball's shadow is past the rim while it waits
const OFF_TABLE_TIME = 800; // ms the white ball waits off the table on each shot
const SECOND_CUT = 6; // degrees the eight ball leaves off the white ball's line in
const CLEARANCE = 20; // screen px the white ball rests clear of the yellow ball, the hint and the rim
const WIDTHS = [1280, 744, 390];

type Kind = "blue" | "white" | "eight";
const KINDS: Kind[] = ["blue", "white", "eight"];

type BallFrame = {
  x: number; // where it touches the felt, world px
  z: number;
  bs: number; // --bs, the drawn size for its depth
  past: number; // world px its center is past the rim (− on the table)
  hidden: boolean;
  opacity: number; // the lowest of the ball's and its two twins' own opacity
  rect: [number, number, number, number]; // the drawn circle on screen: x, y, width, height
  shadow: [number, number]; // its shadow's center on the felt, world px
  shadowGap: number; // world px its shadow's nearest point is past the rim (− over the felt)
  spotD: string | null;
  spin: string | null; // the white ball's face transform
  // the rest only while recording in full
  lit?: number; // the fraction of the ball the lamp lights (1 − its dark side's share)
  seen?: number; // sample points across the drawn ball where it shows on screen
  seenLit?: number; // ... and its lit side shows
  spotArea?: number; // the spot's area on the ball's unit circle
  spotCenter?: [number, number];
  spotMax?: number; // the furthest the spot's outline gets from the ball's center (1 = its edge)
  spotOnEdge?: number; // the share of the spot's outline lying on the ball's edge
  cut?: number; // screen px cut off the white ball's bottom, down its middle
  expectedCut?: number; // screen px the point where it touches the felt is past the front rim
};
type Frame = { t: number; shot: number; balls: Record<Kind, BallFrame> };
type RecorderWindow = Window & {
  __poolShotSpeed?: number;
  __poolShot: number;
  __poolRecording: boolean;
  __poolFrames: Frame[];
  __cueStirred: boolean;
  __shotSettled: number;
  __whiteWaiting: number;
};
type Options = { full: boolean; slowWait: number | null; offTablePast: number };

/**
 * Records every ball each frame while __poolRecording is on. With `full`, also
 * how lit the balls are and how much of them shows, which costs a few hundred
 * hit tests a frame. With `slowWait`, the white ball's exit is slowed to that
 * speed once it crosses the rim, so its wait off the table lasts long enough
 * to screenshot (the test puts the speed back).
 */
const record = (page: Page, options: Options) =>
  page.addInitScript((opts: Options) => {
    const w = window as unknown as RecorderWindow & { __poolRecorder?: boolean };
    // a test that records twice adds this script twice: run it once a page
    if (w.__poolRecorder) return;
    w.__poolRecorder = true;
    w.__poolShot = 0;
    w.__poolRecording = false;
    w.__poolFrames = [];
    w.__cueStirred = false;
    w.__shotSettled = 0;
    w.__whiteWaiting = 0;
    const kinds = ["blue", "white", "eight"] as const;

    // sample points on the drawn ball, inside 0.85 of its radius, and on its unit circle
    const onScreen: [number, number][] = [];
    for (let i = -3; i <= 3; i++)
      for (let j = -3; j <= 3; j++)
        if (Math.hypot(i * 0.27, j * 0.27) <= 0.85) onScreen.push([i * 0.27, j * 0.27]);
    const onBall: [number, number][] = [];
    for (let i = -8; i <= 8; i++)
      for (let j = -8; j <= 8; j++) if (Math.hypot(i / 8.5, j / 8.5) < 1) onBall.push([i / 8.5, j / 8.5]);

    const num = (el: Element, name: string) => parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;
    // the topmost of the ball's own elements at a screen point, if it shows there
    const ballAt = (kind: string, x: number, y: number) =>
      document.elementsFromPoint(x, y).find((e) => e.closest(`[data-ball="${kind}"]`)) ?? null;

    const startKey: Record<number, string> = {};
    let prevWhite: { key: string; past: number } | null = null;
    let stillFor = 0;
    let slowed = -1;

    const tick = () => {
      requestAnimationFrame(tick);
      const cue = document.querySelector<SVGElement>("[data-pool-cue]");
      if (!cue) return;
      const slide = parseFloat(cue.style.getPropertyValue("--slide") || "0");
      if (slide !== 0) w.__cueStirred = true;
      if (!w.__poolRecording) return;

      const plane = document.querySelector<SVGGraphicsElement>(".table-plane")!;
      const R = Number(plane.querySelector(":scope > circle")!.getAttribute("r"));
      const P = plane.getScreenCTM()!;
      const toFelt = P.inverse();
      const balls = {} as Record<Kind, BallFrame>;

      for (const kind of kinds) {
        const el = document.querySelector<SVGGraphicsElement>(`[data-ball="${kind}"]`)!;
        const x = num(el, "--x") + num(el, "--bx");
        const z = num(el, "--z") + num(el, "--bz");
        const r = el.querySelector("circle")!.getBoundingClientRect();
        const twins = [el, document.querySelector(`[data-ball-felt="${kind}"]`)!, document.querySelector(`[data-ball-haze="${kind}"]`)!];
        const shadow = document.querySelector<SVGGraphicsElement>(`[data-ball-shadow="${kind}"]`)!;
        const S = toFelt.multiply(shadow.getScreenCTM()!);
        let shadowGap = Infinity;
        for (let i = 0; i < 90; i++) {
          const a = (i * Math.PI) / 45;
          const u = Math.cos(a);
          const v = Math.sin(a);
          shadowGap = Math.min(shadowGap, Math.hypot(S.a * u + S.c * v + S.e, S.b * u + S.d * v + S.f) - R);
        }
        const spotEl = el.querySelector<SVGPathElement>("[data-ball-spot]");
        const spinEl = el.querySelector(".table-ball-spin");
        const f: BallFrame = {
          x,
          z,
          bs: num(el, "--bs") || 1,
          past: Math.hypot(x, z) - R,
          hidden: getComputedStyle(el).visibility === "hidden",
          opacity: Math.min(...twins.map((e) => parseFloat(getComputedStyle(e).opacity))),
          rect: [r.x, r.y, r.width, r.height],
          shadow: [S.e, S.f],
          shadowGap,
          spotD: spotEl?.getAttribute("d") ?? null,
          spin: spinEl ? getComputedStyle(spinEl).transform : null,
        };

        if (opts.full) {
          const dark = el.querySelector<SVGGeometryElement>("[data-ball-dark]");
          if (dark) {
            let inDark = 0;
            for (const [u, v] of onBall) if (dark.isPointInFill(new DOMPoint(u, v))) inDark++;
            f.lit = 1 - inDark / onBall.length;
          }
          const cx = r.x + r.width / 2;
          const cy = r.y + r.height / 2;
          const radius = r.width / 2;
          let seen = 0;
          let seenLit = 0;
          for (const [u, v] of onScreen) {
            const hit = ballAt(kind, cx + u * radius, cy + v * radius);
            if (!hit) continue;
            seen++;
            if (!hit.closest("[data-ball-dark]")) seenLit++;
          }
          f.seen = seen;
          f.seenLit = seenLit;

          if (spotEl) {
            const length = spotEl.getTotalLength();
            if (length < 1e-6) f.spotArea = 0;
            else {
              const points = Array.from({ length: 120 }, (_, i) => spotEl.getPointAtLength((length * i) / 120));
              let area = 0;
              points.forEach((p, i) => {
                const q = points[(i + 1) % points.length];
                area += p.x * q.y - q.x * p.y;
              });
              f.spotArea = Math.abs(area) / 2;
              f.spotCenter = [
                points.reduce((s, p) => s + p.x, 0) / points.length,
                points.reduce((s, p) => s + p.y, 0) / points.length,
              ];
              const reach = points.map((p) => Math.hypot(p.x, p.y));
              f.spotMax = Math.max(...reach);
              f.spotOnEdge = reach.filter((d) => d > 0.995).length / reach.length;
            }
          }

          // How much of the white ball's bottom the front rim cuts off, down the
          // vertical line through its center, and how far the point where it
          // touches the felt is past the rim there.
          if (kind === "white" && !f.hidden && z > 0) {
            const bottom = r.bottom;
            const showsAt = (y: number) => ballAt(kind, cx, y) !== null;
            const touch = new DOMPoint(x, z).matrixTransform(P);
            const rx = R * P.a;
            const ry = R * P.d;
            const onScreenNow = cx > 0 && cx < innerWidth && cy > 0 && bottom < innerHeight;
            if (onScreenNow && Math.abs(touch.x - P.e) < 0.95 * rx && showsAt(cy)) {
              let lo = cy;
              let hi = bottom;
              if (showsAt(bottom - 0.05)) lo = bottom;
              else
                for (let i = 0; i < 16; i++) {
                  const mid = (lo + hi) / 2;
                  if (showsAt(mid)) lo = mid;
                  else hi = mid;
                }
              const rimY = P.f + ry * Math.sqrt(1 - ((touch.x - P.e) / rx) ** 2);
              f.cut = bottom - lo;
              f.expectedCut = Math.max(0, touch.y - rimY);
            }
          }
        }
        balls[kind] = f;
      }

      // Shot bookkeeping: when the white ball has moved this shot and been
      // still for a while with the cue back in, the shot has settled. While it's
      // still off the table, it's waiting.
      const white = balls.white;
      const shot = w.__poolShot;
      const key = `${white.x},${white.z}`;
      startKey[shot] ??= key;
      const moved = prevWhite !== null && prevWhite.key !== key;
      stillFor = moved ? 0 : stillFor + 1;
      if (opts.slowWait && moved && white.past > 0 && white.past > prevWhite!.past && slowed !== shot) {
        slowed = shot;
        w.__poolShotSpeed = opts.slowWait;
      }
      if (!moved && prevWhite && white.past > opts.offTablePast - 1) w.__whiteWaiting = shot;
      const cueIn = slide === 0 && parseFloat(getComputedStyle(cue).opacity) === 1;
      // after the last shot the cue is pulled away for good, so the table being done stands in for it
      const done = cue.getAttribute("aria-label") === "Reset the table";
      if (startKey[shot] !== key && stillFor >= 15 && (cueIn || done) && white.opacity === 1) w.__shotSettled = shot;
      prevWhite = { key, past: white.past };

      w.__poolFrames.push({ t: performance.now(), shot, balls });
    };
    requestAnimationFrame(tick);
  }, options);

const setSpeed = (page: Page, speed: number) =>
  page.evaluate((s) => {
    (window as unknown as RecorderWindow).__poolShotSpeed = s;
  }, speed);

const startRecording = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as RecorderWindow).__poolRecording = true;
  });

const stopRecording = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as RecorderWindow;
    w.__poolRecording = false;
    return w.__poolFrames;
  });

/** Takes shot `shot` with the cue's keyboard action, retrying until the cue moves. */
const takeShot = async (page: Page, shot: number) => {
  await page.evaluate((n) => {
    const w = window as unknown as RecorderWindow;
    w.__poolShot = n;
    w.__cueStirred = false;
  }, shot);
  const cue = page.locator("[data-pool-cue]");
  await expect(async () => {
    await cue.press("Enter");
    await page.waitForFunction(() => (window as unknown as RecorderWindow).__cueStirred, null, { timeout: 600 });
  }).toPass({ timeout: 20_000 });
};

/** Waits until shot `shot` has settled: the white ball at rest and the cue back in (or the table done). */
const shotDone = async (page: Page, shot: number) => {
  if (shot === 2) {
    await expect(page.locator("[data-pool-cue]")).toHaveAttribute("aria-label", "Reset the table", { timeout: 40_000 });
  }
  await page.waitForFunction((n) => (window as unknown as RecorderWindow).__shotSettled === n, shot, {
    timeout: 40_000,
  });
};

const ready = async (page: Page) => {
  await page.locator("[data-hero-ready]").waitFor();
  await page.waitForTimeout(300);
};

type Wait = { shot: number; region: boolean; invisible: boolean; stayed: boolean };

/**
 * During the white ball's wait off the table: screenshots the region around it
 * and its shadow with them shown and hidden. If the two match, no part of
 * either shows anywhere. Then puts the speed back.
 */
const checkWait = async (page: Page, shot: number, speed: number): Promise<Wait> => {
  await page.waitForFunction((n) => (window as unknown as RecorderWindow).__whiteWaiting === n, shot, {
    timeout: 30_000,
  });
  const whereNow = () =>
    page.evaluate(() => {
      const el = document.querySelector<SVGElement>('[data-ball="white"]')!;
      return `${el.style.getPropertyValue("--bx")},${el.style.getPropertyValue("--bz")}`;
    });
  const before = await whereNow();
  const region = await page.evaluate(() => {
    const rects = ['[data-ball="white"] circle', '[data-ball-shadow="white"]'].map((s) =>
      document.querySelector(s)!.getBoundingClientRect(),
    );
    const left = Math.max(0, Math.min(...rects.map((r) => r.left)) - 3);
    const top = Math.max(0, Math.min(...rects.map((r) => r.top)) - 3);
    const right = Math.min(innerWidth, Math.max(...rects.map((r) => r.right)) + 3);
    const bottom = Math.min(innerHeight, Math.max(...rects.map((r) => r.bottom)) + 3);
    return right - left >= 1 && bottom - top >= 1 ? { x: left, y: top, width: right - left, height: bottom - top } : null;
  });
  let invisible = true;
  if (region) {
    const setHidden = (hidden: boolean) =>
      page.evaluate((h) => {
        for (const s of ['[data-ball="white"]', '[data-ball-felt="white"]', '[data-ball-haze="white"]', '[data-ball-shadow="white"]']) {
          const el = document.querySelector<SVGElement>(s)!;
          if (h) {
            el.dataset.testVisibility = el.style.visibility;
            el.style.visibility = "hidden";
          } else el.style.visibility = el.dataset.testVisibility ?? "";
        }
      }, hidden);
    const shown = await page.screenshot({ clip: region, animations: "disabled" });
    await setHidden(true);
    const gone = await page.screenshot({ clip: region, animations: "disabled" });
    await setHidden(false);
    invisible = shown.equals(gone);
  }
  const stayed = (await whereNow()) === before;
  await setSpeed(page, speed);
  return { shot, region: region !== null, invisible, stayed };
};

/** Plays both shots at full motion, recording every frame. */
const playBoth = async (page: Page, { full, speed }: { full: boolean; speed: number }) => {
  await record(page, { full, slowWait: full ? 0.2 : null, offTablePast: OFF_TABLE_PAST });
  await page.goto("/");
  await ready(page);
  await setSpeed(page, speed);
  await startRecording(page);
  const waits: Wait[] = [];
  for (const shot of [1, 2]) {
    await takeShot(page, shot);
    if (full) waits.push(await checkWait(page, shot, speed));
    await shotDone(page, shot);
  }
  await page.waitForTimeout(200);
  return { frames: await stopRecording(page), waits };
};

// ---- geometry

type Vec = { x: number; z: number };
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, z: a.z - b.z });
const len = (a: Vec) => Math.hypot(a.x, a.z);
const norm = (a: Vec): Vec => ({ x: a.x / len(a), z: a.z / len(a) });
const angle = (a: Vec, b: Vec) => {
  const c = (a.x * b.x + a.z * b.z) / (len(a) * len(b));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
};
/** A computed CSS transform ("none" or "matrix(a, b, c, d, e, f)") as its a–d. */
const matrixOf = (transform: string | null) => {
  const [a, b, c, d] = transform?.startsWith("matrix(") ? transform.slice(7, -1).split(",").map(Number) : [1, 0, 0, 1];
  return { a, b, c, d };
};
const at = (f: BallFrame): Vec => ({ x: f.x, z: f.z });
const same = (a: BallFrame, b: BallFrame) => a.x === b.x && a.z === b.z;

/** The parts of one shot: frames, the white ball's wait, its line in, and contact. */
const shotParts = (frames: Frame[], shot: number) => {
  const fs = frames.filter((f) => f.shot === shot);
  const target: Kind = shot === 1 ? "blue" : "eight";
  const start = fs[0];
  const contact = fs.findIndex((f) => !same(f.balls[target], start.balls[target]));
  const waiting = fs
    .map((f, i) => i > 0 && same(f.balls.white, fs[i - 1].balls.white) && f.balls.white.past > OFF_TABLE_PAST - 1)
    .map((held, i) => (held ? i : -1))
    .filter((i) => i >= 0 && i < contact);
  const lastWait = waiting.length ? waiting[waiting.length - 1] : -1;
  return { fs, target, start, contact, waiting, lastWait };
};

// Each test loads its own page, so they can run side by side.
test.describe.configure({ mode: "parallel" });

for (const width of WIDTHS) {
  test(`both shots at ${width}px wide meet the done-when list`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width, height: 900 });
    const { frames, waits } = await playBoth(page, { full: true, speed: 1 });
    expect(frames.length).toBeGreaterThan(100);

    const scene = await page.evaluate(() => {
      const box = (s: string) => {
        const r = document.querySelector(s)!.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      const plane = document.querySelector<SVGGraphicsElement>(".table-plane")!;
      const R = Number(plane.querySelector(":scope > circle")!.getAttribute("r"));
      const P = plane.getScreenCTM()!;
      return {
        yellow: box('[data-ball="yellow"] circle'),
        hint: [box("[data-pool-hint] text"), box("[data-pool-hint] image")],
        rim: { cx: P.e, cy: P.f, rx: R * P.a, ry: R * P.d },
      };
    });

    const shots = [1, 2].map((shot) => shotParts(frames, shot));

    await test.step("a blue or eight ball's spot moves as it rolls, and its far side goes first round the back", () => {
      for (const { fs, target } of shots) {
        const rolling = fs.filter((f) => f.balls[target].spotArea !== undefined);
        const rest = rolling[0].balls[target];
        const restArea = rest.spotArea!;
        const restCenter = rest.spotCenter!;
        const moved = rolling.filter((f) => !same(f.balls[target], rest));
        expect.soft(moved.length, `${target} rolls`).toBeGreaterThan(10);
        const furthest = Math.max(
          ...moved
            .map(({ balls }) => balls[target].spotCenter)
            .filter((c) => c !== undefined)
            .map((c) => Math.hypot(c[0] - restCenter[0], c[1] - restCenter[1])),
        );
        expect.soft(furthest, `${target}'s spot moves`).toBeGreaterThan(0.3);
        expect.soft(Math.max(...moved.map((f) => f.balls[target].spotMax ?? 0)), `${target}'s spot stays on the ball`).toBeLessThan(1.001);
        // partly round the back: some of its outline on the ball's edge, some still in front
        const wrapped = moved.filter(({ balls }) => {
          const b = balls[target];
          return (b.spotOnEdge ?? 0) > 0 && b.spotArea! > 0.05 * restArea && b.spotArea! < 0.95 * restArea;
        });
        expect.soft(wrapped.length, `${target}'s spot wraps round its edge`).toBeGreaterThan(0);
        // when it goes all the way round, only a sliver was left the frame before
        let vanished = 0;
        moved.forEach(({ balls }, i) => {
          if (i === 0) return;
          const before = moved[i - 1].balls[target].spotArea!;
          if (before > 0 && balls[target].spotArea === 0) {
            vanished++;
            expect.soft(before / restArea, `${target}'s spot just before it goes round the back`).toBeLessThan(0.5);
          }
        });
        expect.soft(vanished, `${target}'s spot goes round the back`).toBeGreaterThan(0);
      }
    });

    await test.step("balls never change shape: round on screen, and the white ball's face only rotates", () => {
      let worstRound = 0;
      let worstSpin = 0;
      for (const { balls } of frames) {
        for (const kind of KINDS) worstRound = Math.max(worstRound, Math.abs(balls[kind].rect[2] - balls[kind].rect[3]));
        const m = matrixOf(balls.white.spin);
        worstSpin = Math.max(worstSpin, Math.abs(m.a - m.d), Math.abs(m.b + m.c), Math.abs(m.a * m.a + m.b * m.b - 1));
      }
      expect.soft(worstRound, "drawn width − height, px").toBeLessThan(0.5);
      expect.soft(worstSpin, "the face's transform is a rotation").toBeLessThan(1e-3);
    });

    await test.step("a ball leaving the light goes lit → crescent → dark, and is never hidden while partly lit", () => {
      let darkenings = 0;
      for (const kind of KINDS) {
        frames.forEach((f, i) => {
          if (i === 0) return;
          const now = f.balls[kind];
          const before = frames[i - 1].balls[kind];
          if (now.hidden && !before.hidden) {
            expect.soft(before.seenLit, `${kind}'s lit side shows the frame before it's hidden`).toBe(0);
          }
          // a ball going dark passes through a crescent
          if (before.lit !== undefined && now.lit !== undefined && before.lit >= 0.98 && now.lit < 0.98) {
            const j = frames.slice(i).findIndex((g) => g.balls[kind].lit! <= 0.02 || g.balls[kind].lit! >= 0.98);
            const run = frames.slice(i, j < 0 ? undefined : i + j + 1).map((g) => g.balls[kind].lit!);
            if (run[run.length - 1] <= 0.02) {
              darkenings++;
              expect.soft(run.some((l) => l > 0.1 && l < 0.9), `${kind} shows a crescent going dark`).toBe(true);
            }
          }
        });
      }
      expect.soft(darkenings, "some ball goes dark").toBeGreaterThan(0);
    });

    await test.step("a ball leaving over the front rim is cut at the rim, once the point where it touches the felt reaches it", () => {
      const measured = frames.map((f) => f.balls.white).filter((b) => b.cut !== undefined);
      expect.soft(measured.some((b) => b.expectedCut! > 5), "the white ball crosses the front rim").toBe(true);
      expect.soft(measured.some((b) => b.expectedCut === 0), "the white ball is measured on the felt").toBe(true);
      const worst = Math.max(...measured.map((b) => Math.abs(b.cut! - b.expectedCut!)));
      expect.soft(worst, "px between where the ball is cut and where its touch point is past the rim").toBeLessThan(1.5);
    });

    await test.step("a ball off the table is not visible", () => {
      for (const kind of KINDS) {
        const off = frames.map((f) => f.balls[kind]).filter((b) => b.past >= OFF_TABLE_PAST - 0.5);
        for (const b of off) expect.soft(b.hidden || b.seen === 0, `${kind} ${b.past.toFixed(1)} past the rim shows`).toBe(true);
      }
      for (const w of waits) {
        expect.soft(w.stayed, `the white ball stays put while shot ${w.shot}'s wait is screenshotted`).toBe(true);
        expect.soft(w.invisible, `no part of the white ball or its shadow shows while it waits (shot ${w.shot})`).toBe(true);
      }
    });

    await test.step("while the white ball waits off the table, none of its shadow is on the felt", () => {
      for (const { fs, waiting, contact } of shots) {
        expect.soft(waiting.length, "the white ball waits off the table").toBeGreaterThan(0);
        expect.soft(contact, "the white ball reaches its target").toBeGreaterThan(0);
        for (const i of waiting)
          expect.soft(fs[i].balls.white.shadowGap, "world px the shadow is past the rim").toBeGreaterThanOrEqual(SHADOW_MARGIN - 0.3);
      }
    });

    await test.step("shot 1's blue leaves straight on, and shot 2's eight leaves 6° off the white ball's line in", () => {
      for (const [k, { fs, target, start, contact, lastWait }] of shots.entries()) {
        const entry = fs.slice(lastWait + 1, contact);
        expect.soft(entry.length, `shot ${k + 1}: the white ball rolls in`).toBeGreaterThan(2);
        const lineIn = sub(at(entry[entry.length - 1].balls.white), at(entry[0].balls.white));
        const gone = fs.slice(contact).filter((f) => !f.balls[target].hidden).pop()!;
        const out = sub(at(gone.balls[target]), at(start.balls[target]));
        expect.soft(Math.abs(angle(lineIn, out) - (k === 0 ? 0 : SECOND_CUT)), `shot ${k + 1}: degrees off`).toBeLessThan(0.5);
      }
    });

    await test.step("after contact the white ball leaves along the tangent, then rolls on by the 30° rule", () => {
      for (const [k, { fs, target, start, contact, lastWait }] of shots.entries()) {
        const entry = fs.slice(lastWait + 1, contact);
        const u = norm(sub(at(entry[entry.length - 1].balls.white), at(entry[0].balls.white)));
        const n = norm(sub(at(fs[fs.length - 1].balls[target]), at(start.balls[target])));
        const contactAt = at(fs[contact - 1].balls.white);
        const firstStep = sub(at(fs[contact].balls.white), contactAt);
        const rest = at(fs[fs.length - 1].balls.white);
        const t0 = fs[contact].t;
        const rolling = fs.find((f) => f.t > t0 + 250)!;
        const rollOut = sub(rest, at(rolling.balls.white));
        if (k === 0) {
          // a full hit: it all but stops, then creeps on straight
          const lastIn = len(sub(contactAt, at(fs[contact - 2].balls.white)));
          expect.soft(len(firstStep) / lastIn, "shot 1: speed just after contact / just before").toBeLessThan(0.35);
          expect.soft(angle(sub(rest, contactAt), u), "shot 1: degrees the follow-through is off the line in").toBeLessThan(1);
        } else {
          const along = u.x * n.x + u.z * n.z;
          const tangent = norm({ x: u.x - along * n.x, z: u.z - along * n.z });
          const sin = Math.sqrt(1 - along * along);
          const rollDir = { x: (5 / 7) * sin * tangent.x + (2 / 7) * u.x, z: (5 / 7) * sin * tangent.z + (2 / 7) * u.z };
          expect.soft(angle(firstStep, tangent), "shot 2: degrees the first step is off the tangent").toBeLessThan(25);
          expect.soft(angle(rollOut, rollDir), "shot 2: degrees the roll-out is off the 30° rule").toBeLessThan(1);
        }
      }
    });

    await test.step(`after each shot the white ball rests at least ${CLEARANCE}px clear of the yellow ball, the hint and the rim`, () => {
      const { yellow, hint, rim } = scene;
      const yc = { x: (yellow.left + yellow.right) / 2, y: (yellow.top + yellow.bottom) / 2 };
      const yr = (yellow.right - yellow.left) / 2;
      for (const [k, { fs }] of shots.entries()) {
        const [x, y, w] = fs[fs.length - 1].balls.white.rect;
        const c = { x: x + w / 2, y: y + w / 2 };
        const r = w / 2;
        expect.soft(Math.hypot(c.x - yc.x, c.y - yc.y) - r - yr, `shot ${k + 1}: px from yellow`).toBeGreaterThanOrEqual(CLEARANCE);
        for (const box of hint) {
          const dx = Math.max(box.left - c.x, 0, c.x - box.right);
          const dy = Math.max(box.top - c.y, 0, c.y - box.bottom);
          expect.soft(Math.hypot(dx, dy) - r, `shot ${k + 1}: px from the hint`).toBeGreaterThanOrEqual(CLEARANCE);
        }
        const inside = ((c.x - rim.cx) / rim.rx) ** 2 + ((c.y - rim.cy) / rim.ry) ** 2 < 1;
        let toRim = Infinity;
        for (let i = 0; i < 720; i++) {
          const a = (i * Math.PI) / 360;
          toRim = Math.min(toRim, Math.hypot(rim.cx + rim.rx * Math.cos(a) - c.x, rim.cy + rim.ry * Math.sin(a) - c.y));
        }
        expect.soft(inside, `shot ${k + 1}: the white ball rests on the felt`).toBe(true);
        expect.soft(toRim - r, `shot ${k + 1}: px from the rim`).toBeGreaterThanOrEqual(CLEARANCE);
      }
    });

    await test.step("balls darken rather than fade: their opacity stays 1 throughout", () => {
      for (const kind of KINDS) {
        const lowest = Math.min(...frames.map((f) => f.balls[kind].opacity));
        expect.soft(lowest, `${kind}'s lowest opacity`).toBe(1);
      }
    });

    await test.step("shadows move rigidly with their balls, scaled with them", () => {
      for (const kind of KINDS) {
        const offsets = frames
          .map((f) => f.balls[kind])
          .map((b) => ({ x: (b.shadow[0] - b.x) / b.bs, z: (b.shadow[1] - b.z) / b.bs }));
        const worst = Math.max(...offsets.map((o) => len(sub(o, offsets[0]))));
        expect.soft(worst, `${kind}'s shadow offset change, world px`).toBeLessThan(0.05);
      }
    });
  });
}

// The white ball's exit and entry points are planned from a JS copy of
// .table-ball-shadow's transform (shadowClear in PoolShot). If the copy drifts
// from the CSS, the shadow drawn on the page ends up on the felt (copy too
// small) or the ball goes further than it needs to (copy too big). So while it
// waits, either its shadow is SHADOW_MARGIN past the rim or its center is
// OFF_TABLE_PAST past it, whichever is further. Also checks the wait lasts
// OFF_TABLE_TIME.
for (const width of [390, 560, 744, 1024, 1280, 1680]) {
  test(`at ${width}px the white ball waits ${OFF_TABLE_TIME}ms where the shot planned, its shadow just off the felt`, async ({ page }) => {
    test.setTimeout(90_000);
    const speed = 2;
    await page.setViewportSize({ width, height: 900 });
    const { frames } = await playBoth(page, { full: false, speed });
    for (const shot of [1, 2]) {
      const { fs, waiting } = shotParts(frames, shot);
      expect(waiting.length, `shot ${shot}: the white ball waits off the table`).toBeGreaterThan(3);
      const held = waiting.map((i) => fs[i].balls.white);
      const gap = Math.min(...held.map((b) => b.shadowGap));
      const past = held[0].past;
      expect.soft(gap, `shot ${shot}: world px the shadow is past the rim`).toBeGreaterThanOrEqual(SHADOW_MARGIN - 0.3);
      expect.soft(past, `shot ${shot}: world px the ball is past the rim`).toBeGreaterThanOrEqual(OFF_TABLE_PAST - 0.1);
      expect
        .soft(Math.min(Math.abs(gap - SHADOW_MARGIN), Math.abs(past - OFF_TABLE_PAST)), `shot ${shot}: shadow ${gap.toFixed(2)}, ball ${past.toFixed(2)} past the rim`)
        .toBeLessThan(0.3);
      // from the last frame it moved to the first frame it moves again
      const first = waiting[0];
      const last = waiting[waiting.length - 1];
      const waited = (fs[last + 1].t - fs[first - 1].t) * speed;
      expect.soft(Math.abs(waited - OFF_TABLE_TIME), `shot ${shot}: waited ${waited.toFixed(0)}ms`).toBeLessThan(100);
    }
  });
}

test("resizing mid-shot or after a shot redraws the balls for the new camera", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await record(page, { full: false, slowWait: null, offTablePast: OFF_TABLE_PAST });
  await page.goto("/");
  await ready(page);
  await startRecording(page);

  // Every number a ball's drawing is made of: the spot's and dark side's paths,
  // its size and the white ball's overhang below the rim clip.
  const drawn = () =>
    page.evaluate(async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const numbers = (s: string | null | undefined) => (s ?? "").match(/-?\d+(\.\d+)?(e-?\d+)?/g)?.map(Number) ?? [];
      const out: number[] = [];
      for (const kind of ["blue", "white"]) {
        const el = document.querySelector(`[data-ball="${kind}"]`)!;
        out.push(parseFloat((el as SVGElement).style.getPropertyValue("--bs")) || 1);
        out.push(...numbers(el.querySelector("[data-ball-spot]")?.getAttribute("d")));
        out.push(...numbers(el.querySelector("[data-ball-dark]")?.getAttribute("d")));
      }
      const clip = document.querySelector<SVGElement>("[data-front-clip-white]")!;
      out.push(parseFloat(clip.style.getPropertyValue("--overhang")) || 0);
      return out;
    });
  const near = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.01);

  // Freeze the shot once blue has rolled a little, so it holds still mid-roll.
  await page.evaluate(() => {
    const blue = document.querySelector<SVGElement>('[data-ball="blue"]')!;
    const watch = () => {
      const moved = Math.hypot(
        parseFloat(blue.style.getPropertyValue("--bx")) || 0,
        parseFloat(blue.style.getPropertyValue("--bz")) || 0,
      );
      if (moved > 60) (window as unknown as RecorderWindow).__poolShotSpeed = 1e-6;
      else requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  await takeShot(page, 1);
  await page.waitForFunction(() => (window as unknown as RecorderWindow).__poolShotSpeed === 1e-6, null, {
    timeout: 30_000,
  });

  await test.step("mid-shot", async () => {
    const desktop = await drawn();
    await page.setViewportSize({ width: 744, height: 900 });
    const tablet = await drawn();
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(near(tablet, desktop), "drawn differently for the tablet camera").toBe(false);
    expect(near(await drawn(), desktop), "drawn as before back at 1280").toBe(true);
  });

  await setSpeed(page, 4);
  await shotDone(page, 1);

  await test.step("after a shot", async () => {
    const desktop = await drawn();
    await page.setViewportSize({ width: 390, height: 900 });
    const phone = await drawn();
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(near(phone, desktop), "drawn differently for the phone camera").toBe(false);
    expect(near(await drawn(), desktop), "drawn as before back at 1280").toBe(true);
  });
});

for (const width of WIDTHS) {
  test(`with reduced motion at ${width}px nothing rolls, and the parts cross-fade to where the full shots leave them`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    const full = await playBoth(page, { full: false, speed: 8 });
    const restOf = (frames: Frame[], shot: number) => frames.filter((f) => f.shot === shot).pop()!.balls.white;

    await page.emulateMedia({ reducedMotion: "reduce" });
    const reduced = await playBoth(page, { full: false, speed: 1 });

    for (const shot of [1, 2]) {
      const fs = reduced.frames.filter((f) => f.shot === shot);
      const target: Kind = shot === 1 ? "blue" : "eight";
      for (const kind of ["blue", "eight"] as Kind[]) {
        const spots = new Set(fs.map((f) => f.balls[kind].spotD));
        expect.soft(spots.size, `shot ${shot}: ${kind}'s spot doesn't roll`).toBe(1);
      }
      const spins = new Set(fs.map((f) => f.balls.white.spin));
      expect.soft(spins.size, `shot ${shot}: the white ball's face doesn't turn`).toBe(1);
      const places = new Set(fs.map((f) => `${f.balls.white.x},${f.balls.white.z}`));
      expect.soft(places.size, `shot ${shot}: the white ball jumps rather than rolls`).toBeLessThanOrEqual(2);
      expect.soft(fs.some((f) => f.balls.white.opacity > 0 && f.balls.white.opacity < 1), `shot ${shot}: the white ball cross-fades`).toBe(true);
      expect.soft(fs.some((f) => f.balls[target].opacity > 0 && f.balls[target].opacity < 1), `shot ${shot}: ${target} fades`).toBe(true);
      expect.soft(fs[fs.length - 1].balls[target].hidden, `shot ${shot}: ${target} is gone`).toBe(true);
      const a = restOf(reduced.frames, shot);
      const b = restOf(full.frames, shot);
      expect.soft(Math.hypot(a.x - b.x, a.z - b.z), `shot ${shot}: world px from where the full shot leaves the white ball`).toBeLessThan(0.5);
    }
  });
}
