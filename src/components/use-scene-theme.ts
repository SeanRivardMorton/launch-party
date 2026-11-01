import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { parseThemePreference, resolveTheme, THEME_STORAGE_KEY, themeStyle, type ThemePreference } from '@/lib/scene-themes'

// An explicitly supplied race uses the screen's existing authorized DTO instead
// of loading it twice. Never persist the profile or race in browser storage.
export function useSceneTheme(profileRace?: string | null) {
  const [preference, setPreference] = useState<ThemePreference>('automatic')
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<{ userId: string; race: string | null } | null>(null)
  const { data: session, isPending } = authClient.useSession()
  const userId = !isPending ? session?.user.id : undefined
  useEffect(() => {
    try { setPreference(parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))) } catch { /* Optional storage. */ }
    setReady(true)
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) setPreference(parseThemePreference(event.newValue))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  useEffect(() => {
    if (!userId || profileRace !== undefined || preference !== 'automatic') return
    let disposed = false
    let controller: AbortController | undefined
    const refresh = async () => {
      controller?.abort()
      controller = new AbortController()
      try {
        const response = await fetch('/api/campfire/me', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const data = response.ok ? await response.json() as { profile?: { race?: unknown } | null } : null
        if (!disposed) setProfile({ userId, race: typeof data?.profile?.race === 'string' ? data.profile.race : null })
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) setProfile({ userId, race: null })
      }
    }
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh() }
    void refresh()
    window.addEventListener('focus', visibleRefresh)
    document.addEventListener('visibilitychange', visibleRefresh)
    const timer = window.setInterval(visibleRefresh, 15_000)
    return () => { disposed = true; controller?.abort(); clearInterval(timer); window.removeEventListener('focus', visibleRefresh); document.removeEventListener('visibilitychange', visibleRefresh) }
  }, [userId, profileRace, preference])
  const race = !userId ? null : profileRace !== undefined ? profileRace : profile?.userId === userId ? profile.race : null
  const theme = resolveTheme(preference, race)
  const choose = (next: ThemePreference) => {
    setPreference(next)
    try { localStorage.setItem(THEME_STORAGE_KEY, next) } catch { /* Still works for this visit. */ }
  }
  return { preference, choose, theme, ready, style: themeStyle(theme) }
}
