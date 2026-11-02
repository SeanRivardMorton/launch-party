import { useEffect, type ReactNode } from 'react'
import { authClient } from '@/lib/auth-client'
import { AccountShell } from './account-shell'
import { Button } from './ui/button'

export function PrivatePage({ title, path, children }: { title: string; path: string; children: (userId: string) => ReactNode }) {
  const session = authClient.useSession()
  useEffect(() => {
    if (!session.isPending && !session.error && !session.data) window.location.replace(`/login?returnTo=${encodeURIComponent(path)}`)
  }, [session.isPending, session.error, session.data, path])
  return <AccountShell><div className="dialog-kicker">AI-ZEROTH · YOUR ADVENTURE</div><h1 id="account-title">{title}</h1><nav className="page-navigation" aria-label="Adventures"><a href="/">Home</a><a href="/characters" aria-current={path === '/characters' ? 'page' : undefined}>Characters</a><a href="/guild" aria-current={path === '/guild' ? 'page' : undefined}>Guild</a><a href="/calendar" aria-current={path === '/calendar' ? 'page' : undefined}>Calendar</a></nav>{session.isPending ? <p role="status">Checking your session…</p> : session.error ? <><p role="alert">Couldn’t verify your session. Your private details are hidden.</p><Button onClick={() => void session.refetch()}>Retry session</Button></> : session.data ? children(session.data.user.id) : <p role="status">Redirecting to sign in…</p>}</AccountShell>
}
