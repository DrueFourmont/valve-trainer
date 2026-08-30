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
 * real scene. Headless Chromium on this Mac has no GPU path worth trusting, so
 * the default is headed, where WebGL works. CI has no display, so it falls back
 * to headless with ANGLE on SwiftShader, which is slow but correct.
 */
const inCi = Boolean(process.env.CI)

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: false, // one dev server, one GPU, one scene
  workers: 1,
  retries: inCi ? 1 : 0,
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
        headless: inCi,
        viewport: { width: 1280, height: 800 },
        launchOptions: {
          args: inCi
            ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
            : [],
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
