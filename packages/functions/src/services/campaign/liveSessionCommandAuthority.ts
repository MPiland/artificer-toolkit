import { createLiveSessionCommandLeaseRepository, type DBLike } from '@artificer-toolkit/db'

export const LIVE_SESSION_COMMAND_LEASE_DURATION_MS = 30_000
export const LIVE_SESSION_COMMAND_LEASE_RENEWAL_MS = 10_000

export interface LiveSessionCommandAuthority {
  sessionId: string
  authorityId: string
}

export class LiveSessionCommandAuthorityError extends Error {
  constructor(message = 'This aggregate is controlled by its active live-session room.') {
    super(message)
    this.name = 'LiveSessionCommandAuthorityError'
  }
}

function leaseWindow(now = new Date()) {
  return {
    now: now.toISOString(),
    expiresAt: new Date(now.getTime() + LIVE_SESSION_COMMAND_LEASE_DURATION_MS).toISOString()
  }
}

export async function claimLiveSessionCommandAuthority(
  db: DBLike,
  authority: LiveSessionCommandAuthority
): Promise<void> {
  const claimed = await createLiveSessionCommandLeaseRepository(db).claim({
    ...authority,
    ...leaseWindow()
  })
  if (!claimed) {
    throw new LiveSessionCommandAuthorityError(
      'Another live-session room already controls this Campaign session.'
    )
  }
}

export async function renewLiveSessionCommandAuthority(
  db: DBLike,
  authority: LiveSessionCommandAuthority
): Promise<void> {
  const renewed = await createLiveSessionCommandLeaseRepository(db).renew({
    ...authority,
    ...leaseWindow()
  })
  if (!renewed) {
    throw new LiveSessionCommandAuthorityError('The live-session command authority expired.')
  }
}

export function releaseLiveSessionCommandAuthority(
  db: DBLike,
  authority: LiveSessionCommandAuthority
): Promise<void> {
  return createLiveSessionCommandLeaseRepository(db).release(authority)
}

function assertActiveAuthorities(
  activeAuthorities: readonly LiveSessionCommandAuthority[],
  authority: LiveSessionCommandAuthority | undefined
): void {
  if (!authority) {
    if (activeAuthorities.length > 0) throw new LiveSessionCommandAuthorityError()
    return
  }
  if (
    activeAuthorities.length !== 1 ||
    activeAuthorities[0]?.sessionId !== authority.sessionId ||
    activeAuthorities[0]?.authorityId !== authority.authorityId
  ) {
    throw new LiveSessionCommandAuthorityError('The live-session command authority is unavailable.')
  }
}

export async function assertCharacterLiveSessionCommandAuthority(
  db: DBLike,
  characterId: string,
  authority?: LiveSessionCommandAuthority
): Promise<void> {
  const locked = await createLiveSessionCommandLeaseRepository(db).lockForCharacter(
    characterId,
    new Date().toISOString()
  )
  assertActiveAuthorities(
    locked.flatMap((entry) =>
      entry.authorityId ? [{ sessionId: entry.sessionId, authorityId: entry.authorityId }] : []
    ),
    authority
  )
}

export async function assertSessionLiveSessionCommandAuthority(
  db: DBLike,
  sessionId: string,
  authority?: LiveSessionCommandAuthority
): Promise<void> {
  const locked = await createLiveSessionCommandLeaseRepository(db).lockForSession(
    sessionId,
    new Date().toISOString()
  )
  if (!locked) {
    throw new LiveSessionCommandAuthorityError('The Campaign session is unavailable.')
  }
  assertActiveAuthorities(
    locked.authorityId ? [{ sessionId: locked.sessionId, authorityId: locked.authorityId }] : [],
    authority
  )
}
