import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AccountShell } from '@/components/account-shell'
import { authClient } from '@/lib/auth-client'
import { safeReturnTo } from '@/lib/auth-navigation'

export function AccountForm({ register, available, returnTo }: { register?: boolean; available: boolean; returnTo: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const errorRef = useRef<HTMLParagraphElement>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  function fail(message: string) {
    setError(message)
    requestAnimationFrame(() => errorRef.current?.focus())
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const fields = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try {
      const credentials = { email: String(fields.get('email')).trim(), password: String(fields.get('password')) }
      const result = register
        ? await authClient.signUp.email({ ...credentials, name: String(fields.get('name')).trim() })
        : await authClient.signIn.email(credentials)
      if (result.error) {
        const { code, status } = result.error
        fail(status === 429 ? 'Too many attempts. Wait a little and try again.'
          : status >= 500 ? 'Accounts are temporarily unavailable. Please try again shortly.'
          : code === 'USER_ALREADY_EXISTS' || code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' ? 'An account already uses this email. Sign in instead.'
          : code === 'PASSWORD_TOO_SHORT' ? 'Choose a password with at least 12 characters.'
          : register ? 'Couldn’t create your account. Check your details or try signing in.'
          : 'Email or password is incorrect. Check both and try again.')
        return
      }
      // Full navigation drops stale route/session data and rechecks the server session.
      window.location.assign(safeReturnTo(returnTo))
    } catch { fail('Connection interrupted. Check your connection and try again.') }
    finally { setPending(false) }
  }

  return <AccountShell>
    <div className="dialog-kicker">AI-ZEROTH · YOUR ACCOUNT</div>
    <h1 id="account-title">{register ? 'Your next adventure.' : 'Welcome back.'}</h1>
    <p className="dialog-description">{register ? 'Create an account for your next steps in ai-zeroth. This is separate from the interest list; it won’t publish a player card or join a guild.' : 'Sign in to your ai-zeroth account. Joined the interest list? You’ll still need to create an account.'}</p>
    {!available ? <div role="status"><p>Accounts are temporarily unavailable. Please try again later.</p><p className="account-note">You can still <a href="/signup">join the interest list</a> or <a href="/guilds">browse guilds</a> without an account.</p><Button variant="outline" onClick={() => window.location.reload()}>Try again</Button></div> : <>
      <form method="post" onSubmit={submit} aria-busy={pending}>
        <noscript><p role="status">Please enable JavaScript to securely use your account.</p></noscript>
        <div className="field-grid">
          {register && <label htmlFor="account-name">Name or nickname<Input id="account-name" name="name" autoComplete="nickname" required maxLength={60} pattern=".*\S.*" /></label>}
          <label htmlFor="account-email">Email<Input id="account-email" name="email" type="email" autoComplete="email" required maxLength={254} /></label>
          <label htmlFor="account-password">Password<Input id="account-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 12 : undefined} maxLength={128} aria-describedby={register ? 'password-help' : undefined} /></label>
        </div>
        <div className="password-tools">{register && <span id="password-help">At least 12 characters.</span>}<button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide password' : 'Show password'}</button></div>
        {error && <p className="form-error" role="alert" ref={errorRef} tabIndex={-1}>{error}</p>}
        <div className="form-actions"><Button type="submit" disabled={!ready || pending}>{pending ? register ? 'Creating account…' : 'Signing in…' : register ? 'Create account' : 'Sign in'}</Button></div>
        <p className="account-note">Password recovery and email verification aren’t available yet. {register && 'Keep your password somewhere safe.'}</p>
      </form>
      <p className="account-switch">{register ? 'Already have an account? ' : 'New here? '}<Link to={register ? '/login' : '/register'} search={{ returnTo }}>{register ? 'Sign in' : 'Create an account'}</Link></p>
    </>}
    <p className="account-note">Just want updates? <a href="/signup">Join the account-free interest list</a>.</p>
  </AccountShell>
}
