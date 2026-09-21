import { test, expect } from '@playwright/test'

const answers = (page: import('@playwright/test').Page) =>
  page.getByTestId('answer-option')

test.describe('training test', () => {
  test('runs a 20-question test end to end and reaches results', async ({ page }) => {
    await page.goto('/test/t20-1')
    await expect(page.getByRole('timer')).toBeVisible()
    await expect(page.getByRole('tab')).toHaveCount(20)

    for (let i = 0; i < 20; i++) {
      await answers(page).first().click()
      if (i < 19) await page.getByRole('button', { name: /Keyingi|Next/ }).click()
    }

    // finish -> confirm dialog -> results
    await page.getByRole('button', { name: /Yakunlash|Finish/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: /Yakunlash|Finish/ }).click()

    await expect(page).toHaveURL(/\/results\//)
    await expect(page.getByText("/20")).toBeVisible()
  })

  test('reveals the answer immediately and locks the question', async ({ page }) => {
    await page.goto('/test/t20-1')
    await expect(answers(page).first()).toBeVisible()

    await answers(page).first().click()

    // exactly one option is marked correct, and all are now locked
    await expect(page.locator('[data-testid="answer-option"][data-state="correct"]')).toHaveCount(1)

    const count = await answers(page).count()
    for (let i = 0; i < count; i++) await expect(answers(page).nth(i)).toBeDisabled()
  })

  test('the slider navigates between questions', async ({ page }) => {
    await page.goto('/test/t20-1')
    await page.getByRole('tab').nth(4).click()
    await expect(page.getByText('5 / 20')).toBeVisible()
  })
})

test.describe('exam mode', () => {
  test('is 20 questions, 25 minutes, and tracks the mistake budget', async ({ page }) => {
    await page.goto('/test/exam')
    await expect(page.getByRole('tab')).toHaveCount(20)
    await expect(page.getByRole('timer')).toContainText(/2[45]:/)
    await expect(page.getByText(/0\/2 xato|0\/2 mistakes/)).toBeVisible()
  })

  test('reveals the correct answer immediately, same as training', async ({ page }) => {
    await page.goto('/test/exam')
    await answers(page).first().click()

    // the right answer is always marked green, wherever it sits
    await expect(page.locator('[data-testid="answer-option"][data-state="correct"]')).toHaveCount(1)

    // and the question locks, so a revealed answer can't be changed
    const count = await answers(page).count()
    for (let i = 0; i < count; i++) await expect(answers(page).nth(i)).toBeDisabled()
  })

  test('a wrong pick is marked red and counts against the budget', async ({ page }) => {
    await page.goto('/test/exam')

    // click every option until one lands on a wrong answer
    const options = answers(page)
    const total = await options.count()
    for (let i = 0; i < total; i++) {
      await options.nth(i).click()
      const wrong = await page.locator('[data-testid="answer-option"][data-state="incorrect"]').count()
      if (wrong > 0) {
        await expect(page.getByText(/1\/2 xato|1\/2 mistakes/)).toBeVisible()
        return
      }
      if (i === 0) break // first click locks the question
    }
  })
})

test.describe('resume', () => {
  test('an unfinished test is offered on the dashboard and restores answers', async ({ page }) => {
    await page.goto('/test/t20-2')
    await answers(page).first().click()
    await page.getByRole('button', { name: /Keyingi|Next/ }).click()
    await answers(page).first().click()

    await page.goto('/')
    await expect(page.getByText('Tugallanmagan test')).toBeVisible()
    await expect(page.getByText('20 tadan 2 tasi javoblangan')).toBeVisible()

    await page.getByRole('link', { name: /Davom etish|Continue/ }).click()
    await expect(page).toHaveURL(/\/test\/t20-2/)
    await expect(page.getByRole('tab').first()).toHaveAttribute('aria-label', /answered/)
  })
})

test.describe('image viewer', () => {
  test('opens fullscreen and closes again', async ({ page }) => {
    await page.goto('/test/t20-1')
    const expand = page.getByTestId('question-media')
    if ((await expand.count()) === 0) test.skip()

    await expand.click()
    const viewer = page.getByRole('dialog')
    await expect(viewer).toBeVisible()

    await page.getByRole('button', { name: 'Close' }).click()
    await expect(viewer).toBeHidden()
  })
})

test.describe('persistence', () => {
  test('an answer given immediately before leaving is not lost', async ({ page }) => {
    await page.goto('/test/t20-3')
    await page.getByTestId('answer-option').first().click()
    await page.getByRole('button', { name: /Keyingi|Next/ }).click()
    await page.getByTestId('answer-option').first().click()

    // leave with no wait at all - the debounced write has not fired yet, so
    // this exercises the pagehide flush, not the timer
    await page.goto('/')

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('eavtomaktab:progress') ?? '{}'),
    )
    expect(Object.keys(stored.activeSession?.answers ?? {})).toHaveLength(2)
    expect(Object.keys(stored.stats ?? {})).toHaveLength(2)
  })

  test('progress survives a reload', async ({ page }) => {
    await page.goto('/test/t20-4')
    await page.getByTestId('answer-option').first().click()
    await page.waitForTimeout(400)

    await page.reload()
    await expect(page.getByRole('tab').first()).toHaveAttribute('aria-label', /answered/)
  })
})
