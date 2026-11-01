import { useId } from 'react'
import type { RecruitmentNeed } from '@/lib/guilds'

export function GuildNeeds({ needs, compact = false }: { needs: RecruitmentNeed[]; compact?: boolean }) {
  const titleId = useId()
  const shown = compact ? needs.slice(0, 3) : needs
  return <section className={`guild-needs ${compact ? 'guild-needs-compact' : ''}`} aria-labelledby={titleId}>
    <h3 id={titleId}>What we’re missing</h3>
    {needs.length ? <>
      <ul>{shown.map((need, index) => <li key={index}>
        <div className="need-summary"><span className="need-quantity">{need.quantity}×</span><strong>{need.name}</strong><span className="need-category">{need.category}</span></div>
        {!compact && need.notes && <p className="need-notes">{need.notes}</p>}
      </li>)}</ul>
      {compact && needs.length > shown.length && <p className="field-hint">+{needs.length - shown.length} more on the guild page</p>}
    </> : <p className="field-hint">No specific needs listed yet. Let the guild know what you’d like to play.</p>}
  </section>
}
