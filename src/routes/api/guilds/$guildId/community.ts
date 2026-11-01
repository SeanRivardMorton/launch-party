import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { guildActionSchema, guildCharacterSchema, type ApplicationStatus, type GuildApplication, type GuildCommunity, type GuildInitiative, type GuildMember, type GuildRole } from '@/lib/guild-community'
import { campfireGrant, campfireMembershipsAvailable, campfireRevoke, defaultGuildProfile, guildRole, requireGuildUser } from '@/lib/guild-community.server'
import { hashManagementKey } from '@/lib/guild-management.server'
import { readSameOriginJson } from '@/lib/request.server'
import type { Faction } from '@/lib/character-options'

const fail = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
const success = () => Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
const managerExists = "EXISTS (SELECT 1 FROM guild_memberships manager WHERE manager.guild_id = ? AND manager.user_id = ? AND manager.role IN ('leader', 'officer'))"
type GuildAccess = { faction: Faction; owner: string | null }
type MemberRow = { userId: string; role: GuildRole; profile: string; joinedAt: string }
type ApplicationRow = { userId: string; profile: string; introduction: string; status: ApplicationStatus; createdAt: string }

export const Route = createFileRoute('/api/guilds/$guildId/community')({
  server: { handlers: {
    GET: async ({ request, params }) => {
      const identity = await requireGuildUser(request)
      if ('response' in identity) return identity.response
      const { id: userId } = identity.user
      const guildId = params.guildId
      const search = new URL(request.url).searchParams
      const membersPage = Number(search.get('membersPage') || 0)
      const applicationsPage = Number(search.get('applicationsPage') || 0)
      if (![membersPage, applicationsPage].every(page => Number.isInteger(page) && page >= 0 && page <= 10000)) return fail('Invalid page.', 400)
      try {
        const guild = await env.DB.prepare('SELECT faction, owner_user_id AS owner FROM guilds WHERE id = ?').bind(guildId).first<GuildAccess>()
        if (!guild) return fail('This guild could not be found.', 404)
        const role = await guildRole(env.DB, guildId, userId)
        const application = await env.DB.prepare('SELECT status FROM guild_applications WHERE guild_id = ? AND user_id = ?').bind(guildId, userId).first<{ status: ApplicationStatus }>()
        const community: GuildCommunity = {
          viewer: { userId, role, applicationStatus: application?.status || null, canManage: role === 'leader' || role === 'officer' },
          members: [], membersHasMore: false, applications: [], applicationsHasMore: false, initiatives: [],
          canClaim: guild.owner === null, campfireAvailable: false,
        }
        if (!role) return Response.json(community, { headers: { 'Cache-Control': 'no-store' } })
        const { results: members } = await env.DB.prepare('SELECT user_id AS userId, role, profile, joined_at AS joinedAt FROM guild_memberships WHERE guild_id = ? ORDER BY joined_at, user_id LIMIT 21 OFFSET ?').bind(guildId, membersPage * 20).all<MemberRow>()
        community.members = members.slice(0, 20).map(({ profile, ...member }): GuildMember => ({ ...member, ...guildCharacterSchema.parse(JSON.parse(profile)) }))
        community.membersHasMore = members.length > 20
        const { results: initiatives } = await env.DB.prepare('SELECT id, title, description, status, created_at AS createdAt, updated_at AS updatedAt FROM guild_initiatives WHERE guild_id = ? ORDER BY created_at, id LIMIT 50').bind(guildId).all<GuildInitiative>()
        community.initiatives = initiatives
        if (community.viewer.canManage) {
          const { results: applications } = await env.DB.prepare("SELECT user_id AS userId, profile, introduction, status, created_at AS createdAt FROM guild_applications WHERE guild_id = ? AND status = 'pending' ORDER BY created_at, user_id LIMIT 21 OFFSET ?").bind(guildId, applicationsPage * 20).all<ApplicationRow>()
          community.applications = applications.slice(0, 20).map(({ profile, ...candidate }): GuildApplication => ({ ...candidate, ...guildCharacterSchema.parse(JSON.parse(profile)) }))
          community.applicationsHasMore = applications.length > 20
        }
        community.campfireAvailable = await campfireMembershipsAvailable(env.DB)
        if (community.campfireAvailable) await env.DB.batch(await campfireGrant(env.DB, guildId, userId))
        return Response.json(community, { headers: { 'Cache-Control': 'no-store' } })
      } catch {
        return fail('The guild hall is temporarily unavailable. Please try again.', 503)
      }
    },
    POST: async ({ request, params }) => {
      const input = await readSameOriginJson(request)
      if ('response' in input) return input.response
      const identity = await requireGuildUser(request)
      if ('response' in identity) return identity.response
      const parsed = guildActionSchema.safeParse(input.body)
      if (!parsed.success) return fail('Please check the character details or guild action.', 400)
      const action = parsed.data
      const user = identity.user
      const guildId = params.guildId
      try {
        const guild = await env.DB.prepare('SELECT faction, owner_user_id AS owner FROM guilds WHERE id = ?').bind(guildId).first<GuildAccess>()
        if (!guild) return fail('This guild could not be found.', 404)
        const role = await guildRole(env.DB, guildId, user.id)
        if (action.action === 'claim') {
          if (guild.owner && guild.owner !== user.id) return fail('This guild already has a lead.', 403)
          const hash = await hashManagementKey(action.managementKey)
          await env.DB.batch([
            env.DB.prepare('UPDATE guilds SET owner_user_id = ? WHERE id = ? AND owner_user_id IS NULL AND management_key_hash = ?').bind(user.id, guildId, hash),
            env.DB.prepare("INSERT INTO guild_memberships (guild_id, user_id, role, profile) SELECT id, ?, 'leader', ? FROM guilds WHERE id = ? AND owner_user_id = ? AND management_key_hash = ? ON CONFLICT(guild_id, user_id) DO NOTHING").bind(user.id, JSON.stringify(defaultGuildProfile(user, guild.faction)), guildId, user.id, hash),
            ...await campfireGrant(env.DB, guildId, user.id),
          ])
          return await guildRole(env.DB, guildId, user.id) === 'leader' ? success() : fail('This management link cannot claim this guild.', 403)
        }
        if (action.action === 'apply') {
          if (role) return fail('You are already a member of this guild.', 409)
          if (action.profile.faction !== guild.faction) return fail('Choose a character in this guild’s faction.', 400)
          await env.DB.prepare("INSERT INTO guild_applications (guild_id, user_id, profile, introduction) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM guild_memberships WHERE guild_id = ? AND user_id = ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET profile = excluded.profile, introduction = excluded.introduction, status = 'pending', updated_at = CURRENT_TIMESTAMP, decided_by = NULL WHERE guild_applications.status != 'approved' AND NOT EXISTS (SELECT 1 FROM guild_memberships WHERE guild_id = ? AND user_id = ?)")
            .bind(guildId, user.id, JSON.stringify(action.profile), action.introduction, guildId, user.id, guildId, user.id).run()
          return success()
        }
        if (action.action === 'update-profile') {
          if (!role) return fail('Only approved members can update a guild character.', 403)
          if (action.profile.faction !== guild.faction) return fail('Choose a character in this guild’s faction.', 400)
          const result = await env.DB.prepare('UPDATE guild_memberships SET profile = ? WHERE guild_id = ? AND user_id = ?').bind(JSON.stringify(action.profile), guildId, user.id).run()
          return result.meta.changes ? success() : fail('Your membership is no longer active.', 403)
        }
        if (role !== 'leader' && role !== 'officer') return fail('Only the guild lead or officers can manage this guild.', 403)
        if (action.action === 'approve') {
          const result = await env.DB.batch([
            env.DB.prepare(`INSERT INTO guild_memberships (guild_id, user_id, role, profile) SELECT guild_id, user_id, 'member', profile FROM guild_applications WHERE guild_id = ? AND user_id = ? AND status = 'pending' AND ${managerExists} ON CONFLICT(guild_id, user_id) DO NOTHING`).bind(guildId, action.userId, guildId, user.id),
            env.DB.prepare(`UPDATE guild_applications SET status = 'approved', decided_by = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM guild_memberships WHERE guild_id = ? AND user_id = ?) AND ${managerExists}`).bind(user.id, guildId, action.userId, guildId, action.userId, guildId, user.id),
            ...await campfireGrant(env.DB, guildId, action.userId),
          ])
          if (!result[0].meta.changes && !await guildRole(env.DB, guildId, action.userId)) return fail('This application is no longer pending.', 409)
          return success()
        }
        if (action.action === 'decline') {
          const result = await env.DB.prepare(`UPDATE guild_applications SET status = 'declined', decided_by = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ? AND status = 'pending' AND ${managerExists}`).bind(user.id, guildId, action.userId, guildId, user.id).run()
          return result.meta.changes ? success() : fail('This application is no longer pending.', 409)
        }
        if (action.action === 'set-role') {
          if (role !== 'leader') return fail('Only the guild lead can appoint or demote officers.', 403)
          const result = await env.DB.prepare("UPDATE guild_memberships SET role = ? WHERE guild_id = ? AND user_id = ? AND role != 'leader' AND EXISTS (SELECT 1 FROM guild_memberships manager WHERE manager.guild_id = ? AND manager.user_id = ? AND manager.role = 'leader')").bind(action.role, guildId, action.userId, guildId, user.id).run()
          return result.meta.changes ? success() : fail('This member’s guild role cannot be changed.', 409)
        }
        if (action.action === 'remove-member') {
          const result = await env.DB.batch([
            env.DB.prepare("DELETE FROM guild_memberships AS target WHERE target.guild_id = ? AND target.user_id = ? AND target.role != 'leader' AND EXISTS (SELECT 1 FROM guild_memberships manager WHERE manager.guild_id = ? AND manager.user_id = ? AND (manager.role = 'leader' OR (manager.role = 'officer' AND target.role = 'member')))").bind(guildId, action.userId, guildId, user.id),
            env.DB.prepare(`UPDATE guild_applications SET status = 'declined', decided_by = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ? AND NOT EXISTS (SELECT 1 FROM guild_memberships WHERE guild_id = ? AND user_id = ?) AND ${managerExists}`).bind(user.id, guildId, action.userId, guildId, action.userId, guildId, user.id),
            ...await campfireRevoke(env.DB, guildId, action.userId),
          ])
          return result[0].meta.changes ? success() : fail('This member cannot be removed by your guild role.', 403)
        }
        if (action.action === 'create-initiative') {
          const result = await env.DB.prepare(`INSERT INTO guild_initiatives (id, guild_id, title, description, status, created_by) SELECT ?, ?, ?, ?, ?, ? WHERE ${managerExists} AND (SELECT COUNT(*) FROM guild_initiatives WHERE guild_id = ?) < 50`).bind(crypto.randomUUID(), guildId, action.title, action.description, action.status, user.id, guildId, user.id, guildId).run()
          return result.meta.changes ? success() : fail('The guild can have up to 50 initiatives. Remove an old initiative before adding another.', 409)
        }
        if (action.action === 'update-initiative') {
          const result = await env.DB.prepare(`UPDATE guild_initiatives SET title = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND id = ? AND ${managerExists}`).bind(action.title, action.description, action.status, guildId, action.initiativeId, guildId, user.id).run()
          return result.meta.changes ? success() : fail('This initiative is no longer available.', 404)
        }
        if (action.action === 'delete-initiative') {
          const result = await env.DB.prepare(`DELETE FROM guild_initiatives WHERE guild_id = ? AND id = ? AND ${managerExists}`).bind(guildId, action.initiativeId, guildId, user.id).run()
          return result.meta.changes ? success() : fail('This initiative is no longer available.', 404)
        }
        return fail('Unknown guild action.', 400)
      } catch {
        return fail('Couldn’t update the guild. Please try again.', 503)
      }
    },
  } },
})
