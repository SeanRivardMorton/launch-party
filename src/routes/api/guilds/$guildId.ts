import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { guildFromRecord, guildRecruitmentSchema, managementKeySchema, type GuildRecord } from '@/lib/guilds'
import { hashManagementKey } from '@/lib/guild-management.server'
import { readSameOriginJson } from '@/lib/request.server'
import { guildRole, requireGuildUser } from '@/lib/guild-community.server'

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
    const parsed = guildRecruitmentSchema.safeParse(input.body)
    if (!parsed.success) return Response.json({ error: 'Use up to 12 needs, with a name, category, quantity from 1 to 40, and notes up to 160 characters.' }, { status: 400 })
    try {
      const guild = await env.DB.prepare('SELECT owner_user_id AS owner FROM guilds WHERE id = ?').bind(params.guildId).first<{ owner: string | null }>()
      if (!guild) return Response.json({ error: 'This guild could not be found.' }, { status: 404 })
      let result: D1Result
      if (guild.owner) {
        const identity = await requireGuildUser(request)
        if ('response' in identity) return identity.response
        const role = await guildRole(env.DB, params.guildId, identity.user.id)
        if (role !== 'leader' && role !== 'officer') return Response.json({ error: 'Only the guild lead or officers can update recruitment needs.' }, { status: 403 })
        result = await env.DB.prepare("UPDATE guilds SET recruitment_needs = ? WHERE id = ? AND EXISTS (SELECT 1 FROM guild_memberships manager WHERE manager.guild_id = ? AND manager.user_id = ? AND manager.role IN ('leader', 'officer'))")
          .bind(JSON.stringify(parsed.data.recruitmentNeeds), params.guildId, params.guildId, identity.user.id).run()
      } else {
        const key = managementKeySchema.safeParse(request.headers.get('authorization')?.replace(/^Bearer /, ''))
        if (!key.success) return Response.json({ error: 'Sign in and claim this guild using its private management link.' }, { status: 401 })
        const hash = await hashManagementKey(key.data)
        result = await env.DB.prepare('UPDATE guilds SET recruitment_needs = ? WHERE id = ? AND owner_user_id IS NULL AND management_key_hash = ?')
          .bind(JSON.stringify(parsed.data.recruitmentNeeds), params.guildId, hash).run()
      }
      if (!result.meta.changes) return Response.json({ error: 'This management link cannot edit this guild.' }, { status: 403 })
      return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
    } catch {
      return Response.json({ error: 'Couldn’t save recruitment needs. Please try again.' }, { status: 503 })
    }
  } } },
})
