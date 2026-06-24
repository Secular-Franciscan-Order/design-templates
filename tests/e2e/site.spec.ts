import { expect, test } from "@playwright/test";

test("gallery lists website templates without review batch metadata", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Website Templates");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow"
  );
  await expect(
    page.getByRole("heading", {
      name: "Choose a template for your website."
    })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /The Pilgrim's Path/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Come and See/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Gospel to Life/ })).toBeVisible();
  await expect(page.getByText("Ready for review")).toHaveCount(0);
  await expect(page.getByText("June 2026")).toHaveCount(0);
  await expect(page.getByText("3 directions")).toHaveCount(0);
});

test("preview validates query params and swaps templates/devices", async ({ page }) => {
  await page.goto("/preview?d=unknown&device=sideways");

  const frame = page.locator("[data-preview-frame]");

  await expect(page.locator("[data-template-title]")).toContainText(
    "Template A · The Pilgrim's Path"
  );
  await expect(page.getByText("Preview menu")).toBeVisible();
  await expect(frame).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-popups allow-popups-to-escape-sandbox"
  );
  await expect(frame).not.toHaveAttribute("sandbox", /allow-same-origin/);
  await expect(frame).toHaveAttribute("src", /direction-a\/index\.html$/);

  await page.getByRole("button", { name: "Template B - Come and See" }).click();
  expect(new URL(page.url()).searchParams.get("d")).toBe(
    "st-margaret-2026/direction-b"
  );
  await expect(frame).toHaveAttribute("src", /direction-b\/index\.html$/);

  await page.getByRole("button", { name: "Mobile" }).click();
  expect(new URL(page.url()).searchParams.get("device")).toBe("mobile");
  await expect(frame).toHaveAttribute("src", /direction-b\/index\.html$/);
  await expect(page.locator("[data-frame-shell]")).toHaveAttribute(
    "data-device",
    "mobile"
  );
  await expect(page.locator('button[data-device="mobile"]')).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

test("wide desktop preview iframe fills the shell", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/preview?d=st-margaret-2026/direction-a&device=desktop");

  const shellBox = await page.locator("[data-frame-shell]").boundingBox();
  const frameBox = await page.locator("[data-preview-frame]").boundingBox();

  expect(shellBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  expect(Math.abs((frameBox?.width ?? 0) - (shellBox?.width ?? 0))).toBeLessThanOrEqual(2);
});

test("responsive desktop iframe keeps template links clickable", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/preview?d=st-margaret-2026/direction-a&device=desktop");

  const template = page.frameLocator("[data-preview-frame]");

  await template.getByRole("link", { name: "Where We Meet" }).first().click();
  await expect(template.locator("#where-we-meet")).toBeInViewport();
});

test("raw responsive template has menu and demo form behavior", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/designs/st-margaret-2026/direction-b/index.html");

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
    .getByPlaceholder("Tell us a little about yourself...")
    .fill("I would like to learn more.");
  await page.getByRole("button", { name: /Send/ }).click();

  await expect(
    page.getByText("✓ Thanks! This is a demo site — nothing was actually sent.")
  ).toBeVisible();
});
