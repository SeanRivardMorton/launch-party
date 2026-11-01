import { useEffect, useRef, useState } from 'react'
import { ANIMATIONS, animationFor, frameAt } from '@/lib/campfire/atlas'
import type { Peer } from '@/lib/campfire/protocol'

export function SpriteSheet({ peer, offset, onError }: { peer: Peer; offset: number; onError: () => void }) {
  const image = useRef<HTMLImageElement>(null)
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    const node = image.current
    if (!node) return
    let timer: ReturnType<typeof setTimeout>
    const paint = () => {
      const now = Date.now() + offset
      const state = reducedMotion ? { row: 0, epoch: now, until: Infinity } : animationFor(peer, now)
      const frame = reducedMotion ? { column: 0, remaining: Infinity } : frameAt(state.row, now - state.epoch)
      node.style.left = `${-frame.column * 100}%`
      node.style.top = `${-state.row * 100}%`
      node.dataset.animation = ANIMATIONS[state.row].name
      node.dataset.frame = String(frame.column)
      if (!reducedMotion) timer = setTimeout(paint, Math.max(16, Math.min(frame.remaining, state.until - now)))
    }
    paint()
    return () => clearTimeout(timer)
  }, [peer.motion, peer.emote, offset, reducedMotion])
  return <span className="guild-sheet" aria-hidden="true"><img ref={image} src={peer.card.avatarUrl!} alt="" onError={onError} draggable={false} /></span>
}
