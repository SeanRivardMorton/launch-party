import type { ReactNode } from 'react'
import { WorldScene } from '@/components/world-scene'
import { AuthNav } from '@/components/auth-nav'

export function AccountShell({ children }: { children: ReactNode }) {
  return <div className="site account-page" data-theme="moonwell">
    <WorldScene />
    <header className="site-header"><a className="brand" href="/" aria-label="ai-zeroth home"><span className="brand-rune" aria-hidden="true">✧</span><span>ai-zeroth</span></a><AuthNav /></header>
    <main className="account-main"><section className="signup-card account-card" aria-labelledby="account-title">{children}</section></main>
  </div>
}
