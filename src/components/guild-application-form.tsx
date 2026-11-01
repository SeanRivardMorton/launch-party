import { useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getClasses, getRaces, raceLabel, type Race, type CharacterClass } from '@/lib/character-options'
import { getRoles, professions, type Role } from '@/lib/interest'
import { guildCharacterSchema, type GuildCharacterProfile } from '@/lib/guild-community'
import type { Guild } from '@/lib/guilds'
import './guild-community.css'

export function GuildApplicationForm({ guild, initialProfile, submitLabel = 'Send application', onSubmit, introduction = true }: {
  guild: Guild; initialProfile?: GuildCharacterProfile; submitLabel?: string
  onSubmit: (profile: GuildCharacterProfile, introduction: string) => Promise<void>; introduction?: boolean
}) {
  const [profile, setProfile] = useState<GuildCharacterProfile>(() => {
    const race = initialProfile && getRaces(guild.faction).includes(initialProfile.race) ? initialProfile.race : 'Undecided'
    const characterClass = initialProfile && getClasses(guild.faction, race).includes(initialProfile.characterClass) ? initialProfile.characterClass : 'Undecided'
    const allowed = getRoles(characterClass)
    const selected = initialProfile?.fulfilledRoles.filter(role => allowed.includes(role)) || []
    return { nickname: initialProfile?.nickname || '', faction: guild.faction, race, characterClass, fulfilledRoles: selected.length ? selected : allowed.length === 1 ? [allowed[0]] : ['Undecided'], professions: initialProfile?.professions || [] }
  })
  const [professionChoices, setProfessionChoices] = useState([initialProfile?.professions[0] || '', initialProfile?.professions[1] || ''])
  const [text, setText] = useState('')
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const id = useId()
  const allowed = getRoles(profile.characterClass)

  function changeClass(characterClass: CharacterClass, race = profile.race) {
    const roles = getRoles(characterClass)
    const valid = profile.fulfilledRoles.filter(role => roles.includes(role))
    setProfile({ ...profile, race, characterClass, fulfilledRoles: valid.length ? valid : roles.length === 1 ? [roles[0]] : ['Undecided'] })
  }
  function move(next: number) { setStep(next); setError(''); requestAnimationFrame(() => heading.current?.focus()) }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (step === 0) {
      if (!profile.nickname.trim()) { setError('Enter your nickname.'); return }
      move(1); return
    }
    const result = guildCharacterSchema.safeParse({ ...profile, professions: professionChoices.filter(Boolean) })
    if (!result.success) { setError(result.error.issues[0]?.message || 'Check your character choices.'); return }
    setBusy(true)
    try { await onSubmit(result.data, introduction ? text.trim() : '') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Couldn’t save. Check your connection and try again.') }
    finally { setBusy(false) }
  }

  return <form onSubmit={submit} aria-labelledby={id}>
    <div className="dialog-kicker">YOUR CHARACTER <span className="step-count">{step + 1} / 2</span></div>
    <h3 ref={heading} tabIndex={-1} id={id}>{step === 0 ? 'Who will you play?' : 'What do you bring?'}</h3>
    <fieldset disabled={busy} hidden={step !== 0} className="field-grid">
      <label>Nickname<Input autoComplete="nickname" required={step === 0} maxLength={60} value={profile.nickname} onChange={event => setProfile({ ...profile, nickname: event.target.value })} /></label>
      <label>Faction<select disabled value={guild.faction}><option>{guild.faction}</option></select></label>
      <label>Race<select value={profile.race} onChange={event => { const race = event.target.value as Race; changeClass(getClasses(guild.faction, race).includes(profile.characterClass) ? profile.characterClass : 'Undecided', race) }}>{getRaces(guild.faction).map(race => <option value={race} key={race}>{raceLabel(guild.faction, race)}</option>)}</select></label>
      <label>Class<select value={profile.characterClass} onChange={event => changeClass(event.target.value as CharacterClass)}>{getClasses(guild.faction, profile.race).map(value => <option key={value}>{value}</option>)}</select></label>
      {profile.race === 'Skyborne' && <p className="field-hint">Skyborne access requires the Skyborne Heroic Pack or higher.</p>}
    </fieldset>
    <fieldset disabled={busy} hidden={step !== 1} className="field-grid">
      <fieldset className="choice-field"><legend>Roles I can fulfill</legend><div className="role-choices">{allowed.map(role => <label className="check-choice" key={role}><input type="checkbox" checked={profile.fulfilledRoles.includes(role)} disabled={allowed.length === 1} onChange={event => {
        const selected: Role[] = role === 'Undecided' ? ['Undecided'] : event.target.checked ? [...profile.fulfilledRoles.filter(value => value !== 'Undecided'), role] : profile.fulfilledRoles.filter(value => value !== role)
        setProfile({ ...profile, fulfilledRoles: selected.length ? selected : ['Undecided'] })
      }} />{role === 'Damage' ? 'Damage (DPS)' : role}</label>)}</div></fieldset>
      {allowed.length === 1 && <p className="field-hint">DPS is selected automatically for {profile.characterClass}.</p>}
      {[0, 1].map(index => <label key={index}>{index === 0 ? 'First' : 'Second'} primary profession<select value={professionChoices[index]} onChange={event => setProfessionChoices(current => current.map((value, position) => position === index ? event.target.value : value))}><option value="">Undecided / none</option>{professions.map(value => <option key={value}>{value}</option>)}</select></label>)}
      {introduction && <label>Introduction (optional)<textarea className="input" maxLength={280} value={text} onChange={event => setText(event.target.value)} /><span className="field-hint">{text.length} / 280 · Shared with guild leadership.</span></label>}
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions">{step > 0 && <Button type="button" variant="ghost" disabled={busy} onClick={() => move(0)}>← Back</Button>}<Button type="submit" disabled={busy}>{busy ? 'Saving…' : step === 0 ? 'Next →' : submitLabel}</Button></div>
  </form>
}
