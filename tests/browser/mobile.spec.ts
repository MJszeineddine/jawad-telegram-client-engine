import { test, expect } from "@playwright/test";

test("safe demo has no horizontal overflow and exposes privacy warnings", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Production rescue/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Privacy" }).click();
  await expect(page.getByText(/Do not send passwords/)).toBeVisible();
});

test("mock lead reaches completed state through the visible workflow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Submit a Task" }).click();
  await page.getByRole("button", { name: "Qualify Request" }).click();
  await expect(page.locator("#result")).toContainText("AWAITING_REVIEW");
  await page.getByRole("button", { name: "Admin Dashboard" }).click();
  await page.getByRole("button", { name: "Approve 100 Quote" }).click();
  await page.getByRole("button", { name: "Run Safe Mock Payment" }).click();
  await page.getByRole("button", { name: "Start Job" }).click();
  await page.getByRole("button", { name: "Deliver with Proof" }).click();
  await page.getByRole("button", { name: "Simulate Client Acceptance" }).click();
  await expect(page.getByText(/Testimonial\/referral follow-up requested/)).toBeVisible();
});
