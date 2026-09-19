import { defineConfig, devices } from '@playwright/test'

const desktopChrome = { ...devices['Desktop Chrome'] }

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.mjs/,
      use: desktopChrome,
    },
    {
      name: 'public-chromium',
      testMatch: /public-pages\.spec\.mjs/,
      use: desktopChrome,
    },
    {
      name: 'authenticated-chromium',
      testMatch: /authenticated\.spec\.mjs/,
      dependencies: ['setup'],
      use: {
        ...desktopChrome,
        storageState: './.auth/artist.json',
      },
    },
  ],
  webServer: {
    command: 'npm --prefix .. run dev -- --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
