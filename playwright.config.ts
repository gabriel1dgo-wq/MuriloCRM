import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server/index.mjs',
    url: 'http://127.0.0.1:4173/healthz',
    reuseExistingServer: false,
    env: { PORT: '4173', DEMO_ENABLED: 'true', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' },
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
