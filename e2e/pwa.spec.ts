import { test, expect } from '@playwright/test'

test.describe('pwa', () => {
  test('serves a valid manifest with all required icons', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest')
    expect(res.ok()).toBeTruthy()

    const m = await res.json()
    expect(m.name).toBeTruthy()
    expect(m.short_name).toBe('MDEV-Avtotest')
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/')
    expect(m.theme_color).toBe('#2050c8')

    // installability needs 192 and 512, and a maskable icon for Android
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBeTruthy()
  })

  test('every declared icon actually resolves', async ({ request }) => {
    const m = await (await request.get('/manifest.webmanifest')).json()
    for (const icon of m.icons) {
      const res = await request.get(icon.src)
      expect(res.ok(), `${icon.src} should exist`).toBeTruthy()
      expect(res.headers()['content-type']).toContain('image/png')
    }
    for (const path of ['/favicon-32.png', '/favicon-16.png', '/icons/apple-touch-icon.png']) {
      expect((await request.get(path)).ok(), `${path} should exist`).toBeTruthy()
    }
  })

  test('links the manifest and icons from the document head', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1)
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1)
    await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute('href', /favicon/)
  })

  test('registers a service worker and precaches the question bank', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
      timeout: 15000,
    })

    const cached = await page.evaluate(async () => {
      const names = await caches.keys()
      const all: string[] = []
      for (const n of names) {
        const keys = await caches.open(n).then((c) => c.keys())
        all.push(...keys.map((r) => new URL(r.url).pathname))
      }
      return all
    })

    // without the bank there is nothing to study offline
    expect(cached.some((u) => u.includes('questions.json'))).toBeTruthy()
    expect(cached.some((u) => u.includes('tests.json'))).toBeTruthy()
  })

  test('works offline once installed', async ({ page, context }) => {
    await page.goto('/')
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
      timeout: 15000,
    })
    await page.waitForTimeout(1500) // let precaching settle

    await context.setOffline(true)
    await page.reload()

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // and a test is still solvable with no network at all
    await page.goto('/test/t20-1')
    await expect(page.getByTestId('answer-option').first()).toBeVisible({ timeout: 10000 })

    await context.setOffline(false)
  })
})

test.describe('branding', () => {
  test('the logo renders on the dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('img', { name: 'MDEV-Avtotest' }).first()).toBeVisible()
  })
})

test.describe('install card', () => {
  /** Chromium only fires beforeinstallprompt under conditions we can't force in CI. */
  const fireInstallable = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      class BeforeInstallPromptEvent extends Event {
        prompt = async () => {}
        userChoice = Promise.resolve({ outcome: 'accepted' as const })
        constructor() {
          super('beforeinstallprompt', { cancelable: true })
        }
      }
      window.dispatchEvent(new BeforeInstallPromptEvent())
    })

  test('is hidden until the browser says the app is installable', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('install-card')).toHaveCount(0)

    await fireInstallable(page)
    await expect(page.getByTestId('install-card')).toBeVisible()
  })

  test('dismissing hides it and is remembered across reloads', async ({ page }) => {
    await page.goto('/')
    await fireInstallable(page)

    const card = page.getByTestId('install-card')
    await expect(card).toBeVisible()

    await card.getByRole('button', { name: /Yopish|Close/ }).click()
    await expect(card).toHaveCount(0)

    await page.reload()
    await fireInstallable(page)
    await expect(page.getByTestId('install-card')).toHaveCount(0)
  })

  test('never shows when already running as an installed app', async ({ page }) => {
    await page.emulateMedia({ media: 'screen' })
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window)
      window.matchMedia = (q: string) =>
        q.includes('display-mode: standalone')
          ? ({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
          : real(q)
    })
    await page.goto('/')
    await fireInstallable(page)
    await expect(page.getByTestId('install-card')).toHaveCount(0)
  })
})

test.describe('logo', () => {
  test('renders the full badge, not just the dashes', async ({ page }) => {
    await page.goto('/')
    const logo = page.getByRole('img', { name: 'MDEV-Avtotest' }).first()
    await expect(logo).toBeVisible()

    // the gradient-filled badge must actually paint: a colliding gradient id
    // silently drops it and leaves a white road on a white page
    const box = await logo.evaluate((el) => {
      const rect = el.querySelector('rect[fill^="url("]')
      if (!rect) return null
      const id = rect.getAttribute('fill')!.slice(5, -1)
      return { hasGradient: Boolean(el.querySelector(`#${CSS.escape(id)}`)) }
    })
    expect(box?.hasGradient).toBeTruthy()
  })

  test('multiple logos on one page each resolve their own gradient', async ({ page }) => {
    await page.goto('/')
    await page.setViewportSize({ width: 1280, height: 900 })

    const broken = await page.evaluate(() =>
      [...document.querySelectorAll('svg[aria-label="MDEV-Avtotest"]')].filter((svg) => {
        const rect = svg.querySelector('rect[fill^="url("]')
        if (!rect) return false
        const id = rect.getAttribute('fill')!.slice(5, -1)
        return !svg.querySelector(`#${CSS.escape(id)}`)
      }).length,
    )
    expect(broken).toBe(0)
  })
})
