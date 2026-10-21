import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { D20RolledAddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import { d20CheckTotal } from '@artificer-toolkit/schema/shared/d20MinimumRoll'
import {
  d20WindowUseOptionId,
  encounterD20WindowPendingContextDtoSchema,
  type D20WindowOptionDto,
  type EncounterD20WindowPendingContextDto
} from '@artificer-toolkit/schema/shared/ruleExecutionD20Window'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerKernelRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

import { activeAfterRollAbilityCheckDice } from './character/activeEffectGrantTotals.js'
import { encounterBasicActionCheckTrigger } from './encounterBasicActionCheck.js'
import { EncounterValidationError } from './encounterErrors.js'
import { checkAbilityCode } from './encounterMovementPassagePreparation.js'
import { createReactionChoiceDefinition, startReactionChoice } from './reactionChoiceDefinition.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

/** The System-owned bounded-choice graph that holds a d20 window until its roller decides. */
export const ENCOUNTER_D20_WINDOW_CHOICE_DEFINITION_ID = '3b7e91c4-5a2d-4f08-8c6e-d14a0f92b7e5'

/** The actor who rolled the d20 the window follows: the one whose controllers decide on a held die. */
export function encounterD20WindowRollerActorId(
  context: EncounterD20WindowPendingContextDto
): string {
  return context.source.context.helperActorId
}

/** The check the window follows, as the roll card and decision name it. */
export function encounterD20WindowTrigger(context: EncounterD20WindowPendingContextDto) {
  return encounterBasicActionCheckTrigger(context.source.context)
}

/** One die a roller holds for after its d20: the effect that holds it and the grant that gives it. */
export type EncounterD20WindowHeldDie = Pick<
  D20WindowOptionDto,
  'effectId' | 'grantId' | 'label' | 'count' | 'faces' | 'sign'
>

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

function openEncounterD20WindowChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  optionCount: number
}): Promise<ServerRuleExecutionContinuationDto> {
  return startReactionChoice({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    published: createReactionChoiceDefinition({
      definitionId: ENCOUNTER_D20_WINDOW_CHOICE_DEFINITION_ID,
      gameSystemId: input.gameSystemId
    }),
    // Index 0 keeps the roll; index `n` spends the `n`th option.
    optionCount: input.optionCount + 1
  })
}

/**
 * Pauses a rolled d20 for its roller to spend a held die: the sealed bounded choice the roller
 * answers, under the context that freezes the roll and the options. `heldDice` must not be empty.
 */
export async function openEncounterD20Window(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  source: EncounterD20WindowPendingContextDto['source']
  rolled: EncounterD20WindowPendingContextDto['rolled']
  appRollId: string | null
  heldDice: readonly EncounterD20WindowHeldDie[]
  optionalCombatSnapshotChecksum: string | null
}): Promise<{
  context: EncounterD20WindowPendingContextDto
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
}> {
  const { rolled, source } = input
  const executionChecksum = checksumRuleDocument(rolled.execution)
  const continuation = await openEncounterD20WindowChoice({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    gameSystemId: input.gameSystemId,
    optionCount: input.heldDice.length
  })
  const context = encounterD20WindowPendingContextDtoSchema.parse({
    kind: 'ENCOUNTER_D20_WINDOW',
    schemaVersion: 1,
    commandId: source.context.commandId,
    commandFingerprint: source.context.commandFingerprint,
    source,
    rolled,
    appRollId: input.appRollId,
    offer: {
      executionChecksum,
      options: encounterD20WindowOptions(executionChecksum, input.heldDice)
    }
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

/** The option a decision answers, or null for a decline. An option the offer never issued is refused. */
export function chosenEncounterD20WindowOption(
  context: Pick<EncounterD20WindowPendingContextDto, 'offer'>,
  selection: EncounterD20WindowSelection
): D20WindowOptionDto | null {
  if (selection.kind === 'DECLINE') return null
  const chosen = context.offer.options.find((option) => option.optionId === selection.optionId)
  if (!chosen) throw new EncounterValidationError('The d20 window option was not offered.')
  return chosen
}

/** The kernel index a selection answers the window's choice with: 0 keeps the roll. */
export function encounterD20WindowSelectedIndex(
  context: Pick<EncounterD20WindowPendingContextDto, 'offer'>,
  selection: EncounterD20WindowSelection
): number {
  const option = chosenEncounterD20WindowOption(context, selection)
  return option ? context.offer.options.indexOf(option) + 1 : 0
}

/**
 * Settles a window against its roll: the held die is rolled (or the entered faces checked against
 * its size) and joins the d20's added dice, and the total counts it. Declining keeps the d20 as
 * rolled. The caller's commit ends the effect that held the die.
 */
export async function settleEncounterD20Window(input: {
  runtime: RulesRuntimeService
  context: EncounterD20WindowPendingContextDto
  continuation: ServerRuleExecutionContinuationDto
  selection: EncounterD20WindowSelection
  random: (maxExclusive: number) => number
}) {
  const { context, selection } = input
  const { rolled } = context
  const option = chosenEncounterD20WindowOption(context, selection)
  if (checksumRuleDocument(rolled.execution) !== context.offer.executionChecksum)
    throw new EncounterValidationError('The d20 window evidence is stale.')
  const selectedIndex = encounterD20WindowSelectedIndex(context, selection)
  const choice = await input.runtime.resume({
    continuation: input.continuation,
    response: { requestId: input.continuation.request.requestId, value: selectedIndex }
  })
  if (choice.status !== 'COMPLETE' || choice.outputs.selectedIndex !== selectedIndex)
    throw new EncounterValidationError('The d20 window did not settle its exact selection.')
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
