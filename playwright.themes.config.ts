import { defineConfig } from '@playwright/test'
const origin = process.env.THEME_TEST_ORIGIN || 'http://localhost:3127'
const url = new URL(origin)
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Theme tests require a local server')
export default defineConfig({
  testDir: './tests/themes-browser', workers: 1, timeout: 90_000,
  use: { baseURL: origin, trace: 'retain-on-failure' },
  webServer: { command: `pnpm exec vite --host ${url.hostname} --port ${url.port || '3127'} --strictPort`, url: origin, reuseExistingServer: !process.env.CI, timeout: 60_000 },
})
