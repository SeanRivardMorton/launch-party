import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const origin = process.env.AUTH_TEST_ORIGIN || 'http://localhost:3153'
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Local verification only')
const browser = await chromium.launch()
const context = await browser.newContext({ baseURL: origin })
const page = await context.newPage()
const errors = []
let userId = ''
page.on('pageerror', error => errors.push(error.message))
await context.addInitScript(() => {
  window.__documentMarker = crypto.randomUUID()
  window.__transitionCount = 0
  window.__samples = []
  const start = document.startViewTransition?.bind(document)
  if (!start) return
  document.startViewTransition = (...args) => {
    const transition = start(...args)
    window.__transitionCount++
    window.__transitionFinished = transition.finished
    transition.ready.then(async () => {
      const animation = document.getAnimations().find(item => item.animationName?.includes('group-anim-scene-panel'))
      if (!animation) return
      animation.pause()
      const frames = animation.effect.getKeyframes()
      animation.currentTime = 150
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      window.__samples.push({ from: frames[0].height, to: frames.at(-1).height,
        middle: getComputedStyle(document.documentElement, '::view-transition-group(scene-panel)').height })
      animation.play()
    }).catch(() => {})
    return transition
  }
})
async function settle() {
  await page.evaluate(() => window.__transitionFinished)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.waitForFunction(() => !document.getAnimations().some(animation => animation.playState === 'running' && (/scene-panel|panel-in|panel-out/.test(animation.animationName || '') || animation.effect?.target?.classList?.contains('scene-panel'))))
  await expect(page.locator('[data-resizing]')).toHaveCount(0)
}
try {
  await mkdir('test-results', { recursive: true })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Background scenery' }).selectOption('tirisfal')
  await settle()
  const marker = await page.evaluate(() => window.__documentMarker)
  const themeProvider = await page.locator('.app-theme').evaluate(node => { node.dataset.transitionTest = 'retained'; return node.dataset.transitionTest })
  await page.getByRole('link', { name: 'Create an account', exact: true }).click()
  await page.waitForURL('**/register?returnTo=%2F')
  await settle()
  assert.equal(await page.evaluate(() => window.__documentMarker), marker)
  await expect(page.locator('.app-theme')).toHaveAttribute('data-transition-test', themeProvider)
  await expect(page.locator('.app-theme')).toHaveAttribute('data-theme', 'tirisfal')
  await expect(page.getByRole('heading', { name: 'Your next adventure.' })).toBeFocused()
  const samples = await page.evaluate(() => window.__samples)
  assert(samples.length > 0, 'A native shared-panel transition was captured')
  const resizing = samples.find(sample => Math.abs(parseFloat(sample.from) - parseFloat(sample.to)) > 4)
  assert(resizing, JSON.stringify(samples))
  const from = parseFloat(resizing.from), to = parseFloat(resizing.to), middle = parseFloat(resizing.middle)
  assert(middle > Math.min(from, to) && middle < Math.max(from, to), `Intermediate panel height: ${JSON.stringify(resizing)}`)
  await page.locator('.account-switch').getByRole('link', { name: 'Sign in', exact: true }).click()
  await settle()
  await page.getByRole('link', { name: 'Forgot your password?' }).click()
  await expect(page.getByRole('heading', { name: 'Find your way back.' })).toBeFocused()
  await settle()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await settle()
  assert.equal(await page.evaluate(() => window.__documentMarker), marker)
  console.log('PASS login/register/recovery/back navigation: interpolated panel bounds, retained document/theme, heading focus')

  // Observe a real same-page form-step resize, not a navigation snapshot.
  await page.goto('/signup')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Your name or nickname').fill('Transition Check')
  await page.getByLabel('Email', { exact: true }).fill(`${randomUUID()}@example.invalid`)
  await settle()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.scene-panel')?.getAnimations().some(animation => animation.effect.getKeyframes().some(frame => frame.height)))
  const frames = await page.locator('.scene-panel').evaluate(node => node.getAnimations()[0].effect.getKeyframes().map(frame => frame.height))
  assert.notEqual(frames[0], frames.at(-1))
  await settle()
  console.log('PASS in-form content change animates height and returns to natural sizing')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  const before = await page.evaluate(() => window.__transitionCount)
  await page.getByRole('link', { name: 'Create an account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your next adventure.' })).toBeVisible()
  assert.equal(await page.evaluate(() => window.__transitionCount), before)
  await expect(page.locator('[data-resizing]')).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  console.log('PASS reduced motion disables route and content animation')

  const email = `${randomUUID()}@example.invalid`
  const signup = await context.request.post('/api/auth/sign-up/email', { headers: { origin }, data: { name: 'Synthetic Transition User', email, password: 'Synthetic-transition-password-1234' } })
  assert.equal(signup.status(), 200)
  userId = (await signup.json()).user.id
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Adventures', exact: true })).toBeVisible()
  const authMarker = await page.evaluate(() => window.__documentMarker)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-transition-password-1234')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Adventures', exact: true })).toBeVisible()
  assert.equal(await page.evaluate(() => window.__documentMarker), authMarker)
  await settle()
  for (const name of ['Characters', 'Guild', 'Calendar']) {
    const currentMarker = await page.evaluate(() => window.__documentMarker)
    await page.getByRole('navigation', { name: 'Adventures', exact: true }).getByRole('link', { name: new RegExp(name) }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(`Your ${name.toLowerCase()}`)
    await settle()
    assert.equal(await page.evaluate(() => window.__documentMarker), currentMarker)
    await page.getByRole('navigation', { name: 'Adventures' }).getByRole('link', { name: 'Home', exact: true }).click()
    await settle()
  }
  for (const [width, height] of [[320, 568], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width, height })
    await page.getByRole('navigation', { name: 'Adventures', exact: true }).getByRole('link', { name: /Characters/ }).click()
    await expect(page.getByText('No saved character yet.', { exact: false })).toBeVisible()
    await settle()
    await page.getByRole('navigation', { name: 'Adventures' }).getByRole('link', { name: 'Home', exact: true }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeInViewport()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: `test-results/transitions-${width}.png` })
    await page.getByRole('link', { name: 'Home', exact: true }).click()
    await settle()
  }
  console.log('PASS signed-in Characters/Guild/Calendar, mobile/landscape layout and controls')

  const fallback = await browser.newContext({ baseURL: origin })
  await fallback.addInitScript(() => { document.startViewTransition = undefined })
  const plain = await fallback.newPage()
  await plain.goto('/')
  await plain.getByRole('link', { name: 'Create an account', exact: true }).click()
  await expect(plain.getByRole('heading', { name: 'Your next adventure.' })).toBeVisible()
  await fallback.close()
  assert.deepEqual(errors, [])
  console.log('PASS unsupported View Transition API fallback; no browser errors')
} finally {
  await context.close(); await browser.close()
  if (userId) {
    const result = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', '--local', '--command', `DELETE FROM user WHERE id='${userId.replaceAll("'", "''")}';`], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
}
