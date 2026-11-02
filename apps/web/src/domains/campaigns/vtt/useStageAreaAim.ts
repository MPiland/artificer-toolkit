import { useCallback, useRef, useState } from 'react'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import type { LegendaryAreaAim } from './CampaignTabletopDecisionDrawer.model'
import type { VttAreaAim, VttAreaSize } from './vttSceneRenderer.model'

/**
 * The area the stage is aiming on the map, for the Actions drawer or a pending decision. Either asks
 * the stage to start the aim; only the Actions drawer comes back when it ends, since a decision keeps
 * its own drawer.
 */
export function useStageAreaAim() {
  const [areaAim, setAreaAim] = useState<VttAreaAim | null>(null)
  const [areaSize, setAreaSize] = useState<VttAreaSize | null>(null)
  const [aimingArea, setAimingArea] = useState(false)
  const decisionAimsArea = useRef(false)
  const startAiming = useCallback((forDecision: boolean) => {
    decisionAimsArea.current = forDecision
    setAimingArea(true)
  }, [])
  /** Ends the aim; true when the Actions drawer should come back. */
  const endAiming = useCallback(() => {
    setAimingArea(false)
    return !decisionAimsArea.current
  }, [])
  const decisionAim = (
    scene: CampaignSceneStateDto | null,
    sourceTokenId: string | null
  ): LegendaryAreaAim => ({
    scene,
    sourceTokenId,
    areaAim,
    aiming: aimingArea,
    onAreaAimChange: setAreaAim,
    onAreaSizeChange: setAreaSize,
    onPickAreaOrigin: () => startAiming(true)
  })
  return {
    areaAim,
    areaSize,
    aimingArea,
    decisionAim,
    endAiming,
    setAreaAim,
    setAreaSize,
    startAiming
  }
}

/** A Legendary option's area is aimed from its owner's token; null for any other decision. */
export function legendaryOwnerToken(
  decision: PendingEncounterRuleOccurrenceSummaryDto | null,
  actorIdByTokenId: ReadonlyMap<string, string>
): string | null {
  if (decision?.kind !== 'LEGENDARY_ACTION_CHOICE') return null
  return [...actorIdByTokenId].find(([, actorId]) => actorId === decision.ownerActorId)?.[0] ?? null
}
