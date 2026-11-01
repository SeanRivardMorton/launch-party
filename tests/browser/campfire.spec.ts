import { test, expect, type BrowserContext, type WebSocketRoute } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { atlasFixture } from '../atlas-fixture'

const origin = 'http://localhost:3107'
test('atlas decoding and deterministic composition execute inside the actual Workers runtime', async ({ request }) => {
  const response = await request.get('http://localhost:3108/verify')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ width: 1536, height: 1872, frames: 57 })
})
function sql(statement: string) {
  execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', '--local', '--command', statement], { stdio: 'pipe' })
}
async function signup(context: BrowserContext, nickname: string) {
  const email = `${nickname.toLowerCase()}-${crypto.randomUUID()}@example.test`
  const result = await context.request.post('/api/auth/sign-up/email', { headers: { origin }, data: { name: nickname, email, password: 'Synthetic-only-password-123!' } })
  expect(result.status(), await result.text()).toBe(200)
  const { user } = await result.json()
  const saved = await context.request.put('/api/campfire/profile', { headers: { origin }, data: { nickname, faction: 'Alliance', race: 'Dwarf', characterClass: 'Priest', professions: ['Mining', 'Alchemy'], bio: 'Synthetic browser verification character', published: true } })
  expect(saved.status()).toBe(200)
  return user.id as string
}
test('two authenticated clients: movement, emote, card, reconnect, mobile and reduced motion', async ({ browser }) => {
  const a = await browser.newContext({ baseURL: origin, viewport: { width: 1280, height: 720 } })
  const b = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  const ids: string[] = []
  try {
    ids.push(await signup(a, 'TestBramble'), await signup(b, 'TestWillow'))
    const guild = `test-${crypto.randomUUID()}`
    sql(`INSERT INTO campfire_memberships(guild_id,user_id) VALUES('${guild}','${ids[0]}'),('${guild}','${ids[1]}')`)
    for (const id of ids) sql(`INSERT INTO campfire_avatars(user_id,state,asset_key,asset_format) VALUES('${id}','ready','synthetic-test-atlas','codex-pet-v1')`)
    const pa = await a.newPage(); const pb = await b.newPage()
    const fixture = atlasFixture()
    for (const page of [pa, pb]) await page.route('**/api/campfire/avatar/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(fixture) }))
    const wires: WebSocketRoute[] = []
    await pa.routeWebSocket('**/api/campfire/rooms/**/socket', socket => { wires.push(socket.connectToServer()) })
    await Promise.all([pa.goto('/campfire'), pb.goto('/campfire')])
    await expect(pa.getByText('2 by the fire')).toBeVisible()
    await expect(pb.getByText('2 by the fire')).toBeVisible()
    const targetA = pa.locator('[data-player="TestBramble"]')
    const targetB = pb.locator('[data-player="TestBramble"]')
    const start = await targetA.evaluate(el => (el as HTMLElement).style.left)
    const framesA = targetA.locator('.guild-sheet img')
    const framesB = targetB.locator('.guild-sheet img')
    await expect(framesA).toHaveAttribute('data-animation', 'idle')
    const idleFrame = await framesA.getAttribute('data-frame')
    await expect.poll(() => framesA.getAttribute('data-frame')).not.toBe(idleFrame)
    await expect(framesB).toHaveAttribute('data-frame', '0')
    await pa.locator('.guild-scene').click({ position: { x: 900, y: 250 } })
    await expect.poll(() => targetA.evaluate(el => (el as HTMLElement).style.left)).not.toBe(start)
    await expect(framesA).toHaveAttribute('data-animation', 'running-right')
    await expect.poll(async () => (await targetA.evaluate(el => (el as HTMLElement).style.left)) === (await targetB.evaluate(el => (el as HTMLElement).style.left))).toBe(true)
    await pa.getByRole('button', { name: '✨ cheer' }).click()
    await expect(framesA).toHaveAttribute('data-animation', 'jumping')
    const jumpFrame = await framesA.getAttribute('data-frame')
    await expect.poll(() => framesA.getAttribute('data-frame')).not.toBe(jumpFrame)
    await expect(framesB).toHaveAttribute('data-animation', 'idle')
    await expect(framesB).toHaveAttribute('data-frame', '0')
    await expect(pb.locator('[data-player="TestBramble"] .guild-emote')).toHaveText('✨')
    await targetB.tap()
    await expect(pb.getByRole('dialog')).toContainText('Synthetic browser verification character')
    await expect(pb.getByRole('dialog')).not.toContainText('@example.test')
    await pb.getByRole('button', { name: 'Close card' }).tap()
    // Reduced-motion clients jump to authoritative destination without CSS tweening.
    expect(await targetB.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s')
    await pb.locator('.guild-scene').tap({ position: { x: 70, y: 150 } })
    await expect.poll(async () => await pa.locator('[data-player="TestWillow"]').evaluate(el => parseFloat((el as HTMLElement).style.left))).toBeLessThan(30)
    // Native dialog closes on Escape and restores focus to the clicked sprite.
    await targetA.click()
    await expect(pa.getByRole('dialog')).toBeVisible()
    await pa.keyboard.press('Escape')
    await expect(pa.getByRole('dialog')).not.toBeVisible()
    await expect(targetA).toBeFocused()
    const before = await targetA.evaluate(el => (el as HTMLElement).style.left)
    await pa.locator('.guild-scene').focus()
    await pa.keyboard.press('ArrowLeft')
    await expect.poll(() => targetA.evaluate(el => (el as HTMLElement).style.left)).not.toBe(before)
    const savedPosition = await targetA.evaluate(el => (el as HTMLElement).style.left)
    // Force a real connection interruption. The client reconnects without reload
    // and the fresh socket receives both occupants and the last trajectory.
    wires[0].close({ code: 1012, reason: 'Synthetic reconnect test' })
    await expect.poll(() => wires.length).toBeGreaterThan(1)
    await expect(pa.getByText('2 by the fire')).toBeVisible()
    await expect.poll(() => targetA.evaluate(el => (el as HTMLElement).style.left)).toBe(savedPosition)
    // A new socket obtains a full snapshot and retains the server position.
    await pa.reload()
    await expect(pa.getByText('2 by the fire')).toBeVisible()
    await expect.poll(() => pa.locator('[data-player="TestBramble"]').evaluate(el => (el as HTMLElement).style.left)).toBe(savedPosition)
    await pa.screenshot({ path: 'test-results/campfire-desktop.png' })
    await pb.screenshot({ path: 'test-results/campfire-mobile.png' })
    // Both layout extremes stay document-scroll-free with accessible controls.
    for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      await pa.setViewportSize(viewport)
      await expect(pa.getByRole('button', { name: '👋 wave' })).toBeInViewport()
      expect(await pa.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
    }
    // Access is revalidated for passive viewers before the next broadcast.
    sql(`DELETE FROM campfire_memberships WHERE user_id='${ids[1]}'`)
    await pa.getByRole('button', { name: '♥ heart' }).click()
    await expect(pb.getByText('Session, membership or room access changed. Refresh to re-enter.').first()).toBeVisible()
  } finally {
    await a.close(); await b.close()
    for (const id of ids) sql(`DELETE FROM user WHERE id='${id}'`)
  }
})

test('gateway rejects anonymous, wrong-origin and nonmember upgrades; fallback persists', async ({ browser, request }) => {
  const anonymous = await request.get('/api/campfire/me')
  expect(anonymous.status()).toBe(401)
  const wrongOrigin = await request.get('/api/campfire/rooms/test/socket', { headers: { origin: 'https://evil.example', upgrade: 'websocket' } })
  expect(wrongOrigin.status()).toBe(403)
  const context = await browser.newContext({ baseURL: origin })
  let id = ''
  try {
    id = await signup(context, 'TestOutsider')
    const denied = await context.request.get('/api/campfire/rooms/not-your-guild/socket', { headers: { origin, upgrade: 'websocket', 'x-campfire-user': 'spoofed' } })
    expect(denied.status()).toBe(403)
    const settings = await (await context.request.get('/api/campfire/me')).json()
    // Never incur provider charges from an automated browser test on a keyed dev server.
    if (!settings.generationEnabled) {
      const generate = await context.request.post('/api/campfire/generate', { headers: { origin } })
      expect(generate.status()).toBe(503)
    }
    for (let i = 0; i < 2; i++) {
      const response = await context.request.get('/api/campfire/me')
      const me = await response.json()
      expect(me.profile.nickname).toBe('TestOutsider')
      expect(me.avatar.attempts).toBe(0)
      expect(me.profile.avatarUrl).toBeNull()
      expect(JSON.stringify(me)).not.toContain('@example.test')
    }
  } finally { await context.close(); if (id) sql(`DELETE FROM user WHERE id='${id}'`) }
})
