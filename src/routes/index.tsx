import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { CalendarDays, Shield, UserRound } from 'lucide-react'
import { ThemePicker } from '@/components/theme-picker'
import { useSceneTheme } from '@/components/use-scene-theme'
import { WorldScene } from '@/components/world-scene'
import { AuthNav } from '@/components/auth-nav'
import { AccountForm } from '@/components/account-form'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { AppLink } from '@/components/app-link'
import { ScenePanel } from '@/components/scene-panel'
import '@/components/home.css'

export const Route = createFileRoute('/')({ component: LandingPage })

function LandingPage() {
  const { theme, preference, choose, style, ready } = useSceneTheme()
  const session = authClient.useSession()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')

  return <div className="site home-page" data-theme={theme} style={style}>
    <WorldScene theme={theme} />
    <div className="screen-grain" aria-hidden="true" />
    <header className="site-header">
      <AppLink className="brand" href="/" aria-label="ai-zeroth home"><span className="brand-rune" aria-hidden="true">✧</span></AppLink>
      <div className="header-right">{session.data && !session.error && <AuthNav />}<ThemePicker value={preference} onChange={choose} ready={ready} /></div>
    </header>

    <main className="home-main" id="main">
      <ScenePanel className="signup-card home-panel" aria-labelledby="account-title" aria-busy={session.isPending || signingOut}>
        {session.isPending ? <><h1 id="account-title">Your place by the fire.</h1><p role="status">Checking your session…</p></> : session.error ? <><h1 id="account-title">Let’s reconnect.</h1><p role="alert">We couldn’t check your session. Please try again.</p><Button onClick={() => void session.refetch()}>Retry session</Button></> : session.data ? <>
          <div className="dialog-kicker">AI-ZEROTH · YOUR CAMPFIRE</div>
          <h1 id="account-title">Welcome back, {session.data.user.name}.</h1>
          <p className="dialog-description">Your characters. Your guild. Your next adventure.</p>
          <nav className="home-menu" aria-label="Adventures">
            <AppLink href="/characters"><UserRound aria-hidden="true" /><span><strong>Characters</strong><small>View your saved adventurers</small></span><span aria-hidden="true">→</span></AppLink>
            <AppLink href="/guild"><Shield aria-hidden="true" /><span><strong>Guild</strong><small>Your guilds and their halls</small></span><span aria-hidden="true">→</span></AppLink>
            <AppLink href="/calendar"><CalendarDays aria-hidden="true" /><span><strong>Calendar</strong><small>Find a date for your next adventure</small></span><span aria-hidden="true">→</span></AppLink>
          </nav>
          {error && <p role="alert" className="form-error">{error}</p>}
          <div className="home-footer"><AppLink href="/account#account-settings">Account settings</AppLink><Button variant="ghost" disabled={signingOut} onClick={async () => {
            setSigningOut(true); setError('')
            try { const result = await authClient.signOut(); if (result.error) throw new Error(); await session.refetch(); setSigningOut(false) }
            catch { setError('Couldn’t sign out. Please try again.'); setSigningOut(false) }
          }}>{signingOut ? 'Signing out…' : 'Sign out'}</Button></div>
        </> : <AccountForm available returnTo="/" embedded />}
      </ScenePanel>
    </main>
  </div>
}
