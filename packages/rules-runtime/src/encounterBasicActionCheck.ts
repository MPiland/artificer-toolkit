import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { basicActionCheckApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import {
  encounterBasicActionCheckPendingContextDtoSchema,
  type encounterEscapeCheckPendingContextDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import type { characterMechanicsTargetStateDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { EncounterRuleRollTriggerDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerKernelRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CharacterStabilizeOutcomeApplication } from './characterRuleActionSystemAdapter.js'
import { TARGET_NOT_DYING_WARNING } from './encounterActionRuleWarnings.js'
import { evaluateEncounterActionTargetPolicy } from './encounterActionTargetPolicy.js'
import { isEncounterTargetDying } from './encounterActorDefeat.js'
import {
  encounterAllyAdvantageUses,
  encounterBasicActionAllyAdvantage,
  withEncounterD20Contributor
} from './encounterBasicActions.js'
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
/** The frozen d20 check every single-roll check action carries: First Aid and Escape. */
type EncounterD20CheckContext = Pick<EncounterBasicActionCheckPendingContextDto, 'check' | 'd20'>

/** Each System's basic action check graph: its one d20 request and no other evidence. */
const basicActionCheckDefinitionBySystemId: ReadonlyMap<
  string,
  typeof createDnd5eBasicActionCheckDefinition
> = new Map([[DND5E_SYSTEM_ID, createDnd5eBasicActionCheckDefinition]])

/** First Aid is a touch action on one willing creature, like the Healer's Kit. */
const touchPolicy: CompiledActionTargetPolicy = {
  range: { id: 'basic-action-touch', rangeKind: 'TOUCH' },
  targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'WILLING' },
  shape: null,
  pathOverrides: []
}

/**
 * The overridable warnings of a stabilizing basic action: a target that is not dying, plus the
 * touch targeting warnings the Healer's Kit reports.
 */
export function encounterBasicActionStabilizeWarnings(input: {
  actor: EncounterRunActorState
  target: MovementTarget
}): EncounterRuleWarningDto[] {
  return [
    ...(isEncounterTargetDying(input.target) ? [] : [TARGET_NOT_DYING_WARNING]),
    ...(evaluateEncounterActionTargetPolicy({
      actor: input.actor,
      target: input.target.actor,
      targetPolicy: touchPolicy,
      sceneContext: null,
      makesAttackRoll: false
    }) ?? [])
  ]
}

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

/** The check's name as the roller reads it: "Wisdom (Medicine)". */
export function encounterBasicActionCheckLabel(
  system: SystemAuthoredDto,
  checkDefinitionId: string
): string {
  // Only current Systems define UUID-backed check definitions.
  if (!('schemaVersion' in system) || system.schemaVersion !== 4)
    throw new EncounterValidationError('The System defines no check definitions.')
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
 * definition's modifier and contributors (conditions included), merged with a Help aimed at the
 * helper. Returns null when the target is not dying, so no check is made. A custom helper has no
 * check facts and is refused.
 */
export function prepareEncounterBasicActionCheck<
  TCharacterFacts extends CharacterMovementFacts
>(input: {
  gameSystemId: string
  commandId: string
  commandFingerprint: string
  definition: { id: string; version: number; checksum: string; label: string }
  check: { checkDefinitionId: string; dc: number }
  checkLabel: string
  helper: MovementTarget<TCharacterFacts>
  target: MovementTarget<TCharacterFacts>
  actors: readonly EncounterRunActorState[]
}): {
  context: EncounterBasicActionCheckPendingContextDto
  allyAdvantageUses: ReturnType<typeof encounterAllyAdvantageUses>
} | null {
  const { helper, target } = input
  if (helper.actor.kind === 'CUSTOM')
    throw new EncounterValidationError('A custom actor has no check to make.')
  if (!isEncounterTargetDying(target)) return null
  if (!target.actor.sourceId) throw new EncounterValidationError('Choose a Character to stabilize.')
  const facts = actorContestFacts({
    actorId: helper.actor.id,
    checkKind: 'SKILL',
    checkDefinitionId: input.check.checkDefinitionId,
    gameSystemId: input.gameSystemId,
    targets: new Map([[helper.actor.id, helper]])
  })
  if (facts.modifier === null)
    throw new EncounterValidationError('This actor has no total for the check.')
  const help = encounterBasicActionAllyAdvantage({
    actors: input.actors,
    attackerId: helper.actor.id
  })
  const merged = help
    ? withEncounterD20Contributor(facts.contributors, help.contributor)
    : { contributors: [...facts.contributors], rollMode: facts.rollMode }
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
      check: { ...input.check, label: input.checkLabel },
      d20: {
        rollMode: merged.rollMode,
        contributors: merged.contributors,
        contributorChecksum: checksumRuleDocument(merged.contributors),
        modifier: facts.modifier
      }
    }),
    allyAdvantageUses: encounterAllyAdvantageUses({
      actors: input.actors,
      participants: [{ actorId: helper.actor.id, contributors: merged.contributors }]
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
  context: EncounterBasicActionCheckPendingContextDto | EncounterEscapeCheckPendingContextDto
  optionalCombatSnapshotChecksum: string | null
}): ServerKernelRuleExecutionPendingSnapshotDto {
  return serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
    ...input.continuation,
    snapshotKind: 'KERNEL_EVIDENCE',
    optionalCombatSnapshotChecksum: input.optionalCombatSnapshotChecksum,
    applicationContext: input.context
  })
}

/** Rolls the frozen check against its DC: the natural d20 plus the helper's modifier. */
export async function evaluateEncounterBasicActionCheck(input: {
  runtime: RulesRuntimeService
  context: EncounterD20CheckContext
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
  const total = resolved.natural + context.d20.modifier
  return {
    execution,
    d20: {
      requestId: continuation.request.requestId,
      rollMode: resolved.rollMode,
      derivedRollMode: context.d20.rollMode,
      rawFaces: resolved.faces,
      selectedNatural: resolved.natural,
      modifier: context.d20.modifier,
      total,
      dc: context.check.dc,
      contributors: context.d20.contributors,
      contributorChecksum: context.d20.contributorChecksum
    },
    reachesDc: total >= context.check.dc
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
  evaluated: Awaited<ReturnType<typeof evaluateEncounterBasicActionCheck>>
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
