import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { sceneThemes } from '../../src/lib/scene-themes'

const origin = process.env.THEME_TEST_ORIGIN || 'http://localhost:3127'
const viewports = [{ width: 1440, height: 900 }, { width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]

test('every landscape: desktop, narrow mobile, portrait and landscape; keyboard, home panel, motion and persistence', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const picker = page.getByRole('combobox', { name: 'Background scenery' })
  await expect(picker).toHaveValue('automatic')
  await expect(picker).toBeEnabled()
  await page.getByRole('link', { name: 'ai-zeroth home' }).focus()
  await page.keyboard.press('Tab')
  await expect(picker).toBeFocused()
  // Native select type-ahead is keyboard-operable on macOS/headless Chromium;
  // arrow popup navigation belongs to the OS and is not exposed to Playwright.
  await page.keyboard.press('m')
  await page.keyboard.press('Enter')
  await expect(picker).toHaveValue('moonwell')
  for (const theme of Object.keys(sceneThemes)) {
    await picker.selectOption(theme)
    await expect(page.locator('.site')).toHaveAttribute('data-theme', theme)
    await page.reload()
    await expect(picker).toHaveValue(theme)
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
      await expect(picker).toBeInViewport({ ratio: 1 })
      await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
      await page.getByRole('button', { name: 'Sign in', exact: true }).scrollIntoViewIfNeeded()
      await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeInViewport()
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `test-results/themes/${theme}-${viewport.width}.png` })
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const theme of Object.keys(sceneThemes)) {
    await picker.selectOption(theme)
    expect(await page.locator('.world-scene').evaluate(el => [...el.querySelectorAll('*')].every(node => getComputedStyle(node).animationName === 'none'))).toBe(true)
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  expect(await page.locator('.campfire-flame-rest').evaluate(el => getComputedStyle(el).animationName)).not.toBe('none')
  expect(errors).toEqual([])
})

test('authorized profile mapping, live race changes, manual precedence, campfire sharing and signed-out fallback', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: origin })
  let id = ''
  try {
    const response = await context.request.post('/api/auth/sign-up/email', { headers: { origin }, data: { name: 'SyntheticThemeTester', email: `themes-${crypto.randomUUID()}@example.test`, password: 'Synthetic-local-password-123!' } })
    expect(response.status(), await response.text()).toBe(200)
    id = (await response.json()).user.id
    const save = async (race: string) => {
      const result = await context.request.put('/api/campfire/profile', { headers: { origin }, data: { nickname: 'SyntheticThemeTester', faction: 'Alliance', race, characterClass: 'Priest', professions: [], bio: 'Local scenery test', published: true } })
      expect(result.status(), await result.text()).toBe(200)
    }
    const empty = await context.newPage()
    await empty.goto('/')
    await expect(empty.getByRole('button', { name: 'My account' })).toBeVisible()
    await expect(empty.locator('.site')).toHaveAttribute('data-theme', 'moonwell')
    await empty.close()
    await save('Night Elf')
    const page = await context.newPage()
    await page.goto('/')
    const picker = page.getByRole('combobox', { name: 'Background scenery' })
    const site = page.locator('.site')
    await expect(site).toHaveAttribute('data-theme', 'darnassus')
    for (const route of ['/account', '/guilds', '/guilds/new', '/signup', '/']) {
      await page.goto(route)
      await expect(page.locator('.app-theme')).toHaveAttribute('data-theme', 'darnassus')
      await expect(page.locator('.world-scene [data-landscape]').first()).toHaveAttribute('data-landscape', 'darnassus')
    }
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await expect(picker).toBeInViewport({ ratio: 1 })
      await page.getByRole('navigation', { name: 'Adventures' }).getByRole('link', { name: /Characters/ }).scrollIntoViewIfNeeded()
      await expect(page.getByRole('navigation', { name: 'Adventures' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.setViewportSize(viewports[0])
    for (const [race, theme] of [['Orc', 'durotar'], ['Troll', 'durotar'], ['Tauren', 'mulgore'], ['Undead', 'tirisfal'], ['Human', 'elwynn'], ['Dwarf', 'dunmorogh'], ['Gnome', 'dunmorogh'], ['Skyborne', 'moonwell'], ['Undecided', 'moonwell'], ['Unknown', 'moonwell']]) {
      await save(race)
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await expect(site).toHaveAttribute('data-theme', theme)
    }
    await picker.selectOption('tavern')
    await save('Orc')
    await page.reload()
    await expect(site).toHaveAttribute('data-theme', 'tavern')
    await picker.selectOption('automatic')
    await expect(site).toHaveAttribute('data-theme', 'durotar')
    // Local-only membership lets the real room and authorized DTO render together.
    execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', '--local', '--command', `INSERT INTO campfire_memberships(guild_id,user_id) VALUES('synthetic-themes','${id}')`], { stdio: 'pipe' })
    await page.goto('/campfire')
    await expect(page.locator('.guild-app')).toHaveAttribute('data-theme', 'durotar')
    await expect(page.locator('.guild-scene [data-landscape]')).toHaveAttribute('data-landscape', 'durotar')
    await expect(page.getByText('1 by the fire')).toBeVisible()
    for (const theme of Object.keys(sceneThemes)) {
      await picker.selectOption(theme)
      await expect(page.locator('.guild-app')).toHaveAttribute('data-theme', theme)
      for (const viewport of viewports) {
        await page.setViewportSize(viewport)
        await expect(picker).toBeInViewport({ ratio: 1 })
        await expect(page.getByRole('button', { name: '👋 wave' })).toBeInViewport()
        expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      }
      await page.setViewportSize(viewports[0])
      await page.screenshot({ path: `test-results/themes/campfire-${theme}.png` })
    }
    await page.setViewportSize(viewports[0])
    await picker.selectOption('automatic')
    await page.getByRole('button', { name: 'Edit character' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('textbox', { name: 'Planned race', exact: true }).fill('Night Elf')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Save character' }).click()
    await expect(page.locator('.guild-app')).toHaveAttribute('data-theme', 'darnassus')
    await context.request.post('/api/auth/sign-out', { headers: { origin }, data: {} })
    await page.goto('/')
    await expect(site).toHaveAttribute('data-theme', 'moonwell')
    expect(await context.request.get('/api/campfire/me').then(r => r.status())).toBe(401)
  } finally {
    await context.close()
    if (id) execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', '--local', '--command', `DELETE FROM user WHERE id='${id}'`], { stdio: 'pipe' })
  }
})

test('manual themes persist through app routes, links, reload and browser history', async ({ page }) => {
  await page.goto('/')
  const routes = ['/signup', '/login', '/register', '/guilds', '/guilds/unknown-theme-test', '/signup?guild=unknown-theme-test']
  for (const theme of Object.keys(sceneThemes)) {
    await page.goto('/')
    await page.getByRole('combobox', { name: 'Background scenery' }).selectOption(theme)
    for (const route of routes) {
      await page.goto(route)
      await expect(page.locator('.app-theme')).toHaveAttribute('data-theme', theme)
      if (theme !== 'moonwell' && theme !== 'tavern') await expect(page.locator('.world-scene [data-landscape]').first()).toHaveAttribute('data-landscape', theme)
      expect(await page.locator('.site').evaluate(el => getComputedStyle(el).getPropertyValue('--sky-top').trim())).toBe(sceneThemes[theme as keyof typeof sceneThemes].palette['--sky-top'])
    }
    await page.reload()
    await expect(page.locator('.app-theme')).toHaveAttribute('data-theme', theme)
    await page.goBack()
    await expect(page.locator('.app-theme')).toHaveAttribute('data-theme', theme)
  }
  await page.goto('/')
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('.app-theme')).toHaveAttribute('data-theme', 'dunmorogh')
  await page.locator('.app-theme').evaluate(el => el.setAttribute('data-navigation-test', 'retained'))
  await page.getByRole('link', { name: 'Create an account', exact: true }).click()
  await expect(page).toHaveURL(/\/register/)
  await expect(page.locator('.app-theme')).toHaveAttribute('data-navigation-test', 'retained')
  await expect(page.locator('.app-theme')).toHaveAttribute('data-theme', 'dunmorogh')
})

test('storage denied, corrupt legacy storage, cross-tab updates and unavailable profile are safe', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: origin })
  const page = await context.newPage()
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError') } }) })
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Background scenery' }).selectOption('elwynn')
  await expect(page.locator('.site')).toHaveAttribute('data-theme', 'elwynn')
  await page.reload()
  await expect(page.locator('.site')).toHaveAttribute('data-theme', 'moonwell')
  await context.close()
  const normal = await browser.newContext({ baseURL: origin })
  try {
    const a = await normal.newPage(); const b = await normal.newPage()
    await a.goto('/')
    await a.evaluate(() => localStorage.setItem('ai-zeroth-theme', 'tavern'))
    await a.reload()
    await expect(a.getByRole('combobox')).toHaveValue('tavern')
    await b.goto('/')
    await a.getByRole('combobox').selectOption('dunmorogh')
    await expect(b.locator('.site')).toHaveAttribute('data-theme', 'dunmorogh')
    await a.evaluate(() => localStorage.setItem('ai-zeroth-theme', 'corrupt'))
    await a.reload()
    await expect(a.getByRole('combobox')).toHaveValue('automatic')
    // Synthetic session boundary + failed private API, no anonymous/email lookup.
    await a.route('**/api/auth/get-session**', route => route.fulfill({ json: { session: { id: 'synthetic' }, user: { id: 'synthetic', name: 'Local' } } }))
    await a.route('**/api/campfire/me', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }))
    const failedProfile = a.waitForResponse(response => response.url().endsWith('/api/campfire/me') && response.status() === 503)
    await a.reload()
    await failedProfile
    await expect(a.locator('.site')).toHaveAttribute('data-theme', 'moonwell')
    await a.getByRole('combobox').selectOption('mulgore')
    await expect(a.locator('.site')).toHaveAttribute('data-theme', 'mulgore')
  } finally { await normal.close() }
})
