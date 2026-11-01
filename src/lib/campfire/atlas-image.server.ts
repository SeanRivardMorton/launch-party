import { decode } from 'fast-png'
import { createPng, encodePng } from './png'
import { ANIMATIONS, ATLAS } from './atlas'

export const STRIP = { width: 1536, height: 1024, cellWidth: 192 } as const
type Pose = { left: number; right: number; top: number; bottom: number; area?: number }
export type Bounds = Pose & { frames?: Pose[] }
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
  const length = image.width * image.height
  const seen = new Uint8Array(length)
  const stack = new Int32Array(length)
  const components: (Pose & { area: number })[] = []
  // Models do not honor exact slot boundaries reliably. Extract connected
  // silhouettes from alpha first, then assemble exact cells ourselves.
  for (let start = 0; start < length; start++) {
    if (seen[start] || image.data[start * 4 + 3] < 32) continue
    const component = { left: image.width, right: 0, top: image.height, bottom: 0, area: 0 }
    let size = 1; stack[0] = start; seen[start] = 1
    while (size) {
      const pixel = stack[--size]
      const x = pixel % image.width; const y = Math.floor(pixel / image.width)
      component.left = Math.min(component.left, x); component.right = Math.max(component.right, x)
      component.top = Math.min(component.top, y); component.bottom = Math.max(component.bottom, y); component.area++
      for (const next of [x ? pixel - 1 : -1, x < image.width - 1 ? pixel + 1 : -1, y ? pixel - image.width : -1, y < image.height - 1 ? pixel + image.width : -1]) {
        if (next < 0 || seen[next] || image.data[next * 4 + 3] < 32) continue
        seen[next] = 1; stack[size++] = next
      }
    }
    if (component.area >= 80) components.push(component)
  }
  if (!components.length) throw new SpriteError('empty_or_opaque_frames')
  const largest = Math.max(...components.map(component => component.area))
  const tallest = Math.max(...components.map(component => component.bottom - component.top + 1))
  const significant = components.filter(component => component.area >= Math.max(80, largest * .12) && component.bottom - component.top + 1 >= tallest * .4).sort((a, b) => a.left - b.left)
  const poses: Pose[] = []
  // Body/face/weapon fragments with overlapping horizontal ranges belong to
  // the same pose. Ignore tiny detached noise rather than clipping good art.
  for (const component of significant) {
    const previous = poses.at(-1)
    if (previous && component.left <= previous.right + 4) {
      previous.right = Math.max(previous.right, component.right)
      previous.top = Math.min(previous.top, component.top); previous.bottom = Math.max(previous.bottom, component.bottom)
    } else poses.push({ ...component })
  }
  for (const component of components) {
    if (significant.includes(component) || !poses.length) continue
    const center = (component.left + component.right) / 2
    const nearest = poses.reduce((a, b) => Math.abs((a.left + a.right) / 2 - center) < Math.abs((b.left + b.right) / 2 - center) ? a : b)
    const gapX = Math.max(0, nearest.left - component.right, component.left - nearest.right)
    const gapY = Math.max(0, nearest.top - component.bottom, component.top - nearest.bottom)
    if (gapX > image.width / ANIMATIONS[row].durations.length * .3 || gapY > (nearest.bottom - nearest.top) * .2) continue
    nearest.left = Math.min(nearest.left, component.left); nearest.right = Math.max(nearest.right, component.right)
    nearest.top = Math.min(nearest.top, component.top); nearest.bottom = Math.max(nearest.bottom, component.bottom)
  }
  if (poses.some(pose => pose.left === 0 || pose.right === image.width - 1 || pose.top === 0 || pose.bottom === image.height - 1)) throw new SpriteError('clipped_frames')
  if (poses.length !== ANIMATIONS[row].durations.length) throw new SpriteError('wrong_frame_count')
  const signatures = poses.map(pose => {
    let signature = pose.top
    for (let y = pose.top; y <= pose.bottom; y++) for (let x = pose.left; x <= pose.right; x++) {
      const i = (y * image.width + x) * 4
      for (let c = 0; c < 4; c++) signature = Math.imul(signature ^ image.data[i + c], 16777619)
    }
    return `${pose.right - pose.left}:${pose.bottom - pose.top}:${signature}`
  })
  // Exact duplicates cannot be an animation. Visual consistency still needs QA.
  if (new Set(signatures).size < 2) throw new SpriteError('static_frames')
  const halfWidth = Math.max(...poses.map(pose => (pose.right - pose.left) / 2))
  return { left: -halfWidth, right: halfWidth, top: Math.min(...poses.map(pose => pose.top)), bottom: Math.max(...poses.map(pose => pose.bottom)), frames: poses }
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
      const pose = rows[row].bounds.frames?.[column]
      for (let y = top; y < 196; y++) for (let x = left; x < 192 - left; x++) {
        const relativeX = (x - left) / scale + global.left
        const sx = Math.floor(pose ? relativeX + (pose.left + pose.right) / 2 : relativeX + column * 192)
        const sy = Math.floor((y - top) / scale) + global.top
        if (pose ? sx < pose.left || sx > pose.right || sy < pose.top || sy > pose.bottom : relativeX > global.right || sy > global.bottom) continue
        const from = (sy * STRIP.width + sx) * 4
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
