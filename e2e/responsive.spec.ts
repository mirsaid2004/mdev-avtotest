import { test, expect } from '@playwright/test'

test.describe('responsive layout', () => {
  for (const [name, width, height] of [
    ['small phone', 320, 568],
    ['phone', 390, 844],
    ['tablet', 768, 1024],
    ['desktop', 1440, 900],
  ] as const) {
    test(`no horizontal overflow at ${name} (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )
      expect(overflows).toBeFalsy()
    })
  }
})
