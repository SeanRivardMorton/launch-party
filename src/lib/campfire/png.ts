import { encode } from 'fast-png'
export function createPng(width: number, height: number) {
  return { width, height, channels: 4, depth: 8 as const, data: new Uint8Array(width * height * 4) }
}
export const encodePng = encode
