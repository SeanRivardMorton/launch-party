import { createFileRoute } from '@tanstack/react-router'
import { PasswordRecovery } from '@/components/password-recovery'

export const Route = createFileRoute('/forgot-password')({
  head: () => ({ meta: [{ title: 'Recover password · ai-zeroth' }, { name: 'robots', content: 'noindex' }] }),
  component: PasswordRecovery,
})
