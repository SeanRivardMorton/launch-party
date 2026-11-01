import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser', workers: 1, timeout: 60_000,
  use: { baseURL: 'http://localhost:3107', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm exec vite --host 0.0.0.0 --port 3107 --strictPort', url: 'http://localhost:3107', reuseExistingServer: !process.env.CI, timeout: 60_000 },
})
