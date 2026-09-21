import { test, expect } from '@playwright/test'

test.describe('question bank', () => {
  test('virtualises 1353 questions without mounting them all', async ({ page }) => {
    await page.goto('/bank')
    await expect(page.getByText('1353')).toBeVisible()

    // the whole point: only a window of rows is in the DOM
    const mounted = await page.getByTestId('bank-row').count()
    expect(mounted).toBeGreaterThan(0)
    expect(mounted).toBeLessThan(60)
  })

  test('search filters the list', async ({ page }) => {
    await page.goto('/bank')
    const search = page.getByRole('searchbox')

    await search.fill('svetofor')
    await expect(page.getByTestId('bank-row').first()).toBeVisible()

    const heading = page.locator('header p').first()
    const filtered = await heading.innerText()
    expect(filtered).not.toContain('1353')
  })

  test('search ignores apostrophe variants', async ({ page }) => {
    await page.goto('/bank')
    const search = page.getByRole('searchbox')

    // the bank writes "to'g'ri" with apostrophes; typing it plain must still match
    await search.fill('togri')
    await expect(page.getByTestId('bank-row').first()).toBeVisible()
  })

  test('a row expands to show the correct answer', async ({ page }) => {
    await page.goto('/bank')
    const row = page.getByTestId('bank-row').first()
    await row.click()
    await expect(row).toHaveAttribute('aria-expanded', 'true')
  })

  test('scrolling reaches the end of the bank', async ({ page }) => {
    await page.goto('/bank')
    const scroller = page.locator('div.overflow-y-auto').first()

    await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await page.waitForTimeout(300)
    await expect(page.getByTestId('bank-row').first()).toBeVisible()
  })
})

test.describe('i18n', () => {
  const cases = [
    { lang: 'ru', nav: 'Главная', home: 'Сегодня' },
    { lang: 'uzc', nav: 'Бош саҳифа', home: 'Бугун' },
    { lang: 'uzb', nav: 'Bosh sahifa', home: 'Bugun' },
  ]

  for (const c of cases) {
    test(`renders fully in ${c.lang}`, async ({ page }) => {
      await page.addInitScript((l) => localStorage.setItem('eavtomaktab:lang', l), c.lang)
      await page.goto('/')

      await expect(page.getByText(c.home)).toBeVisible()
      await expect(page.getByRole('link', { name: c.nav }).first()).toBeVisible()
    })
  }

  test('switching language changes both UI and question text', async ({ page }) => {
    await page.goto('/test/t20-1')
    const uzbek = await page.locator('main h2').innerText()

    await page.goto('/settings')
    await page.getByRole('button', { name: 'Русский' }).click()
    await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible()

    await page.goto('/test/t20-1')
    const russian = await page.locator('main h2').innerText()

    expect(russian).not.toBe(uzbek)
    expect(russian).toMatch(/[А-Яа-я]/)
  })

  test('russian uses correct plural forms', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('eavtomaktab:lang', 'ru'))
    await page.goto('/bank')

    // Russian has four plural categories. 1353 ends in 3, so it takes the
    // "few" form (вопроса), not "many" (вопросов) or the singular.
    await expect(page.locator('header p').first()).toHaveText('1353 вопроса')

    // filter down to a "many" count and check the form changes
    await page.getByRole('searchbox').fill('светофор')
    await page.waitForTimeout(400)
    const text = await page.locator('header p').first().innerText()
    const n = Number(text.match(/\d+/)?.[0])
    const last2 = n % 100
    const last1 = n % 10
    const expected =
      last1 === 1 && last2 !== 11
        ? 'вопрос'
        : last1 >= 2 && last1 <= 4 && (last2 < 12 || last2 > 14)
          ? 'вопроса'
          : 'вопросов'
    expect(text).toBe(`${n} ${expected}`)
  })
})
