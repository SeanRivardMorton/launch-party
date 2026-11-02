import { createFileRoute, redirect } from '@tanstack/react-router'
import { AccountForm } from '@/components/account-form'
import { getAccountState } from '@/lib/auth.functions'
import { safeReturnTo } from '@/lib/auth-navigation'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { returnTo: string; oauthError?: boolean } => ({ returnTo: safeReturnTo(search.returnTo), oauthError: search.oauthError === '1' || search.oauthError === 1 || search.oauthError === true ? true : undefined }),
  beforeLoad: async ({ search }) => {
    const state = await getAccountState()
    if (state.user) throw redirect({ href: safeReturnTo(search.returnTo) })
    return state
  },
  head: () => ({ meta: [{ title: 'Sign in · ai-zeroth' }, { name: 'robots', content: 'noindex' }] }),
  component: LoginPage,
})

function LoginPage() {
  const { available } = Route.useRouteContext()
  return <AccountForm available={available} returnTo={Route.useSearch().returnTo} socialError={Route.useSearch().oauthError} />
}
