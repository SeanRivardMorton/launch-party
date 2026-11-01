import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import * as schema from './auth-schema'

// Called only in a request: no secret or D1 binding is needed to render the landing page.
export function getAuth() {
  if (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL) return null
  return betterAuth({
    appName: 'ai-zeroth',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB, { schema }), { provider: 'sqlite', schema }),
    // Authentication foundation for the product; the interest form remains account-free.
    emailAndPassword: { enabled: true, minPasswordLength: 12 },
    plugins: [tanstackStartCookies()],
  })
}
