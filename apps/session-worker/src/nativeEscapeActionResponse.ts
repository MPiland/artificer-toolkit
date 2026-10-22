import { readEscapeCheckSnapshot } from '@artificer-toolkit/encounter-persistence/basicActionCheckPending'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { liveSessionEncounterEscapeResponseCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { evaluateEncounterBasicActionCheck } from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  completeEncounterEscapeCheckResult,
  encounterActorsAfterEscape,
  encounterEscapeEndedConditionIds
} from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { bindEncounterD20Evidence } from './nativeD20Evidence.js'
import { liveEncounterCaptures, type LiveCaptureReads } from './nativeEncounterReads.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'

/**
 * Plans the holder's d20 for a pending Escape check in the room: the die settles the frozen check,
 * and a roll that reaches the DC frees the holder if the relationship still holds them. Convex
 * re-applies the release and records the result; it never rolls.
 */
export async function planNativeLiveEscapeResponse(
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
    throw new Error('Live escape check scope mismatch.')
  const reads = liveEncounterCaptures(initial, executionOptions.captures)
  const { capture } = reads
  const admission = await capture(request)
  if (admission.result) return { kind: 'REPLAY' as const, result: admission.result }
  const ready = admission.ready
  if (!ready || ready.command.type !== 'RESOLVE_RULE_OCCURRENCE' || !ready.snapshot)
    throw new Error('The escape check is unavailable.')
  const { context, continuation, snapshot } = readEscapeCheckSnapshot(ready.snapshot)
  const { state } = await capture({ kind: 'INPUTS' })
  if (state.id !== initial.encounterId || state.version !== initial.expectedVersion)
    throw new Error('Escape check Run inputs changed during capture.')
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  // The roller is the held creature, or the rescuer who frees it (ATTACK-7.9).
  const heldActorId = context.heldActorId ?? context.actorId
  const holder = actors.find((entry) => entry.id === heldActorId)
  const heldEffects = activeEffectsByActorId.get(heldActorId)
  if (!holder || !heldEffects) throw new Error('Escape check actors are unavailable.')
  // A freed Character's Sheet changes, so its revision joins the commit's fence.
  const prepared = await prepareNativeLiveMovementTarget({
    scope: initial,
    state,
    actor: holder,
    activeEffectsByActorId,
    ...executionOptions
  })
  reads.observe(prepared.revisions)
  // The roll was spent either way; the relationship may have ended while it waited.
  const effectStillHeld = heldEffects.some((effect) => effect.id === context.activeEffectId)
  const answer = bindEncounterD20Evidence({
    response: { resolution: ready.command.resolution, appRoll: ready.appRoll },
    refusal: 'An escape check requires d20 evidence.'
  })
  const evaluated = await evaluateEncounterBasicActionCheck({
    gameSystemId: state.gameSystemId,
    runtime: executionOptions.runtime,
    context,
    continuation,
    answer,
    rollD20: () => executionOptions.random(20) + 1,
    random: executionOptions.random,
    expectedOccurrenceId: snapshot.occurrenceId
  })
  const { result } = completeEncounterEscapeCheckResult({
    context,
    continuation,
    evaluated,
    effectStillHeld,
    removedConditionIds: effectStillHeld
      ? encounterEscapeEndedConditionIds(heldEffects, context.activeEffectId)
      : [],
    occurrenceVersion: response.expectedOccurrenceVersion + 1,
    initialFactsChecksum: checksumRuleDocument(continuation.facts)
  })
  const nextActors =
    effectStillHeld && evaluated.reachesDc
      ? encounterActorsAfterEscape({
          encounterId: state.id,
          actors,
          holderId: heldActorId,
          holderEffects: heldEffects,
          activeEffectId: context.activeEffectId
        })
      : actors
  const facts = buildEncounterActorRuleFacts({ actors })
  const nextFacts = buildEncounterActorRuleFacts({ actors: nextActors })
  return {
    kind: 'PLANNED' as const,
    input: liveSessionEncounterEscapeResponseCommitInputSchema.parse({
      ...scope,
      command: ready.command,
      revisions: reads.revisions(),
      occurredAt: new Date().toISOString(),
      settlement: {
        context,
        execution: result,
        appRollId: ready.appRoll?.rollId ?? null
      },
      rules: reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
        nextFacts,
        {
          output: reconcileEncounterActorRuleOutput(
            evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
            facts
          )
        }
      )
    })
  }
}
