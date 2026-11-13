import { expect, test, type Page } from "@playwright/test";

// The nav bar is fixed over the top of the hero, 82px tall at every width
// (Figma 9026:1632), and uses headroom: it slides away on a downward scroll
// and returns on an upward one.
const NAV_HEIGHT = 82;

const navBox = (page: Page) =>
  page.evaluate(() => {
    const { top, bottom, height } = document.querySelector("nav")!.getBoundingClientRect();
    return { top, bottom, height };
  });

// mouse wheel, so real scroll events fire; then wait out the 300ms slide
const wheel = async (page: Page, deltaY: number) => {
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(600);
};

for (const width of [390, 744, 1280]) {
  test(`nav is ${NAV_HEIGHT}px tall and overlays the hero at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const nav = await navBox(page);
    expect(nav.top).toBe(0);
    expect(nav.height).toBe(NAV_HEIGHT);

    const heroTop = await page.evaluate(
      () => document.querySelector(".hero-fluid")!.getBoundingClientRect().top,
    );
    expect(heroTop).toBe(0);
  });
}

test("nav hides on scroll down and returns on scroll up", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.mouse.move(640, 450);

  await wheel(page, 600);
  expect((await navBox(page)).bottom).toBeLessThanOrEqual(0);

  await wheel(page, -100);
  expect((await navBox(page)).top).toBe(0);

  await wheel(page, 300);
  expect((await navBox(page)).bottom).toBeLessThanOrEqual(0);
});

test("nav stays put within its own height of the top", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.mouse.move(640, 450);

  await wheel(page, 60);
  expect((await navBox(page)).top).toBe(0);
});

test("nav stays visible while the mobile menu is open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.mouse.move(195, 600);

  await wheel(page, 600);
  expect((await navBox(page)).top).toBe(0);
});
