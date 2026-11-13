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

test("hero text lines up with the page content from 1280px up", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  for (const width of [1280, 1281, 1440, 1920, 2560]) {
    await test.step(`at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });

      expect
        .soft(Math.abs((await heroTextLeft(page)) - (await contentLeft(page))))
        .toBeLessThanOrEqual(0.5);
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
