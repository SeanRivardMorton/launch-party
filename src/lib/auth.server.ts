import '@tanstack/react-start/server-only'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { drizzle } from 'drizzle-orm/d1'
import { env, waitUntil } from 'cloudflare:workers'
import * as schema from './auth-schema'
import { createResetPasswordSender } from './reset-email.server'

// Called only in a request: no secret or D1 binding is needed to render the landing page.
export function getAuth() {
  if (!env.DB || !env.BETTER_AUTH_SECRET?.trim() || !env.BETTER_AUTH_URL?.trim()) return null
  const google = env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()
    ? { clientId: env.GOOGLE_CLIENT_ID.trim(), clientSecret: env.GOOGLE_CLIENT_SECRET.trim() }
    : undefined
  const sendResetPassword = createResetPasswordSender(env)
  return betterAuth({
    appName: 'ai-zeroth',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB, { schema }), { provider: 'sqlite', schema }),
    // Authentication foundation for the product; the interest form remains account-free.
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      sendResetPassword,
      revokeSessionsOnPasswordReset: true,
    },
    socialProviders: google ? { google } : {},
    // No trustedProviders override: linking still requires Better Auth's verified identity checks.
    // Cloudflare's request-scoped waitUntil keeps delivery alive without awaiting email latency.
    advanced: { backgroundTasks: { handler: waitUntil } },
    plugins: [tanstackStartCookies()],
  })
}
