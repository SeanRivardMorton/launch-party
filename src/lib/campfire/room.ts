import { DurableObject } from 'cloudflare:workers'
import { authorized, card, getProfile } from './data'
import { consume, move, parseMessage, type Peer, type Rate, type ServerMessage } from './protocol'

type Attachment = { guildId: string; sessionId: string; peer: Peer; rate: Rate; emoteAt: number }

export class GuildCampfire extends DurableObject<Cloudflare.Env> {
  private attachment(ws: WebSocket) { return ws.deserializeAttachment() as Attachment }
  private send(ws: WebSocket, message: ServerMessage) { try { ws.send(JSON.stringify(message)) } catch { ws.close(1011, 'Reconnect') } }
  private async valid(ws: WebSocket) {
    const a = this.attachment(ws)
    const ok = a && await authorized(this.env.DB, a.peer.id, a.sessionId, a.guildId)
    if (!ok) ws.close(4001, 'Session or membership expired')
    return !!ok
  }
  private async broadcast(message: ServerMessage) {
    await Promise.all(this.ctx.getWebSockets().map(async ws => { if (await this.valid(ws)) this.send(ws, message) }))
  }
  private async snapshot(ws: WebSocket) {
    const sockets = this.ctx.getWebSockets()
    const peers = await Promise.all(sockets.map(async socket => await this.valid(socket) ? this.attachment(socket).peer : null))
    this.send(ws, { type: 'snapshot', self: this.attachment(ws).peer.id, peers: peers.filter((p): p is Peer => !!p), now: Date.now() })
  }
  async fetch(request: Request) {
    // This class has no public route: the gateway constructs these headers only
    // after Better Auth verification; D1 is checked again here.
    const userId = request.headers.get('x-campfire-user') || ''
    const sessionId = request.headers.get('x-campfire-session') || ''
    const guildId = request.headers.get('x-campfire-guild') || ''
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('Upgrade required', { status: 426 })
    if (!await authorized(this.env.DB, userId, sessionId, guildId)) return new Response('Forbidden', { status: 403 })
    const existing = this.ctx.getWebSockets()
    const previous = existing.find(ws => this.attachment(ws).peer.id === userId)
    if (existing.length >= 50 && !previous) return new Response('Campfire full', { status: 503 })
    const row = await getProfile(this.env.DB, userId)
    if (!row) return new Response('Profile required', { status: 403 })
    const now = Date.now()
    const savedRate = previous ? this.attachment(previous).rate : await this.ctx.storage.get<Rate>(`rate:${userId}`)
    const point = { x: 300 + (existing.length % 8) * 50, y: 430 }
    const peer: Peer = { id: userId, card: card(row), motion: previous ? this.attachment(previous).peer.motion : { from: point, to: point, at: now, duration: 0 } }
    // Keep last position across disconnect/reconnect, not just hibernation.
    if (!previous) {
      const saved = await this.ctx.storage.get<Peer['motion']>(`position:${userId}`)
      if (saved) peer.motion = saved
    }
    const pair = new WebSocketPair()
    this.ctx.acceptWebSocket(pair[1])
    pair[1].serializeAttachment({ guildId, sessionId, peer, rate: savedRate || { tokens: 10, at: now }, emoteAt: 0 } satisfies Attachment)
    if (previous) previous.close(4002, 'Opened in another tab')
    await this.snapshot(pair[1])
    await this.broadcast({ type: 'peer', peer, now })
    return new Response(null, { status: 101, webSocket: pair[0] })
  }
  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (!await this.valid(ws)) return
    const a = this.attachment(ws)
    const now = Date.now()
    const rate = consume(a.rate, now)
    if (!rate) { ws.close(4008, 'Too many messages'); return }
    a.rate = rate
    ws.serializeAttachment(a)
    await this.ctx.storage.put(`rate:${a.peer.id}`, rate)
    const message = parseMessage(raw)
    if (!message) { ws.close(1008, 'Invalid message'); return }
    if (message.type === 'sync') { await this.snapshot(ws); return }
    if (message.type === 'move') {
      a.peer.motion = move(a.peer.motion, message, now)
      await this.ctx.storage.put(`position:${a.peer.id}`, a.peer.motion)
    } else {
      if (now - a.emoteAt < 1500) return
      a.emoteAt = now
      a.peer.emote = { kind: message.emote, at: now }
    }
    const row = await getProfile(this.env.DB, a.peer.id)
    if (!row?.published) { ws.close(4001, 'Profile unpublished'); return }
    a.peer.card = card(row)
    ws.serializeAttachment(a)
    await this.broadcast({ type: 'peer', peer: a.peer, now })
  }
  async webSocketClose(ws: WebSocket) {
    const a = this.attachment(ws)
    // An old socket closing must not remove its replacement from the room.
    if (a && !this.ctx.getWebSockets().some(other => other !== ws && this.attachment(other).peer.id === a.peer.id)) {
      await this.broadcast({ type: 'leave', id: a.peer.id })
    }
  }
  async webSocketError(ws: WebSocket) { ws.close(1011, 'Reconnect'); await this.webSocketClose(ws) }
}
