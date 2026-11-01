import type { Peer } from './protocol'

// OpenAI hatch-pet's published 8×9 contract. Durations are per-frame, not
// an assumed uniform FPS. Atlas geometry is assembled by code, never guessed.
export const ATLAS = { format: 'codex-pet-v1', columns: 8, rows: 9, cellWidth: 192, cellHeight: 208, width: 1536, height: 1872 } as const
export const ANIMATIONS = [
  { name: 'idle', durations: [280, 110, 110, 140, 140, 320], action: 'Quiet breathing and blinking. No walking or waving.' },
  { name: 'running-right', durations: [120, 120, 120, 120, 120, 120, 120, 220], action: 'Face RIGHT, alternating footfalls and arm swings through a complete rightward running cycle, in place.' },
  { name: 'running-left', durations: [120, 120, 120, 120, 120, 120, 120, 220], action: 'Face LEFT, alternating footfalls and arm swings through a complete leftward running cycle, in place.' },
  { name: 'waving', durations: [140, 140, 140, 280], action: 'Raise a hand, wave, and return to rest. No floating marks or effects.' },
  { name: 'jumping', durations: [140, 140, 140, 140, 280], action: 'Anticipation, lift, airborne peak, descent, settle. Change body position vertically within its slot; no floor, shadows or dust.' },
  { name: 'failed', durations: [140, 140, 140, 140, 140, 140, 140, 240], action: 'Disappointed or deflated reaction, then recovery. Keep all effects attached to the body.' },
  { name: 'waiting', durations: [150, 150, 150, 150, 150, 260], action: 'Expectant asking pose, gentle head tilt, awaiting a response. Distinct from idle.' },
  { name: 'running', durations: [120, 120, 120, 120, 120, 220], action: 'Focused task work or thinking with existing equipment. Not literal running or walking; no new props.' },
  { name: 'review', durations: [150, 150, 150, 150, 150, 280], action: 'Thoughtful inspecting pose, leaning and blinking. No new props.' },
] as const
export type AnimationName = typeof ANIMATIONS[number]['name']
export function animationFor(peer: Peer, now: number): { row: number; epoch: number; until: number } {
  if (peer.emote && now < peer.emote.at + 3000 && now >= peer.emote.at) {
    return { row: peer.emote.kind === 'cheer' ? 4 : 3, epoch: peer.emote.at, until: peer.emote.at + 3000 }
  }
  if (now >= peer.motion.at && now < peer.motion.at + peer.motion.duration) {
    return { row: peer.motion.to.x < peer.motion.from.x ? 2 : 1, epoch: peer.motion.at, until: peer.motion.at + peer.motion.duration }
  }
  return { row: 0, epoch: 0, until: Infinity }
}
export function frameAt(row: number, elapsed: number) {
  const durations = ANIMATIONS[row].durations
  const period = durations.reduce<number>((sum, ms) => sum + ms, 0)
  let phase = ((elapsed % period) + period) % period
  for (let column = 0; column < durations.length; column++) {
    if (phase < durations[column]) return { column, remaining: durations[column] - phase }
    phase -= durations[column]
  }
  return { column: 0, remaining: durations[0] }
}
