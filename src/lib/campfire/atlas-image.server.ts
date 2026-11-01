import { decode } from 'fast-png'
import { createPng, encodePng } from './png'
import { ANIMATIONS, ATLAS } from './atlas'

export const STRIP = { width: 1536, height: 1024, cellWidth: 192 } as const
export type Bounds = { left: number; right: number; top: number; bottom: number }
export class SpriteError extends Error {
  constructor(public code: string) { super(code) }
}
export function decodePng(bytes: Uint8Array, width: number, height: number) {
  if (bytes.length < 33 || bytes.length > 9_000_000 || ![137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) throw new SpriteError('invalid_image')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // Validate dimensions BEFORE decompression, not after allocating the image.
  if (view.getUint32(16) !== width || view.getUint32(20) !== height) throw new SpriteError('invalid_dimensions')
  const image = decode(bytes, { checkCrc: true })
  if (image.width !== width || image.height !== height) throw new SpriteError('invalid_dimensions')
  if (image.depth !== 8 || image.channels !== 4 || !(image.data instanceof Uint8Array)) throw new SpriteError('requires_rgba_png')
  return { width, height, data: image.data }
}
export function inspectStrip(bytes: Uint8Array, row: number): Bounds {
  const image = decodePng(bytes, STRIP.width, STRIP.height)
  const bounds = { left: 191, right: 0, top: 1023, bottom: 0 }
  const frames = ANIMATIONS[row].durations.length
  const signatures: string[] = []
  for (let column = 0; column < 8; column++) {
    let count = 0; let signature = 2166136261
    for (let y = 0; y < image.height; y++) for (let x = 0; x < 192; x++) {
      const index = (y * image.width + column * 192 + x) * 4
      const alpha = image.data[index + 3]
      if (alpha < 16) continue
      if (column >= frames) throw new SpriteError('unexpected_frames')
      // A crossing body or a copied guide/grid would clip at slot boundaries.
      if (x < 2 || x > 189 || y < 2 || y > 1021) throw new SpriteError('clipped_frames')
      bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x)
      bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y)
      count++
      signature = Math.imul(signature ^ (y * 192 + x + image.data[index] + (image.data[index + 1] << 8) + (image.data[index + 2] << 16)), 16777619)
    }
    if (column < frames) {
      if (count < 80 || count > 192 * 1024 * .65) throw new SpriteError('empty_or_opaque_frames')
      signatures.push(String(signature))
    }
  }
  // Exact duplicates cannot be an animation. Visual consistency still needs QA.
  if (new Set(signatures).size < 2) throw new SpriteError('static_frames')
  return bounds
}
export function layoutGuide(row: number): Uint8Array {
  const image = createPng(STRIP.width, STRIP.height)
  const frames = ANIMATIONS[row].durations.length
  // Construction input only, not artwork: fixed slots and a common foot line.
  for (let column = 0; column < frames; column++) for (let y = 312; y <= 712; y++) for (let x = 12; x < 180; x++) {
    if (x !== 12 && x !== 179 && y !== 312 && y !== 712 && y !== 680) continue
    const i = (y * image.width + column * 192 + x) * 4
    image.data.set([210, 20, 190, 180], i)
  }
  return encodePng(image)
}
export async function assembleAtlas(rows: { bounds: Bounds; key: string }[], load: (key: string) => Promise<Uint8Array>) {
  if (rows.length !== 9) throw new SpriteError('missing_rows')
  const global = rows.reduce((a, row) => ({ left: Math.min(a.left, row.bounds.left), right: Math.max(a.right, row.bounds.right), top: Math.min(a.top, row.bounds.top), bottom: Math.max(a.bottom, row.bounds.bottom) }), rows[0].bounds)
  const scale = Math.min(168 / (global.right - global.left + 1), 184 / (global.bottom - global.top + 1))
  const left = Math.round((192 - (global.right - global.left + 1) * scale) / 2)
  const top = Math.round(196 - (global.bottom - global.top + 1) * scale)
  const atlas = createPng(ATLAS.width, ATLAS.height)
  for (let row = 0; row < rows.length; row++) {
    // Decode one source at a time to bound Worker memory.
    const source = decodePng(await load(rows[row].key), STRIP.width, STRIP.height)
    for (let column = 0; column < ANIMATIONS[row].durations.length; column++) {
      for (let y = top; y < 196; y++) for (let x = left; x < 192 - left; x++) {
        const sx = Math.floor((x - left) / scale) + global.left
        const sy = Math.floor((y - top) / scale) + global.top
        if (sx > global.right || sy > global.bottom) continue
        const from = (sy * STRIP.width + column * 192 + sx) * 4
        if (source.data[from + 3] < 16) continue
        const to = ((row * 208 + y) * ATLAS.width + column * 192 + x) * 4
        atlas.data.set(source.data.subarray(from, from + 4), to)
      }
    }
  }
  // Unused cells and transparent RGB start at zero, and are never written.
  return encodePng(atlas)
}
export function referenceFromAtlas(bytes: Uint8Array) {
  const atlas = decodePng(bytes, ATLAS.width, ATLAS.height)
  const frame = createPng(192, 208)
  for (let y = 0; y < 208; y++) frame.data.set(atlas.data.subarray(y * ATLAS.width * 4, (y * ATLAS.width + 192) * 4), y * 192 * 4)
  return encodePng(frame)
}
