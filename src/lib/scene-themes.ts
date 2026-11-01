import type { CSSProperties } from 'react'

const palette = (sky: string, horizon: string, far: string, near: string, trees: string, front: string, ground: string, path: string, grass: string, moon: string, accent: string) => ({
  '--sky-top': sky, '--sky-bottom': horizon, '--mountain-far': far, '--mountain-near': near,
  '--forest-far': trees, '--forest-front': front, '--ground': ground, '--path': path,
  '--grass': grass, '--moon': moon, '--accent': accent,
})

export const sceneThemes = {
  moonwell: { label: 'Moonwell', palette: palette('#081b23', '#24494d', '#1c3c43', '#16343b', '#102e33', '#081f25', '#112e30', '#183738', '#345344', '#c9ddd1', '#c6df9d') },
  tavern: { label: 'Tavern', palette: palette('#1f2826', '#55563c', '#3d4937', '#2c3b2d', '#243529', '#17271f', '#233529', '#30402c', '#5e6340', '#e9d5a5', '#edc780') },
  durotar: { label: 'Durotar · Orc / Troll', palette: palette('#291c30', '#b76a49', '#a2563b', '#703c32', '#553a30', '#34272b', '#422c2b', '#654035', '#96734b', '#f4c993', '#ffd39d') },
  mulgore: { label: 'Mulgore · Tauren', palette: palette('#172c38', '#8d9d73', '#647660', '#465c45', '#314c39', '#1c342e', '#253e30', '#3b5140', '#789051', '#f5dfad', '#dceaa9') },
  tirisfal: { label: 'Tirisfal Glades · Undead', palette: palette('#121d25', '#526454', '#394a46', '#293c39', '#1b302e', '#102420', '#1c302b', '#2b4036', '#647751', '#c6d3a3', '#d1e3ad') },
  darnassus: { label: 'Darnassus · Night Elf', palette: palette('#17152f', '#51466e', '#403958', '#302d4d', '#332b51', '#201e3a', '#26263f', '#3b3756', '#7a79a6', '#c8d6ff', '#d8c9ff') },
  elwynn: { label: 'Elwynn Forest · Human', palette: palette('#182f34', '#9eaa77', '#6f8053', '#496240', '#345238', '#203a2a', '#294330', '#4e5940', '#91a361', '#ffe4a9', '#f4e3ad') },
  dunmorogh: { label: 'Dun Morogh · Dwarf / Gnome', palette: palette('#182a44', '#829db3', '#71859a', '#4c647c', '#344f60', '#213b4c', '#9fb5c1', '#698696', '#d4e2e6', '#e6efff', '#d6eaff') },
} as const
export type SceneTheme = keyof typeof sceneThemes
export type ThemePreference = SceneTheme | 'automatic'
export const THEME_STORAGE_KEY = 'ai-zeroth-theme'
export const NEUTRAL_THEME: SceneTheme = 'moonwell'
export function parseThemePreference(value: string | null): ThemePreference {
  return value === 'automatic' || (value !== null && Object.hasOwn(sceneThemes, value)) ? value as ThemePreference : 'automatic'
}
export function themeForRace(race?: string | null): SceneTheme {
  // Skyborne and Undecided have no confirmed starting-zone mapping.
  const mapping: Record<string, SceneTheme> = { Orc: 'durotar', Troll: 'durotar', Tauren: 'mulgore', Undead: 'tirisfal', 'Night Elf': 'darnassus', Human: 'elwynn', Dwarf: 'dunmorogh', Gnome: 'dunmorogh' }
  return race && Object.hasOwn(mapping, race) ? mapping[race] : NEUTRAL_THEME
}
export function resolveTheme(preference: ThemePreference, race?: string | null): SceneTheme {
  return preference === 'automatic' ? themeForRace(race) : preference
}
export function themeStyle(theme: SceneTheme): CSSProperties { return sceneThemes[theme].palette as CSSProperties }
