import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GuildInvite } from '@/components/guild-invite'
import { GuildNeedsEditor } from '@/components/guild-needs-editor'
import { WorldScene } from '@/components/world-scene'
import { guildManagementPath, readGuildManagementKey, saveGuildManagementKey } from '@/lib/guild-management'
import { managementKeySchema, type RecruitmentNeed } from '@/lib/guilds'
import { useGuild } from '@/lib/use-guild'

export const Route = createFileRoute('/guilds/$guildId_/manage')({ component: ManageGuild })

function ManageGuild() {
  const { guildId } = Route.useParams()
  const { guild, loading, error, retry } = useGuild(guildId)
  const [key, setKey] = useState<string | null>(null)
  const [needs, setNeeds] = useState<RecruitmentNeed[]>([])
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.hash.slice(1)).get('key') || readGuildManagementKey(guildId)
    const valid = managementKeySchema.safeParse(candidate)
    setKey(valid.success ? valid.data : '')
  }, [guildId])

  useEffect(() => { if (guild) setNeeds(guild.recruitmentNeeds) }, [guild])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('saving')
    setSaveError('')
    try {
      const response = await fetch(`/api/guilds/${encodeURIComponent(guildId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ recruitmentNeeds: needs }),
      })
      const result = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Couldn’t save recruitment needs.')
      saveGuildManagementKey(guildId, key!)
      setStatus('saved')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Connection lost. Please try again.')
      setStatus('error')
    }
  }

  return <main className="site signup-page" data-theme="moonwell">
    <WorldScene />
    <section className="signup-card" aria-labelledby="manage-title">
      <nav className="guild-nav"><a href={`/guilds/${encodeURIComponent(guildId)}`}><ArrowLeft size={16} />Guild page</a></nav>
      {loading || key === null ? <p role="status">Loading your guild…</p> : error || !guild ? <div className="empty-state"><h2 id="manage-title">Guild unavailable.</h2><p role="alert">{error}</p><Button variant="outline" onClick={retry}>Try again</Button></div> : !key ? <>
        <h2 id="manage-title">Open your management link.</h2>
        <p className="dialog-description">Use the private management link provided when you published this guild to update its recruitment needs.</p>
      </> : <>
        <div className="dialog-kicker">GUILD RECRUITMENT</div>
        <h2 id="manage-title">{guild.name}</h2>
        <p className="dialog-description">Keep your list current as people join. Changes appear on your public guild page.</p>
        <form onSubmit={save}>
          <GuildNeedsEditor needs={needs} disabled={status === 'saving'} onChange={next => { setNeeds(next); setStatus('idle'); setSaveError('') }} />
          {status === 'error' && <p className="form-error" role="alert">{saveError}</p>}
          {status === 'saved' && <p className="recruitment-saved" role="status">Recruitment needs saved.</p>}
          <div className="form-actions"><Button type="submit" disabled={status === 'saving'}><Save size={16} />{status === 'saving' ? 'Saving…' : 'Save recruitment needs'}</Button></div>
        </form>
        <GuildInvite path={guildManagementPath(guildId, key)} label="Private management link" buttonText="Copy management link" description="Keep this private link for editing from another device." />
      </>}
    </section>
  </main>
}
