import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { requireGuildUser } from '@/lib/guild-community.server'
import { readAccountOverview } from '@/lib/account-overview.server'

export const Route = createFileRoute('/api/account/overview')({
  server: { handlers: { GET: async ({ request }) => {
    const identity = await requireGuildUser(request)
    if ('response' in identity) {
      identity.response.headers.set('Cache-Control', 'private, no-store')
      return identity.response
    }
    try {
      return Response.json(await readAccountOverview(env.DB, identity.user.id), { headers: { 'Cache-Control': 'private, no-store' } })
    } catch {
      return Response.json({ error: 'Your saved characters and guilds are temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
    }
  } } },
})
