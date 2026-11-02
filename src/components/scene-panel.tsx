import { useEffect, useRef, type HTMLAttributes } from 'react'

export function ScenePanel({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) {
  const panel = useRef<HTMLElement>(null)
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const outer = panel.current!, inner = content.current!
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    let animation: Animation | undefined
    let previousHeight = 0, previousWidth = 0
    let alignedHash = ''
    const stop = () => { animation?.cancel(); animation = undefined; outer.removeAttribute('data-resizing') }
    const alignHash = () => {
      if (!location.hash || alignedHash === location.hash) return
      let target: HTMLElement | null
      try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))) } catch { return }
      if (!target || !inner.contains(target)) return
      alignedHash = location.hash
      // Async content may have tried to scroll while the frame was still short.
      // Restore that initial anchor after expansion, once per hash in this panel.
      target.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
    const measure = () => {
      const style = getComputedStyle(outer), before = getComputedStyle(outer, '::before')
      const px = (value: string) => parseFloat(value) || 0
      const ornament = before.content === 'none' || before.display === 'none' ? 0 : px(before.height) + px(before.marginTop) + px(before.marginBottom)
      const box = inner.getBoundingClientRect()
      const height = box.height + ornament + px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth)
      const from = animation ? outer.getBoundingClientRect().height : previousHeight
      const canAnimate = previousHeight > 0 && Math.abs(box.width - previousWidth) < 1 && Math.abs(height - from) > 1 && !motion.matches
      previousHeight = height; previousWidth = box.width
      stop()
      if (!canAnimate || typeof outer.animate !== 'function') return
      outer.setAttribute('data-resizing', '')
      animation = outer.animate([{ height: `${from}px` }, { height: `${height}px` }], { duration: 280, easing: 'cubic-bezier(.22, 1, .36, 1)' })
      const current = animation
      current.finished.then(() => { if (animation === current) { stop(); alignHash() } }).catch(() => {})
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(inner)
    motion.addEventListener('change', stop)
    return () => { observer.disconnect(); motion.removeEventListener('change', stop); stop() }
  }, [])
  return <section {...props} ref={panel} className={`scene-panel ${className}`}><div ref={content} className="scene-panel-content">{children}</div></section>
}
