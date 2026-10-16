import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { basicActionCheckApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import {
  encounterBasicActionCheckPendingContextDtoSchema,
  type EncounterConcealmentCheckPendingContextDto,
  type encounterEscapeCheckPendingContextDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import type { characterMechanicsTargetStateDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { EncounterRuleRollTriggerDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerKernelRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CharacterStabilizeOutcomeApplication } from './characterRuleActionSystemAdapter.js'
import { isEncounterTargetDying } from './encounterActorDefeat.js'
import { effectsEndedBy } from './encounterGrantLifetimes.js'
import { EncounterValidationError } from './encounterErrors.js'
import {
  resolveEncounterD20Answer,
  type EncounterEvidenceAnswer
} from './encounterEvidenceAnswer.js'
import { actorContestFacts } from './encounterMovementPassagePreparation.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { createDnd5eBasicActionCheckDefinition } from './systems/dnd5e/encounterLifecyclePolicy.js'
import { DND5E_SYSTEM_ID } from './systems/dnd5e/identity.js'

type EncounterBasicActionCheckPendingContextDto = ReturnType<
  typeof encounterBasicActionCheckPendingContextDtoSchema.parse
>
type EncounterEscapeCheckPendingContextDto = ReturnType<
  typeof encounterEscapeCheckPendingContextDtoSchema.parse
>
type CharacterMechanicsTargetStateDto = ReturnType<
  typeof characterMechanicsTargetStateDtoSchema.parse
>
/** The frozen d20 check every single-roll check carries: First Aid, Escape and a counter's check. */
type EncounterD20CheckContext = Pick<EncounterBasicActionCheckPendingContextDto, 'd20'> & {
  check: Pick<EncounterBasicActionCheckPendingContextDto['check'], 'dc'>
}

/** Each System's basic action check graph: its one d20 request and no other evidence. */
const basicActionCheckDefinitionBySystemId: ReadonlyMap<
  string,
  typeof createDnd5eBasicActionCheckDefinition
> = new Map([[DND5E_SYSTEM_ID, createDnd5eBasicActionCheckDefinition]])

/** The mechanics application of a check that reached its DC: the target becomes stable. */
export function encounterBasicActionStabilizeApplication(
  targetActorId: string
): CharacterStabilizeOutcomeApplication {
  return {
    sourceNodeId: 'stabilize',
    sourceOperationKey: 'effect.stabilize',
    authoredPath: null,
    resolvedPath: null,
    kind: 'STABILIZE',
    targetActorId
  }
}

/** The check's name as the roller reads it: "Strength" or "Wisdom (Medicine)". */
export function encounterBasicActionCheckLabel(
  system: SystemAuthoredDto,
  checkDefinitionId: string
): string {
  // Only current Systems define UUID-backed check definitions.
  if (!('schemaVersion' in system) || system.schemaVersion !== 4)
    throw new EncounterValidationError('The System defines no check definitions.')
  const abilityCheck = system.abilities.find((entry) => entry.id === checkDefinitionId)
  if (abilityCheck) return abilityCheck.label
  const skill = system.skills.find((entry) => entry.id === checkDefinitionId)
  if (!skill) throw new EncounterValidationError('The basic action check is not in the System.')
  const ability = system.abilities.find((entry) => entry.id === skill.governingAbilityDefinitionId)
  return ability ? `${ability.label} (${skill.label})` : skill.label
}

export function encounterBasicActionCheckTrigger(
  context: Pick<EncounterBasicActionCheckPendingContextDto, 'actionLabel' | 'check'>
): Extract<EncounterRuleRollTriggerDto, { kind: 'BASIC_ACTION_CHECK' }> {
  return {
    kind: 'BASIC_ACTION_CHECK',
    actionLabel: context.actionLabel,
    checkLabel: context.check.label,
    dc: context.check.dc
  }
}

/**
 * Freezes a stabilizing basic action's check from the helper's own facts: the System check
 * definition's modifier and contributors (conditions included, and any Help it holds). The check
 * uses up the helper's one-check grants. Returns null when the target is not dying, so no check is made. A custom helper has no
 * check facts and is refused.
 */
export function prepareEncounterBasicActionCheck<
  TCharacterFacts extends CharacterMovementFacts
>(input: {
  gameSystemId: string
  commandId: string
  commandFingerprint: string
  definition: { id: string; version: number; checksum: string; label: string }
  system: SystemAuthoredDto
  check: { checkKind: 'SKILL' | 'ABILITY'; checkDefinitionId: string; dc: number }
  checkLabel: string
  helper: MovementTarget<TCharacterFacts>
  target: MovementTarget<TCharacterFacts>
}): { context: EncounterBasicActionCheckPendingContextDto } | null {
  const { helper, target } = input
  if (helper.actor.kind === 'CUSTOM')
    throw new EncounterValidationError('A custom actor has no check to make.')
  if (!isEncounterTargetDying(target)) return null
  if (!target.actor.sourceId) throw new EncounterValidationError('Choose a Character to stabilize.')
  const facts = actorContestFacts({
    actorId: helper.actor.id,
    checkKind: input.check.checkKind,
    checkDefinitionId: input.check.checkDefinitionId,
    gameSystemId: input.gameSystemId,
    system: input.system,
    targets: new Map([[helper.actor.id, helper]])
  })
  if (facts.modifier === null)
    throw new EncounterValidationError('This actor has no total for the check.')
  return {
    context: encounterBasicActionCheckPendingContextDtoSchema.parse({
      kind: 'ENCOUNTER_BASIC_ACTION_CHECK',
      schemaVersion: 1,
      commandId: input.commandId,
      commandFingerprint: input.commandFingerprint,
      definition: {
        id: input.definition.id,
        version: input.definition.version,
        checksum: input.definition.checksum
      },
      actionLabel: input.definition.label,
      helperActorId: helper.actor.id,
      targetActorId: target.actor.id,
      targetCharacterId: target.actor.sourceId,
      check: {
        checkDefinitionId: input.check.checkDefinitionId,
        label: input.checkLabel,
        dc: input.check.dc
      },
      d20: {
        rollMode: facts.rollMode,
        contributors: facts.contributors,
        contributorChecksum: checksumRuleDocument(facts.contributors),
        modifier: facts.modifier
      },
      consumedGrants: effectsEndedBy(helper.activeEffects, 'ON_ABILITY_CHECK')
    })
  }
}

function requireD20Request(continuation: ServerRuleExecutionContinuationDto) {
  if (
    continuation.request.kind !== 'INTEGER_RANGE' ||
    continuation.request.min !== 1 ||
    continuation.request.max !== 20
  )
    throw new EncounterValidationError('The basic action check requested unsupported evidence.')
}

/** Starts the System's check graph, which asks for the one d20. */
export async function startEncounterBasicActionCheck(input: {
  runtime: RulesRuntimeService
  gameSystemId: string
  occurrenceId: string
}): Promise<ServerRuleExecutionContinuationDto> {
  const published = basicActionCheckDefinitionBySystemId.get(input.gameSystemId)?.()
  if (!published) throw new EncounterValidationError('This System has no basic action check.')
  const started = await input.runtime.executeResolved({
    command: { definitionId: published.id, occurrenceId: input.occurrenceId, facts: {} },
    published
  })
  if (started.status === 'COMPLETE')
    throw new EncounterValidationError('The basic action check requested no d20 evidence.')
  requireD20Request(started.continuation)
  return started.continuation
}

/** The pending snapshot a prompted check waits on. */
export function encounterBasicActionCheckPendingSnapshot(input: {
  continuation: ServerRuleExecutionContinuationDto
  context:
    | EncounterBasicActionCheckPendingContextDto
    | EncounterEscapeCheckPendingContextDto
    | EncounterConcealmentCheckPendingContextDto
  optionalCombatSnapshotChecksum: string | null
}): ServerKernelRuleExecutionPendingSnapshotDto {
  return serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
    ...input.continuation,
    snapshotKind: 'KERNEL_EVIDENCE',
    optionalCombatSnapshotChecksum: input.optionalCombatSnapshotChecksum,
    applicationContext: input.context
  })
}

/** Rolls a frozen check's one d20: the natural die plus the roller's modifier, against no DC yet. */
export async function rollEncounterCheck(input: {
  runtime: RulesRuntimeService
  context: Pick<EncounterD20CheckContext, 'd20'>
  continuation: ServerRuleExecutionContinuationDto
  answer: EncounterEvidenceAnswer
  rollD20: () => number
  expectedOccurrenceId: string
}) {
  const { context, continuation, answer } = input
  requireD20Request(continuation)
  if (
    answer.requestId !== continuation.request.requestId ||
    continuation.occurrenceId !== input.expectedOccurrenceId
  )
    throw new EncounterValidationError('The basic action check evidence is stale.')
  const resolved = resolveEncounterD20Answer({
    derivedRollMode: context.d20.rollMode,
    answer,
    rollD20: input.rollD20
  })
  const execution = await input.runtime.resume({
    continuation,
    response: { requestId: answer.requestId, value: resolved.natural }
  })
  if (execution.status !== 'COMPLETE' || execution.outputs.rawDie !== resolved.natural)
    throw new EncounterValidationError('The basic action check requested more than one die.')
  return {
    execution,
    d20: {
      requestId: continuation.request.requestId,
      rollMode: resolved.rollMode,
      derivedRollMode: context.d20.rollMode,
      rawFaces: resolved.faces,
      selectedNatural: resolved.natural,
      modifier: context.d20.modifier,
      total: resolved.natural + context.d20.modifier,
      contributors: context.d20.contributors,
      contributorChecksum: context.d20.contributorChecksum
    }
  }
}

/** Rolls the frozen check against its DC: the natural d20 plus the helper's modifier. */
export async function evaluateEncounterBasicActionCheck(
  input: Parameters<typeof rollEncounterCheck>[0] & { context: EncounterD20CheckContext }
) {
  const { execution, d20 } = await rollEncounterCheck(input)
  return {
    execution,
    d20: { ...d20, dc: input.context.check.dc },
    reachesDc: d20.total >= input.context.check.dc
  }
}

/**
 * The stored result of a settled check. `transition` is the target's death-save state before and
 * after the stabilize, present only when the check stabilized a target that was still dying.
 */
export function completeEncounterBasicActionCheckResult(input: {
  context: EncounterBasicActionCheckPendingContextDto
  continuation: ServerRuleExecutionContinuationDto
  evaluated: Awaited<ReturnType<typeof evaluateEncounterBasicActionCheck>>
  targetStillDying: boolean
  transition: {
    before: CharacterMechanicsTargetStateDto
    after: CharacterMechanicsTargetStateDto
    afterStreamVersion: number | null
  } | null
  occurrenceVersion: number
  initialFactsChecksum: string
}) {
  const { context, continuation, evaluated, transition } = input
  if (transition && transition.afterStreamVersion === null)
    throw new EncounterValidationError('A stabilized target must be a Character with a stream.')
  const applicationOutputs = basicActionCheckApplicationOutputDtoSchema.parse({
    kind: 'BASIC_ACTION_CHECK',
    schemaVersion: 1,
    occurrenceId: continuation.occurrenceId,
    commandId: context.commandId,
    definition: context.definition,
    helperActorId: context.helperActorId,
    targetActorId: context.targetActorId,
    targetCharacterId: context.targetCharacterId,
    check: {
      checkDefinitionId: context.check.checkDefinitionId,
      dc: context.check.dc
    },
    d20: evaluated.d20,
    outcome: !input.targetStillDying ? 'NOT_DYING' : evaluated.reachesDc ? 'STABILIZED' : 'FAILED',
    targetTransition: transition
  })
  return {
    result: storedCheckResult({
      evaluated,
      continuation,
      occurrenceVersion: input.occurrenceVersion,
      initialFactsChecksum: input.initialFactsChecksum,
      applicationOutputs
    }),
    applicationOutputs
  }
}

/** The stored COMPLETE result of a settled single-d20 check, around its application outputs. */
export function storedCheckResult(input: {
  evaluated: Pick<Awaited<ReturnType<typeof rollEncounterCheck>>, 'execution'>
  continuation: ServerRuleExecutionContinuationDto
  occurrenceVersion: number
  initialFactsChecksum: string
  applicationOutputs: ServerRuleExecutionApplicationOutputsDto
}) {
  const result = storedRuleExecutionResultDtoSchema.parse({
    status: 'COMPLETE',
    occurrenceId: input.continuation.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    initialFactsChecksum: input.initialFactsChecksum,
    outputs: input.evaluated.execution.outputs,
    evidence: input.evaluated.execution.evidence,
    applicationOutputs: input.applicationOutputs
  })
  if (result.status !== 'COMPLETE') throw new Error('The check did not complete.')
  return result
}
