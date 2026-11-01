import { useEffect, useState } from 'react'
import type { Guild } from './guilds'

export function useGuild(id: string | undefined) {
  const [guild, setGuild] = useState<Guild | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(id))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!id) { setGuild(null); setError(''); setLoading(false); return }
    const controller = new AbortController()
    setGuild(null)
    setError('')
    setLoading(true)
    async function load() {
      try {
        const response = await fetch(`/api/guilds/${encodeURIComponent(id!)}`, { signal: controller.signal })
        const result = await response.json() as { guild?: Guild; error?: string }
        if (!response.ok || !result.guild) throw new Error(result.error || 'This guild is unavailable.')
        if (!controller.signal.aborted) setGuild(result.guild)
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Connection lost. Please try again.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [id, attempt])

  return { guild, error, loading, retry: () => setAttempt(value => value + 1) }
}
