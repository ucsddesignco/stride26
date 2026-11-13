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

// mouse wheel, so real scroll events fire; then wait out the 300ms slide.
// Only for checks that the nav has NOT moved: there is nothing to wait for.
const wheel = async (page: Page, deltaY: number) => {
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(600);
};

// Wheel, then wait until the nav has finished sliding away or back.
const wheelUntilNav = async (page: Page, deltaY: number, state: "hidden" | "shown") => {
  await page.mouse.wheel(0, deltaY);
  if (state === "hidden") {
    await expect.poll(async () => (await navBox(page)).bottom).toBeLessThanOrEqual(0);
  } else {
    await expect.poll(async () => (await navBox(page)).top).toBe(0);
  }
};

test(`nav is ${NAV_HEIGHT}px tall and overlays the hero at every width`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  for (const width of [390, 744, 1280]) {
    await test.step(`at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });

      const nav = await navBox(page);
      expect.soft(nav.top).toBe(0);
      expect.soft(nav.height).toBe(NAV_HEIGHT);

      const heroTop = await page.evaluate(
        () => document.querySelector(".hero-fluid")!.getBoundingClientRect().top,
      );
      expect.soft(heroTop).toBe(0);
    });
  }
});

test("nav hides on scroll down and returns on scroll up", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.mouse.move(640, 450);

  await wheelUntilNav(page, 600, "hidden");
  await wheelUntilNav(page, -100, "shown");
  await wheelUntilNav(page, 300, "hidden");
});

// No scroll event reports a page that is scrolled down before the nav's
// listener exists: a scroll before hydration, a #section link, a reload.
test("nav is hidden when the page starts scrolled down", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/#faq");

  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(NAV_HEIGHT);
  await expect.poll(async () => (await navBox(page)).bottom).toBeLessThanOrEqual(0);

  await wheelUntilNav(page, -100, "shown");
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
