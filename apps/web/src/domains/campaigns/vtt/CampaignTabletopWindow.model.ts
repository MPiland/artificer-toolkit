import type { MouseEvent } from 'react'

export function buildTabletopHref(campaignPublicId: string): string {
  return `/tabletop/campaigns/${encodeURIComponent(campaignPublicId)}`
}

/** The popup features that fill the screen's available area (the part not covered by the taskbar). */
export function buildAuxiliaryWindowFeatures(
  screen: Pick<Screen, 'availHeight' | 'availWidth'> & { availLeft?: number; availTop?: number }
): string {
  return [
    'popup=yes',
    `width=${screen.availWidth}`,
    `height=${screen.availHeight}`,
    `left=${screen.availLeft ?? 0}`,
    `top=${screen.availTop ?? 0}`,
    'resizable=yes',
    'scrollbars=yes'
  ].join(',')
}

export function openAuxiliaryWindow(
  event: MouseEvent<HTMLAnchorElement>,
  windowName: string
): void {
  if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return
  }

  const opened = window.open(
    event.currentTarget.href,
    windowName,
    buildAuxiliaryWindowFeatures(window.screen)
  )
  if (!opened) return

  event.preventDefault()
  opened.opener = null
  opened.focus()
}

export function tabletopWindowName(campaignPublicId: string): string {
  return `artificer-tabletop-${safeWindowName(campaignPublicId)}`
}

function safeWindowName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}
