import type { QueryClient } from '@tanstack/react-query'
import { clearPrivateContentSnapshots } from '#app/data/contentSnapshots/privateContent'

/** Enters the app after a session starts in this browser: one document load with no prior identity's data. */
export async function openSignedInDocument(queryClient: QueryClient, href: string) {
  queryClient.clear()
  // Another account may have left private content snapshots in this browser.
  await clearPrivateContentSnapshots()
  window.location.assign(href)
}
