import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { GuildAuthGate } from '@/components/guild-account-panel'
import { GuildDashboard } from '@/components/guild-dashboard'
import { WorldScene } from '@/components/world-scene'
import { ScenePanel } from '@/components/scene-panel'
import { AppLink } from '@/components/app-link'
import { useGuild } from '@/lib/use-guild'

export const Route = createFileRoute('/guilds/$guildId_/manage')({ component: ManageGuild })

function ManageGuild() {
  return <GuildAuthGate title="Open your guild hall."><GuildHall /></GuildAuthGate>
}

function GuildHall() {
  const { guildId } = Route.useParams()
  const { guild, loading, error, retry } = useGuild(guildId)
  return <main className="site signup-page guild-community-page"><WorldScene /><ScenePanel className="signup-card guild-hall-card" aria-labelledby="guild-hall-title">
    <nav className="guild-nav"><AppLink href={`/guilds/${encodeURIComponent(guildId)}`}>← Guild page</AppLink><AppLink href="/guilds">Guild directory</AppLink></nav>
    <div className="dialog-kicker">GUILD HALL</div>
    <h2 id="guild-hall-title">{guild?.name || 'Your guild hall.'}</h2>
    {loading ? <p className="dialog-description" role="status">Finding your guild…</p> : error || !guild ? <div className="empty-state"><p role="alert">{error || 'Guild unavailable.'}</p><Button variant="outline" onClick={retry}>Try again</Button></div> : <><p className="dialog-description">{guild.faction} · {guild.region} · Your crew, your next adventure.</p><GuildDashboard key={guild.id} guild={guild} /></>}
  </ScenePanel></main>
}
