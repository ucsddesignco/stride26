import { expect, test, type Page } from "@playwright/test";

// "Click me" beside the smiley ball. It shows once the cue is in, at every
// width, fades out over 0.5s when the first shot is taken and stays gone.
// Hovering the smiley draws the cue back, like hovering the cue.

type PoolWindow = Window & { __poolShotSpeed?: number };

const WIDTHS = [390, 430, 474, 500, 560, 640, 744, 1024, 1280, 1680];

const hintOpacity = (page: Page) =>
  page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector("[data-pool-hint]")!).opacity),
  );

const cueSlide = (page: Page) =>
  page.evaluate(() =>
    parseFloat(
      (document.querySelector("[data-pool-cue]") as SVGElement).style.getPropertyValue("--slide") || "0",
    ),
  );

test.describe.configure({ mode: "parallel" });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("the hint is hidden until the cue is in, then sits clear of the details, cue and ball at every width", async ({ page }) => {
  await page.goto("/");
  expect(await hintOpacity(page)).toBe(0);
  await page.locator("[data-hero-ready]").waitFor();
  await expect.poll(() => hintOpacity(page)).toBe(1);

  for (const width of WIDTHS) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      const found = await page.evaluate(() => {
        const hint = document.querySelector("[data-pool-hint]")!;
        const text = hint.querySelector("text")!.getBoundingClientRect();
        const arrow = hint.querySelector("image")!.getBoundingClientRect();
        // The hint lets the pointer through, so the element under each point of
        // its two boxes is whatever it would be covering. The text's box is
        // taken 3px in at the top, where it is empty above the letters: around
        // 500px that strip lies on the 2px the "DIB 208" link's tap area adds
        // below the link, while the letters are clear of it.
        const covered = new Set<string>();
        for (const box of [text, arrow]) {
          const top = box === text ? box.top + 3 : box.top;
          for (let x = box.left; x <= box.right; x += 2) {
            for (let y = top; y <= box.bottom; y += 2) {
              const under = document.elementFromPoint(x, y);
              if (under?.closest("[data-pool-cue]")) covered.add("cue");
              if (under?.closest('[data-ball="white"]')) covered.add("ball");
              if (under?.closest("a")) covered.add("event link");
            }
          }
        }
        const box = hint.getBoundingClientRect();
        const ball = document.querySelector('[data-ball="white"]')!.getBoundingClientRect();
        return {
          covered: Array.from(covered),
          textLeft: text.left,
          textRight: text.right,
          ballCenter: ball.left + ball.width / 2,
          textHeight: text.height,
          left: box.left,
          right: box.right,
          viewport: window.innerWidth,
        };
      });

      // the text keeps its size: 16px type, whatever the table's scale
      expect.soft(found.textHeight).toBeGreaterThan(14);
      expect.soft(found.textHeight).toBeLessThan(24);
      expect.soft(found.left).toBeGreaterThanOrEqual(0);
      // on phones the text slides right to keep 8px from the screen's edge
      expect.soft(found.textLeft).toBeGreaterThanOrEqual(7.5);
      expect.soft(found.right).toBeLessThanOrEqual(found.viewport);
      expect.soft(found.covered).toEqual([]);
      // the label is on the ball's left, the side away from the cue
      expect.soft(found.textRight).toBeLessThan(found.ballCenter);
    });
  }
});

test("the first click fades the hint out over 0.5s, and it stays gone for the second shot", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as PoolWindow).__poolShotSpeed = 8;
  });
  await page.goto("/");
  await page.locator("[data-hero-ready]").waitFor();
  await expect.poll(() => hintOpacity(page)).toBe(1);

  // sampled in the page, so the timing starts at the click itself
  const [midway, after] = await page.evaluate(async () => {
    const hint = document.querySelector("[data-pool-hint]")!;
    const opacity = () => parseFloat(getComputedStyle(hint).opacity);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('[data-ball="white"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wait(250);
    const midway = opacity();
    await wait(350);
    return [midway, opacity()];
  });
  expect(midway).toBeGreaterThan(0.05);
  expect(midway).toBeLessThan(0.95);
  expect(after).toBe(0);

  // through the second shot and on to a table that can be reset
  const cue = page.locator("[data-pool-cue]");
  await expect(async () => {
    if ((await cue.getAttribute("aria-label")) !== "Reset the table") await cue.press("Enter");
    expect(await hintOpacity(page)).toBe(0);
    await expect(cue).toHaveAttribute("aria-label", "Reset the table", { timeout: 250 });
  }).toPass({ timeout: 20_000 });
  expect(await hintOpacity(page)).toBe(0);
});

test("hovering the smiley draws the cue back, and leaving lets it return", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-hero-ready]").waitFor();

  await page.locator('[data-ball="white"]').hover();
  await expect.poll(() => cueSlide(page)).toBeGreaterThan(0.15);

  await page.mouse.move(5, 300);
  await expect.poll(() => cueSlide(page)).toBeLessThan(0.01);
});

test("the hint fades in over about 0.3s once the cue is in", async ({ page }) => {
  await page.goto("/");
  const samples = await page.evaluate(
    () =>
      new Promise<{ t: number; opacity: number }[]>((resolve) => {
        const hint = document.querySelector("[data-pool-hint]")!;
        const out: { t: number; opacity: number }[] = [];
        let start = 0;
        const tick = () => {
          const ready = document.querySelector("[data-hero-ready]");
          if (ready) {
            start ||= performance.now();
            const t = performance.now() - start;
            out.push({ t, opacity: parseFloat(getComputedStyle(hint).opacity) });
            if (t > 600) return resolve(out);
          }
          requestAnimationFrame(tick);
        };
        tick();
      }),
  );
  // partway at 0.15s, fully in by 0.45s
  const at = (ms: number) => samples.find((s) => s.t >= ms)!.opacity;
  expect(at(150)).toBeGreaterThan(0.05);
  expect(at(150)).toBeLessThan(0.95);
  expect(at(450)).toBe(1);
});

test("a click on the hint reaches the felt and takes the shot", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-hero-ready]").waitFor();
  await expect.poll(() => hintOpacity(page)).toBe(1);

  const box = (await page.locator("[data-pool-hint] text").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => hintOpacity(page)).toBe(0);
});

test("the hint stays gone after a table reset and an intro replay, and hovering the smiley still works on the second shot", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as PoolWindow).__poolShotSpeed = 8;
  });
  await page.goto("/");
  await page.locator("[data-hero-ready]").waitFor();

  const cue = page.locator("[data-pool-cue]");
  await cue.press("Enter");
  await expect.poll(() => hintOpacity(page)).toBe(0);

  // between the shots: the smiley still draws the cue back
  await expect(cue).toHaveAttribute("aria-label", /.+/);
  await expect(async () => {
    await page.locator('[data-ball="white"]').hover();
    expect(await cueSlide(page)).toBeGreaterThan(0.15);
  }).toPass({ timeout: 10_000 });
  await page.mouse.move(5, 300);

  // finish the second shot, then reset the table
  await expect(async () => {
    if ((await cue.getAttribute("aria-label")) !== "Reset the table") await cue.press("Enter");
    await expect(cue).toHaveAttribute("aria-label", "Reset the table", { timeout: 250 });
  }).toPass({ timeout: 20_000 });
  await cue.press("Enter");
  await page.locator("[data-hero-ready]").waitFor();
  await page.waitForTimeout(500);
  expect(await hintOpacity(page)).toBe(0);

  // scroll away and back: the intro replays, the hint stays gone
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator("[data-hero-ready]")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("[data-hero-ready]").waitFor();
  await page.waitForTimeout(500);
  expect(await hintOpacity(page)).toBe(0);
});

// Mobile layout changes made to fit "Click me" (DECISIONS.md, 2026-11-13).
const visibleMobileText = (page: Page) =>
  page.evaluate(() => {
    const block = Array.from(document.querySelectorAll<HTMLElement>("[data-hero-text]")).find(
      (el) => el.getClientRects().length > 0,
    )!;
    const hero = block.closest("section")!.getBoundingClientRect();
    const box = block.getBoundingClientRect();
    const [wordmark, details] = Array.from(block.children).map((c) => c.getBoundingClientRect());
    return { middle: box.top + box.height / 2 - hero.top, gap: details.top - wordmark.bottom };
  });

test("on mobile the text block's middle is at y 302 and the details sit 6px into the wordmark's box", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  const at390 = await visibleMobileText(page);
  expect(Math.abs(at390.middle - 302)).toBeLessThanOrEqual(1);
  expect(Math.abs(at390.gap - -6)).toBeLessThanOrEqual(0.5);

  await page.setViewportSize({ width: 500, height: 900 });
  expect(Math.abs((await visibleMobileText(page)).gap - -6)).toBeLessThanOrEqual(0.5);
});

test("the bottom red mobile star stays inside the hero at every mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  for (const width of [390, 430, 500, 560, 639]) {
    await test.step(`${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      const found = await page.evaluate(() => {
        const stars = Array.from(document.querySelectorAll<HTMLElement>("[class*='animate-star-spin']"))
          .map((spin) => spin.parentElement!)
          .filter((el) => el.getClientRects().length > 0);
        // the two red stars are the smallest; the bottom one is the lower of them
        const sizes = stars.map((s) => s.getBoundingClientRect().width).sort((a, b) => a - b);
        const red = stars
          .filter((s) => s.getBoundingClientRect().width <= sizes[1] + 0.5)
          .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
        const star = red.getBoundingClientRect();
        const hero = red.closest("section")!.getBoundingClientRect();
        return { count: stars.length, star: star.toJSON(), hero: hero.toJSON() };
      });
      expect.soft(found.count).toBe(4);
      expect.soft(found.star.left).toBeGreaterThanOrEqual(found.hero.left);
      expect.soft(found.star.right).toBeLessThanOrEqual(found.hero.right);
      expect.soft(found.star.top).toBeGreaterThanOrEqual(found.hero.top);
      expect.soft(found.star.bottom).toBeLessThanOrEqual(found.hero.bottom);
    });
  }
});
