import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { WorldScene } from '@/components/world-scene'
import { getRoles, needs, professions, type Role } from '@/lib/interest'
import { factions, getClasses, getRaces, raceLabel, type CharacterClass, type Faction, type Race } from '@/lib/character-options'
import { useGuild } from '@/lib/use-guild'

export const Route = createFileRoute('/signup')({
  validateSearch: (search: Record<string, unknown>): { guild?: string } => ({ guild: typeof search.guild === 'string' && search.guild ? search.guild : undefined }),
  component: SignupPage,
})

function SignupPage() {
  const { guild: guildId } = Route.useSearch()
  const { guild, loading: guildLoading, error: guildError, retry: retryGuild } = useGuild(guildId)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [fulfilledRoles, setFulfilledRoles] = useState<Role[]>(['Undecided'])
  const [guildIntent, setGuildIntent] = useState('find')
  const [faction, setFaction] = useState<Faction>('Alliance')
  const [race, setRace] = useState<Race>('Undecided')
  const [characterClass, setCharacterClass] = useState<CharacterClass>('Undecided')
  const availableRoles = getRoles(characterClass)

  useEffect(() => {
    if (guild) { setFaction(guild.faction); setRace('Undecided'); setCharacterClass('Undecided'); setFulfilledRoles(['Undecided']) }
  }, [guild])

  function changeCharacter(nextFaction: Faction, nextRace: Race) {
    const validRace = getRaces(nextFaction).includes(nextRace) ? nextRace : 'Undecided'
    setFaction(nextFaction)
    setRace(validRace)
    if (!getClasses(nextFaction, validRace).includes(characterClass)) changeClass('Undecided')
  }

  function changeClass(nextClass: CharacterClass) {
    setCharacterClass(nextClass)
    const allowed = getRoles(nextClass)
    setFulfilledRoles(current => {
      const valid = current.filter(role => allowed.includes(role))
      return valid.length ? valid : allowed.length === 1 ? [allowed[0]] : ['Undecided']
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step === 2) {
      const selected = new FormData(event.currentTarget).getAll('profession').filter(Boolean)
      if (new Set(selected).size !== selected.length) { setError('Choose two different professions.'); setStatus('error'); return }
    }
    setError('')
    setStatus('idle')
    if (step < 3) { setStep(step + 1); return }
    const form = new FormData(event.currentTarget)
    setStatus('sending')
    setError('')
    try {
      const response = await fetch('/api/interest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), email: String(form.get('email')).trim(), need: form.get('need'), website: form.get('website') || '', consent: form.get('consent') === 'on', faction, race, characterClass, fulfilledRoles, professions: form.getAll('profession').filter(Boolean), guildIntent: guild ? 'find' : guildIntent, guildId: guild?.id, guildConsent: form.get('guildConsent') === 'on' }),
      })
      const result = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Couldn’t save your details. Please try again.')
      setStatus('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection lost. Please try again.')
      setStatus('error')
    }
  }

  if (guildId && (guildLoading || guildError || !guild)) return <main className="site signup-page" data-theme="moonwell"><WorldScene /><section className="signup-card">{guildLoading ? <p role="status">Finding your guild…</p> : <><h2>Guild unavailable.</h2><p className="dialog-description" role="alert">{guildError}</p><Button variant="outline" onClick={retryGuild}>Try again</Button><a className="directory-signup" href="/guilds">Browse other guilds<ArrowRight size={14} /></a></>}</section></main>

  return <main className="site signup-page" data-theme="moonwell">
    <WorldScene />
    <section className="signup-card" aria-labelledby="signup-title">
      {status === 'success' ? <div className="success-state" role="status">
        <span className="success-icon"><CheckCheck size={30} /></span>
        <h2 id="signup-title">{guild ? 'Interest registered.' : 'A place by the fire.'}</h2>
        <p>{guild ? `We’ve saved your interest in joining ${guild.name}. You’re also on the ai-zeroth interest list.` : 'You’re on the ai-zeroth interest list. We’ll email you when there’s news.'}</p>
        {guild ? <a className="button button-primary" href={guild.path}>Back to the guild<ArrowRight size={16} /></a> : guildIntent !== 'later' && <a className="button button-primary" href={guildIntent === 'list' ? '/guilds/new' : '/guilds'}>{guildIntent === 'list' ? 'List my guild' : 'Find a guild'}<ArrowRight size={16} /></a>}
        <a className="button button-primary" href="/">Back to the campfire <ArrowRight size={16} /></a>
      </div> : <>
        <div className="dialog-kicker">AI-ZEROTH <span className="step-count">{step + 1} / 4</span></div>
        {guild && <p className="guild-context">Joining {guild.name} · {guild.faction} · {guild.region}</p>}
        <h2 id="signup-title">{guild && step === 3 ? 'Join the crew.' : ['Save a seat by the fire.', 'Who will you play?', 'What do you bring?', 'Find your people.'][step]}</h2>
        <p className="dialog-description">{guild && step === 3 ? 'Confirm your interest in joining this guild.' : ['Your contact details stay private.', 'Your planned character. Undecided is fine.', 'Choose every role you can fill and up to two primary professions.', 'Choose your next stop after signup.'][step]}</p>
        <form onSubmit={submit}>
          <fieldset hidden={step !== 0} className="field-grid">
            <label>Your name or nickname<Input name="name" autoComplete="nickname" required={step === 0} maxLength={60} /></label>
            <label>Email<Input name="email" type="email" autoComplete="email" required={step === 0} maxLength={254} /></label>
          </fieldset>
          <fieldset hidden={step !== 1} className="field-grid">
            <label>Faction<Select name="faction" value={faction} disabled={Boolean(guild)} onValueChange={value => changeCharacter(value as Faction, race)}>{factions.map(value => <option key={value}>{value}</option>)}</Select></label>
            <label>Race<Select name="race" value={race} onValueChange={value => changeCharacter(faction, value as Race)}>{getRaces(faction).map(value => <option key={value} value={value}>{raceLabel(faction, value)}</option>)}</Select></label>
            <label>Class<Select name="characterClass" value={characterClass} onValueChange={value => changeClass(value as CharacterClass)}>{getClasses(faction, race).map(value => <option key={value}>{value}</option>)}</Select></label>
            {race === 'Skyborne' && <p className="field-hint">Skyborne access requires the Skyborne Heroic Pack or higher.</p>}
          </fieldset>
          <fieldset hidden={step !== 2} className="field-grid">
            <fieldset className="choice-field"><legend>Role(s) I can fulfill</legend><div className="role-choices">{availableRoles.map(role => <label className="check-choice" key={role}><input type="checkbox" checked={fulfilledRoles.includes(role)} disabled={availableRoles.length === 1} onChange={event => {
              if (role === 'Undecided') { setFulfilledRoles(['Undecided']); return }
              const next = event.target.checked ? [...fulfilledRoles.filter(value => value !== 'Undecided'), role] : fulfilledRoles.filter(value => value !== role)
              setFulfilledRoles(next.length ? next : ['Undecided'])
            }} />{role === 'Damage' ? 'Damage (DPS)' : role}</label>)}</div></fieldset>
            {availableRoles.length === 1 && <p className="field-hint">{characterClass} can fulfill the DPS role. It’s selected automatically.</p>}
            <label>First primary profession<Select name="profession" defaultValue=""><option value="">Undecided / none</option>{professions.map(profession => <option key={profession}>{profession}</option>)}</Select></label>
            <label>Second primary profession<Select name="profession" defaultValue=""><option value="">Undecided / none</option>{professions.map(profession => <option key={profession}>{profession}</option>)}</Select></label>
          </fieldset>
          <fieldset hidden={step !== 3} className="field-grid">
            {guild ? <label className="consent"><input name="guildConsent" type="checkbox" required={step === 3} /><span>Register my interest in joining {guild.name}. My signup details stay private.</span></label> : <fieldset className="choice-field"><legend>Guild plans</legend>{[['find', 'Find a guild to join'], ['list', 'List my guild for others to join'], ['later', 'Decide later']].map(([value, label]) => <label className="check-choice" key={value}><input type="radio" name="guildIntent" value={value} checked={guildIntent === value} onChange={() => setGuildIntent(value)} />{label}</label>)}</fieldset>}
            <label>Looking for<Select name="need" defaultValue="A bit of everything">{needs.map(need => <option key={need}>{need}</option>)}</Select></label>
            <label className="consent"><input name="consent" type="checkbox" required={step === 3} /><span>Email me about ai-zeroth. My details stay private. I can ask to be removed any time.</span></label>
          </fieldset>
          <div className="honeypot" aria-hidden="true"><label>Leave empty<Input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          {status === 'error' && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">{step > 0 && <Button type="button" variant="ghost" disabled={status === 'sending'} onClick={() => { setStep(step - 1); setStatus('idle'); setError('') }}><ArrowLeft size={16} />Back</Button>}<Button type="submit" disabled={status === 'sending'}>{step < 3 ? 'Next' : status === 'sending' ? 'Saving your seat…' : 'Count me in'}<ArrowRight size={16} /></Button></div>
        </form>
      </>}
    </section>
  </main>
}
