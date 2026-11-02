import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

// Run against a dedicated local D1 server; optional providers use synthetic config.
// No email is sent: the reset request uses an unknown address, and a token fixture
// exercises the actual reset endpoint. Google authorization is intercepted before
// contacting Google, so these checks do not claim a real OAuth callback/delivery.
const origin = process.env.AUTH_TEST_ORIGIN || 'http://localhost:3142'
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Local verification only')
const browser = await chromium.launch()
const context = await browser.newContext({ baseURL: origin })
const page = await context.newPage()
const errors = []
const userIds = [], guildIds = []
const email = `${randomUUID()}@example.invalid`
const password = 'Synthetic-home-password-1234'
const newPassword = 'Replacement-home-password-5678'
const quote = value => `'${String(value).replaceAll("'", "''")}'`
page.on('pageerror', error => errors.push(error.message))
function sql(command) {
  const result = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', '--local', '--command', command], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
}
async function login(secret = password) {
  await page.goto('/')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(secret)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Adventures', exact: true })).toBeVisible()
}
try {
  await mkdir('test-results', { recursive: true })
  for (const route of ['/characters', '/guild', '/calendar']) {
    const response = await context.request.get(route, { maxRedirects: 0 })
    assert.equal(response.status(), 307)
    assert.match(response.headers().location, /\/login/)
  }
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
    await expect(page.locator('.signup-qr')).toHaveCount(0)
    await page.getByRole('link', { name: 'Forgot your password?' }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('link', { name: 'Forgot your password?' })).toBeInViewport()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true)
    await page.getByRole('button', { name: 'Sign in', exact: true }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeInViewport()
    await page.screenshot({ path: `test-results/home-guest-${width}.png` })
  }
  console.log('PASS signed-out login panel, no QR, protected destinations, narrow mobile/landscape controls')
  await page.goto('/')
  await page.getByRole('link', { name: 'Create an account', exact: true }).click()
  await page.getByLabel('Name or nickname', { exact: true }).fill('Synthetic Home Adventurer')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await page.waitForURL(url => url.pathname === '/')
  await expect(page.getByRole('navigation', { name: 'Adventures', exact: true })).toBeVisible()
  const user = (await (await context.request.get('/api/auth/get-session')).json()).user
  userIds.push(user.id)
  await page.getByRole('navigation', { name: 'Adventures', exact: true }).getByRole('link', { name: /Characters/ }).click()
  await expect(page.getByText('No saved character yet.', { exact: false })).toBeVisible()
  const saved = await context.request.put('/api/campfire/profile', { headers: { Origin: origin }, data: { nickname: 'Saved Home Mage', faction: 'Alliance', race: 'Human', characterClass: 'Mage', professions: ['Alchemy'], bio: 'Synthetic local profile', published: false } })
  assert.equal(saved.status(), 200)
  await page.reload()
  await expect(page.getByText('Saved Home Mage', { exact: true })).toBeVisible()
  await page.goto('/guild')
  await expect(page.getByText('No approved guild memberships yet.', { exact: false })).toBeVisible()
  const guild = await context.request.post('/api/guilds', { headers: { Origin: origin }, data: { name: 'Synthetic Home Guild', faction: 'Alliance', region: 'Europe', description: 'Synthetic local home navigation guild.', publishConsent: true } })
  assert.equal(guild.status(), 200)
  guildIds.push((await guild.json()).path.split('/').at(-1))
  await page.reload()
  await expect(page.getByText('Synthetic Home Guild', { exact: true })).toBeVisible()
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Adventures', exact: true }).getByRole('link', { name: /Calendar/ }).click()
  await expect(page.getByRole('table')).toBeVisible()
  const month = await page.locator('.calendar-controls h2').innerText()
  await page.getByRole('button', { name: 'Next month' }).click()
  await expect(page.locator('.calendar-controls h2')).not.toHaveText(month)
  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(page.locator('.calendar-controls h2')).toHaveText(month)
  for (const [width, height] of [[1440, 900], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    const menu = page.getByRole('navigation', { name: 'Adventures', exact: true })
    await expect(menu.getByRole('link')).toHaveCount(3)
    await menu.getByRole('link', { name: /Calendar/ }).scrollIntoViewIfNeeded()
    await expect(menu.getByRole('link', { name: /Calendar/ })).toBeInViewport()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: `test-results/home-member-${width}.png` })
  }
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Adventures', exact: true }).getByRole('link', { name: /Characters/ }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('navigation', { name: 'Adventures', exact: true }).getByRole('link', { name: /Guild/ })).toBeFocused()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  console.log('PASS register/login-to-home, saved character, approved guild, calendar browsing, keyboard menu and signout')

  await page.getByRole('link', { name: 'Forgot your password?' }).click()
  await page.waitForURL('**/forgot-password')
  await expect(page.getByRole('heading', { name: 'Find your way back.' })).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill(`missing-${randomUUID()}@example.invalid`)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByText('If an account can be recovered', { exact: false })).toBeVisible()
  await page.goto('/reset-password')
  await expect(page.getByRole('alert')).toContainText('missing, invalid or expired')
  const token = randomUUID()
  const now = Date.now()
  sql(`INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt) VALUES (${quote(randomUUID())}, ${quote(`reset-password:${token}`)}, ${quote(user.id)}, ${now + 3600000}, ${now}, ${now});`)
  await page.goto(`/reset-password?token=${token}`)
  await page.getByLabel('New password', { exact: true }).fill(newPassword)
  await page.getByLabel('Confirm new password', { exact: true }).fill('different-password-123')
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page.getByRole('alert')).toContainText('don’t match')
  await page.getByLabel('Confirm new password', { exact: true }).fill(newPassword)
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page.getByText('Your password has been updated.', { exact: false })).toBeVisible()
  assert.equal(new URL(page.url()).search, '')
  await page.goto('/')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect')
  await login(newPassword)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await page.goto(`/reset-password?token=${token}`)
  await page.getByLabel('New password', { exact: true }).fill(newPassword)
  await page.getByLabel('Confirm new password', { exact: true }).fill(newPassword)
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page.getByRole('alert')).toContainText('expired or already been used')
  console.log('PASS generic recovery request, missing token, mismatch, real D1 password reset, old password rejection, new login and token reuse rejection')

  let socialBody
  await page.route('**/api/auth/sign-in/social', async route => { socialBody = route.request().postDataJSON(); await route.continue() })
  await context.route('https://accounts.google.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic Google authorization boundary</h1>' }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await page.waitForURL(url => url.hostname === 'accounts.google.com')
  assert.equal(socialBody.provider, 'google')
  assert.equal(socialBody.callbackURL, '/')
  assert.equal(new URL(page.url()).searchParams.get('redirect_uri'), `${origin}/api/auth/callback/google`)
  await page.goto('/login?oauthError=1')
  await expect(page.getByRole('alert')).toContainText('Google sign-in wasn’t completed')
  assert.deepEqual(errors, [])
  console.log('PASS Google button → real Better Auth authorization/PKCE redirect (Google boundary mocked), callback failure feedback; no browser errors')
} finally {
  await context.close()
  await browser.close()
  if (guildIds.length || userIds.length) sql(`${guildIds.length ? `DELETE FROM guilds WHERE id IN (${guildIds.map(quote).join(',')});` : ''} ${userIds.length ? `DELETE FROM user WHERE id IN (${userIds.map(quote).join(',')});` : ''}`)
}
