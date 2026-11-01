import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WorldScene } from '@/components/world-scene'
import './guild-community.css'

export function GuildAuthGate({ children, title = 'Your place in the guild.' }: { children: ReactNode; title?: string }) {
  const session = authClient.useSession()
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const id = useId()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const credentials = { email: String(form.get('email')).trim(), password: String(form.get('password')) }
      const result = register
        ? await authClient.signUp.email({ ...credentials, name: String(form.get('nickname')).trim() })
        : await authClient.signIn.email(credentials)
      if (result.error) throw new Error(result.error.message || 'Authentication failed. Check your details and try again.')
      await session.refetch()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t connect. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  if (session.data?.user) return children
  return <main className="site signup-page guild-community-page" data-theme="moonwell"><WorldScene />
    <section className="signup-card" aria-labelledby={id}>
      <nav className="guild-nav"><a href="/guilds">← Guild directory</a></nav>
      <div className="dialog-kicker">GUILD ACCOUNT</div>
      <h2 id={id}>{title}</h2>
      {session.isPending ? <p role="status" className="dialog-description">Checking your account…</p> : <>
        <p className="dialog-description">{register ? 'Create an account to apply, meet your guildmates and plan together. Your nickname is how your guild will know you.' : 'Sign in to apply or open your guild hall.'}</p>
        {session.error && <p className="form-error" role="alert">Couldn’t check your session. <button type="button" className="guild-text-button" onClick={() => void session.refetch()}>Try again</button></p>}
        <form onSubmit={submit}>
          <fieldset className="field-grid" disabled={busy}>
            {register && <label>Nickname<Input name="nickname" autoComplete="nickname" required maxLength={60} /></label>}
            <label>Email<Input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
            <label>Password<Input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 12 : undefined} /></label>
            {register && <p className="field-hint">Use at least 12 characters. Your email stays private.</p>}
          </fieldset>
          {error && <p className="form-error" role="alert">{error} {register ? 'If you already have an account, switch to sign in below.' : 'Check your email and password, then try again.'}</p>}
          <div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Connecting…' : register ? 'Create account' : 'Sign in'}</Button></div>
        </form>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => { setRegister(!register); setError('') }}>{register ? 'Already have an account? Sign in' : 'New here? Create an account'}</Button>
      </>}
    </section>
  </main>
}
