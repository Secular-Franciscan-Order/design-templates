import { expect, test } from "@playwright/test";

test("serves the infrastructure placeholder", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Design Templates");
  await expect(
    page.getByRole("heading", {
      name: "Design Templates is ready for review-gallery scaffolding."
    })
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow"
  );
  await expect(page.getByText("No design review content is live yet.")).toBeVisible();
});
