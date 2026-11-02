import { useEffect, useState } from 'react'
import type { AccountOverview } from '@/lib/account-overview'

export function useAccountOverview(active: string | false) {
  const [state, setState] = useState<{ key?: string; data?: AccountOverview; error?: string; expired?: boolean }>({})
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setState({})
    if (!active) return
    const controller = new AbortController()
    void fetch('/api/account/overview', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (controller.signal.aborted) return
      if (response.status === 401) { setState({ key: active, expired: true }); return }
      if (!response.ok) throw new Error('Unavailable')
      const data: AccountOverview = await response.json()
      if (!controller.signal.aborted) setState({ key: active, data })
    }).catch(() => {
      if (!controller.signal.aborted) setState({ key: active, error: 'Couldn’t load your saved characters and guilds. Please try again.' })
    })
    return () => controller.abort()
  }, [active, attempt])
  return { ...(state.key === active ? state : {}), retry: () => setAttempt(value => value + 1) }
}

export function OverviewStatus({ state }: { state: ReturnType<typeof useAccountOverview> }) {
  if (state.expired) return <p role="alert">Your session has expired. <a href="/login?returnTo=%2Faccount">Sign in again</a>.</p>
  if (state.error) return <div role="alert"><p>{state.error}</p><button type="button" onClick={state.retry}>Retry</button></div>
  return <p role="status">Loading your characters and guilds…</p>
}

function CharacterDetails({ profile }: { profile: { nickname: string; faction: string; race: string; characterClass: string; professions: string[]; fulfilledRoles?: string[] } }) {
  return <dl className="character-details">
    <div><dt>Character name / nickname</dt><dd>{profile.nickname}</dd></div>
    <div><dt>Faction</dt><dd>{profile.faction}</dd></div>
    <div><dt>Race</dt><dd>{profile.race}</dd></div>
    <div><dt>Class</dt><dd>{profile.characterClass}</dd></div>
    <div><dt>Professions</dt><dd>{profile.professions.join(', ') || 'None saved'}</dd></div>
    <div><dt>Fulfillable roles</dt><dd>{profile.fulfilledRoles?.join(', ') || 'Not collected for campfire characters'}</dd></div>
  </dl>
}

function SavedAvatar({ url, format }: { url: string; format: string }) {
  const [failed, setFailed] = useState(false)
  return failed ? <p>Saved avatar could not be loaded. <button type="button" onClick={() => setFailed(false)}>Retry avatar</button></p>
    : <div className={format === 'codex-pet-v1' ? 'account-avatar account-avatar-sheet' : 'account-avatar'}><img src={url} alt="Your saved campfire avatar" onError={() => setFailed(true)} /></div>
}

export function CharacterOverview({ active, section = 'all' }: { active: string | false; section?: 'all' | 'characters' | 'guilds' }) {
  const state = useAccountOverview(active)
  useEffect(() => {
    if (!state.data) return
    const target = window.location.hash.slice(1)
    if (['characters', 'guilds', 'applications-title', 'account-settings'].includes(target)) document.getElementById(target)?.scrollIntoView()
  }, [state.data])
  if (!active) return <p role="status">Checking your session…</p>
  if (!state.data) return <OverviewStatus state={state} />
  const { campfire, memberships, applications } = state.data
  return <>
    {section !== 'guilds' && <section id="characters" className="account-section" aria-labelledby="characters-title">
      <h2 id="characters-title">My characters</h2>
      <p className="account-note">Account and character names are separate. Each profile is saved independently.</p>
      {!campfire && !memberships.length && <p>No saved character yet. Application profiles, if any, are listed separately below.</p>}
      {campfire ? <article className="character-card"><h3>Saved campfire character</h3>
        <CharacterDetails profile={campfire} />
        <p>{campfire.published ? 'Published to campfire guildmates' : 'Unpublished · visible here only to you'}</p>
        {campfire.bio && <p>{campfire.bio}</p>}
        {campfire.avatarUrl ? <SavedAvatar url={campfire.avatarUrl} format={campfire.avatarFormat} /> : <p>No saved avatar artwork. The campfire uses a fallback sprite.</p>}
        <a href="/campfire?edit=1">Edit campfire character</a>
      </article> : <p>No saved campfire character. <a href="/campfire?edit=1">Create a campfire character</a>.</p>}
      {memberships.map(membership => <article className="character-card" key={membership.guildId}>
        <h3>{membership.guildName} · guild character</h3><CharacterDetails profile={membership.profile} />
        <a href={`/guilds/${encodeURIComponent(membership.guildId)}/manage#my-character`}>Edit this guild character</a>
      </article>)}
    </section>}
    {section !== 'characters' && <><section id="guilds" className="account-section" aria-labelledby="my-guilds-title"><h2 id="my-guilds-title">My guilds</h2>
      {memberships.length ? <ul className="account-guild-list">{memberships.map(membership => <li key={membership.guildId}>
        <strong>{membership.guildName}</strong><span>Approved membership · {membership.role}</span>
        <a href={`/guilds/${encodeURIComponent(membership.guildId)}/manage`}>Guild hall</a>
        {membership.campfireAvailable ? <a href={`/campfire?guild=${encodeURIComponent(membership.guildId)}`}>Guild campfire</a> : <span>Open the guild hall to sync campfire access.</span>}
      </li>)}</ul> : <p>No approved guild memberships yet. <a href="/guilds">Explore guilds</a> to apply. An interest signup or private management link is not membership.</p>}
    </section>
    <section className="account-section" aria-labelledby="applications-title"><h2 id="applications-title">My applications</h2>
      {applications.length ? applications.map(application => <article className="character-card" key={application.guildId}><h3>{application.guildName} · {application.status}</h3>
        <p>{application.status === 'pending' ? 'Awaiting approval. This is not a guild membership.' : 'Not approved. You can review the guild and apply again.'}</p>
        <CharacterDetails profile={application.profile} /><a href={`/guilds/${encodeURIComponent(application.guildId)}/apply`}>View application / guild</a>
      </article>) : <p>No pending or declined applications.</p>}
    </section></>}
  </>
}
