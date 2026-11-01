import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GuildInvite } from '@/components/guild-invite'
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
        <a className="button button-primary" href={`/signup?guild=${encodeURIComponent(guild.id)}`}>Join this guild<ArrowRight size={16} /></a>
        <p className="guild-note">Register your interest in joining this crew. Your signup details stay private.</p>
        <GuildInvite path={guild.path} />
      </>}
    </section>
  </main>
}
