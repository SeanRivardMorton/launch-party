import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

export function SceneNavigation() {
  const router = useRouter()
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => router.update({ defaultViewTransition: !motion.matches })
    update()
    motion.addEventListener('change', update)
    let frame = 0
    const unsubscribe = router.subscribe('onResolved', event => {
      if (event.fromLocation?.pathname === event.toLocation.pathname) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const heading = document.querySelector<HTMLElement>('main h1, main h2')
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
      })
    })
    return () => { motion.removeEventListener('change', update); unsubscribe(); cancelAnimationFrame(frame) }
  }, [router])
  return null
}
