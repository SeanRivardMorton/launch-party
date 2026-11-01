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
    if (!parsed.success) return Response.json({ error: 'Please check your name, email, role and consent.' }, { status: 400 })
    if (parsed.data.website) return Response.json({ success: true })
    const { email, name, role, need, feedback } = parsed.data
    try {
      // A repeated signup does not overwrite someone's original feedback or reveal membership.
      await env.DB.prepare('INSERT INTO interest (id, email, name, role, need, feedback, consent_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING')
        .bind(crypto.randomUUID(), email, name, role, need, feedback, new Date().toISOString()).run()
      return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
    } catch {
      return Response.json({ error: 'The quest board is temporarily unavailable. Please try again in a moment.' }, { status: 503 })
    }
  } } },
})
