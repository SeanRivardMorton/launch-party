import '@tanstack/react-start/server-only'

type ResetEmailConfig = { RESEND_API_KEY?: string, AUTH_EMAIL_FROM?: string }
type ResetEmail = { user: { email: string }, url: string }

// Server-only, fixed provider endpoint; no token/recipient logging or configurable transport URL.
export function createResetPasswordSender(config: ResetEmailConfig) {
  const apiKey = config.RESEND_API_KEY?.trim()
  const from = config.AUTH_EMAIL_FROM?.trim()
  if (!apiKey || !from) return undefined

  return async ({ user, url }: ResetEmail) => {
    let response: Response
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          from,
          to: [user.email],
          subject: 'Reset your Launch Party password',
          text: `Reset your password using this link:\n\n${url}\n\nThis link expires in one hour and can be used once. If you did not request a reset, ignore this email.`,
        }),
      })
    } catch {
      // Never expose provider exceptions (which can include headers, URLs or recipient details).
      throw new Error('Password reset email delivery failed (network or timeout)')
    }
    // Better Auth catches and logs this sanitized failure through its background-task handler.
    // Do not read/log provider response bodies: they can echo recipient data.
    if (!response.ok) throw new Error(`Password reset email delivery failed (HTTP ${response.status})`)
  }
}
