import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const designs = [
  { slug: "quiet-welcome", name: "Quiet Welcome", heading: "A quieter way to live the Gospel—together.", thumb: "quiet-welcome.jpg" },
  { slug: "pilgrims-path", name: "Pilgrim’s Path", heading: "Peace begins close to home.", thumb: "pilgrims-path.jpg" },
  { slug: "st-margaret-2026/direction-a", name: "Living Tradition", heading: "Is God calling you to the Secular Franciscan Order?", thumb: "st-margaret-2026/direction-a.jpg" },
  { slug: "st-margaret-2026/direction-b", name: "Come and See", heading: "Is God calling you to the Secular Franciscan Order?", thumb: "st-margaret-2026/direction-b.jpg" },
  { slug: "st-margaret-2026/direction-c", name: "Gospel to Life", heading: "From gospel to life, and life to gospel.", thumb: "st-margaret-2026/direction-c.jpg" }
];

test("compact public gallery has five designs, sample disclosure, and contact fallback", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Websites for Secular Franciscan Fraternities");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://ofs-demos.endian.dev/");
  await expect(page.getByRole("heading", { name: "A welcoming website for your fraternity." })).toBeVisible();
  await expect(page.locator(".design-card")).toHaveCount(5);
  await expect(page.locator(".design-card h2")).toHaveText(designs.map((design) => design.name));
  await expect(page.locator(".sample-note")).toContainText("fictional St. Clare Fraternity");
  await expect(page.getByRole("link", { name: "bill@endian.dev" })).toHaveAttribute("href", /^mailto:bill@endian.dev/);
  await expect(page.locator("body")).not.toContainText(/St\. Anthony|St\. Margaret|Current Site|Concept 0[12]/);
  for (const design of designs) expect((await request.get(`/thumbs/${design.thumb}`)).ok()).toBe(true);
  if (!await page.locator("#contact-form").getAttribute("data-turnstile-site-key")) {
    await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
    await expect(page.locator("[data-form-status]")).toContainText("not available yet");
  }
});

for (const design of designs) {
  test(`full demo ${design.name} preserves real content and sample identity`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const response = await page.goto(`/designs/${design.slug}/index.html`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: design.heading })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
    await expect(page.locator("body")).toContainText("St. Clare Fraternity");
    await expect(page.locator("body")).toContainText("Cedar Grove");
    await expect(page.locator("body")).toContainText("2–4 pm");
    await expect(page.locator("body")).toContainText("St. Mary Parish Hall");
    await expect(page.locator("body")).not.toContainText(/Margaret|Cortona|Anthony|Tucson|Benjamin|Las Vegas|St\. Gabriel/);
    expect(await page.locator("body").evaluate((body) => body.scrollHeight)).toBeGreaterThan(1400);
    if (design.slug === "quiet-welcome") await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(5);
    else await expect(page.locator("details")).toHaveCount(design.slug === "pilgrims-path" ? 5 : design.slug.endsWith("direction-b") ? 8 : 9);
    // This explicit opt-in is the sole thumbnail capture path; normal smoke tests never modify assets.
    if (process.env.UPDATE_THUMBNAILS === "1") {
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(() => page.locator('img:not([loading="lazy"])').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
      await page.screenshot({ path: resolve("public/thumbs", design.thumb), type: "jpeg", quality: 78, animations: "disabled" });
    }
  });
}

test("preview offers finite previous/next, canonical URLs, history, and persistent return", async ({ page }) => {
  await page.goto("/preview?d=unknown&device=mobile");
  const frame = page.locator("[data-preview-frame]");
  const previous = page.getByRole("button", { name: "← Previous" });
  const next = page.getByRole("button", { name: "Next →" });
  const expectRenderedDesign = async (index: number) => {
    const demo = page.frameLocator("[data-preview-frame]");
    await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox");
    await expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    await expect(page.locator("[data-template-title]")).toHaveText(designs[index].name);
    await expect(page.locator("[data-design-number]")).toHaveText(`Design ${index + 1} of 5`);
    expect(new URL(page.url()).searchParams.get("d")).toBe(designs[index].slug);
    await expect(demo.getByRole("heading", { level: 1, name: designs[index].heading })).toBeVisible();
    await expect.poll(() => demo.locator("body").evaluate(() => location.pathname)).toBe(`/designs/${designs[index].slug}/index.html`);
    await expect.poll(() => demo.locator("body").evaluate(() => document.readyState)).toBe("complete");
  };
  await expect(page.locator("[data-template-title]")).toHaveText("Quiet Welcome");
  await expect(page.locator("[data-design-number]")).toHaveText("Design 1 of 5");
  await expect(previous).toBeDisabled();
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox");
  await expect(page.locator(".preview-toolbar button")).toHaveCount(2);
  expect(new URL(page.url()).searchParams.has("device")).toBe(false);
  await expectRenderedDesign(0);
  for (let index = 1; index < designs.length; index++) {
    await next.click();
    await expect(page.locator("[data-template-title]")).toHaveText(designs[index].name);
    await expect(page.locator("[data-design-number]")).toHaveText(`Design ${index + 1} of 5`);
    await expect(frame).toHaveAttribute("src", `/designs/${designs[index].slug}/index.html`);
    expect(new URL(page.url()).searchParams.get("d")).toBe(designs[index].slug);
    await expect(page.locator("[data-template-title]")).toBeFocused();
    await expectRenderedDesign(index);
  }
  await expect(next).toBeDisabled();
  for (let index = designs.length - 2; index >= 0; index--) {
    await page.goBack();
    await expectRenderedDesign(index);
  }
  await expect(previous).toBeDisabled();
  for (let index = 1; index < designs.length; index++) {
    await page.goForward();
    await expectRenderedDesign(index);
  }
  await expect(next).toBeDisabled();
  await previous.click();
  await expect(page.locator("[data-template-title]")).toHaveText("Come and See");
  await expect(page.getByRole("link", { name: "← Back to designs" })).toBeVisible();
});

test("return restores the originating gallery card after browsing other designs", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Preview Living Tradition" }).click();
  await page.getByRole("button", { name: "Next →" }).click();
  await page.getByRole("link", { name: "← Back to designs" }).click();
  await expect(page.getByRole("link", { name: "Preview Living Tradition" })).toBeFocused();
});

test("Quiet Welcome keeps every full page, native navigation, FAQs, and inert demo form", async ({ page }) => {
  await page.goto("/preview?d=quiet-welcome");
  const demo = page.frameLocator("[data-preview-frame]");
  const tau = demo.locator(".qs-tau");
  await expect.poll(async () => (await tau.boundingBox())?.width ?? 1000).toBeLessThan(100);
  const paths = [
    ["Who we are", "A fraternity in the middle of ordinary life."],
    ["Franciscan life", "From Gospel to life. From life to Gospel."],
    ["Questions", "Curiosity belongs here."]
  ];
  for (const [label] of paths) {
    await demo.getByRole("navigation").getByRole("link", { name: label, exact: true }).click();
    await expect(demo.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(demo.getByRole("navigation").getByRole("link")).toHaveCount(5);
  }
  await demo.locator("summary").filter({ hasText: "Is visiting a commitment?" }).click();
  await expect(demo.getByText(/Not at all\. A first visit is simply/)).toBeVisible();
  await demo.getByRole("navigation").getByRole("link", { name: "Come & see", exact: true }).click();
  await expect(demo.getByRole("heading", { name: "There is room for your questions." })).toBeVisible();
  await expect(demo.locator("body")).toContainText("St. Mary Parish Hall");
  await demo.getByLabel("Name", { exact: true }).fill("Sample visitor");
  await demo.getByLabel("Email", { exact: true }).fill("visitor@example.org");
  await demo.getByLabel("What would you like to know?").fill("I am exploring the sample form.");
  await demo.getByRole("button", { name: "Try the demo form" }).click();
  await expect(demo.getByText("✓ Thanks! This is a demo site — nothing was actually sent.")).toBeVisible();
  await demo.getByLabel("Name", { exact: true }).fill("Keyboard visitor");
  await demo.getByLabel("Email", { exact: true }).fill("keyboard@example.org");
  await demo.getByLabel("What would you like to know?").fill("A keyboard-only sample.");
  await demo.getByLabel("Email", { exact: true }).press("Enter");
  await expect(demo.getByLabel("Name", { exact: true })).toHaveValue("");
  await expect(page.locator("[data-template-title]")).toHaveText("Quiet Welcome");
  await demo.getByRole("navigation").getByRole("link", { name: "Home", exact: true }).click();
  await expect(demo.getByRole("heading", { level: 1 })).toHaveText(designs[0].heading);
});

test("Pilgrim’s Path keeps full section navigation and FAQ behavior in the sandbox", async ({ page }) => {
  await page.goto("/preview?d=pilgrims-path");
  const demo = page.frameLocator("[data-preview-frame]");
  await demo.getByRole("navigation", { name: "Page guide" }).getByRole("link", { name: /A path of discernment/ }).click();
  await expect(demo.locator("#formation")).toBeInViewport();
  await expect(demo.locator("#formation")).toContainText("Generally 18 months–3 years");
  await demo.getByRole("navigation", { name: "Pilgrim's Path navigation" }).getByRole("link", { name: "Questions" }).click();
  await demo.locator("summary").filter({ hasText: "Is visiting a commitment?" }).click();
  await expect(demo.getByText(/Not at all\. A first visit is simply/)).toBeVisible();
});

for (const width of [320, 390, 768, 1280]) {
  test(`gallery and preview remain readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const columns = await page.locator(".design-grid").evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(width <= 560 ? 1 : width <= 850 ? 2 : 3);
    for (const design of designs) {
      await page.goto(`/preview?d=${design.slug}`);
      await expect(page.getByRole("link", { name: "← Back to designs" })).toBeVisible();
      await expect(page.locator("[data-template-title]")).toHaveText(design.name);
      await expect(page.locator("[data-design-number]")).toBeVisible();
      const frame = page.locator("[data-preview-frame]");
      const box = await frame.boundingBox();
      expect(Math.abs((box?.width ?? 0) - width)).toBeLessThanOrEqual(1);
      expect(box?.height).toBeGreaterThan(600);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect.poll(() => page.frameLocator("[data-preview-frame]").locator("body").evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  });
}

test("existing modern design mobile menu follows its own navigation and demo form never sends", async ({ page }) => {
  let posts = 0;
  page.on("request", (request) => { if (request.method() === "POST") posts++; });
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto("/designs/st-margaret-2026/direction-b/index.html");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile menu" })).toBeVisible();
  await page.getByRole("navigation", { name: "Mobile menu" }).getByRole("link", { name: "Contact", exact: true }).click();
  await expect(page.locator("#contact")).toBeInViewport();
  await page.getByLabel("Your name", { exact: true }).fill("Sample visitor");
  await page.getByLabel("Email", { exact: true }).fill("visitor@example.org");
  await page.getByLabel("Message", { exact: true }).fill("A sample message.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("✓ Thanks! This is a demo site — nothing was actually sent.")).toBeVisible();
  expect(posts).toBe(0);
  await expect(page.locator("[data-mobile-cta]")).toBeVisible();
});

test("demo forms remain disabled when JavaScript is unavailable", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of ["quiet-welcome/come-and-see", "pilgrims-path", "st-margaret-2026/direction-a", "st-margaret-2026/direction-b", "st-margaret-2026/direction-c"]) {
    await page.goto(`http://127.0.0.1:4321/designs/${route}/index.html`);
    await expect(page.locator('form button[type="submit"]')).toBeDisabled();
    await expect(page.locator("form input").first()).toBeDisabled();
  }
  await context.close();
});

test("fictional visit and news links work without real venue or newsletter claims", async ({ page }) => {
  await page.goto("/designs/st-margaret-2026/direction-a/index.html");
  await expect(page.locator(".sample-location-panel")).toContainText("Fictional sample venue");
  await page.getByRole("link", { name: "Get directions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "St. Mary Parish Hall" })).toBeVisible();
  await expect(page.locator("body")).toContainText("not a real destination");
  await page.goto("/designs/st-margaret-2026/direction-c/index.html");
  await page.locator(".issue.feature").click();
  await expect(page.getByRole("heading", { name: "Summer: room at the table" })).toBeVisible();
  await expect(page.locator("body")).toContainText("not reports of real events");
});

test("legacy Current Site remains reachable outside the public sequence", async ({ page, request }) => {
  for (const route of ["", "who-we-are/", "get-involved/", "news/", "faq/"]) {
    expect((await request.get(`/designs/st-margaret-2026/current-site/${route}index.html`)).ok()).toBe(true);
  }
  await page.goto("/preview?d=st-margaret-2026/current-site&device=mobile");
  await expect(page.locator("[data-template-title]")).toHaveText("Current Site");
  await expect(page.locator("[data-design-number]")).toHaveText("Archived design · outside this collection");
  await expect(page.getByRole("button", { name: "← Previous" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next →" })).toBeDisabled();
  const demo = page.frameLocator("[data-preview-frame]");
  await expect(demo.getByRole("heading", { name: "WELCOME TO THE ST MARGARET OF CORTONA FRATERNITY" })).toBeVisible();
  await demo.getByRole("link", { name: "Who We Are", exact: true }).click();
  await expect(demo.getByRole("heading", { name: "Who We Are", exact: true })).toBeVisible();
});

async function configuredForm(page: Page) {
  await page.route("http://127.0.0.1:4321/", async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/data-turnstile-site-key(?:="[^"]*")?/, 'data-turnstile-site-key="test-site-key"');
    await route.fulfill({ response, body: html });
  });
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", (route) => route.fulfill({ contentType: "application/javascript", body: `
    window.turnstile={ render(element, options) {
      const field=document.createElement('input'); field.type='hidden'; field.name='cf-turnstile-response'; field.value='widget-token'; element.append(field);
      this.options=options; options.callback('widget-token'); return 'widget';
    }, reset(){queueMicrotask(()=>this.options.callback('fresh-widget-token'));} };
  ` }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
}
async function fillContact(page: Page) {
  await page.getByLabel("Your name", { exact: true }).fill("Sample visitor");
  await page.getByLabel("Email address", { exact: true }).fill("visitor@example.org");
  await page.getByLabel("Your message", { exact: true }).fill("I would like a website for our fraternity.");
}

test("contact validates required fields, sends only approved fields, and prevents duplicate pending requests", async ({ page }) => {
  let posts = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/contact", async (route) => {
    posts++;
    const body = route.request().postDataJSON();
    expect(Object.keys(body).sort()).toEqual(["design", "email", "fraternity", "message", "name", "turnstileToken", "website"]);
    expect(body.turnstileToken).toBe("widget-token");
    await gate;
    await route.fulfill({ json: { ok: true, message: "Your message has been accepted for delivery. Thank you for getting in touch." } });
  });
  await configuredForm(page);
  await page.getByRole("button", { name: "Send message" }).click();
  expect(posts).toBe(0);
  await fillContact(page);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
  await page.locator("#contact-form").dispatchEvent("submit");
  await expect.poll(() => posts).toBe(1);
  release();
  await expect(page.locator("[data-form-status]")).toContainText("accepted for delivery");
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("");
  expect(posts).toBe(1);
});

test("contact preserves input and useful error after Turnstile renewal", async ({ page }) => {
  await page.route("**/api/contact", (route) => route.fulfill({ status: 503, json: { ok: false, message: "The contact form is not available yet. Please email bill@endian.dev." } }));
  await configuredForm(page);
  await fillContact(page);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert")).toContainText("Please email bill@endian.dev.");
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue("I would like a website for our fraternity.");
  await expect(page.getByRole("alert")).toContainText("not available yet");
});

test("contact never claims success for a network failure", async ({ page }) => {
  await page.route("**/api/contact", (route) => route.abort());
  await configuredForm(page);
  await fillContact(page);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert")).toContainText("couldn’t confirm");
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("Sample visitor");
});
