import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getAuth } from '../src/lib/auth.server'
import { getAuthFeatures } from '../src/lib/auth-features.functions'
import { createResetPasswordSender } from '../src/lib/reset-email.server'

const runtime = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  pending: [] as Promise<unknown>[],
  header: vi.fn(),
  method: vi.fn(),
}))
vi.mock('cloudflare:workers', () => ({
  env: runtime.env,
  waitUntil: (task: Promise<unknown>) => { runtime.pending.push(task) },
}))
vi.mock('@tanstack/react-start', () => ({
  createServerFn: (options: unknown) => {
    runtime.method(options)
    return { handler: (handler: unknown) => handler }
  },
}))
vi.mock('@tanstack/react-start/server', async importOriginal => ({
  ...await importOriginal<object>(),
  setResponseHeader: runtime.header,
}))

let sql: DatabaseSync
beforeEach(() => {
  sql = new DatabaseSync(':memory:')
  sql.exec(readFileSync(new URL('../migrations/0002_auth.sql', import.meta.url), 'utf8'))
  // Exercise the real Better Auth + Drizzle D1 adapter against SQLite, not a fake auth implementation.
  // This small shim implements only the D1 statement methods used by that adapter.
  const db = { prepare(query: string) {
    let params: SQLInputValue[] = []
    const statement = {
      bind(...values: SQLInputValue[]) { params = values; return statement },
      async all() { return { results: sql.prepare(query).all(...params) } },
      async raw() {
        const prepared = sql.prepare(query)
        prepared.setReturnArrays(true)
        return prepared.all(...params)
      },
      async run() { return { success: true, meta: sql.prepare(query).run(...params) } },
    }
    return statement
  } }
  Object.assign(runtime.env, {
    DB: db,
    BETTER_AUTH_SECRET: 'synthetic-test-only-secret-32-characters-long',
    BETTER_AUTH_URL: 'http://localhost:3000',
  })
})
afterEach(async () => {
  await Promise.all(runtime.pending.splice(0))
  sql.close()
  Object.keys(runtime.env).forEach(key => { delete runtime.env[key] })
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function configured() {
  Object.assign(runtime.env, {
    GOOGLE_CLIENT_ID: 'synthetic-google-id', GOOGLE_CLIENT_SECRET: 'synthetic-google-secret',
    RESEND_API_KEY: 'synthetic-resend-key', AUTH_EMAIL_FROM: 'Launch Party <accounts@example.invalid>',
  })
  return getAuth()!
}

it('exposes only no-store GET boolean capabilities gated by base and complete provider configuration', async () => {
  expect(runtime.method).toHaveBeenCalledWith({ method: 'GET' })
  expect(await getAuthFeatures()).toEqual({ google: false, passwordReset: false })
  expect(getAuth()!.options.emailAndPassword).toMatchObject({ enabled: true, minPasswordLength: 12 })
  runtime.env.GOOGLE_CLIENT_ID = 'partial'
  runtime.env.RESEND_API_KEY = 'partial'
  expect(await getAuthFeatures()).toEqual({ google: false, passwordReset: false })
  runtime.env.GOOGLE_CLIENT_SECRET = 'complete'
  expect(await getAuthFeatures()).toEqual({ google: true, passwordReset: false })
  delete runtime.env.GOOGLE_CLIENT_SECRET
  runtime.env.AUTH_EMAIL_FROM = 'accounts@example.invalid'
  expect(await getAuthFeatures()).toEqual({ google: false, passwordReset: true })
  configured()
  expect(await getAuthFeatures()).toEqual({ google: true, passwordReset: true })
  for (const key of ['DB', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL']) {
    const saved = runtime.env[key]
    delete runtime.env[key]
    expect(getAuth()).toBeNull()
    expect(await getAuthFeatures()).toEqual({ google: false, passwordReset: false })
    runtime.env[key] = saved
  }
  runtime.env.GOOGLE_CLIENT_SECRET = ' '
  runtime.env.AUTH_EMAIL_FROM = ' '
  expect(await getAuthFeatures()).toEqual({ google: false, passwordReset: false })
  expect(runtime.header).toHaveBeenCalledWith('Cache-Control', 'no-store')
})

it('configures actual Google credentials with default scopes and no identity-trust bypass', async () => {
  const auth = configured()
  expect(auth.options.socialProviders).toEqual({ google: {
    clientId: 'synthetic-google-id', clientSecret: 'synthetic-google-secret',
  } })
  expect(auth.options.account?.accountLinking).toBeUndefined()
  expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true)
  expect(auth.options.plugins?.at(-1)?.id).toBe('tanstack-start-cookies')
  const context = await auth.$context
  expect(context.trustedProviders).toEqual([])
  const response = await call(auth, 'sign-in/social', { provider: 'google', callbackURL: '/account' })
  expect(response.status).toBe(200)
  const url = new URL((await response.json() as { url: string }).url)
  expect(url.origin).toBe('https://accounts.google.com')
  expect(url.searchParams.get('client_id')).toBe('synthetic-google-id')
  expect(new Set(url.searchParams.get('scope')?.split(' '))).toEqual(new Set(['openid', 'email', 'profile']))
  expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback/google')
  expect(url.searchParams.get('state')).toBeTruthy()
  expect(url.searchParams.get('code_challenge_method')).toBe('S256')
})

it('sends the exact reset URL as plain text to Resend with fixed endpoint and bounded request', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetcher)
  const auth = configured()
  await auth.options.emailAndPassword!.sendResetPassword!({
    user: { email: 'person@example.invalid' } as never,
    url: 'http://localhost:3000/api/auth/reset-password/synthetic-token?callbackURL=%2Freset-password',
    token: 'synthetic-token',
  })
  const [endpoint, options] = fetcher.mock.calls[0]
  expect(endpoint).toBe('https://api.resend.com/emails')
  expect(options).toMatchObject({ method: 'POST', redirect: 'error', headers: {
    Authorization: 'Bearer synthetic-resend-key', 'Content-Type': 'application/json',
  } })
  expect(options.signal).toBeInstanceOf(AbortSignal)
  expect(JSON.parse(options.body)).toEqual({
    from: 'Launch Party <accounts@example.invalid>', to: ['person@example.invalid'],
    subject: 'Reset your Launch Party password',
    text: 'Reset your password using this link:\n\nhttp://localhost:3000/api/auth/reset-password/synthetic-token?callbackURL=%2Freset-password\n\nThis link expires in one hour and can be used once. If you did not request a reset, ignore this email.',
  })
})

it('sanitizes HTTP and network failures, never exposing provider bodies, credentials or recipient', async () => {
  const sender = createResetPasswordSender({ RESEND_API_KEY: 'secret', AUTH_EMAIL_FROM: 'from@example.invalid' })!
  const data = { user: { email: 'private@example.invalid' }, url: 'https://example.invalid/token-secret' }
  const fetcher = vi.fn().mockResolvedValue(new Response('private@example.invalid token-secret secret', { status: 429 }))
  vi.stubGlobal('fetch', fetcher)
  await expect(sender(data)).rejects.toThrow(/^Password reset email delivery failed \(HTTP 429\)$/)
  fetcher.mockRejectedValue(new Error('private@example.invalid token-secret secret'))
  await expect(sender(data)).rejects.toThrow(/^Password reset email delivery failed \(network or timeout\)$/)
  expect(createResetPasswordSender({ RESEND_API_KEY: ' ' })).toBeUndefined()
})

async function call(auth: NonNullable<ReturnType<typeof getAuth>>, path: string, body: object) {
  return auth.handler(new Request(`http://localhost:3000/api/auth/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' }, body: JSON.stringify(body),
  }))
}

it('keeps real email/password sign-in working without optional provider configuration and disables recovery', async () => {
  const auth = getAuth()!
  const email = 'email-only@example.invalid'
  expect((await call(auth, 'sign-up/email', { email, name: 'Test', password: 'email-password-1234' })).status).toBe(200)
  expect((await call(auth, 'sign-in/email', { email, password: 'email-password-1234' })).status).toBe(200)
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  expect((await call(auth, 'request-password-reset', { email })).status).toBe(400)
  expect(fetcher).not.toHaveBeenCalled()
})

it('keeps reset requests generic and independent of email latency; enforces expiry, minimum, single use and session revocation', async () => {
  const auth = configured()
  // Better Auth disables origin checks under NODE_ENV=test; restore them for this HTTP test.
  const context = await auth.$context
  context.skipOriginCheck = false
  context.skipCSRFCheck = false
  const email = 'reset@example.invalid'
  expect((await call(auth, 'sign-up/email', { email, name: 'Test', password: 'old-password-1234' })).status).toBe(200)
  expect(sql.prepare('SELECT count(*) AS n FROM session').get()?.n).toBe(1)
  let finishEmail!: (response: Response) => void
  const fetcher = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finishEmail = resolve }))
  vi.stubGlobal('fetch', fetcher)
  const existing = await call(auth, 'request-password-reset', { email, redirectTo: '/reset-password' })
  const missing = await call(auth, 'request-password-reset', { email: 'missing@example.invalid', redirectTo: '/reset-password' })
  expect(existing.status).toBe(200)
  expect(await existing.json()).toEqual(await missing.json())
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(runtime.pending.length).toBeGreaterThan(0)
  finishEmail(new Response('{}'))
  await Promise.all(runtime.pending.splice(0))
  const text = JSON.parse(fetcher.mock.calls[0][1].body).text as string
  const resetURL = new URL(text.split('\n\n')[1])
  const token = resetURL.pathname.split('/').at(-1)!
  expect(sql.prepare('SELECT expiresAt FROM verification WHERE identifier = ?').get(`reset-password:${token}`)?.expiresAt).toBeGreaterThan(Date.now() + 3_590_000)
  const callback = await auth.handler(new Request(resetURL))
  expect(callback.status).toBe(302)
  expect(new URL(callback.headers.get('Location')!).searchParams.get('token')).toBe(token)
  expect((await call(auth, 'reset-password', { token, newPassword: 'short' })).status).toBe(400)
  expect((await call(auth, 'reset-password', { token, newPassword: 'new-password-5678' })).status).toBe(200)
  expect(sql.prepare('SELECT count(*) AS n FROM session').get()?.n).toBe(0)
  expect((await call(auth, 'reset-password', { token, newPassword: 'reuse-password-123' })).status).toBe(400)
  expect((await call(auth, 'sign-in/email', { email, password: 'old-password-1234' })).status).toBe(401)
  expect((await call(auth, 'sign-in/email', { email, password: 'new-password-5678' })).status).toBe(200)
  fetcher.mockResolvedValue(new Response('{}'))
  await call(auth, 'request-password-reset', { email, redirectTo: '/reset-password' })
  await Promise.all(runtime.pending.splice(0))
  const expiredToken = new URL(JSON.parse(fetcher.mock.calls.at(-1)![1].body).text.split('\n\n')[1]).pathname.split('/').at(-1)!
  sql.prepare('UPDATE verification SET expiresAt = ? WHERE identifier = ?').run(Date.now() - 60_000, `reset-password:${expiredToken}`)
  expect((await call(auth, 'reset-password', { token: expiredToken, newPassword: 'expired-password-123' })).status).toBe(400)
  expect((await call(auth, 'request-password-reset', { email, redirectTo: 'https://evil.example/reset' })).status).toBe(403)
})

it('logs a safe background delivery failure while preserving the generic public reset response', async () => {
  const auth = configured()
  await call(auth, 'sign-up/email', { email: 'failure@example.invalid', name: 'Test', password: 'old-password-1234' })
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('recipient@example.invalid credential token')))
  const logger = vi.spyOn((await auth.$context).logger, 'error').mockImplementation(() => {})
  expect((await call(auth, 'request-password-reset', { email: 'failure@example.invalid' })).status).toBe(200)
  await Promise.all(runtime.pending.splice(0))
  expect(logger).toHaveBeenCalled()
  const errors = logger.mock.calls.flat().map(value => value instanceof Error ? value.message : String(value)).join(' ')
  expect(errors).toContain('Password reset email delivery failed (network or timeout)')
  expect(errors).not.toMatch(/recipient@example|credential|token/)
})
