import {
  type D20AddedDieDto,
  type D20RolledAddedDieDto
} from '@artificer-toolkit/schema/shared/d20AddedDice'
import {
  d20CheckTotal,
  type D20MinimumRollDto
} from '@artificer-toolkit/schema/shared/d20MinimumRoll'
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
import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CharacterStabilizeOutcomeApplication } from './characterRuleActionSystemAdapter.js'
import { isEncounterTargetDying } from './encounterActorDefeat.js'
import {
  freezeD20Context,
  settleEncounterD20Answer,
  settleEncounterD20Test
} from './encounterD20Settlement.js'
import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'
import { EncounterValidationError } from './encounterErrors.js'
import type { EncounterEvidenceAnswer } from './encounterEvidenceAnswer.js'
import { actorContestFacts, checkAbilityCode } from './encounterMovementPassagePreparation.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import { d20TestDefinitionCapabilityRegistry } from './platformEncounterPolicy.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

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
  const { d20, consumedGrants } = freezeEncounterActorCheck({ ...input, actor: helper })
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
      d20,
      consumedGrants
    })
  }
}

/**
 * Freezes an actor's one authored check from their own facts: the System check definition's
 * modifier and contributors (conditions included, and any Help they hold), and the one-check
 * grants the check uses up. A custom actor has no check facts and is refused.
 */
export function freezeEncounterActorCheck<TCharacterFacts extends CharacterMovementFacts>(input: {
  gameSystemId: string
  system: SystemAuthoredDto
  check: { checkKind: 'SKILL' | 'ABILITY'; checkDefinitionId: string }
  actor: MovementTarget<TCharacterFacts>
}) {
  const { actor, check } = input
  if (actor.actor.kind === 'CUSTOM')
    throw new EncounterValidationError('A custom actor has no check to make.')
  const facts = actorContestFacts({
    actorId: actor.actor.id,
    checkKind: check.checkKind,
    checkDefinitionId: check.checkDefinitionId,
    gameSystemId: input.gameSystemId,
    system: input.system,
    targets: new Map([[actor.actor.id, actor]])
  })
  if (facts.modifier === null)
    throw new EncounterValidationError('This actor has no total for the check.')
  return {
    d20: freezeD20Context({ gameSystemId: input.gameSystemId, ...facts, modifier: facts.modifier }),
    consumedGrants: discoverEncounterEventHooks({
      effects: actor.activeEffects,
      events: [
        {
          kind: 'TEST',
          test: 'CHECK',
          ability: {
            code: checkAbilityCode(input.system, check.checkKind, check.checkDefinitionId)
          }
        }
      ]
    }).ended
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

/**
 * Starts a check graph, which asks for the d20 and, when the check rolls any, its added dice: the
 * System's basic action check, or an action's compiled check test (D173).
 */
export async function startEncounterBasicActionCheck(input: {
  runtime: RulesRuntimeService
  gameSystemId: string
  occurrenceId: string
  /** The frozen check's added dice; absent when it rolls none. */
  addedDice?: readonly D20AddedDieDto[]
  /** The action's compiled check test; absent for the System's basic action check. */
  published?: ServerPublishedRuleDefinitionDto
}): Promise<ServerRuleExecutionContinuationDto> {
  const system = d20TestDefinitionCapabilityRegistry.require(input.gameSystemId)
  const published = input.published ?? system.basicActionCheckDefinition()
  const started = await input.runtime.executeResolved({
    command: {
      definitionId: published.id,
      occurrenceId: input.occurrenceId,
      facts: system.addedDiceFacts(input.addedDice ?? [])
    },
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

/**
 * Whether a settled check's d20 is the frozen check's: its modifier, mode, contributors, added dice
 * and floor are the ones frozen, and its total counts them (the kept face raised to the floor).
 * `windowDice` are the after-roll dice the roller spent in a d20 window: they follow the frozen dice.
 */
export function settledCheckD20MatchesFrozen(
  settled: {
    modifier: number
    derivedRollMode: string
    contributorChecksum: string
    selectedNatural: number
    total: number
    addedDice?: readonly D20RolledAddedDieDto[]
    minimumRoll?: D20MinimumRollDto
  },
  frozen: EncounterD20CheckContext['d20'],
  windowDice: readonly Pick<D20AddedDieDto, 'label' | 'count' | 'faces' | 'sign'>[] = []
): boolean {
  const dice = (list: readonly Pick<D20AddedDieDto, 'label' | 'count' | 'faces' | 'sign'>[] = []) =>
    list.map(({ label, count, faces, sign }) => ({ label, count, faces, sign }))
  return (
    settled.modifier === frozen.modifier &&
    settled.derivedRollMode === frozen.rollMode &&
    settled.contributorChecksum === frozen.contributorChecksum &&
    checksumRuleDocument(dice(settled.addedDice)) ===
      checksumRuleDocument(dice([...(frozen.addedDice ?? []), ...windowDice])) &&
    checksumRuleDocument(settled.minimumRoll ?? null) ===
      checksumRuleDocument(frozen.minimumRoll ?? null) &&
    settled.total === d20CheckTotal(settled)
  )
}

/** Rolls a frozen check's one d20: the natural die plus the roller's modifier, against no DC yet. */
export async function rollEncounterCheck(input: {
  gameSystemId: string
  runtime: RulesRuntimeService
  context: Pick<EncounterD20CheckContext, 'd20'>
  continuation: ServerRuleExecutionContinuationDto
  answer: EncounterEvidenceAnswer
  rollD20: () => number
  /** Rolls the check's added dice for an auto-roll; a check that has none needs no source. */
  random?: (maxExclusive: number) => number
  expectedOccurrenceId: string
}) {
  const { context, continuation, answer } = input
  requireD20Request(continuation)
  if (
    answer.requestId !== continuation.request.requestId ||
    continuation.occurrenceId !== input.expectedOccurrenceId
  )
    throw new EncounterValidationError('The basic action check evidence is stale.')
  const roll = settleEncounterD20Answer({
    gameSystemId: input.gameSystemId,
    d20: context.d20,
    answer,
    rollD20: input.rollD20,
    random:
      input.random ??
      (() => {
        throw new EncounterValidationError('This check cannot roll added dice.')
      })
  })
  const { addedDice } = roll
  const execution = await settleEncounterD20Test({
    continuation,
    roll,
    resume: (step) => input.runtime.resume(step),
    outputs: { rawDie: 'rawDie', addedTotal: 'addedTotal' },
    refusal: () =>
      new EncounterValidationError('The basic action check requested more than its dice.')
  })
  return {
    execution,
    d20: {
      requestId: continuation.request.requestId,
      rollMode: roll.rollMode,
      keep: roll.keep,
      derivedRollMode: context.d20.rollMode,
      rawFaces: roll.rawFaces,
      selectedNatural: roll.natural,
      modifier: context.d20.modifier,
      total: d20CheckTotal({
        selectedNatural: roll.natural,
        modifier: context.d20.modifier,
        addedDice,
        minimumRoll: context.d20.minimumRoll
      }),
      contributors: context.d20.contributors,
      contributorChecksum: context.d20.contributorChecksum,
      ...(addedDice.length > 0 && { addedDice }),
      ...(context.d20.minimumRoll && { minimumRoll: context.d20.minimumRoll })
    }
  }
}

/** Sets a rolled d20 against the check's DC. */
export function evaluateRolledEncounterBasicActionCheck(
  rolled: Awaited<ReturnType<typeof rollEncounterCheck>>,
  dc: number
) {
  return {
    execution: rolled.execution,
    d20: { ...rolled.d20, dc },
    reachesDc: rolled.d20.total >= dc
  }
}

/** Rolls the frozen check against its DC: the natural d20 plus the helper's modifier. */
export async function evaluateEncounterBasicActionCheck(
  input: Parameters<typeof rollEncounterCheck>[0] & { context: EncounterD20CheckContext }
) {
  return evaluateRolledEncounterBasicActionCheck(
    await rollEncounterCheck(input),
    input.context.check.dc
  )
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
