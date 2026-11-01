import { useEffect, useState, type FormEvent } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { battleTagSchema } from '@/lib/guild-community'

export function BattleTagDisplay({ value }: { value: string }) {
  const [status, setStatus] = useState('')
  useEffect(() => setStatus(''), [value])
  if (!value) return null
  return <div className="guild-community-notice"><p>BattleTag: <strong>{value}</strong></p><small>Self-provided · guild members only</small><div className="guild-community-actions"><Button type="button" variant="outline" onClick={async () => {
    try { await navigator.clipboard.writeText(value); setStatus('BattleTag copied.') }
    catch { setStatus('Copy the BattleTag shown above manually.') }
  }}>Copy BattleTag</Button></div><p role="status">{status}</p></div>
}

export function BattleTagEditor({ initial, busy, onSave }: { initial: string; busy: boolean; onSave: (value: string) => Promise<void> }) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState('')
  useEffect(() => setValue(initial), [initial])
  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = battleTagSchema.safeParse(value)
    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    setError('')
    try { await onSave(parsed.data) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Couldn’t save your BattleTag.') }
  }
  return <form className="guild-community-section" onSubmit={submit}><label>Your BattleTag (optional)<Input value={value} onChange={event => setValue(event.target.value)} placeholder="PlayerName#1234" maxLength={64} autoComplete="off" disabled={busy} /></label><p className="field-hint">Share your self-provided BattleTag with approved members of guilds you belong to so they can add you in Battle.net. It stays off public pages and applications. Leave blank and save to remove it from all guilds.</p>{error && <p role="alert" className="form-error">{error}</p>}<div className="guild-community-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save BattleTag'}</Button></div></form>
}

export function GuildCardBattleTag({ guildId, userId }: { guildId: string; userId: string }) {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState('Loading BattleTag…')
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setValue(''); setFailed(false); setStatus('Loading BattleTag…')
    void (async () => {
      try {
        const response = await fetch(`/api/guilds/${encodeURIComponent(guildId)}/battletags/${encodeURIComponent(userId)}`, { signal: controller.signal, cache: 'no-store' })
        const result = await response.json() as { battleTag?: string; error?: string }
        if (!response.ok) throw new Error(result.error || 'BattleTag unavailable.')
        if (!controller.signal.aborted) { setValue(result.battleTag || ''); setStatus(result.battleTag ? '' : 'No BattleTag shared.') }
      } catch (cause) { if (!controller.signal.aborted) { setFailed(true); setStatus(cause instanceof Error ? cause.message : 'BattleTag unavailable.') } }
    })()
    return () => controller.abort()
  }, [guildId, userId, attempt])
  return <><BattleTagDisplay value={value} /><p role="status">{status}</p>{failed && <Button type="button" variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry BattleTag</Button>}</>
}
