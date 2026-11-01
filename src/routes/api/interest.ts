import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { interestSchema } from '@/lib/interest'

export const Route = createFileRoute('/api/interest')({
  server: { handlers: { POST: async ({ request }) => {
    if (request.headers.get('origin') !== new URL(request.url).origin) {
      return Response.json({ error: 'Please submit the form from this website.' }, { status: 403 })
    }
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return Response.json({ error: 'Expected a JSON submission.' }, { status: 415 })
    }
    // Limit the actual body, not only the optional Content-Length header.
    let text = ''
    const reader = request.body?.getReader()
    if (!reader) return Response.json({ error: 'Empty submission.' }, { status: 400 })
    const decoder = new TextDecoder()
    let bytes = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 4096) {
        await reader.cancel()
        return Response.json({ error: 'Your message is too long.' }, { status: 413 })
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    let body: unknown
    try { body = JSON.parse(text) } catch {
      return Response.json({ error: 'Please check your submission.' }, { status: 400 })
    }
    const parsed = interestSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: 'Please check your contact details, character, roles, professions and consent.' }, { status: 400 })
    if (parsed.data.website) return Response.json({ success: true })
    const { email, name, need, feedback, faction, race, characterClass, fulfilledRoles, professions, guildIntent, guildId } = parsed.data
    try {
      if (guildId) {
        const guild = await env.DB.prepare('SELECT faction FROM guilds WHERE id = ?').bind(guildId).first<{ faction: string }>()
        if (!guild) return Response.json({ error: 'This guild is no longer available. Please choose another guild.' }, { status: 404 })
        if (guild.faction !== faction) return Response.json({ error: 'Choose a character in this guild’s faction.' }, { status: 400 })
      }
      // A repeated signup does not overwrite someone's original feedback or reveal membership.
      const statements = [env.DB.prepare('INSERT INTO interest (id, email, name, role, need, feedback, consent_at, faction, race, character_class, fulfilled_roles, professions, guild_intent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING')
        .bind(crypto.randomUUID(), email, name, fulfilledRoles[0], need, feedback, new Date().toISOString(), faction, race, characterClass, JSON.stringify(fulfilledRoles), JSON.stringify(professions), guildIntent)]
      if (guildId) statements.push(env.DB.prepare('INSERT INTO guild_interest (guild_id, interest_id) SELECT ?, id FROM interest WHERE email = ? ON CONFLICT(guild_id, interest_id) DO NOTHING').bind(guildId, email))
      await env.DB.batch(statements)
      return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
    } catch {
      return Response.json({ error: 'The quest board is temporarily unavailable. Please try again in a moment.' }, { status: 503 })
    }
  } } },
})
