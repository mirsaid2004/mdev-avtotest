import { test, expect, type Page } from '@playwright/test'

/**
 * Answers `n` questions so the day has real activity.
 *
 * Takes the test id because answers lock once given: re-entering a test that
 * already has answers lands on disabled options.
 */
async function answer(page: Page, n: number, testId = 't20-1') {
  await page.goto(`/test/${testId}`)
  for (let i = 0; i < n; i++) {
    await page.getByTestId('answer-option').first().click()
    if (i < n - 1) await page.getByRole('button', { name: /Keyingi|Next/ }).click()
  }
  await page.waitForTimeout(500)
}

test.describe('activity heatmap', () => {
  test("today's cell exists and is marked", async ({ page }) => {
    await answer(page, 3)
    await page.goto('/stats')

    const today = page.getByTestId('heatmap-today')
    await expect(today).toHaveCount(1)
    await expect(today).toBeVisible()
  })

  test("today's cell is filled in, not left empty", async ({ page }) => {
    await answer(page, 3)
    await page.goto('/stats')

    // the actual complaint: activity recorded but the square looked blank
    const level = await page.getByTestId('heatmap-today').getAttribute('data-level')
    expect(Number(level)).toBeGreaterThan(0)

    const bg = await page
      .getByTestId('heatmap-today')
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    const empty = await page
      .locator('[data-level="0"]')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).not.toBe(empty)
  })

  test('intensity rises with the number answered', async ({ page }) => {
    await answer(page, 2, 't20-1')
    await page.goto('/stats')
    const low = Number(await page.getByTestId('heatmap-today').getAttribute('data-level'))

    // a different test, because answers lock - both still count toward today
    await answer(page, 12, 't20-2')
    await page.goto('/stats')
    const high = Number(await page.getByTestId('heatmap-today').getAttribute('data-level'))

    expect(low).toBeGreaterThan(0)
    expect(high).toBeGreaterThan(low)
  })

  test('a full 20-question test reaches the top level', async ({ page }) => {
    await answer(page, 20)
    await page.goto('/stats')
    expect(Number(await page.getByTestId('heatmap-today').getAttribute('data-level'))).toBe(4)
  })

  test('the header count matches what was answered', async ({ page }) => {
    await answer(page, 7)
    await page.goto('/stats')
    await expect(page.getByText(/^7\s/).first()).toBeVisible()
  })

  test('the tooltip reports the day accurately', async ({ page }) => {
    await answer(page, 4)
    await page.goto('/stats')

    await page.getByTestId('heatmap-today').hover()
    await expect(page.getByRole('tooltip').getByText(/4 ta javob|4 отвечено/)).toBeVisible()
  })

  test('with no activity at all nothing is highlighted', async ({ page }) => {
    await page.goto('/stats')
    await expect(page.getByTestId('heatmap-today')).toHaveAttribute('data-level', '0')
  })

  test('the streak counts today', async ({ page }) => {
    await answer(page, 3)
    await page.goto('/stats')
    // "Joriy ketma-ketlik" (current streak) should read 1 day
    const tile = page
      .locator('[data-slot="card"]')
      .filter({ hasText: 'Joriy ketma-ketlik' })
      .first()
    await expect(tile).toBeVisible()
    await expect(tile).toContainText('1')
  })
})

test.describe('heatmap scroll position', () => {
  test("opens scrolled to today, not to last year", async ({ page }) => {
    await answer(page, 5)
    await page.goto('/stats')
    await page.waitForTimeout(500)

    const today = page.getByTestId('heatmap-today')
    const box = await today.boundingBox()
    const container = await page
      .locator('div.overflow-x-auto')
      .filter({ has: today })
      .first()
      .boundingBox()

    expect(box).not.toBeNull()
    expect(container).not.toBeNull()

    // the regression: today rendered correctly but sat past the right edge of
    // the scroll container, so it was invisible without scrolling
    expect(box!.x).toBeGreaterThanOrEqual(container!.x - 1)
    expect(box!.x + box!.width).toBeLessThanOrEqual(container!.x + container!.width + 1)
  })

  test('today is visible at phone width too', async ({ page }) => {
    await answer(page, 5)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/stats')
    await page.waitForTimeout(500)

    const today = page.getByTestId('heatmap-today')
    const box = await today.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThan(0)
    expect(box!.x).toBeLessThan(390)
  })
})
