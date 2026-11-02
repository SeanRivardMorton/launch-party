import { defineConfig } from '@playwright/test'
const origin = process.env.THEME_TEST_ORIGIN || 'http://localhost:3127'
export default defineConfig({
  testDir: './tests/themes-browser', workers: 1, timeout: 90_000,
  use: { baseURL: origin, trace: 'retain-on-failure' },
  webServer: { command: `pnpm exec vite --host 127.0.0.1 --port ${new URL(origin).port} --strictPort`, url: origin, reuseExistingServer: false, timeout: 60_000 },
})
