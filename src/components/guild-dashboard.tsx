import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BattleTagDisplay, BattleTagEditor } from '@/components/battletag'
import { GuildApplicationForm } from '@/components/guild-application-form'
import { GuildNeeds } from '@/components/guild-needs'
import { GuildNeedsEditor } from '@/components/guild-needs-editor'
import { authClient } from '@/lib/auth-client'
import { readGuildManagementKey, saveGuildManagementKey } from '@/lib/guild-management'
import { initiativeSchema, initiativeStatuses, type GuildCharacterProfile, type GuildCommunity, type GuildInitiative, type GuildMember } from '@/lib/guild-community'
import { managementKeySchema, recruitmentNeedsSchema, type Guild, type RecruitmentNeed } from '@/lib/guilds'
import './guild-community.css'

export async function guildCommunityAction(guildId: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/guilds/${encodeURIComponent(guildId)}/community`, {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const result = await response.json() as { success?: boolean; error?: string }
  if (!response.ok || !result.success) throw new Error(result.error || 'Couldn’t save your changes. Please try again.')
}

export function useGuildCommunity(guildId: string, membersPage = 0, applicationsPage = 0) {
  const [data, setData] = useState<GuildCommunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    async function load() {
      try {
        const response = await fetch(`/api/guilds/${encodeURIComponent(guildId)}/community?membersPage=${membersPage}&applicationsPage=${applicationsPage}`, { credentials: 'same-origin', signal: controller.signal, cache: 'no-store' })
        const result = await response.json() as GuildCommunity & { community?: GuildCommunity; error?: string }
        const community = result.community || result
        if (!response.ok || !community.viewer) throw new Error(result.error || 'Couldn’t load the guild hall.')
        if (!controller.signal.aborted) setData(community)
      } catch (cause) {
        if (!controller.signal.aborted) { setData(null); setError(cause instanceof Error ? cause.message : 'Connection lost. Please try again.') }
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [guildId, membersPage, applicationsPage, attempt])
  return { data, loading, error, refresh: () => setAttempt(value => value + 1) }
}

function CharacterDetails({ profile }: { profile: GuildCharacterProfile }) {
  return <><p>{profile.race} · {profile.characterClass} · {profile.fulfilledRoles.map(role => role === 'Damage' ? 'Damage (DPS)' : role).join(', ')}</p><p>Professions: {profile.professions.join(', ') || 'Undecided / none'}</p></>
}

function Pagination({ page, hasMore, disabled, onChange, label }: { page: number; hasMore: boolean; disabled: boolean; onChange: (page: number) => void; label: string }) {
  return <nav className="directory-pagination" aria-label={`${label} pages`}><Button type="button" variant="outline" disabled={disabled || page === 0} onClick={() => onChange(page - 1)}>← Previous</Button><span>Page {page + 1}</span><Button type="button" variant="outline" disabled={disabled || !hasMore} onClick={() => onChange(page + 1)}>Next →</Button></nav>
}

function InitiativeEditor({ initiative, busy, onSave, onCancel }: { initiative?: GuildInitiative; busy: boolean; onSave: (value: { title: string; description: string; status: GuildInitiative['status'] }) => Promise<void>; onCancel?: () => void }) {
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const parsed = initiativeSchema.safeParse(Object.fromEntries(values))
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Check the initiative details.'); return }
    setError('')
    try { await onSave(parsed.data); if (!initiative) form.reset() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Couldn’t save the initiative.') }
  }
  return <form onSubmit={submit}><fieldset className="field-grid" disabled={busy}>
    <label>Title<Input name="title" required minLength={2} maxLength={80} defaultValue={initiative?.title || ''} /></label>
    <label>Description<textarea className="input" name="description" maxLength={600} defaultValue={initiative?.description || ''} /></label>
    <label>Status<select name="status" defaultValue={initiative?.status || 'planned'}>{initiativeStatuses.map(status => <option value={status} key={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label>
  </fieldset>{error && <p className="form-error" role="alert">{error}</p>}<div className="guild-community-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : initiative ? 'Save initiative' : 'Create initiative'}</Button>{onCancel && <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>}</div></form>
}

export function GuildDashboard({ guild }: { guild: Guild }) {
  const [membersPage, setMembersPage] = useState(0)
  const [applicationsPage, setApplicationsPage] = useState(0)
  const { data, loading, error, refresh } = useGuildCommunity(guild.id, membersPage, applicationsPage)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [key, setKey] = useState('')
  const [needs, setNeeds] = useState<RecruitmentNeed[]>(guild.recruitmentNeeds)
  const [publishedNeeds, setPublishedNeeds] = useState<RecruitmentNeed[]>(guild.recruitmentNeeds)
  const needsDirty = useRef(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const ownProfile = useRef<GuildMember | undefined>(undefined)

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.hash.slice(1)).get('key') || readGuildManagementKey(guild.id)
    const parsed = managementKeySchema.safeParse(candidate)
    setKey(parsed.success ? parsed.data : '')
    if (parsed.success) saveGuildManagementKey(guild.id, parsed.data)
    // The legacy secret is consumed locally and sent only in the explicit claim POST.
    if (new URLSearchParams(window.location.hash.slice(1)).has('key')) window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [guild.id])
  useEffect(() => { setNeeds(guild.recruitmentNeeds); setPublishedNeeds(guild.recruitmentNeeds); needsDirty.current = false }, [guild.recruitmentNeeds])
  useEffect(() => {
    if (!data) return
    if (!data.viewer.role) { ownProfile.current = undefined; setShowProfile(false); return }
    const own = data.members.find(member => member.userId === data.viewer.userId)
    if (own) ownProfile.current = own
  }, [data])

  async function action(body: Record<string, unknown>, message: string) {
    setBusy(true); setActionError(''); setNotice('')
    try {
      await guildCommunityAction(guild.id, body)
      setNotice(message)
      refresh()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Couldn’t save. Please try again.'
      setActionError(message)
      // Refresh permissions and lists even when another officer changed this record first.
      refresh()
      throw new Error(message)
    } finally { setBusy(false) }
  }
  function run(body: Record<string, unknown>, message: string) { void action(body, message).catch(() => {}) }

  async function toggleProfile() {
    if (showProfile) { setShowProfile(false); return }
    if (ownProfile.current) { setShowProfile(true); return }
    setBusy(true); setActionError(''); setNotice('Loading your character profile…')
    try {
      // The shared DTO paginates the roster, so the viewer may be on a later page.
      let page = 0
      while (true) {
        const response = await fetch(`/api/guilds/${encodeURIComponent(guild.id)}/community?membersPage=${page}&applicationsPage=0`, { credentials: 'same-origin', cache: 'no-store' })
        const result = await response.json() as GuildCommunity & { community?: GuildCommunity; error?: string }
        const community = result.community || result
        if (!response.ok || !community.viewer?.role) throw new Error(result.error || 'Your membership has changed. Refresh the guild hall.')
        const own = community.members.find(member => member.userId === community.viewer.userId)
        if (own) { ownProfile.current = own; setShowProfile(true); break }
        if (!community.membersHasMore) throw new Error('Your character profile could not be found. Refresh the guild hall and try again.')
        page += 1
      }
      setNotice('')
    } catch (cause) { setNotice(''); setActionError(cause instanceof Error ? cause.message : 'Couldn’t load your character. Try again.'); refresh() }
    finally { setBusy(false) }
  }

  async function saveNeeds(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = recruitmentNeedsSchema.safeParse(needs)
    if (!parsed.success) { setActionError(parsed.error.issues[0]?.message || 'Check your recruitment needs.'); return }
    setBusy(true); setActionError(''); setNotice('')
    try {
      const response = await fetch(`/api/guilds/${encodeURIComponent(guild.id)}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recruitmentNeeds: parsed.data }) })
      const result = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Couldn’t save recruitment needs.')
      needsDirty.current = false; setPublishedNeeds(parsed.data); setNotice('Recruitment needs saved.'); refresh()
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Couldn’t save. Try again.'); refresh() }
    finally { setBusy(false) }
  }

  async function refreshHall() {
    setBusy(true); setActionError(''); setNotice('')
    try {
      const response = await fetch(`/api/guilds/${encodeURIComponent(guild.id)}`, { credentials: 'same-origin', cache: 'no-store' })
      const result = await response.json() as { guild?: Guild; error?: string }
      if (!response.ok || !result.guild) throw new Error(result.error || 'Couldn’t refresh recruitment needs. Please try again.')
      const currentNeeds = recruitmentNeedsSchema.parse(result.guild.recruitmentNeeds)
      setPublishedNeeds(currentNeeds)
      if (!needsDirty.current) setNeeds(currentNeeds)
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Couldn’t refresh recruitment needs. Please try again.') }
    finally { refresh(); setBusy(false) }
  }

  return <div aria-busy={loading || busy}>
    {notice && <p className="recruitment-saved" role="status">{notice}</p>}
    {actionError && <p className="form-error" role="alert">{actionError}</p>}
    {loading && <p className="dialog-description" role="status">Loading the guild hall…</p>}
    {!data ? !loading && <div className="empty-state"><p role="alert">{error || 'Guild hall unavailable.'}</p><Button variant="outline" onClick={refresh}>Try again</Button></div> : <fieldset disabled={busy || loading}>
      <p className="guild-context">{data.viewer.role ? `Your guild rank: ${data.viewer.role}` : 'You’re not an approved member of this guild yet.'}</p>
      {data.canClaim && key && <section className="guild-community-notice"><h3>Bring your guild into the hall.</h3><p>Your private management link can connect this legacy guild to your signed-in account. Claiming makes you its leader.</p><div className="guild-community-actions"><Button disabled={busy} onClick={() => run({ action: 'claim', managementKey: key }, 'Guild leadership claimed.')}>Claim guild leadership</Button></div></section>}
      {!data.viewer.role ? <section className="guild-community-notice"><h3>{data.viewer.applicationStatus === 'pending' ? 'Awaiting approval.' : data.viewer.applicationStatus === 'declined' ? 'Application declined.' : 'Find your place in the crew.'}</h3><p>{data.viewer.applicationStatus === 'pending' ? 'Guild leadership will review your application. Check back here for an update.' : data.viewer.applicationStatus === 'declined' ? 'Leadership declined your previous application. You can submit a new application with updated details.' : 'Apply to join this guild. Approved members can see the roster and make plans together.'}</p>{data.viewer.applicationStatus !== 'pending' && <a className="button button-primary" href={`${guild.path}/apply`}>Apply to join</a>}</section> : <>
        <div className="guild-community-actions">{data.campfireAvailable && <a className="button button-primary" href="/campfire">Meet at the campfire</a>}<Button variant="outline" disabled={busy} onClick={() => void toggleProfile()}>{showProfile ? 'Close profile editor' : 'Update my character'}</Button></div>
        <BattleTagEditor initial={data.viewer.battleTag || ''} busy={busy} onSave={value => action({ action: 'update-battletag', battleTag: value }, value ? 'BattleTag shared with your guild members.' : 'BattleTag removed from your guilds.')} />
        {showProfile && <section className="guild-community-section guild-character-form" aria-label="Your character profile"><GuildApplicationForm guild={guild} initialProfile={ownProfile.current} introduction={false} submitLabel="Save my character" onSubmit={async profile => { await action({ action: 'update-profile', profile }, 'Your character profile is updated.'); if (ownProfile.current) ownProfile.current = { ...ownProfile.current, ...profile }; setShowProfile(false) }} /></section>}
        <section className="guild-community-section" aria-labelledby="guild-roster-title"><h3 id="guild-roster-title">Guild roster</h3><p className="field-hint">20 guildmates per page. Character details are shared only with approved members.</p>
          {data.members.length ? <ul className="guild-community-list">{data.members.map(member => <li className="guild-community-item" key={member.userId}><h4>{member.nickname}<span className="guild-community-role">{member.role}{member.userId === data.viewer.userId ? ' · you' : ''}</span></h4><CharacterDetails profile={member} /><BattleTagDisplay value={member.battleTag || ''} />
            {data.viewer.canManage && member.role !== 'leader' && member.userId !== data.viewer.userId && <div className="guild-community-actions">
              {data.viewer.role === 'leader' && <Button variant="outline" disabled={busy} onClick={() => run({ action: 'set-role', userId: member.userId, role: member.role === 'officer' ? 'member' : 'officer' }, `${member.nickname} is now ${member.role === 'officer' ? 'a member' : 'an officer'}.`)}>{member.role === 'officer' ? 'Make member' : 'Make officer'}</Button>}
              {(data.viewer.role === 'leader' || member.role === 'member') && <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm(`Remove ${member.nickname} from ${guild.name}?`)) run({ action: 'remove-member', userId: member.userId }, 'Guild member removed.') }}>Remove member</Button>}
            </div>}
          </li>)}</ul> : <p className="dialog-description">No members on this page.</p>}
          <Pagination label="Roster" page={membersPage} hasMore={data.membersHasMore} disabled={busy} onChange={setMembersPage} />
        </section>
        {data.viewer.canManage && <section className="guild-community-section" aria-labelledby="guild-applications-title"><h3 id="guild-applications-title">Applications</h3>
          {data.applications.length ? <ul className="guild-community-list">{data.applications.map(application => <li key={application.userId} className="guild-community-item"><h4>{application.nickname}<span className="guild-community-role">{application.status}</span></h4><CharacterDetails profile={application} />{application.introduction && <p>{application.introduction}</p>}{application.status === 'pending' && <div className="guild-community-actions"><Button disabled={busy} onClick={() => run({ action: 'approve', userId: application.userId }, 'Application approved.')}>Approve</Button><Button variant="outline" disabled={busy} onClick={() => run({ action: 'decline', userId: application.userId }, 'Application declined.')}>Decline</Button></div>}</li>)}</ul> : <p className="dialog-description">No applications on this page.</p>}
          <Pagination label="Applications" page={applicationsPage} hasMore={data.applicationsHasMore} disabled={busy} onChange={setApplicationsPage} />
        </section>}
        <section className="guild-community-section" aria-labelledby="guild-initiatives-title"><h3 id="guild-initiatives-title">Guild initiatives</h3>
          {data.initiatives.length ? <ul className="guild-community-list">{data.initiatives.map(initiative => <li key={initiative.id} className="guild-community-item">{editing === initiative.id && data.viewer.canManage ? <InitiativeEditor initiative={initiative} busy={busy} onCancel={() => setEditing(null)} onSave={async values => { await action({ action: 'update-initiative', initiativeId: initiative.id, ...values }, 'Initiative updated.'); setEditing(null) }} /> : <><h4>{initiative.title}<span className="guild-community-role">{initiative.status}</span></h4><p>{initiative.description || 'No description yet.'}</p>{data.viewer.canManage && <div className="guild-community-actions"><Button variant="outline" disabled={busy} onClick={() => setEditing(initiative.id)}>Edit initiative</Button><Button variant="outline" disabled={busy} onClick={() => { if (window.confirm(`Delete “${initiative.title}”?`)) run({ action: 'delete-initiative', initiativeId: initiative.id }, 'Initiative deleted.') }}>Delete initiative</Button></div>}</>}</li>)}</ul> : <p className="dialog-description">No initiatives yet. Your next adventure starts here.</p>}
          {data.viewer.canManage && <details className="guild-community-notice"><summary>Create an initiative</summary><InitiativeEditor busy={busy} onSave={values => action({ action: 'create-initiative', ...values }, 'Initiative created.')} /></details>}
        </section>
      </>}
      <section className="guild-community-section" aria-label="Recruitment needs"><GuildNeeds needs={publishedNeeds} />{!publishedNeeds.length && <p className="dialog-description">Open to all roles, classes and professions.</p>}{data.viewer.role && data.viewer.canManage && <details><summary>Edit recruitment needs</summary><form onSubmit={saveNeeds}><GuildNeedsEditor needs={needs} disabled={busy} onChange={next => { needsDirty.current = true; setNeeds(next) }} /><div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save recruitment needs'}</Button></div></form></details>}</section>
      <div className="guild-community-actions"><Button variant="ghost" disabled={busy} onClick={() => void refreshHall()}>Refresh guild hall</Button><Button variant="ghost" disabled={busy} onClick={async () => { setActionError(''); try { const result = await authClient.signOut(); if (result.error) setActionError(result.error.message || 'Couldn’t sign out. Try again.') } catch { setActionError('Couldn’t sign out. Check your connection and try again.') } }}>Sign out</Button></div>
    </fieldset>}
  </div>
}
