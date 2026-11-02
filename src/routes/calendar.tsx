import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { PrivatePage } from '@/components/private-page'
import { Button } from '@/components/ui/button'
import { requirePageAccount } from '@/lib/private-page'

export const Route = createFileRoute('/calendar')({
  beforeLoad: () => requirePageAccount('/calendar'),
  staleTime: 0,
  head: () => ({ meta: [{ title: 'Calendar · ai-zeroth' }, { name: 'robots', content: 'noindex' }] }),
  component: () => <PrivatePage title="Your calendar." path="/calendar">{() => <Calendar />}</PrivatePage>,
})

function Calendar() {
  const [month, setMonth] = useState<Date | null>(null)
  const [today, setToday] = useState('')
  useEffect(() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setToday(`${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`) }, [])
  if (!month) return <p role="status">Opening your calendar…</p>
  const year = month.getFullYear(), index = month.getMonth()
  const start = (month.getDay() + 6) % 7
  const days = new Date(year, index + 1, 0).getDate()
  const weeks = Math.ceil((start + days) / 7)
  return <section className="month-calendar" aria-label="Month calendar"><div className="calendar-controls"><Button variant="ghost" aria-label="Previous month" onClick={() => setMonth(new Date(year, index - 1, 1))}>←</Button><h2 aria-live="polite">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2><Button variant="ghost" aria-label="Next month" onClick={() => setMonth(new Date(year, index + 1, 1))}>→</Button></div><table><caption className="sr-only">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</caption><thead><tr>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <th scope="col" key={day}>{day}</th>)}</tr></thead><tbody>{Array.from({ length: weeks }, (_, week) => <tr key={week}>{Array.from({ length: 7 }, (_, day) => { const date = week * 7 + day - start + 1; return <td key={day} aria-current={`${year}-${index}-${date}` === today ? 'date' : undefined}>{date > 0 && date <= days ? date : ''}</td> })}</tr>)}</tbody></table><p className="account-note">Browse the calendar to plan with your crew. Guild event scheduling isn’t available yet.</p><a href="/guild">Open your guild halls</a></section>
}
