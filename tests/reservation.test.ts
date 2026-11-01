import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { RESERVE_AVATAR, STALE_MS } from '../src/lib/campfire/avatar-state'

it('atomic SQLite reservation prevents duplicate jobs, caps all attempts, and fences stale completions', () => {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE user(id TEXT PRIMARY KEY); INSERT INTO user VALUES (\'u\')')
  db.exec(readFileSync(new URL('../migrations/0005_live_campfire.sql', import.meta.url), 'utf8'))
  const reserve = db.prepare(RESERVE_AVATAR)
  const now = 1_000_000
  expect(reserve.run('u', 'first', '{"race":"Dwarf"}', now, now - STALE_MS).changes).toBe(1)
  // Competing request loses without incrementing the attempts count.
  expect(reserve.run('u', 'duplicate', '{}', now, now - STALE_MS).changes).toBe(0)
  expect(db.prepare('SELECT attempts FROM campfire_avatars').get()?.attempts).toBe(1)
  // Abandoned pending work may be replaced, consuming the second attempt.
  expect(reserve.run('u', 'second', '{"race":"Orc"}', now + STALE_MS + 1, now + 1).changes).toBe(1)
  const staleCompletion = db.prepare("UPDATE campfire_avatars SET state='ready',asset_key='old.png' WHERE user_id=? AND token=? AND state='pending'")
  expect(staleCompletion.run('u', 'first').changes).toBe(0)
  db.exec("UPDATE campfire_avatars SET state='failed'")
  expect(reserve.run('u', 'third', '{}', now + 2 * STALE_MS, now + STALE_MS).changes).toBe(0)
  expect(db.prepare('SELECT attempts,input_json FROM campfire_avatars').get()).toEqual(expect.objectContaining({ attempts: 2, input_json: '{"race":"Orc"}' }))
  db.close()
})
