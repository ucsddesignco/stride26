import { expect, test, type Page } from "@playwright/test";

// The hero's table light. It starts off, and 0.3s into the intro it flickers
// on: a first flash at 80% about 0.42s in, then flashes at 75%, 85% and 70%,
// dropping to 40% (not off) between them, and fully on by about 1.14s. The
// table reset after both pool shots flickers the same way from dark.
const FLASHES = [0.8, 0.75, 0.85, 0.7];
const GAP = 0.4;
const OFF = 0.08;

type Sample = { t: number; light: number; text: number };
type HeroWindow = Window & { heroSamples: Sample[] };

/** Records the light's and the visible title's opacity every frame, from the first one. */
const sampleLight = (page: Page) =>
  page.addInitScript(() => {
    const samples: Sample[] = [];
    (window as unknown as HeroWindow).heroSamples = samples;
    const tick = () => {
      const light = document.querySelector("[data-hero-light]");
      const text = Array.from(document.querySelectorAll("[data-hero-text]")).find(
        (el) => el.getClientRects().length > 0,
      );
      if (light && text) {
        samples.push({
          t: performance.now(),
          light: parseFloat(getComputedStyle(light).opacity),
          text: parseFloat(getComputedStyle(text).opacity),
        });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

const samplesOf = (page: Page) => page.evaluate(() => (window as unknown as HeroWindow).heroSamples);
const clearSamples = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as HeroWindow).heroSamples.length = 0;
  });
const lightIs = (page: Page, level: "on" | "off") =>
  page.waitForFunction((on) => {
    const opacity = parseFloat(getComputedStyle(document.querySelector("[data-hero-light]")!).opacity);
    return on ? opacity === 1 : opacity < 0.1;
  }, level === "on");

/**
 * The brightest level of each flash, in order, ending with the light staying
 * on. A flash is a run of frames above the gap level, so a frame caught
 * mid-cut doesn't count as its own flash.
 */
const flashes = (samples: Sample[]) => {
  const first = samples.findIndex((s) => s.light > GAP + 0.02);
  const peaks: number[] = [];
  let peak = 0;
  for (const { light } of samples.slice(first)) {
    if (light > GAP + 0.02) peak = Math.max(peak, light);
    else if (peak) {
      peaks.push(peak);
      peak = 0;
    }
  }
  if (peak) peaks.push(peak);
  return { first, peaks, dimmest: Math.min(...samples.slice(first).map((s) => s.light)) };
};

const expectFlicker = (samples: Sample[]) => {
  const { first, peaks, dimmest } = flashes(samples);
  expect(first).toBeGreaterThan(0);
  expect(peaks).toHaveLength(FLASHES.length + 1);
  [...FLASHES, 1].forEach((level, i) => expect(Math.abs(peaks[i] - level)).toBeLessThanOrEqual(0.02));
  // between flashes the light dips to 40% and no lower
  expect(Math.abs(dimmest - GAP)).toBeLessThanOrEqual(0.02);
  return first;
};

test.beforeEach(async ({ page }) => {
  await sampleLight(page);
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("table light flickers on over the title's fade-in, dipping to 40% between flashes", async ({ page }) => {
  await page.goto("/");
  await lightIs(page, "on");
  const samples = await samplesOf(page);

  const first = expectFlicker(samples);
  for (const { light } of samples.slice(0, first)) expect(light).toBeLessThan(0.1);

  const start = samples.find((s) => s.text > 0)!.t;
  const seconds = (s: Sample) => (s.t - start) / 1000;
  expect(Math.abs(seconds(samples[first]) - 0.42)).toBeLessThanOrEqual(0.25);
  expect(Math.abs(seconds(samples.find((s) => s.light === 1)!) - 1.14)).toBeLessThanOrEqual(0.25);
});

test("leaving mid-flicker turns the light off, and coming back replays the intro", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() =>
    (window as unknown as HeroWindow).heroSamples.some((s) => s.light > 0.1 && s.light < 1),
  );
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await lightIs(page, "off");

  // it stays off: the flicker that was running doesn't carry on off-screen
  await clearSamples(page);
  await page.waitForTimeout(1500);
  for (const { light } of await samplesOf(page)) expect(Math.abs(light - OFF)).toBeLessThanOrEqual(0.01);
  await expect(page.locator("[data-hero-ready]")).toHaveCount(0);

  await clearSamples(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await lightIs(page, "on");
  expectFlicker(await samplesOf(page));
});

test("with reduced motion the light is simply on, with no flicker", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await lightIs(page, "on");
  await page.waitForTimeout(500);

  for (const { light } of await samplesOf(page)) {
    expect(light < 0.1 || light === 1).toBe(true);
  }
});

test("the table reset flickers like the intro, from dark", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await page.waitForSelector("[data-hero-ready]");

  // play both shots: presses during a shot are ignored, and one more press
  // once the table can be reset would reset it
  const cue = page.locator("[data-pool-cue]");
  await expect(async () => {
    if ((await cue.getAttribute("aria-label")) !== "Reset the table") await cue.press("Enter");
    await expect(cue).toHaveAttribute("aria-label", "Reset the table", { timeout: 1000 });
  }).toPass({ timeout: 40_000 });

  await clearSamples(page);
  await cue.press("Enter");
  await page.waitForFunction(() =>
    (window as unknown as HeroWindow).heroSamples.some((s) => s.light < 0.1),
  );
  await lightIs(page, "on");

  const samples = await samplesOf(page);
  expectFlicker(samples.slice(samples.findIndex((s) => s.light < 0.1)));
});
