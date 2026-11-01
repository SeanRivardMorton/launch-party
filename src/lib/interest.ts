import { z } from 'zod'

export const roles = ['Tank', 'Healer', 'Damage', 'Undecided'] as const
export const needs = ['Dungeon / raid crew', 'Crafting connections', 'Real-life friends', 'A bit of everything'] as const

export const interestSchema = z.object({
  email: z.email().max(254).transform(value => value.trim().toLowerCase()),
  name: z.string().trim().min(1).max(60),
  role: z.enum(roles),
  need: z.enum(needs),
  feedback: z.string().trim().max(600).default(''),
  consent: z.literal(true),
  website: z.string().max(200).default(''),
})
