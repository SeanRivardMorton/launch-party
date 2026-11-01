import { z } from 'zod'
import { factions } from './interest'

export const regions = ['Europe', 'North America', 'Oceania', 'Other'] as const

export const guildSchema = z.object({
  name: z.string().trim().min(2).max(80),
  faction: z.enum(factions),
  region: z.enum(regions),
  description: z.string().trim().min(10).max(600),
  submissionId: z.uuid().optional(),
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
}

export type GuildRecord = Omit<Guild, 'path'>

export function guildPath(id: string) {
  return `/guilds/${encodeURIComponent(id)}`
}

export function guildFromRecord(record: GuildRecord): Guild {
  const { id, name, faction, region, description } = record
  return { id, name, faction, region, description, path: guildPath(id) }
}
