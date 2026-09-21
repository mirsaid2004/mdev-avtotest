import { test, expect } from '@playwright/test'

test.describe('app shell', () => {
  test('dashboard renders the primary actions', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await expect(page.getByRole('link', { name: /20 savolli testlar/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /10 savolli testlar/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Imtihon/ })).toBeVisible()

    // exam rules stated up front
    await expect(page.getByText(/20 ta tasodifiy savol.*25 daqiqa.*2 xato/)).toBeVisible()
  })

  test('serves the data files with the expected shape', async ({ request }) => {
    const questions = await request.get('/data/questions.json')
    expect(questions.ok()).toBeTruthy()

    // A missing data file does not 404 cleanly on a SPA host - it falls through
    // to the index.html rewrite and comes back as HTML, which is exactly how
    // this broke in production. Assert the content type, not just the status.
    expect(questions.headers()['content-type']).toContain('application/json')
    const bank = await questions.json()
    expect(bank).toHaveLength(1353)

    // every question must carry a correct answer that exists among its answers
    for (const q of bank) {
      expect(q.answers.some((a: { id: number }) => a.id === q.answerId)).toBeTruthy()
      expect(q.text.uzb.length).toBeGreaterThan(0)
    }

    const tests = await request.get('/data/tests.json')
    expect(tests.headers()['content-type']).toContain('application/json')
    const templates = await tests.json()
    expect(templates).toHaveLength(202)
    expect(templates.filter((t: { size: number }) => t.size === 20)).toHaveLength(68)
    expect(templates.filter((t: { size: number }) => t.size === 10)).toHaveLength(134)

    // every template references questions that exist
    const ids = new Set(bank.map((q: { id: number }) => q.id))
    for (const t of templates) {
      for (const qid of t.questionIds) expect(ids.has(qid)).toBeTruthy()
    }
  })

  test('navigates between the main sections', async ({ page, isMobile }) => {
    await page.goto('/')
    const nav = isMobile ? page.locator('nav').last() : page.locator('header nav')

    await nav.getByRole('link', { name: 'Testlar' }).click()
    await expect(page).toHaveURL(/\/tests\/20/)
    await expect(page.getByRole('link', { name: '1', exact: true })).toBeVisible()

    await nav.getByRole('link', { name: 'Natijalar' }).click()
    await expect(page).toHaveURL(/\/stats/)
    await expect(page.getByText(/javob berilgan savollar/)).toBeVisible()

    await nav.getByRole('link', { name: 'Sozlamalar' }).click()
    await expect(page).toHaveURL(/\/settings/)
  })

  test('has no console errors on load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('404 renders for an unknown route', async ({ page }) => {
    await page.goto('/this-does-not-exist')
    await expect(page.getByText('404')).toBeVisible()
  })
})

test.describe('tests listing', () => {
  test('shows 68 twenty-question and 134 ten-question templates', async ({ page }) => {
    await page.goto('/tests/20')
    await expect(page.getByRole('link', { name: /^\d+$/ })).toHaveCount(68)

    await page.goto('/tests/10')
    await expect(page.getByRole('link', { name: /^\d+$/ })).toHaveCount(134)
  })

  test('numbering is sequential, not the source ids', async ({ page }) => {
    await page.goto('/tests/10')
    // the raw scrape numbers run 5..356; the UI must show 1..134
    await expect(page.getByRole('link', { name: '1', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '134', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '356', exact: true })).toHaveCount(0)
  })
})
