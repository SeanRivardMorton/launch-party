import { redirect } from '@tanstack/react-router'
import { getAccountState } from './auth.functions'

export async function requirePageAccount(returnTo: string) {
  const state = await getAccountState()
  if (!state.user) throw redirect({ to: '/login', search: { returnTo } })
  return state
}
