import { createFileRoute } from '@tanstack/react-router'
import { CharacterOverview } from '@/components/account-overview'
import { PrivatePage } from '@/components/private-page'
import { requirePageAccount } from '@/lib/private-page'

export const Route = createFileRoute('/guild')({
  beforeLoad: () => requirePageAccount('/guild'),
  staleTime: 0,
  head: () => ({ meta: [{ title: 'Guild · ai-zeroth' }, { name: 'robots', content: 'noindex' }] }),
  component: () => <PrivatePage title="Your guild." path="/guild">{userId => <CharacterOverview active={userId} section="guilds" />}</PrivatePage>,
})
