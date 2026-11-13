import { expect, test, type Page } from "@playwright/test";

// The hero blends between its tablet (744) and desktop (1024+) poses with width
// (--u in globals.css), and from tablet to the top-down mobile pose between 744
// and 500 (--t). From 500 down to the mobile frame (390) nothing blends: the
// mobile pose just scales with the width (--m). These are the poses each width
// should land on; 445 and 560 sit between frames, so they only pass if the
// scaling and the blend are continuous. Safari once computed the viewport
// width as 0 and stayed in the mobile pose at every width.
const POSES = [
  { width: 390, scale: 0.5428, squash: 1, sceneTop: 379, textTop: 310 },
  { width: 445, scale: 0.6194, squash: 1, sceneTop: 379, textTop: 310 },
  { width: 500, scale: 0.6959, squash: 1, sceneTop: 379, textTop: 310 },
  { width: 560, scale: 0.7707, squash: 0.9462, sceneTop: 437.2, textTop: 264.26 },
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

test("hero takes its pose for each width", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  for (const { width, scale, squash, sceneTop, textTop } of POSES) {
    await test.step(`at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });

      const actual = await pose(page);
      expect.soft(Math.abs(actual.scale - scale)).toBeLessThanOrEqual(0.01);
      expect.soft(Math.abs(actual.squash - squash)).toBeLessThanOrEqual(0.01);
      expect.soft(Math.abs(actual.sceneTop - sceneTop)).toBeLessThanOrEqual(0.5);
      expect.soft(Math.abs(actual.textTop - textTop)).toBeLessThanOrEqual(0.5);
    });
  }
});

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

test("spotlight cone takes its shape for each width", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  // the intro flickers the light on; measure once it is fully lit
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector("[data-hero-light]")!).opacity === "1",
  );

  for (const { width, wing, coneWidth } of CONES) {
    await test.step(`at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });

      const scales = await page.evaluate(() =>
        Array.from(document.querySelectorAll(".table-cone-wing")).map(
          (el) => new DOMMatrix(getComputedStyle(el).transform).a,
        ),
      );
      expect.soft(scales).toHaveLength(2);
      for (const scale of scales) expect.soft(Math.abs(scale - wing)).toBeLessThanOrEqual(0.01);

      if (coneWidth !== null) {
        expect
          .soft(Math.abs((await coneWidthBelowNav(page, width)) - coneWidth))
          .toBeLessThanOrEqual(3);
      }
    });
  }
});

// From 1280 to 1680 (--hero-frame in globals.css) the table is pinned to the
// hero's right edge, so the eight ball keeps the desktop frame's gap (Figma
// 9026:1631). Below 1280 the table is placed from the center (17.5px at 1024),
// and from 1680 up it is again, so the gap grows by half of any extra width.
const eightBallGap = (page: Page) =>
  page.evaluate(() => {
    const hero = document.querySelector(".hero-fluid")!.getBoundingClientRect();
    const ball = document.querySelector('[data-ball="eight"]')!.getBoundingClientRect();
    return hero.right - ball.right;
  });

const GAPS = [
  { width: 1024, gap: 17.5 },
  { width: 1280, gap: 145.5 },
  { width: 1360, gap: 145.5 },
  { width: 1440, gap: 145.5 },
  { width: 1500, gap: 145.5 },
  { width: 1680, gap: 145.5 },
  { width: 1920, gap: 265.5 },
  { width: 2560, gap: 585.5 },
];

test("eight ball keeps its gap from the right edge at each width", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  for (const { width, gap } of GAPS) {
    await test.step(`${gap}px at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });

      expect.soft(Math.abs((await eightBallGap(page)) - gap)).toBeLessThanOrEqual(1);
    });
  }
});

const tableLeft = (page: Page) =>
  page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".table-scene")!).left));

// Past 1680 the title and the table both sit in the centered hero frame, so
// they stop moving apart: the table's center stays 1151.7px from the title's
// left (1680 - 408.3 - 120) however wide the screen is.
test("table keeps its distance from the hero text from 1680px up", async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.goto("/");

  for (const width of [1680, 1920, 2560, 3040]) {
    await test.step(`at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });

      const text = await page.locator("[data-hero-text]:visible").boundingBox();
      expect.soft(Math.abs((await tableLeft(page)) - text!.x - 1151.7)).toBeLessThanOrEqual(1);
    });
  }
});

test("table doesn't jump where the pin starts and stops", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  for (const widths of [
    [1260, 1270, 1280, 1290, 1300],
    [1420, 1430, 1440, 1450, 1460], // inside the pin, where it used to stop
    [1660, 1670, 1680, 1690, 1700],
  ]) {
    await test.step(`between ${widths[0]}px and ${widths[4]}px`, async () => {
      const lefts: number[] = [];
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        lefts.push(await tableLeft(page));
      }

      // 5px per 10px of width while centered, 10px while pinned
      lefts.slice(1).forEach((left, i) => {
        expect.soft(left - lefts[i]).toBeGreaterThanOrEqual(4.5);
        expect.soft(left - lefts[i]).toBeLessThanOrEqual(10.5);
      });
    });
  }
});

// From 390 to 500 the title sits between the blue ball above it and the white
// ball below it, as in the mobile frame (Figma 9026:2071), where the blue ball
// reaches 18px into the title's box but stays above the letters. 512 is past
// the scaling range, just into the camera tilt (issue #5).
test("title stays between the blue and white balls on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");

  for (const width of [390, 445, 500, 512]) {
    await test.step(`at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });

      const text = (await page.locator("[data-hero-text]:visible").boundingBox())!;
      const blue = (await page.locator('[data-ball="blue"]').boundingBox())!;
      const white = (await page.locator('[data-ball="white"]').boundingBox())!;
      expect.soft(blue.y + blue.height - text.y).toBeLessThanOrEqual(19);
      expect.soft(white.y - (text.y + text.height)).toBeGreaterThanOrEqual(8);
    });
  }
});
