import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { guildFromRecord, guildRecruitmentSchema, managementKeySchema, type GuildRecord } from '@/lib/guilds'
import { hashManagementKey } from '@/lib/guild-management.server'
import { readSameOriginJson } from '@/lib/request.server'

export const Route = createFileRoute('/api/guilds/$guildId')({
  server: { handlers: { GET: async ({ params }) => {
    try {
      const guild = await env.DB.prepare('SELECT id, name, faction, region, description, recruitment_needs AS recruitmentNeeds FROM guilds WHERE id = ?')
        .bind(params.guildId).first<GuildRecord>()
      if (!guild) return Response.json({ error: 'This guild could not be found.' }, { status: 404 })
      return Response.json({ guild: guildFromRecord(guild) }, { headers: { 'Cache-Control': 'no-store' } })
    } catch {
      return Response.json({ error: 'This guild is unavailable. Please try again.' }, { status: 503 })
    }
  }, PATCH: async ({ request, params }) => {
    const input = await readSameOriginJson(request)
    if ('response' in input) return input.response
    const key = managementKeySchema.safeParse(request.headers.get('authorization')?.replace(/^Bearer /, ''))
    if (!key.success) return Response.json({ error: 'Open your private guild management link to make changes.' }, { status: 401 })
    const parsed = guildRecruitmentSchema.safeParse(input.body)
    if (!parsed.success) return Response.json({ error: 'Use up to 12 needs, with a name, category, quantity from 1 to 40, and notes up to 160 characters.' }, { status: 400 })
    try {
      const hash = await hashManagementKey(key.data)
      const result = await env.DB.prepare('UPDATE guilds SET recruitment_needs = ? WHERE id = ? AND management_key_hash = ?')
        .bind(JSON.stringify(parsed.data.recruitmentNeeds), params.guildId, hash).run()
      if (!result.meta.changes) return Response.json({ error: 'This management link cannot edit this guild.' }, { status: 403 })
      return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
    } catch {
      return Response.json({ error: 'Couldn’t save recruitment needs. Please try again.' }, { status: 503 })
    }
  } } },
})
