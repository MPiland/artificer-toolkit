import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type {
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  d20WindowReactorActorId,
  isD20RolledCheck,
  type D20WindowPausePayloadDto,
  type D20WindowReactionDieDto
} from '@artificer-toolkit/schema/shared/ruleExecutionD20WindowOffer'
import type { EncounterActionPauseDto } from '@artificer-toolkit/schema/shared/encounterPause'
import { isDamageRollWindow } from '@artificer-toolkit/schema/shared/ruleExecutionDamageRollWindow'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import { encounterHeldSavingThrowDice } from './encounterActiveGrants.js'
import { damageSaveRolledD20 } from './encounterConcentration.js'
import {
  openEncounterD20WindowPause,
  type EncounterD20WindowDie,
  type EncounterD20WindowHeldDie
} from './encounterD20Window.js'
import { d20EvidenceMatchesPins, type SettledActionResponse } from './encounterD20Settlement.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

/** A roller's answer to a d20 window, before it settles into the roll the window froze. */
export type EncounterD20WindowResponse = Extract<
  ResolveRuleOccurrenceInputDto['resolution'],
  { kind: 'ROLL_WINDOW_USE' | 'ROLL_WINDOW_DECLINE' }
>

/** The d20 a TEST save's window settled, which resumes the save the window held. */
export type EncounterActionWindowAnswer = {
  kind: 'ROLL_WINDOW'
  d20: D20WindowPausePayloadDto['rolled']['d20']
}

/**
 * The dice an action's TEST roller holds for after its d20 (D168): the target's, by the save's
 * ability, for a save, and the attacker's dice for an attack roll.
 */
export type EncounterActionSaveWindow = {
  heldDice(policy: ServerRuleExecutionD20PolicyDto): readonly EncounterD20WindowHeldDie[]
  /**
   * The dice the first reactor not yet asked may roll against the attack roll by its reaction (D207),
   * all of that one reactor; empty when nobody is left. Absent where no reactor may answer the roll.
   */
  reactionDice?(
    answeredReactorActorIds: readonly string[]
  ): Promise<readonly D20WindowReactionDieDto[]>
}

/** The dice the target of an action's TEST save, or the attacker of its TEST attack, holds for after its d20. */
export const targetSaveWindow = (
  gameSystemId: string,
  targetEffects: readonly ActiveRuleEffectRecord[],
  attackDice: readonly EncounterD20WindowHeldDie[] = [],
  reactionDice?: EncounterActionSaveWindow['reactionDice']
): EncounterActionSaveWindow => ({
  heldDice: ({ savingThrowAbilityDefinitionId }) =>
    savingThrowAbilityDefinitionId
      ? encounterHeldSavingThrowDice(gameSystemId, targetEffects, savingThrowAbilityDefinitionId)
      : attackDice,
  ...(reactionDice ? { reactionDice } : {})
})

/**
 * Who decides next on a rolled TEST d20, and the dice they are offered (D168, D207): right after the
 * roll, the roller on its held dice; then, for an attack roll, each reactor in turn, one window each.
 * `previous` is the window just answered, null right after the roll. No dice: nobody is left to ask.
 */
export async function nextActionWindowDice(input: {
  saveWindow: EncounterActionSaveWindow | undefined
  policy: ServerRuleExecutionD20PolicyDto
  previous: Pick<D20WindowPausePayloadDto, 'answeredReactorActorIds' | 'offer'> | null
}): Promise<{
  dice: readonly EncounterD20WindowDie[]
  answeredReactorActorIds: readonly string[]
}> {
  const { saveWindow, policy, previous } = input
  if (!saveWindow) return { dice: [], answeredReactorActorIds: [] }
  const heldDice = previous ? [] : saveWindow.heldDice(policy)
  if (heldDice.length > 0) return { dice: heldDice, answeredReactorActorIds: [] }
  const reactor = previous && d20WindowReactorActorId(previous)
  const answeredReactorActorIds =
    previous && reactor ? [...previous.answeredReactorActorIds, reactor] : []
  return {
    dice:
      policy.savingThrowAbilityDefinitionId || !saveWindow.reactionDice
        ? []
        : await saveWindow.reactionDice(answeredReactorActorIds),
    answeredReactorActorIds
  }
}

/**
 * The roll a settled window answers the save it held with. The window froze the roll against the
 * save's policy, so a policy that has since changed refuses it.
 */
export function windowedSaveResponse(input: {
  continuation: ServerRuleExecutionContinuationDto
  policy: ServerRuleExecutionD20PolicyDto | null
  d20: EncounterActionWindowAnswer['d20']
}): SettledActionResponse {
  const { policy, d20 } = input
  if (
    !policy ||
    d20.requestId !== input.continuation.request.requestId ||
    !d20EvidenceMatchesPins(d20, policy)
  )
    throw new Error('The action TEST evidence is stale.')
  return {
    kind: 'SETTLED',
    value: d20.selectedNatural,
    faces: d20.rawFaces,
    rollMode: d20.rollMode,
    keep: d20.keep,
    addedDice: d20.addedDice ?? []
  }
}

/**
 * The save a pending d20 window holds as it paused before the roll, or null for any other pause. Only
 * a window's answer resumes a window, only a save's window belongs to an action, and only a damage
 * reroll answers a damage roll's window (D208).
 */
export function heldWindowedSave(
  pause: EncounterActionPauseDto | undefined,
  resolution: { kind: string }
) {
  const window = pause?.kind === 'ROLL_WINDOW' ? pause.payload : null
  const damage = window !== null && isDamageRollWindow(window)
  const held = window && !isDamageRollWindow(window) ? window.rolled : null
  if (
    (resolution.kind === 'ROLL_WINDOW') !== (held !== null) ||
    (resolution.kind === 'DAMAGE_REROLL') !== damage ||
    (held && isD20RolledCheck(held))
  )
    throw new Error('The action TEST evidence is stale.')
  return held
}

/**
 * Pauses a rolled TEST for its next decider to spend a die on it (D168), or null when the roll is not
 * one a window can show. The window freezes the TEST's continuation with the roll: as rolled (a
 * `response`), or as the window before settled it (`previous` and its `d20`), for the next reactor.
 */
export async function openActionSaveWindow(
  input: {
    runtime: RulesRuntimeService
    occurrenceId: string
    gameSystemId: string
    dice: readonly EncounterD20WindowDie[]
    answeredReactorActorIds?: readonly string[]
  } & (
    | {
        continuation: ServerRuleExecutionContinuationDto
        policy: ServerRuleExecutionD20PolicyDto
        response: SettledActionResponse
        appRollId: string | null
      }
    | { previous: D20WindowPausePayloadDto; d20: EncounterActionWindowAnswer['d20'] }
  )
) {
  let rolled: D20WindowPausePayloadDto['rolled']
  let appRollId: string | null
  if ('previous' in input) {
    rolled = { ...input.previous.rolled, d20: input.d20 }
    appRollId = input.previous.appRollId
  } else {
    const { response } = input
    if (!response.faces || !response.rollMode || !response.keep) return null
    rolled = {
      continuation: input.continuation,
      initialFactsChecksum: checksumRuleDocument(input.continuation.facts),
      d20: damageSaveRolledD20({
        requestId: input.continuation.request.requestId,
        save: input.policy,
        roll: {
          rawFaces: response.faces,
          rollMode: response.rollMode,
          keep: response.keep,
          natural: response.value,
          addedDice: response.addedDice
        }
      })
    }
    appRollId = input.appRollId
  }
  const window = await openEncounterD20WindowPause({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    gameSystemId: input.gameSystemId,
    rolled,
    appRollId,
    dice: input.dice,
    answeredReactorActorIds: input.answeredReactorActorIds
  })
  return {
    continuation: window.continuation,
    pause: { kind: 'ROLL_WINDOW' as const, payload: window.payload }
  }
}
