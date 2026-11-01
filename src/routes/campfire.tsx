import { createFileRoute } from '@tanstack/react-router'
import { GuildCampfireScreen } from '@/components/guild-campfire'

export const Route = createFileRoute('/campfire')({ component: GuildCampfireScreen })
