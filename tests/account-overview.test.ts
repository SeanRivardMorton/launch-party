import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { afterEach, expect, it } from 'vitest'
import { readAccountOverview } from '../src/lib/account-overview.server'

const databases: DatabaseSync[] = []
function fixture() {
  const sql = new DatabaseSync(':memory:')
  databases.push(sql)
  sql.exec(`CREATE TABLE user(id TEXT PRIMARY KEY); INSERT INTO user VALUES ('owner'),('outsider');
    CREATE TABLE guilds(id TEXT PRIMARY KEY, name TEXT);
    INSERT INTO guilds VALUES ('a','First guild'),('b','Second guild'),('pending','Pending guild'),('old','Former guild');
    CREATE TABLE guild_memberships(guild_id TEXT, user_id TEXT, role TEXT, profile TEXT);
    CREATE TABLE guild_applications(guild_id TEXT, user_id TEXT, status TEXT, profile TEXT, created_at TEXT);`)
  sql.exec(readFileSync(new URL('../migrations/0005_live_campfire.sql', import.meta.url), 'utf8'))
  sql.exec(readFileSync(new URL('../migrations/0006_animated_sprite_atlas.sql', import.meta.url), 'utf8'))
  const db = { prepare(query: string) {
    let values: any[] = []
    const statement = {
      bind(...params: any[]) { values = params; return statement },
      async first() { return sql.prepare(query).get(...values) || null },
      async all() { return { results: sql.prepare(query).all(...values) } },
    }
    return statement
  } } as unknown as D1Database
  return { sql, db }
}
afterEach(() => { databases.splice(0).forEach(db => db.close()) })
const profile = (nickname: string) => JSON.stringify({ nickname, faction: 'Horde', race: 'Orc', characterClass: 'Mage', professions: ['Alchemy'], fulfilledRoles: ['Damage'], email: 'must-not-escape@example.invalid', battleTag: 'Private#1234' })

it('isolates every query by owner, preserves multiple guild profiles and never promotes applications or campfire grants', async () => {
  const { sql, db } = fixture()
  const insert = sql.prepare('INSERT INTO guild_memberships VALUES (?, ?, ?, ?)')
  insert.run('a', 'owner', 'member', profile('First character'))
  insert.run('b', 'owner', 'officer', profile('Second character'))
  insert.run('a', 'outsider', 'leader', profile('Other person'))
  const apply = sql.prepare('INSERT INTO guild_applications VALUES (?, ?, ?, ?, ?)')
  apply.run('pending', 'owner', 'pending', profile('Applicant'), 'now')
  apply.run('old', 'owner', 'approved', profile('Former member'), 'now')
  sql.exec("INSERT INTO campfire_memberships VALUES ('pending','owner')")
  const result = await readAccountOverview(db, 'owner')
  expect(result.memberships.map(m => m.profile.nickname)).toEqual(['First character', 'Second character'])
  expect(result.applications.map(a => a.profile.nickname)).toEqual(['Applicant'])
  expect(result.campfire).toBeNull()
  expect(result.memberships.every(m => !m.campfireAvailable)).toBe(true)
  sql.exec("INSERT INTO campfire_memberships VALUES ('a','owner')")
  expect((await readAccountOverview(db, 'owner')).memberships.find(m => m.guildId === 'a')?.campfireAvailable).toBe(true)
  expect(JSON.stringify(result)).not.toMatch(/must-not-escape|Private#|Other person|Former member/)
  expect((await readAccountOverview(db, 'outsider')).memberships.map(m => m.profile.nickname)).toEqual(['Other person'])
  sql.exec("DELETE FROM guild_memberships WHERE user_id='owner'")
  expect((await readAccountOverview(db, 'owner')).memberships).toEqual([])
})

it('returns only the saved owner campfire fields and an authorized asset URL, including unpublished artwork', async () => {
  const { sql, db } = fixture()
  sql.exec(`INSERT INTO campfire_profiles VALUES ('owner','Campfire Name','Alliance','Dwarf','Priest','["Mining"]','Saved bio',0,1);
    INSERT INTO campfire_avatars(user_id,state,asset_key,asset_format,asset_revision,token,input_json) VALUES ('owner','ready','secret/storage/path','codex-pet-v1',42,'generation-token','{"private":"inputs"}');`)
  expect((await readAccountOverview(db, 'owner')).campfire).toEqual({ nickname: 'Campfire Name', faction: 'Alliance', race: 'Dwarf', characterClass: 'Priest', professions: ['Mining'], bio: 'Saved bio', published: false, avatarUrl: '/api/campfire/avatar/owner?v=42', avatarFormat: 'codex-pet-v1' })
  expect((await readAccountOverview(db, 'outsider')).campfire).toBeNull()
})

it('distinguishes legitimate empty results from corrupt data or unavailable storage', async () => {
  const { sql, db } = fixture()
  expect(await readAccountOverview(db, 'owner')).toEqual({ campfire: null, memberships: [], applications: [] })
  sql.prepare('INSERT INTO guild_memberships VALUES (?, ?, ?, ?)').run('a', 'owner', 'member', '{bad json')
  await expect(readAccountOverview(db, 'owner')).rejects.toThrow()
  sql.exec('DROP TABLE guild_memberships')
  await expect(readAccountOverview(db, 'owner')).rejects.toThrow()
})
