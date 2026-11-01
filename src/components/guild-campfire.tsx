import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PixelCharacter } from './pixel-character'
import { emotes, position, WORLD, type Card, type ClientMessage, type Peer, type ServerMessage } from '@/lib/campfire/protocol'
import { authClient } from '@/lib/auth-client'
import { SpriteSheet } from './sprite-sheet'
import './guild-campfire.css'

type Me = { profile: (Card & { published: boolean }) | null; guilds: string[]; avatar: { state: string; attempts: number; progress?: number; total_steps?: number; error_code?: string; previewAvailable?: boolean }; generationEnabled: boolean }
const symbols = { wave: '👋', cheer: '✨', heart: '♥' }
const generationErrors: Record<string, string> = {
  clipped_frames: 'a pose was cut off at the image edge', wrong_frame_count: 'the pose row did not contain every required frame',
  static_frames: 'the provider returned repeated still frames', provider_key: 'the API key was rejected',
  provider_access: 'the image model is unavailable to this project', provider_limit: 'the provider reported a billing or rate limit',
  provider_timeout: 'the image request timed out', interrupted_step: 'generation was interrupted; the request was not billed again',
}
async function api<T = { error?: string }>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api/campfire/${path}`, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error || 'Campfire unavailable')
  return data
}

function Sprite({ peer, offset, onSelect }: { peer: Peer; offset: number; onSelect: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [emote, setEmote] = useState('')
  const [failedUrl, setFailedUrl] = useState('')
  const artwork = peer.card.avatarUrl && failedUrl !== peer.card.avatarUrl
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const now = Date.now() + offset
    const point = position(peer.motion, now)
    node.style.transition = 'none'
    node.style.left = `${point.x / WORLD.width * 100}%`
    node.style.top = `${point.y / WORLD.height * 100}%`
    // Flush start coordinates so interrupted movement interpolates continuously.
    void node.offsetWidth
    const duration = Math.max(0, peer.motion.at + peer.motion.duration - now)
    node.style.transition = `left ${duration}ms linear, top ${duration}ms linear`
    node.style.left = `${peer.motion.to.x / WORLD.width * 100}%`
    node.style.top = `${peer.motion.to.y / WORLD.height * 100}%`
  }, [peer.motion, offset])
  useEffect(() => {
    const remaining = peer.emote ? peer.emote.at + 3000 - Date.now() - offset : 0
    setEmote(remaining > 0 && peer.emote ? symbols[peer.emote.kind] : '')
    const timer = setTimeout(() => setEmote(''), Math.max(0, remaining))
    return () => clearTimeout(timer)
  }, [peer.emote, offset])
  return <button ref={ref} className="guild-sprite" data-player={peer.card.nickname} style={{ '--faction': peer.card.faction === 'Horde' ? '#e8a391' : '#a6cde7' } as CSSProperties}
    onClick={event => { event.stopPropagation(); onSelect() }} aria-label={`View ${peer.card.nickname}'s published character card`}>
    {emote && <span className="guild-emote" aria-label={peer.emote?.kind}>{emote}</span>}
    {artwork ? peer.card.avatarFormat === 'codex-pet-v1'
      ? <SpriteSheet peer={peer} offset={offset} onError={() => setFailedUrl(peer.card.avatarUrl!)} />
      : <img src={peer.card.avatarUrl!} alt="" onError={() => setFailedUrl(peer.card.avatarUrl!)} />
      : <span><PixelCharacter kind={peer.card.characterClass.toLowerCase().includes('priest') ? 'priest' : peer.card.characterClass.toLowerCase().includes('mage') ? 'mage' : 'warrior'} /></span>}
    <span className="guild-name">{peer.card.nickname}</span>
  </button>
}

function Scene({ guildId, avatarRevision }: { guildId: string; avatarRevision: string | null }) {
  const [peers, setPeers] = useState<Record<string, Peer>>({})
  const [self, setSelf] = useState('')
  const [status, setStatus] = useState('Connecting…')
  const [connected, setConnected] = useState(false)
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Card | null>(null)
  const socket = useRef<WebSocket | null>(null)
  const lastMove = useRef(0)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    let disposed = false; let timer: ReturnType<typeof setTimeout>; let retry = 0
    let lastMessage = Date.now()
    const connect = () => {
      if (disposed) return
      const url = new URL(`/api/campfire/rooms/${encodeURIComponent(guildId)}/socket`, location.href)
      url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(url)
      socket.current = ws
      ws.onopen = () => { retry = 0; lastMessage = Date.now(); setConnected(true); setStatus('LIVE · Your guild campfire') }
      ws.onmessage = event => {
        lastMessage = Date.now()
        let message: ServerMessage
        try { message = JSON.parse(event.data) } catch { return }
        if (message.type === 'snapshot') {
          setSelf(message.self); setOffset(message.now - Date.now())
          setPeers(Object.fromEntries(message.peers.map(peer => [peer.id, peer])))
        } else if (message.type === 'peer') {
          setOffset(message.now - Date.now()); setPeers(previous => ({ ...previous, [message.peer.id]: message.peer }))
        } else if (message.type === 'leave') {
          setPeers(previous => { const next = { ...previous }; delete next[message.id]; return next })
        } else setStatus(message.error)
      }
      ws.onclose = event => {
        if (disposed) return
        setConnected(false)
        if ([4001, 4002, 4008, 1008].includes(event.code)) {
          setStatus(event.code === 4002 ? 'This campfire was opened in another tab.' : 'Session, membership or room access changed. Refresh to re-enter.'); return
        }
        setStatus('Disconnected · reconnecting…')
        timer = setTimeout(connect, Math.min(15_000, 1000 * 2 ** retry++) + Math.random() * 300)
      }
    }
    connect()
    // Sync detects idle network loss and checks revocation without server timers.
    const heartbeat = setInterval(() => {
      if (socket.current?.readyState === WebSocket.OPEN) {
        if (Date.now() - lastMessage > 60_000) socket.current.close(4000, 'Snapshot timeout')
        else socket.current.send(JSON.stringify({ type: 'sync' }))
      }
    }, 25_000)
    return () => { disposed = true; clearTimeout(timer); clearInterval(heartbeat); socket.current?.close() }
  }, [guildId])
  useEffect(() => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: 'sync' }))
  }, [avatarRevision])
  const send = (message: ClientMessage) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return
    if (message.type === 'move') {
      if (Date.now() - lastMove.current < 200) return
      lastMove.current = Date.now()
    }
    socket.current.send(JSON.stringify(message))
  }
  const select = (card: Card) => { setSelected(card); dialog.current?.showModal() }
  const mine = peers[self]
  return <>
    <div className="guild-livebar"><span role="status">{status}</span><span>{connected ? Object.keys(peers).length : 0} by the fire</span></div>
    <div className="guild-scene" role="group" aria-label="Guild clearing. Tap to move, or focus the clearing and use arrow keys." tabIndex={0}
      onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect()
        send({ type: 'move', x: (event.clientX - rect.left) / rect.width * WORLD.width, y: (event.clientY - rect.top) / rect.height * WORLD.height })
      }} onKeyDown={event => {
        if (event.target !== event.currentTarget || !mine) return
        const delta = { ArrowLeft: [-70, 0], ArrowRight: [70, 0], ArrowUp: [0, -70], ArrowDown: [0, 70] }[event.key]
        if (!delta) return
        event.preventDefault()
        const point = position(mine.motion, Date.now() + offset)
        send({ type: 'move', x: point.x + delta[0], y: point.y + delta[1] })
      }}>
      <div className="guild-moon" aria-hidden="true" />
      <div className="guild-trees" aria-hidden="true">♠ ♠ ♠ ♠ ♠ ♠ ♠ ♠ ♠ ♠ ♠</div>
      <div className="guild-fire" aria-hidden="true"><svg viewBox="0 0 64 72" shapeRendering="crispEdges"><path d="M8 60h48v8H8zM16 52h32v8H16z" fill="#6c4e38"/><path d="M12 44h8V28h8V12h8v12h8v12h8v20H12z" fill="#db703c"/><path d="M24 52V36h8V24h8v20h8v12H24z" fill="#f1b75f"/><path d="M28 52h12v8H28z" fill="#ffe4a0"/></svg></div>
      {Object.values(peers).map(peer => <Sprite key={peer.id} peer={peer} offset={offset} onSelect={() => select(peer.card)} />)}
      {!connected && <div className="guild-offline">{status}</div>}
    </div>
    <div className="guild-controls"><span>Tap the clearing to move · arrows work too</span><div>{emotes.map(emote => <button key={emote} disabled={!connected} onClick={() => send({ type: 'emote', emote })}>{symbols[emote]} {emote}</button>)}</div></div>
    <dialog ref={dialog} className="guild-card" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      {selected && <article><h2>{selected.nickname}</h2><p>{selected.faction} · {selected.race} {selected.characterClass}</p><p>{selected.professions.join(' · ') || 'Professions undecided'}</p><p>{selected.bio}</p><small>Published character plan · self-declared</small><button autoFocus onClick={() => dialog.current?.close()}>Close card</button></article>}
    </dialog>
  </>
}

function ProfileEditor({ initial, onSave }: { initial: Me['profile']; onSave: () => void }) {
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState({ nickname: initial?.nickname || '', faction: initial?.faction || 'Alliance', race: initial?.race || '', characterClass: initial?.characterClass || '', professions: initial?.professions.join(', ') || '', bio: initial?.bio || '', published: initial?.published || false })
  return <form className="guild-editor" onSubmit={async event => {
    event.preventDefault()
    if (step < 2) { setStep(step + 1); return }
    setBusy(true); setError('')
    try { await api('profile', 'PUT', { ...draft, professions: draft.professions.split(',').map(p => p.trim()).filter(Boolean) }); onSave() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }}>
    <h2>Your campfire character · {step + 1}/3</h2>
    {step === 0 && <><label>Public nickname<input required minLength={2} maxLength={32} value={draft.nickname} onChange={e => setDraft({ ...draft, nickname: e.target.value })} /></label><label>Faction<select value={draft.faction} onChange={e => setDraft({ ...draft, faction: e.target.value })}><option>Alliance</option><option>Horde</option></select></label></>}
    {step === 1 && <><label>Planned race<input required maxLength={40} placeholder="e.g. Dwarf or Undecided" value={draft.race} onChange={e => setDraft({ ...draft, race: e.target.value })} /></label><label>Planned class<input required maxLength={40} placeholder="e.g. Priest or Undecided" value={draft.characterClass} onChange={e => setDraft({ ...draft, characterClass: e.target.value })} /></label></>}
    {step === 2 && <><label>Up to two professions, comma separated<input maxLength={82} value={draft.professions} onChange={e => setDraft({ ...draft, professions: e.target.value })} /></label><label>Short public bio<input maxLength={280} value={draft.bio} onChange={e => setDraft({ ...draft, bio: e.target.value })} /></label><label className="guild-checkbox"><input type="checkbox" checked={draft.published} onChange={e => setDraft({ ...draft, published: e.target.checked })} /> Publish this character to guild members. Email and contact details are never shared.</label></>}
    {error && <p role="alert">{error}</p>}
    <div>{step > 0 && <button type="button" onClick={() => setStep(step - 1)}>Back</button>}<button disabled={busy}>{step === 2 ? 'Save character' : 'Next'}</button></div>
  </form>
}

export function GuildCampfireScreen() {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edit') === '1')
  const [guild, setGuild] = useState('')
  const [theme, setTheme] = useState('moonwell')
  const [generationBusy, setGenerationBusy] = useState(false)
  const refresh = async () => { try { const data = await api<Me>('me'); setMe(data); setGuild(previous => {
    const requested = new URLSearchParams(window.location.search).get('guild') || ''
    return data.guilds.includes(previous) ? previous : requested ? data.guilds.includes(requested) ? requested : '' : data.guilds[0] || ''
  }); setError('') } catch (e) { setError((e as Error).message) } }
  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    if (me?.avatar.state !== 'pending') return
    const timer = setInterval(() => { void refresh() }, 4000)
    return () => clearInterval(timer)
  }, [me?.avatar.state])
  return <main className="guild-app" data-theme={theme}>
    <header><a href="/">ai-zeroth<span> / guild campfire</span></a><button onClick={() => setTheme(theme === 'moonwell' ? 'tavern' : 'moonwell')}>{theme === 'moonwell' ? 'Tavern' : 'Moonwell'} theme</button></header>
    {!me ? <section className="guild-welcome"><h1>Your people, live by the fire.</h1><p role="status">{error || 'Opening the clearing…'}</p>{error && <form onSubmit={async event => {
      event.preventDefault(); const fields = new FormData(event.currentTarget)
      const result = await authClient.signIn.email({ email: String(fields.get('email')), password: String(fields.get('password')) })
      if (result.error) setError(result.error.message || 'Unable to sign in'); else await refresh()
    }}><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><button>Sign in</button></form>}</section>
      : editing || !me.profile ? <ProfileEditor initial={me.profile} onSave={() => { setEditing(false); void refresh() }} />
      : <>
        <nav className="guild-toolbar"><button onClick={() => setEditing(true)}>Edit character</button><label>Guild<select aria-label="Guild campfire" value={guild} onChange={e => setGuild(e.target.value)}>{me.guilds.map(id => <option key={id}>{id}</option>)}</select></label><button disabled={!me.generationEnabled || generationBusy || me.avatar.state === 'pending' || me.avatar.attempts >= 2} onClick={async () => {
          setGenerationBusy(true)
          try { await api('generate', 'POST'); await refresh() } catch (e) { setError((e as Error).message) } finally { setGenerationBusy(false) }
        }}>{me.avatar.state === 'pending' ? `Creating frames ${me.avatar.progress || 0}/${me.avatar.total_steps || 11}…` : 'Create animated sprite'}</button></nav>
        <p className="guild-art-status" role="status">{error || (me.avatar.state === 'ready' ? me.profile.avatarFormat === 'codex-pet-v1' ? 'Saved animated sprite sheet · 9 animation rows' : 'Saved single-frame artwork · generate a new sheet for animation' : me.avatar.state === 'pending' ? 'Building animation rows · existing sprite stays usable' : `${me.profile.avatarUrl ? 'Saved artwork' : 'Hand-drawn fallback sprite'} · ${me.avatar.state === 'failed' ? `Generation stopped: ${generationErrors[me.avatar.error_code || ''] || 'the generated row could not be used'}` : 'AI generation optional'}`)} · {me.avatar.attempts}/2 attempts {me.avatar.previewAvailable && <a href="/api/campfire/generation-preview" target="_blank" rel="noreferrer">· Inspect rejected pose row ↗</a>}</p>
        {me.generationEnabled && me.avatar.state !== 'pending' && me.avatar.attempts < 2 && <p className="guild-generation-note">One sheet uses up to 10 billable image requests and may take several minutes. Existing sprites are kept if generation fails.</p>}
        {guild && me.profile.published ? <Scene key={guild} guildId={guild} avatarRevision={me.profile.avatarUrl} /> : <section className="guild-welcome"><h2>{!me.profile.published ? 'Publish your character to enter.' : 'Your character is ready.'}</h2><p>{!me.profile.published ? 'Choose Edit character to share your character plan with guild members.' : 'Guild membership has not been linked to your account yet. Your saved character and fallback sprite are ready for the guild onboarding handoff.'}</p></section>}
      </>}
  </main>
}
