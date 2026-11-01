import type { GuildCharacterProfile, GuildRole, ApplicationStatus } from './guild-community'

// Private, owner-only DTO. No raw DB/auth records, email, avatar tokens or keys.
export type AccountOverview = {
  campfire: { nickname: string; faction: string; race: string; characterClass: string; professions: string[]
    bio: string; published: boolean; avatarUrl: string | null; avatarFormat: 'single' | 'codex-pet-v1'
  } | null
  memberships: { guildId: string; guildName: string; role: GuildRole; profile: GuildCharacterProfile; campfireAvailable: boolean }[]
  applications: { guildId: string; guildName: string; status: ApplicationStatus; profile: GuildCharacterProfile }[]
}
