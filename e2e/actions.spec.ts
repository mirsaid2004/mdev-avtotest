import { test, expect, type Page } from '@playwright/test'

const answers = (page: Page) => page.getByTestId('answer-option')
const exitButton = (page: Page) => page.getByRole('button', { name: /Yopish|Close/ }).first()
const dialog = (page: Page) => page.getByRole('dialog')

const storedSession = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('eavtomaktab:progress')
    if (!raw) return null
    const p = JSON.parse(raw)
    return p.activeSession
      ? { testId: p.activeSession.testId, answers: Object.keys(p.activeSession.answers).length }
      : null
  })

const MODES = [
  { route: '/test/t20-1', label: '20-question test' },
  { route: '/test/t10-5', label: '10-question test' },
  { route: '/test/exam', label: 'exam' },
  { route: '/test/practice', label: 'practice' },
]

test.describe('exit', () => {
  for (const mode of MODES) {
    test(`${mode.label}: exit opens a dialog with all three choices`, async ({ page }) => {
      await page.goto(mode.route)
      await expect(answers(page).first()).toBeVisible()

      await exitButton(page).click()
      await expect(dialog(page)).toBeVisible()

      await expect(dialog(page).getByRole('button', { name: /Davom etish/ })).toBeVisible()
      await expect(dialog(page).getByRole('button', { name: /Saqlash/ })).toBeVisible()
      await expect(dialog(page).getByRole('button', { name: /O'chirish/ })).toBeVisible()
    })

    test(`${mode.label}: "continue" closes the dialog and stays in the test`, async ({ page }) => {
      await page.goto(mode.route)
      await expect(answers(page).first()).toBeVisible()

      await exitButton(page).click()
      await dialog(page).getByRole('button', { name: /Davom etish/ }).click()

      await expect(dialog(page)).toBeHidden()
      expect(page.url()).toContain(mode.route)
      await expect(answers(page).first()).toBeVisible()
    })

    test(`${mode.label}: "save & leave" goes home and keeps the session`, async ({ page }) => {
      await page.goto(mode.route)
      await answers(page).first().click()
      await page.waitForTimeout(400)

      await exitButton(page).click()
      await dialog(page).getByRole('button', { name: /Saqlash/ }).click()

      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByText('Tugallanmagan test')).toBeVisible()

      const saved = await storedSession(page)
      expect(saved?.answers).toBe(1)
    })

    test(`${mode.label}: "discard" goes home and destroys the session`, async ({ page }) => {
      await page.goto(mode.route)
      await answers(page).first().click()
      await page.waitForTimeout(400)

      await exitButton(page).click()
      await dialog(page).getByRole('button', { name: /O'chirish/ }).click()

      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByText('Tugallanmagan test')).toBeHidden()

      // and it must STAY discarded - not get resurrected by a late write
      await page.waitForTimeout(900)
      expect(await storedSession(page)).toBeNull()
    })

    test(`${mode.label}: a discarded test starts fresh on re-entry`, async ({ page }) => {
      await page.goto(mode.route)
      await answers(page).first().click()
      await page.waitForTimeout(400)

      await exitButton(page).click()
      await dialog(page).getByRole('button', { name: /O'chirish/ }).click()
      await expect(page).toHaveURL(/\/$/)

      await page.goto(mode.route)
      await expect(answers(page).first()).toBeVisible()
      // nothing revealed: this is a new attempt. data-state is always present
      // (it is "idle" when untouched), so match the feedback states only.
      await expect(
        page.locator(
          '[data-testid="answer-option"][data-state="correct"], [data-testid="answer-option"][data-state="incorrect"]',
        ),
      ).toHaveCount(0)
    })
  }
})

test.describe('navigation actions', () => {
  test('prev is disabled on the first question and works after that', async ({ page }) => {
    await page.goto('/test/t20-1')
    const prev = page.getByRole('button', { name: /Oldingi|Prev/ })
    await expect(prev).toBeDisabled()

    await page.getByRole('button', { name: /Keyingi|Next/ }).click()
    await expect(page.getByText('2 / 20')).toBeVisible()
    await expect(prev).toBeEnabled()

    await prev.click()
    await expect(page.getByText('1 / 20')).toBeVisible()
  })

  test('the last question swaps next for finish', async ({ page }) => {
    await page.goto('/test/t10-5')
    for (let i = 0; i < 9; i++) {
      await page.getByRole('button', { name: /Keyingi|Next/ }).click()
    }
    await expect(page.getByText('10 / 10')).toBeVisible()
    await expect(page.getByRole('button', { name: /Keyingi|Next/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Yakunlash|Finish/ })).toBeVisible()
  })

  test('the slider jumps to any question and survives a reload', async ({ page }) => {
    await page.goto('/test/t20-1')
    await page.getByRole('tab').nth(11).click()
    await expect(page.getByText('12 / 20')).toBeVisible()

    await page.waitForTimeout(400)
    await page.reload()
    await expect(page.getByText('12 / 20')).toBeVisible()
  })
})

test.describe('flag action', () => {
  test('toggles, marks the slider, and persists', async ({ page }) => {
    await page.goto('/test/t20-1')
    const flag = page.getByRole('button', { name: /Belgilab|Flag/ })

    await expect(flag).toHaveAttribute('aria-pressed', 'false')
    await flag.click()
    await expect(flag).toHaveAttribute('aria-pressed', 'true')

    await page.waitForTimeout(400)
    const flagged = await page.evaluate(
      () => JSON.parse(localStorage.getItem('eavtomaktab:progress')!).activeSession?.flagged ?? [],
    )
    expect(flagged).toHaveLength(1)

    await flag.click()
    await expect(flag).toHaveAttribute('aria-pressed', 'false')
  })
})

test.describe('submit action', () => {
  test('cancel returns to the test without submitting', async ({ page }) => {
    await page.goto('/test/t10-5')
    for (let i = 0; i < 9; i++) await page.getByRole('button', { name: /Keyingi|Next/ }).click()

    await page.getByRole('button', { name: /Yakunlash|Finish/ }).click()
    await dialog(page).getByRole('button', { name: /Bekor qilish|Cancel/ }).click()

    await expect(dialog(page)).toBeHidden()
    expect(page.url()).toContain('/test/t10-5')
  })

  test('warns about unanswered questions and counts them wrong', async ({ page }) => {
    await page.goto('/test/t10-5')
    await answers(page).first().click()
    for (let i = 0; i < 9; i++) await page.getByRole('button', { name: /Keyingi|Next/ }).click()

    await page.getByRole('button', { name: /Yakunlash|Finish/ }).click()
    await expect(dialog(page).getByText(/9 ta savol javobsiz/)).toBeVisible()

    await dialog(page).getByRole('button', { name: /Yakunlash|Finish/ }).click()
    await expect(page).toHaveURL(/\/results\//)
    // 9 blanks are wrong, so at most 1 correct
    await expect(page.getByText('/10')).toBeVisible()
  })
})

test.describe('no runaway writes', () => {
  // regression: persist() once fed its own dependency and looped thousands of
  // times a second, which starved the debounced save and froze every button
  for (const mode of MODES) {
    test(`${mode.label}: sitting idle writes to storage a handful of times, not endlessly`, async ({
      page,
    }) => {
      await page.addInitScript(() => {
        const orig = Storage.prototype.setItem
        ;(window as unknown as { __writes: number }).__writes = 0
        Storage.prototype.setItem = function (k: string, v: string) {
          if (k === 'eavtomaktab:progress') (window as unknown as { __writes: number }).__writes++
          return orig.call(this, k, v)
        }
      })

      await page.goto(mode.route)
      await expect(answers(page).first()).toBeVisible()
      await page.waitForTimeout(2000)

      const writes = await page.evaluate(() => (window as unknown as { __writes: number }).__writes)
      expect(writes).toBeLessThan(10)
    })
  }
})
