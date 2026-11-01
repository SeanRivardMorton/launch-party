import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { encode } from 'fast-png'
import { chromium, expect } from '@playwright/test'

const origin = process.env.AUTH_TEST_ORIGIN || 'http://localhost:3137'
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Local D1 only')
const browser = await chromium.launch()
const users = [], emails = [], guilds = [], contexts = []
let avatarKey
function localObject(action, key, file) {
  const result = spawnSync('pnpm', ['exec', 'wrangler', 'r2', 'object', action, `launch-party-avatars/${key}`, '--local', ...(file ? ['--file', file] : [])], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
}
const quote = value => `'${String(value).replaceAll("'", "''")}'`
function sql(command) {
  const result = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', '--local', '--json', '--command', command], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
}
async function actor(name) {
  const context = await browser.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } })
  contexts.push(context)
  const email = `${randomUUID()}@example.invalid`
  emails.push(email)
  const response = await context.request.post('/api/auth/sign-up/email', { data: { name, email, password: randomBytes(24).toString('hex') } })
  assert.equal(response.status(), 200)
  const { user } = await response.json()
  users.push(user.id)
  return { context, id: user.id, email }
}
const profile = nickname => ({ nickname, faction: 'Horde', race: 'Orc', characterClass: 'Mage', fulfilledRoles: ['Damage'], professions: ['Alchemy', 'Tailoring'] })
async function action(actor, id, data) {
  const response = await actor.context.request.post(`/api/guilds/${id}/community`, { data })
  assert.equal(response.status(), 200, await response.text())
}
async function overview(actor, query = '') {
  const response = await actor.context.request.get(`/api/account/overview${query}`)
  assert.equal(response.status(), 200)
  assert.match(response.headers()['cache-control'], /no-store/)
  return response.json()
}
try {
  const member = await actor('Private Account Name')
  const lead = await actor('Other Account Name')
  const outsider = await actor('New Account Name')
  const anonymous = await browser.newContext({ baseURL: origin })
  contexts.push(anonymous)
  const rejected = await anonymous.request.get('/api/account/overview')
  assert.equal(rejected.status(), 401)
  assert.match(rejected.headers()['cache-control'], /no-store/)
  for (let i = 0; i < 3; i++) {
    const id = randomUUID(); guilds.push(id)
    const created = await lead.context.request.post('/api/guilds', { data: { submissionId: id, managementKey: randomBytes(32).toString('hex'), name: `Synthetic Overview Guild ${i}`, faction: 'Horde', region: 'Europe', description: 'Synthetic account overview verification guild.', publishConsent: true } })
    assert.equal(created.status(), 200, await created.text())
    await action(member, id, { action: 'apply', profile: profile(`Guild Character ${i}`) })
    if (i < 2) await action(lead, id, { action: 'approve', userId: member.id })
  }
  const saved = await member.context.request.put('/api/campfire/profile', { data: { nickname: 'Saved Campfire Name', faction: 'Alliance', race: 'Dwarf', characterClass: 'Priest', professions: ['Mining'], bio: 'Private unpublished plan.', published: false } })
  assert.equal(saved.status(), 200)
  await mkdir('test-results', { recursive: true })
  await writeFile('test-results/account-avatar-fixture.png', encode({ width: 2, height: 2, channels: 4, data: new Uint8Array([90, 180, 120, 255, 90, 180, 120, 255, 90, 180, 120, 255, 90, 180, 120, 255]) }))
  avatarKey = `account-overview/${member.id}.png`
  localObject('put', avatarKey, 'test-results/account-avatar-fixture.png')
  sql(`INSERT INTO campfire_avatars(user_id,state,asset_key,asset_revision) VALUES(${quote(member.id)},'ready',${quote(avatarKey)},1)`)
  // A matching interest email and even a campfire-only grant must not become membership/profile data.
  sql(`INSERT INTO interest(id,email,name,role,need,consent_at) VALUES(${quote(randomUUID())},${quote(outsider.email)},'Never import this character','Tank','Guild','now'); INSERT INTO campfire_memberships(guild_id,user_id) VALUES(${quote(guilds[0])},${quote(outsider.id)});`)
  const state = await overview(member, `?userId=${outsider.id}`)
  assert.equal(state.campfire.nickname, 'Saved Campfire Name')
  assert.equal(state.campfire.published, false)
  assert.equal(state.memberships.length, 2)
  assert.deepEqual(state.memberships.map(m => m.profile.nickname).sort(), ['Guild Character 0', 'Guild Character 1'])
  assert.deepEqual(state.applications.map(a => a.status), ['pending'])
  assert(!JSON.stringify(state).includes(member.email))
  assert(!JSON.stringify(state).includes('asset_key'))
  assert(!JSON.stringify(state).includes('token'))
  assert.deepEqual(await overview(outsider, `?userId=${member.id}`), { campfire: null, memberships: [], applications: [] })
  assert.equal((await outsider.context.request.get(state.campfire.avatarUrl)).status(), 404)
  assert.equal((await anonymous.request.get(state.campfire.avatarUrl)).status(), 401)
  assert.equal((await overview(lead)).campfire, null)
  const publicResponse = await anonymous.request.get(`/api/guilds/${guilds[0]}`)
  const publicText = await publicResponse.text()
  for (const secret of ['Saved Campfire Name', 'Guild Character 0', member.email, 'Private unpublished plan.']) assert(!publicText.includes(secret))
  console.log('PASS real Better Auth/D1: owner isolation, ignored client IDs/interest/campfire-only grants, multiple memberships, pending separation, private DTO, anonymous 401/no-store')

  const page = await member.context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let releaseOverview
  const overviewGate = new Promise(resolve => { releaseOverview = resolve })
  await page.route('**/api/account/overview', async route => { await overviewGate; await route.continue() })
  await page.goto('/account')
  await expect(page.getByRole('status').filter({ hasText: 'Loading your characters' })).toBeVisible()
  releaseOverview()
  await expect(page.getByText('Saved Campfire Name', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Your saved campfire avatar' })).toBeVisible()
  await expect.poll(() => page.getByRole('img', { name: 'Your saved campfire avatar' }).evaluate(image => image.naturalWidth)).toBe(2)
  await page.unroute('**/api/account/overview')
  await expect(page.getByLabel('Name or nickname', { exact: true })).toHaveValue('Private Account Name')
  for (const text of ['Guild Character 0', 'Guild Character 1', 'Guild Character 2', 'Alchemy, Tailoring', 'Damage', 'Dwarf', 'Priest', 'Mining']) await expect(page.getByText(text, { exact: true }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByText('Saved Campfire Name', { exact: true })).toBeVisible()
  const trigger = page.getByRole('button', { name: 'My account', exact: false })
  await trigger.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('link', { name: 'My character(s)', exact: true })).toBeFocused()
  await expect(page.locator('#account-navigation').getByText('Synthetic Overview Guild 0 · guild hall')).toBeVisible()
  await page.locator('#account-navigation').getByText('Synthetic Overview Guild 0 · guild hall').click({ trial: true })
  assert.equal(await page.locator('#account-navigation a').filter({ hasText: 'Synthetic Overview Guild 2' }).count(), 0)
  await page.keyboard.press('End')
  await expect(page.locator('#account-navigation').getByRole('button', { name: 'Sign out', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused(); await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click(); await page.locator('#account-title').click(); await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport)
    await trigger.click()
    const menu = await page.locator('#account-navigation').boundingBox()
    assert(menu.x >= 0 && menu.x + menu.width <= viewport.width)
    await page.keyboard.press('Escape')
    if (viewport.width === 320) {
      await page.locator('.account-main').evaluate(element => { element.scrollTop = 0 })
      await page.screenshot({ path: 'test-results/account-overview-320.png' })
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    await page.getByRole('button', { name: 'Save account name' }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: 'Save account name' })).toBeInViewport()
  }
  await mkdir('test-results', { recursive: true })
  await page.screenshot({ path: 'test-results/account-overview-mobile.png' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    const bounds = await trigger.boundingBox()
    assert(bounds.x >= 0 && bounds.x + bounds.width <= width, `Account trigger fits landing at ${width}`)
    await trigger.click()
    await expect(page.locator('#account-navigation').getByText('Synthetic Overview Guild 0 · guild hall')).toBeVisible()
    const boundsMenu = await page.locator('#account-navigation').boundingBox()
    assert(boundsMenu.x >= 0 && boundsMenu.x + boundsMenu.width <= width, `Menu fits landing at ${width}`)
    await page.keyboard.press('Escape')
  }
  await page.getByRole('button', { name: 'Switch to tavern theme' }).click()
  await trigger.click()
  await expect(page.locator('.site')).toHaveAttribute('data-theme', 'tavern')
  await expect(page.locator('#account-navigation').getByText('Synthetic Overview Guild 0 · guild hall')).toBeVisible()
  await page.screenshot({ path: 'test-results/account-menu-tavern.png' })
  await page.keyboard.press('Escape')
  await page.goto('/account#guilds')
  await expect(page.getByRole('heading', { name: 'My guilds', exact: true })).toBeInViewport()
  await page.goto('/account')
  await page.getByRole('link', { name: 'Edit campfire character', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your campfire character · 1/3' })).toBeVisible()
  await expect(page.getByLabel('Public nickname')).toHaveValue('Saved Campfire Name')
  await page.goto('/account')
  await page.getByRole('link', { name: 'Edit this guild character' }).first().click()
  await page.getByRole('button', { name: 'Update my character' }).click()
  await expect(page.getByLabel('Nickname', { exact: true })).toHaveValue('Guild Character 0')
  await page.getByRole('form', { name: 'Who will you play?' }).getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('button', { name: 'Save my character' })).toBeVisible()
  console.log('PASS persisted fields, distinct account name, accessible disclosure keyboard/Escape/outside dismiss, narrow/mobile reachability and real character editor links')

  const emptyPage = await outsider.context.newPage()
  await emptyPage.goto('/account')
  await expect(emptyPage.getByText('No saved character yet.', { exact: false })).toBeVisible()
  await expect(emptyPage.getByText('No approved guild memberships yet.', { exact: false })).toBeVisible()
  assert(!(await emptyPage.locator('main').innerText()).includes('Saved Campfire Name'))
  // Explicit network/503/expired states, never a misleading empty success.
  await page.route('**/api/account/overview', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.goto('/account')
  await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t load' })).toBeVisible()
  assert.equal(await page.getByText('No saved character yet.', { exact: false }).count(), 0)
  await page.unroute('**/api/account/overview')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText('Saved Campfire Name', { exact: true })).toBeVisible()
  await page.route('**/api/account/overview', route => route.abort())
  await page.reload()
  await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t load' })).toBeVisible()
  await page.unroute('**/api/account/overview')
  await page.route('**/api/account/overview', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }))
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Your session has expired' })).toBeVisible()
  assert.equal(await page.getByText('Saved Campfire Name', { exact: true }).count(), 0)
  await page.unroute('**/api/account/overview')
  await page.reload()
  await trigger.click()
  await page.locator('#account-navigation').getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.waitForURL(url => url.pathname === '/login')
  assert.equal((await member.context.request.get('/api/account/overview')).status(), 401)
  await page.goto('/account'); await page.waitForURL('**/login?returnTo=%2Faccount')
  assert(!(await page.locator('body').innerText()).includes('Saved Campfire Name'))
  sql(`UPDATE session SET expiresAt=0 WHERE userId=${quote(outsider.id)}`)
  assert.equal((await outsider.context.request.get('/api/account/overview')).status(), 401)
  await emptyPage.reload()
  await emptyPage.waitForURL(url => url.pathname === '/login')
  assert.deepEqual(errors, [])
  console.log('PASS empty states, 503/network retry, expired session hides data, signout revocation/cleared private UI, no browser runtime errors')
} finally {
  // Local-only synthetic fixtures. No broad deletes or production operations.
  if (users.length) sql(`DELETE FROM interest WHERE email IN (${emails.map(quote).join(',')}); DELETE FROM campfire_memberships WHERE user_id IN (${users.map(quote).join(',')}); DELETE FROM guilds WHERE id IN (${guilds.map(quote).join(',') || "''"}); DELETE FROM user WHERE id IN (${users.map(quote).join(',')});`)
  if (avatarKey) localObject('delete', avatarKey)
  for (const context of contexts) await context.close()
  await browser.close()
}
