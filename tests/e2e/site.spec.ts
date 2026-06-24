import { expect, test } from "@playwright/test";

test("gallery lists the St. Margaret design directions", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Design Reviews");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow"
  );
  await expect(
    page.getByRole("heading", {
      name: "Live design directions for community review."
    })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "St. Margaret Redesign" })).toBeVisible();
  await expect(page.getByRole("link", { name: /The Pilgrim's Path/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Come and See/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Gospel to Life/ })).toBeVisible();
});

test("preview validates query params and swaps designs/devices", async ({ page }) => {
  await page.goto("/preview?d=unknown&device=sideways");

  const frame = page.locator("[data-preview-frame]");

  await expect(page.locator("[data-design-title]")).toContainText(
    "Direction A · The Pilgrim's Path"
  );
  await expect(frame).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-popups allow-popups-to-escape-sandbox"
  );
  await expect(frame).not.toHaveAttribute("sandbox", /allow-same-origin/);
  await expect(frame).toHaveAttribute("src", /direction-a\/desktop\.html$/);

  await page.getByRole("button", { name: "B", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("d")).toBe(
    "st-margaret-2026/direction-b"
  );
  await expect(frame).toHaveAttribute("src", /direction-b\/desktop\.html$/);

  await page.getByRole("button", { name: "Mobile" }).click();
  expect(new URL(page.url()).searchParams.get("device")).toBe("mobile");
  await expect(frame).toHaveAttribute("src", /direction-b\/mobile\.html$/);
  await expect(page.locator('button[data-device="mobile"]')).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

test("scaled desktop iframe keeps design links clickable", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/preview?d=st-margaret-2026/direction-a&device=desktop");

  const design = page.frameLocator("[data-preview-frame]");

  await design.getByRole("link", { name: "Where We Meet" }).first().click();
  await expect(design.locator("#where-we-meet")).toBeInViewport();
});

test("raw mobile design has menu and demo form behavior", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/designs/st-margaret-2026/direction-b/mobile.html");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow"
  );

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile menu" })).toBeVisible();
  await page.getByRole("link", { name: "Contact" }).click();
  await expect(page.locator("#contact")).toBeInViewport();

  await page.getByPlaceholder("Your name").fill("Maria");
  await page.getByPlaceholder("Email address").fill("maria@example.com");
  await page
    .getByPlaceholder("Tell us a little about yourself…")
    .fill("I would like to learn more.");
  await page.getByRole("button", { name: /Send/ }).click();

  await expect(
    page.getByText("✓ Thanks! This is a demo site — nothing was actually sent.")
  ).toBeVisible();
});
