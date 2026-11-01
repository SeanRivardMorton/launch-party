import { describe, expect, it } from 'vitest'
import { consume, move, parseMessage, position, WORLD } from '../src/lib/campfire/protocol'
import { authorized, card, sameOrigin } from '../src/lib/campfire/data'

describe('untrusted room protocol', () => {
  it('rejects spoofed identity, unknown emotes, binary, huge and nonfinite messages', () => {
    for (const raw of ['{"type":"move","x":0,"y":0,"userId":"victim"}', '{"type":"emote","emote":"script"}', '{"type":"move","x":1e999,"y":0}', 'x'.repeat(257), '{}', 'not json', new ArrayBuffer(4)]) expect(parseMessage(raw)).toBeNull()
    expect(parseMessage('{"type":"move","x":-1000,"y":10000}')).toEqual({ type: 'move', x: -1000, y: 10000 })
  })
  it('bounds destinations and limits speed even when movement is interrupted', () => {
    const still = { from: { x: 100, y: 200 }, to: { x: 100, y: 200 }, at: 0, duration: 0 }
    const first = move(still, { x: 10_000, y: -10_000 }, 1000)
    expect(first.to).toEqual({ x: 960, y: 100 })
    const current = position(first, 1500)
    expect(Math.hypot(current.x - 100, current.y - 200)).toBeCloseTo(WORLD.speed / 2, 0)
    const second = move(first, { x: 0, y: 9000 }, 1500)
    expect(second.from).toEqual(current)
    expect(position(second, 999_999)).toEqual({ x: 40, y: 560 })
    expect(position(second, 0)).toEqual(current)
  })
  it('rate limits bursts and recovers over time without clock rollback credit', () => {
    let rate = { tokens: 10, at: 1000 }
    for (let i = 0; i < 10; i++) rate = consume(rate, 1000)!
    expect(consume(rate, 1000)).toBeNull()
    expect(consume(rate, 0)).toBeNull()
    expect(consume(rate, 1200)?.tokens).toBe(0)
    expect(consume(rate, 100_000)?.tokens).toBe(9)
    expect(consume({ tokens: 5, at: 1000 }, 0)).toEqual({ tokens: 4, at: 1000 })
  })
})
describe('privacy and session boundary', () => {
  it('projects an explicit public character DTO without email or contact fields', () => {
    const row = { user_id: 'u', nickname: 'Bramble', faction: 'Horde', race: 'Orc', character_class: 'Warrior', professions: '["Mining"]', bio: 'Hello', published: 1, email: 'private@example.test', discord: 'private', asset_key: 'private-bucket-key' }
    const dto = card(row)
    expect(JSON.stringify(dto)).not.toMatch(/private|email|discord|asset_key/)
    expect(dto.avatarUrl).toBe('/api/campfire/avatar/u')
  })
  it('requires exact origin (including port), never just a matching hostname', () => {
    for (const origin of ['https://example.test.evil.test', 'http://example.test', 'https://example.test:444', 'null', '']) expect(sameOrigin(new Request('https://example.test/api', { headers: { origin } }))).toBe(false)
    expect(sameOrigin(new Request('https://example.test/api', { headers: { origin: 'https://example.test' } }))).toBe(true)
  })
  it('checks session ownership/expiry, membership AND publication using bound values', async () => {
    let sql = ''; let args: unknown[] = []
    const db = { prepare(query: string) { sql = query; return { bind(...values: unknown[]) { args = values; return { first: async () => null } } } } } as unknown as D1Database
    expect(await authorized(db, 'user', 'session', "guild' OR 1=1", 123)).toBe(false)
    expect(args).toEqual(['session', 'user', 123, "guild' OR 1=1"])
    expect(sql).toContain('s.userId=? AND s.expiresAt>?')
    expect(sql).toContain('m.guild_id=? AND p.published=1')
    expect(sql).not.toContain("guild' OR")
  })
})
