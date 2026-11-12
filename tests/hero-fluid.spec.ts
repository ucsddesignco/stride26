import { expect, test, type Page } from "@playwright/test";

// The hero blends between its mobile (390), tablet (744) and desktop (1024+)
// poses with width (--t / --u in globals.css). These are the poses each width
// should land on; 560 sits between two frames, so it only passes if the blend
// is continuous. Safari once computed the viewport width as 0 and stayed in
// the mobile pose at every width.
const POSES = [
  { width: 390, scale: 0.5428, squash: 1, sceneTop: 379, textTop: 310 },
  { width: 560, scale: 0.7624, squash: 0.8, sceneTop: 492.67, textTop: 220.68 },
  { width: 744, scale: 1, squash: 0.2288, sceneTop: 615.69, textTop: 124 },
  { width: 1280, scale: 1.0363, squash: 0.2288, sceneTop: 625.58, textTop: 115 },
];

const pose = (page: Page) =>
  page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    const text = Array.from(document.querySelectorAll("[data-hero-text]")).find(
      (el) => el.getClientRects().length > 0,
    )!;
    return {
      scale: new DOMMatrix(style(".table-scene svg").transform).a,
      squash: new DOMMatrix(style(".table-plane").transform).d,
      sceneTop: parseFloat(style(".table-scene").top),
      textTop: parseFloat(getComputedStyle(text).top),
    };
  });

for (const { width, scale, squash, sceneTop, textTop } of POSES) {
  test(`hero takes its pose for ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const actual = await pose(page);
    expect(Math.abs(actual.scale - scale)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(actual.squash - squash)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(actual.sceneTop - sceneTop)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(actual.textTop - textTop)).toBeLessThanOrEqual(0.5);
  });
}
