import type { CampaignClockRecoveryPromptDto } from '@artificer-toolkit/schema/api/campaignSessions'

type ClockRecoveryBoundaryKind = CampaignClockRecoveryPromptDto['boundaryKind']

/** Explicit names for the boundary the GM is deciding about; the clock never auto-recovers in combat. */
export const CLOCK_RECOVERY_BOUNDARY_LABELS = {
  DAWN: { passed: 'Dawn passed during combat', recovers: 'dawn' },
  DUSK: { passed: 'Dusk passed during combat', recovers: 'dusk' },
  DAILY: { passed: 'A new day began (midnight) during combat', recovers: 'a new day' }
} as const satisfies Record<ClockRecoveryBoundaryKind, { passed: string; recovers: string }>

/** Spent charges that the passed boundary would have refreshed outside combat. */
export function recoverableResources<
  Resource extends {
    max: number
    remaining: number
    recoveries: readonly { trigger: string }[]
  }
>(resources: readonly Resource[], boundaryKind: ClockRecoveryBoundaryKind) {
  return resources.filter(
    (resource) =>
      resource.remaining < resource.max &&
      resource.recoveries.some((recovery) => recovery.trigger === boundaryKind)
  )
}
