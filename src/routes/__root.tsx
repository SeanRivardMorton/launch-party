import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import stylesheet from '../styles.css?url'
import pixelStylesheet from '../pixel-ui.css?url'
import { SceneThemeProvider } from '@/components/use-scene-theme'
import { SceneNavigation } from '@/components/scene-navigation'
import transitionStylesheet from '@/components/scene-transitions.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'ai-zeroth — Your people. Your next adventure.' },
      { name: 'description', content: 'Your characters, your guild, your next adventure. Meet your WoW Forever crew around the campfire.' },
      { name: 'theme-color', content: '#081b23' },
    ],
    links: [{ rel: 'stylesheet', href: stylesheet }, { rel: 'stylesheet', href: pixelStylesheet }, { rel: 'stylesheet', href: transitionStylesheet }, { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
  }),
  component: () => <html lang="en"><head><HeadContent /></head><body><SceneThemeProvider><SceneNavigation /><Outlet /></SceneThemeProvider><Scripts /></body></html>,
  notFoundComponent: () => <main className="container section"><h1>That quest doesn’t exist.</h1><a href="/">Return to the tavern</a></main>,
  errorComponent: () => <main className="container section"><h1>The portal is taking a breather.</h1><p>Please refresh and try again.</p><a href="/">Return home</a></main>,
})
