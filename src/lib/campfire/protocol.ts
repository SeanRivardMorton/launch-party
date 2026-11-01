import { z } from 'zod'

export const WORLD = { width: 1000, height: 600, speed: 220 } as const
export const emotes = ['wave', 'cheer', 'heart'] as const
export const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), x: z.number().finite(), y: z.number().finite() }).strict(),
  z.object({ type: z.literal('emote'), emote: z.enum(emotes) }).strict(),
  z.object({ type: z.literal('sync') }).strict(),
])
export type ClientMessage = z.infer<typeof messageSchema>
export type Point = { x: number; y: number }
export type Motion = { from: Point; to: Point; at: number; duration: number }
export type Card = {
  id: string; nickname: string; faction: string; race: string; characterClass: string
  professions: string[]; bio: string; avatarUrl: string | null
  avatarFormat?: 'single' | 'codex-pet-v1'
}
export type Peer = { id: string; card: Card; motion: Motion; emote?: { kind: typeof emotes[number]; at: number } }
export type ServerMessage = { type: 'snapshot'; self: string; peers: Peer[]; now: number }
  | { type: 'peer'; peer: Peer; now: number }
  | { type: 'leave'; id: string }
  | { type: 'error'; error: string }

export function position(motion: Motion, now: number): Point {
  const t = motion.duration === 0 ? 1 : Math.max(0, Math.min(1, (now - motion.at) / motion.duration))
  return { x: motion.from.x + (motion.to.x - motion.from.x) * t, y: motion.from.y + (motion.to.y - motion.from.y) * t }
}
export function move(motion: Motion, target: Point, now: number): Motion {
  const from = position(motion, now)
  const to = { x: Math.max(40, Math.min(WORLD.width - 40, target.x)), y: Math.max(100, Math.min(WORLD.height - 40, target.y)) }
  return { from, to, at: now, duration: Math.round(Math.hypot(to.x - from.x, to.y - from.y) / WORLD.speed * 1000) }
}
export function parseMessage(raw: string | ArrayBuffer): ClientMessage | null {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > 256) return null
  try { const parsed = messageSchema.safeParse(JSON.parse(raw)); return parsed.success ? parsed.data : null } catch { return null }
}
export type Rate = { tokens: number; at: number }
export function consume(rate: Rate, now: number): Rate | null {
  const tokens = Math.min(10, rate.tokens + Math.max(0, now - rate.at) / 200)
  return tokens < 1 ? null : { tokens: tokens - 1, at: Math.max(now, rate.at) }
}
