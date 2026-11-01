// Classic combinations plus Forever's six additions and faction-specific Skyborne.
// Verified 2026-11-01 against Blizzard's October 29 returning-player guide:
// https://worldofwarcraft.blizzard.com/en-gb/news/24315643
// Skyborne class lists: https://worldofwarcraft.blizzard.com/en-gb/news/24302071
export const factions = ['Alliance', 'Horde'] as const
export const races = ['Human', 'Dwarf', 'Night Elf', 'Gnome', 'Orc', 'Undead', 'Tauren', 'Troll', 'Skyborne', 'Undecided'] as const
export const classes = ['Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage', 'Warlock', 'Druid', 'Undecided'] as const

export type Faction = typeof factions[number]
export type Race = typeof races[number]
export type CharacterClass = typeof classes[number]

const raceClasses: Record<Faction, Partial<Record<Race, readonly CharacterClass[]>>> = {
  Alliance: {
    Human: ['Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Mage', 'Warlock'],
    Dwarf: ['Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Shaman'],
    'Night Elf': ['Warrior', 'Hunter', 'Rogue', 'Priest', 'Druid'],
    Gnome: ['Warrior', 'Rogue', 'Priest', 'Mage', 'Warlock'],
    Skyborne: ['Warrior', 'Hunter', 'Rogue', 'Mage', 'Druid'],
  },
  Horde: {
    Orc: ['Warrior', 'Hunter', 'Rogue', 'Shaman', 'Mage', 'Warlock'],
    Undead: ['Warrior', 'Paladin', 'Rogue', 'Priest', 'Mage', 'Warlock'],
    Tauren: ['Warrior', 'Hunter', 'Shaman', 'Druid'],
    Troll: ['Warrior', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage', 'Warlock'],
    Skyborne: ['Warrior', 'Hunter', 'Rogue', 'Shaman', 'Druid'],
  },
}

export function getRaces(faction: Faction): Race[] {
  return [...Object.keys(raceClasses[faction]) as Race[], 'Undecided']
}

export function getClasses(faction: Faction, race: Race): CharacterClass[] {
  const available = race === 'Undecided'
    ? Object.values(raceClasses[faction]).flat()
    : raceClasses[faction][race] || []
  return classes.filter(characterClass => characterClass === 'Undecided' || available.includes(characterClass))
}

export function raceLabel(faction: Faction, race: Race): string {
  return race === 'Skyborne' ? `Skyborne (${faction === 'Alliance' ? 'High Order' : 'Windshaper'})` : race
}
