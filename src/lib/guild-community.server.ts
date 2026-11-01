import { getAuth } from './auth.server'
import { guildCharacterSchema, type GuildCharacterProfile, type GuildRole } from './guild-community'
import type { Faction } from './character-options'

export type GuildUser = { id: string; name: string }

export async function requireGuildUser(request: Request): Promise<{ user: GuildUser } | { response: Response }> {
  const auth = getAuth()
  if (!auth) return { response: Response.json({ error: 'Account sign-in is not configured. Please try again later.' }, { status: 503 }) }
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return { response: Response.json({ error: 'Sign in to continue.' }, { status: 401 }) }
    return { user: { id: session.user.id, name: session.user.name } }
  } catch {
    return { response: Response.json({ error: 'Sign-in is temporarily unavailable. Please try again.' }, { status: 503 }) }
  }
}

export async function guildRole(db: D1Database, guildId: string, userId: string): Promise<GuildRole | null> {
  return (await db.prepare('SELECT role FROM guild_memberships WHERE guild_id = ? AND user_id = ?').bind(guildId, userId).first<{ role: GuildRole }>())?.role || null
}

export function defaultGuildProfile(user: GuildUser, faction: Faction): GuildCharacterProfile {
  return guildCharacterSchema.parse({ nickname: user.name.slice(0, 60) || 'Adventurer', faction, race: 'Undecided', characterClass: 'Undecided', fulfilledRoles: ['Undecided'], professions: [] })
}

export async function campfireMembershipsAvailable(db: D1Database): Promise<boolean> {
  return Boolean(await db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'campfire_memberships'").first())
}

// PR #4 owns the campfire schema. Sync only when its table actually exists;
// never create a competing schema or grant room access to a pending applicant.
export async function campfireGrant(db: D1Database, guildId: string, userId: string): Promise<D1PreparedStatement[]> {
  if (!await campfireMembershipsAvailable(db)) return []
  return [db.prepare('INSERT INTO campfire_memberships (guild_id, user_id) SELECT guild_id, user_id FROM guild_memberships WHERE guild_id = ? AND user_id = ? ON CONFLICT(guild_id, user_id) DO NOTHING').bind(guildId, userId)]
}

export async function campfireRevoke(db: D1Database, guildId: string, userId: string): Promise<D1PreparedStatement[]> {
  if (!await campfireMembershipsAvailable(db)) return []
  return [db.prepare('DELETE FROM campfire_memberships WHERE guild_id = ? AND user_id = ? AND NOT EXISTS (SELECT 1 FROM guild_memberships WHERE guild_id = ? AND user_id = ?)').bind(guildId, userId, guildId, userId)]
}
