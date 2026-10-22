import {
  readBasicActionCheckSnapshot,
  readD20WindowSnapshot
} from '@artificer-toolkit/encounter-persistence/basicActionCheckPending'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  liveSessionEncounterBasicActionResponseCommitInputSchema,
  liveSessionEncounterD20WindowOpenCommitInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { readEncounterBasicActionEntries } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  completeEncounterBasicActionCheckResult,
  encounterBasicActionStabilizeApplication,
  evaluateRolledEncounterBasicActionCheck,
  rollEncounterCheck
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import {
  encounterD20WindowSelection,
  encounterHeldCheckDice,
  openEncounterD20Window,
  settleEncounterD20Window
} from '@artificer-toolkit/rules-runtime/encounterD20Window'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { isEncounterTargetDying } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { settleNativeConcealmentCheck } from './nativeConcealmentCheck.js'
import { bindEncounterD20Evidence } from './nativeD20Evidence.js'
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects,
  readNativeLiveSpellPins
} from './nativeEncounterTargets.js'

/**
 * Plans the roller's d20 for a pending basic action check in the room. First Aid's die settles the
 * frozen check, and a roll that reaches the DC stabilizes the target if it is still dying; a
 * concealment check (Hide, Search) is decided per observer from its total. Convex re-applies the
 * change and records the result; it never rolls.
 */
export async function planNativeLiveBasicActionResponse(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  response: ResolveRuleOccurrenceInputDto,
  executionOptions: {
    runtime: RulesRuntimeService
    random(maximum: number): number
    captures: LiveCaptureReads
  }
) {
  const request = { kind: 'BASIC_ACTION' as const, command: response }
  const initial = liveSessionEncounterRulesInputSchema.parse({
    ...scope,
    // A player's admitted answer lets its follow-up captures read the rules inputs.
    ...(scope.expectedRole === 'PLAYER' ? { action: request } : {}),
    request
  })
  if (
    response.encounterId.toLowerCase() !== initial.encounterId ||
    response.expectedVersion !== initial.expectedVersion
  )
    throw new Error('Live basic action check scope mismatch.')
  const reads = liveEncounterCaptures(initial, executionOptions.captures)
  const { capture } = reads
  const admission = await capture(request)
  if (admission.result) return { kind: 'REPLAY' as const, result: admission.result }
  const ready = admission.ready
  if (!ready || ready.command.type !== 'RESOLVE_RULE_OCCURRENCE' || !ready.snapshot)
    throw new Error('The basic action check is unavailable.')
  // A d20 window holds the roll its roller already made; the check it follows is frozen inside it.
  const pendingWindow = readD20WindowSnapshot(ready.snapshot)
  const { context, continuation, snapshot } = pendingWindow
    ? {
        context: pendingWindow.context.source.context,
        continuation: pendingWindow.continuation,
        snapshot: pendingWindow.snapshot
      }
    : readBasicActionCheckSnapshot(ready.snapshot)
  const { state, system } = await capture({ kind: 'INPUTS' })
  if (state.id !== initial.encounterId || state.version !== initial.expectedVersion)
    throw new Error('Basic action check Run inputs changed during capture.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  if (context.kind === 'ENCOUNTER_CONCEALMENT_CHECK') {
    const roller = actors.find((entry) => entry.id === context.actorId)
    if (!roller) throw new Error('Basic action check actors are unavailable.')
    const rollerTarget = await prepareNativeLiveMovementTarget({
      scope: initial,
      state,
      actor: roller,
      activeEffectsByActorId,
      ...executionOptions
    })
    reads.observe(rollerTarget.revisions)
    const source = resolveEncounterActionSource({
      actor: roller,
      actionId: context.actionId,
      gameSystemId: state.gameSystemId,
      system,
      spells: await readNativeLiveSpellPins(capture),
      basicActions: await readEncounterBasicActionEntries({
        actorId: roller.id,
        actionId: context.actionId,
        gameSystemId: state.gameSystemId,
        definitions: {
          requireCurrent: async (definitionId) => {
            const response = await capture({ kind: 'DEFINITION', definitionId })
            if (response.kind !== 'DEFINITION' || !response.definition)
              throw new Error('The concealment check capability is unavailable.')
            return response.definition
          }
        }
      })
    })
    if (source.kind !== 'BASIC_ACTION') throw new Error('The concealment check action is stale.')
    const answer = bindEncounterD20Evidence({
      response: { resolution: ready.command.resolution, appRoll: ready.appRoll },
      refusal: 'A concealment check requires d20 evidence.'
    })
    const occurredAt = new Date().toISOString()
    const settlement = settleNativeConcealmentCheck({
      context,
      continuation,
      evaluated: await rollEncounterCheck({
        gameSystemId: state.gameSystemId,
        runtime: executionOptions.runtime,
        context,
        continuation,
        answer,
        rollD20: () => executionOptions.random(20) + 1,
        random: executionOptions.random,
        expectedOccurrenceId: snapshot.occurrenceId
      }),
      appRollId: ready.appRoll?.rollId ?? null,
      state,
      actors,
      activeEffectsByActorId,
      capability: source.capability,
      occurredAt,
      occurrenceVersion: response.expectedOccurrenceVersion + 1
    })
    const facts = buildEncounterActorRuleFacts({ actors })
    return {
      kind: 'PLANNED' as const,
      input: liveSessionEncounterBasicActionResponseCommitInputSchema.parse({
        ...scope,
        command: ready.command,
        revisions: reads.revisions(),
        occurredAt,
        settlement,
        rules: reconcileEncounterActorRuleOutput(
          evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
          facts
        )
      })
    }
  }
  const targetActor = actors.find((entry) => entry.id === context.targetActorId)
  if (!targetActor) throw new Error('Basic action check actors are unavailable.')
  const prepared = await prepareNativeLiveMovementTarget({
    scope: initial,
    state,
    actor: targetActor,
    activeEffectsByActorId,
    ...executionOptions
  })
  reads.observe(prepared.revisions)
  const target = prepared.target
  // The roll was spent either way; the target may have stabilized or died while it waited.
  const targetStillDying = isEncounterTargetDying(target)
  const occurredAt = new Date().toISOString()
  const settledWindow = pendingWindow
    ? {
        context: pendingWindow.context,
        ...(await settleEncounterD20Window({
          runtime: executionOptions.runtime,
          context: pendingWindow.context,
          continuation: pendingWindow.continuation,
          selection: encounterD20WindowSelection(ready.command.resolution),
          random: executionOptions.random
        }))
      }
    : null
  let rolled: Awaited<ReturnType<typeof rollEncounterCheck>>
  if (settledWindow)
    rolled = {
      execution: settledWindow.context.pause.payload.rolled.execution,
      d20: settledWindow.d20
    }
  else {
    const answer = bindEncounterD20Evidence({
      response: { resolution: ready.command.resolution, appRoll: ready.appRoll },
      refusal: 'A basic action check requires d20 evidence.'
    })
    rolled = await rollEncounterCheck({
      gameSystemId: state.gameSystemId,
      runtime: executionOptions.runtime,
      context,
      continuation,
      answer,
      rollD20: () => executionOptions.random(20) + 1,
      random: executionOptions.random,
      expectedOccurrenceId: snapshot.occurrenceId
    })
  }
  // The roller's after-roll dice pause the roll once it is seen, before the check settles.
  const heldDice = !settledWindow
    ? encounterHeldCheckDice(
        system,
        activeEffectsByActorId.get(context.helperActorId) ?? [],
        context.check.checkDefinitionId
      )
    : []
  if (heldDice.length > 0) {
    const window = await openEncounterD20Window({
      runtime: executionOptions.runtime,
      occurrenceId: snapshot.occurrenceId,
      gameSystemId: state.gameSystemId,
      source: { kind: 'BASIC_ACTION_CHECK', context },
      rolled: {
        execution: rolled.execution,
        initialFactsChecksum: checksumRuleDocument(continuation.facts),
        d20: rolled.d20
      },
      appRollId: ready.appRoll?.rollId ?? null,
      heldDice,
      optionalCombatSnapshotChecksum:
        ready.snapshot.snapshotKind === 'KERNEL_EVIDENCE'
          ? (ready.snapshot.optionalCombatSnapshotChecksum ?? null)
          : null
    })
    const windowFacts = buildEncounterActorRuleFacts({ actors })
    return {
      kind: 'WINDOW_OPEN' as const,
      input: liveSessionEncounterD20WindowOpenCommitInputSchema.parse({
        ...scope,
        command: ready.command,
        revisions: reads.revisions(),
        occurredAt,
        snapshot: window.snapshot,
        rules: reconcileEncounterActorRuleOutput(
          evaluateInstalledEncounterActors({
            gameSystemId: state.gameSystemId,
            facts: windowFacts
          }),
          windowFacts
        )
      })
    }
  }
  const evaluated = evaluateRolledEncounterBasicActionCheck(rolled, context.check.dc)
  const stabilized =
    evaluated.reachesDc && targetStillDying
      ? planEncounterMechanicsBatch({
          batch: {
            encounterId: state.id,
            targetActorId: target.actor.id,
            expectedEncounterVersion: state.version,
            occurrenceId: snapshot.occurrenceId,
            sourceCommandId: context.commandId,
            commandId: deriveEncounterCharacterMechanicsEventCommandId({
              occurrenceId: snapshot.occurrenceId,
              sourceCommandId: context.commandId,
              phase: 'BASIC_ACTION_CHECK',
              ordinal: 0,
              targetCharacterId: context.targetCharacterId
            }),
            occurredAt,
            applications: [encounterBasicActionStabilizeApplication(context.targetActorId)],
            expectedCharacterStreamVersion:
              target.characterFacts?.active.play.streamVersion ?? null,
            effectiveMaximumHitPoints: target.effectiveMaximumHitPoints,
            damageInterceptions: target.damageInterceptions,
            effectiveScalarValues: target.effectiveScalarValues,
            forceVersionAdvance: false
          },
          actor: target.actor,
          userId: initial.expectedUserId,
          ...(target.characterFacts ? { characterFacts: target.characterFacts } : {})
        })
      : null
  const { result } = completeEncounterBasicActionCheckResult({
    context,
    continuation,
    evaluated,
    targetStillDying,
    transition: stabilized
      ? {
          before: stabilized.targetTransition.before,
          after: stabilized.targetTransition.after,
          afterStreamVersion: stabilized.characterStreamVersion
        }
      : null,
    // A window's check keeps the version and facts its d20 was recorded under, before it paused.
    occurrenceVersion: response.expectedOccurrenceVersion + (settledWindow ? 0 : 1),
    initialFactsChecksum: settledWindow
      ? settledWindow.context.pause.payload.rolled.initialFactsChecksum
      : checksumRuleDocument(continuation.facts)
  })
  const facts = buildEncounterActorRuleFacts({ actors })
  const spentEffect = settledWindow?.option
    ? (activeEffectsByActorId
        .get(context.helperActorId)
        ?.find((effect) => effect.id === settledWindow.option?.effectId) ?? null)
    : null
  return {
    kind: settledWindow ? ('WINDOW_ANSWER' as const) : ('PLANNED' as const),
    input: liveSessionEncounterBasicActionResponseCommitInputSchema.parse({
      ...scope,
      command: ready.command,
      revisions: reads.revisions(),
      occurredAt,
      settlement: {
        context,
        execution: result,
        appRollId: settledWindow
          ? settledWindow.context.pause.payload.appRollId
          : (ready.appRoll?.rollId ?? null),
        ...(settledWindow && { window: { spentEffect } })
      },
      rules: reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
        facts
      )
    })
  }
}
