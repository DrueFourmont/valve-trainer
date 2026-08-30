import { readFileSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// The instructor spec needs the same credentials the app builds with, and they
// live in .env.local rather than the shell. Missing values simply skip that spec.
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim())
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
} catch {
  // No .env.local is a normal state, for instance in CI.
}

/**
 * The trainer is a WebGL app, so these run against a real browser rendering a
 * real scene.
 *
 * Headless by default, with ANGLE on SwiftShader for WebGL. Headed was the
 * first choice on the assumption that headless had no usable GPU path, but it
 * turned out to be both intrusive, since it throws browser windows across the
 * desktop, and unstable: three consecutive headed runs gave 20, 21 and 19
 * passes with the browser dying mid run, while headless gave 21 twice. It is
 * slower, about 2.5 minutes against 1, and that is a good trade for a suite
 * whose entire purpose is to be trusted.
 *
 * Set E2E_HEADED=1 to watch it work.
 */
const headed = process.env.E2E_HEADED === '1'

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false, // one dev server, one GPU, one scene
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'test-results/report', open: 'never' }]],

  use: {
    baseURL: 'https://localhost:5173',
    // The dev server uses a locally trusted mkcert certificate, which the
    // bundled Chromium does not know about.
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: !headed,
        viewport: { width: 1280, height: 800 },
        launchOptions: {
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
        },
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'https://localhost:5173/',
    reuseExistingServer: true,
    ignoreHTTPSErrors: true,
    timeout: 120_000,
  },
})
