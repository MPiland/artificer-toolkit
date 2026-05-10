const MARKETING_SCROLL_GAP = 16
const MARKETING_SCROLL_ROOT_SELECTOR = '[data-marketing-scroll-root="true"]'

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
  const scrollRoot = document.querySelector<HTMLElement>(MARKETING_SCROLL_ROOT_SELECTOR)
  const top = targetId === 'top'
    ? 0
    : getScrollTop({
        scrollRoot,
        scrollTarget,
        topOffset
      })

  window.history.replaceState(null, '', hash)
  scrollToMarketingTarget(scrollRoot, top)
}

function getScrollTop({
  scrollRoot,
  scrollTarget,
  topOffset
}: {
  scrollRoot: HTMLElement | null
  scrollTarget: HTMLElement
  topOffset: number
}) {
  if (!scrollRoot) {
    return Math.max(0, scrollTarget.getBoundingClientRect().top + window.scrollY - topOffset)
  }

  return Math.max(0, scrollRoot.scrollTop
    + scrollTarget.getBoundingClientRect().top
    - scrollRoot.getBoundingClientRect().top
    - topOffset)
}

function scrollToMarketingTarget(scrollRoot: HTMLElement | null, top: number) {
  const scrollOptions: ScrollToOptions = {
    top,
    behavior: getMarketingScrollBehavior()
  }

  if (scrollRoot) {
    scrollRoot.scrollTo(scrollOptions)
    return
  }

  window.scrollTo(scrollOptions)
}
