import type { TargetRequirementDto } from '@artificer-toolkit/schema/effects/targeting'
import { isCharacterDead } from '@artificer-toolkit/schema/shared/characterDeathSaves'

import { encounterSightHolds, type EncounterAttackPerception } from './encounterAttackPerception.js'
import { encounterConditionSources } from './encounterConditionMechanics.js'
import { EncounterValidationError } from './encounterErrors.js'
import { heldConditionIds } from './encounterInnateConditions.js'
import type { MovementTarget } from './encounterMovementTargets.js'

type TargetSight = Pick<EncounterAttackPerception, 'attackerSeesTarget' | 'targetSeesAttacker'>

const UNMET_MESSAGE = {
  HAS_CONDITION: 'The selected action target does not have the required condition.',
  LACKS_CONDITION: 'The selected action target has a condition that rules it out.',
  NOT_IMMUNE_TO_CONDITION: 'The selected action target is immune to a condition the action needs.',
  SIGHT: 'The selected action target is out of the required sight.',
  AT_ZERO_HIT_POINTS: 'The selected action target is not at 0 hit points.'
} satisfies Record<TargetRequirementDto['kind'], string>

/**
 * Refuses a target that fails a single-target action's `targetRequirements`, naming the first it
 * fails. A Sight range is such a requirement: it measures no distance and reaches any target its user
 * sees. `loadSight` is read only for a sight requirement; a flow that cannot read perception refuses
 * one rather than skip it.
 */
export async function refuseUnmetTargetRequirements(input: {
  requirements: readonly TargetRequirementDto[] | undefined
  /** The kind of the action's range. */
  rangeKind?: string
  actorId: string
  target: MovementTarget
  loadSight?: () => Promise<TargetSight>
}): Promise<void> {
  const { actorId, target, loadSight } = input
  const requirements: readonly TargetRequirementDto[] = [
    ...(input.rangeKind === 'SIGHT'
      ? [{ kind: 'SIGHT' as const, direction: 'ACTOR_SEES_TARGET' as const }]
      : []),
    ...(input.requirements ?? [])
  ]
  for (const requirement of requirements) {
    let met: boolean
    switch (requirement.kind) {
      case 'HAS_CONDITION': {
        const held = new Set(heldConditionIds(target))
        const sources = encounterConditionSources(target)
        met = requirement.conditionIds.some((conditionId) =>
          requirement.source === 'ANY'
            ? held.has(conditionId)
            : (sources.get(conditionId) ?? []).includes(actorId)
        )
        break
      }
      case 'LACKS_CONDITION': {
        const held = new Set(heldConditionIds(target))
        met = !requirement.conditionIds.some((conditionId) => held.has(conditionId))
        break
      }
      case 'NOT_IMMUNE_TO_CONDITION':
        met = !requirement.conditionIds.some((conditionId) =>
          target.conditionImmunityIds.includes(conditionId)
        )
        break
      case 'SIGHT':
        if (!loadSight) throw new Error('Target sight is unavailable.')
        met = encounterSightHolds(await loadSight(), requirement.direction)
        break
      case 'AT_ZERO_HIT_POINTS':
        met =
          target.state.current === 0 &&
          !(target.state.deathSaves && isCharacterDead(target.state.deathSaves))
        break
    }
    if (!met) throw new EncounterValidationError(UNMET_MESSAGE[requirement.kind])
  }
}
