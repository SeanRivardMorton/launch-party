import { expect, it, vi } from 'vitest'
import { createPng, encodePng } from '../src/lib/campfire/png'
import { ANIMATIONS } from '../src/lib/campfire/atlas'
import { AvatarGeneration } from '../src/lib/campfire/avatar'
import { decodePng } from '../src/lib/campfire/atlas-image.server'
import { generateImage } from '../src/lib/campfire/image-provider.server'
import { stripFixture } from './atlas-fixture'

vi.mock('../src/lib/campfire/image-provider.server', () => ({ IMAGE_MODEL: 'synthetic-provider', generateImage: vi.fn() }))
it('resumes every row in a fresh alarm instance and publishes only a complete 57-frame atlas', async () => {
  const storage = new Map<string, unknown>([['userId', 'owner']])
  const objects = new Map<string, Uint8Array>()
  let state = 'pending'; let published = ''; let completed = 0
  const db = { prepare: (sql: string) => ({ bind: (...args: unknown[]) => ({
    first: async () => ({ state, token: 'token', input_json: '{"race":"Dwarf"}' }),
    run: async () => {
      if (sql.includes("SET state='ready'")) { state = 'ready'; published = String(args[0]); completed++ }
      if (sql.includes("SET state='failed'")) state = 'failed'
      return { meta: { changes: 1 } }
    },
  }) }) }
  const bucket = {
    put: async (key: string, bytes: Uint8Array) => { objects.set(key, new Uint8Array(bytes)) },
    get: async (key: string) => objects.has(key) ? { arrayBuffer: async () => new Uint8Array(objects.get(key)!).buffer } : null,
    delete: async (keys: string | string[]) => { for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key) },
  }
  const ctx = { storage: { get: async (key: string) => structuredClone(storage.get(key)), put: async (key: string, value: unknown) => { storage.set(key, structuredClone(value)) }, setAlarm: vi.fn(), deleteAlarm: vi.fn() } }
  vi.mocked(generateImage).mockImplementation(async (_key, _user, prompt, _size, refs) => {
    if (!refs?.length) return encodePng(createPng(1024, 1024))
    const row = ANIMATIONS.findIndex(animation => prompt.includes(`State: ${animation.name}.`))
    return stripFixture(row)
  })
  for (let step = 0; step < 11; step++) {
    expect(state).toBe('pending')
    expect(published).toBe('')
    await new AvatarGeneration(ctx as unknown as DurableObjectState, { DB: db, AVATAR_BUCKET: bucket, OPENAI_API_KEY: 'synthetic-test-key' } as unknown as Cloudflare.Env).alarm()
  }
  expect(state).toBe('ready')
  expect(completed).toBe(1)
  expect(generateImage).toHaveBeenCalledTimes(10)
  expect(objects.size).toBe(1)
  expect(decodePng(objects.get(published)!, 1536, 1872).width).toBe(1536)
  expect(ctx.storage.deleteAlarm).toHaveBeenCalled()
}, 20_000)
