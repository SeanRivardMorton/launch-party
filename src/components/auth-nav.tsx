import { authClient } from '@/lib/auth-client'
import { useEffect, useRef, useState } from 'react'
import { OverviewStatus, useAccountOverview } from './account-overview'
import { AppLink } from './app-link'

export function AuthNav() {
  const { data, isPending, error, refetch } = authClient.useSession()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [signoutError, setSignoutError] = useState('')
  const root = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const authenticated = Boolean(data?.user) && !isPending && !error
  const overview = useAccountOverview(authenticated && open && !busy ? data!.user.id : false)
  useEffect(() => {
    if (!authenticated) setOpen(false)
  }, [authenticated])
  useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLElement>('a, button')?.focus()
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  async function signOut() {
    setBusy(true); setSignoutError('')
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error('Signout failed')
      window.location.replace('/')
    } catch { setSignoutError('Couldn’t sign out. Please try again.'); setBusy(false) }
  }
  return <nav ref={root} className="account-nav" aria-label="Account" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); trigger.current?.focus() }
    if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const items = [...(panel.current?.querySelectorAll<HTMLElement>('a, button:not(:disabled)') || [])]
      if (!items.length) return
      event.preventDefault()
      const index = items.indexOf(document.activeElement as HTMLElement)
      items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    }
  }}>
    {isPending ? <span role="status">Account…</span> : error ? <button className="account-nav-link" onClick={() => void refetch()}>Account unavailable · retry</button>
      : !authenticated ? <AppLink className="account-nav-link" href="/login">Sign in</AppLink>
        : <><button ref={trigger} className="account-nav-link" aria-expanded={open} aria-controls="account-navigation" onClick={() => setOpen(value => !value)} onKeyDown={event => {
          if (!open && event.key === 'ArrowDown') { event.preventDefault(); setOpen(true) }
        }}>My account <span aria-hidden="true">▾</span></button>
          {open && <div ref={panel} id="account-navigation" className="account-menu">
            <AppLink href="/characters">Characters</AppLink><AppLink href="/guild">Guild</AppLink><AppLink href="/calendar">Calendar</AppLink>
            {overview.data ? <>{overview.data.memberships.length ? overview.data.memberships.map(guild => <div key={guild.guildId}><AppLink href={`/guilds/${encodeURIComponent(guild.guildId)}/manage`}>{guild.guildName} · guild hall</AppLink>{guild.campfireAvailable && <AppLink href={`/campfire?guild=${encodeURIComponent(guild.guildId)}`}>{guild.guildName} · campfire</AppLink>}</div>) : <p>No approved guild memberships.</p>}
              {overview.data.applications.some(application => application.status === 'pending') && <AppLink href="/account#applications-title">Pending applications (not memberships)</AppLink>}</> : !busy && <OverviewStatus state={overview} />}
            <AppLink href="/account#account-settings">Account settings</AppLink>
            <button disabled={busy} onClick={signOut}>{busy ? 'Signing out…' : 'Sign out'}</button>
            {signoutError && <p role="alert">{signoutError}</p>}
          </div>}
        </>}
  </nav>
}
