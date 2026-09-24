import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { CampaignInviteDto } from '@artificer-toolkit/schema/api/campaignCore'

export function useInvitationExpiry(
  asOf: string,
  setAsOf: Dispatch<SetStateAction<string>>,
  invitations: readonly CampaignInviteDto[]
) {
  const horizon = Date.parse(asOf)
  const nextExpiry = invitations.reduce((earliest, invitation) => {
    const expiresAt = Date.parse(invitation.expiresAt)
    return invitation.status === 'PENDING' && expiresAt > horizon
      ? Math.min(earliest, expiresAt)
      : earliest
  }, Infinity)

  useEffect(() => {
    const refresh = () => setAsOf(new Date().toISOString())
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const timer = Number.isFinite(nextExpiry)
      ? window.setTimeout(refresh, Math.min(2_147_483_647, Math.max(0, nextExpiry - Date.now())))
      : undefined
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [asOf, nextExpiry, setAsOf])
}
