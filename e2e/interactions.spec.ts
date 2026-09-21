import { test, expect, type Page } from '@playwright/test'

const options = (page: Page) => page.getByTestId('answer-option')

/**
 * Answers every question, whatever order auto-advance leaves us in.
 *
 * Jumps to the first tab still marked unanswered rather than walking forwards:
 * a correct answer advances on its own, so a plain answer/next loop skips one.
 */
async function answerAll(page: Page, total: number) {
  // the strip has to exist first, or "no unanswered tabs" reads as "all done"
  await expect(page.getByRole('tab')).toHaveCount(total)

  for (let guard = 0; guard < total * 3; guard++) {
    const unanswered = await page
      .getByRole('tab')
      .evaluateAll((els) =>
        els.findIndex((el) => !(el.getAttribute('aria-label') ?? '').includes('answered')),
      )
    if (unanswered === -1) return

    await page.getByRole('tab').nth(unanswered).click()
    await page.waitForTimeout(150)
    const opt = options(page).first()
    if (await opt.isEnabled()) await opt.click()
    await page.waitForTimeout(250)
  }
  throw new Error('could not answer every question')
}

test.describe('auto-advance on a correct answer', () => {
  test('a correct answer moves to the next question by itself', async ({ page }) => {
    await page.goto('/test/t20-1')
    await expect(page.getByText('1 / 20')).toBeVisible()

    // click through options until one is correct; a wrong pick locks the
    // question, so move on manually and try the next one
    for (let q = 0; q < 6; q++) {
      const at = await page.locator('header p.text-xs').innerText()
      await options(page).first().click()

      const correct = await page.locator('[data-testid="answer-option"][data-state="correct"][aria-pressed="true"]').count()
      if (correct > 0) {
        // it should advance on its own, without any further click
        await expect(page.locator('header p.text-xs')).not.toHaveText(at, { timeout: 4000 })
        return
      }
      await page.getByRole('button', { name: /Keyingi|Next/ }).click()
    }
    test.skip(true, 'no correct first-option answer found in six questions')
  })

  test('a wrong answer stays put so the right one can be read', async ({ page }) => {
    await page.goto('/test/t20-1')

    for (let q = 0; q < 6; q++) {
      const at = await page.locator('header p.text-xs').innerText()
      await options(page).first().click()

      const wrong = await page.locator('[data-testid="answer-option"][data-state="incorrect"]').count()
      if (wrong > 0) {
        await page.waitForTimeout(2000)
        // still on the same question - the correct answer is on screen to study
        await expect(page.locator('header p.text-xs')).toHaveText(at)
        await expect(page.locator('[data-testid="answer-option"][data-state="correct"]')).toHaveCount(1)
        return
      }
      await page.getByRole('button', { name: /Keyingi|Next/ }).click()
    }
    test.skip(true, 'no wrong first-option answer found in six questions')
  })
})

test.describe('question slider', () => {
  test('hides the scroll buttons when everything already fits', async ({ page, isMobile }) => {
    test.skip(isMobile, 'touch devices swipe instead')
    await page.goto('/test/t10-5')
    await expect(page.getByTestId('slider-next')).toBeHidden()
  })

  test('renders every question and jumps on click', async ({ page }) => {
    await page.goto('/test/t20-1')
    await expect(page.getByRole('tab')).toHaveCount(20)

    await page.getByRole('tab').nth(6).click()
    await expect(page.getByText('7 / 20')).toBeVisible()
  })

  test('has scroll buttons on desktop when the strip overflows', async ({ page, isMobile }) => {
    test.skip(isMobile, 'touch devices swipe instead')
    // 20 tabs overflow the 736px strip; 10 would fit and Swiper would lock
    await page.goto('/test/t20-1')

    await expect(page.getByTestId('slider-next')).toBeVisible()
    const before = await page.getByRole('tab').first().boundingBox()

    await page.getByTestId('slider-next').click()
    await page.waitForTimeout(500)

    const after = await page.getByRole('tab').first().boundingBox()
    // the strip moved left, so the first tab is further off-screen
    expect(after!.x).toBeLessThan(before!.x)
  })

  test('responds to the mouse wheel', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no wheel on touch devices')
    await page.goto('/test/t20-1')

    const strip = page.getByRole('tablist')
    const before = await page.getByRole('tab').first().boundingBox()

    await strip.hover()
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(500)

    const after = await page.getByRole('tab').first().boundingBox()
    expect(after!.x).toBeLessThan(before!.x)
  })

  test('keeps the current question in view when it changes', async ({ page }) => {
    await page.goto('/test/t20-1')
    await page.getByRole('tab').nth(18).click()
    await page.waitForTimeout(600)

    const current = page.getByRole('tab').nth(18)
    await expect(current).toBeInViewport()
  })
})

test.describe('completion summary', () => {
  test('appears once every question is answered, with the tally', async ({ page }) => {
    await page.goto('/test/t10-5')
    await answerAll(page, 10)

    const dialog = page.getByTestId('completion-dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })
    await expect(dialog.getByTestId('replay')).toBeVisible()
    await expect(dialog.getByTestId('complete')).toBeVisible()
    await expect(dialog.getByText('/ 10')).toBeVisible()
  })

  test('the tally adds up to the number of questions', async ({ page }) => {
    await page.goto('/test/t10-5')
    await answerAll(page, 10)

    const dialog = page.getByTestId('completion-dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })

    const numbers = await dialog.locator('p.text-3xl').allInnerTexts()
    const [correct, wrong] = numbers.map(Number)
    expect(correct + wrong).toBe(10)
  })

  test('it does not submit on its own - dismissing keeps the test open', async ({ page }) => {
    await page.goto('/test/t10-5')
    await answerAll(page, 10)
    await expect(page.getByTestId('completion-dialog')).toBeVisible({ timeout: 8000 })

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('completion-dialog')).toBeHidden()
    expect(page.url()).toContain('/test/t10-5')
  })

  test('complete submits and goes to results', async ({ page }) => {
    await page.goto('/test/t10-5')
    await answerAll(page, 10)
    await expect(page.getByTestId('completion-dialog')).toBeVisible({ timeout: 8000 })

    await page.getByTestId('complete').click()
    await expect(page).toHaveURL(/\/results\//)
    await expect(page.getByText('/10')).toBeVisible()
  })

  test('replay clears the answers and restarts the same test', async ({ page }) => {
    await page.goto('/test/t10-5')
    await answerAll(page, 10)
    await expect(page.getByTestId('completion-dialog')).toBeVisible({ timeout: 8000 })

    await page.getByTestId('replay').click()
    await expect(page.getByTestId('completion-dialog')).toBeHidden()

    await expect(page.getByText('1 / 10')).toBeVisible()
    expect(page.url()).toContain('/test/t10-5')
    await expect(
      page.locator(
        '[data-testid="answer-option"][data-state="correct"], [data-testid="answer-option"][data-state="incorrect"]',
      ),
    ).toHaveCount(0)
    // and the slider is clean too
    const answered = await page
      .getByRole('tab')
      .evaluateAll((els) => els.filter((e) => (e.getAttribute('aria-label') ?? '').includes('answered')).length)
    expect(answered).toBe(0)
  })
})

test.describe('timer pause', () => {
  test('training: clicking the timer stops and restarts the clock', async ({ page }) => {
    await page.goto('/test/t20-1')

    const timer = page.getByTestId('timer')
    await expect(timer).toHaveAttribute('data-paused', 'false')

    await timer.click()
    await expect(timer).toHaveAttribute('data-paused', 'true')

    const frozen = await timer.innerText()
    await page.waitForTimeout(2500)
    expect(await timer.innerText()).toBe(frozen)

    await timer.click()
    await expect(timer).toHaveAttribute('data-paused', 'false')
    await page.waitForTimeout(1500)
    expect(await timer.innerText()).not.toBe(frozen)
  })

  test('training: paused time is not deducted', async ({ page }) => {
    await page.goto('/test/t20-1')
    const timer = page.getByTestId('timer')

    await timer.click()
    const at = await timer.innerText()
    await page.waitForTimeout(3000)
    await timer.click()

    // resuming continues from where it stopped, give or take a tick
    const [m, s] = at.replace(/[^\d:]/g, '').split(':').map(Number)
    const resumed = (await timer.innerText()).replace(/[^\d:]/g, '').split(':').map(Number)
    const diff = m * 60 + s - (resumed[0] * 60 + resumed[1])
    expect(diff).toBeLessThanOrEqual(1)
  })

  test('exam: the timer cannot be paused', async ({ page }) => {
    await page.goto('/test/exam')
    // rendered as a plain readout, not a button
    await expect(page.getByTestId('timer')).toHaveCount(0)
    await expect(page.getByRole('timer')).toBeVisible()
  })
})
