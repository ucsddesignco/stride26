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

// The spotlight cone is the tablet polygon plus two wings that open out with
// --u (globals.css). `wing` is the wings' horizontal scale; `width` is how
// wide the lit cone is in the first row of pixels below the 82px nav bar
// (Figma 9026:2309 at desktop; the polygon alone at tablet).
const CONES = [
  { width: 744, wing: 0, coneWidth: 241.7 },
  { width: 884, wing: 0.5, coneWidth: null },
  { width: 1280, wing: 1, coneWidth: 399.3 },
];

/** Width of the run of lit pixels around the cone's middle, just below the nav. */
const coneWidthBelowNav = async (page: Page, width: number) => {
  // the intro flickers the light on; measure once it is fully lit
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector("[data-hero-light]")!).opacity === "1",
  );
  const row = await page.screenshot({ clip: { x: 0, y: 82, width, height: 1 } });
  return page.evaluate(async (png) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = 1;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, 1);
    const lit = (x: number) => x >= 0 && x < image.width && data[x * 4] > 20;

    // start above the table's center, which the cone always covers
    const scene = document.querySelector(".table-scene")!.getBoundingClientRect();
    const scale = image.width / document.documentElement.clientWidth;
    const middle = Math.round(scene.left * scale);
    let left = middle;
    let right = middle;
    while (lit(left - 1)) left--;
    while (lit(right + 1)) right++;
    return lit(middle) ? (right - left + 1) / scale : 0;
  }, row.toString("base64"));
};

for (const { width, wing, coneWidth } of CONES) {
  test(`spotlight cone takes its shape for ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const scales = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".table-cone-wing")).map(
        (el) => new DOMMatrix(getComputedStyle(el).transform).a,
      ),
    );
    expect(scales).toHaveLength(2);
    for (const scale of scales) expect(Math.abs(scale - wing)).toBeLessThanOrEqual(0.01);

    if (coneWidth !== null) {
      expect(Math.abs((await coneWidthBelowNav(page, width)) - coneWidth)).toBeLessThanOrEqual(3);
    }
  });
}
