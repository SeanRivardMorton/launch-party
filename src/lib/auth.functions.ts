import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders, setResponseHeader } from '@tanstack/react-start/server'
import { redirect } from '@tanstack/react-router'
import { getAuth } from './auth.server'

// Explicit DTO: session tokens, IPs and provider account records never enter route data.
export const getAccountState = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'no-store')
  const auth = getAuth()
  if (!auth) return { available: false, user: null }
  try {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    return { available: true, user: session ? { name: session.user.name, email: session.user.email } : null }
  } catch {
    return { available: false, user: null }
  }
})

// Enforce the session inside the endpoint, independently of the route guard.
export const requireAccount = createServerFn({ method: 'GET' }).handler(async () => {
  const state = await getAccountState()
  if (!state.user) throw redirect({ to: '/login', search: { returnTo: '/account' } })
  return state.user
})
