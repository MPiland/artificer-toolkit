import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type {
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  isD20RolledCheck,
  type D20WindowPausePayloadDto
} from '@artificer-toolkit/schema/shared/ruleExecutionD20WindowOffer'
import type { EncounterActionPauseDto } from '@artificer-toolkit/schema/shared/encounterPause'

import { damageSaveRolledD20 } from './encounterConcentration.js'
import {
  openEncounterD20WindowPause,
  type EncounterD20WindowHeldDie
} from './encounterD20Window.js'
import type { SettledActionResponse } from './encounterD20Settlement.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

/** The d20 a TEST save's window settled, which resumes the save the window held. */
export type EncounterActionWindowAnswer = {
  kind: 'D20_WINDOW'
  d20: D20WindowPausePayloadDto['rolled']['d20']
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
    d20.derivedRollMode !== policy.rollMode ||
    d20.contributorChecksum !== policy.contributorChecksum ||
    d20.modifier !== policy.modifier
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
 * The save a pending window holds as it paused before the roll, or null for any other pause. Only a
 * window's answer resumes a window, and only a save's window belongs to an action.
 */
export function heldWindowedSave(
  pause: EncounterActionPauseDto | undefined,
  resolution: { kind: string }
) {
  const held = pause?.kind === 'D20_WINDOW' ? pause.payload.rolled : null
  if ((resolution.kind === 'D20_WINDOW') !== (held !== null) || (held && isD20RolledCheck(held)))
    throw new Error('The action TEST evidence is stale.')
  return held
}

/**
 * Pauses a rolled save for its roller to spend a held die on it (D168), or null when the roll is not
 * one a window can show. The window freezes the save's continuation with the roll.
 */
export async function openActionSaveWindow(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  continuation: ServerRuleExecutionContinuationDto
  policy: ServerRuleExecutionD20PolicyDto
  response: SettledActionResponse
  appRollId: string | null
  heldDice: readonly EncounterD20WindowHeldDie[]
}) {
  const { response } = input
  if (!response.faces || !response.rollMode || !response.keep) return null
  const window = await openEncounterD20WindowPause({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    gameSystemId: input.gameSystemId,
    rolled: {
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
    },
    appRollId: input.appRollId,
    heldDice: input.heldDice
  })
  return {
    continuation: window.continuation,
    pause: { kind: 'D20_WINDOW' as const, payload: window.payload }
  }
}
