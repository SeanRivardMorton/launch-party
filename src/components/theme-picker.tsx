import { useId } from 'react'
import { sceneThemes, type ThemePreference } from '@/lib/scene-themes'
import './theme-picker.css'

export function ThemePicker({ value, onChange, ready }: { value: ThemePreference; onChange: (value: ThemePreference) => void; ready: boolean }) {
  const id = useId()
  return <label className="theme-picker" htmlFor={id}><span className="sr-only">Background scenery</span>
    <select id={id} aria-label="Background scenery" disabled={!ready} value={value} onChange={event => onChange(event.target.value as ThemePreference)}>
      <option value="automatic">Auto · character race</option>
      {Object.entries(sceneThemes).map(([key, theme]) => <option key={key} value={key}>{theme.label}</option>)}
    </select>
  </label>
}
