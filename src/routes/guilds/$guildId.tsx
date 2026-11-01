import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GuildInvite } from '@/components/guild-invite'
import { GuildNeeds } from '@/components/guild-needs'
import { GuildManagementLink } from '@/components/guild-management-link'
import { WorldScene } from '@/components/world-scene'
import { useGuild } from '@/lib/use-guild'

export const Route = createFileRoute('/guilds/$guildId')({ component: GuildPage })

function GuildPage() {
  const { guildId } = Route.useParams()
  const { guild, loading, error, retry } = useGuild(guildId)

  return <main className="site signup-page" data-theme="moonwell">
    <WorldScene />
    <section className="signup-card" aria-labelledby="guild-title">
      <nav className="guild-nav"><a href="/guilds"><ArrowLeft size={16} />Guild directory</a></nav>
      {loading ? <p role="status">Finding your guild…</p> : error || !guild ? <div className="empty-state"><h2 id="guild-title">Guild unavailable.</h2><p role="alert">{error}</p><Button variant="outline" onClick={retry}>Try again</Button></div> : <>
        <div className="dialog-kicker">{guild.faction} · {guild.region}</div>
        <h2 id="guild-title">{guild.name}</h2>
        <p className="guild-description guild-page-description">{guild.description}</p>
        <GuildNeeds needs={guild.recruitmentNeeds} />
        <a className="button button-primary" href={`${guild.path}/apply`}>Apply to join<ArrowRight size={16} /></a>
        <p className="guild-note">Create or sign in to your account and send an application for the guild lead or officers to review.</p>
        <a className="directory-signup" href={`${guild.path}/manage`}>Guild hall · Members and initiatives<ArrowRight size={14} /></a>
        <GuildInvite path={guild.path} />
        <GuildManagementLink guildId={guild.id} />
      </>}
    </section>
  </main>
}
