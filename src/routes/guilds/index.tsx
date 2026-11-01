import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WorldScene } from '@/components/world-scene'
import { factions } from '@/lib/interest'
import { regions, type Guild } from '@/lib/guilds'

export const Route = createFileRoute('/guilds/')({ component: GuildDirectory })

function GuildDirectory() {
  const [faction, setFaction] = useState('')
  const [region, setRegion] = useState('')
  const [page, setPage] = useState(0)
  const [guild, setGuild] = useState<Guild | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    async function load() {
      try {
        const response = await fetch(`/api/guilds?${new URLSearchParams({ faction, region, page: String(page) })}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Directory unavailable')
        const result = await response.json() as { guilds: Guild[]; hasMore: boolean }
        if (controller.signal.aborted) return
        setGuild(result.guilds[0] || null)
        setHasMore(result.hasMore)
        setStatus('ready')
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      }
    }
    void load()
    return () => controller.abort()
  }, [faction, region, page, retry])

  return <main className="site signup-page" data-theme="moonwell">
    <WorldScene />
    <section className="signup-card guild-directory" aria-labelledby="guilds-title">
      <nav className="guild-nav" aria-label="Guild navigation"><a href="/" aria-label="Back to campfire"><ArrowLeft size={18} /></a><a href="/guilds/new"><Plus size={14} />List a guild</a></nav>
      <div className="dialog-kicker">AI-ZEROTH · GUILD DIRECTORY</div>
      <h2 id="guilds-title">Find your next guild.</h2>
      <p className="dialog-description">Meet a crew and visit their guild page to register interest in joining.</p>
      <div className="directory-filters">
        <label>Faction<select value={faction} onChange={event => { setFaction(event.target.value); setPage(0) }}><option value="">All factions</option>{factions.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Region<select value={region} onChange={event => { setRegion(event.target.value); setPage(0) }}><option value="">All regions</option>{regions.map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <div className="directory-result" aria-live="polite" aria-busy={status === 'loading'}>
        {status === 'loading' ? <p className="empty-state">Looking for guilds…</p> : status === 'error' ? <div className="empty-state"><p>The guild directory is unavailable.</p><Button variant="outline" onClick={() => setRetry(retry + 1)}>Try again</Button></div> : guild ? <article className="guild-card">
          <div className="guild-meta">{guild.faction} · {guild.region}</div>
          <h3>{guild.name}</h3>
          <p className="guild-description">{guild.description}</p>
          <a className="button button-primary" href={guild.path}>View guild<ArrowRight size={16} /></a>
        </article> : <div className="empty-state"><p>No guilds listed{faction || region ? ' with these filters' : ' yet'}. Start the party.</p><a className="button button-outline" href="/guilds/new">List your guild<Plus size={16} /></a></div>}
      </div>
      <div className="directory-pagination"><Button variant="ghost" disabled={page === 0 || status === 'loading'} onClick={() => setPage(page - 1)}><ArrowLeft size={16} />Previous</Button><span>{page + 1}</span><Button variant="ghost" disabled={!hasMore || status !== 'ready'} onClick={() => setPage(page + 1)}>Next<ArrowRight size={16} /></Button></div>
      <a className="directory-signup" href="/signup">Join the ai-zeroth interest list<ArrowRight size={14} /></a>
    </section>
  </main>
}
