import { z } from 'zod'
import { classes, factions, getClasses, getRaces, races, type CharacterClass } from './character-options'

export { classes, factions } from './character-options'

export const roles = ['Tank', 'Healer', 'Damage', 'Undecided'] as const
export type Role = typeof roles[number]

const classRoles: Record<CharacterClass, readonly Role[]> = {
  Warrior: ['Tank', 'Damage'],
  Paladin: ['Tank', 'Healer', 'Damage'],
  Hunter: ['Damage'],
  Rogue: ['Damage'],
  Priest: ['Healer', 'Damage'],
  Shaman: ['Healer', 'Damage'],
  Mage: ['Damage'],
  Warlock: ['Damage'],
  Druid: ['Tank', 'Healer', 'Damage'],
  Undecided: ['Tank', 'Healer', 'Damage'],
}

export function getRoles(characterClass: CharacterClass): Role[] {
  const available = classRoles[characterClass]
  return available.length === 1 ? [...available] : [...available, 'Undecided']
}
export const needs = ['Dungeon / raid crew', 'Crafting connections', 'Real-life friends', 'A bit of everything'] as const
// Primary professions confirmed by Blizzard's Forever starter guide:
// https://worldofwarcraft.blizzard.com/en-gb/news/24315280
export const professions = ['Alchemy', 'Blacksmithing', 'Enchanting', 'Engineering', 'Herbalism', 'Leatherworking', 'Mining', 'Skinning', 'Tailoring'] as const

export const characterFields = {
  faction: z.enum(factions),
  race: z.enum(races),
  characterClass: z.enum(classes),
  fulfilledRoles: z.array(z.enum(roles)).min(1).max(3).refine(values => new Set(values).size === values.length && (!values.includes('Undecided') || values.length === 1), 'Choose specific roles or Undecided.'),
  professions: z.array(z.enum(professions)).max(2).refine(values => new Set(values).size === values.length, 'Choose different professions.'),
}

export function validateCharacter(data: z.infer<z.ZodObject<typeof characterFields>>, ctx: z.RefinementCtx) {
  if (data.fulfilledRoles.some(role => !getRoles(data.characterClass).includes(role))) {
    ctx.addIssue({ code: 'custom', path: ['fulfilledRoles'], message: 'Choose only roles available to your class.' })
  }
  if (!getRaces(data.faction).includes(data.race)) {
    ctx.addIssue({ code: 'custom', path: ['race'], message: 'Choose a race available to your faction.' })
  } else if (!getClasses(data.faction, data.race).includes(data.characterClass)) {
    ctx.addIssue({ code: 'custom', path: ['characterClass'], message: 'Choose a class available to your race and faction.' })
  }
}

export const interestSchema = z.object({
  email: z.email().max(254).transform(value => value.trim().toLowerCase()),
  name: z.string().trim().min(1).max(60),
  need: z.enum(needs),
  feedback: z.string().trim().max(600).default(''),
  consent: z.literal(true),
  website: z.string().max(200).default(''),
  ...characterFields,
  guildIntent: z.enum(['find', 'list', 'later']),
  guildId: z.uuid().optional(),
  guildConsent: z.boolean().optional(),
}).superRefine((data, ctx) => {
  validateCharacter(data, ctx)
  if (data.guildId && !data.guildConsent) {
    ctx.addIssue({ code: 'custom', path: ['guildConsent'], message: 'Confirm your interest in joining this guild.' })
  }
})
