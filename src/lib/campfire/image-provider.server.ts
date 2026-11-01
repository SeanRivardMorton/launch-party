import { SpriteError } from './atlas-image.server'

export const IMAGE_MODEL = 'gpt-image-2.5-flare'
export async function generateImage(key: string, userId: string, prompt: string, size: '1024x1024' | '1536x1024', references: Uint8Array[] = []) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userId))
  const identifier = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
  const fields = { model: IMAGE_MODEL, n: 1, size, quality: 'medium', output_format: 'png', background: 'transparent', safety_identifier: identifier, prompt }
  let body: BodyInit
  const headers: Record<string, string> = { authorization: `Bearer ${key}` }
  if (references.length) {
    const form = new FormData()
    for (const [name, value] of Object.entries(fields)) form.set(name, String(value))
    for (let i = 0; i < references.length; i++) {
      const bytes = new Uint8Array(references[i]).buffer
      form.append('image[]', new Blob([bytes], { type: 'image/png' }), i === 0 ? 'canonical-character.png' : 'layout-guide.png')
    }
    body = form
  } else { headers['content-type'] = 'application/json'; body = JSON.stringify(fields) }
  const response = await fetch(`https://api.openai.com/v1/images/${references.length ? 'edits' : 'generations'}`, { method: 'POST', headers, body, signal: AbortSignal.timeout(110_000) })
  if (!response.ok) throw new SpriteError(response.status === 401 ? 'provider_key' : response.status === 403 ? 'provider_access' : response.status === 429 ? 'provider_limit' : 'provider_error')
  const reader = response.body?.getReader()
  if (!reader) throw new SpriteError('invalid_image')
  const chunks: Uint8Array[] = []; let sizeBytes = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    sizeBytes += chunk.value.length
    if (sizeBytes > 12_000_000) { await reader.cancel(); throw new SpriteError('oversized_image') }
    chunks.push(chunk.value)
  }
  const bytes = new Uint8Array(sizeBytes); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  const payload = JSON.parse(new TextDecoder().decode(bytes)) as { data?: { b64_json?: string }[] }
  const encoded = payload.data?.[0]?.b64_json
  if (!encoded || encoded.length > 11_000_000) throw new SpriteError('invalid_image')
  return Uint8Array.from(atob(encoded), c => c.charCodeAt(0))
}
