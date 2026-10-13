import type {
  ServerRuleExecutionD20BeliefDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import { resolveD20Contributors } from '@artificer-toolkit/shared/rolls'
import {
  checksumRuleDocument,
  compareCanonicalD20Contributors
} from '@artificer-toolkit/shared/rules'

import type { EncounterAttackPerception } from './encounterAttackPerception.js'
import { EncounterValidationError } from './encounterErrors.js'
import {
  selectEncounterActionD20Natural,
  type EncounterD20RollMode
} from './encounterEvidenceAnswer.js'
import {
  mergeCanonicalD20Contributors,
  type EncounterRelationshipD20Contributor
} from './encounterRelationshipActionFacts.js'
import {
  ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID,
  ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID
} from './encounterRollModeReasons.js'

type D20Policy = Pick<
  ServerRuleExecutionD20PolicyDto,
  'rollMode' | 'contributors' | 'contributorChecksum'
>

/** What the roller's own facts imply for an attack's d20, shown at the roll prompt. */
export type EncounterAttackD20Belief = ServerRuleExecutionD20BeliefDto

/** The true and believed sight of one attack, prepared with its mechanics (ATTACK-10.1). */
export type EncounterPreparedAttackSight = {
  actual: EncounterAttackPerception
  believed: EncounterAttackPerception
  /** The contributors true sight decides (Dodge and unseen attacker/target). */
  trueSight: readonly EncounterRelationshipD20Contributor[]
  believedSight: readonly EncounterRelationshipD20Contributor[]
  attackerLabel: string
  targetLabel: string
}

const MAX_CAPTION_LENGTH = 160

/**
 * The d20 policy the roller believes (ATTACK-10.1): the true contributors with those decided by
 * sight swapped for the believed ones. Null when the roller's facts imply the true policy.
 */
export function encounterAttackD20Belief(input: {
  policy: D20Policy
  /** The true sight contributors (Dodge and unseen attacker/target) merged into `policy`. */
  trueSight: readonly EncounterRelationshipD20Contributor[]
  believedSight: readonly EncounterRelationshipD20Contributor[]
}): EncounterAttackD20Belief | null {
  const contributors = mergeCanonicalD20Contributors(
    input.policy.contributors.filter(
      (contributor) =>
        !input.trueSight.some((sight) => compareCanonicalD20Contributors(sight, contributor) === 0)
    ),
    input.believedSight
  )
  const contributorChecksum = checksumRuleDocument(contributors)
  if (contributorChecksum === input.policy.contributorChecksum) return null
  return {
    rollMode: resolveD20Contributors(contributors).rollMode,
    contributors: [...contributors],
    contributorChecksum
  }
}

/**
 * Whether sight decides this d20, so the server applies the true mode whatever mode the roller
 * rolled with: the roller's belief differs from the truth, or an unseen contributor is in play.
 */
export function isEncounterSightGovernedD20(input: {
  policy: Pick<D20Policy, 'contributors'>
  belief: EncounterAttackD20Belief | null
}): boolean {
  return (
    input.belief !== null ||
    input.policy.contributors.some(
      (contributor) =>
        contributor.sourceId === ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID ||
        contributor.sourceId === ENCOUNTER_UNSEEN_TARGET_CONTRIBUTOR_SOURCE_ID
    )
  )
}

const bounded = (text: string) =>
  text.length > MAX_CAPTION_LENGTH ? `${text.slice(0, MAX_CAPTION_LENGTH - 1)}…` : text

/**
 * Why the mode changed after the roll prompt. The player caption is generic and never names a Sense
 * or a creature; the GM reason names the Senses. Null when sight did not change.
 */
export function encounterAttackSightCaptions(input: {
  believed: EncounterAttackPerception
  actual: EncounterAttackPerception
  attackerLabel: string
  targetLabel: string
}): { playerCaption: string; gmReason: string } | null {
  const { believed, actual, attackerLabel, targetLabel } = input
  const sensing = (observer: string, subject: string, labels: readonly string[]) =>
    `${observer} senses ${subject}${labels.length ? ` with ${labels.join(', ')}` : ''}`
  const parts: { player: string; gm: string }[] = []

  if (believed.targetSeesAttacker === 'UNSEEN' && actual.targetSeesAttacker === 'SEES')
    parts.push({
      player: 'Advantage cancelled: the target can sense you',
      gm: sensing(targetLabel, attackerLabel, actual.targetSenseLabels)
    })
  else if (believed.targetSeesAttacker === 'SEES' && actual.targetSeesAttacker === 'UNSEEN')
    parts.push({
      player: "Advantage: the target can't see you",
      gm: `${targetLabel} can't see ${attackerLabel}`
    })

  if (believed.attackerSeesTarget === 'SEES' && actual.attackerSeesTarget === 'UNSEEN')
    parts.push({
      player: "Disadvantage: you can't see the target",
      gm: `${attackerLabel} can't see ${targetLabel}`
    })
  else if (believed.attackerSeesTarget === 'UNSEEN' && actual.attackerSeesTarget === 'SEES')
    parts.push({
      player: 'Disadvantage cancelled: you can sense the target',
      gm: sensing(attackerLabel, targetLabel, actual.attackerSenseLabels)
    })

  if (parts.length === 0) return null
  return {
    playerCaption: bounded(parts.map((part) => part.player).join(' · ')),
    gmReason: bounded(parts.map((part) => part.gm).join(' · '))
  }
}

/** How the server's settled d20 differs from the dice as rolled; indexes address rolled ++ added. */
export type EncounterD20ModeAdjustment = {
  rolledMode: EncounterD20RollMode
  rolledFaces: readonly number[]
  addedFaces: readonly number[]
  cancelledRollIndexes: readonly number[]
  addedRollIndexes: readonly number[]
}

export type EncounterD20Reconciliation =
  | {
      kind: 'SETTLED'
      /** The applied faces: one for Normal, two otherwise. */
      faces: number[]
      natural: number
      /** Null when the mode is unchanged and no die was added or cancelled. */
      adjustment: EncounterD20ModeAdjustment | null
    }
  | { kind: 'NEEDS_EXTRA_D20' }

const faceCount = (mode: EncounterD20RollMode) => (mode === 'NORMAL' ? 1 : 2)

/**
 * Settles dice rolled for one mode in the applied mode. Equal counts keep the dice (a changed mode
 * changes only which one is kept); a Normal roll keeps the first of two; advantage or disadvantage
 * over one die needs one more, taken from `extraFace` or asked of the roller.
 */
export function reconcileEncounterD20Faces(input: {
  appliedMode: EncounterD20RollMode
  rolledMode: EncounterD20RollMode
  rolledFaces: readonly number[]
  /** Rolls the additional die for the roller; null when the roller must supply it. */
  extraFace: (() => number) | null
}): EncounterD20Reconciliation {
  const { appliedMode, rolledMode, rolledFaces } = input
  if (rolledFaces.length !== faceCount(rolledMode))
    throw new EncounterValidationError('The rolled d20 faces do not match their roll mode.')
  const added: number[] = []
  const cancelled: number[] = []
  let faces = [...rolledFaces]
  if (faceCount(appliedMode) < faces.length) {
    faces = [rolledFaces[0]!]
    cancelled.push(1)
  } else if (faceCount(appliedMode) > faces.length) {
    if (!input.extraFace) return { kind: 'NEEDS_EXTRA_D20' }
    const face = input.extraFace()
    if (!Number.isSafeInteger(face) || face < 1 || face > 20)
      throw new EncounterValidationError('The additional d20 face is invalid.')
    faces.push(face)
    added.push(face)
  }
  return {
    kind: 'SETTLED',
    faces,
    natural: selectEncounterActionD20Natural(appliedMode, faces),
    adjustment:
      appliedMode === rolledMode && added.length === 0 && cancelled.length === 0
        ? null
        : {
            rolledMode,
            rolledFaces: [...rolledFaces],
            addedFaces: added,
            cancelledRollIndexes: cancelled,
            addedRollIndexes: added.map((_, index) => rolledFaces.length + index)
          }
  }
}
