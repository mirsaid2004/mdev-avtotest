import { test, expect } from '@playwright/test'

test.describe('theme', () => {
  test('respects the OS dark preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('respects the OS light preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('a stored choice overrides the OS and applies before paint', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.addInitScript(() => localStorage.setItem('eavtomaktab:theme', 'dark'))
    await page.goto('/')
    // set by the inline head script, so it is already correct on first paint
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})
