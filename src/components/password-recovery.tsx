import { useEffect, useState, type FormEvent } from 'react'
import { AccountShell } from './account-shell'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useAuthFeatures } from './google-sign-in'
import { authClient } from '@/lib/auth-client'
import { AppLink } from './app-link'

export function PasswordRecovery({ reset, token, invalid }: { reset?: boolean; token?: string; invalid?: boolean }) {
  const { features, error: configError, retry } = useAuthFeatures()
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    if (reset && form.get('password') !== form.get('confirm')) { setError('Your passwords don’t match.'); return }
    setPending(true); setError('')
    try {
      const result = reset
        ? await authClient.resetPassword({ newPassword: String(form.get('password')), token: token! })
        : await authClient.requestPasswordReset({ email: String(form.get('email')).trim(), redirectTo: new URL('/reset-password', window.location.origin).href })
      if (result.error) { setError(reset ? 'This link may have expired or already been used. Request a new reset link and try again.' : 'Couldn’t request a reset link. Please try again shortly.'); return }
      setSuccess(true)
      if (reset) window.history.replaceState(null, '', '/reset-password')
    } catch { setError('Connection interrupted. Please try again.') }
    finally { setPending(false) }
  }
  return <AccountShell><div className="dialog-kicker">AI-ZEROTH · ACCOUNT RECOVERY</div><h1 id="account-title">{reset ? 'Choose a new password.' : 'Find your way back.'}</h1>{success ? <div role="status"><p>{reset ? 'Your password has been updated. Sign in with your new password.' : 'If an account can be recovered with that email, we’ll send a password reset link. Check your inbox and spam folder.'}</p><p className="account-note"><AppLink href="/">Back to sign in</AppLink></p></div> : reset && (!token || invalid) ? <div role="alert"><p>This password reset link is missing, invalid or expired.</p><AppLink href="/forgot-password">Request a new link</AppLink></div> : <>
    <p className="dialog-description">{reset ? 'Use at least 12 characters. Your other sessions will be signed out.' : 'Enter the email you use for your account. We’ll send a link to reset your password.'}</p>
    {configError ? <p role="alert">Couldn’t check account recovery. <button type="button" onClick={retry}>Retry</button></p> : features && !features.passwordReset ? <p role="status">Password recovery is temporarily unavailable. Please try again later.</p> : <form method="post" onSubmit={submit} aria-busy={pending}><fieldset className="field-grid" disabled={!ready || pending || !features?.passwordReset}>{reset ? <><label>New password<Input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><label>Confirm new password<Input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label></> : <label>Email<Input name="email" type="email" autoComplete="email" required maxLength={254} /></label>}<Button type="submit">{pending ? 'Please wait…' : reset ? 'Save new password' : 'Send reset link'}</Button></fieldset></form>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </>}<div className="account-footer"><AppLink href="/">Back to sign in</AppLink>{reset && !success && <AppLink href="/forgot-password">Request a new link</AppLink>}</div></AccountShell>
}
