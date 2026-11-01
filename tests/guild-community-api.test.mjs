import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

// Real local Better Auth/D1 integration: start pnpm dev and apply local migrations.
// Deliberately refuses remote hosts so fixture creation/cleanup stays local.
const base = process.env.GUILD_TEST_URL || 'http://localhost:3000'
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Guild tests require a local server')
const guildIds = []
const userIds = []
let campfireTablePresent = false
let campfireTableCreated = false
const quote = value => `'${String(value).replaceAll("'", "''")}'`
function sql(command) {
  const result = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', '--local', '--json', '--command', command], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || 'Local SQL verification failed')
  return JSON.parse(result.stdout)
}

async function account(name) {
  const cookies = new Map()
  async function request(path, { method = 'GET', body, origin = base, headers = {} } = {}) {
    const response = await fetch(`${base}${path}`, {
      method, headers: { origin, cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]
      const index = pair.indexOf('=')
      cookies.set(pair.slice(0, index), pair.slice(index + 1))
    }
    return response
  }
  const response = await request('/api/auth/sign-up/email', { method: 'POST', body: { name, email: `${randomUUID()}@example.invalid`, password: randomBytes(24).toString('hex') } })
  assert.equal(response.status, 200, 'Local auth signup must be configured')
  const { user } = await response.json()
  userIds.push(user.id)
  return { id: user.id, request }
}

const profile = (nickname = 'Synthetic Mage') => ({ nickname, faction: 'Horde', race: 'Orc', characterClass: 'Mage', fulfilledRoles: ['Damage'], professions: ['Alchemy'] })
const action = (actor, guildId, body, options = {}) => actor.request(`/api/guilds/${guildId}/community`, { method: 'POST', body, ...options })
const community = async (actor, guildId, query = '') => {
  const response = await actor.request(`/api/guilds/${guildId}/community${query}`)
  assert.equal(response.status, 200)
  return response.json()
}

test('guild leadership, officer approvals, private roster, initiatives and owner migration', { timeout: 180000 }, async t => {
  try {
    const lead = await account('Synthetic Guild Lead')
    const member = await account('Synthetic Guild Member')
    const officer = await account('Synthetic Guild Officer')
    const outsider = await account('Synthetic Guild Outsider')
    const id = randomUUID()
    guildIds.push(id)
    const managementKey = randomBytes(32).toString('hex')
    const creation = await lead.request('/api/guilds', { method: 'POST', body: { submissionId: id, managementKey, name: 'Synthetic Managed Guild', faction: 'Horde', region: 'Europe', description: 'Synthetic guild for authenticated membership verification.', publishConsent: true } })
    assert.equal(creation.status, 200)
    await t.test('authenticated publication assigns exactly one lead', async () => {
      const state = await community(lead, id)
      assert.equal(state.viewer.role, 'leader')
      assert.equal(state.members.filter(person => person.role === 'leader').length, 1)
      assert.equal(state.members[0].userId, lead.id)
      const anonymous = await fetch(`${base}/api/guilds/${id}/community`)
      assert.equal(anonymous.status, 401)
      const publicPage = await (await fetch(`${base}/api/guilds/${id}`)).json()
      assert(!JSON.stringify(publicPage).includes(managementKey))
      assert(!JSON.stringify(publicPage).includes('owner_user_id'))
    })
    await t.test('applications do not grant roster or management access', async () => {
      assert.equal((await action(member, id, { action: 'apply', profile: profile(), introduction: 'I would like to join.' })).status, 200)
      assert.equal((await action(member, id, { action: 'apply', profile: profile() })).status, 200)
      const pending = await community(member, id)
      assert.equal(pending.viewer.applicationStatus, 'pending')
      assert.equal(pending.viewer.role, null)
      assert.deepEqual(pending.members, [])
      assert.deepEqual(pending.initiatives, [])
      assert.equal((await action(member, id, { action: 'approve', userId: member.id })).status, 403)
      assert.equal((await action(outsider, id, { action: 'claim', managementKey })).status, 403)
      assert.equal((await lead.request(`/api/guilds/${id}`, { method: 'PATCH', body: { recruitmentNeeds: [] }, headers: { authorization: `Bearer ${managementKey}` }, origin: 'https://other.invalid' })).status, 403)
      assert.equal((await outsider.request(`/api/guilds/${id}`, { method: 'PATCH', body: { recruitmentNeeds: [] }, headers: { authorization: `Bearer ${managementKey}` } })).status, 403)
      assert.equal((await community(lead, id)).applications.length, 1)
    })
    await t.test('approval is persistent and idempotent; members see safe roster data', async () => {
      assert.equal((await action(lead, id, { action: 'approve', userId: member.id })).status, 200)
      assert.equal((await action(lead, id, { action: 'approve', userId: member.id })).status, 200)
      const approved = await community(member, id)
      assert.equal(approved.viewer.role, 'member')
      assert.equal(approved.members.filter(person => person.userId === member.id).length, 1)
      assert.equal(approved.members.find(person => person.userId === member.id).characterClass, 'Mage')
      assert(!JSON.stringify(approved).includes('@example.invalid'))
      assert.deepEqual(approved.applications, [])
      assert.equal((await action(member, id, { action: 'update-profile', profile: { ...profile(), fulfilledRoles: ['Tank'] } })).status, 400)
      assert.equal((await action(member, id, { action: 'update-profile', profile: profile('Updated Synthetic Mage') })).status, 200)
      assert.equal((await community(lead, id)).members.find(person => person.userId === member.id).nickname, 'Updated Synthetic Mage')
    })
    await t.test('BattleTags are self-editable and shared only with approved guildmates', async () => {
      const path = `/api/guilds/${id}/battletags/${member.id}`
      assert.equal((await fetch(`${base}${path}`)).status, 401)
      assert.equal((await action(lead, id, { action: 'update-battletag', battleTag: 'Leader#1234' })).status, 200)
      assert.equal((await action(member, id, { action: 'update-battletag', battleTag: '  PlayerName#123456  ', userId: lead.id })).status, 200)
      assert.equal((await (await lead.request(path)).json()).battleTag, 'PlayerName#123456')
      const roster = await community(lead, id)
      assert.equal(roster.members.find(person => person.userId === member.id).battleTag, 'PlayerName#123456')
      assert.equal(roster.members.find(person => person.userId === lead.id).battleTag, 'Leader#1234')
      assert.equal((await member.request(path)).headers.get('cache-control'), 'no-store')
      assert.equal((await outsider.request(path)).status, 403)
      assert.equal((await action(outsider, id, { action: 'update-battletag', battleTag: 'Outsider#1234' })).status, 403)
      assert.equal((await action(outsider, id, { action: 'apply', profile: profile() })).status, 200)
      assert.equal((await outsider.request(path)).status, 403)
      assert(!JSON.stringify(await community(outsider, id)).includes('PlayerName#123456'))
      assert(!JSON.stringify(await (await fetch(`${base}/api/guilds/${id}`)).json()).includes('PlayerName#123456'))
      assert(!JSON.stringify(await (await fetch(`${base}/api/guilds`)).json()).includes('PlayerName#123456'))
      for (const battleTag of ['NoDiscriminator', 'Player#12', 'Has Spaces#1234', '<script>#1234', 'x'.repeat(65)]) {
        assert.equal((await action(member, id, { action: 'update-battletag', battleTag })).status, 400)
      }
      assert.equal((await action(member, id, { action: 'update-battletag', battleTag: '' })).status, 200)
      assert.equal((await (await lead.request(path)).json()).battleTag, '')
      assert.equal((await action(member, id, { action: 'update-battletag', battleTag: 'PlayerName#123456' })).status, 200)
      assert.equal((await action(member, id, { action: 'update-battletag', battleTag: 'Changed#1234' }, { origin: 'https://other.invalid' })).status, 403)
    })
    await t.test('only lead appoints officers; officers manage initiatives and needs', async () => {
      assert.equal((await action(officer, id, { action: 'apply', profile: profile('Synthetic Officer Mage') })).status, 200)
      assert.equal((await action(lead, id, { action: 'approve', userId: officer.id })).status, 200)
      assert.equal((await action(member, id, { action: 'set-role', userId: member.id, role: 'officer' })).status, 403)
      assert.equal((await action(lead, id, { action: 'set-role', userId: officer.id, role: 'officer' })).status, 200)
      assert.equal((await community(officer, id)).viewer.role, 'officer')
      assert.equal((await action(officer, id, { action: 'set-role', userId: member.id, role: 'officer' })).status, 403)
      assert.equal((await action(officer, id, { action: 'remove-member', userId: lead.id })).status, 403)
      assert.equal((await action(lead, id, { action: 'set-role', userId: lead.id, role: 'member' })).status, 409)
      const initiative = { action: 'create-initiative', title: 'Prepare raid consumables', description: 'Collect herbs and craft potions for our first raid.', status: 'planned' }
      assert.equal((await action(officer, id, initiative)).status, 200)
      const saved = (await community(member, id)).initiatives[0]
      assert.equal(saved.title, initiative.title)
      assert.equal((await action(member, id, { ...initiative, action: 'update-initiative', initiativeId: saved.id, status: 'completed' })).status, 403)
      assert.equal((await action(officer, id, { ...initiative, action: 'update-initiative', initiativeId: saved.id, status: 'active' })).status, 200)
      assert.equal((await community(member, id)).initiatives[0].status, 'active')
      const need = { name: 'Off-tank', category: 'Role', quantity: 1, notes: 'For our first raid.' }
      assert.equal((await officer.request(`/api/guilds/${id}`, { method: 'PATCH', body: { recruitmentNeeds: [need] } })).status, 200)
      assert.equal((await member.request(`/api/guilds/${id}`, { method: 'PATCH', body: { recruitmentNeeds: [] } })).status, 403)
      assert.equal((await (await fetch(`${base}/api/guilds/${id}`)).json()).guild.recruitmentNeeds[0].name, 'Off-tank')
      assert.equal((await action(lead, id, { action: 'delete-initiative', initiativeId: saved.id })).status, 200)
      assert.equal((await community(member, id)).initiatives.length, 0)
    })
    await t.test('officers review applicants; approval races create one membership; removal revokes access', async () => {
      assert.equal((await action(outsider, id, { action: 'apply', profile: profile('Synthetic Returning Applicant') })).status, 200)
      assert.equal((await action(officer, id, { action: 'decline', userId: outsider.id })).status, 200)
      assert.equal((await community(outsider, id)).viewer.applicationStatus, 'declined')
      assert.equal((await action(outsider, id, { action: 'apply', profile: profile() })).status, 200)
      const approvals = await Promise.all([action(lead, id, { action: 'approve', userId: outsider.id }), action(officer, id, { action: 'approve', userId: outsider.id })])
      assert(approvals.every(response => response.status === 200))
      assert.equal((await community(outsider, id)).members.filter(person => person.userId === outsider.id).length, 1)
      assert.equal((await action(officer, id, { action: 'remove-member', userId: outsider.id })).status, 200)
      const removed = await community(outsider, id)
      assert.equal(removed.viewer.role, null)
      assert.deepEqual(removed.members, [])
      assert.deepEqual(removed.initiatives, [])
      assert.equal((await outsider.request(`/api/guilds/${id}/battletags/${member.id}`)).status, 403)
      assert.equal((await action(officer, id, { action: 'remove-member', userId: officer.id })).status, 403)
    })
    await t.test('roster pagination exposes all approved members, not applicants', async () => {
      const extraIds = Array.from({ length: 21 }, () => randomUUID())
      userIds.push(...extraIds)
      sql(`INSERT INTO user (id, name, email, createdAt, updatedAt) VALUES ${extraIds.map((userId, index) => `(${quote(userId)}, 'Synthetic Roster ${index}', ${quote(`${userId}@example.invalid`)}, 0, 0)`).join(',')}; INSERT INTO guild_memberships (guild_id, user_id, role, profile) VALUES ${extraIds.map((userId, index) => `(${quote(id)}, ${quote(userId)}, 'member', ${quote(JSON.stringify(profile(`Synthetic Roster ${index}`)))})`).join(',')};`)
      const first = await community(member, id)
      const second = await community(member, id, '?membersPage=1')
      assert.equal(first.members.length, 20)
      assert.equal(first.membersHasMore, true)
      assert.equal(second.members.length, 4)
      assert.equal(second.membersHasMore, false)
      assert.equal(new Set([...first.members, ...second.members].map(person => person.userId)).size, 24)
      assert.deepEqual((await community(outsider, id, '?membersPage=1')).members, [])
    })
    await t.test('approved membership grants and revokes optional campfire access', async () => {
      campfireTablePresent = (await community(lead, id)).campfireAvailable
      if (!campfireTablePresent) {
        sql('CREATE TABLE campfire_memberships (guild_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, PRIMARY KEY (guild_id, user_id));')
        campfireTableCreated = true
        campfireTablePresent = true
      }
      assert.equal((await action(outsider, id, { action: 'apply', profile: profile() })).status, 200)
      assert.equal((await action(officer, id, { action: 'approve', userId: outsider.id })).status, 200)
      assert.equal(sql(`SELECT COUNT(*) AS n FROM campfire_memberships WHERE guild_id = ${quote(id)} AND user_id = ${quote(outsider.id)};`)[0].results[0].n, 1)
      assert.equal((await action(officer, id, { action: 'remove-member', userId: outsider.id })).status, 200)
      assert.equal(sql(`SELECT COUNT(*) AS n FROM campfire_memberships WHERE guild_id = ${quote(id)} AND user_id = ${quote(outsider.id)};`)[0].results[0].n, 0)
    })
    await t.test('legacy leadership requires both a real session and the private owner key', async () => {
      const legacyId = randomUUID()
      guildIds.push(legacyId)
      const key = randomBytes(32).toString('hex')
      const hash = createHash('sha256').update(key).digest('hex')
      sql(`INSERT INTO guilds (id, name, faction, region, realm, description, join_url, management_key_hash) VALUES (${quote(legacyId)}, 'Synthetic Legacy Guild', 'Horde', 'Europe', '', 'Synthetic legacy ownership fixture.', ${quote(`/guilds/${legacyId}`)}, ${quote(hash)});`)
      assert.equal((await action(member, legacyId, { action: 'claim', managementKey: '0'.repeat(64) })).status, 403)
      assert.equal((await action(outsider, legacyId, { action: 'claim', managementKey: key })).status, 200)
      assert.equal((await community(outsider, legacyId)).viewer.role, 'leader')
      assert.equal((await outsider.request(`/api/guilds/${id}/battletags/${member.id}`)).status, 403)
      assert.equal((await outsider.request(`/api/guilds/${legacyId}/battletags/${member.id}`)).status, 403)
      assert.equal((await action(member, legacyId, { action: 'claim', managementKey: key })).status, 403)
      const anonymousKeyEdit = await fetch(`${base}/api/guilds/${legacyId}`, { method: 'PATCH', headers: { origin: base, 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ recruitmentNeeds: [] }) })
      assert.equal(anonymousKeyEdit.status, 401)
      assert.equal((await action(outsider, legacyId, { action: 'approve', userId: member.id })).status, 409)
      assert.equal((await action(lead, id, { action: 'create-initiative', title: 'Guild-specific initiative', description: '', status: 'planned' })).status, 200)
      const initiative = (await community(member, id)).initiatives[0]
      assert.equal((await action(outsider, legacyId, { action: 'update-initiative', initiativeId: initiative.id, title: 'Wrong guild', description: '', status: 'completed' })).status, 404)
      assert.equal((await community(member, id)).initiatives[0].title, 'Guild-specific initiative')
      assert.equal((await action(officer, legacyId, { action: 'create-initiative', title: 'Wrong guild', description: '', status: 'planned' })).status, 403)
      assert.equal((await action(member, id, { action: 'create-initiative', title: 'Spoofed', description: '', status: 'active' }, { origin: 'https://other.invalid' })).status, 403)
      assert.equal((await lead.request(`/api/guilds/${id}/community?membersPage=-1`)).status, 400)
    })
  } finally {
    if (guildIds.length || userIds.length) sql([
      campfireTablePresent && guildIds.length ? `DELETE FROM campfire_memberships WHERE guild_id IN (${guildIds.map(quote).join(',')});` : '',
      guildIds.length ? `DELETE FROM guilds WHERE id IN (${guildIds.map(quote).join(',')});` : '',
      userIds.length ? `DELETE FROM user WHERE id IN (${userIds.map(quote).join(',')});` : '',
    ].join(' '))
    if (campfireTableCreated && sql('SELECT COUNT(*) AS n FROM campfire_memberships;')[0].results[0].n === 0) sql('DROP TABLE campfire_memberships;')
  }
})
