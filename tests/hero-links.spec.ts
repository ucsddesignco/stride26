import { expect, test, type Locator } from "@playwright/test";

// Both sides of each hero breakpoint (640, 744, 1024), plus the extremes.
const WIDTHS = [320, 390, 639, 640, 743, 744, 1023, 1024, 1280, 1920];
const MIN_HIT_HEIGHT = 24;

const LINKS = [
  { name: /add to calendar/i, href: "/stride-2026.ics" },
  { name: /view in maps/i, href: /^https:\/\/www\.google\.com\/maps\/search\// },
];

// The link's own box or its stretched ::before, whichever is taller.
const hitHeight = (link: Locator) =>
  link.evaluate((el) =>
    Math.max(
      el.getBoundingClientRect().height,
      parseFloat(getComputedStyle(el, "::before").height) || 0,
    ),
  );

// How far the link stretches past its own text and icon.
const emptyWidth = (link: Locator) =>
  link.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return el.getBoundingClientRect().width - range.getBoundingClientRect().width;
  });

for (const width of WIDTHS) {
  test(`hero links are clickable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    for (const { name, href } of LINKS) {
      const link = page.getByRole("link", { name });
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute("href", href);

      // Fails if another element would receive the click.
      await link.click({ trial: true });

      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(await hitHeight(link)).toBeGreaterThanOrEqual(MIN_HIT_HEIGHT);
      expect(await emptyWidth(link)).toBeLessThanOrEqual(1);
    }
  });
}

test("the calendar file is served with the event's start time", async ({ request }) => {
  const response = await request.get("/stride-2026.ics");

  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("DTSTART:20261119T023000Z");
});
