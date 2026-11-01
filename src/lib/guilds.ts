import { z } from 'zod'
import { classes, factions, professions, roles } from './interest'

export const regions = ['Europe', 'North America', 'Oceania', 'Other'] as const
export const needCategories = ['Role', 'Class', 'Profession', 'Other'] as const
export const recruitmentNeedsSchema = z.array(z.object({
  name: z.string().trim().min(2).max(80),
  category: z.enum(needCategories),
  quantity: z.number().int().min(1).max(40),
  notes: z.string().trim().max(160).default(''),
})).max(12)
export type RecruitmentNeed = z.infer<typeof recruitmentNeedsSchema>[number]
export const recruitmentOptions: { label: string; category: RecruitmentNeed['category']; names: readonly string[] }[] = [
  { label: 'Roles', category: 'Role', names: [...roles.filter(role => role !== 'Undecided').map(role => role === 'Damage' ? 'DPS' : role), 'Off-tank'] },
  { label: 'Classes', category: 'Class', names: classes.filter(characterClass => characterClass !== 'Undecided') },
  { label: 'Professions', category: 'Profession', names: [...professions, 'Cooking', 'First Aid', 'Fishing'] },
]
export const managementKeySchema = z.string().regex(/^[a-f0-9]{64}$/)
export const guildRecruitmentSchema = z.object({ recruitmentNeeds: recruitmentNeedsSchema })

export const guildSchema = z.object({
  name: z.string().trim().min(2).max(80),
  faction: z.enum(factions),
  region: z.enum(regions),
  description: z.string().trim().min(10).max(600),
  submissionId: z.uuid().optional(),
  managementKey: managementKeySchema.optional(),
  recruitmentNeeds: recruitmentNeedsSchema.default([]),
  publishConsent: z.literal(true),
  website: z.string().max(200).default(''),
})

export type Guild = {
  id: string
  name: string
  faction: 'Alliance' | 'Horde'
  region: string
  description: string
  path: string
  recruitmentNeeds: RecruitmentNeed[]
}

export type GuildRecord = Omit<Guild, 'path' | 'recruitmentNeeds'> & { recruitmentNeeds: string }

export function guildPath(id: string) {
  return `/guilds/${encodeURIComponent(id)}`
}

export function guildFromRecord(record: GuildRecord): Guild {
  const { id, name, faction, region, description } = record
  return { id, name, faction, region, description, path: guildPath(id), recruitmentNeeds: recruitmentNeedsSchema.parse(JSON.parse(record.recruitmentNeeds)) }
}
