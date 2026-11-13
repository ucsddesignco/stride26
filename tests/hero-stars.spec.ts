import { expect, test } from "@playwright/test";

// The hero's stars pulse: each one shrinks to 80% of its size and grows back,
// on its own period and start offset so they don't pulse together.
test("stars pulse down to 80% size, out of step with each other", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const twinkles = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => (a as CSSAnimation).animationName === "star-twinkle")
      // only the stars shown at this width; the other breakpoints' are display:none
      .filter((a) => ((a.effect as KeyframeEffect).target as HTMLElement).offsetParent !== null)
      .map((a) => {
        const effect = a.effect as KeyframeEffect;
        const timing = effect.getTiming();
        return {
          scales: effect.getKeyframes().map((k) => String(k.scale)),
          direction: timing.direction,
          duration: timing.duration,
          delay: timing.delay,
        };
      }),
  );

  expect(twinkles).toHaveLength(5);
  for (const twinkle of twinkles) {
    expect(twinkle.scales).toEqual(["none", "0.8"]); // "none" is full size
    expect(twinkle.direction).toBe("alternate");
  }
  // every star has its own start offset and period
  expect(new Set(twinkles.map((t) => t.delay)).size).toBe(5);
  expect(new Set(twinkles.map((t) => t.duration)).size).toBe(5);
});

// Above 1280 the title holds 120px from the hero frame's left edge instead of
// moving in with the page content, so the stars must not land on the letters.
// The heading's own box is the title block's full 621px, which the yellow
// star's box already crosses at 1280, so this measures the box of the text.
test("desktop stars stay clear of the wordmark", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  for (const width of [1280, 1500, 1680, 1920]) {
    await test.step(`at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 800 });

      const overlaps = await page.evaluate(() => {
        const title = Array.from(document.querySelectorAll("[data-hero-glow-title]")).find(
          (el) => el.getClientRects().length > 0,
        )!;
        const range = document.createRange();
        range.selectNodeContents(title.firstChild!);
        const text = range.getBoundingClientRect();
        // each star's layout box: the spin and pulse are on its children
        return Array.from(document.querySelectorAll<HTMLElement>("[class*='animate-star-spin']"))
          .map((spin) => spin.parentElement!)
          .filter((box) => box.offsetParent !== null)
          .map((box) => box.getBoundingClientRect())
          .filter(
            (star) =>
              star.left < text.right && star.right > text.left && star.top < text.bottom && star.bottom > text.top,
          )
          .map((star) => `star at ${Math.round(star.left)},${Math.round(star.top)}`);
      });
      expect.soft(overlaps).toEqual([]);
    });
  }
});

// The yellow star sits between the wordmark and the cone, beside the
// wordmark's top, at 712, 150 in the star stage at every desktop width
// (.hero-star-gap in globals.css). The stage is the hero frame: a centered
// 1280 at and below 1280, the full width up to 1680, a centered 1680 above.
const YELLOW_STAR = [
  { width: 1024, left: 584, top: 150 },
  { width: 1280, left: 712, top: 150 },
  { width: 1500, left: 712, top: 150 },
  { width: 1680, left: 712, top: 150 },
  { width: 1920, left: 832, top: 150 },
];

test("yellow star sits in the gap between the wordmark and the cone", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  for (const { width, left, top } of YELLOW_STAR) {
    await test.step(`at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 800 });

      const box = (await page.locator(".hero-star-gap").boundingBox())!;
      expect.soft(Math.abs(box.x - left)).toBeLessThanOrEqual(0.5);
      expect.soft(Math.abs(box.y - top)).toBeLessThanOrEqual(0.5);
    });
  }
});
