import { Link, useRouter } from '@tanstack/react-router'
import type { AnchorHTMLAttributes } from 'react'

// Keep normal anchor semantics, but let the router preserve the scene on app links.
// Auth callbacks, assets, external links and downloads still use the browser.
export function AppLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const router = useRouter()
  if (!href.startsWith('/') || href.startsWith('//') || /^\/(api|assets)(\/|$)/.test(href) || props.download !== undefined) return <a href={href} {...props} />
  const url = new URL(href, 'https://app.invalid')
  return <Link to={url.pathname} search={router.options.parseSearch!(url.search)} hash={url.hash.slice(1)} {...props} />
}
