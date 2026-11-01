import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GuildCampfire } from '../src/lib/campfire/room'
import type { Peer } from '../src/lib/campfire/protocol'

const state = vi.hoisted(() => ({ revoked: new Set<string>() }))
vi.mock('../src/lib/campfire/data', async importOriginal => {
  const original = await importOriginal<typeof import('../src/lib/campfire/data')>()
  return { ...original,
    authorized: async (_db: unknown, id: string) => !state.revoked.has(id),
    getProfile: async (_db: unknown, id: string) => ({ user_id: id, nickname: id, faction: 'Alliance', race: 'Dwarf', character_class: 'Priest', professions: '[]', bio: '', published: 1 }),
  }
})
function socket(id: string) {
  const point = { x: 300, y: 430 }
  let saved = { guildId: 'g', sessionId: `s-${id}`, peer: { id, card: { id, nickname: id }, motion: { from: point, to: point, at: 0, duration: 0 } } as Peer, rate: { tokens: 10, at: Date.now() }, emoteAt: 0 }
  return { deserializeAttachment: () => structuredClone(saved), serializeAttachment: (value: typeof saved) => { saved = structuredClone(value) }, send: vi.fn(), close: vi.fn() }
}
describe('hibernating room events', () => {
  beforeEach(() => state.revoked.clear())
  it('restores motion/emote/rate from attachments in a NEW instance and snapshots both clients', async () => {
    const a = socket('a'); const b = socket('b')
    const storage = new Map()
    const context = { getWebSockets: () => [a, b], storage: { put: async (key: string, value: unknown) => { storage.set(key, value) } } }
    const room = () => new GuildCampfire(context as unknown as DurableObjectState, { DB: {} } as Cloudflare.Env)
    await room().webSocketMessage(a as unknown as WebSocket, '{"type":"move","x":850,"y":500}')
    expect(a.deserializeAttachment().peer.motion.to).toEqual({ x: 850, y: 500 })
    expect(storage.has('position:a')).toBe(true)
    await room().webSocketMessage(a as unknown as WebSocket, '{"type":"emote","emote":"wave"}')
    expect(JSON.parse(b.send.mock.calls.at(-1)![0]).peer.emote.kind).toBe('wave')
    await room().webSocketMessage(b as unknown as WebSocket, '{"type":"sync"}')
    const snapshot = JSON.parse(b.send.mock.calls.at(-1)![0])
    expect(snapshot.type).toBe('snapshot')
    expect(snapshot.self).toBe('b')
    expect(snapshot.peers).toHaveLength(2)
    expect(snapshot.peers[0].motion.to.x).toBe(850)
    expect(snapshot.peers[0].emote.kind).toBe('wave')
    expect(a.deserializeAttachment().rate.tokens).toBeLessThan(10)
  })
  it('rejects revoked senders and stops broadcasting data to revoked passive viewers', async () => {
    const a = socket('a'); const b = socket('b')
    const ctx = { getWebSockets: () => [a, b], storage: { put: vi.fn() } }
    const room = new GuildCampfire(ctx as unknown as DurableObjectState, { DB: {} } as Cloudflare.Env)
    state.revoked.add('b')
    await room.webSocketMessage(a as unknown as WebSocket, '{"type":"emote","emote":"heart"}')
    expect(b.close).toHaveBeenCalledWith(4001, expect.any(String))
    expect(b.send).not.toHaveBeenCalled()
    await room.webSocketMessage(b as unknown as WebSocket, '{"type":"move","x":900,"y":500}')
    expect(ctx.storage.put).not.toHaveBeenCalledWith('position:b', expect.anything())
  })
  it('rejects invalid payloads and repeated bursts after wakeup', async () => {
    const a = socket('a')
    const ctx = { getWebSockets: () => [a], storage: { put: vi.fn() } }
    const room = () => new GuildCampfire(ctx as unknown as DurableObjectState, { DB: {} } as Cloudflare.Env)
    await room().webSocketMessage(a as unknown as WebSocket, '{"type":"move","x":5,"y":6,"userId":"b"}')
    expect(a.close).toHaveBeenCalledWith(1008, 'Invalid message')
    for (let i = 0; i < 11; i++) await room().webSocketMessage(a as unknown as WebSocket, '{"type":"sync"}')
    expect(a.close).toHaveBeenCalledWith(4008, 'Too many messages')
  })
})
