import type { Page } from '@playwright/test'

type AuditNavigation = {
  finalUrl: string
  responseStatus: number | null
  prerequisite?: string
}

export async function navigateForMvpAudit(page: Page, path: string): Promise<AuditNavigation> {
  let responseStatus: number | null = null

  try {
    const response = await page.goto(path, {
      timeout: 30_000,
      waitUntil: 'domcontentloaded'
    })
    responseStatus = response?.status() ?? null
  } catch (error) {
    return {
      finalUrl: page.url(),
      prerequisite: `The local app could not load ${path}: ${error instanceof Error ? error.message : String(error)}`,
      responseStatus
    }
  }

  try {
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
  } catch {
    // The audit records the long-lived requests; a permanently busy dev server should not hide the DOM.
  }

  const finalUrl = page.url()
  const pathname = new URL(finalUrl).pathname
  if (/\/(?:auth|sign-in|sign-up|reset-password)(?:\/|$)/.test(pathname)) {
    return {
      finalUrl,
      prerequisite:
        'Authentication is required. Set MVP_AUDIT_STORAGE_STATE to an authenticated Playwright storage state.',
      responseStatus
    }
  }

  const bodyText = await page
    .locator('body')
    .innerText()
    .catch(() => '')
  if (bodyText.includes('A system is required before creating characters')) {
    return {
      finalUrl,
      prerequisite:
        'No seeded system data is available. Seed a local system before running the MVP audit.',
      responseStatus
    }
  }

  return { finalUrl, responseStatus }
}
