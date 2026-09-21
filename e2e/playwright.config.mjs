import { defineConfig, devices } from '@playwright/test'

const desktopChrome = { ...devices['Desktop Chrome'] }
const crossBrowser = process.env.E2E_CROSS_BROWSER === 'true'

const crossBrowserProjects = crossBrowser
  ? [
      {
        name: 'critical-firefox',
        testMatch: /critical-flows\.spec\.mjs/,
        dependencies: ['setup'],
        use: {
          ...devices['Desktop Firefox'],
          storageState: './.auth/artist.json',
        },
      },
      {
        name: 'critical-webkit',
        testMatch: /critical-flows\.spec\.mjs/,
        dependencies: ['setup'],
        use: {
          ...devices['Desktop Safari'],
          storageState: './.auth/artist.json',
        },
      },
      {
        name: 'critical-mobile-webkit',
        testMatch: /critical-flows\.spec\.mjs/,
        dependencies: ['setup'],
        use: {
          ...devices['iPhone 12'],
          storageState: './.auth/artist.json',
        },
      },
    ]
  : []

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      pathTemplate: '{testDir}/../visual-baselines/{arg}{ext}',
      animations: 'disabled',
      caret: 'hide',
      threshold: 0.2,
      maxDiffPixelRatio: 0.005,
    },
  },
  updateSnapshots: 'none',
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
      testMatch: /(authenticated|critical-flows)\.spec\.mjs/,
      dependencies: ['setup'],
      use: {
        ...desktopChrome,
        storageState: './.auth/artist.json',
      },
    },
    {
      name: 'visual-mobile-chromium',
      testMatch: /visual-smoke\.spec\.mjs/,
      dependencies: ['setup'],
      use: {
        ...devices['Pixel 5'],
        deviceScaleFactor: 1,
        storageState: './.auth/artist.json',
      },
    },
    ...crossBrowserProjects,
  ],
  webServer: {
    command: 'npm --prefix .. run dev -- --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
