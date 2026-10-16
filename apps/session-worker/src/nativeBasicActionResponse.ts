import { readBasicActionCheckSnapshot } from '@artificer-toolkit/encounter-persistence/basicActionCheckPending'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterBasicActionResponseCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { readEncounterBasicActionEntries } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  completeEncounterBasicActionCheckResult,
  encounterBasicActionStabilizeApplication,
  evaluateEncounterBasicActionCheck,
  rollEncounterCheck
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { isEncounterTargetDying } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { withEncounterAppRoll } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { settleNativeConcealmentCheck } from './nativeConcealmentCheck.js'
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
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
  const { context, continuation, snapshot } = readBasicActionCheckSnapshot(ready.snapshot)
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
      captures: executionOptions.captures
    })
    reads.observe(rollerTarget.revisions)
    const source = resolveEncounterActionSource({
      actor: roller,
      actionId: context.actionId,
      gameSystemId: state.gameSystemId,
      system,
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
    const answer = withEncounterAppRoll(ready.command.resolution, ready.appRoll)
    if (answer.kind !== 'ENTER_DICE' && answer.kind !== 'SYSTEM_ROLL')
      throw new Error('A concealment check requires d20 evidence.')
    const occurredAt = new Date().toISOString()
    const settlement = settleNativeConcealmentCheck({
      context,
      continuation,
      evaluated: await rollEncounterCheck({
        runtime: executionOptions.runtime,
        context,
        continuation,
        answer,
        rollD20: () => executionOptions.random(20) + 1,
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
    captures: executionOptions.captures
  })
  reads.observe(prepared.revisions)
  const target = prepared.target
  // The roll was spent either way; the target may have stabilized or died while it waited.
  const targetStillDying = isEncounterTargetDying(target)
  // An app roll settles with the faces Convex recorded for it, never client-supplied values.
  const answer = withEncounterAppRoll(ready.command.resolution, ready.appRoll)
  if (answer.kind !== 'ENTER_DICE' && answer.kind !== 'SYSTEM_ROLL')
    throw new Error('A basic action check requires d20 evidence.')
  const evaluated = await evaluateEncounterBasicActionCheck({
    runtime: executionOptions.runtime,
    context,
    continuation,
    answer,
    rollD20: () => executionOptions.random(20) + 1,
    expectedOccurrenceId: snapshot.occurrenceId
  })
  const occurredAt = new Date().toISOString()
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
    occurrenceVersion: response.expectedOccurrenceVersion + 1,
    initialFactsChecksum: checksumRuleDocument(continuation.facts)
  })
  const facts = buildEncounterActorRuleFacts({ actors })
  return {
    kind: 'PLANNED' as const,
    input: liveSessionEncounterBasicActionResponseCommitInputSchema.parse({
      ...scope,
      command: ready.command,
      revisions: reads.revisions(),
      occurredAt,
      settlement: {
        context,
        execution: result,
        appRollId: ready.appRoll?.rollId ?? null
      },
      rules: reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
        facts
      )
    })
  }
}
