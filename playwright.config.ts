import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3300", trace: "retain-on-failure" },
  webServer: { command: "PORT=3300 corepack pnpm dev", url: "http://127.0.0.1:3300/health", reuseExistingServer: true, timeout: 30_000 },
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
