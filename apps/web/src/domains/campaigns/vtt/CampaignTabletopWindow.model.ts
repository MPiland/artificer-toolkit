import type { MouseEvent } from 'react'

export function buildTabletopHref(campaignPublicId: string): string {
  return `/tabletop/campaigns/${encodeURIComponent(campaignPublicId)}`
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
    'popup=yes,width=1440,height=900,resizable=yes,scrollbars=yes'
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
