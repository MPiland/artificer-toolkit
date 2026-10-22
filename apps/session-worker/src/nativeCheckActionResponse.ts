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
import { checkActionApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCheckAction'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  encounterBasicActionCheckPendingSnapshot,
  evaluateRolledEncounterBasicActionCheck,
  rollEncounterCheck,
  storedCheckResult
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import {
  encounterD20WindowSelection,
  encounterHeldCheckDice,
  openEncounterD20Window,
  settleEncounterD20Window
} from '@artificer-toolkit/rules-runtime/encounterD20Window'
import { EncounterValidationError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { withEncounterAppRoll } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { bindEncounterD20Evidence } from './nativeD20Evidence.js'
import type { liveEncounterCaptures } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  type readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'
import { prepareNativeLiveRootActionMechanics } from './nativeRootActionPreparation.js'
import { planNativeTargetOutcome } from './nativeTargetOutcome.js'

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
    spentEffect?: ActiveRuleEffectRecord | null
  ) => ({
    kind: 'CHECK_ACTION_PAUSE' as const,
    input: liveSessionEncounterCheckPauseCommitInputSchema.parse({
      ...scope,
      command,
      revisions: reads.revisions(),
      occurredAt,
      snapshot: next,
      ...(spentEffect !== undefined && { window: { spentEffect } }),
      rules: rulesFor(actors)
    })
  })
  // What the answer settles from: the d20 it rolls, the window's chosen die, or the rolled d20 an
  // outcome's dice follow.
  const settledWindow = window
    ? await settleEncounterD20Window({
        runtime,
        context: window,
        continuation,
        selection: encounterD20WindowSelection(command.resolution),
        random
      })
    : null
  const rolled =
    window && settledWindow
      ? {
          ...window.pause.payload,
          rolled: { ...window.pause.payload.rolled, d20: settledWindow.d20 },
          windowDice: settledWindow.option ? [settledWindow.option] : []
        }
      : context.phase.kind === 'OUTCOME'
        ? context.phase
        : {
            rolled: {
              ...(await rollEncounterCheck({
                gameSystemId: state.gameSystemId,
                runtime,
                context,
                continuation,
                answer: bindEncounterD20Evidence({
                  response: { resolution: command.resolution, appRoll: ready.appRoll },
                  refusal: 'A check action requires d20 evidence.'
                }),
                rollD20: () => random(20) + 1,
                random,
                expectedOccurrenceId: snapshot.occurrenceId
              })),
              initialFactsChecksum: checksumRuleDocument(continuation.facts)
            },
            appRollId: ready.appRoll?.rollId ?? null,
            windowDice: []
          }
  const spentEffect = settledWindow
    ? settledWindow.option
      ? (activeEffectsByActorId
          .get(context.actorId)
          ?.find((effect) => effect.id === settledWindow.option?.effectId) ?? null)
      : null
    : undefined
  // The roller's after-roll dice pause the d20 once it is seen, before the check settles.
  const heldDice =
    !window && context.phase.kind === 'CHECK'
      ? encounterHeldCheckDice(
          system,
          activeEffectsByActorId.get(context.actorId) ?? [],
          context.check.checkDefinitionId
        )
      : []
  if (heldDice.length > 0) {
    const opened = await openEncounterD20Window({
      runtime,
      occurrenceId: snapshot.occurrenceId,
      gameSystemId: state.gameSystemId,
      source: { kind: 'CHECK_ACTION', context },
      rolled: rolled.rolled,
      appRollId: rolled.appRollId,
      heldDice,
      optionalCombatSnapshotChecksum
    })
    return pause(opened.snapshot)
  }
  const evaluated = evaluateRolledEncounterBasicActionCheck(rolled.rolled, context.check.dc)
  const outcome = evaluated.reachesDc
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
      spentEffect
    )
  const execution = storedCheckResult({
    evaluated,
    continuation,
    // A d20 that paused keeps the version and facts it was recorded under.
    occurrenceVersion:
      command.expectedOccurrenceVersion + (window || context.phase.kind === 'OUTCOME' ? 0 : 1),
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
      stateTransition: outcome?.stateTransition ?? { kind: 'NONE' }
    })
  })
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
        ...(spentEffect !== undefined && { window: { spentEffect } })
      },
      rules: rulesFor(
        outcome
          ? actors.map((entry) => (entry.id === outcome.actor.id ? outcome.actor : entry))
          : actors
      )
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
