import { defineConfig, devices } from "@playwright/test";

// E2E tests boot the real Vite app on a fixed port and drive it in Chromium.
// Word/convert lessons are HR-only, so tests set the language to `hr` first.
const PORT = 5180;
// Vite binds to `localhost` (IPv6 ::1 on some machines) — use the same host so
// Playwright's readiness probe and baseURL hit the server it actually started.
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
