import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowRight, Plus, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { ThemePicker } from '@/components/theme-picker'
import { useSceneTheme } from '@/components/use-scene-theme'
import { PixelCharacter } from '@/components/pixel-character'
import { WorldScene } from '@/components/world-scene'
import { AuthNav } from '@/components/auth-nav'

export const Route = createFileRoute('/')({ component: LandingPage })

const adventurers = [
  { kind: 'warrior' as const, name: 'Thrag', role: 'Tank', profession: 'Leatherworker' },
  { kind: 'priest' as const, name: 'Elowen', role: 'Healer', profession: 'Enchanter' },
  { kind: 'mage' as const, name: 'Fenn', role: 'Damage', profession: 'Alchemist' },
]

function LandingPage() {
  const { theme, preference, choose, style, ready } = useSceneTheme()
  const [selected, setSelected] = useState(0)

  return <div className="site" data-theme={theme} style={style}>
    <WorldScene theme={theme} />
    <div className="screen-grain" aria-hidden="true" />
    <header className="site-header">
      <a className="brand" href="/" aria-label="ai-zeroth home"><span className="brand-rune" aria-hidden="true">✧</span></a>
      <div className="header-right"><AuthNav /><a className="button button-ghost button-sm" href="/guilds" aria-label="Browse guilds"><Users size={18} /></a><ThemePicker value={preference} onChange={choose} ready={ready} /><a className="header-link" href="https://worldofwarcraft.blizzard.com/en-gb/forever" target="_blank" rel="noreferrer" aria-label="For WoW Forever"><ArrowRight size={13} /></a></div>
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
