const MARKETING_SCROLL_GAP = 16

function getMarketingScrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') {
    return 'auto'
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

export function scrollToMarketingHash(hash: `#${string}`) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const targetId = hash.slice(1)
  const target = document.getElementById(targetId)

  if (!target) {
    return
  }

  const scrollTarget = document.querySelector<HTMLElement>(
    `[data-marketing-scroll-target="${targetId}"]`
  ) ?? target
  const header = document.querySelector<HTMLElement>('[data-testid="marketing-header"]')
  const topOffset = (header?.offsetHeight ?? 0) + MARKETING_SCROLL_GAP
  const top = targetId === 'top'
    ? 0
    : Math.max(0, scrollTarget.getBoundingClientRect().top + window.scrollY - topOffset)

  window.history.replaceState(null, '', hash)
  window.scrollTo({
    top,
    behavior: getMarketingScrollBehavior()
  })
}
