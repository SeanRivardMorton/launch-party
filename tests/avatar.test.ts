import { expect, it, vi } from 'vitest'
import { AvatarGeneration } from '../src/lib/campfire/avatar'

it('fails safely without provider credentials and does not leave pending jobs or retry charges', async () => {
  const values = new Map<string, string>([['userId', 'owner']])
  const updates: unknown[][] = []
  const db = { prepare: (sql: string) => ({ bind: (...args: unknown[]) => ({ first: async () => ({ state: 'pending', token: 'reservation-1' }), run: async () => { updates.push([sql, ...args]); return {} } }) }) }
  const ctx = { storage: { get: async (key: string) => values.get(key), put: async (key: string, value: string) => { values.set(key, value) }, setAlarm: vi.fn(), deleteAlarm: vi.fn() } }
  const provider = vi.spyOn(globalThis, 'fetch')
  await new AvatarGeneration(ctx as unknown as DurableObjectState, { DB: db } as unknown as Cloudflare.Env).alarm()
  expect(provider).not.toHaveBeenCalled()
  expect(updates.at(-1)![0]).toContain("SET state='failed'")
  expect(updates.at(-1)!.slice(-2)).toEqual(['owner', 'reservation-1'])
  expect(ctx.storage.deleteAlarm).toHaveBeenCalled()
  provider.mockRestore()
})

it('records a forced provider error safely and never automatically retries the billed reservation', async () => {
  const values = new Map<string, string>([['userId', 'owner']])
  const updates: unknown[][] = []
  let status = 'pending'
  const db = { prepare: (sql: string) => ({ bind: (...args: unknown[]) => ({ first: async () => ({ state: status, token: 'reservation-2', input_json: '{"race":"Dwarf"}' }), run: async () => { updates.push([sql, ...args]); status = 'failed'; return {} } }) }) }
  const ctx = { storage: { get: async (key: string) => values.get(key), put: async (key: string, value: string) => { values.set(key, value) }, setAlarm: vi.fn(), deleteAlarm: vi.fn() } }
  const provider = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"error":"synthetic provider failure"}', { status: 500 }))
  const job = () => new AvatarGeneration(ctx as unknown as DurableObjectState, { DB: db, OPENAI_API_KEY: 'synthetic-test-key', AVATAR_BUCKET: {} } as unknown as Cloudflare.Env)
  await job().alarm()
  await job().alarm()
  expect(provider).toHaveBeenCalledTimes(1)
  const request = provider.mock.calls[0][1]!
  expect(JSON.parse(String(request.body))).toEqual(expect.objectContaining({ n: 1, output_format: 'png', size: '1024x1024' }))
  expect(JSON.parse(String(request.body)).safety_identifier).toMatch(/^[0-9a-f]{64}$/)
  expect(updates.at(-1)![0]).toContain("SET state='failed'")
  expect(updates.at(-1)!.slice(-2)).toEqual(['owner', 'reservation-2'])
  provider.mockRestore()
})
