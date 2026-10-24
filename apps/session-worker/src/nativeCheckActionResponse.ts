import type { readCheckActionSnapshot } from '@artificer-toolkit/encounter-persistence/basicActionCheckPending'
import {
  resolveEncounterActionInputDtoSchema,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  liveSessionEncounterBasicActionResponseCommitInputSchema,
  liveSessionEncounterCheckPauseCommitInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  checkActionApplicationOutputDtoSchema,
  type EncounterCheckActionCandidatesDto
} from '@artificer-toolkit/schema/shared/ruleExecutionCheckAction'
import { withLinkedDependents } from '@artificer-toolkit/rules-runtime/activeEffectLinks'
import { endedEffectReleases } from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  encounterBasicActionCheckPendingSnapshot,
  evaluateRolledEncounterBasicActionCheck,
  startEncounterBasicActionCheck,
  storedCheckResult
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import { EncounterValidationError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { withEncounterAppRoll } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { answerNativeD20Check } from './nativeD20Window.js'
import type { liveEncounterCaptures } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  type readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'
import { prepareNativeLiveRootActionMechanics } from './nativeRootActionPreparation.js'
import { planHolderMechanics, planNativeTargetOutcome } from './nativeTargetOutcome.js'

type LiveActors = Awaited<ReturnType<typeof readNativeLiveActorsAndEffects>>
type Ready = NonNullable<
  Extract<LiveSessionEncounterRulesResponse, { kind: 'BASIC_ACTION' }>['ready']
>

/**
 * Plans the roller's answer to a pending check action (D173). Their d20 opens a window on the held
 * dice they may add, or settles the check against its DC; a window's answer settles it with the
 * die it chose. A success re-prepares the action from its root command and runs its outcome, which
 * pauses on the outcome's dice unless the roller's preference rolls them. Convex re-applies the
 * plan; it never rolls.
 */
export async function planNativeLiveCheckActionResponse(input: {
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  initial: LiveSessionEncounterRulesInput
  reads: ReturnType<typeof liveEncounterCaptures>
  ready: Ready
  command: ResolveRuleOccurrenceInputDto
  pending: NonNullable<ReturnType<typeof readCheckActionSnapshot>>
  state: EncounterRunState
  system: SystemAuthoredDto
  actors: LiveActors['actors']
  activeEffectsByActorId: LiveActors['activeEffectsByActorId']
  executionOptions: {
    runtime: RulesRuntimeService
    random(maximum: number): number
    captures: Parameters<typeof liveEncounterCaptures>[1]
  }
}) {
  const { scope, reads, ready, command, pending, state, system, actors } = input
  const { activeEffectsByActorId, executionOptions } = input
  const { runtime, random } = executionOptions
  const { context, continuation, snapshot, window } = pending
  const occurredAt = new Date().toISOString()
  const optionalCombatSnapshotChecksum =
    ready.snapshot?.snapshotKind === 'KERNEL_EVIDENCE'
      ? (ready.snapshot.optionalCombatSnapshotChecksum ?? null)
      : null
  const rulesFor = (nextActors: readonly EncounterRunActorState[]) => {
    const facts = buildEncounterActorRuleFacts({ actors })
    const nextFacts = buildEncounterActorRuleFacts({ actors: nextActors })
    return reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
      nextFacts,
      {
        output: reconcileEncounterActorRuleOutput(
          evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
          facts
        )
      }
    )
  }
  const pause = (
    next: ServerKernelRuleExecutionPendingSnapshotDto,
    window?: { spentEffect: ActiveRuleEffectRecord | null }
  ) => ({
    kind: 'CHECK_ACTION_PAUSE' as const,
    input: liveSessionEncounterCheckPauseCommitInputSchema.parse({
      ...scope,
      command,
      revisions: reads.revisions(),
      occurredAt,
      snapshot: next,
      ...(window && { window }),
      rules: rulesFor(actors)
    })
  })
  // What the answer settles from: the check's d20 (or the die a window on it chose), or the rolled
  // d20 an outcome's dice follow. A window always follows the check's own d20.
  const rolled =
    context.phase.kind === 'OUTCOME'
      ? {
          ...context.phase,
          occurrenceVersion: command.expectedOccurrenceVersion,
          window: undefined
        }
      : await answerNativeD20Check({
          runtime,
          random,
          gameSystemId: state.gameSystemId,
          system,
          command,
          appRoll: ready.appRoll,
          source: { kind: 'CHECK_ACTION', context },
          pending: { snapshot, continuation, window },
          rollerEffects: activeEffectsByActorId.get(context.actorId) ?? [],
          optionalCombatSnapshotChecksum,
          refusal: 'A check action requires d20 evidence.'
        })
  if (rolled.kind === 'WINDOW') return pause(rolled.snapshot)
  const evaluated = evaluateRolledEncounterBasicActionCheck(rolled.rolled, context.check.dc)
  const step = context.candidates
    ? await planCandidateStep({
        ...input,
        candidates: context.candidates,
        evaluated,
        occurredAt,
        optionalCombatSnapshotChecksum
      })
    : null
  const outcome =
    evaluated.reachesDc && !step
      ? await planCheckActionOutcome({
          ...input,
          evaluated,
          occurredAt,
          // An outcome's dice answer resumes its paused graph; a fresh success starts it.
          answered:
            context.phase.kind === 'OUTCOME'
              ? (() => {
                  const answer = withEncounterAppRoll(command.resolution, ready.appRoll)
                  if (answer.kind !== 'ENTER_INTEGER' && answer.kind !== 'SYSTEM_ROLL')
                    throw new EncounterValidationError(
                      'A check action outcome answers with its dice.'
                    )
                  return { continuation, answer }
                })()
              : null
        })
      : null
  const { commandJson: _commandJson, phase: _phase, ...settledContext } = context
  if (outcome?.kind === 'PENDING')
    return pause(
      encounterBasicActionCheckPendingSnapshot({
        continuation: outcome.continuation,
        context: {
          ...context,
          phase: {
            kind: 'OUTCOME',
            rolled: rolled.rolled,
            appRollId: rolled.appRollId,
            windowDice: rolled.windowDice
          }
        },
        optionalCombatSnapshotChecksum
      }),
      rolled.window
    )
  const execution = storedCheckResult({
    evaluated,
    continuation,
    // A d20 that paused keeps the version and facts it was recorded under.
    occurrenceVersion: rolled.occurrenceVersion,
    initialFactsChecksum: rolled.rolled.initialFactsChecksum,
    applicationOutputs: checkActionApplicationOutputDtoSchema.parse({
      kind: 'CHECK_ACTION',
      schemaVersion: 1,
      occurrenceId: snapshot.occurrenceId,
      commandId: context.commandId,
      source: context.source,
      actorId: context.actorId,
      targetActorId: context.targetActorId,
      check: { checkDefinitionId: context.check.checkDefinitionId, dc: context.check.dc },
      d20: evaluated.d20,
      outcome: evaluated.reachesDc ? 'SUCCESS' : 'FAILURE',
      ...(step && { candidateEffectId: step.effectId }),
      stateTransition: (step ?? outcome)?.stateTransition ?? { kind: 'NONE' }
    })
  })
  const settledTarget = (step ?? outcome)?.actor
  return {
    kind: 'CHECK_ACTION_SETTLED' as const,
    input: liveSessionEncounterBasicActionResponseCommitInputSchema.parse({
      ...scope,
      command,
      revisions: reads.revisions(),
      occurredAt,
      settlement: {
        context: settledContext,
        execution,
        appRollId: rolled.appRollId,
        forcedMovements: outcome?.forcedMovements ?? [],
        ...(rolled.window && { window: rolled.window }),
        ...(step && { candidate: { endedEffects: step.endedEffects, next: step.next } })
      },
      rules: rulesFor(
        settledTarget
          ? actors.map((entry) => (entry.id === settledTarget.id ? settledTarget : entry))
          : actors
      )
    })
  }
}

/**
 * One of a spell's per-effect checks (D182): the d20 against the waiting candidate's DC. A success
 * ends that effect and the effects linked to it, with the conditions and temporary hit points only
 * they held, in the one mechanics batch Convex re-applies. The next candidate still held asks the
 * roller for its own d20 on the same check occurrence; one that ended before its turn is skipped.
 */
async function planCandidateStep(
  input: Parameters<typeof planNativeLiveCheckActionResponse>[0] & {
    candidates: EncounterCheckActionCandidatesDto
    evaluated: ReturnType<typeof evaluateRolledEncounterBasicActionCheck>
    occurredAt: string
    optionalCombatSnapshotChecksum: string | null
  }
) {
  const { candidates, evaluated, initial, state, actors, activeEffectsByActorId } = input
  const { context, snapshot } = input.pending
  const entry = candidates.entries[candidates.cursor]
  if (!entry || entry.dc !== context.check.dc)
    throw new EncounterValidationError('The spell check candidate is stale.')
  const held = activeEffectsByActorId.get(context.targetActorId) ?? []
  const candidate = held.find(({ id }) => id === entry.effectId)
  if (!candidate) throw new EncounterValidationError('The spell check candidate has ended.')
  const endedEffects = evaluated.reachesDc ? withLinkedDependents([candidate], held) : []
  const releases = endedEffectReleases({
    holderActorId: context.targetActorId,
    held,
    ended: endedEffects
  })
  const target = actors.find(({ id }) => id === context.targetActorId)
  if (!target) throw new EncounterValidationError('The spell check target is unavailable.')
  const mechanics = releases.length
    ? planHolderMechanics(
        {
          state,
          holder: (
            await prepareNativeLiveMovementTarget({
              scope: initial,
              state,
              actor: target,
              activeEffectsByActorId,
              ...input.executionOptions
            })
          ).target,
          occurrenceId: snapshot.occurrenceId,
          commandId: context.commandId,
          occurredAt: input.occurredAt,
          userId: initial.expectedUserId
        },
        releases
      )
    : null
  const stillHeld = new Set(
    held.filter(({ id }) => !endedEffects.some((ended) => ended.id === id)).map(({ id }) => id)
  )
  const nextCursor = candidates.entries.findIndex(
    ({ effectId }, index) => index > candidates.cursor && stillHeld.has(effectId)
  )
  return {
    effectId: entry.effectId,
    actor: mechanics?.updatedActor ?? target,
    endedEffects,
    stateTransition: mechanics
      ? {
          kind: 'TARGET_OUTCOME' as const,
          mechanics: {
            targetTransition: mechanics.targetTransition,
            targetCharacterStreamVersion: mechanics.characterStreamVersion,
            applications: mechanics.receiptApplications
          },
          forcedMovements: []
        }
      : { kind: 'NONE' as const },
    next:
      nextCursor < 0
        ? null
        : encounterBasicActionCheckPendingSnapshot({
            continuation: await startEncounterBasicActionCheck({
              runtime: input.executionOptions.runtime,
              gameSystemId: state.gameSystemId,
              occurrenceId: snapshot.occurrenceId,
              addedDice: context.d20.addedDice
            }),
            context: {
              ...context,
              check: { ...context.check, dc: candidates.entries[nextCursor]!.dc },
              candidates: { ...candidates, cursor: nextCursor },
              phase: { kind: 'CHECK' }
            },
            optionalCombatSnapshotChecksum: input.optionalCombatSnapshotChecksum
          })
  }
}

/** A won check's outcome on its target, re-prepared from the root command on the room's current inputs. */
async function planCheckActionOutcome(
  input: Parameters<typeof planNativeLiveCheckActionResponse>[0] & {
    evaluated: ReturnType<typeof evaluateRolledEncounterBasicActionCheck>
    occurredAt: string
    answered: Parameters<typeof planNativeTargetOutcome>[0]['answered']
  }
) {
  const { initial, reads, ready, pending, state, system, actors, activeEffectsByActorId } = input
  const { runtime, random } = input.executionOptions
  const { context, snapshot } = pending
  const { prepared } = await prepareNativeLiveRootActionMechanics({
    root: resolveEncounterActionInputDtoSchema.parse(JSON.parse(context.commandJson)),
    state,
    system,
    actors,
    activeEffectsByActorId,
    loadTarget: async (entry) => {
      const target = await prepareNativeLiveMovementTarget({
        scope: initial,
        state,
        actor: entry,
        activeEffectsByActorId,
        ...input.executionOptions
      })
      reads.observe(target.revisions)
      return target.target
    },
    capture: reads.capture
  })
  if (prepared.plan.kind !== 'TEST_OUTCOME') throw new Error('The check action outcome is stale.')
  return planNativeTargetOutcome({
    prepared,
    occurrenceId: snapshot.occurrenceId,
    commandId: context.commandId,
    occurredAt: input.occurredAt,
    userId: initial.expectedUserId,
    execution: input.evaluated.execution,
    testRollMode: input.evaluated.d20.rollMode,
    runtime,
    autoRoll: ready.autoRollByActorId[context.actorId] === true,
    answered: input.answered,
    random
  })
}
