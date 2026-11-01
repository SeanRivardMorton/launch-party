import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WorldScene } from '@/components/world-scene'
import { GuildInvite } from '@/components/guild-invite'
import { factions } from '@/lib/interest'
import { regions } from '@/lib/guilds'

export const Route = createFileRoute('/guilds/new')({ component: ListGuild })

function ListGuild() {
  const [step, setStep] = useState(0)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [path, setPath] = useState('')
  const submissionId = useRef<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step === 0) { setStep(1); return }
    const form = new FormData(event.currentTarget)
    submissionId.current ||= crypto.randomUUID()
    setStatus('sending')
    setError('')
    try {
      const response = await fetch('/api/guilds', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), faction: form.get('faction'), region: form.get('region'), description: form.get('description'), submissionId: submissionId.current, publishConsent: form.get('publishConsent') === 'on', website: form.get('website') || '' }),
      })
      const result = await response.json() as { success?: boolean; path?: string; error?: string }
      if (!response.ok || !result.success || !result.path) throw new Error(result.error || 'Couldn’t publish your guild. Please try again.')
      setPath(result.path)
      setStatus('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection lost. Please try again.')
      setStatus('error')
    }
  }

  return <main className="site signup-page" data-theme="moonwell">
    <WorldScene />
    <section className="signup-card" aria-labelledby="list-guild-title">
      {status === 'success' ? <div className="success-state"><span className="success-icon"><CheckCheck size={30} /></span><h2 id="list-guild-title">Your party is forming.</h2><p>Your guild now has its own Launchparty page. Share your invite link so people can learn about your crew and register interest in joining.</p><GuildInvite path={path} /><a className="button button-primary" href={path}>View my guild<ArrowRight size={16} /></a></div> : <>
        <nav className="guild-nav"><a href="/guilds"><ArrowLeft size={16} />Guild directory</a></nav>
        <div className="dialog-kicker">LIST YOUR GUILD <span className="step-count">{step + 1} / 2</span></div>
        <h2 id="list-guild-title">{step === 0 ? 'Make room at the fire.' : 'Invite your next crew.'}</h2>
        <p className="dialog-description">{step === 0 ? 'Help prospective members find your guild.' : 'Tell people about your crew. We’ll create your guild page and invite link.'}</p>
        <form onSubmit={submit}>
          <fieldset hidden={step !== 0} className="field-grid">
            <label>Guild name<Input name="name" required={step === 0} minLength={2} maxLength={80} /></label>
            <div className="directory-filters"><label>Faction<select name="faction">{factions.map(value => <option key={value}>{value}</option>)}</select></label><label>Region<select name="region">{regions.map(value => <option key={value}>{value}</option>)}</select></label></div>
          </fieldset>
          <fieldset hidden={step !== 1} className="field-grid">
            <label>About your guild<textarea className="input" name="description" rows={4} required={step === 1} minLength={10} maxLength={600} placeholder="Play style, usual times, roles you’re recruiting…" /></label>
            <p className="field-hint">Your shareable invite link is generated automatically when you publish.</p>
            <label className="consent"><input name="publishConsent" type="checkbox" required={step === 1} /><span>I’m authorised to list this guild. Publish these guild details on a public Launchparty page.</span></label>
          </fieldset>
          <div className="honeypot" aria-hidden="true"><label>Leave empty<Input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          {status === 'error' && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">{step === 1 && <Button type="button" variant="ghost" disabled={status === 'sending'} onClick={() => { setStep(0); setStatus('idle'); setError('') }}><ArrowLeft size={16} />Back</Button>}<Button type="submit" disabled={status === 'sending'}>{step === 0 ? 'Next' : status === 'sending' ? 'Publishing…' : 'Publish guild'}<ArrowRight size={16} /></Button></div>
        </form>
      </>}
    </section>
  </main>
}
