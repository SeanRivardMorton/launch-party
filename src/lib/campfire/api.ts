import { getAuth } from '../auth.server'
import { authorized, card, getProfile, profileSchema, readJson, sameOrigin } from './data'
import { STALE_MS, RESERVE_AVATAR } from './avatar-state'

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
export async function campfireApi(request: Request, env: Cloudflare.Env) {
  const url = new URL(request.url)
  const path = url.pathname.slice('/api/campfire'.length)
  if ((request.method !== 'GET' || path.endsWith('/socket')) && !sameOrigin(request)) return json({ error: 'Use this website to enter the campfire.' }, 403)
  const auth = getAuth()
  if (!auth) return json({ error: 'Authentication is not configured.' }, 503)
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return json({ error: 'Sign in to join your guild campfire.' }, 401)
  const userId = session.user.id
  if (path === '/me' && request.method === 'GET') {
    const profile = await getProfile(env.DB, userId)
    const memberships = await env.DB.prepare('SELECT guild_id FROM campfire_memberships WHERE user_id=? ORDER BY guild_id').bind(userId).all<{ guild_id: string }>()
    await env.DB.prepare(`UPDATE campfire_avatars SET state='failed', updated_at=? WHERE user_id=? AND state='pending' AND updated_at<?`).bind(Date.now(), userId, Date.now() - STALE_MS).run()
    const avatar = await env.DB.prepare('SELECT state, attempts, progress, total_steps, error_code FROM campfire_avatars WHERE user_id=?').bind(userId).first()
    return json({ profile: profile ? { ...card(profile), published: !!profile.published } : null, guilds: memberships.results.map(m => m.guild_id), avatar: avatar || { state: 'not_requested', attempts: 0 }, generationEnabled: !!env.OPENAI_API_KEY && env.AVATAR_GENERATION_ENABLED === 'true' })
  }
  if (path === '/profile' && request.method === 'PUT') {
    let input: unknown
    try { input = await readJson(request) } catch { return json({ error: 'Expected a small JSON profile.' }, 400) }
    const parsed = profileSchema.safeParse(input)
    if (!parsed.success) return json({ error: 'Check your nickname and character choices (two professions maximum).' }, 400)
    const p = parsed.data
    await env.DB.prepare(`INSERT INTO campfire_profiles(user_id,nickname,faction,race,character_class,professions,bio,published,updated_at) VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname,faction=excluded.faction,race=excluded.race,character_class=excluded.character_class,professions=excluded.professions,bio=excluded.bio,published=excluded.published,updated_at=excluded.updated_at`)
      .bind(userId, p.nickname, p.faction, p.race, p.characterClass, JSON.stringify(p.professions), p.bio, Number(p.published), Date.now()).run()
    return json({ saved: true })
  }
  if (path === '/generate' && request.method === 'POST') {
    if (!env.OPENAI_API_KEY || env.AVATAR_GENERATION_ENABLED !== 'true') return json({ error: 'AI generation is unavailable. Your fallback sprite is ready to use.' }, 503)
    const profile = await getProfile(env.DB, userId)
    if (!profile) return json({ error: 'Save your character first.' }, 409)
    const token = crypto.randomUUID()
    // A single conditional UPSERT reserves both the attempt and the pending slot.
    const inputs = JSON.stringify({ faction: profile.faction, race: profile.race, class: profile.character_class, professions: JSON.parse(profile.professions) })
    const reserved = await env.DB.prepare(RESERVE_AVATAR).bind(userId, token, inputs, Date.now(), Date.now() - STALE_MS).run()
    if (!reserved.meta.changes) return json({ error: 'A generation is running, or both attempts have been used.' }, 409)
    try {
      await env.AVATAR_JOBS.getByName(userId).fetch(new Request('https://avatar.internal', { headers: { 'x-campfire-user': userId } }))
    } catch {
      await env.DB.prepare(`UPDATE campfire_avatars SET state='failed' WHERE user_id=? AND token=?`).bind(userId, token).run()
      return json({ error: 'Could not start generation. Your fallback remains usable.' }, 503)
    }
    return json({ state: 'pending' }, 202)
  }
  const avatarMatch = /^\/avatar\/([^/]+)$/.exec(path)
  if (avatarMatch && request.method === 'GET') {
    const targetId = decodeURIComponent(avatarMatch[1])
    const profile = await getProfile(env.DB, targetId)
    if (!profile?.asset_key) return new Response('Not found', { status: 404 })
    if (targetId !== userId) {
      const shared = await env.DB.prepare(`SELECT 1 FROM campfire_memberships a JOIN campfire_memberships b ON a.guild_id=b.guild_id WHERE a.user_id=? AND b.user_id=?`).bind(userId, targetId).first()
      if (!shared || !profile.published) return new Response('Not found', { status: 404 })
    }
    const object = await env.AVATAR_BUCKET.get(profile.asset_key)
    if (!object) return new Response('Not found', { status: 404 })
    return new Response(object.body, { headers: { 'content-type': 'image/png', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } })
  }
  const roomMatch = /^\/rooms\/([a-zA-Z0-9_-]{1,80})\/socket$/.exec(path)
  if (roomMatch && request.method === 'GET') {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'WebSocket upgrade required.' }, 426)
    const guildId = roomMatch[1]
    if (!await authorized(env.DB, userId, session.session.id, guildId)) return json({ error: 'Published character and guild membership required.' }, 403)
    // Construct fresh headers; never forward spoofable identity headers.
    return env.GUILD_CAMPFIRES.getByName(guildId).fetch(new Request('https://room.internal', { headers: {
      upgrade: 'websocket', 'x-campfire-user': userId, 'x-campfire-session': session.session.id, 'x-campfire-guild': guildId,
    } }))
  }
  return json({ error: 'Not found.' }, 404)
}
