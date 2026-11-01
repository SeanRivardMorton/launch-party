import { ANIMATIONS } from '../../src/lib/campfire/atlas'
import { assembleAtlas, decodePng, inspectStrip } from '../../src/lib/campfire/atlas-image.server'
import { stripFixture } from '../atlas-fixture'

// Local-only runtime probe: no credentials, bindings, auth bypass or real images.
export default {
  async fetch(request: Request) {
    if (new URL(request.url).pathname !== '/verify') return new Response('Local atlas test worker')
    const sources = ANIMATIONS.map((_row, row) => stripFixture(row))
    const rows = sources.map((bytes, row) => ({ key: String(row), bounds: inspectStrip(bytes, row) }))
    const bytes = await assembleAtlas(rows, async key => sources[Number(key)])
    const image = decodePng(bytes, 1536, 1872)
    return Response.json({ width: image.width, height: image.height, frames: ANIMATIONS.reduce((total, row) => total + row.durations.length, 0) })
  },
}
