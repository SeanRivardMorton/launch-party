import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowRight, Moon, Plus, Sun, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { PixelCharacter } from '@/components/pixel-character'
import { WorldScene } from '@/components/world-scene'

export const Route = createFileRoute('/')({ component: LandingPage })

const adventurers = [
  { kind: 'warrior' as const, name: 'Thrag', role: 'Tank', profession: 'Leatherworker' },
  { kind: 'priest' as const, name: 'Elowen', role: 'Healer', profession: 'Enchanter' },
  { kind: 'mage' as const, name: 'Fenn', role: 'Damage', profession: 'Alchemist' },
]

function LandingPage() {
  const [theme, setTheme] = useState('moonwell')
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    try { const stored = localStorage.getItem('ai-zeroth-theme'); if (stored === 'moonwell' || stored === 'tavern') setTheme(stored) } catch { /* Storage is optional. */ }
  }, [])

  function toggleTheme() {
    const next = theme === 'tavern' ? 'moonwell' : 'tavern'
    setTheme(next)
    try { localStorage.setItem('ai-zeroth-theme', next) } catch { /* Storage is optional. */ }
  }

  return <div className="site" data-theme={theme}>
    <WorldScene />
    <div className="screen-grain" aria-hidden="true" />
    <header className="site-header">
      <a className="brand" href="/" aria-label="ai-zeroth home"><span className="brand-rune" aria-hidden="true">✧</span></a>
      <div className="header-right"><a className="button button-ghost button-sm" href="/guilds" aria-label="Browse guilds"><Users size={18} /></a><Button variant="ghost" size="sm" onClick={toggleTheme} aria-label={`Switch to ${theme === 'tavern' ? 'moonwell' : 'tavern'} theme`}>{theme === 'tavern' ? <Moon size={16} /> : <Sun size={16} />}</Button><a className="header-link" href="https://worldofwarcraft.blizzard.com/en-gb/forever" target="_blank" rel="noreferrer" aria-label="For WoW Forever"><ArrowRight size={13} /></a></div>
    </header>

    <main className="world" id="main">
      <div className="presentation-signup">
        <a className="signup-qr" href="/signup" aria-label="Sign up for ai-zeroth. Scan this code on your phone or open the signup page.">
          <QRCodeSVG value="https://launchparty.thunkoid.com/signup" size={400} level="M" marginSize={4} bgColor="#ffffff" fgColor="#000000" />
        </a>
      </div>
      <section className="camp" aria-label="Illustrative adventurers. Select a character to meet the crew.">
        <div className="adventurer-lineup">
          {adventurers.map((character, index) => <button key={character.kind} className={`adventurer adventurer-${character.kind} ${selected === index ? 'is-selected' : ''}`} onClick={() => setSelected(index)} aria-label={`Meet ${character.name}, ${character.role}, ${character.profession}`} aria-pressed={selected === index}>
            <PixelCharacter kind={character.kind} />
          </button>)}
          <div className="open-slot" aria-hidden="true"><span className="slot-beacon" /><span className="slot-outline"><Plus size={23} strokeWidth={1} /></span></div>
        </div>
      </section>
    </main>
  </div>
}
