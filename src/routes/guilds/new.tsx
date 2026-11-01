import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { WorldScene } from '@/components/world-scene'
import { GuildInvite } from '@/components/guild-invite'
import { GuildNeedsEditor } from '@/components/guild-needs-editor'
import { factions } from '@/lib/interest'
import { regions, type RecruitmentNeed } from '@/lib/guilds'
import { createManagementKey, saveGuildManagementKey } from '@/lib/guild-management'
import { GuildAuthGate } from '@/components/guild-account-panel'

export const Route = createFileRoute('/guilds/new')({ component: ListGuild })

function ListGuild() {
  const [step, setStep] = useState(0)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [path, setPath] = useState('')
  const [needs, setNeeds] = useState<RecruitmentNeed[]>([])
  const submissionId = useRef<string | null>(null)
  const managementKey = useRef<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < 2) { setStep(step + 1); return }
    const form = new FormData(event.currentTarget)
    submissionId.current ||= crypto.randomUUID()
    managementKey.current ||= createManagementKey()
    setStatus('sending')
    setError('')
    try {
      const response = await fetch('/api/guilds', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), faction: form.get('faction'), region: form.get('region'), description: form.get('description'), recruitmentNeeds: needs, managementKey: managementKey.current, submissionId: submissionId.current, publishConsent: form.get('publishConsent') === 'on', website: form.get('website') || '' }),
      })
      const result = await response.json() as { success?: boolean; path?: string; managementPath?: string; error?: string }
      if (!response.ok || !result.success || !result.path) throw new Error(result.error || 'Couldn’t publish your guild. Please try again.')
      setPath(result.path)
      if (result.managementPath) {
        saveGuildManagementKey(submissionId.current, managementKey.current)
      }
      setStatus('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection lost. Please try again.')
      setStatus('error')
    }
  }

  return <GuildAuthGate title="Sign in to lead a guild"><main className="site signup-page" data-theme="moonwell">
    <WorldScene />
    <section className="signup-card" aria-labelledby="list-guild-title">
      {status === 'success' ? <div className="success-state"><span className="success-icon"><CheckCheck size={30} /></span><h2 id="list-guild-title">Your party is forming.</h2><p>Your guild now has its own Launchparty page. Share your invite link so people can learn about your crew and apply to join.</p><GuildInvite path={path} /><p>Your account is the guild lead. Open the guild hall to review applicants, appoint officers and manage plans.</p><a className="button button-primary" href={`${path}/manage`}>Open guild hall<ArrowRight size={16} /></a><a className="directory-signup" href={path}>View my guild<ArrowRight size={14} /></a></div> : <>
        <nav className="guild-nav"><a href="/guilds"><ArrowLeft size={16} />Guild directory</a></nav>
        <div className="dialog-kicker">LIST YOUR GUILD <span className="step-count">{step + 1} / 3</span></div>
        <h2 id="list-guild-title">{['Make room at the fire.', 'Invite your next crew.', 'What’s your party missing?'][step]}</h2>
        <p className="dialog-description">{['Help prospective members find your guild.', 'Tell people about your crew. We’ll create your guild page and invite link.', 'Help newcomers choose a class, role or profession your crew needs.'][step]}</p>
        <form onSubmit={submit}>
          <fieldset hidden={step !== 0} className="field-grid">
            <label>Guild name<Input name="name" required={step === 0} minLength={2} maxLength={80} /></label>
            <div className="directory-filters"><label>Faction<Select name="faction">{factions.map(value => <option key={value}>{value}</option>)}</Select></label><label>Region<Select name="region">{regions.map(value => <option key={value}>{value}</option>)}</Select></label></div>
          </fieldset>
          <fieldset hidden={step !== 1} className="field-grid">
            <label>About your guild<textarea className="input" name="description" rows={4} required={step === 1} minLength={10} maxLength={600} placeholder="Play style, usual times, roles you’re recruiting…" /></label>
          </fieldset>
          <fieldset hidden={step !== 2}>
            <GuildNeedsEditor needs={needs} onChange={setNeeds} disabled={step !== 2 || status === 'sending'} />
            <p className="field-hint">Your invite link and authenticated guild hall are created when you publish.</p>
            <p className="field-hint">You’ll become this guild’s lead and can appoint officers from the guild hall.</p>
            <label className="consent"><input name="publishConsent" type="checkbox" required={step === 2} /><span>I’m authorised to list this guild. Publish these guild details and recruitment needs on a public Launchparty page.</span></label>
          </fieldset>
          <div className="honeypot" aria-hidden="true"><label>Leave empty<Input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          {status === 'error' && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">{step > 0 && <Button type="button" variant="ghost" disabled={status === 'sending'} onClick={() => { setStep(step - 1); setStatus('idle'); setError('') }}><ArrowLeft size={16} />Back</Button>}<Button type="submit" disabled={status === 'sending'}>{step < 2 ? 'Next' : status === 'sending' ? 'Publishing…' : 'Publish guild'}<ArrowRight size={16} /></Button></div>
        </form>
      </>}
    </section>
  </main></GuildAuthGate>
}
