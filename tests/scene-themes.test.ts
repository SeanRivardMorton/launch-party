import { describe, expect, it } from 'vitest'
import { parseThemePreference, resolveTheme, themeForRace } from '../src/lib/scene-themes'

describe('scenery preferences', () => {
  it.each([['Orc', 'durotar'], ['Troll', 'durotar'], ['Tauren', 'mulgore'], ['Undead', 'tirisfal'], ['Night Elf', 'darnassus'], ['Human', 'elwynn'], ['Dwarf', 'dunmorogh'], ['Gnome', 'dunmorogh']])('maps %s to %s', (race, theme) => expect(themeForRace(race)).toBe(theme))
  it.each([null, undefined, '', 'Skyborne', 'Undecided', 'Unknown', 'constructor', '__proto__'])('uses neutral fallback for %s', race => expect(themeForRace(race)).toBe('moonwell'))
  it('retains old explicit choices and rejects corrupt storage', () => {
    expect(parseThemePreference('tavern')).toBe('tavern')
    expect(parseThemePreference('moonwell')).toBe('moonwell')
    for (const value of [null, 'bad', 'constructor', '{"theme":"tavern"}']) expect(parseThemePreference(value)).toBe('automatic')
  })
  it('always gives explicit choices priority over race', () => {
    expect(resolveTheme('elwynn', 'Orc')).toBe('elwynn')
    expect(resolveTheme('moonwell', 'Night Elf')).toBe('moonwell')
    expect(resolveTheme('automatic', 'Night Elf')).toBe('darnassus')
  })
})
