import { expect, test } from "@playwright/test";

const rawTemplates = ["direction-a", "direction-b", "direction-c"];

test("gallery lists website templates without review batch metadata", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Websites for Secular Franciscan Fraternities");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index,follow"
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://ofs-demos.endian.dev/"
  );
  await expect(
    page.getByRole("heading", {
      name: "Help people find your fraternity."
    })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "bill@endian.dev" })
  ).toHaveAttribute(
    "href",
    "mailto:bill@endian.dev?subject=OFS%20Community%20Website%20Inquiry"
  );
  await expect(page.getByRole("link", { name: /The Pilgrim's Path/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Come and See/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Gospel to Life/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Current Site/ })).toBeVisible();
  await expect(page.locator(".template-card")).toHaveCount(4);
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

  await page.getByRole("button", { name: "Template D - Current Site" }).click();
  expect(new URL(page.url()).searchParams.get("d")).toBe(
    "st-margaret-2026/current-site"
  );
  await expect(frame).toHaveAttribute("src", /current-site\/index\.html$/);

  await page.getByRole("button", { name: "Mobile" }).click();
  expect(new URL(page.url()).searchParams.get("device")).toBe("mobile");
  await expect(frame).toHaveAttribute("src", /current-site\/index\.html$/);
  await expect(page.locator("[data-frame-shell]")).toHaveAttribute(
    "data-device",
    "mobile"
  );
  await expect(page.locator('button[data-device="mobile"]')).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

test("preview toolbar collapses to free up preview space and remembers it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/preview?d=st-margaret-2026/direction-a&device=mobile");

  const toolbar = page.locator("[data-preview-toolbar]");
  const controls = page.locator("#toolbar-controls");
  const frame = page.locator("[data-preview-frame]");

  await expect(controls).toBeVisible();
  const expandedHeight = (await frame.boundingBox())?.height ?? 0;
  expect(expandedHeight).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Hide menu" }).click();
  await expect(toolbar).toHaveAttribute("data-collapsed", "true");
  await expect(controls).toBeHidden();
  await expect(page.getByRole("button", { name: "Show menu" })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  await expect
    .poll(async () => (await frame.boundingBox())?.height ?? 0)
    .toBeGreaterThan(expandedHeight);

  // Preference survives a reload via localStorage and stays out of the URL.
  await page.reload();
  await expect(toolbar).toHaveAttribute("data-collapsed", "true");
  await expect(controls).toBeHidden();
  expect(new URL(page.url()).searchParams.has("collapsed")).toBe(false);

  await page.getByRole("button", { name: "Show menu" }).click();
  await expect(toolbar).toHaveAttribute("data-collapsed", "false");
  await expect(controls).toBeVisible();
});

test("phone-width preview hides the device toggle and renders full-bleed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  // A stored ?device=mobile preference must not cap + gutter the iframe here.
  await page.goto("/preview?d=st-margaret-2026/direction-a&device=mobile");

  await expect(page.locator(".device-switch")).toBeHidden();

  const shell = page.locator("[data-frame-shell]");
  const frame = page.locator("[data-preview-frame]");
  await expect(shell).toHaveAttribute("data-device", "desktop");

  await expect
    .poll(async () => {
      const shellBox = await shell.boundingBox();
      const frameBox = await frame.boundingBox();
      return Math.abs((frameBox?.width ?? 0) - (shellBox?.width ?? 0));
    })
    .toBeLessThanOrEqual(2);
});

test("tablet-width preview keeps the device toggle", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/preview?d=st-margaret-2026/direction-a&device=desktop");

  await expect(page.locator(".device-switch")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mobile" })).toBeVisible();
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

test("raw templates include embedded Google maps centered on St. Gabriel", async ({ page }) => {
  for (const direction of rawTemplates) {
    await page.goto(`/designs/st-margaret-2026/${direction}/index.html`);

    const map = page.locator(".demo-map-embed");

    await expect(map).toHaveAttribute("src", /google\.com\/maps\/embed/);
    await expect(map).toHaveAttribute(
      "src",
      /St\.%20Gabriel%20the%20Archangel%20Catholic%20Church/
    );
    await expect(map).toHaveAttribute(
      "src",
      /0x80c8cf8dbd7bbb27%3A0x79aa173c20f43d86/
    );
  }

  await page.goto("/designs/st-margaret-2026/current-site/who-we-are/index.html");

  const currentSiteMap = page.locator(".demo-map-embed");

  await expect(currentSiteMap).toHaveAttribute("src", /google\.com\/maps\/embed/);
  await expect(currentSiteMap).toHaveAttribute(
    "src",
    /St\.%20Gabriel%20the%20Archangel%20Catholic%20Church/
  );
  await expect(currentSiteMap).toHaveAttribute(
    "src",
    /0x80c8cf8dbd7bbb27%3A0x79aa173c20f43d86/
  );
});

test("current site template loads through desktop and mobile preview states", async ({ page }) => {
  await page.goto("/preview?d=st-margaret-2026/current-site&device=desktop");

  const frame = page.locator("[data-preview-frame]");
  const template = page.frameLocator("[data-preview-frame]");

  await expect(page.locator("[data-template-title]")).toContainText(
    "Template D · Current Site"
  );
  await expect(frame).toHaveAttribute("src", /current-site\/index\.html$/);
  await expect(
    template.getByRole("heading", {
      name: "WELCOME TO THE ST MARGARET OF CORTONA FRATERNITY"
    })
  ).toBeVisible();

  await template.getByRole("link", { name: "Who We Are" }).click();
  await expect(template.getByRole("heading", { name: "Who We Are" })).toBeVisible();
  await expect(template.locator(".demo-map-embed")).toHaveAttribute(
    "src",
    /google\.com\/maps\/embed/
  );

  await page.getByRole("button", { name: "Mobile" }).click();
  expect(new URL(page.url()).searchParams.get("device")).toBe("mobile");
  await expect(page.locator("[data-frame-shell]")).toHaveAttribute(
    "data-device",
    "mobile"
  );
  await expect(frame).toHaveAttribute("src", /current-site\/index\.html$/);
  await template.getByRole("link", { name: "Get Involved" }).click();
  await expect(
    template.getByRole("heading", {
      name: "Is God Calling You to the Secular Franciscan Order?"
    })
  ).toBeVisible();
  await expect(template.getByRole("heading", { name: "Contact" })).toBeVisible();
});

test("preview shell permits embedded Google map frames", async ({ page }) => {
  await page.goto("/preview?d=st-margaret-2026/direction-c&device=desktop");

  const template = page.frameLocator("[data-preview-frame]");

  await template.locator("#where-we-meet").scrollIntoViewIfNeeded();
  await expect(template.locator(".demo-map-embed")).toHaveAttribute(
    "src",
    /google\.com\/maps\/embed/
  );
  await expect
    .poll(
      () => page.frames().some((frame) => frame.url().includes("google.com/maps/embed")),
      { timeout: 10000 }
    )
    .toBe(true);
});

test("direction b uses real photo-led imagery", async ({ page }) => {
  await page.goto("/designs/st-margaret-2026/direction-b/index.html");

  const heroBackground = await page
    .locator(".hero")
    .evaluate((element) => getComputedStyle(element, "::before").backgroundImage);

  expect(heroBackground).toContain("images.unsplash.com");
  await expect(page.locator(".photo-card img")).toHaveAttribute(
    "src",
    /images\.unsplash\.com/
  );
  await expect(page.locator(".cover img")).toHaveAttribute(
    "src",
    /images\.unsplash\.com/
  );
  await expect(page.getByText("shared table / open hands")).toHaveCount(0);
  await expect(page.getByText("shared table / open hands visual")).toHaveCount(0);
  await expect(page.getByText("Summer 2025 cover")).toHaveCount(0);
});

test("current site template uses local assets and thumbnail", async ({ page, request }) => {
  const assets = [
    "/thumbs/st-margaret-2026/current-site.jpg",
    "/designs/st-margaret-2026/current-site/site.css",
    "/designs/st-margaret-2026/current-site/assets/images/st-margaret-of-cortona.jpg",
    "/designs/st-margaret-2026/current-site/assets/images/wix-page-background.jpg",
    "/designs/st-margaret-2026/current-site/assets/fonts/avenir-lt-w05_35-light.woff2",
    "/designs/st-margaret-2026/current-site/assets/fonts/avenir-lt-w01_35-light1475496.woff2",
    "/designs/st-margaret-2026/current-site/assets/fonts/questrial.woff2"
  ];

  for (const asset of assets) {
    const response = await request.get(asset);
    expect(response.ok(), asset).toBe(true);
  }

  for (const currentSitePage of [
    "index.html",
    "who-we-are/index.html",
    "get-involved/index.html",
    "news/index.html",
    "faq/index.html"
  ]) {
    const response = await request.get(
      `/designs/st-margaret-2026/current-site/${currentSitePage}`
    );
    expect(response.ok(), currentSitePage).toBe(true);
  }

  await page.goto("/designs/st-margaret-2026/current-site/index.html");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow"
  );
  await expect(page.locator(".home-portrait")).toBeVisible();
  await expect(page.locator(".home-portrait")).toHaveAttribute(
    "src",
    /assets\/images\/st-margaret-of-cortona\.jpg/
  );
  await expect(page.getByRole("link", { name: "Who We Are" })).toHaveAttribute(
    "href",
    /who-we-are\/$/
  );

  const backgroundImage = await page.evaluate(
    () => getComputedStyle(document.body).backgroundImage
  );

  expect(backgroundImage).toContain("wix-page-background.jpg");
});

test("raw mobile templates keep sticky CTA bars", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });

  for (const direction of rawTemplates) {
    await page.goto(`/designs/st-margaret-2026/${direction}/index.html`);

    await expect(page.locator("[data-mobile-cta]")).toBeVisible();
    await expect(page.locator("[data-mobile-cta] a")).toBeVisible();
  }
});

test("raw templates keep grouped FAQ reassurance copy", async ({ page }) => {
  for (const direction of rawTemplates) {
    await page.goto(`/designs/st-margaret-2026/${direction}/index.html`);

    await expect(page.getByText("About the Franciscans")).toBeVisible();
    await expect(page.getByText("About joining")).toBeVisible();
    await expect(page.getByText("What's expected of me")).toBeVisible();
    await expect(page.getByText("What if I'm just curious")).toBeVisible();
    await expect(page.getByText("Do I have to wear a habit?")).toBeVisible();
  }
});
