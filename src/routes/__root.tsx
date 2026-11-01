import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import stylesheet from '../styles.css?url'
import pixelStylesheet from '../pixel-ui.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'ai-zeroth — Your people. Your next adventure.' },
      { name: 'description', content: 'Find your WoW Forever launch crew. Shared play times, complementary professions, and people who get real life. Join the early-access list.' },
      { name: 'theme-color', content: '#081b23' },
    ],
    links: [{ rel: 'stylesheet', href: stylesheet }, { rel: 'stylesheet', href: pixelStylesheet }, { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
  }),
  component: () => <html lang="en"><head><HeadContent /></head><body><Outlet /><Scripts /></body></html>,
  notFoundComponent: () => <main className="container section"><h1>That quest doesn’t exist.</h1><a href="/">Return to the tavern</a></main>,
  errorComponent: () => <main className="container section"><h1>The portal is taking a breather.</h1><p>Please refresh and try again.</p><a href="/">Return home</a></main>,
})
