import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, request } from 'playwright'

const origin = process.env.AUTH_TEST_ORIGIN || 'http://localhost:3119'
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Use local D1 only')
const browser = await chromium.launch()
const anonymous = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } })
const context = await browser.newContext({ baseURL: origin })
const page = await context.newPage()
const email = `auth-${Date.now()}@example.invalid`
const password = 'Synthetic-local-password-123!'
const errors = []
page.on('pageerror', error => errors.push(error.message))
await mkdir('test-results', { recursive: true })

async function visible(locator) { await locator.waitFor({ state: 'visible' }) }
async function login(target = '/login', secret = password) {
  await page.goto(target)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(secret)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}
async function signout() {
  await page.goto('/account')
  await visible(page.getByRole('link', { name: 'My account', exact: true }))
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.waitForURL(url => url.pathname === '/login')
}

try {
  const protectedResponse = await anonymous.get('/account', { maxRedirects: 0 })
  assert.equal(protectedResponse.status(), 307)
  assert.match(protectedResponse.headers().location, /\/login/)
  assert(!(await protectedResponse.text()).includes('Account email'))
  assert((await anonymous.post('/api/auth/update-user', { data: { name: 'Intruder' } })).status() >= 400)
  console.log('PASS anonymous SSR route and account mutation rejection')

  if (process.env.AUTH_TEST_UNAVAILABLE === '1') {
    await page.goto('/register')
    await visible(page.getByText('Accounts are temporarily unavailable.', { exact: false }).first())
    assert.equal(await page.getByLabel('Password', { exact: true }).count(), 0)
    assert.equal((await anonymous.get('/api/auth/get-session')).status(), 503)
    await page.goto('/signup')
    await visible(page.getByLabel('Your name or nickname'))
    console.log('PASS missing auth configuration: friendly account UI, 503 endpoint, public signup works')
  } else {
    const short = await anonymous.post('/api/auth/sign-up/email', { data: { name: 'Synthetic', email, password: 'short' } })
    assert.equal(short.status(), 400)
    assert.equal((await short.json()).code, 'PASSWORD_TOO_SHORT')
    const noJs = await browser.newContext({ baseURL: origin, javaScriptEnabled: false })
    const noJsPage = await noJs.newPage()
    await noJsPage.goto('/register')
    assert.equal(await noJsPage.locator('form').getAttribute('method'), 'post')
    assert.equal(await noJsPage.getByRole('button', { name: 'Create account', exact: true }).isDisabled(), true)
    assert.match(await noJsPage.locator('main').innerText(), /Please enable JavaScript/)
    await noJs.close()
    await page.goto('/register')
    await page.getByLabel('Name or nickname', { exact: true }).fill('Synthetic adventurer')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill('short')
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    assert.equal(await page.getByLabel('Password', { exact: true }).evaluate(input => input.validity.tooShort), true)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Show password', exact: true }).click()
    await page.locator('#account-password[type="text"]').waitFor()
    assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'text')
    await page.getByRole('button', { name: 'Hide password', exact: true }).click()
    // Delay the real request to check pending/double-submit protection.
    await page.route('**/api/auth/sign-up/email', async route => { await new Promise(resolve => setTimeout(resolve, 350)); await route.continue() })
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await visible(page.getByRole('button', { name: 'Creating account…', exact: true }))
    assert.equal(await page.getByRole('button', { name: 'Creating account…', exact: true }).isDisabled(), true)
    await page.waitForURL('**/account')
    await visible(page.getByText(email, { exact: true }))
    await page.reload()
    await visible(page.getByText(email, { exact: true }))
    const cookies = await context.cookies()
    const sessionCookie = cookies.find(cookie => cookie.name.includes('session_token'))
    assert(sessionCookie?.httpOnly)
    assert.equal(sessionCookie.sameSite, 'Lax')
    assert(sessionCookie.expires > Date.now() / 1000)
    const session = await context.request.get('/api/auth/get-session')
    assert.equal((await session.json()).user.email, email)
    const protectedHtml = await context.request.get('/account')
    assert.match(protectedHtml.headers()['cache-control'], /no-store/)
    assert(!(await protectedHtml.text()).includes(sessionCookie.value))
    await page.getByLabel('Name or nickname', { exact: true }).fill('Saved synthetic nickname')
    await page.getByRole('button', { name: 'Save account name', exact: true }).click()
    await visible(page.getByRole('status').filter({ hasText: 'Account name saved.' }))
    await page.reload()
    assert.equal(await page.getByLabel('Name or nickname', { exact: true }).inputValue(), 'Saved synthetic nickname')
    await page.goto('/')
    await visible(page.getByRole('link', { name: 'My account', exact: true }))
    assert.equal(await page.locator('.signup-qr').getAttribute('href'), '/signup')
    console.log('PASS registration, client/server password minimum, pending state, cookie session, reload, private DTO, account update, header and QR')

    // Copy the cookie into an independent client, then prove signout revokes it in D1.
    const replay = await request.newContext({ baseURL: origin, storageState: await context.storageState(), extraHTTPHeaders: { Origin: origin } })
    await signout()
    assert.equal(await (await replay.get('/api/auth/get-session')).json(), null)
    assert((await replay.post('/api/auth/update-user', { data: { name: 'Revoked' } })).status() >= 400)
    await replay.dispose()
    await page.goto('/account')
    await page.waitForURL('**/login?returnTo=%2Faccount')
    console.log('PASS signout revokes persisted session, replay/mutation and protected navigation rejected')

    await page.goto('/register')
    await page.getByLabel('Name or nickname', { exact: true }).fill('Duplicate')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await visible(page.getByRole('alert'))
    assert.match(await page.getByRole('alert').innerText(), /already uses this email/)
    assert.equal(await page.getByLabel('Name or nickname', { exact: true }).inputValue(), 'Duplicate')
    assert.equal(await page.getByRole('alert').evaluate(element => element === document.activeElement), true)
    await login('/login', 'incorrect-password-123!')
    await visible(page.getByRole('alert'))
    assert.match(await page.getByRole('alert').innerText(), /Email or password is incorrect/)
    assert.equal(await page.getByLabel('Email', { exact: true }).inputValue(), email)
    console.log('PASS duplicate registration, invalid login, input retention and focused accessible errors')

    // Real sign-in with both permitted and hostile return destinations.
    await login('/login?returnTo=%2Fguilds%3Ffaction%3DAlliance')
    await page.waitForURL('**/guilds?faction=Alliance')
    await signout()
    for (const target of ['https://example.invalid', '//example.invalid', '/\\example.invalid', '/api/auth/sign-out', '/%2f%2fexample.invalid', '/register']) {
      await login(`/login?returnTo=${encodeURIComponent(target)}`)
      await page.waitForURL('**/account')
      await signout()
    }
    console.log('PASS internal return navigation and hostile/auth/API return rejection')

    // Simulate a network outage without changing the actual auth backend.
    await page.goto('/login')
    await page.route('**/api/auth/sign-in/email', route => route.abort())
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await visible(page.getByRole('alert'))
    await page.unroute('**/api/auth/sign-in/email')
    console.log('PASS interrupted auth request shows retryable error')

    for (const [width, height] of [[1440, 900], [1280, 720], [390, 844], [320, 568], [844, 390]]) {
      await page.setViewportSize({ width, height })
      await page.goto('/register')
      await page.locator('button[type="submit"]:enabled').waitFor()
      const layout = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, width: innerWidth, cardWidth: document.querySelector('.account-card').scrollWidth, cardClient: document.querySelector('.account-card').clientWidth }))
      assert(layout.documentWidth <= layout.width)
      assert(layout.cardWidth <= layout.cardClient)
      await page.getByRole('link', { name: 'Join the account-free interest list' }).scrollIntoViewIfNeeded()
      const box = await page.getByRole('link', { name: 'Join the account-free interest list' }).boundingBox()
      assert(box.y >= 0 && box.y + box.height <= height)
      await page.screenshot({ path: `test-results/auth-register-${width}.png` })
      await page.locator('.account-main').evaluate(element => { element.scrollTop = 0 })
      await page.getByLabel('Name or nickname', { exact: true }).focus()
      await page.keyboard.press('Tab')
      assert.equal(await page.getByLabel('Email', { exact: true }).evaluate(element => element === document.activeElement), true)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await login()
    await page.waitForURL('**/account')
    await visible(page.getByRole('link', { name: 'My account', exact: true }))
    await page.screenshot({ path: 'test-results/auth-account-mobile.png' })
    await signout()
    console.log('PASS desktop/mobile/landscape layout with reachable controls and no horizontal clipping')

    // Independent anonymous browser: the existing four-step interest flow remains account-free.
    const publicContext = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 } })
    const publicPage = await publicContext.newPage()
    await publicPage.goto('/signup')
    // The existing public form predates the account forms' hydration-disabled buttons.
    await publicPage.waitForLoadState('networkidle')
    await publicPage.getByLabel('Your name or nickname').fill('Synthetic interest only')
    await publicPage.getByLabel('Email', { exact: true }).fill(`interest-${Date.now()}@example.invalid`)
    await publicPage.getByRole('button', { name: 'Next', exact: true }).click()
    await visible(publicPage.getByRole('heading', { name: 'Who will you play?' }))
    await publicPage.getByRole('button', { name: 'Next', exact: true }).click()
    await visible(publicPage.getByRole('heading', { name: 'What do you bring?' }))
    await publicPage.getByRole('button', { name: 'Next', exact: true }).click()
    await visible(publicPage.getByRole('heading', { name: 'Find your people.' }))
    await publicPage.getByLabel('Decide later').check()
    await publicPage.getByLabel('Email me about ai-zeroth.', { exact: false }).check()
    await publicPage.getByRole('button', { name: 'Count me in', exact: true }).click()
    await visible(publicPage.getByText('A place by the fire.', { exact: true }))
    assert.equal(await (await publicContext.request.get('/api/auth/get-session')).json(), null)
    await publicPage.goto('/guilds')
    assert.equal((await publicContext.request.get('/api/guilds')).status(), 200)
    const listing = await publicContext.request.post('/api/guilds', {
      headers: { Origin: origin },
      data: { name: 'Synthetic auth regression guild', faction: 'Alliance', region: 'Europe', description: 'Synthetic local guild for account-free invite regression.', publishConsent: true },
    })
    assert.equal(listing.status(), 200)
    const { path } = await listing.json()
    await publicPage.goto(path)
    await visible(publicPage.getByRole('link', { name: /Join this guild/ }))
    await publicPage.getByRole('link', { name: /Join this guild/ }).click()
    await visible(publicPage.locator('.guild-context').filter({ hasText: 'Joining Synthetic auth regression guild' }))
    assert(new URL(publicPage.url()).searchParams.has('guild'))
    assert.equal(await (await publicContext.request.get('/api/auth/get-session')).json(), null)
    await publicContext.close()
    console.log('PASS anonymous /signup completion, guild publication/directory/invite regression; no account session created')
  }
  assert.deepEqual(errors, [], 'No uncaught browser errors')
} finally {
  await anonymous.dispose()
  await context.close()
  await browser.close()
}
