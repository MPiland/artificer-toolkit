import { readBasicActionCheckSnapshot } from '@artificer-toolkit/encounter-persistence/basicActionCheckPending'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterBasicActionResponseCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  completeEncounterBasicActionCheckResult,
  encounterBasicActionStabilizeApplication,
  evaluateEncounterBasicActionCheck
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
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'

/**
 * Plans the helper's d20 for a pending basic action check (First Aid) in the room: the die settles
 * the frozen check, and a roll that reaches the DC stabilizes the target if it is still dying.
 * Convex re-applies the stabilize and records the result; it never rolls.
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
  const { state } = await capture({ kind: 'INPUTS' })
  if (state.id !== initial.encounterId || state.version !== initial.expectedVersion)
    throw new Error('Basic action check Run inputs changed during capture.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
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
