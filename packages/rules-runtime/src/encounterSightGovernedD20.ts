import type { EncounterActionHeldD20Dto } from '@artificer-toolkit/schema/shared/encounterActionPending'
import type {
  ServerRuleExecutionD20EvidenceDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import {
  encounterAttackSightCaptions,
  encounterSaveSightCaptions,
  isEncounterSightGovernedD20,
  reconcileEncounterD20Faces,
  type EncounterAttackD20Belief,
  type EncounterPreparedAttackSight
} from './encounterAttackBelief.js'
import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemCoreCode'
import { EncounterValidationError } from './encounterErrors.js'
import { rollModeCapabilityRegistry } from './platformPolicyModules.js'
import {
  resolveEncounterD20Answer,
  type EncounterD20RollMode,
  type EncounterEvidenceAnswer
} from './encounterEvidenceAnswer.js'

/** A d20 that sight decides: the server settles it in the true mode (ATTACK-10.1). */
export type SightGovernedD20 = {
  held: EncounterActionHeldD20Dto | null
  captions: { playerCaption: string; gmReason: string } | null
}

/**
 * How sight governs one attack d20 against its stored prompt state, or null when it does not: the
 * held die and the captions that explain a settled mode change.
 */
export function sightGovernedStageD20(input: {
  attackSight: EncounterPreparedAttackSight | null
  policy: Pick<ServerRuleExecutionD20PolicyDto, 'contributors'>
  stored: {
    d20Belief: EncounterAttackD20Belief | null
    heldD20: EncounterActionHeldD20Dto | null
  }
}): SightGovernedD20 | null {
  const { attackSight, policy, stored } = input
  if (!isEncounterSightGovernedD20({ policy, belief: stored.d20Belief })) return null
  if (stored.d20Belief && !attackSight) throw new Error('The action d20 belief is stale.')
  return {
    held: stored.heldD20,
    captions:
      stored.d20Belief && attackSight
        ? attackSight.subject === 'SAVE'
          ? encounterSaveSightCaptions(attackSight)
          : encounterAttackSightCaptions(attackSight)
        : null
  }
}

/** The d20 a roller already entered, held while one more is needed to settle the true mode. */
export function heldStageD20(
  heldFace: number,
  sight: SightGovernedD20 | null
): EncounterActionHeldD20Dto {
  return {
    rolledMode: 'NORMAL',
    faces: [heldFace],
    playerCaption: sight?.captions?.playerCaption ?? null,
    gmReason: sight?.captions?.gmReason ?? null
  }
}

/** The one die that completes a held d20: entered, from an app roll, or rolled for an auto-roller. */
function heldD20Completion(resolution: EncounterEvidenceAnswer, rollD20: () => number): number {
  const face =
    resolution.kind === 'AUTO_ROLL'
      ? rollD20()
      : resolution.kind === 'ENTER_DICE'
        ? resolution.rollMode === 'NORMAL'
          ? resolution.rawFaces[0]
          : undefined
        : resolution.kind === 'SYSTEM_ROLL' &&
            resolution.rollMode === 'NORMAL' &&
            resolution.faces.length === 1
          ? resolution.faces[0]
          : undefined
  if (face === undefined) throw new EncounterValidationError('One more d20 completes the roll.')
  return face
}

/**
 * Settles the roller's dice in the applied (true) mode: dice are kept, cancelled, or added to fit
 * it, or one more die is asked of the roller while they hold a single die.
 */
export function settleSightGovernedD20(input: {
  gameSystemId: string
  appliedMode: EncounterD20RollMode
  sightGoverned: SightGovernedD20
  resolution: EncounterEvidenceAnswer
  rollD20: () => number
}):
  | {
      kind: 'SETTLED'
      value: number
      faces: number[]
      rollMode: EncounterD20RollMode
      keep: RollModeKeep
      modeAdjustment?: ServerRuleExecutionD20EvidenceDto['modeAdjustment']
    }
  | { kind: 'NEEDS_EXTRA_D20'; heldFace: number } {
  const { gameSystemId, appliedMode, sightGoverned, resolution, rollD20 } = input
  const { held } = sightGoverned
  const keepOf = (rollMode: EncounterD20RollMode) =>
    rollModeCapabilityRegistry.rollModeKeep({ gameSystemId, rollMode })
  const appliedKeep = keepOf(appliedMode)
  const rolled = held
    ? { faces: [...held.faces], rollMode: held.rolledMode, keep: keepOf(held.rolledMode) }
    : resolveEncounterD20Answer({
        gameSystemId,
        derived: { rollMode: appliedMode, keep: appliedKeep },
        answer: resolution,
        rollD20
      })
  // The app rolls a missing die for an app roll or an auto-roll; entered dice supply their own.
  const completion = held ? heldD20Completion(resolution, rollD20) : null
  const settled = reconcileEncounterD20Faces({
    appliedMode,
    rolledMode: rolled.rollMode,
    rolledFaces: rolled.faces,
    extraFace:
      completion !== null ? () => completion : resolution.kind === 'ENTER_DICE' ? null : rollD20
  })
  if (settled.kind === 'NEEDS_EXTRA_D20')
    return { kind: 'NEEDS_EXTRA_D20', heldFace: rolled.faces[0]! }
  return {
    kind: 'SETTLED',
    value: settled.natural,
    faces: settled.faces,
    rollMode: appliedMode,
    keep: appliedKeep,
    ...(settled.adjustment
      ? {
          modeAdjustment: {
            rolledMode: settled.adjustment.rolledMode,
            rolledKeep: rolled.keep,
            rolledFaces: [...settled.adjustment.rolledFaces],
            addedFaces: [...settled.adjustment.addedFaces],
            cancelledRollIndexes: [...settled.adjustment.cancelledRollIndexes],
            addedRollIndexes: [...settled.adjustment.addedRollIndexes],
            playerCaption: sightGoverned.captions?.playerCaption ?? null,
            gmReason: sightGoverned.captions?.gmReason ?? null
          }
        }
      : {})
  }
}
