import { authClient } from '@/lib/auth-client'

export function AuthNav() {
  const { data, isPending } = authClient.useSession()
  return <nav aria-label="Account"><a className="account-nav-link" href={data?.user ? '/account' : '/login'} aria-busy={isPending}>{isPending ? 'Account…' : data?.user ? 'My account' : 'Sign in'}</a></nav>
}
