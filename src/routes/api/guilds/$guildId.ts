import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { guildFromRecord, type GuildRecord } from '@/lib/guilds'

export const Route = createFileRoute('/api/guilds/$guildId')({
  server: { handlers: { GET: async ({ params }) => {
    try {
      const guild = await env.DB.prepare('SELECT id, name, faction, region, description FROM guilds WHERE id = ?')
        .bind(params.guildId).first<GuildRecord>()
      if (!guild) return Response.json({ error: 'This guild could not be found.' }, { status: 404 })
      return Response.json({ guild: guildFromRecord(guild) }, { headers: { 'Cache-Control': 'no-store' } })
    } catch {
      return Response.json({ error: 'This guild is unavailable. Please try again.' }, { status: 503 })
    }
  } } },
})
