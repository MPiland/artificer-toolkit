import { useState } from 'react'

import type { MaintainedReplacementChoicesDto } from '@artificer-toolkit/schema/api/domainRejections'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'

import { LiveSessionCommandRejectedError } from './liveSessionClient'

type Resend = Pick<ResolveEncounterActionInputDto, 'acceptedWieldConflict' | 'acknowledgedWarnings'>

/**
 * The caster's pick of which held maintained effect ends, when the server refused an action because
 * the caster is at capacity. Scoped to the exact selection (`requestIdentity`) that was refused.
 */
export function useMaintainedReplacementChoice(requestIdentity: string) {
  const [pending, setPending] = useState<
    | (Resend & {
        requestIdentity: string
        heldStates: MaintainedReplacementChoicesDto
        endedStateId: string | null
      })
    | null
  >(null)
  const choice =
    pending?.requestIdentity === requestIdentity
      ? {
          ...pending,
          options: pending.heldStates.map((held, index) => ({
            value: held.id,
            label: held.label ?? `Concentration ${index + 1}`
          }))
        }
      : null
  return {
    choice,
    /** True when `error` asks the caster to choose; the action is then resent with the pick. */
    offer(error: unknown, resend: Resend): boolean {
      if (!(error instanceof LiveSessionCommandRejectedError) || !error.rejection.heldStates)
        return false
      setPending({
        ...resend,
        requestIdentity,
        heldStates: error.rejection.heldStates,
        endedStateId: null
      })
      return true
    },
    select: (endedStateId: string) =>
      setPending((current) => (current ? { ...current, endedStateId } : current)),
    clear: () => setPending(null)
  }
}
