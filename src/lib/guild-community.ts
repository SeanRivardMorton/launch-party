import { z } from 'zod'
import { characterFields, validateCharacter } from './interest'

export const guildCharacterSchema = z.object({
  nickname: z.string().trim().min(1).max(60),
  ...characterFields,
}).superRefine(validateCharacter)
export type GuildCharacterProfile = z.infer<typeof guildCharacterSchema>
// Self-provided, not verified through Battle.net. Empty means stop sharing.
export const battleTagSchema = z.string().trim().max(64).refine(value => value === '' || /^[\p{L}\p{N}]{3,12}#[0-9]{4,12}$/u.test(value), 'Use your full BattleTag, such as PlayerName#1234, or leave blank to remove it.')
export type GuildRole = 'leader' | 'officer' | 'member'
export type ApplicationStatus = 'pending' | 'approved' | 'declined'
export type GuildMember = GuildCharacterProfile & { userId: string; role: GuildRole; joinedAt: string; battleTag?: string }
export type GuildApplication = GuildCharacterProfile & { userId: string; introduction: string; status: ApplicationStatus; createdAt: string }
export const initiativeStatuses = ['planned', 'active', 'completed'] as const
export const initiativeSchema = z.object({ title: z.string().trim().min(2).max(80), description: z.string().trim().max(600), status: z.enum(initiativeStatuses) })
export type GuildInitiative = z.infer<typeof initiativeSchema> & { id: string; createdAt: string; updatedAt: string }
export type GuildCommunity = {
  viewer: { userId: string; role: GuildRole | null; applicationStatus: ApplicationStatus | null; canManage: boolean; battleTag?: string }
  members: GuildMember[]
  membersHasMore: boolean
  applications: GuildApplication[]
  applicationsHasMore: boolean
  initiatives: GuildInitiative[]
  canClaim: boolean
  campfireAvailable: boolean
}

export const guildActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('update-battletag'), battleTag: battleTagSchema }),
  z.object({ action: z.literal('apply'), profile: guildCharacterSchema, introduction: z.string().trim().max(280).default('') }),
  z.object({ action: z.literal('claim'), managementKey: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.object({ action: z.literal('approve'), userId: z.string().min(1).max(128) }),
  z.object({ action: z.literal('decline'), userId: z.string().min(1).max(128) }),
  z.object({ action: z.literal('set-role'), userId: z.string().min(1).max(128), role: z.enum(['officer', 'member']) }),
  z.object({ action: z.literal('remove-member'), userId: z.string().min(1).max(128) }),
  z.object({ action: z.literal('update-profile'), profile: guildCharacterSchema }),
  z.object({ action: z.literal('create-initiative'), ...initiativeSchema.shape }),
  z.object({ action: z.literal('update-initiative'), initiativeId: z.uuid(), ...initiativeSchema.shape }),
  z.object({ action: z.literal('delete-initiative'), initiativeId: z.uuid() }),
])
