import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { guildFromRecord, guildPath, guildSchema, regions, type GuildRecord } from '@/lib/guilds'
import { factions } from '@/lib/interest'
import { readSameOriginJson } from '@/lib/request.server'

export const Route = createFileRoute('/api/guilds')({
  server: { handlers: {
    GET: async ({ request }) => {
      const params = new URL(request.url).searchParams
      const faction = params.get('faction') || ''
      const region = params.get('region') || ''
      const page = Number(params.get('page') || 0)
      if ((faction && !factions.includes(faction as typeof factions[number])) || (region && !regions.includes(region as typeof regions[number])) || !Number.isInteger(page) || page < 0 || page > 10000) {
        return Response.json({ error: 'Invalid directory filters.' }, { status: 400 })
      }
      try {
        const { results } = await env.DB.prepare('SELECT id, name, faction, region, description FROM guilds WHERE (? = \'\' OR faction = ?) AND (? = \'\' OR region = ?) ORDER BY created_at DESC, id DESC LIMIT 2 OFFSET ?')
          .bind(faction, faction, region, region, page).all<GuildRecord>()
        return Response.json({ guilds: results.slice(0, 1).map(guildFromRecord), hasMore: results.length > 1 }, { headers: { 'Cache-Control': 'no-store' } })
      } catch {
        return Response.json({ error: 'The guild directory is unavailable. Please try again.' }, { status: 503 })
      }
    },
    POST: async ({ request }) => {
      const input = await readSameOriginJson(request)
      if ('response' in input) return input.response
      const parsed = guildSchema.safeParse(input.body)
      if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || 'Please check the listing.' }, { status: 400 })
      const { name, faction, region, description, submissionId } = parsed.data
      const id = submissionId || crypto.randomUUID()
      const path = guildPath(id)
      if (parsed.data.website) return Response.json({ success: true, path })
      try {
        // Keep the legacy NOT NULL column compatible; Forever does not use realms.
        await env.DB.prepare("INSERT INTO guilds (id, name, faction, region, realm, description, join_url) VALUES (?, ?, ?, ?, '', ?, ?) ON CONFLICT(id) DO NOTHING")
          .bind(id, name, faction, region, description, path).run()
        return Response.json({ success: true, path }, { headers: { 'Cache-Control': 'no-store' } })
      } catch {
        return Response.json({ error: 'Couldn’t publish the guild. Please try again.' }, { status: 503 })
      }
    },
  } },
})
