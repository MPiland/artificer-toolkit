import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterSettledAppRollDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  rollModeKeepFaceCount,
  rollModeKeptFace,
  type RollModeKeep
} from '@artificer-toolkit/schema/shared/systemCoreCode'
import { rollModeCapabilityRegistry } from './platformPolicyModules.js'
import { EncounterValidationError } from './encounterErrors.js'

/** A code from the System's `rollMode` vocabulary; the faces a roll rolls follow its `keep`. */
export type EncounterD20RollMode = string

type ApiResolution = ResolveRuleOccurrenceInputDto['resolution']

/**
 * A `SYSTEM_ROLL` answer with the faces the server recorded for its roll id ("Rolled by the app").
 * Only the server builds it, from its own roll record (ADR 0034 decision 3).
 */
export type EncounterAppRollAnswer = Extract<ApiResolution, { kind: 'SYSTEM_ROLL' }> & {
  faces: readonly number[]
  /** The mode a d20 was rolled with; null for any other roll. */
  rollMode: EncounterD20RollMode | null
  /** Which of `faces` a d20 counts; null exactly when `rollMode` is. */
  keep: RollModeKeep | null
  /** The faces of a d20 test's added dice (D156), rolled with the d20. */
  addedFaces?: readonly number[]
}

/** A response as the rules consume it: the command's answer, with an app roll's recorded faces. */
export type EncounterResponseAnswer =
  | Exclude<ApiResolution, { kind: 'SYSTEM_ROLL' | 'CONTEST_CHECK' }>
  | EncounterAppRollAnswer
  | (Omit<Extract<ApiResolution, { kind: 'CONTEST_CHECK' }>, 'roll'> & {
      roll: Extract<ApiResolution, { kind: 'ENTER_DICE' }> | EncounterAppRollAnswer
    })

/**
 * Binds a response to the app roll the server read for it: a `SYSTEM_ROLL` answer, or a contest
 * check rolled in the app, needs exactly that roll, and any other answer takes none.
 */
export function withEncounterAppRoll(
  resolution: ApiResolution,
  appRoll: EncounterSettledAppRollDto | null
): EncounterResponseAnswer {
  if (resolution.kind === 'CONTEST_CHECK') {
    const roll = withEncounterAppRoll(resolution.roll, appRoll)
    if (roll.kind !== 'ENTER_DICE' && roll.kind !== 'SYSTEM_ROLL')
      throw new EncounterValidationError('A contest check is rolled with d20 dice.')
    return { ...resolution, roll }
  }
  if (resolution.kind !== 'SYSTEM_ROLL') {
    if (appRoll) throw new EncounterValidationError('Only an app-roll answer takes an app roll.')
    return resolution
  }
  if (appRoll?.rollId !== resolution.rollId.toLowerCase())
    throw new EncounterValidationError('The app roll does not match the answer.')
  return {
    ...resolution,
    faces: appRoll.faces,
    rollMode: appRoll.rollMode,
    keep: appRoll.keep,
    ...(appRoll.addedFaces ? { addedFaces: appRoll.addedFaces } : {})
  }
}

/**
 * One evidence answer as the rules consume it: entered dice or integer, a recorded app roll, or an
 * auto-roll for a roller whose "Auto-roll my dice" preference is on (the server rolls now).
 */
export type EncounterEvidenceAnswer =
  | Extract<EncounterResponseAnswer, { kind: 'ENTER_DICE' | 'ENTER_INTEGER' | 'SYSTEM_ROLL' }>
  | { kind: 'AUTO_ROLL'; requestId: string }

/**
 * The mode entered dice are rolled under and the `keep` its System derives from it. A request offers
 * the System's `rollMode` vocabulary, so a code outside it is refused.
 */
function enteredDiceMode(
  gameSystemId: string,
  answer: Extract<ApiResolution, { kind: 'ENTER_DICE' }>
): { rollMode: EncounterD20RollMode; keep: RollModeKeep } {
  const offered = rollModeCapabilityRegistry
    .offeredRollModes(gameSystemId)
    .find(({ code }) => code === answer.rollMode)
  if (!offered)
    throw new EncounterValidationError(
      `The roll mode "${answer.rollMode}" is not offered for this request.`
    )
  return { rollMode: offered.code, keep: offered.keep }
}

/**
 * The d20 faces an answer settles with and the mode and keep that choose one of them. The
 * rules-derived mode applies to an auto-roll; entered dice and app rolls keep the mode the roller
 * chose, and the System must derive their `keep` from that mode.
 */
export function resolveEncounterD20Answer(input: {
  gameSystemId: string
  derived: { rollMode: EncounterD20RollMode; keep: RollModeKeep }
  answer: EncounterEvidenceAnswer | EncounterResponseAnswer
  rollD20: () => number
}): { faces: number[]; rollMode: EncounterD20RollMode; keep: RollModeKeep; natural: number } {
  const { answer } = input
  if (answer.kind !== 'ENTER_DICE' && answer.kind !== 'SYSTEM_ROLL' && answer.kind !== 'AUTO_ROLL')
    throw new EncounterValidationError('A d20 request needs d20 faces.')
  const { rollMode, keep } =
    answer.kind === 'AUTO_ROLL'
      ? input.derived
      : answer.kind === 'ENTER_DICE'
        ? enteredDiceMode(input.gameSystemId, answer)
        : answer
  if (rollMode === null || keep === null)
    throw new EncounterValidationError('The app roll is not a d20 roll.')
  if (answer.kind === 'SYSTEM_ROLL') {
    try {
      rollModeCapabilityRegistry.requireKeep({ gameSystemId: input.gameSystemId, rollMode, keep })
    } catch (error) {
      throw new EncounterValidationError(
        error instanceof Error ? error.message : 'The d20 keep does not match its roll mode.'
      )
    }
  }
  const count = rollModeKeepFaceCount(keep)
  if (answer.kind === 'ENTER_DICE' && answer.rawFaces.length !== count)
    throw new EncounterValidationError('The face count must match the faces the roll mode keeps.')
  const faces =
    answer.kind === 'AUTO_ROLL'
      ? Array.from({ length: count }, input.rollD20)
      : answer.kind === 'SYSTEM_ROLL'
        ? [...answer.faces]
        : [...answer.rawFaces]
  if (
    faces.length !== count ||
    faces.some((face) => !Number.isSafeInteger(face) || face < 1 || face > 20)
  )
    throw new EncounterValidationError('The d20 evidence is invalid.')
  return { faces, rollMode, keep, natural: rollModeKeptFace(keep, faces) }
}

/** The integer an answer settles an integer-range request with. */
export function resolveEncounterIntegerAnswer(input: {
  min: number
  max: number
  answer: EncounterEvidenceAnswer | EncounterResponseAnswer
  random: (maxExclusive: number) => number
}): number {
  const { answer } = input
  if (
    answer.kind !== 'ENTER_INTEGER' &&
    answer.kind !== 'SYSTEM_ROLL' &&
    answer.kind !== 'AUTO_ROLL'
  )
    throw new EncounterValidationError('The request needs a number.')
  if (answer.kind === 'SYSTEM_ROLL' && (answer.rollMode !== null || answer.faces.length !== 1))
    throw new EncounterValidationError('The app roll is not an integer roll.')
  const value =
    answer.kind === 'ENTER_INTEGER'
      ? answer.value
      : answer.kind === 'SYSTEM_ROLL'
        ? answer.faces[0]!
        : input.min + input.random(input.max - input.min + 1)
  if (!Number.isSafeInteger(value) || value < input.min || value > input.max)
    throw new EncounterValidationError('The evidence value is outside the requested range.')
  return value
}

/**
 * The kept face for a roll mode of the installed System. Held-d20 code and the roll log still
 * read a D&D roll-mode word (RULES-2.T9a2); rule-execution d20s use `rollModeKeptFace`.
 */
export function selectEncounterActionD20Natural(
  rollMode: EncounterD20RollMode,
  faces: readonly number[]
): number {
  return rollMode === 'ADVANTAGE'
    ? Math.max(...faces)
    : rollMode === 'DISADVANTAGE'
      ? Math.min(...faces)
      : faces[0]!
}

/** A saving throw's policy and evidence name the conditions that fail it unrolled, when any do. */
export function autoFailConditions(policy: { autoFailConditionIds?: readonly string[] }) {
  return policy.autoFailConditionIds?.length
    ? { autoFailConditionIds: [...policy.autoFailConditionIds] }
    : {}
}

/** A saving throw's policy and evidence carry the ability it is made with; no other test does. */
export function savingThrowAbility(policy: { savingThrowAbilityDefinitionId?: string }) {
  return policy.savingThrowAbilityDefinitionId
    ? { savingThrowAbilityDefinitionId: policy.savingThrowAbilityDefinitionId }
    : {}
}
