import { describe, expect, it } from 'vitest'
import { createPng, encodePng } from '../src/lib/campfire/png'
import { ANIMATIONS, animationFor, ATLAS, frameAt } from '../src/lib/campfire/atlas'
import { assembleAtlas, decodePng, inspectStrip } from '../src/lib/campfire/atlas-image.server'
import type { Peer } from '../src/lib/campfire/protocol'
import { stripFixture } from './atlas-fixture'

describe('Codex-compatible animation timing', () => {
  it('uses exact frame durations, loops without visiting unused cells, and recovers phase from absolute time', () => {
    expect(frameAt(0, 279)).toEqual({ column: 0, remaining: 1 })
    expect(frameAt(0, 280)).toEqual({ column: 1, remaining: 110 })
    expect(frameAt(0, 1100)).toEqual({ column: 0, remaining: 280 })
    for (let row = 0; row < 9; row++) for (let elapsed = 0; elapsed < 6000; elapsed += 31) {
      expect(frameAt(row, elapsed).column).toBeLessThan(ANIMATIONS[row].durations.length)
      expect(frameAt(row, elapsed).remaining).toBeGreaterThan(0)
    }
  })
  it('maps authoritative movement and emotes to distinct rows and returns to idle on expiry', () => {
    const peer = { motion: { from: { x: 100, y: 200 }, to: { x: 900, y: 200 }, at: 1000, duration: 2000 } } as Peer
    expect(animationFor(peer, 1500).row).toBe(1)
    expect(animationFor({ ...peer, motion: { ...peer.motion, to: { x: 50, y: 200 } } }, 1500).row).toBe(2)
    expect(animationFor({ ...peer, emote: { kind: 'wave', at: 1400 } }, 1500).row).toBe(3)
    expect(animationFor({ ...peer, emote: { kind: 'cheer', at: 1400 } }, 1500).row).toBe(4)
    expect(animationFor({ ...peer, emote: { kind: 'cheer', at: 1400 } }, 4400).row).toBe(0)
    expect(animationFor(peer, 3000).row).toBe(0)
  })
})
describe('deterministic atlas assembly', () => {
  it('rejects malformed, wrong-size, empty, copied/static and opaque strips', () => {
    expect(() => decodePng(new Uint8Array(40), 1536, 1024)).toThrow('invalid_image')
    const wrong = encodePng(createPng(192, 208))
    expect(() => inspectStrip(wrong, 0)).toThrow('invalid_dimensions')
    const empty = encodePng(createPng(1536, 1024))
    expect(() => inspectStrip(empty, 0)).toThrow('empty_or_opaque_frames')
    expect(() => inspectStrip(stripFixture(0, true), 0)).toThrow('static_frames')
    const opaque = createPng(1536, 1024); opaque.data.fill(255)
    expect(() => inspectStrip(encodePng(opaque), 0)).toThrow('clipped_frames')
  })
  it('assembles exact geometry, leaves unused cells transparent and preserves jumping displacement', async () => {
    const sources = ANIMATIONS.map((_row, row) => stripFixture(row))
    const rows = sources.map((source, row) => ({ key: String(row), bounds: inspectStrip(source, row) }))
    const bytes = await assembleAtlas(rows, async key => sources[Number(key)])
    const atlas = decodePng(bytes, ATLAS.width, ATLAS.height)
    const tops: number[] = []
    let transparentResidue = 0
    for (let row = 0; row < 9; row++) for (let column = 0; column < 8; column++) {
      let occupied = 0; let firstY = 208
      for (let y = 0; y < 208; y++) for (let x = 0; x < 192; x++) {
        const index = ((row * 208 + y) * ATLAS.width + column * 192 + x) * 4
        if (atlas.data[index + 3]) { occupied++; firstY = Math.min(firstY, y) }
        else transparentResidue += atlas.data[index] + atlas.data[index + 1] + atlas.data[index + 2]
      }
      if (column < ANIMATIONS[row].durations.length) expect(occupied).toBeGreaterThan(100)
      else expect(occupied).toBe(0)
      if (row === 4 && column < 5) tops.push(firstY)
    }
    expect(tops[2]).toBeLessThan(tops[0])
    expect(tops[0]).toBe(tops[4])
    expect(transparentResidue).toBe(0)
  }, 20_000)
})
