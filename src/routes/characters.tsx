import { createFileRoute } from '@tanstack/react-router'
import { CharacterOverview } from '@/components/account-overview'
import { PrivatePage } from '@/components/private-page'
import { requirePageAccount } from '@/lib/private-page'

export const Route = createFileRoute('/characters')({
  beforeLoad: () => requirePageAccount('/characters'),
  staleTime: 0,
  head: () => ({ meta: [{ title: 'Characters · ai-zeroth' }, { name: 'robots', content: 'noindex' }] }),
  component: () => <PrivatePage title="Your characters." path="/characters">{userId => <CharacterOverview active={userId} section="characters" />}</PrivatePage>,
})
