import { createPng, encodePng } from '../src/lib/campfire/png'
import { ANIMATIONS, ATLAS } from '../src/lib/campfire/atlas'

// Synthetic colored geometry for verifying raster/cell playback, not AI artwork.
export function stripFixture(row: number, duplicate = false) {
  const png = createPng(1536, 1024)
  for (let column = 0; column < ANIMATIONS[row].durations.length; column++) {
    const lift = row === 4 ? [0, 20, 60, 20, 0][column] : 0
    for (let y = 480 - lift; y < 650 - lift; y++) for (let x = 65; x < 126; x++) {
      const i = (y * png.width + column * 192 + x) * 4
      png.data.set([duplicate ? 90 : 50 + column * 22, 60 + row * 17, 150, 255], i)
    }
  }
  return encodePng(png)
}
export function atlasFixture() {
  const png = createPng(ATLAS.width, ATLAS.height)
  for (let row = 0; row < 9; row++) for (let column = 0; column < ANIMATIONS[row].durations.length; column++) {
    for (let y = 30; y < 190; y++) for (let x = 55; x < 137; x++) {
      const i = ((row * 208 + y) * png.width + column * 192 + x) * 4
      png.data.set([50 + column * 22, 60 + row * 17, 150, 255], i)
    }
  }
  return encodePng(png)
}
