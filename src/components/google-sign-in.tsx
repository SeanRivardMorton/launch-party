import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { authClient } from '@/lib/auth-client'
import { safeReturnTo } from '@/lib/auth-navigation'
import { getAuthFeatures } from '@/lib/auth-features.functions'

export function useAuthFeatures() {
  const [features, setFeatures] = useState<{ google: boolean; passwordReset: boolean } | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setError(false)
    void getAuthFeatures().then(value => { if (active) setFeatures(value) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [attempt])
  return { features, error, retry: () => setAttempt(value => value + 1) }
}

export function GoogleSignIn({ returnTo, disabled }: { returnTo: string; disabled?: boolean }) {
  const { features, error: unavailable, retry } = useAuthFeatures()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  return <div className="social-signin"><div className="auth-divider"><span>or</span></div><Button type="button" variant="outline" disabled={disabled || pending || !features?.google} onClick={async () => {
    setPending(true); setError('')
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: safeReturnTo(returnTo), errorCallbackURL: '/login?oauthError=1' })
      if (result.error) { setError('Google sign-in could not start. Please try again.'); setPending(false) }
    } catch { setError('Couldn’t connect to Google. Please try again.'); setPending(false) }
  }}><span className="google-mark" aria-hidden="true">G</span>{pending ? 'Opening Google…' : 'Continue with Google'}</Button>{unavailable ? <p role="alert">Couldn’t check Google sign-in. <button type="button" onClick={retry}>Retry</button></p> : features && !features.google && <p className="field-hint">Google sign-in is not configured yet. You can sign in with email.</p>}{error && <p role="alert" className="form-error">{error}</p>}</div>
}
