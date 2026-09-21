import { test, expect } from '@playwright/test'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = join(process.cwd(), 'dist')

/**
 * Guards the deploy, not the app.
 *
 * The question bank is generated from the scrapes and is gitignored, so a host
 * cloning the repo has no data/ unless the build makes it. It didn't, and every
 * data request on Netlify fell through to the SPA rewrite and came back as
 * HTML with a 404.
 */
test.describe('deployable output', () => {
  test('the build emits the question bank into dist', () => {
    for (const file of ['data/questions.json', 'data/tests.json']) {
      const path = join(DIST, file)
      expect(existsSync(path), `${file} must be in dist - the build has to generate it`).toBe(true)
      expect(statSync(path).size).toBeGreaterThan(1000)
    }
  })

  test('dist has everything a static host needs', () => {
    for (const file of [
      'index.html',
      'manifest.webmanifest',
      'sw.js',
      'icons/icon-192.png',
      'icons/icon-512.png',
      'icons/maskable-512.png',
      'favicon-32.png',
    ]) {
      expect(existsSync(join(DIST, file)), `${file} missing from dist`).toBe(true)
    }
  })

  test('data generation does not depend on python being installed', () => {
    // the deploy host runs the JS generator; the Python one is a local convenience
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
    expect(pkg.scripts.build).toContain('build_data.mjs')
    expect(pkg.scripts.build).not.toContain('python')
  })

  test('netlify config builds, publishes and routes correctly', () => {
    const toml = readFileSync(join(process.cwd(), 'netlify.toml'), 'utf8')

    expect(toml).toContain('publish = "dist"')
    expect(toml).toContain('command = "npm run build"')

    // SPA rewrite, or every deep link 404s
    expect(toml).toMatch(/from = "\/\*"[\s\S]*?to = "\/index\.html"[\s\S]*?status = 200/)

  })

  test('a deep link is served by the app, not a 404', async ({ page }) => {
    // needs the SPA rewrite in netlify.toml; vite preview does the same locally
    await page.goto('/tests/10')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: '134', exact: true })).toBeVisible()
  })

  test('the real data files are served as json, not swallowed by the rewrite', async ({
    request,
  }) => {
    for (const file of ['/data/questions.json', '/data/tests.json']) {
      const res = await request.get(file)
      expect(res.status(), `${file} should be served`).toBe(200)
      expect(res.headers()['content-type'], `${file} should be json`).toContain(
        'application/json',
      )
    }
  })
})

test.describe('missing bank degrades honestly', () => {
  /** A first-time visitor has no service worker cache to fall back on. */
  const asFirstVisit = async (page: import('@playwright/test').Page) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'serviceWorker', { get: () => undefined })
    })
    await page.route('**/sw.js', (r) => r.fulfill({ status: 404, body: '' }))
    // exactly what a SPA rewrite returns when the data file isn't deployed
    await page.route('**/data/questions.json', (r) =>
      r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html></html>' }),
    )
  }

  test('the solver says the bank could not be loaded', async ({ page }) => {
    await asFirstVisit(page)
    await page.goto('/test/t20-1')
    await expect(page.getByText(/Savollar bazasini yuklab bo'lmadi/)).toBeVisible({
      timeout: 15000,
    })
  })

  test('the bank page says so too, instead of showing an empty list', async ({ page }) => {
    await asFirstVisit(page)
    await page.goto('/bank')
    await expect(page.getByText(/Savollar bazasini yuklab bo'lmadi/)).toBeVisible({
      timeout: 15000,
    })
  })

  test('an already-visited device keeps working from the service worker cache', async ({
    page,
  }) => {
    // warm the cache
    await page.goto('/')
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
      timeout: 15000,
    })
    await page.waitForTimeout(1500)

    // now the server loses the bank entirely
    await page.route('**/data/questions.json', (r) =>
      r.fulfill({ status: 404, contentType: 'text/html', body: 'not found' }),
    )
    await page.goto('/test/t20-1')

    // precached, so it still works - this is the point of shipping it offline
    await expect(page.getByTestId('answer-option').first()).toBeVisible({ timeout: 15000 })
  })
})
