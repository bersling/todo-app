// Runs against the static page served from the repo root with Supabase mocked in
// the browser (see mock.js). Two shapes: a phone (WebKit, touch) and a
// narrow desktop window like the tiled pane.
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.js/,
  timeout: 20000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:8123/", trace: "retain-on-failure" },
  webServer: {
    command: "python3 -m http.server 8123 --bind 127.0.0.1 --directory ..",
    url: "http://127.0.0.1:8123/",
    reuseExistingServer: true,
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 420, height: 800 } } },
  ],
});
