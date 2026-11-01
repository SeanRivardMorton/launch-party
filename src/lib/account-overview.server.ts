import type { AccountOverview } from './account-overview'
import { guildCharacterSchema, type ApplicationStatus, type GuildRole } from './guild-community'
import { getProfile, profileSchema } from './campfire/data'

export async function readAccountOverview(db: D1Database, userId: string): Promise<AccountOverview> {
  const [profile, memberships, applications] = await Promise.all([
    getProfile(db, userId),
    db.prepare(`SELECT g.id AS guildId, g.name AS guildName, m.role, m.profile,
      EXISTS (SELECT 1 FROM campfire_memberships c WHERE c.guild_id = m.guild_id AND c.user_id = m.user_id) AS campfireAvailable
      FROM guild_memberships m JOIN guilds g ON g.id = m.guild_id WHERE m.user_id = ? ORDER BY g.name, g.id`).bind(userId)
      .all<{ guildId: string; guildName: string; role: GuildRole; profile: string; campfireAvailable: number }>(),
    db.prepare(`SELECT g.id AS guildId, g.name AS guildName, a.status, a.profile FROM guild_applications a
      JOIN guilds g ON g.id = a.guild_id WHERE a.user_id = ? AND a.status != 'approved'
      AND NOT EXISTS (SELECT 1 FROM guild_memberships m WHERE m.guild_id = a.guild_id AND m.user_id = a.user_id)
      ORDER BY a.created_at DESC, g.id`).bind(userId)
      .all<{ guildId: string; guildName: string; status: ApplicationStatus; profile: string }>(),
  ])
  return {
    campfire: profile ? {
      ...profileSchema.parse({ nickname: profile.nickname, faction: profile.faction, race: profile.race,
        characterClass: profile.character_class, professions: JSON.parse(profile.professions), bio: profile.bio, published: !!profile.published }),
      avatarUrl: profile.asset_key ? `/api/campfire/avatar/${encodeURIComponent(userId)}?v=${profile.avatar_updated_at || 0}` : null,
      avatarFormat: profile.asset_format || 'single',
    } : null,
    memberships: memberships.results.map(row => ({ guildId: row.guildId, guildName: row.guildName, role: row.role,
      profile: guildCharacterSchema.parse(JSON.parse(row.profile)), campfireAvailable: !!row.campfireAvailable })),
    applications: applications.results.map(row => ({ guildId: row.guildId, guildName: row.guildName, status: row.status,
      profile: guildCharacterSchema.parse(JSON.parse(row.profile)) })),
  }
}
