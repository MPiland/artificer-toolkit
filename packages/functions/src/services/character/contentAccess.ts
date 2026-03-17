import type { ContentRef } from '@artificer-toolkit/shared'

export type ContentAccessResult = 'GRANTED' | 'DENIED' | 'REQUIRES_PURCHASE'

/**
 * Checks whether a user has access to a given piece of content.
 *
 * Phase 6.5 stub: always returns GRANTED.
 * Marketplace entitlement enforcement is deferred to a later phase.
 *
 * @param _userId    The user requesting access
 * @param _contentRef The content being accessed
 */
export async function resolveContentAccess(
  _userId: string,
  _contentRef: ContentRef
): Promise<ContentAccessResult> {
  // Phase 6.5: SRD + personal homebrew — always GRANTED
  return 'GRANTED'
}
