import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function GuildInvite({ path, label = 'Guild invite link', buttonText = 'Copy invite link', description = 'Share this link to invite people to your guild’s Launchparty page.' }: { path: string; label?: string; buttonText?: string; description?: string }) {
  const [url, setUrl] = useState(`https://launchparty.thunkoid.com${path}`)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'manual'>('idle')

  useEffect(() => { setUrl(new URL(path, window.location.origin).href); setCopyStatus('idle') }, [path])

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopyStatus('copied') }
    catch { setCopyStatus('manual') }
  }

  return <div className="guild-invite">
    <label>{label}<Input value={url} readOnly onFocus={event => event.currentTarget.select()} /></label>
    <Button type="button" variant="outline" onClick={copy}>{copyStatus === 'copied' ? <Check size={16} /> : <Copy size={16} />}{copyStatus === 'copied' ? 'Link copied' : buttonText}</Button>
    <p className="field-hint" role="status">{copyStatus === 'manual' ? 'Select the link above and copy it to share.' : description}</p>
  </div>
}
