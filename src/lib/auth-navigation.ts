// Only app pages can be return destinations. Never navigate to an auth/API callback.
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(value)) return '/account'
  try {
    const url = new URL(value, 'https://internal.invalid')
    const path = decodeURIComponent(url.pathname)
    if (url.origin !== 'https://internal.invalid' || path.includes('\\') || path.startsWith('//') || /^\/(api|login|register)(\/|$)/i.test(path)) return '/account'
    return url.pathname + url.search + url.hash
  } catch { return '/account' }
}
