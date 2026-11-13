import { expect, test, type Page } from "@playwright/test";

const heroTextLeft = async (page: Page) => {
  const box = await page.locator("[data-hero-text]:visible").boundingBox();
  return box!.x;
};

// Where the page sections' content starts: their box plus their left padding.
const contentLeft = (page: Page) =>
  page
    .locator("section.max-w-7xl")
    .first()
    .evaluate((el) => el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft));

test("hero text lines up with the page content at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  expect(Math.abs((await heroTextLeft(page)) - (await contentLeft(page)))).toBeLessThanOrEqual(0.5);
});

// Above 1280 the hero is a frame up to 1680px wide (--hero-frame in
// globals.css): the text holds the frame's 120px left margin instead of
// following the page content, and past 1680 the frame is centered.
const FRAME_LEFTS = [
  { width: 1281, left: 120 },
  { width: 1440, left: 120 },
  { width: 1500, left: 120 },
  { width: 1680, left: 120 },
  { width: 1920, left: 240 },
  { width: 2560, left: 560 },
];

test("hero text holds 120px inside the hero frame above 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  for (const { width, left } of FRAME_LEFTS) {
    await test.step(`${left}px at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });

      expect.soft(Math.abs((await heroTextLeft(page)) - left)).toBeLessThanOrEqual(0.5);
    });
  }
});

// Figma's desktop position, up to where the content's edge takes over.
test("hero text keeps its 110px position below the content's edge", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");

  for (const width of [1024, 1260]) {
    await test.step(`at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });

      expect.soft(await heroTextLeft(page)).toBeCloseTo(110, 1);
    });
  }
});

test("hero text doesn't jump where it hands over to the content's edge", async ({ page }) => {
  const positions: number[] = [];
  await page.goto("/");
  for (const width of [1250, 1260, 1270, 1280, 1290]) {
    await page.setViewportSize({ width, height: 900 });
    positions.push(await heroTextLeft(page));
  }

  positions.slice(1).forEach((left, i) => {
    expect(left - positions[i]).toBeGreaterThanOrEqual(0);
    expect(left - positions[i]).toBeLessThanOrEqual(5);
  });
});
