import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { needCategories, recruitmentOptions, type RecruitmentNeed } from '@/lib/guilds'

export function GuildNeedsEditor({ needs, onChange, disabled = false }: { needs: RecruitmentNeed[]; onChange: (needs: RecruitmentNeed[]) => void; disabled?: boolean }) {
  function add(name = '', category: RecruitmentNeed['category'] = 'Other') {
    if (needs.length < 12) onChange([...needs, { name, category, quantity: 1, notes: '' }])
  }

  function update(index: number, value: Partial<RecruitmentNeed>) {
    onChange(needs.map((need, position) => position === index ? { ...need, ...value } : need))
  }

  return <fieldset className="needs-editor" disabled={disabled}>
    <legend>What is your guild missing?</legend>
    <p className="field-hint">Add roles, classes, professions or other gaps. Leave this empty if you’re open to everyone.</p>
    <div className="needs-option-groups">{recruitmentOptions.map(group => <fieldset className="needs-option-group" key={group.category}>
      <legend>{group.label}</legend>
      <div className="needs-suggestions">{group.names.map(name => <Button key={name} type="button" variant="outline" size="sm" disabled={needs.length >= 12} onClick={() => add(name, group.category)}><Plus size={12} />{name}</Button>)}</div>
    </fieldset>)}</div>
    <div className="needs-editor-list">{needs.map((need, index) => <div className="need-edit-row" key={index}>
      <div className="need-edit-heading"><span>Need {index + 1}</span><button type="button" className="remove-need" aria-label={`Remove need ${index + 1}`} onClick={() => onChange(needs.filter((_, position) => position !== index))}><Trash2 size={16} /></button></div>
      <label>Need {index + 1} name<Input value={need.name} onChange={event => update(index, { name: event.target.value })} placeholder="e.g. Off-tank or Guild enchanter" required minLength={2} maxLength={80} /></label>
      <div className="directory-filters"><label>Need {index + 1} category<select value={need.category} onChange={event => update(index, { category: event.target.value as RecruitmentNeed['category'] })}>{needCategories.map(category => <option key={category}>{category}</option>)}</select></label><label>Need {index + 1} quantity<Input type="number" min={1} max={40} required value={need.quantity} onChange={event => update(index, { quantity: Number(event.target.value) })} /></label></div>
      <label>Need {index + 1} notes (optional)<Input value={need.notes} onChange={event => update(index, { notes: event.target.value })} maxLength={160} placeholder="e.g. Casual raid nights, happy to help you learn" /></label>
    </div>)}</div>
    <Button type="button" variant="outline" disabled={needs.length >= 12} onClick={() => add()}><Plus size={15} />Add custom need</Button>
    <p className="field-hint">{needs.length} / 12 needs listed</p>
  </fieldset>
}
