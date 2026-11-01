import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { requireGuildUser } from '@/lib/guild-community.server'

export const Route = createFileRoute('/api/guilds/$guildId/battletags/$userId')({
  server: { handlers: { GET: async ({ request, params }) => {
    const identity = await requireGuildUser(request)
    if ('response' in identity) return identity.response
    const headers = { 'Cache-Control': 'no-store' }
    try {
      // Check both memberships on every read; room presence alone is insufficient.
      const member = await env.DB.prepare("SELECT COALESCE(tag.battletag, '') AS battleTag FROM guild_memberships subject LEFT JOIN member_battletags tag ON tag.user_id = subject.user_id WHERE subject.guild_id = ? AND subject.user_id = ? AND EXISTS (SELECT 1 FROM guild_memberships viewer WHERE viewer.guild_id = subject.guild_id AND viewer.user_id = ?)")
        .bind(params.guildId, params.userId, identity.user.id).first<{ battleTag: string }>()
      if (!member) return Response.json({ error: 'BattleTags are shared only between approved members of this guild.' }, { status: 403, headers })
      return Response.json(member, { headers })
    } catch {
      return Response.json({ error: 'Couldn’t load this BattleTag. Please try again.' }, { status: 503, headers })
    }
  } } },
})
