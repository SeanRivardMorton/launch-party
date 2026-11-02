import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { AccountShell } from '@/components/account-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'
import { requireAccount } from '@/lib/auth.functions'
import { CharacterOverview } from '@/components/account-overview'
import { AppLink } from '@/components/app-link'

export const Route = createFileRoute('/account')({
  beforeLoad: async () => ({ user: await requireAccount() }),
  staleTime: 0,
  head: () => ({ meta: [{ title: 'My account · ai-zeroth' }, { name: 'robots', content: 'noindex' }] }),
  component: AccountPage,
})

function AccountPage() {
  const { user } = Route.useRouteContext()
  const session = authClient.useSession()
  const currentUser = session.data?.user || user
  const [pending, setPending] = useState<'save' | 'signout' | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  useEffect(() => {
    if (pending !== 'signout' && !session.isPending && !session.error && !session.data) window.location.replace('/login?returnTo=%2Faccount')
  }, [session.isPending, session.error, session.data, pending])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const name = String(new FormData(event.currentTarget).get('name')).trim()
    if (!name) { setError('Enter a name or nickname.'); return }
    setPending('save'); setMessage(''); setError('')
    try {
      const result = await authClient.updateUser({ name })
      if (result.error) setError('Couldn’t save. Your session may have expired. Sign in again or retry.')
      else setMessage('Account name saved.')
    } catch { setError('Connection interrupted. Please try again.') }
    finally { setPending(null) }
  }

  async function signOut() {
    if (pending) return
    setPending('signout'); setError(''); setMessage('')
    try {
      const result = await authClient.signOut()
      if (result.error) { setError('Couldn’t sign out. Please try again.'); setPending(null); return }
      window.location.replace('/login')
    } catch { setError('Connection interrupted. Please try signing out again.'); setPending(null) }
  }

  if (!session.isPending && (session.error || !session.data)) return <AccountShell><h1 id="account-title">Account session unavailable</h1><p role="alert">{session.error ? 'Couldn’t verify your session. Your private details are hidden.' : 'Your session has expired.'}</p><Button onClick={() => void session.refetch()}>Retry session</Button><a href="/login?returnTo=%2Faccount">Sign in again</a></AccountShell>

  return <AccountShell>
    <div className="dialog-kicker">AI-ZEROTH · PRIVATE ACCOUNT</div>
    <h1 id="account-title">Your characters & guilds.</h1>
    <p className="dialog-description">Your saved characters and approved guilds.</p>
    <CharacterOverview active={!session.isPending && !session.error && session.data ? session.data.user.id : false} />
    <section id="account-settings" className="account-section" aria-labelledby="settings-title"><h2 id="settings-title">Account settings</h2>
    <p className="account-note">This account name is not your character name. Changing it does not change saved characters. Your email stays private and is not a verified Battle.net identity.</p>
    <p className="account-email"><span>Account email</span><strong>{currentUser.email}</strong></p>
    <form key={currentUser.email} method="post" onSubmit={save} aria-busy={pending === 'save'}>
      <label htmlFor="profile-name">Name or nickname<Input id="profile-name" name="name" autoComplete="nickname" defaultValue={currentUser.name} required maxLength={60} /></label>
      <div className="form-actions"><Button type="submit" disabled={!ready || Boolean(pending)}>{pending === 'save' ? 'Saving…' : 'Save account name'}</Button></div>
    </form>
    {message && <p className="account-note" role="status">{message}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    </section>
    <div className="account-footer"><AppLink href="/">Back to the campfire</AppLink><Button variant="outline" disabled={!ready || Boolean(pending)} onClick={signOut}>{pending === 'signout' ? 'Signing out…' : 'Sign out'}</Button></div>
  </AccountShell>
}
