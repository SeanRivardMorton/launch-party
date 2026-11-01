import { z } from 'zod'
import type { Card } from './protocol'

const choice = z.string().trim().min(1).max(40).regex(/^[\p{L}\p{N} '-]+$/u)
export const profileSchema = z.object({
  nickname: z.string().trim().min(2).max(32), faction: z.enum(['Alliance', 'Horde']),
  race: choice, characterClass: choice, professions: z.array(choice).max(2),
  bio: z.string().trim().max(280), published: z.boolean(),
}).strict()
export type ProfileRow = { user_id: string; nickname: string; faction: string; race: string; character_class: string; professions: string; bio: string; published: number; asset_key?: string | null; asset_format?: 'single' | 'codex-pet-v1'; avatar_updated_at?: number }
export function card(row: ProfileRow): Card {
  return { id: row.user_id, nickname: row.nickname, faction: row.faction, race: row.race,
    characterClass: row.character_class, professions: JSON.parse(row.professions), bio: row.bio,
    avatarUrl: row.asset_key ? `/api/campfire/avatar/${encodeURIComponent(row.user_id)}?v=${row.avatar_updated_at || 0}` : null,
    avatarFormat: row.asset_format || 'single' }
}
export async function getProfile(db: D1Database, userId: string) {
  return db.prepare(`SELECT p.*, a.asset_key, a.asset_format, a.asset_revision AS avatar_updated_at FROM campfire_profiles p LEFT JOIN campfire_avatars a ON a.user_id=p.user_id WHERE p.user_id=?`).bind(userId).first<ProfileRow>()
}
// Checked on upgrade AND every application message/broadcast, including after
// hibernation. Never trust a browser-provided identity or a cached session alone.
export async function authorized(db: D1Database, userId: string, sessionId: string, guildId: string, now = Date.now()) {
  return !!await db.prepare(`SELECT 1 FROM session s JOIN campfire_memberships m ON m.user_id=s.userId
    JOIN campfire_profiles p ON p.user_id=s.userId
    WHERE s.id=? AND s.userId=? AND s.expiresAt>? AND m.guild_id=? AND p.published=1`)
    .bind(sessionId, userId, now, guildId).first()
}
export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin
}
export async function readJson(request: Request, limit = 2048) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new Error('Expected JSON')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Missing body')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) { await reader.cancel(); throw new Error('Body too large') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}
