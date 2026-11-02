import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { GuildAuthGate } from '@/components/guild-account-panel'
import { GuildApplicationForm } from '@/components/guild-application-form'
import { guildCommunityAction, useGuildCommunity } from '@/components/guild-dashboard'
import { GuildNeeds } from '@/components/guild-needs'
import { WorldScene } from '@/components/world-scene'
import { ScenePanel } from '@/components/scene-panel'
import { AppLink } from '@/components/app-link'
import { useGuild } from '@/lib/use-guild'
import type { Guild } from '@/lib/guilds'

export const Route = createFileRoute('/guilds/$guildId_/apply')({ component: ApplyPage })

function ApplyPage() {
  return <GuildAuthGate title="Join your next adventure."><ApplyGuild /></GuildAuthGate>
}

function ApplyGuild() {
  const { guildId } = Route.useParams()
  const { guild, loading, error, retry } = useGuild(guildId)
  return <main className="site signup-page guild-community-page"><WorldScene /><ScenePanel className="signup-card" aria-labelledby="guild-apply-title">
    <nav className="guild-nav"><AppLink href={`/guilds/${encodeURIComponent(guildId)}`}>← Guild page</AppLink><AppLink href={`/guilds/${encodeURIComponent(guildId)}/manage`}>Guild hall</AppLink></nav>
    <div className="dialog-kicker">GUILD APPLICATION</div><h2 id="guild-apply-title">{guild ? `Join ${guild.name}.` : 'Find your crew.'}</h2>
    {loading ? <p className="dialog-description" role="status">Finding your guild…</p> : error || !guild ? <div className="empty-state"><p role="alert">{error || 'Guild unavailable.'}</p><Button variant="outline" onClick={retry}>Try again</Button></div> : <Application guild={guild} />}
  </ScenePanel></main>
}

function Application({ guild }: { guild: Guild }) {
  const { data, loading, error, refresh } = useGuildCommunity(guild.id)
  const [submitted, setSubmitted] = useState(false)
  if (loading) return <p className="dialog-description" role="status">Checking your guild membership…</p>
  if (error || !data) return <div className="empty-state"><p role="alert">{error || 'Couldn’t check your application.'}</p><Button variant="outline" onClick={refresh}>Try again</Button></div>
  if (data.viewer.role) return <div className="success-state"><h3>You’re already part of the crew.</h3><AppLink className="button button-primary" href={`${guild.path}/manage`}>Open the guild hall</AppLink></div>
  if (submitted || data.viewer.applicationStatus === 'pending') return <div className="success-state" role="status"><h3>Awaiting approval.</h3><p>Your application is with {guild.name}’s leadership. Check the guild hall for an update.</p><AppLink className="button button-primary" href={`${guild.path}/manage`}>Check the guild hall</AppLink></div>
  return <>
    <p className="dialog-description">{guild.faction} · {guild.region}. Share your planned character with guild leadership. Approval opens the roster and guild initiatives.</p>
    {data.viewer.applicationStatus === 'declined' && <p className="guild-community-notice">Your previous application was declined. You can update your character details and apply again.</p>}
    <GuildNeeds needs={guild.recruitmentNeeds} />
    {!guild.recruitmentNeeds.length && <p className="field-hint">This guild is open to all roles, classes and professions.</p>}
    <GuildApplicationForm guild={guild} onSubmit={async (profile, introduction) => { await guildCommunityAction(guild.id, { action: 'apply', profile, introduction }); setSubmitted(true) }} />
  </>
}
