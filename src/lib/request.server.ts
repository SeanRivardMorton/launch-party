export async function readSameOriginJson(request: Request, maxBytes = 16384): Promise<{ body: unknown } | { response: Response }> {
  const fail = (error: string, status: number) => ({ response: Response.json({ error }, { status }) })
  if (request.headers.get('origin') !== new URL(request.url).origin) return fail('Please submit from this website.', 403)
  if (!request.headers.get('content-type')?.includes('application/json')) return fail('Expected JSON.', 415)
  const reader = request.body?.getReader()
  if (!reader) return fail('Empty submission.', 400)
  let bytes = 0
  let text = ''
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > maxBytes) { await reader.cancel(); return fail('Submission is too long.', 413) }
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()
  try { return { body: JSON.parse(text) } }
  catch { return fail('Invalid submission.', 400) }
}
