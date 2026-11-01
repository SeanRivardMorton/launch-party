import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { authClient } from '@/lib/auth-client'
import { parseThemePreference, resolveTheme, THEME_STORAGE_KEY, themeStyle, type ThemePreference } from '@/lib/scene-themes'

function useSceneThemeState() {
  const [preference, setPreference] = useState<ThemePreference>('automatic')
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<{ userId: string; race: string | null } | null>(null)
  const profileRevision = useRef(0)
  const { data: session, isPending, error: sessionError } = authClient.useSession()
  const userId = !isPending && !sessionError ? session?.user.id : undefined
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
    if (!userId || preference !== 'automatic') return
    let disposed = false
    let controller: AbortController | undefined
    const refresh = async () => {
      controller?.abort()
      controller = new AbortController()
      const revision = profileRevision.current
      try {
        const response = await fetch('/api/campfire/me', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const data = response.ok ? await response.json() as { profile?: { race?: unknown } | null } : null
        if (!disposed && revision === profileRevision.current) setProfile({ userId, race: typeof data?.profile?.race === 'string' ? data.profile.race : null })
      } catch (error) {
        if (!disposed && revision === profileRevision.current && !(error instanceof DOMException && error.name === 'AbortError')) setProfile({ userId, race: null })
      }
    }
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh() }
    void refresh()
    window.addEventListener('focus', visibleRefresh)
    document.addEventListener('visibilitychange', visibleRefresh)
    const timer = window.setInterval(visibleRefresh, 15_000)
    return () => { disposed = true; controller?.abort(); clearInterval(timer); window.removeEventListener('focus', visibleRefresh); document.removeEventListener('visibilitychange', visibleRefresh) }
  }, [userId, preference])
  const updateProfileRace = useCallback((race: string | null) => {
    if (userId) { profileRevision.current++; setProfile({ userId, race }) }
  }, [userId])
  const race = userId && profile?.userId === userId ? profile.race : null
  const theme = resolveTheme(preference, race)
  const choose = (next: ThemePreference) => {
    setPreference(next)
    try { localStorage.setItem(THEME_STORAGE_KEY, next) } catch { /* Still works for this visit. */ }
  }
  return { preference, choose, theme, ready, style: themeStyle(theme), updateProfileRace }
}

const SceneThemeContext = createContext<ReturnType<typeof useSceneThemeState> | null>(null)

export function SceneThemeProvider({ children }: { children: ReactNode }) {
  const state = useSceneThemeState()
  return createElement(SceneThemeContext.Provider, { value: state },
    createElement('div', { className: 'app-theme', 'data-theme': state.theme, style: state.style }, children))
}

// One app-level preference/profile subscription survives client-side navigation.
// A screen with a freshly saved authorized DTO can update Auto immediately.
export function useSceneTheme(profileRace?: string | null) {
  const context = useContext(SceneThemeContext)
  if (!context) throw new Error('SceneThemeProvider is required')
  const { updateProfileRace } = context
  useEffect(() => {
    if (profileRace !== undefined) updateProfileRace(profileRace)
  }, [profileRace, updateProfileRace])
  return context
}
