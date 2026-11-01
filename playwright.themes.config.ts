import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/themes-browser', workers: 1, timeout: 90_000,
  use: { baseURL: 'http://localhost:3127', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm exec vite --host 127.0.0.1 --port 3127 --strictPort', url: 'http://localhost:3127', reuseExistingServer: !process.env.CI, timeout: 60_000 },
})
