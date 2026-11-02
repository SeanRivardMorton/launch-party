import type { ReactNode } from 'react'
import { WorldScene } from '@/components/world-scene'
import { AuthNav } from '@/components/auth-nav'
import { AppLink } from './app-link'
import { ScenePanel } from './scene-panel'

export function AccountShell({ children }: { children: ReactNode }) {
  return <div className="site account-page">
    <WorldScene />
    <header className="site-header"><AppLink className="brand" href="/" aria-label="ai-zeroth home"><span className="brand-rune" aria-hidden="true">✧</span><span>ai-zeroth</span></AppLink><AuthNav /></header>
    <main className="account-main"><ScenePanel className="signup-card account-card" aria-labelledby="account-title">{children}</ScenePanel></main>
  </div>
}
