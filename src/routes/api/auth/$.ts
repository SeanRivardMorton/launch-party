import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@/lib/auth.server'

async function handler({ request }: { request: Request }) {
  const auth = getAuth()
  if (!auth) return Response.json({ error: 'Authentication is not configured yet.' }, { status: 503 })
  return auth.handler(request)
}
export const Route = createFileRoute('/api/auth/$')({ server: { handlers: { GET: handler, POST: handler } } })
