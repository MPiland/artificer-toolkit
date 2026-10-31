import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { D20RolledAddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import { d20CheckTotal } from '@artificer-toolkit/schema/shared/d20MinimumRoll'
import {
  encounterD20WindowPendingContextDtoSchema,
  type EncounterD20WindowPendingContextDto
} from '@artificer-toolkit/schema/shared/ruleExecutionD20Window'
import {
  d20WindowRolledChecksum,
  d20WindowUseOptionId,
  type D20HeldDieDto,
  type D20WindowOptionDto,
  type D20WindowPausePayloadDto
} from '@artificer-toolkit/schema/shared/ruleExecutionD20WindowOffer'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerKernelRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

import { activeAfterRollAbilityCheckDice } from './character/activeEffectGrantTotals.js'
import { encounterBasicActionCheckTrigger } from './encounterBasicActionCheck.js'
import { encounterConcealmentCheckTrigger } from './encounterConcealmentCheck.js'
import { damageSaveRollTrigger } from './encounterConcentration.js'
import { concentrationCommandId } from './encounterConcentrationIdentity.js'
import { EncounterValidationError } from './encounterErrors.js'
import { checkAbilityCode } from './encounterMovementPassagePreparation.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  encounterSealedChoiceIndex,
  openEncounterSealedChoice,
  settleEncounterSealedChoice
} from './encounterSealedChoice.js'

/** The System-owned bounded-choice graph that holds a d20 window until its roller decides. */
export const ENCOUNTER_D20_WINDOW_CHOICE_DEFINITION_ID = '3b7e91c4-5a2d-4f08-8c6e-d14a0f92b7e5'

/** The actor who rolled the d20 the window follows: the one whose controllers decide on a held die. */
export function encounterD20WindowRollerActorId(
  context: EncounterD20WindowPendingContextDto
): string {
  const { source } = context
  return source.kind === 'DAMAGE_SAVE_CHECK'
    ? source.context.application.targetActorId
    : source.context.actorId
}

/** The check the window follows, as the roll card and decision name it. */
export function encounterD20WindowTrigger(context: EncounterD20WindowPendingContextDto) {
  const { source } = context
  if (source.kind === 'DAMAGE_SAVE_CHECK') return damageSaveRollTrigger(source.context)
  return source.kind === 'CONCEALMENT_CHECK'
    ? encounterConcealmentCheckTrigger(source.context)
    : encounterBasicActionCheckTrigger(source.context)
}

/** One die a roller holds for after its d20: the effect that holds it and the grant that gives it. */
export type EncounterD20WindowHeldDie = D20HeldDieDto

/** What the roller answers: keeping the roll, or spending one offered die on it. */
export type EncounterD20WindowSelection =
  | { kind: 'DECLINE' }
  | { kind: 'USE'; optionId: string; faces?: readonly number[] }

/** The selection a window answer carries; any other answer is not the window's. */
export function encounterD20WindowSelection(
  resolution: ResolveRuleOccurrenceInputDto['resolution']
): EncounterD20WindowSelection {
  if (resolution.kind === 'D20_WINDOW_USE')
    return { kind: 'USE', optionId: resolution.optionId, faces: resolution.faces }
  if (resolution.kind === 'D20_WINDOW_DECLINE') return { kind: 'DECLINE' }
  throw new EncounterValidationError('The d20 window takes a use or a decline.')
}

/** The dice a roller's active effects hold for after its d20 of this check. */
export function encounterHeldCheckDice(
  system: SystemAuthoredDto,
  effects: Parameters<typeof activeAfterRollAbilityCheckDice>[0],
  checkDefinitionId: string
): EncounterD20WindowHeldDie[] {
  return activeAfterRollAbilityCheckDice(
    effects,
    checkAbilityCode(
      system,
      system.skills.some((skill) => skill.id === checkDefinitionId) ? 'SKILL' : 'ABILITY',
      checkDefinitionId
    )
  )
}

/** The options offered for one roll: each held die, identified by the roll it was offered for. */
export function encounterD20WindowOptions(
  executionChecksum: string,
  heldDice: readonly EncounterD20WindowHeldDie[]
): D20WindowOptionDto[] {
  return heldDice.map((die) => ({
    ...die,
    optionId: d20WindowUseOptionId({
      executionChecksum,
      effectId: die.effectId,
      grantId: die.grantId
    })
  }))
}

/**
 * Holds a rolled d20 for its roller to spend a held die: the sealed bounded choice they answer, and
 * the pause payload that freezes the roll and the options. `heldDice` must not be empty.
 */
export async function openEncounterD20WindowPause(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  rolled: D20WindowPausePayloadDto['rolled']
  appRollId: string | null
  heldDice: readonly EncounterD20WindowHeldDie[]
}): Promise<{
  continuation: ServerRuleExecutionContinuationDto
  payload: D20WindowPausePayloadDto
}> {
  const { rolled } = input
  const executionChecksum = d20WindowRolledChecksum(rolled)
  // Index 0 keeps the roll; index `n` spends the `n`th option.
  const continuation = await openEncounterSealedChoice({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    graph: {
      definitionId: ENCOUNTER_D20_WINDOW_CHOICE_DEFINITION_ID,
      gameSystemId: input.gameSystemId
    },
    optionCount: input.heldDice.length,
    declinable: true
  })
  return {
    continuation,
    payload: {
      rolled,
      appRollId: input.appRollId,
      offer: {
        executionChecksum,
        options: encounterD20WindowOptions(executionChecksum, input.heldDice)
      }
    }
  }
}

/**
 * Pauses a rolled d20 for its roller to spend a held die, under the context that freezes the roll
 * and the options. `heldDice` must not be empty.
 */
export async function openEncounterD20Window(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  source: EncounterD20WindowPendingContextDto['source']
  /** The pending command the window belongs to: its id and fingerprint, as the source names it. */
  command: Pick<EncounterD20WindowPendingContextDto, 'commandId' | 'commandFingerprint'>
  rolled: D20WindowPausePayloadDto['rolled']
  appRollId: string | null
  heldDice: readonly EncounterD20WindowHeldDie[]
  optionalCombatSnapshotChecksum: string | null
}): Promise<{
  context: EncounterD20WindowPendingContextDto
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
}> {
  const { continuation, payload } = await openEncounterD20WindowPause(input)
  const context = encounterD20WindowPendingContextDtoSchema.parse({
    kind: 'ENCOUNTER_D20_WINDOW',
    schemaVersion: 1,
    commandId: input.command.commandId,
    commandFingerprint: input.command.commandFingerprint,
    source: input.source,
    pause: { kind: 'D20_WINDOW', payload }
  })
  return {
    context,
    snapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
      ...continuation,
      snapshotKind: 'KERNEL_EVIDENCE',
      optionalCombatSnapshotChecksum: input.optionalCombatSnapshotChecksum,
      applicationContext: context
    })
  }
}

/** The command a damage save's window belongs to: its occurrence's own, fingerprinted by the save. */
export function damageSaveWindowCommand(
  occurrenceId: string,
  context: Extract<
    EncounterD20WindowPendingContextDto['source'],
    { kind: 'DAMAGE_SAVE_CHECK' }
  >['context']
) {
  return {
    commandId: concentrationCommandId(occurrenceId),
    commandFingerprint: checksumRuleDocument({
      parentOccurrenceId: context.parentOccurrenceId,
      application: context.application,
      contextChecksum: context.contextChecksum
    })
  }
}

/**
 * What a damage save's window pends with: the save as it paused before its roll (the snapshot the
 * save's own answer resumes, deferred Cleaving kept) and the window that follows the roll. Null
 * for a snapshot that is not the window of a damage save.
 */
export function damageSaveWindowResume(snapshot: ServerKernelRuleExecutionPendingSnapshotDto) {
  const {
    snapshotKind: _kind,
    applicationContext: context,
    optionalCombatSnapshotChecksum,
    phaseReceipts: _phaseReceipts,
    deferredCleaving,
    ...continuation
  } = snapshot
  if (
    context.kind !== 'ENCOUNTER_D20_WINDOW' ||
    context.source.kind !== 'DAMAGE_SAVE_CHECK' ||
    !('continuation' in context.pause.payload.rolled)
  )
    return null
  return {
    save: serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
      ...context.pause.payload.rolled.continuation,
      snapshotKind: 'KERNEL_EVIDENCE',
      applicationContext: context.source.context,
      optionalCombatSnapshotChecksum,
      ...(deferredCleaving ? { deferredCleaving } : {})
    }),
    window: { context, continuation }
  }
}

/** The option a decision answers, or null for a decline. An option the offer never issued is refused. */
export function chosenEncounterD20WindowOption(
  window: Pick<D20WindowPausePayloadDto, 'offer'>,
  selection: EncounterD20WindowSelection
): D20WindowOptionDto | null {
  if (selection.kind === 'DECLINE') return null
  const chosen = window.offer.options.find((option) => option.optionId === selection.optionId)
  if (!chosen) throw new EncounterValidationError('The d20 window option was not offered.')
  return chosen
}

/** The kernel index a selection answers the window's choice with: 0 keeps the roll. */
export function encounterD20WindowSelectedIndex(
  window: Pick<D20WindowPausePayloadDto, 'offer'>,
  selection: EncounterD20WindowSelection
): number {
  return encounterSealedChoiceIndex(
    window.offer.options,
    chosenEncounterD20WindowOption(window, selection)
  )
}

/**
 * Settles a window against its roll: the held die is rolled (or the entered faces checked against
 * its size) and joins the d20's added dice, and the total counts it. Declining keeps the d20 as
 * rolled. The caller's commit ends the effect that held the die.
 */
export async function settleEncounterD20Window(input: {
  runtime: RulesRuntimeService
  window: D20WindowPausePayloadDto
  continuation: ServerRuleExecutionContinuationDto
  selection: EncounterD20WindowSelection
  random: (maxExclusive: number) => number
}) {
  const { selection, window } = input
  const { rolled } = window
  const option = chosenEncounterD20WindowOption(window, selection)
  if (d20WindowRolledChecksum(rolled) !== window.offer.executionChecksum)
    throw new EncounterValidationError('The d20 window evidence is stale.')
  await settleEncounterSealedChoice({
    runtime: input.runtime,
    continuation: input.continuation,
    selectedIndex: encounterSealedChoiceIndex(window.offer.options, option),
    label: 'The d20 window'
  })
  if (selection.kind === 'DECLINE' || !option) return { option: null, d20: rolled.d20 }
  const rolledFaces =
    selection.faces ?? Array.from({ length: option.count }, () => input.random(option.faces) + 1)
  if (
    rolledFaces.length !== option.count ||
    rolledFaces.some((face) => !Number.isSafeInteger(face) || face < 1 || face > option.faces)
  )
    throw new EncounterValidationError('The held die needs one face for each die, within its size.')
  const die: D20RolledAddedDieDto = {
    label: option.label,
    count: option.count,
    faces: option.faces,
    sign: option.sign,
    spentEffectId: option.effectId,
    rolledFaces: [...rolledFaces]
  }
  const addedDice = [...(rolled.d20.addedDice ?? []), die]
  return {
    option,
    d20: {
      ...rolled.d20,
      addedDice,
      total: d20CheckTotal({
        selectedNatural: rolled.d20.selectedNatural,
        modifier: rolled.d20.modifier,
        addedDice,
        minimumRoll: rolled.d20.minimumRoll
      })
    }
  }
}
