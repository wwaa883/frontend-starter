import { defineConfig } from '@playwright/test'

// 端到端测试默认用系统已装的 Edge（channel: msedge），不额外下载浏览器；
// CI 里可用 PW_CHANNEL=chromium 切到 Playwright 自带的 Chromium
export default defineConfig({
  testDir: './e2e',
  timeout: 40_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    channel: process.env.PW_CHANNEL || 'msedge',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node ../backend-starter/src/index.js',
      url: 'http://localhost:3000/api/hello',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
