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
