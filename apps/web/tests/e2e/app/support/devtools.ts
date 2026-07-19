import type { Page } from '@playwright/test'

const DEVTOOL_LAUNCHER_CSS = `
  tanstack-query-devtools,
  tanstack-router-devtools,
  .tsqd-open-btn-container,
  [data-testid*="tanstack"][data-testid*="devtools"],
  button[aria-label*="Open TanStack Query Devtools" i],
  button[aria-label*="Open TanStack Router Devtools" i] {
    display: none !important;
  }
`

export async function installDevtoolLauncherHiding(page: Page): Promise<void> {
  await page.context().addInitScript((css) => {
    const installStyle = (root: Document | ShadowRoot) => {
      if (root.getElementById('mvp-e2e-devtool-hiding')) return

      const style = document.createElement('style')
      style.id = 'mvp-e2e-devtool-hiding'
      style.textContent = css
      if (root instanceof Document) {
        ;(root.head ?? root.documentElement).append(style)
      } else {
        root.append(style)
      }
    }

    const attachShadow = Object.getOwnPropertyDescriptor(Element.prototype, 'attachShadow')
      ?.value as Element['attachShadow'] | undefined
    if (attachShadow) {
      Element.prototype.attachShadow = function (init) {
        const root = Reflect.apply(attachShadow, this, [init])
        installStyle(root)
        return root
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => installStyle(document), { once: true })
    } else {
      installStyle(document)
    }
  }, DEVTOOL_LAUNCHER_CSS)
}
