import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const apiPort = 8789;
const apiBaseURL = `http://127.0.0.1:${apiPort}`;
const apiDataDir = mkdtempSync(join(tmpdir(), "iep-playwright-api-"));

export default defineConfig({
  testDir: "./tests",
  testMatch: ["fds-smoke.spec.js", "fds-api.spec.js"],
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5177",
    channel: "chrome",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "npm run api",
      url: `${apiBaseURL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: String(apiPort),
        DATA_DIR: apiDataDir,
        ENABLE_TEST_RESET: "1"
      }
    },
    {
      command: "npm run dev -- --port 5177",
      url: "http://127.0.0.1:5177",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_IEP_API_URL: apiBaseURL
      }
    }
  ],
  projects: [
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        channel: "chrome",
        viewport: { width: 1440, height: 950 }
      }
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        channel: "chrome",
        viewport: { width: 390, height: 900 },
        isMobile: true,
        deviceScaleFactor: 2,
        hasTouch: true
      }
    }
  ]
});
