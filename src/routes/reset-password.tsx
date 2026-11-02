import { createFileRoute } from '@tanstack/react-router'
import { PasswordRecovery } from '@/components/password-recovery'

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>) => ({ token: typeof search.token === 'string' && search.token.length <= 512 ? search.token : undefined, error: typeof search.error === 'string' ? search.error : undefined }),
  head: () => ({ meta: [{ title: 'Reset password · ai-zeroth' }, { name: 'robots', content: 'noindex' }, { name: 'referrer', content: 'no-referrer' }] }),
  component: ResetPage,
})

function ResetPage() {
  const { token, error } = Route.useSearch()
  return <PasswordRecovery reset token={token} invalid={Boolean(error)} />
}
